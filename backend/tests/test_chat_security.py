import pytest
from httpx import AsyncClient, ASGITransport
from uuid import uuid4
from sqlalchemy import select
from app.main import app
from app.core.security import create_access_token
from app.db.session import engine, AsyncSessionLocal
from app.models.models import Conversation, Message, WorkerProfile, EmployerProfile, JobApplication

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
async def cleanup_engine():
    yield
    await engine.dispose()

@pytest.mark.anyio
async def test_chat_mark_read_unauthorized():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        fake_id = str(uuid4())
        # 1. No auth -> 403
        res = await ac.post(f"/api/chat/conversations/{fake_id}/read")
        assert res.status_code == 403

@pytest.mark.anyio
async def test_chat_mark_read_idor_and_ownership():
    # Employer 1
    emp1_user_id = "da87f7a4-6cbf-419c-af92-5c1754ec6662"
    emp1_token = create_access_token({"sub": emp1_user_id})
    emp1_headers = {"Authorization": f"Bearer {emp1_token}"}

    # Worker 1
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    w1_token = create_access_token({"sub": worker_user_id})
    w1_headers = {"Authorization": f"Bearer {w1_token}"}

    # Non-participant user (e.g. another user or admin)
    non_participant_token = create_access_token({"sub": str(uuid4())})
    non_participant_headers = {"Authorization": f"Bearer {non_participant_token}"}

    async with AsyncSessionLocal() as db:
        # Find or create a test conversation
        res = await db.execute(select(Conversation).limit(1))
        conv = res.scalar_one_or_none()
        
        if not conv:
            # Look up worker and employer profiles
            w_res = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == worker_user_id))
            w = w_res.scalar_one_or_none()
            e_res = await db.execute(select(EmployerProfile).where(EmployerProfile.user_id == emp1_user_id))
            e = e_res.scalar_one_or_none()
            
            # Look up an existing job application
            app_res = await db.execute(select(JobApplication).limit(1))
            app_record = app_res.scalar_one_or_none()
            
            if w and e and app_record:
                conv = Conversation(
                    application_id=app_record.id,
                    worker_id=w.id,
                    employer_id=e.id
                )
                db.add(conv)
                await db.commit()
                await db.refresh(conv)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        fake_id = str(uuid4())
        # 2. Nonexistent conversation -> 404
        res = await ac.post(f"/api/chat/conversations/{fake_id}/read", headers=emp1_headers)
        assert res.status_code == 404
        assert "not found" in res.json().get("detail", "").lower()

        if conv:
            conv_id = str(conv.id)

            # 3. Non-participant attempts to mark read -> 403 Forbidden (IDOR prevented!)
            res = await ac.post(f"/api/chat/conversations/{conv_id}/read", headers=non_participant_headers)
            assert res.status_code in (401, 403)

            # 4. Valid participant (Worker) -> 200 OK
            # If the user is the worker participant
            async with AsyncSessionLocal() as db:
                c_worker = await db.execute(select(WorkerProfile).where(WorkerProfile.id == conv.worker_id))
                cw = c_worker.scalar_one_or_none()
                if cw:
                    part_worker_token = create_access_token({"sub": str(cw.user_id)})
                    part_w_headers = {"Authorization": f"Bearer {part_worker_token}"}
                    res_w = await ac.post(f"/api/chat/conversations/{conv_id}/read", headers=part_w_headers)
                    assert res_w.status_code == 200, res_w.text
                    assert res_w.json() == {"success": True}

            # 5. Valid participant (Employer) -> 200 OK
            async with AsyncSessionLocal() as db:
                c_emp = await db.execute(select(EmployerProfile).where(EmployerProfile.id == conv.employer_id))
                ce = c_emp.scalar_one_or_none()
                if ce:
                    part_emp_token = create_access_token({"sub": str(ce.user_id)})
                    part_e_headers = {"Authorization": f"Bearer {part_emp_token}"}
                    res_e = await ac.post(f"/api/chat/conversations/{conv_id}/read", headers=part_e_headers)
                    assert res_e.status_code == 200, res_e.text
                    assert res_e.json() == {"success": True}

@pytest.mark.anyio
async def test_get_conversations_batched_query():
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    w1_token = create_access_token({"sub": worker_user_id})
    w1_headers = {"Authorization": f"Bearer {w1_token}"}

    emp1_user_id = "da87f7a4-6cbf-419c-af92-5c1754ec6662"
    emp1_token = create_access_token({"sub": emp1_user_id})
    emp1_headers = {"Authorization": f"Bearer {emp1_token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Fetch conversations as worker
        res_w = await ac.get("/api/chat/conversations", headers=w1_headers)
        assert res_w.status_code == 200
        data_w = res_w.json()
        assert isinstance(data_w, list)
        for c in data_w:
            assert "id" in c
            assert "application_id" in c
            assert "worker" in c
            assert "employer" in c
            assert "unread_count" in c
            assert isinstance(c["unread_count"], int)

        # 2. Fetch conversations as employer
        res_e = await ac.get("/api/chat/conversations", headers=emp1_headers)
        assert res_e.status_code == 200
        data_e = res_e.json()
        assert isinstance(data_e, list)
        for c in data_e:
            assert "id" in c
            assert "unread_count" in c
