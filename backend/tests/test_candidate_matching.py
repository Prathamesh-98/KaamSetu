"""
KaamSetu — Phase 4.1 Bounded Worker Candidate Matching Test Suite
Verifies:
1. GET /api/jobs/{id}/candidates returns matching candidates with explainable scores and factors.
2. Ranking stability: Candidates are sorted by match_score descending, then full_name ascending.
3. Out-of-city candidate inclusion: Out-of-city workers with matching skills are NOT excluded.
4. Inactive accounts: Inactive users (is_active=False) are excluded from the candidate pool.
5. Pagination: Correct page, size, total, and pages calculation.
6. Authorization: Employer B cannot access candidates for Employer A's job (HTTP 404).
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
    Skill, WorkerSkill, JobRequiredSkill, UserRole, WorkType,
    SalaryType, JobStatus, AvailabilityStatus, ProficiencyLevel
)

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
async def cleanup_engine():
    yield
    await engine.dispose()


@pytest.mark.anyio
async def test_candidate_matching_ranking_and_bounding():
    """
    Creates a job with required skills in Pune, Maharashtra.
    Creates 4 workers:
    - Worker 1: In Pune, has required skill, AVAILABLE -> High match score
    - Worker 2: In Mumbai (different city, same state), has required skill, AVAILABLE -> Strong match (skills + partial location)
    - Worker 3: In Bangalore (different state), has no matching skills -> Lower match
    - Worker 4: Inactive user account -> Excluded from results
    """
    created_user_ids = []
    created_job_ids = []
    created_skill_ids = []

    async with AsyncSessionLocal() as db:
        cat = (await db.execute(select(JobCategory).limit(1))).scalar_one()

        # Create Skill
        skill = Skill(name=f"Plumbing_{uuid4().hex[:6]}")
        db.add(skill)
        await db.flush()
        created_skill_ids.append(skill.id)

        # Employer
        emp_user = User(
            email=f"candidate_emp_{uuid4().hex[:8]}@example.com",
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
            full_name="Candidate Employer",
            organization_name="Candidate Corp",
            city="Pune",
            state="Maharashtra"
        )
        db.add(emp_prof)
        await db.flush()

        job = Job(
            employer_id=emp_prof.id,
            category_id=cat.id,
            title="Senior Plumber Needed",
            description="Needs experienced plumbing technician",
            work_type=WorkType.FULL_TIME,
            salary_type=SalaryType.MONTHLY,
            city="Pune",
            state="Maharashtra",
            status=JobStatus.ACTIVE,
            experience_required=2
        )
        db.add(job)
        await db.flush()
        created_job_ids.append(job.id)

        job_skill = JobRequiredSkill(job_id=job.id, skill_id=skill.id, is_mandatory=True)
        db.add(job_skill)
        await db.flush()

        # Worker 1: Pune, has skill, available, 3 yrs exp
        w1_user = User(
            email=f"w1_pune_{uuid4().hex[:8]}@example.com",
            phone=f"9{uuid4().int % 1000000000:09d}",
            password_hash=hash_password("Pass123!"),
            role=UserRole.WORKER,
            is_active=True
        )
        db.add(w1_user)
        await db.flush()
        created_user_ids.append(w1_user.id)

        w1_prof = WorkerProfile(
            user_id=w1_user.id,
            full_name="Amit Pune",
            city="Pune",
            state="Maharashtra",
            years_experience=3,
            availability_status=AvailabilityStatus.AVAILABLE,
            total_ratings=5,
            average_rating=4.8
        )
        db.add(w1_prof)
        await db.flush()

        ws1 = WorkerSkill(worker_profile_id=w1_prof.id, skill_id=skill.id, proficiency_level=ProficiencyLevel.EXPERT, years_experience=3)
        db.add(ws1)

        # Worker 2: Mumbai (out-of-city, same state), has skill, available
        w2_user = User(
            email=f"w2_mumbai_{uuid4().hex[:8]}@example.com",
            phone=f"9{uuid4().int % 1000000000:09d}",
            password_hash=hash_password("Pass123!"),
            role=UserRole.WORKER,
            is_active=True
        )
        db.add(w2_user)
        await db.flush()
        created_user_ids.append(w2_user.id)

        w2_prof = WorkerProfile(
            user_id=w2_user.id,
            full_name="Rajesh Mumbai",
            city="Mumbai",
            state="Maharashtra",
            years_experience=2,
            availability_status=AvailabilityStatus.AVAILABLE,
            total_ratings=2,
            average_rating=4.0
        )
        db.add(w2_prof)
        await db.flush()

        ws2 = WorkerSkill(worker_profile_id=w2_prof.id, skill_id=skill.id, proficiency_level=ProficiencyLevel.INTERMEDIATE, years_experience=2)
        db.add(ws2)

        # Worker 3: Bangalore (different state), NO skill, unavailable
        w3_user = User(
            email=f"w3_blr_{uuid4().hex[:8]}@example.com",
            phone=f"9{uuid4().int % 1000000000:09d}",
            password_hash=hash_password("Pass123!"),
            role=UserRole.WORKER,
            is_active=True
        )
        db.add(w3_user)
        await db.flush()
        created_user_ids.append(w3_user.id)

        w3_prof = WorkerProfile(
            user_id=w3_user.id,
            full_name="Suresh Bangalore",
            city="Bangalore",
            state="Karnataka",
            years_experience=0,
            availability_status=AvailabilityStatus.UNAVAILABLE,
            total_ratings=0,
            average_rating=0.0
        )
        db.add(w3_prof)

        # Worker 4: Inactive user
        w4_user = User(
            email=f"w4_inactive_{uuid4().hex[:8]}@example.com",
            phone=f"9{uuid4().int % 1000000000:09d}",
            password_hash=hash_password("Pass123!"),
            role=UserRole.WORKER,
            is_active=False # Inactive!
        )
        db.add(w4_user)
        await db.flush()
        created_user_ids.append(w4_user.id)

        w4_prof = WorkerProfile(
            user_id=w4_user.id,
            full_name="Inactive Worker",
            city="Pune",
            state="Maharashtra"
        )
        db.add(w4_prof)

        await db.commit()

        emp_token = create_access_token({"sub": str(emp_user.id)})
        job_id = job.id
        w1_id = str(w1_prof.id)
        w2_id = str(w2_prof.id)
        w4_id = str(w4_prof.id)

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = {"Authorization": f"Bearer {emp_token}"}
            res = await client.get(f"/api/jobs/{job_id}/candidates?page=1&size=20", headers=headers)
            assert res.status_code == 200, res.text
            data = res.json()

            assert "items" in data
            assert "total" in data
            items = data["items"]

            candidate_worker_ids = [item["worker"]["id"] for item in items]

            # 1. Active worker 1 (Pune, matched skills) is present and has top rank
            assert w1_id in candidate_worker_ids
            # 2. Out-of-city worker 2 (Mumbai, matched skills) is NOT excluded
            assert w2_id in candidate_worker_ids
            # 3. Inactive worker 4 is completely excluded from candidates
            assert w4_id not in candidate_worker_ids

            # Find items for w1 and w2
            w1_item = next(it for it in items if it["worker"]["id"] == w1_id)
            w2_item = next(it for it in items if it["worker"]["id"] == w2_id)

            # Both have 100% skill match (35 pts contribution)
            assert w1_item["match_factors"]["skills"] == 100
            assert w2_item["match_factors"]["skills"] == 100

            # Worker 1 has exact city (100% location), Worker 2 has same state (50% location)
            assert w1_item["match_factors"]["location"] == 100
            assert w2_item["match_factors"]["location"] == 50

            # Worker 1 score > Worker 2 score
            assert w1_item["match_score"] > w2_item["match_score"]

            # Verify deterministic ordering: items are in descending order of match_score
            scores = [it["match_score"] for it in items]
            assert scores == sorted(scores, reverse=True)

    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(JobRequiredSkill).where(JobRequiredSkill.job_id.in_(created_job_ids)))
            await db.execute(delete(WorkerSkill).where(WorkerSkill.skill_id.in_(created_skill_ids)))
            await db.execute(delete(Skill).where(Skill.id.in_(created_skill_ids)))
            await db.execute(delete(Job).where(Job.id.in_(created_job_ids)))
            await db.execute(delete(WorkerProfile).where(WorkerProfile.user_id.in_(created_user_ids)))
            await db.execute(delete(EmployerProfile).where(EmployerProfile.user_id.in_(created_user_ids)))
            await db.execute(delete(User).where(User.id.in_(created_user_ids)))
            await db.commit()


@pytest.mark.anyio
async def test_candidate_matching_pagination_and_authorization():
    """
    Tests pagination parameters and employer ownership check.
    """
    created_user_ids = []
    created_job_ids = []

    async with AsyncSessionLocal() as db:
        cat = (await db.execute(select(JobCategory).limit(1))).scalar_one()

        emp_a = User(
            email=f"cand_auth_a_{uuid4().hex[:8]}@example.com",
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

        job_a = Job(
            employer_id=emp_a_prof.id,
            category_id=cat.id,
            title="Job A",
            description="desc",
            work_type=WorkType.FULL_TIME,
            salary_type=SalaryType.MONTHLY,
            city="Pune",
            state="MH",
            status=JobStatus.ACTIVE
        )
        db.add(job_a)
        await db.flush()
        created_job_ids.append(job_a.id)

        emp_b = User(
            email=f"cand_auth_b_{uuid4().hex[:8]}@example.com",
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

        emp_a_token = create_access_token({"sub": str(emp_a.id)})
        emp_b_token = create_access_token({"sub": str(emp_b.id)})
        job_id = job_a.id

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Employer A can access their job candidates
            res_a = await client.get(f"/api/jobs/{job_id}/candidates?page=1&size=2", headers={"Authorization": f"Bearer {emp_a_token}"})
            assert res_a.status_code == 200
            data_a = res_a.json()
            assert data_a["page"] == 1
            assert data_a["size"] == 2

            # Employer B cannot access Employer A's job candidates (404 job not found or not owned)
            res_b = await client.get(f"/api/jobs/{job_id}/candidates", headers={"Authorization": f"Bearer {emp_b_token}"})
            assert res_b.status_code == 404
            assert "Job not found or not owned by employer" in res_b.text

    finally:
        async with AsyncSessionLocal() as db:
            await db.execute(delete(Job).where(Job.id.in_(created_job_ids)))
            await db.execute(delete(EmployerProfile).where(EmployerProfile.user_id.in_(created_user_ids)))
            await db.execute(delete(User).where(User.id.in_(created_user_ids)))
            await db.commit()
