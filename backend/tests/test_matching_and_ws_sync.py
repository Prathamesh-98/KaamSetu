"""
Tests for improved MatchingService scoring fairness/accuracy,
application & chat real-time notification creation, and authenticated WebSocket delivery.
"""
import pytest
from types import SimpleNamespace
from uuid import uuid4
from fastapi import WebSocketDisconnect
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, delete

from app.main import app
from app.core.security import create_access_token, hash_password
from app.db.session import AsyncSessionLocal, engine
from app.models.models import (
    User, WorkerProfile, EmployerProfile, JobCategory, Job,
    JobApplication, Notification, UserRole, WorkType, SalaryType,
    JobStatus, AvailabilityStatus
)
from app.services.matching_service import MatchingService
from app.services.ws_manager import ws_manager
from app.api.routes.ws import websocket_endpoint


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _fake_job(**overrides):
    defaults = {
        "id": uuid4(),
        "title": "Electrician",
        "city": "Mumbai",
        "state": "Maharashtra",
        "latitude": 19.0760,
        "longitude": 72.8777,
        "experience_required": 3,
        "salary_min": 800,
        "salary_max": 1000,
        "salary_type": SalaryType.DAILY,
        "work_type": WorkType.DAILY,
        "category": SimpleNamespace(name="Electrical"),
        "required_skills": [SimpleNamespace(skill_id="sk-1", is_mandatory=True)],
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def test_matching_blank_profile_no_inflation():
    job = _fake_job()
    blank_worker = SimpleNamespace(
        city=None,
        state=None,
        latitude=None,
        longitude=None,
        years_experience=0,
        expected_salary=None,
        salary_type=None,
        preferred_work_types=None,
        availability_status=AvailabilityStatus.BUSY,
        skills=[],
    )
    res = MatchingService.calculate_match(blank_worker, job)
    assert res["factors"]["location"] == 0
    assert res["factors"]["skills"] == 0
    assert res["factors"]["work_type"] == 40
    assert res["score"] < 20


def test_matching_distance_coords_and_cross_period_salary():
    job = _fake_job()
    close_worker = SimpleNamespace(
        city=None,
        state=None,
        latitude=19.09,
        longitude=72.88,
        years_experience=5,
        expected_salary=100,
        salary_type=SalaryType.HOURLY,
        preferred_work_types=["DAILY"],
        availability_status=AvailabilityStatus.AVAILABLE,
        skills=[SimpleNamespace(skill_id="sk-1", skill=SimpleNamespace(category="Electrical"))],
    )
    far_worker = SimpleNamespace(
        city="Delhi",
        state="Delhi",
        latitude=28.6139,
        longitude=77.2090,
        years_experience=5,
        expected_salary=100,
        salary_type=SalaryType.HOURLY,
        preferred_work_types=["DAILY"],
        availability_status=AvailabilityStatus.AVAILABLE,
        skills=[SimpleNamespace(skill_id="sk-1", skill=SimpleNamespace(category="Electrical"))],
    )
    close_res = MatchingService.calculate_match(close_worker, job)
    far_res = MatchingService.calculate_match(far_worker, job)
    assert close_res["factors"]["location"] == 100
    assert close_res["factors"]["salary"] == 100
    assert close_res["factors"]["category"] == 100
    assert close_res["score"] == 100
    assert far_res["factors"]["location"] == 10
    assert close_res["score"] > far_res["score"]


@pytest.mark.anyio
async def test_application_notifications_created():
    created_user_ids = []
    created_job_ids = []
    try:
        async with AsyncSessionLocal() as db:
            cat = (await db.execute(select(JobCategory).limit(1))).scalar_one()
            emp_u = User(
                email=f"ws_emp_{uuid4().hex[:8]}@example.com",
                phone=f"9{uuid4().int % 1000000000:09d}",
                password_hash=hash_password("EmpPass123!"),
                role=UserRole.EMPLOYER,
                is_active=True,
            )
            wrk_u = User(
                email=f"ws_wrk_{uuid4().hex[:8]}@example.com",
                phone=f"9{uuid4().int % 1000000000:09d}",
                password_hash=hash_password("WrkPass123!"),
                role=UserRole.WORKER,
                is_active=True,
            )
            db.add_all([emp_u, wrk_u])
            await db.flush()
            created_user_ids.extend([emp_u.id, wrk_u.id])

            emp = EmployerProfile(user_id=emp_u.id, full_name="WS Emp", organization_name="WS Builders", city="Pune", state="Maharashtra")
            wrk = WorkerProfile(user_id=wrk_u.id, full_name="WS Worker", city="Pune", state="Maharashtra", availability_status=AvailabilityStatus.AVAILABLE)
            db.add_all([emp, wrk])
            await db.flush()

            active_job = Job(
                employer_id=emp.id,
                category_id=cat.id,
                title="WS Parity Job",
                description="Test job",
                work_type=WorkType.DAILY,
                salary_type=SalaryType.DAILY,
                city="Pune",
                state="Maharashtra",
                status=JobStatus.ACTIVE,
            )
            closed_job = Job(
                employer_id=emp.id,
                category_id=cat.id,
                title="Closed Job",
                description="Should reject match",
                work_type=WorkType.DAILY,
                salary_type=SalaryType.DAILY,
                city="Pune",
                state="Maharashtra",
                status=JobStatus.CLOSED,
            )
            db.add_all([active_job, closed_job])
            await db.flush()
            created_job_ids.extend([active_job.id, closed_job.id])
            await db.commit()

            emp_token = create_access_token({"sub": str(emp_u.id)})
            wrk_token = create_access_token({"sub": str(wrk_u.id)})
            active_id = str(active_job.id)
            closed_id = str(closed_job.id)

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res_closed = await client.get(f"/api/jobs/{closed_id}/match", headers={"Authorization": f"Bearer {wrk_token}"})
            assert res_closed.status_code == 400

            res_apply = await client.post(
                f"/api/jobs/{active_id}/apply",
                json={"cover_note": "Ready to join"},
                headers={"Authorization": f"Bearer {wrk_token}"},
            )
            assert res_apply.status_code == 201, res_apply.text
            app_id = res_apply.json()["id"]

            res_notif_emp = await client.get("/api/notifications", headers={"Authorization": f"Bearer {emp_token}"})
            assert res_notif_emp.status_code == 200
            assert any(n["type"] == "NEW_APPLICATION" for n in res_notif_emp.json())

            res_short = await client.put(
                f"/api/applications/{app_id}/status",
                json={"status": "SHORTLISTED"},
                headers={"Authorization": f"Bearer {emp_token}"},
            )
            assert res_short.status_code == 200

            res_notif_wrk = await client.get("/api/notifications", headers={"Authorization": f"Bearer {wrk_token}"})
            assert res_notif_wrk.status_code == 200
            assert any(n["type"] == "APPLICATION_SHORTLISTED" for n in res_notif_wrk.json())
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(Notification).where(Notification.user_id.in_(created_user_ids)))
            await db.execute(delete(JobApplication).where(JobApplication.job_id.in_(created_job_ids)))
            await db.execute(delete(Job).where(Job.id.in_(created_job_ids)))
            await db.execute(delete(EmployerProfile).where(EmployerProfile.user_id.in_(created_user_ids)))
            await db.execute(delete(WorkerProfile).where(WorkerProfile.user_id.in_(created_user_ids)))
            await db.execute(delete(User).where(User.id.in_(created_user_ids)))
            await db.commit()
        await engine.dispose()


@pytest.mark.anyio
async def test_websocket_auth_and_heartbeat():
    """Verify /api/ws authenticates active JWT, emits notifications, and rejects forged tokens."""
    created_uid = None

    class FakeWebSocket:
        def __init__(self, incoming):
            self.incoming = list(incoming)
            self.accepted = False
            self.closed_code = None
            self.sent_json = []
            self.sent_text = []

        async def accept(self):
            self.accepted = True

        async def close(self, code=1000):
            self.closed_code = code

        async def send_json(self, data):
            self.sent_json.append(data)

        async def send_text(self, text):
            self.sent_text.append(text)

        async def receive_text(self):
            if not self.incoming:
                raise WebSocketDisconnect()
            return self.incoming.pop(0)

    try:
        async with AsyncSessionLocal() as db:
            u = User(
                email=f"ws_ping_{uuid4().hex[:8]}@example.com",
                phone=f"9{uuid4().int % 1000000000:09d}",
                password_hash=hash_password("Pass123!"),
                role=UserRole.WORKER,
                is_active=True,
            )
            db.add(u)
            await db.commit()
            created_uid = u.id

        # 1. Invalid token closed with 4401
        bad_ws = FakeWebSocket([])
        await websocket_endpoint(bad_ws, token="forged.jwt.token")
        assert bad_ws.accepted is False
        assert bad_ws.closed_code == 4401

        # 2. Valid token connects, handles ping/pong, and receives emitted events
        token = create_access_token({"sub": str(created_uid)})
        good_ws = FakeWebSocket(["ping"])
        await websocket_endpoint(good_ws, token=token)
        assert good_ws.accepted is True
        assert good_ws.sent_json[0]["event"] == "connected"
        assert good_ws.sent_text == ["pong"]

        # 3. Direct ws_manager event push works and prunes disconnected socket safely
        live_ws = FakeWebSocket([])
        await ws_manager.connect(created_uid, live_ws)
        assert ws_manager.active_count(created_uid) == 1
        await ws_manager.emit_to_user(created_uid, "notification:created", {"title": "Hi"})
        assert live_ws.sent_json[-1] == {"event": "notification:created", "data": {"title": "Hi"}}
        ws_manager.disconnect(created_uid, live_ws)
        assert ws_manager.active_count(created_uid) == 0
    finally:
        if created_uid:
            async with AsyncSessionLocal() as db:
                await db.execute(delete(User).where(User.id == created_uid))
                await db.commit()
        await engine.dispose()
