import uuid
from datetime import datetime, timezone
from app.schemas.schemas import AdminStats, VerificationRecordResponse, AdminWorkerListItem, AdminEmployerListItem
from app.models.models import User, UserRole, WorkerProfile, EmployerProfile, VerificationRecord, VerificationType, VerificationStatus

def test_admin_stats_schema():
    stats = AdminStats(
        total_users=10,
        total_workers=6,
        total_employers=4,
        active_jobs=3,
        total_jobs=5,
        total_applications=8,
        completed_jobs=2,
        pending_verifications=1,
    )
    assert stats.pending_verifications == 1
    assert stats.total_workers == 6

def test_verification_record_response_with_user():
    class DummyUser:
        id = uuid.uuid4()
        email = "worker@example.com"
        phone = "+919876543210"
        role = UserRole.WORKER
        worker_profile = WorkerProfile(id=uuid.uuid4(), full_name="Ramesh Kumar")
        employer_profile = None
        admin_profile = None

    class DummyRecord:
        id = uuid.uuid4()
        user_id = DummyUser.id
        verification_type = VerificationType.IDENTITY
        status = VerificationStatus.PENDING
        effective_status = VerificationStatus.PENDING
        document_type = "DRIVING_LICENSE"
        document_url = "private://identity/doc1.pdf"
        rejection_reason = None
        expires_at = None
        verified_by = None
        verified_at = None
        created_at = datetime.now(timezone.utc)
        metadata_dict = {"document_type": "DRIVING_LICENSE"}
        user = DummyUser

    resp = VerificationRecordResponse.from_orm_record(DummyRecord)
    assert resp.user_name == "Ramesh Kumar"
    assert resp.user_email == "worker@example.com"
    assert resp.user_role == "WORKER"
    assert resp.user_phone == "+919876543210"
    assert resp.has_document is True

def test_admin_worker_incomplete_profile_item():
    u_id = uuid.uuid4()
    item = AdminWorkerListItem(
        id=u_id,
        user_id=u_id,
        full_name="New Registered Worker",
        phone=None,
        email="newworker@example.com",
        bio=None,
        city=None,
        state=None,
        experience_years=None,
        hourly_rate=None,
        daily_rate=None,
        is_verified=False,
        is_identity_verified=False,
        is_phone_verified=False,
        is_active=True,
        skills=[],
        created_at=datetime.now(timezone.utc),
    )
    assert item.full_name == "New Registered Worker"
    assert item.is_verified is False
    assert item.skills == []

def test_admin_employer_incomplete_profile_item():
    u_id = uuid.uuid4()
    item = AdminEmployerListItem(
        id=u_id,
        user_id=u_id,
        full_name="New Registered Employer",
        organization_name=None,
        organization_type=None,
        email="newemployer@example.com",
        phone=None,
        city=None,
        state=None,
        is_verified=False,
        is_active=True,
        active_jobs_count=0,
        total_jobs_count=0,
        created_at=datetime.now(timezone.utc),
    )
    assert item.full_name == "New Registered Employer"
    assert item.organization_name is None
    assert item.active_jobs_count == 0


if __name__ == '__main__':
    test_admin_stats_schema()
    test_verification_record_response_with_user()
    test_admin_worker_incomplete_profile_item()
    test_admin_employer_incomplete_profile_item()
    print("ALL 4 ADMIN UNIT TESTS PASSED SUCCESSFULLY!")
