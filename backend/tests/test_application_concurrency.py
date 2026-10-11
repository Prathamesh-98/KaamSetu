import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from uuid import uuid4
from sqlalchemy import select, func
from app.main import app
from app.core.security import create_access_token
from app.db.session import engine, AsyncSessionLocal
from app.models.models import (
    Job, JobApplication, ApplicationStatus, EmployerProfile, WorkerProfile,
    WorkType, SalaryType, JobCategory
)

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
async def cleanup_engine():
    yield
    await engine.dispose()

@pytest.mark.anyio
async def test_concurrent_application_acceptance_limit():
    emp1_user_id = "da87f7a4-6cbf-419c-af92-5c1754ec6662"
    emp1_token = create_access_token({"sub": emp1_user_id})
    emp1_headers = {"Authorization": f"Bearer {emp1_token}"}

    async with AsyncSessionLocal() as db:
        # 1. Get employer profile
        e_res = await db.execute(select(EmployerProfile).where(EmployerProfile.user_id == emp1_user_id))
        employer = e_res.scalar_one()

        # 2. Get a category
        cat_res = await db.execute(select(JobCategory).limit(1))
        category = cat_res.scalar_one()

        # 3. Create a dedicated test Job with workers_needed = 1
        test_job = Job(
            employer_id=employer.id,
            category_id=category.id,
            title="Concurrency Test Job",
            description="Testing concurrent acceptance serialization",
            work_type=WorkType.FULL_TIME,
            city="Mumbai",
            state="Maharashtra",
            salary_type=SalaryType.HOURLY,
            workers_needed=1
        )
        db.add(test_job)
        await db.flush()

        # 4. Get 2 distinct workers
        w_res = await db.execute(select(WorkerProfile).limit(2))
        workers = w_res.scalars().all()
        assert len(workers) >= 2, "Need at least 2 workers in DB for concurrency test"

        # 5. Create 2 job applications for this job in SHORTLISTED state
        app1 = JobApplication(
            job_id=test_job.id,
            worker_id=workers[0].id,
            status=ApplicationStatus.SHORTLISTED
        )
        app2 = JobApplication(
            job_id=test_job.id,
            worker_id=workers[1].id,
            status=ApplicationStatus.SHORTLISTED
        )
        db.add(app1)
        db.add(app2)
        await db.commit()
        await db.refresh(app1)
        await db.refresh(app2)

        app1_id = str(app1.id)
        app2_id = str(app2.id)
        job_id = test_job.id

    # 6. Execute two simultaneous concurrent acceptance requests
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        req1 = ac.put(
            f"/api/applications/{app1_id}/status",
            json={"status": "ACCEPTED"},
            headers=emp1_headers
        )
        req2 = ac.put(
            f"/api/applications/{app2_id}/status",
            json={"status": "ACCEPTED"},
            headers=emp1_headers
        )

        res1, res2 = await asyncio.gather(req1, req2)

        # One must succeed (200), one must be rejected with 400 (capacity full)
        statuses = [res1.status_code, res2.status_code]
        assert 200 in statuses, f"Expected one 200, got {statuses}: {res1.text}, {res2.text}"
        assert 400 in statuses, f"Expected one 400 (capacity full), got {statuses}: {res1.text}, {res2.text}"

    # 7. Verify database state: exactly 1 application is ACCEPTED
    async with AsyncSessionLocal() as db:
        count_res = await db.execute(
            select(func.count(JobApplication.id))
            .where(
                JobApplication.job_id == job_id,
                JobApplication.status == ApplicationStatus.ACCEPTED
            )
        )
        accepted_count = count_res.scalar_one()
        assert accepted_count == 1, f"Expected exactly 1 accepted application, found {accepted_count}"
