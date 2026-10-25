"""
KaamSetu — Nearby Jobs Map & Distance Filter Tests (Feature 1 Phase 2)
Tests:
- Haversine distance unit calculation and symmetry
- Commute time estimation with explicit approximation labels
- Bounding-box prefilter calculations
- Same-day IST timezone filtering logic
- Query parameter validation and HTTP 422 error cases
- Job discovery with coordinates, radius filtering, distance sorting, and fallback for legacy jobs
- Strict database isolation against kaamsetu_test
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
    calculate_bounding_box,
    get_current_date_ist,
    is_same_day_job
)

@pytest.fixture
def anyio_backend():
    return 'asyncio'

@pytest.fixture(autouse=True)
async def cleanup_engine():
    yield
    await engine.dispose()


# ─── Part 1: Distance Service Unit Tests ──────────────────────────────────────

@pytest.mark.anyio
async def test_haversine_formula_accuracy_and_symmetry():
    # 1. Identical coordinates -> 0.0 km
    assert haversine_distance_km(18.5204, 73.8567, 18.5204, 73.8567) == 0.0

    # 2. Benchmark distance: Pune (18.5196, 73.8553) to Mumbai (18.9220, 72.8347) ~116.42 km
    dist_pune_mumbai = haversine_distance_km(18.5196, 73.8553, 18.9220, 72.8347)
    assert 115.0 <= dist_pune_mumbai <= 120.0

    # 3. Symmetry check: dist(A, B) == dist(B, A)
    dist_mumbai_pune = haversine_distance_km(18.9220, 72.8347, 18.5196, 73.8553)
    assert dist_pune_mumbai == dist_mumbai_pune

    # 4. Short distance: Swargate (18.5018, 73.8636) to Saras Baug (18.5005, 73.8532) ~1.1 km
    short_dist = haversine_distance_km(18.5018, 73.8636, 18.5005, 73.8532)
    assert 0.9 <= short_dist <= 1.3

    # 5. Domain boundary clamp check: North Pole to South Pole
    pole_dist = haversine_distance_km(90.0, 0.0, -90.0, 0.0)
    assert 20000.0 <= pole_dist <= 20050.0


@pytest.mark.anyio
async def test_commute_time_estimation():
    # 1. Missing distance returns None
    assert estimate_travel_time(None) is None

    # 2. Short walking trips (< 1 km)
    walk_est = estimate_travel_time(0.5)
    assert "walk" in walk_est
    assert "(approx.)" in walk_est

    # 3. Moderate urban transit (1 to 15 km)
    transit_est = estimate_travel_time(5.0)
    assert "transit" in transit_est
    assert "(approx.)" in transit_est

    # 4. Longer transit (>= 60 minutes equivalent)
    long_est = estimate_travel_time(30.0)
    assert "transit" in long_est
    assert "h" in long_est
    assert "(approx.)" in long_est


@pytest.mark.anyio
async def test_bounding_box_coverage():
    center_lat, center_lon = 18.5204, 73.8567
    radius = 10.0  # km
    min_lat, max_lat, min_lon, max_lon = calculate_bounding_box(center_lat, center_lon, radius)

    # Box encompasses center
    assert min_lat < center_lat < max_lat
    assert min_lon < center_lon < max_lon

    # Points at the edges of the bounding box should be at least as far as the radius
    lat_edge_dist = haversine_distance_km(center_lat, center_lon, max_lat, center_lon)
    lon_edge_dist = haversine_distance_km(center_lat, center_lon, center_lat, max_lon)
    assert lat_edge_dist >= 9.9
    assert lon_edge_dist >= 9.9


@pytest.mark.anyio
async def test_same_day_logic_ist():
    today = get_current_date_ist()
    tomorrow = today + timedelta(days=1)
    yesterday = today - timedelta(days=1)

    # 1. Start date is today -> True
    assert is_same_day_job(today, WorkType.FULL_TIME, is_urgent=False, reference_date=today) is True

    # 2. Start date is tomorrow -> False
    assert is_same_day_job(tomorrow, WorkType.FULL_TIME, is_urgent=False, reference_date=today) is False

    # 3. Urgent daily job active today (no start date) -> True
    assert is_same_day_job(None, WorkType.DAILY, is_urgent=True, reference_date=today) is True

    # 4. Urgent hourly job active today (start date <= today) -> True
    assert is_same_day_job(yesterday, WorkType.HOURLY, is_urgent=True, reference_date=today) is True

    # 5. Non-urgent daily job without start date -> False
    assert is_same_day_job(None, WorkType.DAILY, is_urgent=False, reference_date=today) is False


# ─── Part 2: Query Parameter Validation (HTTP 422) ─────────────────────────────

@pytest.mark.anyio
async def test_validation_radius_without_coordinates():
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_user_id})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # radius_km provided without coordinates
        res = await ac.get("/api/jobs?radius_km=15.0", headers=headers)
        assert res.status_code == 422
        assert "Both worker_lat and worker_lng are required" in res.json()["detail"]


@pytest.mark.anyio
async def test_validation_incomplete_coordinates():
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_user_id})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # worker_lat provided without worker_lng
        res1 = await ac.get("/api/jobs?worker_lat=18.5204", headers=headers)
        assert res1.status_code == 422
        assert "Both worker_lat and worker_lng must be provided together" in res1.json()["detail"]

        # worker_lng provided without worker_lat
        res2 = await ac.get("/api/jobs?worker_lng=73.8567", headers=headers)
        assert res2.status_code == 422
        assert "Both worker_lat and worker_lng must be provided together" in res2.json()["detail"]


@pytest.mark.anyio
async def test_validation_out_of_bounds_values():
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_user_id})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Latitude > 90
        res1 = await ac.get("/api/jobs?worker_lat=95.0&worker_lng=73.8", headers=headers)
        assert res1.status_code == 422

        # Latitude < -90
        res2 = await ac.get("/api/jobs?worker_lat=-91.0&worker_lng=73.8", headers=headers)
        assert res2.status_code == 422

        # Longitude > 180
        res3 = await ac.get("/api/jobs?worker_lat=18.5&worker_lng=181.0", headers=headers)
        assert res3.status_code == 422

        # Radius > 100 km
        res4 = await ac.get("/api/jobs?worker_lat=18.5&worker_lng=73.8&radius_km=150.0", headers=headers)
        assert res4.status_code == 422

        # Radius <= 0 km
        res5 = await ac.get("/api/jobs?worker_lat=18.5&worker_lng=73.8&radius_km=0", headers=headers)
        assert res5.status_code == 422


@pytest.mark.anyio
async def test_validation_distance_sort_without_coords():
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_user_id})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/jobs?sort_by=distance_asc", headers=headers)
        assert res.status_code == 422
        assert "worker_lat and worker_lng are required when sorting by distance" in res.json()["detail"]


# ─── Part 3: Integration Tests with Test Database Fixture ───────────────────────

@pytest.fixture
async def nearby_test_jobs():
    """
    Creates 4 isolated test jobs in kaamsetu_test and cleans them up after the test.
    - Job 1: Swargate (Pune), active today, daily, urgent (lat=18.5018, lng=73.8636)
    - Job 2: Kothrud (Pune), ~5.9 km away, full time, start_date=today+7 (lat=18.5074, lng=73.8077)
    - Job 3: Mumbai CST, ~119 km away, daily (lat=18.9401, lng=72.8354)
    - Job 4: Legacy job with NULL coordinates
    """
    created_job_ids = []
    today = get_current_date_ist()

    async with AsyncSessionLocal() as session:
        # Find an existing employer and active category
        emp = (await session.execute(select(EmployerProfile))).scalars().first()
        cat = (await session.execute(select(JobCategory).where(JobCategory.is_active == True))).scalars().first()
        assert emp is not None, "Test database must contain an employer profile"
        assert cat is not None, "Test database must contain an active category"

        # 1. Swargate job
        j1 = Job(
            id=uuid4(),
            employer_id=emp.id,
            category_id=cat.id,
            title="TEST_NEARBY_SWARGATE_JOB",
            description="Nearby Swargate Test Job",
            work_type=WorkType.DAILY,
            status=JobStatus.ACTIVE,
            city="Pune",
            state="Maharashtra",
            latitude=18.5018,
            longitude=73.8636,
            address_detail="Swargate Bus Station",
            salary_min=500.0,
            salary_max=800.0,
            salary_type=SalaryType.DAILY,
            is_urgent=True,
            start_date=today,
        )
        # 2. Kothrud job (~5.9 km from Swargate)
        j2 = Job(
            id=uuid4(),
            employer_id=emp.id,
            category_id=cat.id,
            title="TEST_NEARBY_KOTHRUD_JOB",
            description="Kothrud Test Job",
            work_type=WorkType.FULL_TIME,
            status=JobStatus.ACTIVE,
            city="Pune",
            state="Maharashtra",
            latitude=18.5074,
            longitude=73.8077,
            address_detail="Kothrud Stand",
            salary_min=15000.0,
            salary_max=20000.0,
            salary_type=SalaryType.MONTHLY,
            is_urgent=False,
            start_date=today + timedelta(days=7),
        )
        # 3. Mumbai CST job (~119 km away)
        j3 = Job(
            id=uuid4(),
            employer_id=emp.id,
            category_id=cat.id,
            title="TEST_NEARBY_MUMBAI_JOB",
            description="Mumbai Test Job",
            work_type=WorkType.DAILY,
            status=JobStatus.ACTIVE,
            city="Mumbai",
            state="Maharashtra",
            latitude=18.9401,
            longitude=72.8354,
            address_detail="CST Platform 1",
            salary_min=600.0,
            salary_max=900.0,
            salary_type=SalaryType.DAILY,
            is_urgent=False,
            start_date=today,
        )
        # 4. Legacy job (no coordinates)
        j4 = Job(
            id=uuid4(),
            employer_id=emp.id,
            category_id=cat.id,
            title="TEST_LEGACY_NO_COORDS_JOB",
            description="Legacy Job without coordinates",
            work_type=WorkType.DAILY,
            status=JobStatus.ACTIVE,
            city="Pune",
            state="Maharashtra",
            latitude=None,
            longitude=None,
            address_detail=None,
            salary_min=450.0,
            salary_max=700.0,
            salary_type=SalaryType.DAILY,
            is_urgent=False,
            start_date=today,
        )

        session.add_all([j1, j2, j3, j4])
        await session.commit()
        created_job_ids = [j1.id, j2.id, j3.id, j4.id]

    yield {
        "j1_id": str(created_job_ids[0]),
        "j2_id": str(created_job_ids[1]),
        "j3_id": str(created_job_ids[2]),
        "j4_id": str(created_job_ids[3]),
    }

    # Teardown: delete test jobs
    async with AsyncSessionLocal() as session:
        await session.execute(delete(Job).where(Job.id.in_(created_job_ids)))
        await session.commit()


@pytest.mark.anyio
async def test_legacy_jobs_unaffected_when_no_coords(nearby_test_jobs):
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_user_id})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/jobs?keyword=TEST_", headers=headers)
        assert res.status_code == 200
        data = res.json()
        item_ids = [item["id"] for item in data["items"]]

        # All 4 test jobs returned
        assert nearby_test_jobs["j1_id"] in item_ids
        assert nearby_test_jobs["j2_id"] in item_ids
        assert nearby_test_jobs["j3_id"] in item_ids
        assert nearby_test_jobs["j4_id"] in item_ids

        # Without worker coordinates, distance_km and travel time must be None
        for item in data["items"]:
            if item["id"] in nearby_test_jobs.values():
                assert item["distance_km"] is None
                assert item["estimated_travel_time"] is None


@pytest.mark.anyio
async def test_coordinates_provided_without_radius(nearby_test_jobs):
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_user_id})
    headers = {"Authorization": f"Bearer {token}"}

    # Worker located at Swargate (18.5018, 73.8636)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get(
            "/api/jobs?keyword=TEST_&worker_lat=18.5018&worker_lng=73.8636",
            headers=headers
        )
        assert res.status_code == 200
        items_by_id = {item["id"]: item for item in res.json()["items"]}

        # Job 1 (Swargate) -> distance ~ 0.0 km
        j1 = items_by_id[nearby_test_jobs["j1_id"]]
        assert j1["distance_km"] == 0.0
        assert j1["estimated_travel_time"] is not None
        assert "walk" in j1["estimated_travel_time"]

        # Job 2 (Kothrud) -> distance ~ 5.92 km
        j2 = items_by_id[nearby_test_jobs["j2_id"]]
        assert 5.5 <= j2["distance_km"] <= 6.5
        assert "transit" in j2["estimated_travel_time"]

        # Job 3 (Mumbai) -> distance ~ 119 km
        j3 = items_by_id[nearby_test_jobs["j3_id"]]
        assert 115.0 <= j3["distance_km"] <= 125.0
        assert "transit" in j3["estimated_travel_time"]

        # Job 4 (Legacy, no coords) -> None
        j4 = items_by_id[nearby_test_jobs["j4_id"]]
        assert j4["distance_km"] is None
        assert j4["estimated_travel_time"] is None


@pytest.mark.anyio
async def test_radius_filtering(nearby_test_jobs):
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_user_id})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Search radius 10 km from Swargate:
        # - Job 1 (0 km) matches
        # - Job 2 (~5.9 km) matches
        # - Job 3 (~119 km) excluded
        # - Job 4 (no coords) excluded
        res_10km = await ac.get(
            "/api/jobs?keyword=TEST_&worker_lat=18.5018&worker_lng=73.8636&radius_km=10.0",
            headers=headers
        )
        assert res_10km.status_code == 200
        ids_10km = [item["id"] for item in res_10km.json()["items"]]
        assert nearby_test_jobs["j1_id"] in ids_10km
        assert nearby_test_jobs["j2_id"] in ids_10km
        assert nearby_test_jobs["j3_id"] not in ids_10km
        assert nearby_test_jobs["j4_id"] not in ids_10km

        # Search radius 2 km from Swargate:
        # - Job 1 (0 km) matches
        # - Job 2 (~5.9 km) excluded
        res_2km = await ac.get(
            "/api/jobs?keyword=TEST_&worker_lat=18.5018&worker_lng=73.8636&radius_km=2.0",
            headers=headers
        )
        assert res_2km.status_code == 200
        ids_2km = [item["id"] for item in res_2km.json()["items"]]
        assert nearby_test_jobs["j1_id"] in ids_2km
        assert nearby_test_jobs["j2_id"] not in ids_2km


@pytest.mark.anyio
async def test_sort_by_distance_ascending(nearby_test_jobs):
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_user_id})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get(
            "/api/jobs?keyword=TEST_&worker_lat=18.5018&worker_lng=73.8636&sort_by=distance_asc",
            headers=headers
        )
        assert res.status_code == 200
        items = [i for i in res.json()["items"] if i["id"] in nearby_test_jobs.values()]

        # Ordered: Job 1 (0.0 km) -> Job 2 (~5.9 km) -> Job 3 (~119 km) -> Job 4 (None last)
        assert items[0]["id"] == nearby_test_jobs["j1_id"]
        assert items[1]["id"] == nearby_test_jobs["j2_id"]
        assert items[2]["id"] == nearby_test_jobs["j3_id"]
        assert items[3]["id"] == nearby_test_jobs["j4_id"]


@pytest.mark.anyio
async def test_same_day_filtering(nearby_test_jobs):
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_user_id})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/jobs?keyword=TEST_&same_day=true", headers=headers)
        assert res.status_code == 200
        ids = [item["id"] for item in res.json()["items"]]

        # Job 1 (start_date=today, urgent daily) -> included
        assert nearby_test_jobs["j1_id"] in ids
        # Job 3 (start_date=today) -> included
        assert nearby_test_jobs["j3_id"] in ids
        # Job 4 (start_date=today) -> included
        assert nearby_test_jobs["j4_id"] in ids
        # Job 2 (start_date=today+7, full-time non-urgent) -> excluded
        assert nearby_test_jobs["j2_id"] not in ids


@pytest.mark.anyio
async def test_combined_radius_and_same_day(nearby_test_jobs):
    worker_user_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_user_id})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Search radius 10 km from Swargate + same_day=true
        # Job 1: 0 km AND same_day -> MATCH
        # Job 2: 5.9 km but NOT same_day -> EXCLUDED
        # Job 3: 119 km (out of radius) -> EXCLUDED
        # Job 4: No coords -> EXCLUDED
        res = await ac.get(
            "/api/jobs?keyword=TEST_&worker_lat=18.5018&worker_lng=73.8636&radius_km=10.0&same_day=true",
            headers=headers
        )
        assert res.status_code == 200
        matching_ids = [item["id"] for item in res.json()["items"] if item["id"] in nearby_test_jobs.values()]
        assert matching_ids == [nearby_test_jobs["j1_id"]]
