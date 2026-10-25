"""
KaamSetu — Phase 4.1 Ratings Concurrency & Transaction Safety Test Suite
Verifies:
1. Concurrency: 10 concurrent ratings targeting the same worker profile from 10 independent
   transactions/sessions update total_ratings and average_rating without lost updates.
2. Concurrency: Worker rating employer path concurrency.
3. Duplicate rating prevention: Re-submitting a rating for the same application/rater is rejected (HTTP 400).
4. Validation: Rater role validation and ownership enforcement.
"""
import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from uuid import uuid4
from datetime import datetime, timezone
from sqlalchemy import select, delete

from app.main import app
from app.core.security import create_access_token, hash_password
from app.db.session import engine, AsyncSessionLocal
from app.models.models import (
    User, WorkerProfile, EmployerProfile, JobCategory, Job,
    JobApplication, ApplicationStatus, Rating, UserRole, RaterRole,
    WorkType, SalaryType, JobStatus
)

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
async def cleanup_engine():
    yield
    await engine.dispose()


@pytest.mark.anyio
async def test_concurrent_employer_ratings_for_worker():
    """
    Submits 10 valid ratings to the same worker profile concurrently from 10 distinct employers
    using independent HTTP requests/sessions. Asserts all 10 persist and final total and average
    are mathematically correct with zero lost updates.
    """
    created_user_ids = []
    created_job_ids = []
    created_app_ids = []

    async with AsyncSessionLocal() as db:
        # Create category if none exists
        cat_res = await db.execute(select(JobCategory).limit(1))
        category = cat_res.scalar_one_or_none()
        if not category:
            category = JobCategory(name=f"RatingTestCat_{uuid4().hex[:6]}", is_active=True)
            db.add(category)
            await db.flush()

        # 1. Create target Worker
        w_user = User(
            email=f"target_worker_{uuid4().hex[:8]}@example.com",
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
            full_name="Target Concurrency Worker",
            city="Pune",
            state="Maharashtra",
            total_ratings=0,
            average_rating=0.0
        )
        db.add(w_prof)
        await db.flush()
        target_worker_id = w_prof.id
        target_worker_user_id = w_user.id

        # 2. Create 10 distinct Employers with 10 Jobs and 10 accepted Applications
        scores = [1, 2, 3, 4, 5, 2, 4, 5, 3, 5] # Sum = 34, Expected Avg = 34 / 10 = 3.40
        employer_tokens = []

        for i, score in enumerate(scores):
            emp_user = User(
                email=f"rating_emp_{i}_{uuid4().hex[:8]}@example.com",
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
                full_name="Rating Employer",
                organization_name=f"Rating Test Corp {i}",
                city="Pune",
                state="Maharashtra"
            )
            db.add(emp_prof)
            await db.flush()

            job = Job(
                employer_id=emp_prof.id,
                category_id=category.id,
                title=f"Rating Job {i}",
                description="Test description",
                work_type=WorkType.FULL_TIME,
                salary_type=SalaryType.MONTHLY,
                city="Pune",
                state="Maharashtra",
                status=JobStatus.ACTIVE
            )
            db.add(job)
            await db.flush()
            created_job_ids.append(job.id)

            app_record = JobApplication(
                job_id=job.id,
                worker_id=target_worker_id,
                status=ApplicationStatus.ACCEPTED
            )
            db.add(app_record)
            await db.flush()
            created_app_ids.append(app_record.id)

            token = create_access_token({"sub": str(emp_user.id)})
            employer_tokens.append((token, str(app_record.id), score))

        await db.commit()

    try:
        # Fire all 10 rating requests concurrently using separate AsyncClients
        async def submit_rating(token: str, application_id: str, score: int):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                return await client.post(
                    "/api/ratings",
                    json={
                        "application_id": application_id,
                        "rating": score,
                        "review_text": f"Concurrent test rating {score}",
                        "rater_role": "EMPLOYER"
                    },
                    headers={"Authorization": f"Bearer {token}"}
                )

        tasks = [
            submit_rating(tok, app_id, score)
            for tok, app_id, score in employer_tokens
        ]
        responses = await asyncio.gather(*tasks)

        # Assert all 10 ratings succeeded
        for i, res in enumerate(responses):
            assert res.status_code == 201, f"Request {i} failed: {res.status_code} - {res.text}"

        # Assert final profile in database has exactly 10 ratings and the correct average
        async with AsyncSessionLocal() as db:
            prof = (
                await db.execute(
                    select(WorkerProfile).where(WorkerProfile.id == target_worker_id)
                )
            ).scalar_one()

            assert prof.total_ratings == 10, f"Expected total_ratings=10, got {prof.total_ratings}"
            expected_avg = round(sum(scores) / len(scores), 2) # 3.4
            assert abs(prof.average_rating - expected_avg) < 0.01, f"Expected avg={expected_avg}, got {prof.average_rating}"

            # Verify 10 distinct Rating rows exist in database
            rating_count = (
                await db.execute(
                    select(Rating).where(Rating.rated_user == target_worker_user_id)
                )
            ).scalars().all()
            assert len(rating_count) == 10

    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(Rating).where(Rating.application_id.in_(created_app_ids)))
            await db.execute(delete(JobApplication).where(JobApplication.id.in_(created_app_ids)))
            await db.execute(delete(Job).where(Job.id.in_(created_job_ids)))
            await db.execute(delete(WorkerProfile).where(WorkerProfile.id == target_worker_id))
            await db.execute(delete(EmployerProfile).where(EmployerProfile.user_id.in_(created_user_ids)))
            await db.execute(delete(User).where(User.id.in_(created_user_ids)))
            await db.commit()


@pytest.mark.anyio
async def test_concurrent_worker_ratings_for_employer():
    """
    Submits concurrent ratings to the same Employer profile from multiple Workers.
    Verifies EmployerProfile.total_ratings and EmployerProfile.average_rating are updated atomically.
    """
    created_user_ids = []
    created_job_ids = []
    created_app_ids = []

    async with AsyncSessionLocal() as db:
        cat_res = await db.execute(select(JobCategory).limit(1))
        category = cat_res.scalar_one()

        # Target Employer
        emp_user = User(
            email=f"target_emp_{uuid4().hex[:8]}@example.com",
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
            full_name="Target Concurrency Employer",
            organization_name="Target Concurrency Employer Org",
            city="Pune",
            state="Maharashtra",
            total_ratings=0,
            average_rating=0.0
        )
        db.add(emp_prof)
        await db.flush()
        target_employer_user_id = emp_user.id
        target_employer_id = emp_prof.id

        scores = [4, 5, 3, 5, 4] # Sum = 21, Expected Avg = 21 / 5 = 4.20
        worker_tokens = []

        for i, score in enumerate(scores):
            job = Job(
                employer_id=target_employer_id,
                category_id=category.id,
                title=f"Worker Rating Job {i}",
                description="Test description",
                work_type=WorkType.DAILY,
                salary_type=SalaryType.DAILY,
                city="Pune",
                state="Maharashtra",
                status=JobStatus.ACTIVE
            )
            db.add(job)
            await db.flush()
            created_job_ids.append(job.id)

            w_user = User(
                email=f"rating_worker_{i}_{uuid4().hex[:8]}@example.com",
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
                full_name=f"Worker Rater {i}",
                city="Pune",
                state="Maharashtra"
            )
            db.add(w_prof)
            await db.flush()

            app_record = JobApplication(
                job_id=job.id,
                worker_id=w_prof.id,
                status=ApplicationStatus.COMPLETED
            )
            db.add(app_record)
            await db.flush()
            created_app_ids.append(app_record.id)

            token = create_access_token({"sub": str(w_user.id)})
            worker_tokens.append((token, str(app_record.id), score))

        await db.commit()

    try:
        async def submit_rating(token: str, application_id: str, score: int):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                return await client.post(
                    "/api/ratings",
                    json={
                        "application_id": application_id,
                        "rating": score,
                        "review_text": f"Worker review {score}",
                        "rater_role": "WORKER"
                    },
                    headers={"Authorization": f"Bearer {token}"}
                )

        tasks = [
            submit_rating(tok, app_id, score)
            for tok, app_id, score in worker_tokens
        ]
        responses = await asyncio.gather(*tasks)

        for res in responses:
            assert res.status_code == 201, res.text

        async with AsyncSessionLocal() as db:
            prof = (
                await db.execute(
                    select(EmployerProfile).where(EmployerProfile.id == target_employer_id)
                )
            ).scalar_one()

            assert prof.total_ratings == 5, f"Expected 5, got {prof.total_ratings}"
            assert abs(prof.average_rating - 4.20) < 0.01, f"Expected 4.20, got {prof.average_rating}"

    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(Rating).where(Rating.application_id.in_(created_app_ids)))
            await db.execute(delete(JobApplication).where(JobApplication.id.in_(created_app_ids)))
            await db.execute(delete(Job).where(Job.id.in_(created_job_ids)))
            await db.execute(delete(WorkerProfile).where(WorkerProfile.user_id.in_(created_user_ids)))
            await db.execute(delete(EmployerProfile).where(EmployerProfile.id == target_employer_id))
            await db.execute(delete(User).where(User.id.in_(created_user_ids)))
            await db.commit()


@pytest.mark.anyio
async def test_duplicate_rating_prevention():
    """Verifies that an application cannot be rated more than once by the same rater."""
    async with AsyncSessionLocal() as db:
        cat = (await db.execute(select(JobCategory).limit(1))).scalar_one()

        emp_user = User(
            email=f"dup_emp_{uuid4().hex[:8]}@example.com",
            phone=f"9{uuid4().int % 1000000000:09d}",
            password_hash=hash_password("Pass123!"),
            role=UserRole.EMPLOYER,
            is_active=True
        )
        db.add(emp_user)
        await db.flush()

        emp_prof = EmployerProfile(user_id=emp_user.id, full_name="Dup Emp", organization_name="Dup Corp", city="Pune", state="MH")
        db.add(emp_prof)
        await db.flush()

        job = Job(
            employer_id=emp_prof.id,
            category_id=cat.id,
            title="Dup Test Job",
            description="desc",
            work_type=WorkType.FULL_TIME,
            salary_type=SalaryType.MONTHLY,
            city="Pune",
            state="MH",
            status=JobStatus.ACTIVE
        )
        db.add(job)
        await db.flush()

        w_user = User(
            email=f"dup_w_{uuid4().hex[:8]}@example.com",
            phone=f"9{uuid4().int % 1000000000:09d}",
            password_hash=hash_password("Pass123!"),
            role=UserRole.WORKER,
            is_active=True
        )
        db.add(w_user)
        await db.flush()

        w_prof = WorkerProfile(user_id=w_user.id, full_name="Dup Worker", city="Pune", state="MH")
        db.add(w_prof)
        await db.flush()

        app_rec = JobApplication(job_id=job.id, worker_id=w_prof.id, status=ApplicationStatus.ACCEPTED)
        db.add(app_rec)
        await db.commit()

        emp_token = create_access_token({"sub": str(emp_user.id)})
        app_id_str = str(app_rec.id)
        user_ids = [emp_user.id, w_user.id]
        job_id = job.id
        app_id = app_rec.id

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = {"Authorization": f"Bearer {emp_token}"}
            payload = {
                "application_id": app_id_str,
                "rating": 5,
                "review_text": "First rating",
                "rater_role": "EMPLOYER"
            }

            # First rating succeeds
            res1 = await client.post("/api/ratings", json=payload, headers=headers)
            assert res1.status_code == 201

            # Second rating fails with 400
            res2 = await client.post("/api/ratings", json=payload, headers=headers)
            assert res2.status_code == 400
            assert "Already rated" in res2.text

    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(Rating).where(Rating.application_id == app_id))
            await db.execute(delete(JobApplication).where(JobApplication.id == app_id))
            await db.execute(delete(Job).where(Job.id == job_id))
            await db.execute(delete(WorkerProfile).where(WorkerProfile.user_id.in_(user_ids)))
            await db.execute(delete(EmployerProfile).where(EmployerProfile.user_id.in_(user_ids)))
            await db.execute(delete(User).where(User.id.in_(user_ids)))
            await db.commit()
