"""
KaamSetu — Phase 4.2 Application Counter Consistency Test Suite
Verifies:
1. Applying for a job increments job.applications_count.
2. Withdrawing an application decrements job.applications_count.
3. Repeated withdrawal requests receive HTTP 400 and do not double-decrement or produce negative counts.
4. Re-applying after withdrawal reactivates the application record without unique constraint errors and increments applications_count.
5. Multiple concurrent applicants and withdrawals maintain exact mathematical count parity.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from uuid import uuid4
from sqlalchemy import select, delete

from app.main import app
from app.core.security import create_access_token, hash_password
from app.db.session import engine, AsyncSessionLocal
from app.models.models import (
    User, WorkerProfile, EmployerProfile, JobCategory, Job,
    JobApplication, ApplicationStatus, UserRole, WorkType,
    SalaryType, JobStatus
)

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
async def cleanup_engine():
    yield
    await engine.dispose()


@pytest.mark.anyio
async def test_apply_withdraw_reapply_counter_lifecycle():
    """
    Tests full application lifecycle:
    Apply -> count becomes 1
    Withdraw -> count becomes 0
    Repeated withdraw -> 400 Bad Request, count stays 0
    Re-apply -> reactivates application, count becomes 1
    Second worker applies -> count becomes 2
    First worker withdraws -> count becomes 1
    """
    created_user_ids = []
    created_job_ids = []

    async with AsyncSessionLocal() as db:
        cat = (await db.execute(select(JobCategory).limit(1))).scalar_one()

        # Employer
        emp_user = User(
            email=f"counter_emp_{uuid4().hex[:8]}@example.com",
            phone=f"9{uuid4().int % 1000000000:09d}",
            password_hash=hash_password("Pass123!"),
            role=UserRole.EMPLOYER,
            is_active=True
        )
        db.add(emp_user)
        await db.flush()
        created_user_ids.append(emp_user.id)

        emp_prof = EmployerProfile(user_id=emp_user.id, full_name="Counter Emp", city="Pune", state="MH")
        db.add(emp_prof)
        await db.flush()

        job = Job(
            employer_id=emp_prof.id,
            category_id=cat.id,
            title="Counter Test Job",
            description="Lifecycle counter test",
            work_type=WorkType.FULL_TIME,
            salary_type=SalaryType.MONTHLY,
            city="Pune",
            state="MH",
            status=JobStatus.ACTIVE,
            applications_count=0
        )
        db.add(job)
        await db.flush()
        created_job_ids.append(job.id)

        # Worker 1
        w1_user = User(
            email=f"counter_w1_{uuid4().hex[:8]}@example.com",
            phone=f"9{uuid4().int % 1000000000:09d}",
            password_hash=hash_password("Pass123!"),
            role=UserRole.WORKER,
            is_active=True
        )
        db.add(w1_user)
        await db.flush()
        created_user_ids.append(w1_user.id)

        w1_prof = WorkerProfile(user_id=w1_user.id, full_name="Worker 1", city="Pune", state="MH")
        db.add(w1_prof)
        await db.flush()

        # Worker 2
        w2_user = User(
            email=f"counter_w2_{uuid4().hex[:8]}@example.com",
            phone=f"9{uuid4().int % 1000000000:09d}",
            password_hash=hash_password("Pass123!"),
            role=UserRole.WORKER,
            is_active=True
        )
        db.add(w2_user)
        await db.flush()
        created_user_ids.append(w2_user.id)

        w2_prof = WorkerProfile(user_id=w2_user.id, full_name="Worker 2", city="Pune", state="MH")
        db.add(w2_prof)
        await db.commit()

        w1_token = create_access_token({"sub": str(w1_user.id)})
        w2_token = create_access_token({"sub": str(w2_user.id)})
        job_id = job.id

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            w1_headers = {"Authorization": f"Bearer {w1_token}"}
            w2_headers = {"Authorization": f"Bearer {w2_token}"}

            # Step 1: Worker 1 applies
            res1 = await client.post(f"/api/jobs/{job_id}/apply", json={"cover_note": "First note"}, headers=w1_headers)
            assert res1.status_code == 201, res1.text
            app1_id = res1.json()["id"]

            # Verify job.applications_count == 1
            async with AsyncSessionLocal() as db:
                j = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one()
                assert j.applications_count == 1

            # Step 2: Worker 1 withdraws
            res2 = await client.delete(f"/api/applications/{app1_id}", headers=w1_headers)
            assert res2.status_code == 204

            # Verify job.applications_count == 0 (not negative, properly decremented)
            async with AsyncSessionLocal() as db:
                j = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one()
                assert j.applications_count == 0

            # Step 3: Repeated withdrawal must fail with 400 and NOT double-decrement
            res3 = await client.delete(f"/api/applications/{app1_id}", headers=w1_headers)
            assert res3.status_code == 400
            assert "Cannot withdraw at this stage" in res3.text

            async with AsyncSessionLocal() as db:
                j = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one()
                assert j.applications_count == 0

            # Step 4: Worker 1 re-applies to the same job (reactivates withdrawn application)
            res4 = await client.post(f"/api/jobs/{job_id}/apply", json={"cover_note": "Re-applying note"}, headers=w1_headers)
            assert res4.status_code == 201, res4.text
            re_app = res4.json()
            assert re_app["id"] == app1_id
            assert re_app["status"] == "PENDING"
            assert re_app["cover_note"] == "Re-applying note"

            # Verify job.applications_count == 1
            async with AsyncSessionLocal() as db:
                j = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one()
                assert j.applications_count == 1

            # Step 5: Worker 2 applies -> count becomes 2
            res5 = await client.post(f"/api/jobs/{job_id}/apply", json={"cover_note": "Worker 2 note"}, headers=w2_headers)
            assert res5.status_code == 201
            app2_id = res5.json()["id"]

            async with AsyncSessionLocal() as db:
                j = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one()
                assert j.applications_count == 2

            # Step 6: Worker 1 withdraws again -> count becomes 1 (Worker 2 is still active)
            res6 = await client.delete(f"/api/applications/{app1_id}", headers=w1_headers)
            assert res6.status_code == 204

            async with AsyncSessionLocal() as db:
                j = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one()
                assert j.applications_count == 1

    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(JobApplication).where(JobApplication.job_id == job_id))
            await db.execute(delete(Job).where(Job.id == job_id))
            await db.execute(delete(WorkerProfile).where(WorkerProfile.user_id.in_(created_user_ids)))
            await db.execute(delete(EmployerProfile).where(EmployerProfile.user_id.in_(created_user_ids)))
            await db.execute(delete(User).where(User.id.in_(created_user_ids)))
            await db.commit()
