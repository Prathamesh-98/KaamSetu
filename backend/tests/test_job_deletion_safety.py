"""
KaamSetu — Phase 4.1 Job Deletion Safety Test Suite
Verifies:
1. A job with candidate applications is NOT hard-deleted; it is soft-cancelled (JobStatus.CANCELLED)
   and all JobApplication records are preserved.
2. A job with shift bookings / completions / payments is NOT hard-deleted; it is soft-cancelled
   and all shift and payment records remain intact.
3. Re-deleting an already CANCELLED job does not destroy historical records.
4. A truly fresh job with 0 applications and 0 shifts is cleanly hard-deleted.
5. Authorization: Employer B cannot delete Employer A's job (HTTP 403).
"""
import pytest
from httpx import AsyncClient, ASGITransport
from uuid import uuid4
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, delete

from app.main import app
from app.core.security import create_access_token, hash_password
from app.db.session import engine, AsyncSessionLocal
from app.models.models import (
    User, WorkerProfile, EmployerProfile, JobCategory, Job,
    JobApplication, ApplicationStatus, UserRole, WorkType, SalaryType,
    JobStatus, ShiftBooking, BookingStatus, WorkCompletion,
    PaymentRecord, PaymentMethod, PaymentStatus
)

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
async def cleanup_engine():
    yield
    await engine.dispose()


@pytest.mark.anyio
async def test_job_with_applications_is_soft_cancelled_and_preserved():
    """
    When a job has applications, DELETE /api/jobs/{id} must transition the job to CANCELLED
    instead of hard-deleting, preserving all applications for worker and employer history.
    """
    created_user_ids = []
    created_job_ids = []
    created_app_ids = []

    async with AsyncSessionLocal() as db:
        cat = (await db.execute(select(JobCategory).limit(1))).scalar_one()

        # Employer A
        emp_user = User(
            email=f"del_safety_emp_{uuid4().hex[:8]}@example.com",
            phone=f"9{uuid4().int % 1000000000:09d}",
            password_hash=hash_password("EmpPass123!"),
            role=UserRole.EMPLOYER,
            is_active=True
        )
        db.add(emp_user)
        await db.flush()
        created_user_ids.append(emp_user.id)

        emp_prof = EmployerProfile(
            user_id=emp_user.id,
            full_name="Safety Test Employer",
            organization_name="Safety Corp",
            city="Pune",
            state="Maharashtra"
        )
        db.add(emp_prof)
        await db.flush()

        job = Job(
            employer_id=emp_prof.id,
            category_id=cat.id,
            title="Job With Applicants",
            description="Testing soft cancel on delete",
            work_type=WorkType.FULL_TIME,
            salary_type=SalaryType.MONTHLY,
            city="Pune",
            state="Maharashtra",
            status=JobStatus.ACTIVE
        )
        db.add(job)
        await db.flush()
        created_job_ids.append(job.id)

        # Worker
        w_user = User(
            email=f"del_safety_worker_{uuid4().hex[:8]}@example.com",
            phone=f"9{uuid4().int % 1000000000:09d}",
            password_hash=hash_password("WorkerPass123!"),
            role=UserRole.WORKER,
            is_active=True
        )
        db.add(w_user)
        await db.flush()
        created_user_ids.append(w_user.id)

        w_prof = WorkerProfile(
            user_id=w_user.id,
            full_name="Applicant Worker",
            city="Pune",
            state="Maharashtra"
        )
        db.add(w_prof)
        await db.flush()

        app_rec = JobApplication(
            job_id=job.id,
            worker_id=w_prof.id,
            status=ApplicationStatus.PENDING
        )
        db.add(app_rec)
        await db.flush()
        created_app_ids.append(app_rec.id)

        await db.commit()

        emp_token = create_access_token({"sub": str(emp_user.id)})
        job_id = job.id
        app_id = app_rec.id

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = {"Authorization": f"Bearer {emp_token}"}
            res = await client.delete(f"/api/jobs/{job_id}", headers=headers)
            assert res.status_code == 204

        # Verify database: Job is NOT deleted; status is CANCELLED
        async with AsyncSessionLocal() as db:
            j = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
            assert j is not None, "Job was unexpectedly hard-deleted!"
            assert j.status == JobStatus.CANCELLED, f"Expected CANCELLED, got {j.status}"

            # Verify application is preserved
            a = (await db.execute(select(JobApplication).where(JobApplication.id == app_id))).scalar_one_or_none()
            assert a is not None, "Application was wiped by cascade delete!"
            assert a.status == ApplicationStatus.PENDING

        # Re-delete: Calling delete on an already cancelled job must NOT hard-delete it
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res2 = await client.delete(f"/api/jobs/{job_id}", headers=headers)
            assert res2.status_code == 204

        async with AsyncSessionLocal() as db:
            j2 = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
            assert j2 is not None, "Repeated delete destroyed cancelled job!"
            assert j2.status == JobStatus.CANCELLED

    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(JobApplication).where(JobApplication.id.in_(created_app_ids)))
            await db.execute(delete(Job).where(Job.id.in_(created_job_ids)))
            await db.execute(delete(WorkerProfile).where(WorkerProfile.user_id.in_(created_user_ids)))
            await db.execute(delete(EmployerProfile).where(EmployerProfile.user_id.in_(created_user_ids)))
            await db.execute(delete(User).where(User.id.in_(created_user_ids)))
            await db.commit()


@pytest.mark.anyio
async def test_job_with_shift_and_payments_is_soft_cancelled_and_preserved():
    """
    When a job has shift bookings and payment history, DELETE must preserve all records.
    """
    created_user_ids = []
    created_job_ids = []
    created_shift_ids = []

    async with AsyncSessionLocal() as db:
        cat = (await db.execute(select(JobCategory).limit(1))).scalar_one()

        # Employer
        emp_user = User(
            email=f"shift_safe_emp_{uuid4().hex[:8]}@example.com",
            phone=f"9{uuid4().int % 1000000000:09d}",
            password_hash=hash_password("EmpPass123!"),
            role=UserRole.EMPLOYER,
            is_active=True
        )
        db.add(emp_user)
        await db.flush()
        created_user_ids.append(emp_user.id)

        emp_prof = EmployerProfile(
            user_id=emp_user.id,
            full_name="Shift Safety Employer",
            organization_name="Shift Safety Corp",
            city="Pune",
            state="Maharashtra"
        )
        db.add(emp_prof)
        await db.flush()

        job = Job(
            employer_id=emp_prof.id,
            category_id=cat.id,
            title="Job With Completed Shift",
            description="Testing shift preservation on delete",
            work_type=WorkType.DAILY,
            salary_type=SalaryType.DAILY,
            city="Pune",
            state="Maharashtra",
            status=JobStatus.ACTIVE
        )
        db.add(job)
        await db.flush()
        created_job_ids.append(job.id)

        # Worker
        w_user = User(
            email=f"shift_safe_worker_{uuid4().hex[:8]}@example.com",
            phone=f"9{uuid4().int % 1000000000:09d}",
            password_hash=hash_password("WorkerPass123!"),
            role=UserRole.WORKER,
            is_active=True
        )
        db.add(w_user)
        await db.flush()
        created_user_ids.append(w_user.id)

        w_prof = WorkerProfile(
            user_id=w_user.id,
            full_name="Shift Worker",
            city="Pune",
            state="Maharashtra"
        )
        db.add(w_prof)
        await db.flush()

        # Shift Booking
        now = datetime.now(timezone.utc)
        shift = ShiftBooking(
            job_id=job.id,
            employer_id=emp_prof.id,
            worker_id=w_prof.id,
            start_time=now - timedelta(hours=8),
            end_time=now,
            proposed_rate=200.0,
            rate_type=SalaryType.HOURLY,
            status=BookingStatus.COMPLETED
        )
        db.add(shift)
        await db.flush()
        created_shift_ids.append(shift.id)

        # Work Completion & Payment
        comp = WorkCompletion(
            shift_booking_id=shift.id,
            completed_by=emp_user.id,
            actual_start_time=shift.start_time,
            actual_end_time=shift.end_time,
            hours_worked=8.0,
            completion_notes="Work completed safely"
        )
        db.add(comp)
        await db.flush()

        pay = PaymentRecord(
            work_completion_id=comp.id,
            shift_booking_id=shift.id,
            agreed_amount=1600.0,
            amount_paid=1600.0,
            currency="INR",
            payment_method=PaymentMethod.CASH,
            payment_status=PaymentStatus.CONFIRMED,
            payment_date=now
        )
        db.add(pay)
        await db.commit()

        emp_token = create_access_token({"sub": str(emp_user.id)})
        job_id = job.id
        shift_id = shift.id

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = {"Authorization": f"Bearer {emp_token}"}
            res = await client.delete(f"/api/jobs/{job_id}", headers=headers)
            assert res.status_code == 204

        # Verify job is CANCELLED and shift/completion/payment are intact
        async with AsyncSessionLocal() as db:
            j = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
            assert j is not None, "Job was hard-deleted!"
            assert j.status == JobStatus.CANCELLED

            s = (await db.execute(select(ShiftBooking).where(ShiftBooking.id == shift_id))).scalar_one_or_none()
            assert s is not None, "ShiftBooking was destroyed!"
            assert s.status == BookingStatus.COMPLETED

            c = (await db.execute(select(WorkCompletion).where(WorkCompletion.shift_booking_id == shift_id))).scalar_one_or_none()
            assert c is not None, "WorkCompletion was wiped!"

            p = (await db.execute(select(PaymentRecord).where(PaymentRecord.shift_booking_id == shift_id))).scalar_one_or_none()
            assert p is not None, "PaymentRecord was wiped!"

    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(PaymentRecord).where(PaymentRecord.shift_booking_id.in_(created_shift_ids)))
            await db.execute(delete(WorkCompletion).where(WorkCompletion.shift_booking_id.in_(created_shift_ids)))
            await db.execute(delete(ShiftBooking).where(ShiftBooking.id.in_(created_shift_ids)))
            await db.execute(delete(Job).where(Job.id.in_(created_job_ids)))
            await db.execute(delete(WorkerProfile).where(WorkerProfile.user_id.in_(created_user_ids)))
            await db.execute(delete(EmployerProfile).where(EmployerProfile.user_id.in_(created_user_ids)))
            await db.execute(delete(User).where(User.id.in_(created_user_ids)))
            await db.commit()


@pytest.mark.anyio
async def test_fresh_job_without_history_is_hard_deleted():
    """
    A fresh job with 0 applications and 0 shifts can be hard-deleted cleanly.
    """
    created_user_ids = []

    async with AsyncSessionLocal() as db:
        cat = (await db.execute(select(JobCategory).limit(1))).scalar_one()

        emp_user = User(
            email=f"fresh_emp_{uuid4().hex[:8]}@example.com",
            phone=f"9{uuid4().int % 1000000000:09d}",
            password_hash=hash_password("EmpPass123!"),
            role=UserRole.EMPLOYER,
            is_active=True
        )
        db.add(emp_user)
        await db.flush()
        created_user_ids.append(emp_user.id)

        emp_prof = EmployerProfile(
            user_id=emp_user.id,
            full_name="Fresh Employer",
            organization_name="Fresh Corp",
            city="Pune",
            state="Maharashtra"
        )
        db.add(emp_prof)
        await db.flush()

        job = Job(
            employer_id=emp_prof.id,
            category_id=cat.id,
            title="Fresh Empty Job",
            description="No applications, no shifts",
            work_type=WorkType.FULL_TIME,
            salary_type=SalaryType.MONTHLY,
            city="Pune",
            state="Maharashtra",
            status=JobStatus.ACTIVE
        )
        db.add(job)
        await db.commit()

        emp_token = create_access_token({"sub": str(emp_user.id)})
        job_id = job.id

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = {"Authorization": f"Bearer {emp_token}"}
            res = await client.delete(f"/api/jobs/{job_id}", headers=headers)
            assert res.status_code == 204

        # Verify job is completely removed from database
        async with AsyncSessionLocal() as db:
            j = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
            assert j is None, "Empty job should be hard-deleted"

    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(Job).where(Job.id == job_id))
            await db.execute(delete(EmployerProfile).where(EmployerProfile.user_id.in_(created_user_ids)))
            await db.execute(delete(User).where(User.id.in_(created_user_ids)))
            await db.commit()


@pytest.mark.anyio
async def test_employer_cannot_delete_other_employer_job():
    """
    Employer B receives HTTP 403 when attempting to delete Employer A's job.
    """
    created_user_ids = []
    created_job_ids = []

    async with AsyncSessionLocal() as db:
        cat = (await db.execute(select(JobCategory).limit(1))).scalar_one()

        # Employer A
        emp_a = User(
            email=f"emp_a_{uuid4().hex[:8]}@example.com",
            phone=f"9{uuid4().int % 1000000000:09d}",
            password_hash=hash_password("Pass123!"),
            role=UserRole.EMPLOYER,
            is_active=True
        )
        db.add(emp_a)
        await db.flush()
        created_user_ids.append(emp_a.id)

        emp_a_prof = EmployerProfile(user_id=emp_a.id, full_name="Emp A", city="Pune", state="MH")
        db.add(emp_a_prof)
        await db.flush()

        job = Job(
            employer_id=emp_a_prof.id,
            category_id=cat.id,
            title="Emp A Job",
            description="desc",
            work_type=WorkType.FULL_TIME,
            salary_type=SalaryType.MONTHLY,
            city="Pune",
            state="MH",
            status=JobStatus.ACTIVE
        )
        db.add(job)
        await db.flush()
        created_job_ids.append(job.id)

        # Employer B
        emp_b = User(
            email=f"emp_b_{uuid4().hex[:8]}@example.com",
            phone=f"9{uuid4().int % 1000000000:09d}",
            password_hash=hash_password("Pass123!"),
            role=UserRole.EMPLOYER,
            is_active=True
        )
        db.add(emp_b)
        await db.flush()
        created_user_ids.append(emp_b.id)

        emp_b_prof = EmployerProfile(user_id=emp_b.id, full_name="Emp B", city="Pune", state="MH")
        db.add(emp_b_prof)
        await db.commit()

        emp_b_token = create_access_token({"sub": str(emp_b.id)})
        job_id = job.id

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = {"Authorization": f"Bearer {emp_b_token}"}
            res = await client.delete(f"/api/jobs/{job_id}", headers=headers)
            assert res.status_code == 403
            assert "Not your job" in res.text

    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(Job).where(Job.id.in_(created_job_ids)))
            await db.execute(delete(EmployerProfile).where(EmployerProfile.user_id.in_(created_user_ids)))
            await db.execute(delete(User).where(User.id.in_(created_user_ids)))
            await db.commit()
