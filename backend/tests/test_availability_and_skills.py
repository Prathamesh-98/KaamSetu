import pytest
from httpx import AsyncClient, ASGITransport
from uuid import uuid4
from datetime import datetime, timedelta, timezone
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
async def test_worker_availability_lifecycle():
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    worker_token = create_access_token({"sub": worker_user_id})
    headers = {"Authorization": f"Bearer {worker_token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        base_date = datetime.now(timezone.utc) + timedelta(days=90)
        start_time = base_date.replace(hour=10, minute=0, second=0, microsecond=0)
        end_time = base_date.replace(hour=14, minute=0, second=0, microsecond=0)

        # 1. Add availability slot
        create_res = await ac.post("/api/availability", json={
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "notes": "Testing slot"
        }, headers=headers)
        assert create_res.status_code == 200, create_res.text
        slot = create_res.json()
        slot_id = slot["id"]
        assert slot["status"] == "AVAILABLE"

        # 2. Immediately fetch my availability and ensure it appears immediately
        get_res = await ac.get("/api/availability/me", headers=headers)
        assert get_res.status_code == 200
        slots = get_res.json()
        assert any(s["id"] == slot_id for s in slots)

        # 3. Immediately delete slot
        del_res = await ac.delete(f"/api/availability/{slot_id}", headers=headers)
        assert del_res.status_code == 204

        # 4. Immediately fetch again and ensure it is gone
        get_res_after = await ac.get("/api/availability/me", headers=headers)
        assert get_res_after.status_code == 200
        slots_after = get_res_after.json()
        assert not any(s["id"] == slot_id for s in slots_after)

@pytest.mark.anyio
async def test_worker_skills_lifecycle():
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    worker_token = create_access_token({"sub": worker_user_id})
    headers = {"Authorization": f"Bearer {worker_token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Get list of skills to find a valid skill id
        skills_res = await ac.get("/api/skills", headers=headers)
        assert skills_res.status_code == 200
        available_skills = skills_res.json()
        assert len(available_skills) > 0

        # Get current worker profile
        profile_res = await ac.get("/api/workers/profile", headers=headers)
        assert profile_res.status_code == 200
        current_skills = profile_res.json().get("skills", [])
        current_skill_ids = {ws["skill"]["id"] for ws in current_skills}

        # Choose a skill not already in the profile
        target_skill = next((s for s in available_skills if s["id"] not in current_skill_ids), None)
        assert target_skill is not None, "Need at least one skill not yet added"
        target_skill_id = target_skill["id"]

        # 1. Add skill
        add_res = await ac.post("/api/workers/skills", json={
            "skill_id": target_skill_id,
            "proficiency_level": "INTERMEDIATE",
            "years_experience": 2
        }, headers=headers)
        assert add_res.status_code == 201, add_res.text
        added = add_res.json()
        assert added["skill"]["id"] == target_skill_id

        # 2. Immediately fetch profile and verify skill exists
        prof_after_add = await ac.get("/api/workers/profile", headers=headers)
        assert prof_after_add.status_code == 200
        skills_after_add = prof_after_add.json().get("skills", [])
        assert any(ws["skill"]["id"] == target_skill_id for ws in skills_after_add)

        # 3. Duplicate addition must fail with 400
        dup_res = await ac.post("/api/workers/skills", json={
            "skill_id": target_skill_id,
            "proficiency_level": "INTERMEDIATE",
            "years_experience": 2
        }, headers=headers)
        assert dup_res.status_code == 400
        assert "already added" in dup_res.json().get("detail", "").lower()

        # 4. Remove skill
        del_skill_res = await ac.delete(f"/api/workers/skills/{target_skill_id}", headers=headers)
        assert del_skill_res.status_code == 204

        # 5. Immediately fetch profile and verify skill was removed
        prof_after_del = await ac.get("/api/workers/profile", headers=headers)
        assert prof_after_del.status_code == 200
        skills_after_del = prof_after_del.json().get("skills", [])
        assert not any(ws["skill"]["id"] == target_skill_id for ws in skills_after_del)
