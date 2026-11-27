"""
Tests for improved MatchingService scoring fairness/accuracy,
realistic synthetic worker/employer rankings, post-commit notification/WS delivery,
and zero-URL-token WebSocket first-frame authentication.
"""
import asyncio
import json
from datetime import timedelta
from types import SimpleNamespace
from uuid import uuid4
import pytest
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
from app.services.ws_manager import (
    ws_manager, queue_ws_event, MAX_CONNECTIONS_PER_USER, MAX_TOTAL_CONNECTIONS
)
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


def test_matching_synthetic_worker_cohort_ranking():
    """
    Validates 6 realistic synthetic workers against an Electrical Supervisor job in Pune:
      1. Ideal Local Specialist: Pune GPS (~2km), mandatory+optional skills, monthly-equivalent wage fitting daily budget, AVAILABLE -> rank #1
      2. Strong Same-City Over-budget: Pune, all skills, slightly above budget -> below Ideal Local
      3. Out-of-city State Peer: Nashik (same state), all skills -> mid-high score
      4. Missing Mandatory Skill (Optional-only): has optional skill sk-2, lacks mandatory sk-1 -> penalized (33% skills)
      5. Busy Worker in Pune: right skills/location, BUSY status -> availability=0
      6. Blank Incomplete Profile: no city, no skills, no salary -> bottom (<20%)
    """
    job = _fake_job(
        city="Pune",
        state="Maharashtra",
        latitude=18.5204,
        longitude=73.8567,
        experience_required=4,
        salary_min=900,
        salary_max=1100,
        salary_type=SalaryType.DAILY,
        work_type=WorkType.DAILY,
        category=SimpleNamespace(name="Electrical"),
        required_skills=[
            SimpleNamespace(skill_id="sk-mandatory", is_mandatory=True),
            SimpleNamespace(skill_id="sk-optional", is_mandatory=False),
        ],
    )

    ideal = SimpleNamespace(
        city="Pune", state="Maharashtra", latitude=18.53, longitude=73.86,
        years_experience=5, expected_salary=25000, salary_type=SalaryType.MONTHLY,  # ~961/day <= 1100
        preferred_work_types=["DAILY", "FULL_TIME"],
        availability_status=AvailabilityStatus.AVAILABLE,
        skills=[
            SimpleNamespace(skill_id="sk-mandatory", skill=SimpleNamespace(category="Electrical")),
            SimpleNamespace(skill_id="sk-optional", skill=SimpleNamespace(category="Electrical")),
        ],
    )
    over_budget = SimpleNamespace(
        city="Pune", state="Maharashtra", latitude=18.53, longitude=73.86,
        years_experience=5, expected_salary=1800, salary_type=SalaryType.DAILY,
        preferred_work_types=["DAILY"],
        availability_status=AvailabilityStatus.AVAILABLE,
        skills=ideal.skills,
    )
    state_peer = SimpleNamespace(
        city="Nashik", state="Maharashtra", latitude=19.9975, longitude=73.7898,
        years_experience=5, expected_salary=1000, salary_type=SalaryType.DAILY,
        preferred_work_types=["DAILY"],
        availability_status=AvailabilityStatus.AVAILABLE,
        skills=ideal.skills,
    )
    missing_mandatory = SimpleNamespace(
        city="Pune", state="Maharashtra", latitude=18.53, longitude=73.86,
        years_experience=5, expected_salary=950, salary_type=SalaryType.DAILY,
        preferred_work_types=["DAILY"],
        availability_status=AvailabilityStatus.AVAILABLE,
        skills=[SimpleNamespace(skill_id="sk-optional", skill=SimpleNamespace(category="Electrical"))],
    )
    busy_worker = SimpleNamespace(
        city="Pune", state="Maharashtra", latitude=18.53, longitude=73.86,
        years_experience=5, expected_salary=950, salary_type=SalaryType.DAILY,
        preferred_work_types=["DAILY"],
        availability_status=AvailabilityStatus.BUSY,
        skills=ideal.skills,
    )
    unavailable_worker = SimpleNamespace(
        city="Pune", state="Maharashtra", latitude=18.53, longitude=73.86,
        years_experience=5, expected_salary=950, salary_type=SalaryType.DAILY,
        preferred_work_types=["DAILY"],
        availability_status=AvailabilityStatus.UNAVAILABLE,
        skills=ideal.skills,
    )
    blank = SimpleNamespace(
        city=None, state=None, latitude=None, longitude=None,
        years_experience=0, expected_salary=None, salary_type=None,
        preferred_work_types=None, availability_status=AvailabilityStatus.UNAVAILABLE, skills=[],
    )

    s_ideal = MatchingService.calculate_match(ideal, job)
    s_over = MatchingService.calculate_match(over_budget, job)
    s_state = MatchingService.calculate_match(state_peer, job)
    s_miss = MatchingService.calculate_match(missing_mandatory, job)
    s_busy = MatchingService.calculate_match(busy_worker, job)
    s_unavail = MatchingService.calculate_match(unavailable_worker, job)
    s_blank = MatchingService.calculate_match(blank, job)

    assert s_ideal["score"] == 100
    assert s_ideal["factors"]["salary"] == 100
    assert s_ideal["factors"]["category"] == 100
    assert s_over["factors"]["salary"] == 0
    assert s_state["factors"]["location"] == 10
    assert s_miss["factors"]["skills"] == 33  # mandatory weight 2x vs optional 1x -> 1/3
    assert s_miss["score"] <= 35  # missing mandatory skill eligibility cap
    assert s_busy["factors"]["availability"] == 25
    assert s_busy["score"] == 75
    assert s_unavail["factors"]["availability"] == 0
    assert s_unavail["score"] == 40
    assert s_blank["score"] < 20
    assert (
        s_ideal["score"]
        > s_over["score"]
        > s_state["score"]
        > s_busy["score"]
        > s_unavail["score"]
        >= s_miss["score"]
        > s_blank["score"]
    )


@pytest.mark.anyio
async def test_application_notifications_and_rollback_safety():
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
                employer_id=emp.id, category_id=cat.id, title="WS Parity Job", description="Test job",
                work_type=WorkType.DAILY, salary_type=SalaryType.DAILY, city="Pune", state="Maharashtra", status=JobStatus.ACTIVE,
            )
            closed_job = Job(
                employer_id=emp.id, category_id=cat.id, title="Closed Job", description="Should reject match",
                work_type=WorkType.DAILY, salary_type=SalaryType.DAILY, city="Pune", state="Maharashtra", status=JobStatus.CLOSED,
            )
            db.add_all([active_job, closed_job])
            await db.flush()
            emp_uid = emp_u.id
            wrk_uid = wrk_u.id
            active_id = str(active_job.id)
            closed_id = str(closed_job.id)
            created_job_ids.extend([active_job.id, closed_job.id])
            await db.commit()

            # Verify rollback drops pending WS events within an active DB transaction
            await db.execute(select(User.id).limit(1))
            queue_ws_event(db, wrk_uid, "ghost:event", {"should": "not_fire"})
            await db.rollback()
            assert "pending_ws_events" not in db.sync_session.info

            emp_token = create_access_token({"sub": str(emp_uid)})
            wrk_token = create_access_token({"sub": str(wrk_uid)})

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
async def test_websocket_first_frame_auth_cap_and_event_ids():
    """Verify /api/ws uses first-frame JSON auth (zero URL JWT), enforces connection cap, and assigns unique event_ids."""
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

        class SlowSocket(FakeWebSocket):
            async def receive_text(self):
                if self.incoming:
                    return self.incoming.pop(0)
                await asyncio.sleep(2.0)
                raise WebSocketDisconnect()

        # 1. Invalid auth frame rejected with 4401
        bad_ws = FakeWebSocket([json.dumps({"type": "auth", "token": "forged.jwt"})])
        await websocket_endpoint(bad_ws)
        assert bad_ws.accepted is True
        assert bad_ws.closed_code == 4401

        # 2. Expired JWT rejected with 4401
        expired_token = create_access_token(
            {"sub": str(created_uid), "token_version": 1},
            expires_delta=timedelta(seconds=-5),
        )
        exp_ws = FakeWebSocket([json.dumps({"type": "auth", "token": expired_token})])
        await websocket_endpoint(exp_ws)
        assert exp_ws.closed_code == 4401

        # 3. Revoked JWT (token_version mismatch) rejected with 4401
        revoked_token = create_access_token({"sub": str(created_uid), "token_version": 99})
        rev_ws = FakeWebSocket([json.dumps({"type": "auth", "token": revoked_token})])
        await websocket_endpoint(rev_ws)
        assert rev_ws.closed_code == 4401

        # 4. Valid first-frame auth connects, handles both JSON ping->pong and legacy text ping->pong
        token = create_access_token({"sub": str(created_uid), "token_version": 1})
        good_ws = FakeWebSocket([
            json.dumps({"type": "auth", "token": token}),
            json.dumps({"type": "ping"}),
            "ping",
        ])
        await websocket_endpoint(good_ws)
        assert good_ws.sent_json[0]["event"] == "connected"
        assert good_ws.sent_json[0]["event_id"]
        assert good_ws.sent_json[1] == {"event": "pong", "data": {}}
        assert good_ws.sent_text == ["pong"]

        # 5. Mid-session expiring JWT closes cleanly with 4401
        short_token = create_access_token(
            {"sub": str(created_uid), "token_version": 1},
            expires_delta=timedelta(milliseconds=150),
        )
        short_ws = SlowSocket([json.dumps({"type": "auth", "token": short_token})])
        await websocket_endpoint(short_ws)
        assert short_ws.closed_code == 4401

        # 6. Connection cap per user evicts oldest socket safely and deduplicates event_ids
        sockets = []
        for _ in range(MAX_CONNECTIONS_PER_USER + 1):
            s = FakeWebSocket([])
            await ws_manager.register(created_uid, s)
            sockets.append(s)
        assert ws_manager.active_count(created_uid) == MAX_CONNECTIONS_PER_USER
        assert sockets[0].closed_code == 4000

        await ws_manager.emit_to_user(created_uid, "notification:created", {"title": "Hi"})
        await ws_manager.emit_to_user(created_uid, "notification:created", {"title": "Hi 2"})
        ids = [m["event_id"] for m in sockets[-1].sent_json]
        assert len(ids) == 2 and ids[0] != ids[1]
        for s in sockets:
            ws_manager.disconnect(created_uid, s)

        # 7. Server global connection limit (MAX_TOTAL_CONNECTIONS) rejects excess with 4503
        original_conns = ws_manager._connections
        try:
            ws_manager._connections = {
                f"dummy-{i}": [FakeWebSocket([])] for i in range(MAX_TOTAL_CONNECTIONS)
            }
            overflow_ws = FakeWebSocket([])
            with pytest.raises(RuntimeError):
                await ws_manager.register(created_uid, overflow_ws)
            assert overflow_ws.closed_code == 4503
        finally:
            ws_manager._connections = original_conns
    finally:
        if created_uid:
            async with AsyncSessionLocal() as db:
                await db.execute(delete(User).where(User.id == created_uid))
                await db.commit()
        await engine.dispose()
