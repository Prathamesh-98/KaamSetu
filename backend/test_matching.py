import pytest
import uuid
from decimal import Decimal
from app.services.matching_service import MatchingService
from app.models.models import WorkerProfile, Job, AvailabilityStatus, WorkType, SalaryType, WorkerSkill, JobRequiredSkill

def test_full_match():
    skill1_id = uuid.uuid4()
    skill2_id = uuid.uuid4()

    worker = WorkerProfile(
        city="Pune",
        state="Maharashtra",
        years_experience=5,
        expected_salary=Decimal("1000"),
        salary_type=SalaryType.DAILY,
        preferred_work_types=[WorkType.FULL_TIME.value, WorkType.PART_TIME.value],
        availability_status=AvailabilityStatus.AVAILABLE
    )
    worker.skills = [WorkerSkill(skill_id=skill1_id), WorkerSkill(skill_id=skill2_id)]

    job = Job(
        id=uuid.uuid4(),
        city="Pune",
        state="Maharashtra",
        experience_required=3,
        salary_min=Decimal("800"),
        salary_max=Decimal("1200"),
        salary_type=SalaryType.DAILY,
        work_type=WorkType.FULL_TIME
    )
    job.required_skills = [JobRequiredSkill(skill_id=skill1_id), JobRequiredSkill(skill_id=skill2_id)]

    match = MatchingService.calculate_match(worker, job)
    
    assert match["score"] == 100
    assert match["factors"]["skills"] == 100
    assert match["factors"]["location"] == 100
    assert match["factors"]["experience"] == 100
    assert match["factors"]["salary"] == 100
    assert match["factors"]["work_type"] == 100
    assert match["factors"]["availability"] == 100

def test_partial_match_skills_and_location():
    skill1_id = uuid.uuid4()
    skill2_id = uuid.uuid4()
    skill3_id = uuid.uuid4()

    worker = WorkerProfile(
        city="Mumbai",
        state="Maharashtra",
        years_experience=1,
        expected_salary=Decimal("2000"),
        salary_type=SalaryType.DAILY,
        preferred_work_types=[WorkType.PROJECT.value],
        availability_status=AvailabilityStatus.BUSY
    )
    worker.skills = [WorkerSkill(skill_id=skill1_id)]

    job = Job(
        id=uuid.uuid4(),
        city="Pune",
        state="Maharashtra",
        experience_required=4,
        salary_min=Decimal("800"),
        salary_max=Decimal("1200"),
        salary_type=SalaryType.DAILY,
        work_type=WorkType.FULL_TIME
    )
    job.required_skills = [JobRequiredSkill(skill_id=skill1_id), JobRequiredSkill(skill_id=skill2_id), JobRequiredSkill(skill_id=skill3_id)]

    match = MatchingService.calculate_match(worker, job)
    
    assert match["factors"]["skills"] == 33
    assert match["factors"]["location"] == 50  # Same state, different city
    assert match["factors"]["experience"] == 25 # 1/4
    assert match["factors"]["salary"] == 0 # 2000 > 1200
    assert match["factors"]["work_type"] == 0 # Mismatch
    assert match["factors"]["availability"] == 0 # Busy

def test_missing_data_strategy():
    worker = WorkerProfile(
        city=None,
        state=None,
        years_experience=0,
        expected_salary=None,
        salary_type=None,
        preferred_work_types=[],
        availability_status=AvailabilityStatus.AVAILABLE
    )
    worker.skills = []

    job = Job(
        id=uuid.uuid4(),
        city="Pune",
        state="Maharashtra",
        experience_required=0,
        salary_min=None,
        salary_max=None,
        salary_type=SalaryType.DAILY,
        work_type=WorkType.FULL_TIME
    )
    job.required_skills = []

    match = MatchingService.calculate_match(worker, job)
    
    # Missing optional worker data defaults to 100 to avoid penalization
    assert match["factors"]["skills"] == 100
    assert match["factors"]["location"] == 100
    assert match["factors"]["experience"] == 100
    assert match["factors"]["salary"] == 100
    assert match["factors"]["work_type"] == 100
    assert match["score"] == 100
