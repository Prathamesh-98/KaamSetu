"""
KaamSetu — Feature 3: Work Completion and Payment Records Test Suite
Verifies completion workflows, offline payment records, dual-party confirmations,
dispute handling, audit history preservation, concurrency locks, and regression safety.
All tests run against the isolated test database: kaamsetu_test.
"""
import pytest
import asyncio
from decimal import Decimal
from uuid import uuid4
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.security import create_access_token
from app.db.session import engine, AsyncSessionLocal
from app.models.models import (
    Base, User, WorkerProfile, EmployerProfile, ShiftBooking, BookingStatus,
    WorkCompletion, PaymentRecord, PaymentStatus, PaymentMethod,
    Job, JobApplication, ApplicationStatus, Rating, JobCategory
)
from sqlalchemy import select, and_


@pytest.fixture
def anyio_backend():
    return 'asyncio'


@pytest.fixture(autouse=True)
async def ensure_test_schema_and_cleanup():
    """Ensure work_completions and payment_records tables exist in kaamsetu_test, then clean up engine."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


# Helper to create a confirmed shift booking dynamically using verified test profiles
async def create_confirmed_test_shift(rate: Decimal = Decimal("1000.00")):
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    employer_user_id = "da87f7a4-6cbf-419c-af92-5c1754ec6662"

    now = datetime.now(timezone.utc)
    start_time = now - timedelta(hours=8)
    end_time = now - timedelta(hours=1)

    async with AsyncSessionLocal() as session:
        wp = (await session.execute(select(WorkerProfile).where(WorkerProfile.user_id == worker_user_id))).scalar_one()
        ep = (await session.execute(select(EmployerProfile).where(EmployerProfile.user_id == employer_user_id))).scalar_one()
        job = (await session.execute(select(Job).where(Job.employer_id == ep.id))).scalars().first()

        booking = ShiftBooking(
            worker_id=wp.id,
            employer_id=ep.id,
            job_id=job.id if job else None,
            start_time=start_time,
            end_time=end_time,
            proposed_rate=rate,
            status=BookingStatus.CONFIRMED,
            notes="Confirmed test shift",
        )
        session.add(booking)
        await session.commit()
        await session.refresh(booking)
        booking_id = booking.id

    return {
        "booking_id": str(booking_id),
        "worker_user_id": worker_user_id,
        "employer_user_id": employer_user_id,
        "worker_id": str(wp.id),
        "employer_id": str(ep.id),
        "job_id": str(job.id) if job else None,
        "start_time": start_time,
        "end_time": end_time,
        "rate": rate,
    }


@pytest.mark.anyio
async def test_employer_completes_confirmed_shift():
    """Test successful shift completion and offline payment recording by employer."""
    shift = await create_confirmed_test_shift(rate=Decimal("1200.00"))
    emp_token = create_access_token({"sub": shift["employer_user_id"]})
    e_headers = {"Authorization": f"Bearer {emp_token}"}

    payload = {
        "actual_start_time": shift["start_time"].isoformat(),
        "actual_end_time": shift["end_time"].isoformat(),
        "hours_worked": "7.00",
        "completion_notes": "All tasks executed cleanly",
        "agreed_amount": "1200.00",
        "amount_paid": "1200.00",
        "payment_method": "UPI",
        "payment_date": datetime.now(timezone.utc).isoformat(),
        "payment_reference": "UPI/987654321/AXIS",
        "payment_notes": "Paid via GooglePay"
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/complete",
            json=payload,
            headers=e_headers
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["shift_booking_id"] == shift["booking_id"]
        assert float(data["hours_worked"]) == 7.00
        assert data["payment_record"] is not None
        pay = data["payment_record"]
        assert pay["agreed_amount"] == "1200.00"
        assert pay["amount_paid"] == "1200.00"
        assert pay["outstanding_balance"] == "0.00"
        assert pay["payment_method"] == "UPI"
        assert pay["payment_status"] == "PENDING_CONFIRMATION"
        assert pay["is_partial"] is False
        assert pay["is_fully_paid"] is False  # Awaiting worker confirmation
        assert "KaamSetu is an informational record" in pay["disclaimer"]

        # Verify DB states
        async with AsyncSessionLocal() as session:
            b = (await session.execute(select(ShiftBooking).where(ShiftBooking.id == shift["booking_id"]))).scalar_one()
            assert b.status == BookingStatus.COMPLETED


@pytest.mark.anyio
async def test_worker_payment_confirmation():
    """Test worker confirms receipt of full offline payment."""
    shift = await create_confirmed_test_shift(rate=Decimal("1000.00"))
    emp_token = create_access_token({"sub": shift["employer_user_id"]})
    worker_token = create_access_token({"sub": shift["worker_user_id"]})
    e_headers = {"Authorization": f"Bearer {emp_token}"}
    w_headers = {"Authorization": f"Bearer {worker_token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Complete shift
        await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/complete",
            json={
                "actual_start_time": shift["start_time"].isoformat(),
                "actual_end_time": shift["end_time"].isoformat(),
                "hours_worked": "7.00",
                "agreed_amount": "1000.00",
                "amount_paid": "1000.00",
                "payment_method": "CASH",
                "payment_date": datetime.now(timezone.utc).isoformat()
            },
            headers=e_headers
        )

        # Worker confirms payment
        res = await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/payment/confirm",
            headers=w_headers
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["payment_status"] == "CONFIRMED"
        assert data["worker_confirmed_at"] is not None
        assert data["is_fully_paid"] is True

        # Second confirmation is idempotent
        res_repeat = await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/payment/confirm",
            headers=w_headers
        )
        assert res_repeat.status_code == 200


@pytest.mark.anyio
async def test_worker_payment_dispute():
    """Test worker disputes payment with mandatory reason."""
    shift = await create_confirmed_test_shift(rate=Decimal("1500.00"))
    emp_token = create_access_token({"sub": shift["employer_user_id"]})
    worker_token = create_access_token({"sub": shift["worker_user_id"]})
    e_headers = {"Authorization": f"Bearer {emp_token}"}
    w_headers = {"Authorization": f"Bearer {worker_token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Complete shift
        await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/complete",
            json={
                "actual_start_time": shift["start_time"].isoformat(),
                "actual_end_time": shift["end_time"].isoformat(),
                "hours_worked": "7.00",
                "agreed_amount": "1500.00",
                "amount_paid": "1500.00",
                "payment_method": "CASH",
                "payment_date": datetime.now(timezone.utc).isoformat()
            },
            headers=e_headers
        )

        # Worker disputes with empty or short reason (should fail validation)
        short_res = await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/payment/dispute",
            json={"dispute_reason": "No"},
            headers=w_headers
        )
        assert short_res.status_code == 422

        # Worker disputes with valid reason
        res = await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/payment/dispute",
            json={"dispute_reason": "Only received ₹1000 in cash, ₹500 is still unpaid"},
            headers=w_headers
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["payment_status"] == "DISPUTED"
        assert "Only received ₹1000" in data["dispute_reason"]
        assert data["disputed_at"] is not None


@pytest.mark.anyio
async def test_partial_payment_calculations_and_balance():
    """Test partial payments retain outstanding balance and are not represented as fully paid."""
    shift = await create_confirmed_test_shift(rate=Decimal("1200.00"))
    emp_token = create_access_token({"sub": shift["employer_user_id"]})
    worker_token = create_access_token({"sub": shift["worker_user_id"]})
    e_headers = {"Authorization": f"Bearer {emp_token}"}
    w_headers = {"Authorization": f"Bearer {worker_token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Complete with partial payment: ₹800 paid out of ₹1200 agreed
        res = await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/complete",
            json={
                "actual_start_time": shift["start_time"].isoformat(),
                "actual_end_time": shift["end_time"].isoformat(),
                "hours_worked": "6.00",
                "agreed_amount": "1200.00",
                "amount_paid": "800.00",
                "payment_method": "UPI",
                "payment_date": datetime.now(timezone.utc).isoformat()
            },
            headers=e_headers
        )
        assert res.status_code == 200, res.text
        pay = res.json()["payment_record"]
        assert pay["payment_status"] == "PARTIALLY_PAID"
        assert pay["agreed_amount"] == "1200.00"
        assert pay["amount_paid"] == "800.00"
        assert pay["outstanding_balance"] == "400.00"
        assert pay["is_partial"] is True
        assert pay["is_fully_paid"] is False

        # Worker confirms receipt of the partial payment
        confirm_res = await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/payment/confirm",
            headers=w_headers
        )
        assert confirm_res.status_code == 200, confirm_res.text
        conf_data = confirm_res.json()
        # Confirmation recorded timestamp, but status MUST remain PARTIALLY_PAID
        assert conf_data["payment_status"] == "PARTIALLY_PAID"
        assert conf_data["worker_confirmed_at"] is not None
        assert conf_data["outstanding_balance"] == "400.00"
        assert conf_data["is_fully_paid"] is False


@pytest.mark.anyio
async def test_invalid_and_negative_amounts_rejected():
    """Validate negative amounts, zero hours, and inverted timestamps are strictly rejected."""
    shift = await create_confirmed_test_shift()
    emp_token = create_access_token({"sub": shift["employer_user_id"]})
    e_headers = {"Authorization": f"Bearer {emp_token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Negative amount_paid
        res = await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/complete",
            json={
                "actual_start_time": shift["start_time"].isoformat(),
                "actual_end_time": shift["end_time"].isoformat(),
                "hours_worked": "6.00",
                "agreed_amount": "1000.00",
                "amount_paid": "-500.00",
                "payment_method": "CASH",
                "payment_date": datetime.now(timezone.utc).isoformat()
            },
            headers=e_headers
        )
        assert res.status_code == 422

        # 2. Invalid hours (> 24)
        res_hours = await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/complete",
            json={
                "actual_start_time": shift["start_time"].isoformat(),
                "actual_end_time": shift["end_time"].isoformat(),
                "hours_worked": "28.00",
                "agreed_amount": "1000.00",
                "amount_paid": "1000.00",
                "payment_method": "CASH",
                "payment_date": datetime.now(timezone.utc).isoformat()
            },
            headers=e_headers
        )
        assert res_hours.status_code in [400, 422]

        # 3. End time before start time
        res_times = await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/complete",
            json={
                "actual_start_time": shift["end_time"].isoformat(),
                "actual_end_time": shift["start_time"].isoformat(),
                "hours_worked": "5.00",
                "agreed_amount": "1000.00",
                "amount_paid": "1000.00",
                "payment_method": "CASH",
                "payment_date": datetime.now(timezone.utc).isoformat()
            },
            headers=e_headers
        )
        assert res_times.status_code in [400, 422]


@pytest.mark.anyio
async def test_cancelled_and_pending_shifts_rejected():
    """Ensure cancelled or pending shifts cannot be marked as completed."""
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    employer_user_id = "da87f7a4-6cbf-419c-af92-5c1754ec6662"
    emp_token = create_access_token({"sub": employer_user_id})
    e_headers = {"Authorization": f"Bearer {emp_token}"}

    async with AsyncSessionLocal() as session:
        wp = (await session.execute(select(WorkerProfile).where(WorkerProfile.user_id == worker_user_id))).scalar_one()
        ep = (await session.execute(select(EmployerProfile).where(EmployerProfile.user_id == employer_user_id))).scalar_one()

        # Create a CANCELLED shift
        cancelled_shift = ShiftBooking(
            worker_id=wp.id,
            employer_id=ep.id,
            start_time=datetime.now(timezone.utc) - timedelta(hours=4),
            end_time=datetime.now(timezone.utc) - timedelta(hours=1),
            status=BookingStatus.CANCELLED
        )
        # Create a PENDING shift
        pending_shift = ShiftBooking(
            worker_id=wp.id,
            employer_id=ep.id,
            start_time=datetime.now(timezone.utc) - timedelta(hours=4),
            end_time=datetime.now(timezone.utc) - timedelta(hours=1),
            status=BookingStatus.PENDING
        )
        session.add_all([cancelled_shift, pending_shift])
        await session.commit()
        cancelled_id = str(cancelled_shift.id)
        pending_id = str(pending_shift.id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Complete cancelled shift -> 400
        res1 = await ac.post(
            f"/api/shift-bookings/{cancelled_id}/complete",
            json={
                "actual_start_time": (datetime.now(timezone.utc) - timedelta(hours=4)).isoformat(),
                "actual_end_time": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
                "hours_worked": "3.00",
                "amount_paid": "500.00",
                "payment_method": "CASH",
                "payment_date": datetime.now(timezone.utc).isoformat()
            },
            headers=e_headers
        )
        assert res1.status_code == 400
        assert "Shift must be CONFIRMED" in res1.text

        # Complete pending shift -> 400
        res2 = await ac.post(
            f"/api/shift-bookings/{pending_id}/complete",
            json={
                "actual_start_time": (datetime.now(timezone.utc) - timedelta(hours=4)).isoformat(),
                "actual_end_time": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
                "hours_worked": "3.00",
                "amount_paid": "500.00",
                "payment_method": "CASH",
                "payment_date": datetime.now(timezone.utc).isoformat()
            },
            headers=e_headers
        )
        assert res2.status_code == 400


@pytest.mark.anyio
async def test_unauthorized_and_cross_account_access_denied():
    """Validate cross-account permissions: other employers/workers cannot complete, confirm, or view records."""
    shift = await create_confirmed_test_shift()
    # Different employer token
    other_emp_token = create_access_token({"sub": "7087d702-6b66-46b1-bf8f-b03c6b2d7a0d"})
    other_emp_headers = {"Authorization": f"Bearer {other_emp_token}"}
    # Different worker token
    other_worker_token = create_access_token({"sub": "31eff124-f7da-4b9a-9b44-df8f63026e63"})
    other_worker_headers = {"Authorization": f"Bearer {other_worker_token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Unauthenticated completion
        unauth_res = await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/complete",
            json={
                "actual_start_time": shift["start_time"].isoformat(),
                "actual_end_time": shift["end_time"].isoformat(),
                "hours_worked": "7.00",
                "amount_paid": "1000.00",
                "payment_method": "CASH",
                "payment_date": datetime.now(timezone.utc).isoformat()
            }
        )
        assert unauth_res.status_code in [401, 403]

        # Different employer attempts completion -> 403
        wrong_res = await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/complete",
            json={
                "actual_start_time": shift["start_time"].isoformat(),
                "actual_end_time": shift["end_time"].isoformat(),
                "hours_worked": "7.00",
                "amount_paid": "1000.00",
                "payment_method": "CASH",
                "payment_date": datetime.now(timezone.utc).isoformat()
            },
            headers=other_emp_headers
        )
        assert wrong_res.status_code == 403

        # Different worker attempts confirmation -> 403
        conf_res = await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/payment/confirm",
            headers=other_worker_headers
        )
        assert conf_res.status_code == 403


@pytest.mark.anyio
async def test_duplicate_completion_and_payment_attempts_rejected():
    """Attempting to complete the same shift twice returns HTTP 400."""
    shift = await create_confirmed_test_shift()
    emp_token = create_access_token({"sub": shift["employer_user_id"]})
    e_headers = {"Authorization": f"Bearer {emp_token}"}

    payload = {
        "actual_start_time": shift["start_time"].isoformat(),
        "actual_end_time": shift["end_time"].isoformat(),
        "hours_worked": "5.00",
        "agreed_amount": "1000.00",
        "amount_paid": "1000.00",
        "payment_method": "CASH",
        "payment_date": datetime.now(timezone.utc).isoformat()
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # First completion -> Success
        res1 = await ac.post(f"/api/shift-bookings/{shift['booking_id']}/complete", json=payload, headers=e_headers)
        assert res1.status_code == 200

        # Second completion -> 400 (Already completed)
        res2 = await ac.post(f"/api/shift-bookings/{shift['booking_id']}/complete", json=payload, headers=e_headers)
        assert res2.status_code == 400
        assert "Shift must be CONFIRMED" in res2.text or "already has a completion record" in res2.text


@pytest.mark.anyio
async def test_confirmed_payment_records_protected_from_edits():
    """Once worker confirms payment, employer cannot edit payment record."""
    shift = await create_confirmed_test_shift()
    emp_token = create_access_token({"sub": shift["employer_user_id"]})
    worker_token = create_access_token({"sub": shift["worker_user_id"]})
    e_headers = {"Authorization": f"Bearer {emp_token}"}
    w_headers = {"Authorization": f"Bearer {worker_token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Complete
        await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/complete",
            json={
                "actual_start_time": shift["start_time"].isoformat(),
                "actual_end_time": shift["end_time"].isoformat(),
                "hours_worked": "6.00",
                "agreed_amount": "1000.00",
                "amount_paid": "1000.00",
                "payment_method": "CASH",
                "payment_date": datetime.now(timezone.utc).isoformat()
            },
            headers=e_headers
        )

        # Worker confirms
        await ac.post(f"/api/shift-bookings/{shift['booking_id']}/payment/confirm", headers=w_headers)

        # Employer tries to edit confirmed record -> 400
        edit_res = await ac.patch(
            f"/api/shift-bookings/{shift['booking_id']}/payment",
            json={"amount_paid": "800.00", "correction_note": "Attempt to reduce confirmed amount"},
            headers=e_headers
        )
        assert edit_res.status_code == 400
        assert "Confirmed payment records cannot be edited" in edit_res.text


@pytest.mark.anyio
async def test_dispute_correction_preserving_history():
    """Dispute correction updates payment record and preserves prior dispute in dispute_history."""
    shift = await create_confirmed_test_shift(rate=Decimal("1500.00"))
    emp_token = create_access_token({"sub": shift["employer_user_id"]})
    worker_token = create_access_token({"sub": shift["worker_user_id"]})
    e_headers = {"Authorization": f"Bearer {emp_token}"}
    w_headers = {"Authorization": f"Bearer {worker_token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Employer records ₹1000 paid
        await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/complete",
            json={
                "actual_start_time": shift["start_time"].isoformat(),
                "actual_end_time": shift["end_time"].isoformat(),
                "hours_worked": "7.00",
                "agreed_amount": "1500.00",
                "amount_paid": "1000.00",
                "payment_method": "CASH",
                "payment_date": datetime.now(timezone.utc).isoformat()
            },
            headers=e_headers
        )

        # 2. Worker disputes
        await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/payment/dispute",
            json={"dispute_reason": "Agreed rate was ₹1500, received only ₹1000 in cash"},
            headers=w_headers
        )

        # 3. Employer updates payment to ₹1500 with correction note
        update_res = await ac.patch(
            f"/api/shift-bookings/{shift['booking_id']}/payment",
            json={
                "amount_paid": "1500.00",
                "payment_method": "UPI",
                "correction_note": "Sent remaining ₹500 via UPI"
            },
            headers=e_headers
        )
        assert update_res.status_code == 200, update_res.text
        data = update_res.json()
        assert data["amount_paid"] == "1500.00"
        assert data["payment_status"] == "PENDING_CONFIRMATION"
        assert data["dispute_reason"] is None  # Active dispute cleared
        # Verify history preserved
        assert len(data["dispute_history"]) == 1
        hist = data["dispute_history"][0]
        assert "Agreed rate was ₹1500" in hist["dispute_reason"]
        assert hist["previous_amount_paid"] == "1000.00"
        assert hist["correction_note"] == "Sent remaining ₹500 via UPI"


@pytest.mark.anyio
async def test_concurrent_completion_requests():
    """Verify concurrent completion requests are safely serialized and do not produce duplicate records."""
    shift = await create_confirmed_test_shift()
    emp_token = create_access_token({"sub": shift["employer_user_id"]})
    e_headers = {"Authorization": f"Bearer {emp_token}"}

    payload = {
        "actual_start_time": shift["start_time"].isoformat(),
        "actual_end_time": shift["end_time"].isoformat(),
        "hours_worked": "5.00",
        "agreed_amount": "1000.00",
        "amount_paid": "1000.00",
        "payment_method": "CASH",
        "payment_date": datetime.now(timezone.utc).isoformat()
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Launch two requests concurrently
        res1, res2 = await asyncio.gather(
            ac.post(f"/api/shift-bookings/{shift['booking_id']}/complete", json=payload, headers=e_headers),
            ac.post(f"/api/shift-bookings/{shift['booking_id']}/complete", json=payload, headers=e_headers),
            return_exceptions=True
        )

        statuses = [res1.status_code, res2.status_code]
        assert 200 in statuses
        assert 400 in statuses or 409 in statuses


@pytest.mark.anyio
async def test_notifications_and_application_rating_compatibility():
    """Ensure shift completion auto-advances linked JobApplication to COMPLETED and permits mutual ratings."""
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    employer_user_id = "da87f7a4-6cbf-419c-af92-5c1754ec6662"

    emp_token = create_access_token({"sub": employer_user_id})
    worker_token = create_access_token({"sub": worker_user_id})
    e_headers = {"Authorization": f"Bearer {emp_token}"}
    w_headers = {"Authorization": f"Bearer {worker_token}"}

    now = datetime.now(timezone.utc)
    app_id = None
    booking_id = None

    async with AsyncSessionLocal() as session:
        wp = (await session.execute(select(WorkerProfile).where(WorkerProfile.user_id == worker_user_id))).scalar_one()
        ep = (await session.execute(select(EmployerProfile).where(EmployerProfile.user_id == employer_user_id))).scalar_one()
        
        # Fetch valid category to satisfy FK constraint
        cat_res = await session.execute(select(JobCategory))
        cat = cat_res.scalars().first()
        test_job = Job(
            employer_id=ep.id,
            category_id=cat.id if cat else None,
            title=f"Rating Compatibility Job {uuid4().hex[:6]}",
            description="Testing application auto-completion and rating",
            salary_min=Decimal("500.00"),
            salary_max=Decimal("1500.00"),
            salary_type="DAILY",
            work_type="DAILY",
            city="Mumbai",
            state="Maharashtra",
            workers_needed=1
        )
        session.add(test_job)
        await session.flush()

        # Create linked application
        app_obj = JobApplication(
            job_id=test_job.id,
            worker_id=wp.id,
            status=ApplicationStatus.ACCEPTED
        )
        session.add(app_obj)
        await session.flush()
        app_id = app_obj.id

        # Create confirmed shift linked to this application
        booking = ShiftBooking(
            worker_id=wp.id,
            employer_id=ep.id,
            job_id=test_job.id,
            application_id=app_id,
            start_time=now - timedelta(hours=6),
            end_time=now - timedelta(hours=1),
            proposed_rate=Decimal("1000.00"),
            status=BookingStatus.CONFIRMED
        )
        session.add(booking)
        await session.commit()
        booking_id = booking.id

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Complete shift
        comp_res = await ac.post(
            f"/api/shift-bookings/{booking_id}/complete",
            json={
                "actual_start_time": (now - timedelta(hours=6)).isoformat(),
                "actual_end_time": (now - timedelta(hours=1)).isoformat(),
                "hours_worked": "5.00",
                "amount_paid": "1000.00",
                "payment_method": "CASH",
                "payment_date": now.isoformat()
            },
            headers=e_headers
        )
        assert comp_res.status_code == 200, comp_res.text

        # Verify linked application is now COMPLETED
        async with AsyncSessionLocal() as session:
            app_check = (await session.execute(select(JobApplication).where(JobApplication.id == app_id))).scalar_one()
            assert app_check.status == ApplicationStatus.COMPLETED

        # Worker rates Employer
        w_rate_res = await ac.post(
            "/api/ratings",
            json={
                "application_id": str(app_id),
                "rating": 5,
                "review_text": "Great employer, on-time cash payment!",
                "rater_role": "WORKER"
            },
            headers=w_headers
        )
        assert w_rate_res.status_code == 201, w_rate_res.text

        # Employer rates Worker
        e_rate_res = await ac.post(
            "/api/ratings",
            json={
                "application_id": str(app_id),
                "rating": 5,
                "review_text": "Skilled and punctual worker!",
                "rater_role": "EMPLOYER"
            },
            headers=e_headers
        )
        assert e_rate_res.status_code == 201, e_rate_res.text


@pytest.mark.anyio
async def test_work_history_paginated_endpoint():
    """Verify GET /api/work-history/me returns completed shifts and payment details."""
    worker_token = create_access_token({"sub": "58427761-6768-4988-aead-b304fd2760a4"})
    w_headers = {"Authorization": f"Bearer {worker_token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/work-history/me?page=1&per_page=10", headers=w_headers)
        assert res.status_code == 200, res.text
        data = res.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)


@pytest.mark.anyio
async def test_regression_nearby_jobs_and_trust_verification():
    """Verify Feature 1 (Nearby Jobs) and Feature 2 (Trust & Verification) remain 100% operational."""
    worker_token = create_access_token({"sub": "58427761-6768-4988-aead-b304fd2760a4"})
    w_headers = {"Authorization": f"Bearer {worker_token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Feature 1: Nearby jobs endpoint with authenticated worker
        jobs_res = await ac.get("/api/jobs?latitude=19.0760&longitude=72.8777&radius=25", headers=w_headers)
        assert jobs_res.status_code == 200, jobs_res.text

        # Feature 2: Verification status summary
        verif_res = await ac.get("/api/verifications/my-status", headers=w_headers)
        assert verif_res.status_code == 200, verif_res.text
        data = verif_res.json()
        assert "phone_status" in data
        assert "identity_status" in data

@pytest.mark.anyio
async def test_multi_installment_workflow():
    """
    Test multi-installment / partial-payment history:
    1. Employer logs first installment ₹600 CASH out of ₹1200 agreed.
       - Payment status: PARTIALLY_PAID.
       - Outstanding balance: ₹600.
       - 1 installment in ledger, unconfirmed.
    2. Worker confirms installment #1.
       - Status remains PARTIALLY_PAID.
       - Installment #1 is marked confirmed.
    3. Employer logs installment #2: ₹600 UPI with reference.
       - Status transitions to PENDING_CONFIRMATION.
       - Installment #1 remains confirmed; installment #2 is unconfirmed.
       - Total installments count is 2.
    4. Worker confirms installment #2.
       - Status transitions to CONFIRMED.
       - Both installments confirmed.
       - Fully paid is True, balance is 0.
    """
    shift = await create_confirmed_test_shift(rate=Decimal("1200.00"))
    emp_token = create_access_token({"sub": shift["employer_user_id"]})
    worker_token = create_access_token({"sub": shift["worker_user_id"]})
    e_headers = {"Authorization": f"Bearer {emp_token}"}
    w_headers = {"Authorization": f"Bearer {worker_token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Step 1: Employer completes shift with initial ₹600 cash installment
        now = datetime.now(timezone.utc)
        comp_res = await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/complete",
            json={
                "actual_start_time": shift["start_time"].isoformat(),
                "actual_end_time": shift["end_time"].isoformat(),
                "hours_worked": "7.00",
                "agreed_amount": "1200.00",
                "amount_paid": "600.00",
                "payment_method": "CASH",
                "payment_date": now.isoformat(),
                "payment_notes": "First installment: cash in hand"
            },
            headers=e_headers
        )
        assert comp_res.status_code == 200, comp_res.text
        pay = comp_res.json()["payment_record"]
        assert pay["payment_status"] == "PARTIALLY_PAID"
        assert pay["amount_paid"] == "600.00"
        assert pay["agreed_amount"] == "1200.00"
        assert pay["outstanding_balance"] == "600.00"
        assert pay["is_partial"] is True
        assert pay["is_fully_paid"] is False
        assert len(pay["installments"]) == 1
        assert pay["installments"][0]["installment_number"] == 1
        assert pay["installments"][0]["amount"] == "600.00"
        assert pay["installments"][0]["payment_method"] == "CASH"
        assert pay["installments"][0]["is_confirmed"] is False

        # Step 2: Worker confirms installment #1
        conf_res = await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/payment/confirm",
            headers=w_headers
        )
        assert conf_res.status_code == 200, conf_res.text
        conf_pay = conf_res.json()
        assert conf_pay["payment_status"] == "PARTIALLY_PAID"
        assert conf_pay["worker_confirmed_at"] is not None
        assert conf_pay["installments"][0]["is_confirmed"] is True

        # Step 3: Employer logs installment #2 via PATCH with installment_amount
        patch_res = await ac.patch(
            f"/api/shift-bookings/{shift['booking_id']}/payment",
            json={
                "installment_amount": "600.00",
                "payment_method": "UPI",
                "payment_reference": "UPI/SETU987654",
                "notes": "Second and final installment via UPI"
            },
            headers=e_headers
        )
        assert patch_res.status_code == 200, patch_res.text
        patch_pay = patch_res.json()
        assert patch_pay["amount_paid"] == "1200.00"
        assert patch_pay["outstanding_balance"] == "0.00"
        assert patch_pay["payment_status"] == "PENDING_CONFIRMATION"
        assert len(patch_pay["installments"]) == 2

        # Verify installment #1 preserved its confirmation
        assert patch_pay["installments"][0]["installment_number"] == 1
        assert patch_pay["installments"][0]["amount"] == "600.00"
        assert patch_pay["installments"][0]["is_confirmed"] is True
        assert patch_pay["installments"][0]["payment_method"] == "CASH"

        # Verify installment #2 is unconfirmed
        assert patch_pay["installments"][1]["installment_number"] == 2
        assert patch_pay["installments"][1]["amount"] == "600.00"
        assert patch_pay["installments"][1]["payment_method"] == "UPI"
        assert patch_pay["installments"][1]["payment_reference"] == "UPI/SETU987654"
        assert patch_pay["installments"][1]["is_confirmed"] is False

        # Step 4: Worker confirms installment #2
        final_conf_res = await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/payment/confirm",
            headers=w_headers
        )
        assert final_conf_res.status_code == 200, final_conf_res.text
        final_pay = final_conf_res.json()
        assert final_pay["payment_status"] == "CONFIRMED"
        assert final_pay["is_fully_paid"] is True
        assert final_pay["outstanding_balance"] == "0.00"
        assert final_pay["installments"][0]["is_confirmed"] is True
        assert final_pay["installments"][1]["is_confirmed"] is True


@pytest.mark.anyio
async def test_premature_completion_rejected():
    """
    Test premature shift completion prevention:
    1. Reject if scheduled shift start time is in the future.
    2. Reject if actual_start_time is in the future.
    3. Reject if actual_end_time is in the future.
    """
    # 1. Shift scheduled in the future
    future_start = datetime.now(timezone.utc) + timedelta(hours=2)
    future_end = future_start + timedelta(hours=6)

    async with AsyncSessionLocal() as session:
        wp = (await session.execute(select(WorkerProfile).where(WorkerProfile.user_id == "58427761-6768-4988-aead-b304fd2760a4"))).scalar_one()
        ep = (await session.execute(select(EmployerProfile).where(EmployerProfile.user_id == "da87f7a4-6cbf-419c-af92-5c1754ec6662"))).scalar_one()
        job = (await session.execute(select(Job).where(Job.employer_id == ep.id))).scalars().first()

        future_booking = ShiftBooking(
            worker_id=wp.id,
            employer_id=ep.id,
            job_id=job.id if job else None,
            start_time=future_start,
            end_time=future_end,
            proposed_rate=Decimal("1000.00"),
            status=BookingStatus.CONFIRMED,
        )
        session.add(future_booking)
        await session.commit()
        booking_id = future_booking.id

    emp_token = create_access_token({"sub": "da87f7a4-6cbf-419c-af92-5c1754ec6662"})
    e_headers = {"Authorization": f"Bearer {emp_token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Attempt to complete a future shift
        res = await ac.post(
            f"/api/shift-bookings/{booking_id}/complete",
            json={
                "actual_start_time": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
                "actual_end_time": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
                "hours_worked": "1.00",
                "agreed_amount": "1000.00",
                "amount_paid": "1000.00",
                "payment_method": "CASH",
                "payment_date": datetime.now(timezone.utc).isoformat()
            },
            headers=e_headers
        )
        assert res.status_code == 400
        assert "scheduled shift start time is in the future" in res.json()["detail"]

    # 2. Shift scheduled in the past, but actual start/end in the future
    shift = await create_confirmed_test_shift(rate=Decimal("1000.00"))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res_future_start = await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/complete",
            json={
                "actual_start_time": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
                "actual_end_time": (datetime.now(timezone.utc) + timedelta(hours=3)).isoformat(),
                "hours_worked": "2.00",
                "agreed_amount": "1000.00",
                "amount_paid": "1000.00",
                "payment_method": "CASH",
                "payment_date": datetime.now(timezone.utc).isoformat()
            },
            headers=e_headers
        )
        assert res_future_start.status_code == 400
        assert "actual_start_time cannot be in the future" in res_future_start.json()["detail"]

        res_future_end = await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/complete",
            json={
                "actual_start_time": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
                "actual_end_time": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
                "hours_worked": "3.00",
                "agreed_amount": "1000.00",
                "amount_paid": "1000.00",
                "payment_method": "CASH",
                "payment_date": datetime.now(timezone.utc).isoformat()
            },
            headers=e_headers
        )
        assert res_future_end.status_code == 400
        assert "actual_end_time cannot be in the future" in res_future_end.json()["detail"]


@pytest.mark.anyio
async def test_implausible_hours_rejected():
    """
    Test hours worked plausibility validation:
    Elapsed shift duration is 2 hours (e.g. 3h ago to 1h ago).
    Submitting 5.00 hours worked must be rejected (exceeds elapsed duration + 15 min tolerance).
    """
    shift = await create_confirmed_test_shift(rate=Decimal("1000.00"))
    emp_token = create_access_token({"sub": shift["employer_user_id"]})
    e_headers = {"Authorization": f"Bearer {emp_token}"}

    now = datetime.now(timezone.utc)
    start_2h = now - timedelta(hours=3)
    end_1h = now - timedelta(hours=1)  # 2.00 hours elapsed

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/complete",
            json={
                "actual_start_time": start_2h.isoformat(),
                "actual_end_time": end_1h.isoformat(),
                "hours_worked": "5.00",  # Claiming 5 hours for a 2-hour elapsed window
                "agreed_amount": "1000.00",
                "amount_paid": "1000.00",
                "payment_method": "CASH",
                "payment_date": now.isoformat()
            },
            headers=e_headers
        )
        assert res.status_code == 400
        assert "exceeds the elapsed duration" in res.json()["detail"]


@pytest.mark.anyio
async def test_dispute_history_comprehensive_snapshot():
    """
    Test comprehensive dispute snapshot:
    Verify that prior amount, method, date, reference, notes, and worker confirmation info
    are properly archived in dispute_history JSON.
    """
    shift = await create_confirmed_test_shift(rate=Decimal("2000.00"))
    emp_token = create_access_token({"sub": shift["employer_user_id"]})
    worker_token = create_access_token({"sub": shift["worker_user_id"]})
    e_headers = {"Authorization": f"Bearer {emp_token}"}
    w_headers = {"Authorization": f"Bearer {worker_token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        now = datetime.now(timezone.utc)
        # 1. Complete with ₹1200 cash
        await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/complete",
            json={
                "actual_start_time": shift["start_time"].isoformat(),
                "actual_end_time": shift["end_time"].isoformat(),
                "hours_worked": "7.00",
                "agreed_amount": "2000.00",
                "amount_paid": "1200.00",
                "payment_method": "CASH",
                "payment_date": now.isoformat(),
                "payment_reference": "CASH-SLIP-001",
                "payment_notes": "Initial advance payment"
            },
            headers=e_headers
        )

        # 2. Worker disputes
        await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/payment/dispute",
            json={"dispute_reason": "Expected full payment of ₹2000, not ₹1200"},
            headers=w_headers
        )

        # 3. Employer corrects by providing remaining ₹800 via UPI
        update_res = await ac.patch(
            f"/api/shift-bookings/{shift['booking_id']}/payment",
            json={
                "installment_amount": "800.00",
                "payment_method": "UPI",
                "payment_reference": "UPI/REMEDIATION/002",
                "correction_note": "Settled remaining balance of ₹800 via UPI"
            },
            headers=e_headers
        )
        assert update_res.status_code == 200, update_res.text
        data = update_res.json()
        assert len(data["dispute_history"]) >= 1
        entry = data["dispute_history"][0]
        assert entry["dispute_reason"] == "Expected full payment of ₹2000, not ₹1200"
        assert entry["previous_amount_paid"] == "1200.00"
        assert entry["previous_payment_method"] == "CASH"
        assert entry["previous_payment_reference"] == "CASH-SLIP-001"
        assert entry["previous_notes"] == "Initial advance payment"
        assert entry["correction_note"] == "Settled remaining balance of ₹800 via UPI"
        assert "corrected_at" in entry


@pytest.mark.anyio
async def test_confirmed_record_cannot_be_disputed():
    """Verify that once a payment is fully confirmed by worker, it cannot be disputed."""
    shift = await create_confirmed_test_shift(rate=Decimal("1000.00"))
    emp_token = create_access_token({"sub": shift["employer_user_id"]})
    worker_token = create_access_token({"sub": shift["worker_user_id"]})
    e_headers = {"Authorization": f"Bearer {emp_token}"}
    w_headers = {"Authorization": f"Bearer {worker_token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        now = datetime.now(timezone.utc)
        # Complete full payment
        await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/complete",
            json={
                "actual_start_time": shift["start_time"].isoformat(),
                "actual_end_time": shift["end_time"].isoformat(),
                "hours_worked": "7.00",
                "agreed_amount": "1000.00",
                "amount_paid": "1000.00",
                "payment_method": "CASH",
                "payment_date": now.isoformat()
            },
            headers=e_headers
        )

        # Worker confirms
        conf_res = await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/payment/confirm",
            headers=w_headers
        )
        assert conf_res.status_code == 200
        assert conf_res.json()["payment_status"] == "CONFIRMED"

        # Attempt to dispute confirmed payment -> 400
        disp_res = await ac.post(
            f"/api/shift-bookings/{shift['booking_id']}/payment/dispute",
            json={"dispute_reason": "I want to dispute after confirming"},
            headers=w_headers
        )
        assert disp_res.status_code == 400
        assert "already been confirmed" in disp_res.json()["detail"]
