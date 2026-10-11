import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from uuid import uuid4
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, func, delete
from app.main import app
from app.core.security import create_access_token
from app.db.session import engine, AsyncSessionLocal
from app.models.models import (
    ShiftBooking, BookingStatus, EmployerProfile, WorkerProfile
)

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
async def cleanup_engine():
    yield
    await engine.dispose()

@pytest.mark.anyio
async def test_concurrent_shift_acceptance_overlap_prevention():
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    w_token = create_access_token({"sub": worker_user_id})
    w_headers = {"Authorization": f"Bearer {w_token}"}

    emp_user_id = "da87f7a4-6cbf-419c-af92-5c1754ec6662"

    now = datetime.now(timezone.utc)
    # Define overlapping time ranges: Shift 1 (day+60 10:00-14:00), Shift 2 (day+60 12:00-16:00)
    base_date = now + timedelta(days=60)
    start1 = base_date.replace(hour=10, minute=0, second=0, microsecond=0)
    end1 = base_date.replace(hour=14, minute=0, second=0, microsecond=0)

    start2 = base_date.replace(hour=12, minute=0, second=0, microsecond=0)
    end2 = base_date.replace(hour=16, minute=0, second=0, microsecond=0)

    async with AsyncSessionLocal() as db:
        w_res = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == worker_user_id))
        worker = w_res.scalar_one()

        e_res = await db.execute(select(EmployerProfile).where(EmployerProfile.user_id == emp_user_id))
        employer = e_res.scalar_one()

        # Clean up any existing bookings in this test window from prior runs
        from sqlalchemy import delete
        await db.execute(
            delete(ShiftBooking).where(
                ShiftBooking.worker_id == worker.id,
                ShiftBooking.start_time >= start1 - timedelta(days=1),
                ShiftBooking.end_time <= end2 + timedelta(days=1)
            )
        )
        await db.commit()

        # Create two overlapping PENDING shift bookings
        booking1 = ShiftBooking(
            worker_id=worker.id,
            employer_id=employer.id,
            start_time=start1,
            end_time=end1,
            status=BookingStatus.PENDING
        )
        booking2 = ShiftBooking(
            worker_id=worker.id,
            employer_id=employer.id,
            start_time=start2,
            end_time=end2,
            status=BookingStatus.PENDING
        )
        db.add(booking1)
        db.add(booking2)
        await db.commit()
        await db.refresh(booking1)
        await db.refresh(booking2)

        b1_id = str(booking1.id)
        b2_id = str(booking2.id)
        worker_id = worker.id

    try:
        # Fire concurrent acceptance requests simultaneously
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            req1 = ac.post(f"/api/shift-bookings/{b1_id}/accept", headers=w_headers)
            req2 = ac.post(f"/api/shift-bookings/{b2_id}/accept", headers=w_headers)

            res1, res2 = await asyncio.gather(req1, req2)

            statuses = [res1.status_code, res2.status_code]
            assert 200 in statuses, f"Expected one 200, got {statuses}: {res1.text}, {res2.text}"
            assert 400 in statuses, f"Expected one 400 (overlap conflict), got {statuses}: {res1.text}, {res2.text}"

        # Verify database state: only 1 confirmed shift exists in this overlapping window
        async with AsyncSessionLocal() as db:
            conf_res = await db.execute(
                select(func.count(ShiftBooking.id))
                .where(
                    ShiftBooking.worker_id == worker_id,
                    ShiftBooking.id.in_([uuid4() if False else booking1.id, booking2.id]),
                    ShiftBooking.status == BookingStatus.CONFIRMED
                )
            )
            confirmed_count = conf_res.scalar_one()
            assert confirmed_count == 1, f"Expected at most 1 confirmed shift, found {confirmed_count}"
    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(
                delete(ShiftBooking).where(ShiftBooking.id.in_([booking1.id, booking2.id]))
            )
            await db.commit()
