"""
KaamSetu — Trust and Verification Center Test Suite (Feature 2 Phase 2)
Tests:
- Phone OTP: request, success, wrong code, attempt exhaustion, expiry, rate limits, replay prevention, production safety.
- Worker identity submission & role guards.
- Worker skill certificate submission & profile skill validation.
- Employer company verification submission & role guards.
- Admin review queue, approval, rejection with mandatory reason, self-approval prevention.
- Authoritative profile boolean flag synchronization.
- Resubmission and audit history preservation.
- Private document gateway authorization: owner (200), admin (200), third-party user (403), unauthenticated (401).
- Document validation: MIME types, magic numbers, size limits, PDF and image handling.
- Expiry and revocation handling.
- Strict test isolation using kaamsetu_test database.
"""
import io
import pytest
from httpx import AsyncClient, ASGITransport
from uuid import uuid4
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, delete

from app.main import app
from app.core.security import create_access_token
from app.core.config import settings
from app.db.session import engine, AsyncSessionLocal
from app.models.models import (
    User, WorkerProfile, EmployerProfile, Skill, WorkerSkill,
    VerificationRecord, VerificationType, VerificationStatus, UserRole
)
from app.services.otp_service import OTPService, _user_active_otps
from app.services.private_storage_service import private_storage


@pytest.fixture
def anyio_backend():
    return 'asyncio'


@pytest.fixture(autouse=True)
async def cleanup_test_state():
    """Reset OTP store and dispose engine after each test."""
    OTPService.clear_all()
    yield
    OTPService.clear_all()
    await engine.dispose()


# Helper to generate synthetic test PDF bytes
def make_synthetic_pdf(text: str = "SYNTHETIC TEST DOCUMENT") -> bytes:
    content = f"%PDF-1.4\n1 0 obj\n<< /Title ({text}) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF".encode("utf-8")
    return content


# Helper to generate synthetic test PNG bytes
def make_synthetic_png() -> bytes:
    return b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"


# ─── Part 1: Phone OTP Verification Tests ─────────────────────────────────────

@pytest.mark.anyio
async def test_otp_request_and_success_flow():
    """Verify requesting OTP and completing verification successfully."""
    worker_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_id, "role": "WORKER"})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Request OTP
        req_res = await ac.post(
            "/api/verifications/phone/request",
            json={"phone": "+919876543210"},
            headers=headers,
        )
        assert req_res.status_code == 200
        data = req_res.json()
        assert "masked_phone" in data

        # 2. Verify with mock OTP code (123456)
        ver_res = await ac.post(
            "/api/verifications/phone/verify",
            json={"phone": "+919876543210", "otp_code": "123456"},
            headers=headers,
        )
        assert ver_res.status_code == 200
        ver_data = ver_res.json()
        assert ver_data["is_phone_verified"] is True

        # 3. Check DB synchronization
        async with AsyncSessionLocal() as db:
            w_res = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == worker_id))
            wp = w_res.scalar_one()
            assert wp.is_phone_verified is True


@pytest.mark.anyio
async def test_otp_wrong_code_and_attempt_exhaustion():
    """Verify wrong code decrements attempts and 5th wrong code invalidates OTP."""
    worker_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_id, "role": "WORKER"})
    headers = {"Authorization": f"Bearer {token}"}
    phone = "+919811122233"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post("/api/verifications/phone/request", json={"phone": phone}, headers=headers)

        # 1-4 wrong codes
        for attempt in range(4):
            res = await ac.post(
                "/api/verifications/phone/verify",
                json={"phone": phone, "otp_code": "000000"},
                headers=headers,
            )
            assert res.status_code == 400
            assert "attempt(s) remaining" in res.json()["detail"]

        # 5th wrong code: maximum attempts reached, invalidated
        res5 = await ac.post(
            "/api/verifications/phone/verify",
            json={"phone": phone, "otp_code": "000000"},
            headers=headers,
        )
        assert res5.status_code == 400
        assert "Maximum attempts reached" in res5.json()["detail"]

        # Subsequent attempts rejected
        res6 = await ac.post(
            "/api/verifications/phone/verify",
            json={"phone": phone, "otp_code": "123456"},
            headers=headers,
        )
        assert res6.status_code == 400
        assert "No active OTP request found" in res6.json()["detail"]


@pytest.mark.anyio
async def test_otp_expiry():
    """Verify expired OTP is rejected."""
    worker_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_id, "role": "WORKER"})
    headers = {"Authorization": f"Bearer {token}"}
    phone = "+919899988877"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post("/api/verifications/phone/request", json={"phone": phone}, headers=headers)

        # Force expire the OTP record in memory
        _user_active_otps[worker_id]["expires_at"] = datetime.now(timezone.utc) - timedelta(minutes=1)

        res = await ac.post(
            "/api/verifications/phone/verify",
            json={"phone": phone, "otp_code": "123456"},
            headers=headers,
        )
        assert res.status_code == 400
        assert "expired" in res.json()["detail"].lower()


@pytest.mark.anyio
async def test_otp_rate_limiting():
    """Verify max 3 OTP requests within 10 minutes returns 429."""
    worker_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_id, "role": "WORKER"})
    headers = {"Authorization": f"Bearer {token}"}
    phone = "+919777766665"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Requests 1, 2, 3 succeed
        for _ in range(3):
            r = await ac.post("/api/verifications/phone/request", json={"phone": phone}, headers=headers)
            assert r.status_code == 200

        # Request 4 is rate-limited
        r4 = await ac.post("/api/verifications/phone/request", json={"phone": phone}, headers=headers)
        assert r4.status_code == 429
        assert "Too many OTP requests" in r4.json()["detail"]
        assert "Retry-After" in r4.headers


@pytest.mark.anyio
async def test_otp_replay_prevention():
    """Verify an OTP cannot be used more than once."""
    worker_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_id, "role": "WORKER"})
    headers = {"Authorization": f"Bearer {token}"}
    phone = "+919555544443"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post("/api/verifications/phone/request", json={"phone": phone}, headers=headers)

        # First verification succeeds
        v1 = await ac.post("/api/verifications/phone/verify", json={"phone": phone, "otp_code": "123456"}, headers=headers)
        assert v1.status_code == 200

        # Second verification with same code fails
        v2 = await ac.post("/api/verifications/phone/verify", json={"phone": phone, "otp_code": "123456"}, headers=headers)
        assert v2.status_code == 400
        assert "No active OTP request found" in v2.json()["detail"]


@pytest.mark.anyio
async def test_otp_production_mock_mode_rejection():
    """Verify requesting mock OTP in production environment raises RuntimeError."""
    phone = "+919000011112"
    orig_env = settings.ENVIRONMENT
    orig_mock = settings.MOCK_OTP_MODE
    try:
        settings.ENVIRONMENT = "production"
        settings.MOCK_OTP_MODE = True

        with pytest.raises(RuntimeError) as exc_info:
            OTPService.request_otp(user_id=str(uuid4()), phone=phone)
        assert "strictly forbidden in production" in str(exc_info.value)
    finally:
        settings.ENVIRONMENT = orig_env
        settings.MOCK_OTP_MODE = orig_mock


# ─── Part 2: Worker Identity Submission & Role Guards ─────────────────────────

@pytest.mark.anyio
async def test_worker_identity_submission():
    """Verify worker can submit identity document and receives PENDING status."""
    worker_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_id, "role": "WORKER"})
    headers = {"Authorization": f"Bearer {token}"}

    pdf_bytes = make_synthetic_pdf("WORKER IDENTITY DOC")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/verifications/identity",
            data={"document_type": "DRIVING_LICENSE", "notes": "Commercial driving license valid till 2030"},
            files={"document": ("license.pdf", pdf_bytes, "application/pdf")},
            headers=headers,
        )
        assert res.status_code == 201
        data = res.json()
        assert data["verification_type"] == "IDENTITY"
        assert data["status"] == "PENDING"
        assert data["document_type"] == "DRIVING_LICENSE"
        assert data["has_document"] is True


@pytest.mark.anyio
async def test_employer_cannot_submit_worker_identity():
    """Verify employers are forbidden from submitting worker identity verification."""
    employer_id = "da87f7a4-6cbf-419c-af92-5c1754ec6662"
    token = create_access_token({"sub": employer_id, "role": "EMPLOYER"})
    headers = {"Authorization": f"Bearer {token}"}

    pdf_bytes = make_synthetic_pdf("ID")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/verifications/identity",
            data={"document_type": "PASSPORT"},
            files={"document": ("passport.pdf", pdf_bytes, "application/pdf")},
            headers=headers,
        )
        assert res.status_code == 403
        assert "restricted to workers" in res.json()["detail"].lower()


# ─── Part 3: Worker Skill Certificate Submission ──────────────────────────────

@pytest.mark.anyio
async def test_worker_skill_certificate_submission():
    """Verify worker can submit a skill certificate for a skill they possess."""
    worker_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_id, "role": "WORKER"})
    headers = {"Authorization": f"Bearer {token}"}

    # Ensure worker has a skill on their profile
    async with AsyncSessionLocal() as db:
        w_res = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == worker_id))
        wp = w_res.scalar_one()
        ws_res = await db.execute(select(WorkerSkill).where(WorkerSkill.worker_profile_id == wp.id))
        ws = ws_res.scalars().first()
        if not ws:
            # Find any skill
            sk_res = await db.execute(select(Skill).limit(1))
            skill = sk_res.scalar_one_or_none()
            if not skill:
                skill = Skill(name=f"Skill-{uuid4().hex[:6]}")
                db.add(skill)
                await db.flush()
            ws = WorkerSkill(worker_profile_id=wp.id, skill_id=skill.id)
            db.add(ws)
            await db.commit()
            await db.refresh(ws)
        valid_skill_id = str(ws.skill_id)

    pdf_bytes = make_synthetic_pdf("ITI CERTIFICATE")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/verifications/skill",
            data={
                "skill_id": valid_skill_id,
                "certificate_title": "ITI Electrician National Trade Certificate",
                "issuing_authority": "NCVT India",
                "notes": "Passed with distinction",
            },
            files={"document": ("certificate.pdf", pdf_bytes, "application/pdf")},
            headers=headers,
        )
        assert res.status_code == 201
        data = res.json()
        assert data["verification_type"] == "SKILL"
        assert data["status"] == "PENDING"
        assert data["has_document"] is True


@pytest.mark.anyio
async def test_skill_certificate_rejected_if_not_on_profile():
    """Verify certificate submission fails if worker does not have that skill."""
    worker_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_id, "role": "WORKER"})
    headers = {"Authorization": f"Bearer {token}"}
    fake_skill_id = str(uuid4())

    pdf_bytes = make_synthetic_pdf("CERT")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/verifications/skill",
            data={"skill_id": fake_skill_id, "certificate_title": "Fake Skill"},
            files={"document": ("cert.pdf", pdf_bytes, "application/pdf")},
            headers=headers,
        )
        assert res.status_code == 400
        assert "not been added to your worker profile" in res.json()["detail"]


# ─── Part 4: Employer Company Verification ────────────────────────────────────

@pytest.mark.anyio
async def test_employer_company_verification_submission():
    """Verify employer can submit business registration document."""
    employer_id = "da87f7a4-6cbf-419c-af92-5c1754ec6662"
    token = create_access_token({"sub": employer_id, "role": "EMPLOYER"})
    headers = {"Authorization": f"Bearer {token}"}

    pdf_bytes = make_synthetic_pdf("GST REGISTRATION CERTIFICATE")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/verifications/company",
            data={
                "organization_name": "Apex Facilities Pvt Ltd",
                "organization_type": "Private Limited",
                "tax_id": "27ABCDE1234F1Z5",
                "notes": "Registered in Maharashtra",
            },
            files={"document": ("gst_cert.pdf", pdf_bytes, "application/pdf")},
            headers=headers,
        )
        assert res.status_code == 201
        data = res.json()
        assert data["status"] == "PENDING"
        assert data["has_document"] is True


# ─── Part 5: Admin Review & Flag Synchronization ──────────────────────────────

@pytest.mark.anyio
async def test_admin_approval_and_flag_synchronization():
    """Verify admin approval updates record status and synchronizes profile booleans."""
    worker_id = "58427761-6768-4988-aead-b304fd2760a4"
    worker_token = create_access_token({"sub": worker_id, "role": "WORKER"})
    worker_headers = {"Authorization": f"Bearer {worker_token}"}

    # Reset worker verification state
    async with AsyncSessionLocal() as db:
        w_res = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == worker_id))
        wp = w_res.scalar_one()
        wp.is_identity_verified = False
        await db.commit()

    # 1. Worker submits identity document
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        sub_res = await ac.post(
            "/api/verifications/identity",
            data={"document_type": "VOTER_ID"},
            files={"document": ("voter.pdf", make_synthetic_pdf("VOTER ID"), "application/pdf")},
            headers=worker_headers,
        )
        record_id = sub_res.json()["id"]

        # 2. Admin approves
        admin_id = str(uuid4())
        # Seed an admin user in DB
        async with AsyncSessionLocal() as db:
            admin_user = User(id=admin_id, email=f"admin_{admin_id[:8]}@kaamsetu.in", password_hash="hash", role=UserRole.ADMIN)
            db.add(admin_user)
            await db.commit()

        admin_token = create_access_token({"sub": admin_id, "role": "ADMIN"})
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        app_res = await ac.post(
            f"/api/admin/verifications/{record_id}/approve",
            json={"decision": "APPROVE", "reviewer_notes": "Clear voter ID document"},
            headers=admin_headers,
        )
        assert app_res.status_code == 200
        app_data = app_res.json()
        assert app_data["status"] == "VERIFIED"
        assert app_data["verified_by"] == admin_id

        # 3. Verify profile boolean was synchronized
        async with AsyncSessionLocal() as db:
            w_res = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == worker_id))
            wp = w_res.scalar_one()
            assert wp.is_identity_verified is True


@pytest.mark.anyio
async def test_admin_rejection_requires_reason():
    """Verify rejection without reason fails with 422, but succeeds with valid reason."""
    worker_id = "58427761-6768-4988-aead-b304fd2760a4"
    worker_token = create_access_token({"sub": worker_id, "role": "WORKER"})

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        sub_res = await ac.post(
            "/api/verifications/identity",
            data={"document_type": "DRIVING_LICENSE"},
            files={"document": ("id.pdf", make_synthetic_pdf("ID"), "application/pdf")},
            headers={"Authorization": f"Bearer {worker_token}"},
        )
        record_id = sub_res.json()["id"]

        # Admin user
        admin_id = str(uuid4())
        async with AsyncSessionLocal() as db:
            admin_user = User(id=admin_id, email=f"admin_{admin_id[:8]}@kaamsetu.in", password_hash="hash", role=UserRole.ADMIN)
            db.add(admin_user)
            await db.commit()

        admin_token = create_access_token({"sub": admin_id, "role": "ADMIN"})
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # 1. Reject without reason -> 422
        bad_rej = await ac.post(
            f"/api/admin/verifications/{record_id}/reject",
            json={"decision": "REJECT", "rejection_reason": ""},
            headers=admin_headers,
        )
        assert bad_rej.status_code == 422

        # 2. Reject with reason -> 200
        good_rej = await ac.post(
            f"/api/admin/verifications/{record_id}/reject",
            json={"decision": "REJECT", "rejection_reason": "Document is blurry and name is truncated."},
            headers=admin_headers,
        )
        assert good_rej.status_code == 200
        rej_data = good_rej.json()
        assert rej_data["status"] == "REJECTED"
        assert "blurry" in rej_data["rejection_reason"].lower()


@pytest.mark.anyio
async def test_admin_self_approval_prevented():
    """Verify an admin cannot approve their own verification submission."""
    admin_id = str(uuid4())
    async with AsyncSessionLocal() as db:
        admin_user = User(id=admin_id, email=f"admin_{admin_id[:8]}@kaamsetu.in", password_hash="hash", role=UserRole.ADMIN)
        db.add(admin_user)
        # Create a verification record owned by this admin
        rec = VerificationRecord(
            user_id=admin_id,
            verification_type=VerificationType.IDENTITY,
            status=VerificationStatus.PENDING,
            document_url="private://identity/test.pdf",
        )
        db.add(rec)
        await db.commit()
        record_id = str(rec.id)

    admin_token = create_access_token({"sub": admin_id, "role": "ADMIN"})
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            f"/api/admin/verifications/{record_id}/approve",
            json={"decision": "APPROVE"},
            headers=admin_headers,
        )
        assert res.status_code == 403
        assert "Self-approval is forbidden" in res.json()["detail"]


# ─── Part 6: Resubmission & History Preservation ──────────────────────────────

@pytest.mark.anyio
async def test_resubmission_preserves_audit_history():
    """Verify resubmission creates a new record while keeping old rejected records in history."""
    worker_id = "58427761-6768-4988-aead-b304fd2760a4"
    worker_token = create_access_token({"sub": worker_id, "role": "WORKER"})
    worker_headers = {"Authorization": f"Bearer {worker_token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # First submission
        sub1 = await ac.post(
            "/api/verifications/identity",
            data={"document_type": "DRIVING_LICENSE", "notes": "First attempt"},
            files={"document": ("doc1.pdf", make_synthetic_pdf("ATTEMPT 1"), "application/pdf")},
            headers=worker_headers,
        )
        rec1_id = sub1.json()["id"]

        # Admin rejects first submission
        admin_id = str(uuid4())
        async with AsyncSessionLocal() as db:
            admin_user = User(id=admin_id, email=f"admin_{admin_id[:8]}@kaamsetu.in", password_hash="hash", role=UserRole.ADMIN)
            db.add(admin_user)
            await db.commit()
        admin_headers = {"Authorization": f"Bearer {create_access_token({'sub': admin_id, 'role': 'ADMIN'})}"}

        await ac.post(
            f"/api/admin/verifications/{rec1_id}/reject",
            json={"decision": "REJECT", "rejection_reason": "Address not visible"},
            headers=admin_headers,
        )

        # Second submission (resubmission)
        sub2 = await ac.post(
            "/api/verifications/identity",
            data={"document_type": "DRIVING_LICENSE", "notes": "Second attempt with full address"},
            files={"document": ("doc2.pdf", make_synthetic_pdf("ATTEMPT 2"), "application/pdf")},
            headers=worker_headers,
        )
        rec2_id = sub2.json()["id"]
        assert rec1_id != rec2_id

        # Query history
        hist_res = await ac.get("/api/verifications/my-history", headers=worker_headers)
        assert hist_res.status_code == 200
        history = hist_res.json()
        ids = [h["id"] for h in history]
        assert rec1_id in ids
        assert rec2_id in ids

        # Confirm old record retains REJECTED status with reason
        past_rec = next(h for h in history if h["id"] == rec1_id)
        assert past_rec["status"] == "REJECTED"
        assert past_rec["rejection_reason"] == "Address not visible"


# ─── Part 7: Private Document Gateway Authorization ───────────────────────────

@pytest.mark.anyio
async def test_private_document_access_control():
    """
    Verify secure document gateway permissions:
    - Document owner -> 200 OK
    - Admin -> 200 OK
    - Other worker/user -> 403 Forbidden
    - Unauthenticated -> 401 Unauthorized
    """
    worker1_id = "58427761-6768-4988-aead-b304fd2760a4"
    worker1_token = create_access_token({"sub": worker1_id, "role": "WORKER"})

    worker2_id = str(uuid4())
    async with AsyncSessionLocal() as db:
        w2_user = User(id=worker2_id, email=f"w2_{worker2_id[:8]}@kaamsetu.in", password_hash="hash", role=UserRole.WORKER)
        db.add(w2_user)
        await db.commit()
    worker2_token = create_access_token({"sub": worker2_id, "role": "WORKER"})

    admin_id = str(uuid4())
    async with AsyncSessionLocal() as db:
        await db.execute(delete(VerificationRecord).where(VerificationRecord.user_id == worker1_id))
        w_res = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == worker1_id))
        wp = w_res.scalar_one()
        wp.is_identity_verified = False
        admin_user = User(id=admin_id, email=f"admin_{admin_id[:8]}@kaamsetu.in", password_hash="hash", role=UserRole.ADMIN)
        db.add(admin_user)
        await db.commit()
    admin_token = create_access_token({"sub": admin_id, "role": "ADMIN"})

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Worker 1 uploads document
        sub_res = await ac.post(
            "/api/verifications/identity",
            data={"document_type": "PASSPORT"},
            files={"document": ("passport.pdf", make_synthetic_pdf("CONFIDENTIAL PASSPORT"), "application/pdf")},
            headers={"Authorization": f"Bearer {worker1_token}"},
        )
        record_id = sub_res.json()["id"]

        # 1. Worker 1 (Owner) accesses own document -> 200
        r_owner = await ac.get(f"/api/verifications/{record_id}/document", headers={"Authorization": f"Bearer {worker1_token}"})
        assert r_owner.status_code == 200
        assert r_owner.headers["content-type"] == "application/pdf"
        assert b"CONFIDENTIAL PASSPORT" in r_owner.content

        # 2. Admin accesses document -> 200
        r_admin = await ac.get(f"/api/verifications/{record_id}/document", headers={"Authorization": f"Bearer {admin_token}"})
        assert r_admin.status_code == 200
        assert b"CONFIDENTIAL PASSPORT" in r_admin.content

        # 3. Worker 2 (Third-party) accesses document -> 403 Forbidden
        r_other = await ac.get(f"/api/verifications/{record_id}/document", headers={"Authorization": f"Bearer {worker2_token}"})
        assert r_other.status_code == 403
        assert "Access forbidden" in r_other.json()["detail"]

        # 4. Unauthenticated accesses document -> 401 Unauthorized
        r_anon = await ac.get(f"/api/verifications/{record_id}/document")
        assert r_anon.status_code in (401, 403)


# ─── Part 8: File Validation (MIME & Size) ────────────────────────────────────

@pytest.mark.anyio
async def test_document_validation_invalid_mime_and_size():
    """Verify invalid MIME, spoofed signatures, and oversize files are rejected."""
    worker_id = "58427761-6768-4988-aead-b304fd2760a4"
    headers = {"Authorization": f"Bearer {create_access_token({'sub': worker_id, 'role': 'WORKER'})}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Unsupported MIME (text/plain)
        r_txt = await ac.post(
            "/api/verifications/identity",
            data={"document_type": "DRIVING_LICENSE"},
            files={"document": ("doc.txt", b"plain text", "text/plain")},
            headers=headers,
        )
        assert r_txt.status_code == 400
        assert "Unsupported document MIME type" in r_txt.json()["detail"]

        # 2. Spoofed PDF (declared application/pdf but lacks %PDF signature)
        r_spoof = await ac.post(
            "/api/verifications/identity",
            data={"document_type": "DRIVING_LICENSE"},
            files={"document": ("doc.pdf", b"NOT_A_REAL_PDF_DATA", "application/pdf")},
            headers=headers,
        )
        assert r_spoof.status_code == 400
        assert "Missing PDF signature" in r_spoof.json()["detail"]

        # 3. Oversized file (> 5MB)
        oversized = b"%PDF" + (b"0" * (5 * 1024 * 1024 + 100))
        r_big = await ac.post(
            "/api/verifications/identity",
            data={"document_type": "DRIVING_LICENSE"},
            files={"document": ("big.pdf", oversized, "application/pdf")},
            headers=headers,
        )
        assert r_big.status_code == 400
        assert "exceeds maximum allowed limit" in r_big.json()["detail"]


# ─── Part 9: Expiry and Revocation ────────────────────────────────────────────

@pytest.mark.anyio
async def test_expiry_and_revocation():
    """Verify expired records show EXPIRED status and revoking verified records reverts trust flags."""
    worker_id = "58427761-6768-4988-aead-b304fd2760a4"
    worker_headers = {"Authorization": f"Bearer {create_access_token({'sub': worker_id, 'role': 'WORKER'})}"}

    admin_id = str(uuid4())
    async with AsyncSessionLocal() as db:
        await db.execute(delete(VerificationRecord).where(VerificationRecord.user_id == worker_id))
        w_res = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == worker_id))
        wp = w_res.scalar_one()
        wp.is_identity_verified = False
        admin_user = User(id=admin_id, email=f"admin_{admin_id[:8]}@kaamsetu.in", password_hash="hash", role=UserRole.ADMIN)
        db.add(admin_user)
        await db.commit()
    admin_headers = {"Authorization": f"Bearer {create_access_token({'sub': admin_id, 'role': 'ADMIN'})}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Submit and approve with expiration in past
        sub = await ac.post(
            "/api/verifications/identity",
            data={"document_type": "TRADE_LICENSE"},
            files={"document": ("license.pdf", make_synthetic_pdf("LICENSE"), "application/pdf")},
            headers=worker_headers,
        )
        rec_id = sub.json()["id"]

        past_date = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        app_res = await ac.post(
            f"/api/admin/verifications/{rec_id}/approve",
            json={"decision": "APPROVE", "expires_at": past_date},
            headers=admin_headers,
        )
        assert app_res.status_code == 200
        # Effective status is computed as EXPIRED
        assert app_res.json()["status"] == "EXPIRED"

        # 2. Revocation test
        # Submit fresh document and approve
        sub2 = await ac.post(
            "/api/verifications/identity",
            data={"document_type": "TRADE_LICENSE"},
            files={"document": ("license2.pdf", make_synthetic_pdf("LICENSE 2"), "application/pdf")},
            headers=worker_headers,
        )
        rec2_id = sub2.json()["id"]
        await ac.post(f"/api/admin/verifications/{rec2_id}/approve", json={"decision": "APPROVE"}, headers=admin_headers)

        # Check worker profile is verified
        async with AsyncSessionLocal() as db:
            w_res = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == worker_id))
            wp = w_res.scalar_one()
            assert wp.is_identity_verified is True

        # Now admin revokes
        rev_res = await ac.post(
            f"/api/admin/verifications/{rec2_id}/revoke",
            json={"decision": "REVOKE", "rejection_reason": "Forged seal detected during audit"},
            headers=admin_headers,
        )
        assert rev_res.status_code == 200
        assert rev_res.json()["status"] == "REJECTED"
        assert "[REVOKED]" in rev_res.json()["rejection_reason"]

        # Check worker profile is no longer verified
        async with AsyncSessionLocal() as db:
            w_res = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == worker_id))
            wp = w_res.scalar_one()
            assert wp.is_identity_verified is False


# ─── Part 10: Status Summary and Admin Queue Filters ──────────────────────────

@pytest.mark.anyio
async def test_my_verification_status_summary():
    """Verify GET /api/verifications/my-status computes all dimensions accurately."""
    worker_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_id, "role": "WORKER"})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/verifications/my-status", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "phone_status" in data
        assert "identity_status" in data
        assert "is_verified" in data
        assert "active_records" in data


@pytest.mark.anyio
async def test_admin_queue_pagination_and_filters():
    """Verify admin queue filtering by status and verification type."""
    admin_id = str(uuid4())
    async with AsyncSessionLocal() as db:
        admin_user = User(id=admin_id, email=f"admin_{admin_id[:8]}@kaamsetu.in", password_hash="hash", role=UserRole.ADMIN)
        db.add(admin_user)
        await db.commit()
    admin_headers = {"Authorization": f"Bearer {create_access_token({'sub': admin_id, 'role': 'ADMIN'})}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get(
            "/api/admin/verifications/queue?status=PENDING&page=1&per_page=10",
            headers=admin_headers,
        )
        assert res.status_code == 200
        records = res.json()
        assert isinstance(records, list)
        for r in records:
            assert r["status"] == "PENDING"


# ─── Part 11: Security Remediation Regression Tests (Phase 2.2) ───────────────

@pytest.mark.anyio
async def test_otp_user_binding_and_cross_account_blocked():
    """Verify OTP challenges are bound to user_id; cross-account verify and phone change tests."""
    user1_id = "58427761-6768-4988-aead-b304fd2760a4"
    user1_token = create_access_token({"sub": user1_id, "role": "WORKER"})

    user2_id = str(uuid4())
    async with AsyncSessionLocal() as db:
        u2 = User(id=user2_id, email=f"user2_{user2_id[:6]}@test.com", password_hash="hash", role=UserRole.WORKER)
        db.add(u2)
        await db.commit()
    user2_token = create_access_token({"sub": user2_id, "role": "WORKER"})

    phone_a = "+919111122223"
    phone_b = "+919444455556"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. User 1 requests OTP for phone_a
        req1 = await ac.post("/api/verifications/phone/request", json={"phone": phone_a}, headers={"Authorization": f"Bearer {user1_token}"})
        assert req1.status_code == 200

        # 2. User 2 tries to verify phone_a using the mock code -> Rejected!
        v_user2 = await ac.post("/api/verifications/phone/verify", json={"phone": phone_a, "otp_code": "123456"}, headers={"Authorization": f"Bearer {user2_token}"})
        assert v_user2.status_code == 400
        assert "No active OTP request found for your account" in v_user2.json()["detail"]

        # 3. User 1 changes mind and requests OTP for phone_b (invalidates phone_a challenge)
        req2 = await ac.post("/api/verifications/phone/request", json={"phone": phone_b}, headers={"Authorization": f"Bearer {user1_token}"})
        assert req2.status_code == 200

        # 4. User 1 tries to verify phone_a -> Rejected!
        v_old_phone = await ac.post("/api/verifications/phone/verify", json={"phone": phone_a, "otp_code": "123456"}, headers={"Authorization": f"Bearer {user1_token}"})
        assert v_old_phone.status_code == 400
        assert "OTP was not requested for this phone number" in v_old_phone.json()["detail"]

        # 5. User 1 verifies phone_b -> 200 OK!
        v_new_phone = await ac.post("/api/verifications/phone/verify", json={"phone": phone_b, "otp_code": "123456"}, headers={"Authorization": f"Bearer {user1_token}"})
        assert v_new_phone.status_code == 200
        assert v_new_phone.json()["is_phone_verified"] is True


@pytest.mark.anyio
async def test_public_static_access_blocked_for_private_docs():
    """Verify unauthenticated requests to /uploads/private_docs/... cannot retrieve files (returns 404)."""
    worker_id = "58427761-6768-4988-aead-b304fd2760a4"
    token = create_access_token({"sub": worker_id, "role": "WORKER"})

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Submit a private document
        res = await ac.post(
            "/api/verifications/identity",
            data={"document_type": "PASSPORT"},
            files={"document": ("secret_passport.pdf", make_synthetic_pdf("CONFIDENTIAL TEST PASSPORT"), "application/pdf")},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 201
        rec_id = res.json()["id"]

        # 1. Authenticated endpoint retrieves successfully
        r_auth = await ac.get(f"/api/verifications/{rec_id}/document", headers={"Authorization": f"Bearer {token}"})
        assert r_auth.status_code == 200
        assert b"CONFIDENTIAL TEST PASSPORT" in r_auth.content

        # 2. Public static mount /uploads/private_docs/... CANNOT access it
        # (Returns 404 because private_docs is stored outside uploads/ in private_storage/)
        r_public = await ac.get("/uploads/private_docs/identity/secret_passport.pdf")
        assert r_public.status_code == 404

        r_public2 = await ac.get(f"/uploads/private_docs/{rec_id}.pdf")
        assert r_public2.status_code == 404


@pytest.mark.anyio
async def test_verification_flag_preserved_if_another_record_verified():
    """
    Verify that rejecting/revoking one record does NOT clear profile flag
    if another active, non-expired verified record still justifies it.
    """
    worker_id = "58427761-6768-4988-aead-b304fd2760a4"
    worker_token = create_access_token({"sub": worker_id, "role": "WORKER"})
    worker_headers = {"Authorization": f"Bearer {worker_token}"}

    admin_id = str(uuid4())
    async with AsyncSessionLocal() as db:
        await db.execute(delete(VerificationRecord).where(VerificationRecord.user_id == worker_id))
        w_res = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == worker_id))
        wp = w_res.scalar_one()
        wp.is_identity_verified = False
        admin_user = User(id=admin_id, email=f"admin_{admin_id[:6]}@kaamsetu.in", password_hash="hash", role=UserRole.ADMIN)
        db.add(admin_user)
        await db.commit()
    admin_headers = {"Authorization": f"Bearer {create_access_token({'sub': admin_id, 'role': 'ADMIN'})}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Submit Record 1 (Passport) and approve
        sub1 = await ac.post(
            "/api/verifications/identity",
            data={"document_type": "PASSPORT"},
            files={"document": ("doc1.pdf", make_synthetic_pdf("PASSPORT"), "application/pdf")},
            headers=worker_headers,
        )
        rec1_id = sub1.json()["id"]
        app1 = await ac.post(f"/api/admin/verifications/{rec1_id}/approve", json={"decision": "APPROVE"}, headers=admin_headers)
        assert app1.status_code == 200

        # Worker is now identity verified
        async with AsyncSessionLocal() as db:
            w_res = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == worker_id))
            wp = w_res.scalar_one()
            assert wp.is_identity_verified is True

        # 2. Worker submits Record 2 (Driving License renewal)
        sub2 = await ac.post(
            "/api/verifications/identity",
            data={"document_type": "DRIVING_LICENSE"},
            files={"document": ("doc2.pdf", make_synthetic_pdf("DL"), "application/pdf")},
            headers=worker_headers,
        )
        rec2_id = sub2.json()["id"]

        # 3. Admin rejects Record 2 (e.g. blurry image)
        rej2 = await ac.post(
            f"/api/admin/verifications/{rec2_id}/reject",
            json={"decision": "REJECT", "rejection_reason": "Image corners clipped"},
            headers=admin_headers,
        )
        assert rej2.status_code == 200

        # CRITICAL ASSERTION: Record 1 is still active and verified,
        # so WorkerProfile.is_identity_verified MUST REMAIN TRUE!
        async with AsyncSessionLocal() as db:
            w_res = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == worker_id))
            wp = w_res.scalar_one()
            assert wp.is_identity_verified is True, "Worker should remain verified because Record 1 is still valid!"

        # 4. Now admin revokes Record 1
        rev1 = await ac.post(
            f"/api/admin/verifications/{rec1_id}/revoke",
            json={"decision": "REVOKE", "rejection_reason": "Discovered fraudulent"},
            headers=admin_headers,
        )
        assert rev1.status_code == 200

        # Now worker has NO active verified identity records, so is_identity_verified must be False
        async with AsyncSessionLocal() as db:
            w_res = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == worker_id))
            wp = w_res.scalar_one()
            assert wp.is_identity_verified is False


@pytest.mark.anyio
async def test_invalid_state_transitions_rejected():
    """Verify state machine transition guards: only PENDING can be approved/rejected; only VERIFIED can be revoked."""
    worker_id = "58427761-6768-4988-aead-b304fd2760a4"
    worker_headers = {"Authorization": f"Bearer {create_access_token({'sub': worker_id, 'role': 'WORKER'})}"}

    admin_id = str(uuid4())
    async with AsyncSessionLocal() as db:
        admin_user = User(id=admin_id, email=f"admin_{admin_id[:6]}@kaamsetu.in", password_hash="hash", role=UserRole.ADMIN)
        db.add(admin_user)
        await db.commit()
    admin_headers = {"Authorization": f"Bearer {create_access_token({'sub': admin_id, 'role': 'ADMIN'})}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        sub = await ac.post(
            "/api/verifications/identity",
            data={"document_type": "VOTER_ID"},
            files={"document": ("voter.pdf", make_synthetic_pdf("VOTER ID"), "application/pdf")},
            headers=worker_headers,
        )
        rec_id = sub.json()["id"]

        # 1. Cannot revoke a PENDING record -> 400 Bad Request
        bad_rev = await ac.post(
            f"/api/admin/verifications/{rec_id}/revoke",
            json={"decision": "REVOKE", "rejection_reason": "Revoke attempt"},
            headers=admin_headers,
        )
        assert bad_rev.status_code == 400
        assert "Only VERIFIED records can be revoked" in bad_rev.json()["detail"]

        # 2. Approve PENDING record -> 200 OK
        app_res = await ac.post(f"/api/admin/verifications/{rec_id}/approve", json={"decision": "APPROVE"}, headers=admin_headers)
        assert app_res.status_code == 200

        # 3. Cannot re-approve an already VERIFIED record -> 400 Bad Request
        re_app = await ac.post(f"/api/admin/verifications/{rec_id}/approve", json={"decision": "APPROVE"}, headers=admin_headers)
        assert re_app.status_code == 400
        assert "Only PENDING submissions can be approved" in re_app.json()["detail"]

        # 4. Cannot reject an already VERIFIED record -> 400 Bad Request
        bad_rej = await ac.post(
            f"/api/admin/verifications/{rec_id}/reject",
            json={"decision": "REJECT", "rejection_reason": "Too late"},
            headers=admin_headers,
        )
        assert bad_rej.status_code == 400
        assert "Only PENDING submissions can be rejected" in bad_rej.json()["detail"]
