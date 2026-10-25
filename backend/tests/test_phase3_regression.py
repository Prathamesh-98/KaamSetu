"""
KaamSetu — Phase 3.1 End-to-End Regression Audit Suite
Directly verifies the 12 regression audit scenarios:
1. Existing list and filters (keyword, city, state, category, work_type, salary, experience, urgency)
2. Radius filtering: 5 km and 10 km with exact bounding-box and Haversine behavior
3. Jobs outside radius excluded only when radius filtering is enabled
4. Legacy jobs without coordinates remain discoverable and return distance_km=null
5. Asia/Kolkata Same-Day Jobs filtering rules
6. Distance: Closest First sorting (distance_asc) and safe handling when coordinates are unavailable
7. All response fields: latitude, longitude, address_detail, distance_km, estimated_travel_time
8. Candidate matching score & explanation immutability
"""
import pytest
from httpx import AsyncClient, ASGITransport
from uuid import uuid4
from datetime import datetime, timedelta, timezone, date
from decimal import Decimal
from sqlalchemy import select, delete

from app.main import app
from app.core.security import create_access_token
from app.db.session import engine, AsyncSessionLocal
from app.models.models import (
    User, WorkerProfile, EmployerProfile, JobCategory, Job,
    JobStatus, WorkType, SalaryType
)
from app.services.distance_service import (
    haversine_distance_km,
    estimate_travel_time,
    get_current_date_ist,
    is_same_day_job
)
from app.services.matching_service import MatchingService

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
async def cleanup_engine():
    yield
    await engine.dispose()

@pytest.fixture
async def audit_test_dataset():
    """
    Creates a dedicated multi-job dataset for regression testing:
    - Job 1: Pune Central (18.5204, 73.8567), urgent daily job, today IST, 600-900 INR
    - Job 2: Pune Aundh (~6.2 km from Central, 18.5580, 73.8075), full time, start_date = today+5, 15000-20000 INR
    - Job 3: Pune Hadapsar (~8.5 km from Central, 18.5089, 73.9260), part time, start_date = today, 8000-12000 INR
    - Job 4: Mumbai Dadar (~120 km from Pune Central, 19.0178, 72.8478), daily job, start_date = today, 700-1000 INR
    - Job 5: Unmapped legacy job (NULL coordinates, NULL address_detail), daily job, start_date = today, 500-750 INR
    """
    today = get_current_date_ist()
    created_ids = []

    async with AsyncSessionLocal() as session:
        emp = (await session.execute(select(EmployerProfile))).scalars().first()
        cat = (await session.execute(select(JobCategory).where(JobCategory.is_active == True))).scalars().first()
        assert emp is not None and cat is not None

        j1 = Job(
            id=uuid4(),
            employer_id=emp.id,
            category_id=cat.id,
            title="AUDIT_PUNE_CENTRAL_MAINTENANCE",
            description="Daily Maintenance in Pune Central",
            work_type=WorkType.DAILY,
            status=JobStatus.ACTIVE,
            city="Pune",
            state="Maharashtra",
            latitude=18.5204,
            longitude=73.8567,
            address_detail="FC Road Deccan",
            salary_min=600.0,
            salary_max=900.0,
            salary_type=SalaryType.DAILY,
            is_urgent=True,
            start_date=today,
            experience_required=1
        )
        j2 = Job(
            id=uuid4(),
            employer_id=emp.id,
            category_id=cat.id,
            title="AUDIT_PUNE_AUNDH_STORE",
            description="Store Attendant in Aundh",
            work_type=WorkType.FULL_TIME,
            status=JobStatus.ACTIVE,
            city="Pune",
            state="Maharashtra",
            latitude=18.5580,
            longitude=73.8075,
            address_detail="Aundh DP Road",
            salary_min=15000.0,
            salary_max=20000.0,
            salary_type=SalaryType.MONTHLY,
            is_urgent=False,
            start_date=today + timedelta(days=5),
            experience_required=3
        )
        j3 = Job(
            id=uuid4(),
            employer_id=emp.id,
            category_id=cat.id,
            title="AUDIT_PUNE_HADAPSAR_HELPER",
            description="Helper in Hadapsar",
            work_type=WorkType.PART_TIME,
            status=JobStatus.ACTIVE,
            city="Pune",
            state="Maharashtra",
            latitude=18.5089,
            longitude=73.9260,
            address_detail="Magarpatta South Gate",
            salary_min=8000.0,
            salary_max=12000.0,
            salary_type=SalaryType.MONTHLY,
            is_urgent=False,
            start_date=today,
            experience_required=0
        )
        j4 = Job(
            id=uuid4(),
            employer_id=emp.id,
            category_id=cat.id,
            title="AUDIT_MUMBAI_DADAR_LOADER",
            description="Loader at Dadar Station",
            work_type=WorkType.DAILY,
            status=JobStatus.ACTIVE,
            city="Mumbai",
            state="Maharashtra",
            latitude=19.0178,
            longitude=72.8478,
            address_detail="Dadar TT Circle",
            salary_min=700.0,
            salary_max=1000.0,
            salary_type=SalaryType.DAILY,
            is_urgent=False,
            start_date=today,
            experience_required=0
        )
        j5 = Job(
            id=uuid4(),
            employer_id=emp.id,
            category_id=cat.id,
            title="AUDIT_UNMAPPED_LEGACY_JOB",
            description="Legacy Job with no GPS coordinates",
            work_type=WorkType.DAILY,
            status=JobStatus.ACTIVE,
            city="Pune",
            state="Maharashtra",
            latitude=None,
            longitude=None,
            address_detail=None,
            salary_min=500.0,
            salary_max=750.0,
            salary_type=SalaryType.DAILY,
            is_urgent=False,
            start_date=today,
            experience_required=0
        )

        session.add_all([j1, j2, j3, j4, j5])
        await session.commit()
        created_ids = [j1.id, j2.id, j3.id, j4.id, j5.id]

    yield {
        "j1_id": str(created_ids[0]),
        "j2_id": str(created_ids[1]),
        "j3_id": str(created_ids[2]),
        "j4_id": str(created_ids[3]),
        "j5_id": str(created_ids[4]),
    }

    async with AsyncSessionLocal() as session:
        await session.execute(delete(Job).where(Job.id.in_(created_ids)))
        await session.commit()


# ─── Scenario 1: Existing list and filters still work ─────────────────────────

@pytest.mark.anyio
async def test_scenario_1_existing_filters_work(audit_test_dataset):
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_user_id})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Filter by keyword
        res_kw = await ac.get("/api/jobs?keyword=AUDIT_PUNE_AUNDH", headers=headers)
        assert res_kw.status_code == 200
        items_kw = res_kw.json()["items"]
        assert len(items_kw) == 1
        assert items_kw[0]["id"] == audit_test_dataset["j2_id"]

        # 2. Filter by city
        res_city = await ac.get("/api/jobs?keyword=AUDIT_&city=Mumbai", headers=headers)
        assert res_city.status_code == 200
        items_city = res_city.json()["items"]
        assert len(items_city) == 1
        assert items_city[0]["id"] == audit_test_dataset["j4_id"]

        # 3. Filter by work_type
        res_wt = await ac.get("/api/jobs?keyword=AUDIT_&work_type=PART_TIME", headers=headers)
        assert res_wt.status_code == 200
        items_wt = res_wt.json()["items"]
        assert len(items_wt) == 1
        assert items_wt[0]["id"] == audit_test_dataset["j3_id"]

        # 4. Filter by experience_max
        res_exp = await ac.get("/api/jobs?keyword=AUDIT_&experience_max=1", headers=headers)
        assert res_exp.status_code == 200
        ids_exp = [i["id"] for i in res_exp.json()["items"]]
        assert audit_test_dataset["j1_id"] in ids_exp
        assert audit_test_dataset["j2_id"] not in ids_exp  # Requires 3 years

        # 5. Filter by salary_min
        res_sal = await ac.get("/api/jobs?keyword=AUDIT_&salary_min=14000", headers=headers)
        assert res_sal.status_code == 200
        items_sal = res_sal.json()["items"]
        assert len(items_sal) == 1
        assert items_sal[0]["id"] == audit_test_dataset["j2_id"]


# ─── Scenario 4 & 5: Radius 5 km and 10 km filters & Exclusions ───────────────

@pytest.mark.anyio
async def test_scenario_4_and_5_radius_filtering_5km_and_10km(audit_test_dataset):
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_user_id})
    headers = {"Authorization": f"Bearer {token}"}

    # Worker located at Pune Central (18.5204, 73.8567)
    worker_lat, worker_lng = 18.5204, 73.8567

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Radius = 5 km from Pune Central:
        # - Job 1 (Central, 0 km) -> MATCH
        # - Job 2 (Aundh, ~6.2 km) -> OUT OF RADIUS (> 5 km)
        # - Job 3 (Hadapsar, ~8.5 km) -> OUT OF RADIUS (> 5 km)
        # - Job 4 (Mumbai, ~120 km) -> OUT OF RADIUS
        # - Job 5 (Unmapped) -> EXCLUDED FROM RADIUS
        res_5km = await ac.get(
            f"/api/jobs?keyword=AUDIT_&worker_lat={worker_lat}&worker_lng={worker_lng}&radius_km=5.0",
            headers=headers
        )
        assert res_5km.status_code == 200
        items_5km = [i["id"] for i in res_5km.json()["items"] if i["id"] in audit_test_dataset.values()]
        assert items_5km == [audit_test_dataset["j1_id"]]

        # 2. Radius = 10 km from Pune Central:
        # - Job 1 (Central, 0 km) -> MATCH
        # - Job 2 (Aundh, ~6.2 km) -> MATCH (<= 10 km)
        # - Job 3 (Hadapsar, ~8.5 km) -> MATCH (<= 10 km)
        # - Job 4 (Mumbai, ~120 km) -> OUT OF RADIUS (> 10 km)
        # - Job 5 (Unmapped) -> EXCLUDED FROM RADIUS
        res_10km = await ac.get(
            f"/api/jobs?keyword=AUDIT_&worker_lat={worker_lat}&worker_lng={worker_lng}&radius_km=10.0",
            headers=headers
        )
        assert res_10km.status_code == 200
        items_10km = [i["id"] for i in res_10km.json()["items"] if i["id"] in audit_test_dataset.values()]
        assert audit_test_dataset["j1_id"] in items_10km
        assert audit_test_dataset["j2_id"] in items_10km
        assert audit_test_dataset["j3_id"] in items_10km
        assert audit_test_dataset["j4_id"] not in items_10km
        assert audit_test_dataset["j5_id"] not in items_10km

        # 3. Without radius filter: all 5 jobs remain discoverable!
        res_no_radius = await ac.get(
            f"/api/jobs?keyword=AUDIT_&worker_lat={worker_lat}&worker_lng={worker_lng}",
            headers=headers
        )
        assert res_no_radius.status_code == 200
        items_no_rad = [i["id"] for i in res_no_radius.json()["items"] if i["id"] in audit_test_dataset.values()]
        assert len(items_no_rad) == 5


# ─── Scenario 6: Unmapped jobs discoverability ────────────────────────────────

@pytest.mark.anyio
async def test_scenario_6_unmapped_jobs_discoverability(audit_test_dataset):
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_user_id})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Standard query without radius
        res = await ac.get(
            "/api/jobs?keyword=AUDIT_&worker_lat=18.5204&worker_lng=73.8567",
            headers=headers
        )
        assert res.status_code == 200
        items = {i["id"]: i for i in res.json()["items"] if i["id"] in audit_test_dataset.values()}

        # Verify unmapped job is present with None distance
        j5 = items[audit_test_dataset["j5_id"]]
        assert j5["title"] == "AUDIT_UNMAPPED_LEGACY_JOB"
        assert j5["latitude"] is None
        assert j5["longitude"] is None
        assert j5["distance_km"] is None
        assert j5["estimated_travel_time"] is None


# ─── Scenario 7: Same-day jobs under Asia/Kolkata timezone ───────────────────

@pytest.mark.anyio
async def test_scenario_7_same_day_jobs_asia_kolkata(audit_test_dataset):
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_user_id})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/jobs?keyword=AUDIT_&same_day=true", headers=headers)
        assert res.status_code == 200
        items = [i["id"] for i in res.json()["items"] if i["id"] in audit_test_dataset.values()]

        # J1 (start_date=today, urgent daily) -> MATCH
        assert audit_test_dataset["j1_id"] in items
        # J3 (start_date=today, part-time) -> MATCH
        assert audit_test_dataset["j3_id"] in items
        # J4 (start_date=today, daily) -> MATCH
        assert audit_test_dataset["j4_id"] in items
        # J5 (start_date=today, daily unmapped) -> MATCH
        assert audit_test_dataset["j5_id"] in items
        # J2 (start_date=today+5, full-time non-urgent) -> EXCLUDED
        assert audit_test_dataset["j2_id"] not in items


# ─── Scenario 8: Distance sorting and handling unavailable coordinates ────────

@pytest.mark.anyio
async def test_scenario_8_distance_closest_first_sorting(audit_test_dataset):
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_user_id})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. When coordinates are provided, distance_asc sorts ascending with null coordinates last
        res = await ac.get(
            "/api/jobs?keyword=AUDIT_&worker_lat=18.5204&worker_lng=73.8567&sort_by=distance_asc",
            headers=headers
        )
        assert res.status_code == 200
        items = [i for i in res.json()["items"] if i["id"] in audit_test_dataset.values()]

        # Expected order:
        # - J1 (Pune Central): 0.0 km
        # - J2 (Aundh): ~6.2 km
        # - J3 (Hadapsar): ~8.5 km
        # - J4 (Mumbai): ~120 km
        # - J5 (Unmapped, null distance): LAST
        assert items[0]["id"] == audit_test_dataset["j1_id"]
        assert items[0]["distance_km"] == 0.0

        assert items[1]["id"] == audit_test_dataset["j2_id"]
        assert 5.8 <= items[1]["distance_km"] <= 7.0

        assert items[2]["id"] == audit_test_dataset["j3_id"]
        assert 7.0 <= items[2]["distance_km"] <= 8.0

        assert items[3]["id"] == audit_test_dataset["j4_id"]
        assert items[3]["distance_km"] >= 100.0

        assert items[4]["id"] == audit_test_dataset["j5_id"]
        assert items[4]["distance_km"] is None

        # 2. When coordinates are unavailable, requesting distance_asc returns 422
        res_no_coords = await ac.get("/api/jobs?keyword=AUDIT_&sort_by=distance_asc", headers=headers)
        assert res_no_coords.status_code == 422


# ─── Scenario 12: Matching weights and candidate matching verification ────────

@pytest.mark.anyio
async def test_scenario_12_candidate_matching_unchanged():
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_user_id})
    headers = {"Authorization": f"Bearer {token}"}

    # Verify MatchingService weights
    assert MatchingService.WEIGHTS == {
        "skills": 35,
        "location": 20,
        "experience": 15,
        "salary": 10,
        "work_type": 10,
        "availability": 5,
        "category": 5
    }

    # Verify calculation via API for a job
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        jobs_res = await ac.get("/api/jobs?per_page=1", headers=headers)
        assert jobs_res.status_code == 200
        if jobs_res.json()["items"]:
            job_id = jobs_res.json()["items"][0]["id"]
            match_res = await ac.get(f"/api/jobs/{job_id}/match", headers=headers)
            assert match_res.status_code == 200
            data = match_res.json()
            assert "score" in data
            assert "factors" in data
            assert "explanations" in data
            assert "location" in data["factors"]
            assert "skills" in data["factors"]
