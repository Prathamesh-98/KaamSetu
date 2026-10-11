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
async def test_unauthorized_endpoints():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        assert (await ac.get("/api/shift-bookings/me")).status_code == 403
        assert (await ac.get("/api/availability/me")).status_code == 403
        assert (await ac.post("/api/shift-bookings", json={})).status_code == 403

@pytest.mark.anyio
async def test_shift_booking_invalid_inputs():
    emp_token = create_access_token({"sub": "da87f7a4-6cbf-419c-af92-5c1754ec6662"})
    headers = {"Authorization": f"Bearer {emp_token}"}
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Missing fields
        res = await ac.post("/api/shift-bookings", json={}, headers=headers)
        assert res.status_code == 422
        
        # Start time after end time
        now = datetime.now(timezone.utc)
        res = await ac.post("/api/shift-bookings", json={
            "worker_id": "fb9eb69f-0a5d-4672-bf22-1bdb3a3c97b5",
            "start_time": (now + timedelta(days=2)).isoformat(),
            "end_time": (now + timedelta(days=1)).isoformat()
        }, headers=headers)
        assert res.status_code in (400, 422)

@pytest.mark.anyio
async def test_shift_booking_nonexistent_worker():
    emp_token = create_access_token({"sub": "da87f7a4-6cbf-419c-af92-5c1754ec6662"})
    headers = {"Authorization": f"Bearer {emp_token}"}
    now = datetime.now(timezone.utc)
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/shift-bookings", json={
            "worker_id": str(uuid4()),
            "start_time": (now + timedelta(days=1)).isoformat(),
            "end_time": (now + timedelta(days=2)).isoformat()
        }, headers=headers)
        assert res.status_code == 404
        assert "Worker not found" in res.json().get("detail", "")

@pytest.mark.anyio
async def test_shift_booking_unauthorized_job():
    emp_token = create_access_token({"sub": "da87f7a4-6cbf-419c-af92-5c1754ec6662"})
    headers = {"Authorization": f"Bearer {emp_token}"}
    now = datetime.now(timezone.utc)
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/shift-bookings", json={
            "worker_id": "fb9eb69f-0a5d-4672-bf22-1bdb3a3c97b5",
            "job_id": "a1db6dbd-b329-4d16-849c-c675c56421e6",
            "start_time": (now + timedelta(days=10)).isoformat(),
            "end_time": (now + timedelta(days=11)).isoformat()
        }, headers=headers)
        assert res.status_code == 403
        assert "not authorized" in res.json().get("detail", "").lower()

@pytest.mark.anyio
async def test_shift_booking_flow_with_worker_availability():
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    worker_id = "fb9eb69f-0a5d-4672-bf22-1bdb3a3c97b5"
    employer_user_id = "da87f7a4-6cbf-419c-af92-5c1754ec6662"
    job_id = "5caa5f5b-1b3d-49be-9d47-5fb1b75c0d33"

    worker_token = create_access_token({"sub": worker_user_id})
    w_headers = {"Authorization": f"Bearer {worker_token}"}
    emp_token = create_access_token({"sub": employer_user_id})
    e_headers = {"Authorization": f"Bearer {emp_token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Worker creates availability slot with random future offset to guarantee test isolation
        import random
        base_date = datetime.now(timezone.utc) + timedelta(days=random.randint(150, 5000))
        slot_start = base_date.replace(hour=8, minute=0, second=0, microsecond=0)
        slot_end = base_date.replace(hour=18, minute=0, second=0, microsecond=0)

        avail_id = None
        try:
            avail_res = await ac.post("/api/availability", json={
                "start_time": slot_start.isoformat(),
                "end_time": slot_end.isoformat(),
                "notes": "Available for morning shifts"
            }, headers=w_headers)
            assert avail_res.status_code == 200, avail_res.text
            avail_id = avail_res.json()["id"]

            # 2. Employer checks public worker availability endpoint
            get_avail_res = await ac.get(f"/api/workers/{worker_id}/availability", headers=e_headers)
            assert get_avail_res.status_code == 200
            avail_list = get_avail_res.json()
            assert any(a["id"] == avail_id for a in avail_list)

            # 3. Employer requests shift OUTSIDE availability slot: 19:00 - 21:00
            out_start = base_date.replace(hour=19, minute=0, second=0, microsecond=0)
            out_end = base_date.replace(hour=21, minute=0, second=0, microsecond=0)
            bad_req_res = await ac.post("/api/shift-bookings", json={
                "worker_id": worker_id,
                "job_id": job_id,
                "start_time": out_start.isoformat(),
                "end_time": out_end.isoformat()
            }, headers=e_headers)
            assert bad_req_res.status_code == 400
            assert "outside worker's saved availability" in bad_req_res.json()["detail"].lower()

            # 4. Employer requests shift WITHIN availability slot: 09:00 - 15:00
            valid_start = base_date.replace(hour=9, minute=0, second=0, microsecond=0)
            valid_end = base_date.replace(hour=15, minute=0, second=0, microsecond=0)
            book_res = await ac.post("/api/shift-bookings", json={
                "worker_id": worker_id,
                "job_id": job_id,
                "start_time": valid_start.isoformat(),
                "end_time": valid_end.isoformat(),
                "notes": "Important store shift"
            }, headers=e_headers)
            assert book_res.status_code == 200, book_res.text
            booking = book_res.json()
            assert booking["status"] == "PENDING"
            assert booking["worker_id"] == worker_id
            assert booking["job_id"] == job_id
            booking_id = booking["id"]

            # 5. Verify booking appears in Employer shift bookings
            emp_bookings_res = await ac.get("/api/shift-bookings/me", headers=e_headers)
            assert emp_bookings_res.status_code == 200
            assert any(b["id"] == booking_id for b in emp_bookings_res.json())

            # 6. Verify booking appears in Worker shift bookings
            worker_bookings_res = await ac.get("/api/shift-bookings/me", headers=w_headers)
            assert worker_bookings_res.status_code == 200
            assert any(b["id"] == booking_id for b in worker_bookings_res.json())

            # 7. Worker accepts the shift
            accept_res = await ac.post(f"/api/shift-bookings/{booking_id}/accept", headers=w_headers)
            assert accept_res.status_code == 200
            assert accept_res.json()["status"] == "CONFIRMED"

            # 8. Another employer attempts to book an overlapping shift during the confirmed time
            conflict_res = await ac.post("/api/shift-bookings", json={
                "worker_id": worker_id,
                "job_id": job_id,
                "start_time": valid_start.isoformat(),
                "end_time": valid_end.isoformat()
            }, headers=e_headers)
            assert conflict_res.status_code == 409
            assert "already has a confirmed" in conflict_res.json()["detail"].lower()

            # 9. Cancel booking
            cancel_res = await ac.post(f"/api/shift-bookings/{booking_id}/cancel", headers=e_headers)
            assert cancel_res.status_code == 200
            assert cancel_res.json()["status"] == "CANCELLED"
        finally:
            # Cleanup availability
            if avail_id:
                await ac.delete(f"/api/availability/{avail_id}", headers=w_headers)
