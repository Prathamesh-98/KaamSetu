import pytest
from httpx import AsyncClient, ASGITransport
from uuid import uuid4
from app.main import app
from app.core.security import create_access_token
from app.db.session import engine

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
async def cleanup_engine():
    yield
    await engine.dispose()

@pytest.mark.anyio
async def test_saved_workers_unauthorized():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # No auth
        assert (await ac.get("/api/employers/saved-workers")).status_code == 403
        assert (await ac.get("/api/employers/saved-workers/ids")).status_code == 403
        assert (await ac.post(f"/api/employers/saved-workers/{uuid4()}")).status_code == 403
        assert (await ac.delete(f"/api/employers/saved-workers/{uuid4()}")).status_code == 403

        # Worker role attempting employer endpoint
        worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
        w_token = create_access_token({"sub": worker_user_id})
        w_headers = {"Authorization": f"Bearer {w_token}"}
        assert (await ac.get("/api/employers/saved-workers", headers=w_headers)).status_code == 403

@pytest.mark.anyio
async def test_saved_workers_lifecycle_and_isolation():
    # Employer 1
    emp1_user_id = "da87f7a4-6cbf-419c-af92-5c1754ec6662"
    emp1_token = create_access_token({"sub": emp1_user_id})
    emp1_headers = {"Authorization": f"Bearer {emp1_token}"}

    # Worker
    worker_id = "fb9eb69f-0a5d-4672-bf22-1bdb3a3c97b5"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Non-existent worker ID check
        fake_id = str(uuid4())
        not_found = await ac.post(f"/api/employers/saved-workers/{fake_id}", headers=emp1_headers)
        assert not_found.status_code == 404

        # Clean up any existing saved record if present
        await ac.delete(f"/api/employers/saved-workers/{worker_id}", headers=emp1_headers)

        # 1. Employer 1 saves worker
        save_res = await ac.post(
            f"/api/employers/saved-workers/{worker_id}",
            json={"notes": "Top rated electrician for store maintenance"},
            headers=emp1_headers
        )
        assert save_res.status_code == 201, save_res.text
        saved_data = save_res.json()
        assert saved_data["worker_id"] == worker_id
        assert saved_data["notes"] == "Top rated electrician for store maintenance"
        assert saved_data["worker"]["id"] == worker_id

        # 2. Duplicate save attempt should fail with 400
        dup_res = await ac.post(f"/api/employers/saved-workers/{worker_id}", headers=emp1_headers)
        assert dup_res.status_code == 400
        assert "already saved" in dup_res.json().get("detail", "").lower()

        # 3. Check fast ID lookup
        ids_res = await ac.get("/api/employers/saved-workers/ids", headers=emp1_headers)
        assert ids_res.status_code == 200
        assert worker_id in ids_res.json()

        # 4. List saved workers for Employer 1
        list_res = await ac.get("/api/employers/saved-workers", headers=emp1_headers)
        assert list_res.status_code == 200
        items = list_res.json()
        assert any(item["worker_id"] == worker_id for item in items)

        # 5. Employer 2 (create or use another employer if exists, or check isolation)
        # Check that Employer 2 does NOT see Employer 1's saved worker
        emp2_user_id = str(uuid4())
        try:
            from app.models.models import User, EmployerProfile, UserRole
            from app.db.session import AsyncSessionLocal
            from app.core.security import hash_password

            async with AsyncSessionLocal() as session:
                user2 = User(
                    id=emp2_user_id,
                    email=f"emp2_{uuid4().hex[:6]}@example.com",
                    phone=f"98765{uuid4().hex[:5]}",
                    password_hash=hash_password("TestPass123!"),
                    role=UserRole.EMPLOYER,
                    is_active=True
                )
                session.add(user2)
                await session.flush()
                prof2 = EmployerProfile(
                    user_id=user2.id,
                    full_name="Second Employer Corp"
                )
                session.add(prof2)
                await session.commit()

            emp2_token = create_access_token({"sub": str(user2.id)})
            emp2_headers = {"Authorization": f"Bearer {emp2_token}"}

            emp2_list = await ac.get("/api/employers/saved-workers", headers=emp2_headers)
            assert emp2_list.status_code == 200
            assert not any(item["worker_id"] == worker_id for item in emp2_list.json())

            # Employer 2 cannot delete Employer 1's saved worker
            emp2_del = await ac.delete(f"/api/employers/saved-workers/{worker_id}", headers=emp2_headers)
            assert emp2_del.status_code == 404
        finally:
            if emp2_user_id:
                from sqlalchemy import delete
                from app.models.models import User, EmployerProfile
                from app.db.session import AsyncSessionLocal
                async with AsyncSessionLocal() as session:
                    await session.execute(delete(EmployerProfile).where(EmployerProfile.user_id == emp2_user_id))
                    await session.execute(delete(User).where(User.id == emp2_user_id))
                    await session.commit()

        # 6. Employer 1 removes the worker
        del_res = await ac.delete(f"/api/employers/saved-workers/{worker_id}", headers=emp1_headers)
        assert del_res.status_code == 204

        # 7. Verify worker is removed immediately
        list_after = await ac.get("/api/employers/saved-workers", headers=emp1_headers)
        assert list_after.status_code == 200
        assert not any(item["worker_id"] == worker_id for item in list_after.json())

        ids_after = await ac.get("/api/employers/saved-workers/ids", headers=emp1_headers)
        assert ids_after.status_code == 200
        assert worker_id not in ids_after.json()
