"""
KaamSetu — Profile Lifecycle Unit & Schema Tests
Verifies the exact schema and lifecycle constraints for Worker and Employer profiles:
1. Newly registered worker profile creation (POST payload schema validation)
2. Worker profile update (PUT payload schema validation)
3. Newly registered employer profile creation (POST payload schema validation)
4. Employer profile update (PUT payload schema validation)
5. WorkerProfileResponse serialization and default fields
6. EmployerProfileResponse serialization and default fields
"""
import uuid
from datetime import datetime, timezone
from app.schemas.schemas import (
    WorkerProfileCreate,
    WorkerProfileUpdate,
    WorkerProfileResponse,
    EmployerProfileCreate,
    EmployerProfileUpdate,
    EmployerProfileResponse,
)
from app.models.models import AvailabilityStatus, SalaryType

def test_worker_profile_create_schema():
    payload = WorkerProfileCreate(
        full_name="Rajesh Sharma",
        city="Bengaluru",
        state="Karnataka",
        bio="Experienced master electrician with 8 years in commercial installations.",
        expected_salary=950.0,
        salary_type=SalaryType.DAILY,
        years_experience=8,
        availability_status=AvailabilityStatus.AVAILABLE,
        preferred_work_types=["DAILY", "PROJECT"],
    )
    dump = payload.model_dump()
    assert dump["full_name"] == "Rajesh Sharma"
    assert dump["city"] == "Bengaluru"
    assert dump["state"] == "Karnataka"
    assert dump["expected_salary"] == 950.0
    assert dump["years_experience"] == 8
    assert dump["availability_status"] == AvailabilityStatus.AVAILABLE
    assert dump["preferred_work_types"] == ["DAILY", "PROJECT"]

def test_worker_profile_update_schema():
    payload = WorkerProfileUpdate(
        expected_salary=1100.0,
        availability_status=AvailabilityStatus.BUSY,
        bio="Updated bio after project completion.",
    )
    dump = payload.model_dump(exclude_unset=True)
    assert dump["expected_salary"] == 1100.0
    assert dump["availability_status"] == AvailabilityStatus.BUSY
    assert "full_name" not in dump  # Unset fields excluded from PUT payload

def test_employer_profile_create_schema():
    payload = EmployerProfileCreate(
        full_name="Anita Desai",
        organization_name="Bangalore Construction Tech LLP",
        organization_type="Private Limited",
        city="Bengaluru",
        state="Karnataka",
        bio="Leading commercial real estate developer in South India.",
        website="https://bctech.example.com",
    )
    dump = payload.model_dump()
    assert dump["full_name"] == "Anita Desai"
    assert dump["organization_name"] == "Bangalore Construction Tech LLP"
    assert dump["organization_type"] == "Private Limited"
    assert dump["city"] == "Bengaluru"
    assert dump["state"] == "Karnataka"

def test_employer_profile_update_schema():
    payload = EmployerProfileUpdate(
        full_name="Vikram Rao",
        bio="Updated enterprise profile bio with expansion to Pune.",
    )
    dump = payload.model_dump(exclude_unset=True)
    assert dump["full_name"] == "Vikram Rao"
    assert "organization_name" not in dump

def test_worker_profile_response_structure():
    pid = uuid.uuid4()
    uid = uuid.uuid4()
    now = datetime.now(timezone.utc)
    
    # Verify response schema accepts all model attributes
    resp = WorkerProfileResponse(
        id=pid,
        user_id=uid,
        full_name="Sunil Patil",
        profile_image_url="https://storage.kaamsetu.in/avatars/sunil.jpg",
        bio="Skilled plumber and pipefitter",
        city="Pune",
        state="Maharashtra",
        latitude=18.5204,
        longitude=73.8567,
        years_experience=5,
        expected_salary=800.0,
        salary_type=SalaryType.DAILY,
        availability_status=AvailabilityStatus.AVAILABLE,
        preferred_work_types=["DAILY", "FULL_TIME"],
        is_phone_verified=True,
        is_identity_verified=True,
        average_rating=4.8,
        total_ratings=24,
        job_alerts_enabled=True,
        skills=[],
        created_at=now,
        updated_at=now,
    )
    assert resp.id == pid
    assert resp.full_name == "Sunil Patil"
    assert resp.is_identity_verified is True
    assert resp.average_rating == 4.8

def test_employer_profile_response_structure():
    eid = uuid.uuid4()
    uid = uuid.uuid4()
    now = datetime.now(timezone.utc)
    
    resp = EmployerProfileResponse(
        id=eid,
        user_id=uid,
        full_name="Ramesh Kulkarni",
        organization_name="Apex Infrastructure Pvt Ltd",
        organization_type="Private Limited",
        profile_image_url="https://storage.kaamsetu.in/logos/apex.png",
        bio="Heavy infrastructure and bridge construction firm",
        city="Mumbai",
        state="Maharashtra",
        website="https://apexinfra.example.com",
        latitude=18.9220,
        longitude=72.8347,
        is_verified=True,
        average_rating=4.9,
        total_ratings=18,
        job_alerts_enabled=True,
        created_at=now,
        updated_at=now,
    )
    assert resp.id == eid
    assert resp.organization_name == "Apex Infrastructure Pvt Ltd"
    assert resp.is_verified is True


if __name__ == "__main__":
    test_worker_profile_create_schema()
    test_worker_profile_update_schema()
    test_employer_profile_create_schema()
    test_employer_profile_update_schema()
    test_worker_profile_response_structure()
    test_employer_profile_response_structure()
    print("ALL 6 PROFILE LIFECYCLE SCHEMA & UNIT TESTS PASSED SUCCESSFULLY!")
