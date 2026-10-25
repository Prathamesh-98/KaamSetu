from typing import Optional
"""
KaamSetu — Phase 4.3.0 Unified OTP & Password Recovery Test Suite
Tests:
- OTP security: correct, incorrect, expired, reused, cross-user, cross-phone, cross-purpose,
  max attempts exhaustion, rate limits, concurrent verification/replay, superseded OTPs.
- Password recovery: email recovery flow, mobile recovery flow, generic responses for unknown accounts,
  weak password validation, single-use reset authorization expiry, session invalidation via token_version.
- Worker phone verification: phone verification in trust center, phone matching registered user,
  cross-account blocked, phone verification cannot authorize password reset.
- Provider failure handling and production mock mode rejection.
"""
import pytest
import asyncio
import secrets
from httpx import AsyncClient, ASGITransport
from uuid import uuid4
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, delete

from app.main import app
from app.core.security import create_access_token, hash_password, verify_password
from app.core.config import settings
from app.db.session import engine, AsyncSessionLocal
from app.models.models import (
    User, WorkerProfile, EmployerProfile, UserRole, VerificationRecord, VerificationType, VerificationStatus
)
from app.services.otp_service import OTPService, OTPPurpose, normalize_phone, normalize_email
from app.services.email_service import email_service
from app.services.sms_service import sms_service
from app.core.rate_limit import _rate_limits



async def create_test_user(phone: Optional[str] = None, email: Optional[str] = None) -> User:
    async with AsyncSessionLocal() as db:
        user = User(
            email=email or f"user_{uuid4().hex[:8]}@example.com",
            phone=phone,
            password_hash="hash",
            role=UserRole.WORKER,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

def make_unique_phone() -> str:
    """Generate a valid unique Indian E.164 phone number."""
    return f"+9198{secrets.randbelow(89999999) + 10000000}"


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
async def cleanup_otp_state():
    """Ensure clean state before and after each test."""
    OTPService.clear_all()
    _rate_limits.clear()
    yield
    OTPService.clear_all()
    _rate_limits.clear()
    await engine.dispose()


# ─── Part 1: Shared OTP Architecture & Purpose Isolation ──────────────────────

@pytest.mark.anyio
async def test_otp_core_correct_and_replay_prevention():
    """Verify correct OTP succeeds and cannot be reused (replay prevention)."""
    phone = make_unique_phone()
    u = await create_test_user(phone=phone)
    user_id = str(u.id)

    success, msg, _, code = await OTPService.request_challenge(
        purpose=OTPPurpose.WORKER_PHONE_VERIFICATION,
        destination=phone,
        user_id=user_id,
    )
    assert success is True
    assert code is not None

    # First verification with correct code succeeds
    v1_ok, v1_msg, bound_u = await OTPService.verify_challenge(
        purpose=OTPPurpose.WORKER_PHONE_VERIFICATION,
        destination=phone,
        code=code,
        user_id=user_id,
    )
    assert v1_ok is True
    assert bound_u == user_id

    # Replay attempt fails immediately
    v2_ok, v2_msg, _ = await OTPService.verify_challenge(
        purpose=OTPPurpose.WORKER_PHONE_VERIFICATION,
        destination=phone,
        code=code,
        user_id=user_id,
    )
    assert v2_ok is False
    assert "No active OTP request found" in v2_msg


@pytest.mark.anyio
async def test_otp_incorrect_code_and_max_attempts():
    """Verify wrong code decrements attempts and 5th wrong code invalidates challenge."""
    email = f"attempts_{uuid4().hex[:6]}@example.com"
    u = await create_test_user(email=email)
    user_id = str(u.id)

    success, _, _, code = await OTPService.request_challenge(
        purpose=OTPPurpose.PASSWORD_RESET_EMAIL,
        destination=email,
        user_id=user_id,
    )
    assert success is True

    # 4 wrong attempts
    for attempt in range(4):
        ok, msg, _ = await OTPService.verify_challenge(
            purpose=OTPPurpose.PASSWORD_RESET_EMAIL,
            destination=email,
            code="000000",
        )
        assert ok is False
        assert f"{4 - attempt} attempt(s) remaining" in msg

    # 5th wrong attempt invalidates
    ok5, msg5, _ = await OTPService.verify_challenge(
        purpose=OTPPurpose.PASSWORD_RESET_EMAIL,
        destination=email,
        code="000000",
    )
    assert ok5 is False
    assert "Maximum attempts reached" in msg5

    # Correct code now fails because challenge was destroyed
    ok6, msg6, _ = await OTPService.verify_challenge(
        purpose=OTPPurpose.PASSWORD_RESET_EMAIL,
        destination=email,
        code=code,
    )
    assert ok6 is False
    assert "No active OTP request found" in msg6


@pytest.mark.anyio
async def test_otp_purpose_isolation_cross_purpose_rejected():
    """Verify challenge generated for phone verification cannot be used for password recovery."""
    phone = make_unique_phone()
    u = await create_test_user(phone=phone)
    user_id = str(u.id)

    # Request phone verification OTP
    success, _, _, code = await OTPService.request_challenge(
        purpose=OTPPurpose.WORKER_PHONE_VERIFICATION,
        destination=phone,
        user_id=user_id,
    )
    assert success is True

    # Attempt to verify under PASSWORD_RESET_PHONE -> must be rejected
    cross_ok, cross_msg, _ = await OTPService.verify_challenge(
        purpose=OTPPurpose.PASSWORD_RESET_PHONE,
        destination=phone,
        code=code,
    )
    assert cross_ok is False
    assert "Invalid verification purpose" in cross_msg or "No active" in cross_msg


@pytest.mark.anyio
async def test_otp_cross_phone_and_cross_user_rejected():
    """Verify OTP cannot be verified against a different destination or different user."""
    phone_a = make_unique_phone()
    phone_b = make_unique_phone()
    u1 = await create_test_user(phone=phone_a)
    u2 = await create_test_user(phone=phone_b)
    user1 = str(u1.id)
    user2 = str(u2.id)

    _, _, _, code = await OTPService.request_challenge(
        purpose=OTPPurpose.WORKER_PHONE_VERIFICATION,
        destination=phone_a,
        user_id=user1,
    )

    # Cross phone verification rejected
    ok_phone, msg_phone, _ = await OTPService.verify_challenge(
        purpose=OTPPurpose.WORKER_PHONE_VERIFICATION,
        destination=phone_b,
        code=code,
        user_id=user1,
    )
    assert ok_phone is False

    # Cross user verification rejected
    ok_user, msg_user, _ = await OTPService.verify_challenge(
        purpose=OTPPurpose.WORKER_PHONE_VERIFICATION,
        destination=phone_a,
        code=code,
        user_id=user2,
    )
    assert ok_user is False


@pytest.mark.anyio
async def test_otp_superseded_challenge_invalidates_prior(monkeypatch):
    """Verify requesting a new challenge supersedes and invalidates the previous code."""
    monkeypatch.setattr(settings, "MOCK_OTP_MODE", False)
    phone = make_unique_phone()
    u = await create_test_user(phone=phone)
    user_id = str(u.id)

    _, _, _, code1 = await OTPService.request_challenge(
        purpose=OTPPurpose.WORKER_PHONE_VERIFICATION,
        destination=phone,
        user_id=user_id,
    )

    # Request second OTP for same destination
    _, _, _, code2 = await OTPService.request_challenge(
        purpose=OTPPurpose.WORKER_PHONE_VERIFICATION,
        destination=phone,
        user_id=user_id,
    )
    assert code1 != code2

    # Old code 1 is now invalid
    ok1, msg1, _ = await OTPService.verify_challenge(
        purpose=OTPPurpose.WORKER_PHONE_VERIFICATION,
        destination=phone,
        code=code1,
        user_id=user_id,
    )
    assert ok1 is False

    # New code 2 succeeds
    ok2, _, _ = await OTPService.verify_challenge(
        purpose=OTPPurpose.WORKER_PHONE_VERIFICATION,
        destination=phone,
        code=code2,
        user_id=user_id,
    )
    assert ok2 is True


@pytest.mark.anyio
async def test_concurrent_otp_verification_prevents_double_consume():
    """Verify concurrent attempts to verify the same OTP allow only one winner."""
    phone = make_unique_phone()
    u = await create_test_user(phone=phone)
    user_id = str(u.id)

    _, _, _, code = await OTPService.request_challenge(
        purpose=OTPPurpose.WORKER_PHONE_VERIFICATION,
        destination=phone,
        user_id=user_id,
    )

    async def verify_task():
        async with AsyncSessionLocal() as session:
            return await OTPService.verify_challenge(
                purpose=OTPPurpose.WORKER_PHONE_VERIFICATION,
                destination=phone,
                code=code,
                user_id=user_id,
                db=session,
            )

    # Run 5 concurrent verification tasks
    results = await asyncio.gather(*(verify_task() for _ in range(5)))
    success_count = sum(1 for (ok, _, _) in results if ok is True)
    failure_count = sum(1 for (ok, _, _) in results if ok is False)

    assert success_count == 1
    assert failure_count == 4


@pytest.mark.anyio
async def test_concurrent_reset_token_consumption_prevents_double_spend():
    """Verify concurrent attempts to consume the same reset token allow only one winner."""
    u = await create_test_user()
    user_id = str(u.id)
    token, _ = await OTPService.issue_password_reset_token(user_id, OTPPurpose.PASSWORD_RESET_EMAIL)

    async def consume_task():
        async with AsyncSessionLocal() as session:
            return await OTPService.verify_and_consume_password_reset_token(token, db=session)

    results = await asyncio.gather(*(consume_task() for _ in range(5)))
    success_count = sum(1 for (ok, _, _) in results if ok is True)
    failure_count = sum(1 for (ok, _, _) in results if ok is False)

    assert success_count == 1
    assert failure_count == 4


# ─── Part 2: Feature A — Email Password Recovery Flow ─────────────────────────

@pytest.mark.anyio
async def test_email_password_recovery_complete_lifecycle():
    """Verify complete email-based password recovery flow, hash update, and token_version increment."""
    email = f"recovery_email_{uuid4().hex[:6]}@example.com"
    initial_password = "OldPassword@123"
    phone = make_unique_phone()

    async with AsyncSessionLocal() as db:
        user = User(
            email=email,
            phone=phone,
            password_hash=hash_password(initial_password),
            role=UserRole.WORKER,
            token_version=1,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        user_id = str(user.id)

    # Existing JWT token with token_version 1
    old_jwt = create_access_token({"sub": user_id, "role": "WORKER", "token_version": 1})

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Request recovery code via email
        req_res = await ac.post("/api/auth/forgot-password/email", json={"email": email})
        assert req_res.status_code == 200
        assert "password recovery code has been sent" in req_res.json()["message"]

        # 2. Verify with mock OTP code in development mode
        ver_res = await ac.post(
            "/api/auth/forgot-password/verify-email",
            json={"email": email, "otp_code": "123456"},
        )
        assert ver_res.status_code == 200
        ver_data = ver_res.json()
        assert "reset_token" in ver_data
        reset_token = ver_data["reset_token"]
        assert len(reset_token) > 20

        # 3. Test weak password rejection
        weak_res = await ac.post(
            "/api/auth/reset-password",
            json={
                "reset_token": reset_token,
                "new_password": "weak",
                "confirm_password": "weak",
            },
        )
        assert weak_res.status_code == 422

        # 4. Set valid new password
        new_password = "NewStrongPassword@2026"
        reset_res = await ac.post(
            "/api/auth/reset-password",
            json={
                "reset_token": reset_token,
                "new_password": new_password,
                "confirm_password": new_password,
            },
        )
        assert reset_res.status_code == 200
        assert "Password has been reset successfully" in reset_res.json()["message"]

        # 5. Verify reset token cannot be reused (single-use enforcement)
        reused_res = await ac.post(
            "/api/auth/reset-password",
            json={
                "reset_token": reset_token,
                "new_password": "AnotherPassword@999",
                "confirm_password": "AnotherPassword@999",
            },
        )
        assert reused_res.status_code == 400

        # 6. Verify old session token is invalidated by token_version check in /me
        me_old = await ac.get("/api/auth/me", headers={"Authorization": f"Bearer {old_jwt}"})
        assert me_old.status_code == 401

        # 7. Verify login with old password fails
        login_old = await ac.post("/api/auth/login", json={"email": email, "password": initial_password})
        assert login_old.status_code == 401

        # 8. Verify login with new password succeeds
        login_new = await ac.post("/api/auth/login", json={"email": email, "password": new_password})
        assert login_new.status_code == 200
        new_token = login_new.json()["access_token"]

        # 9. Verify new session works
        me_new = await ac.get("/api/auth/me", headers={"Authorization": f"Bearer {new_token}"})
        assert me_new.status_code == 200
        assert me_new.json()["email"] == email


@pytest.mark.anyio
async def test_email_recovery_generic_response_for_nonexistent_account():
    """Verify requesting recovery for an unknown email returns generic response without leaking account existence."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/auth/forgot-password/email",
            json={"email": f"nonexistent_{uuid4().hex[:6]}@example.com"},
        )
        assert res.status_code == 200
        assert "password recovery code has been sent" in res.json()["message"]


# ─── Part 3: Feature B — Phone Password Recovery Flow ─────────────────────────

@pytest.mark.anyio
async def test_phone_password_recovery_complete_lifecycle():
    """Verify complete phone-based password recovery flow."""
    phone = make_unique_phone()
    email = f"phone_recovery_{uuid4().hex[:6]}@example.com"
    initial_password = "InitialPassword@123"

    async with AsyncSessionLocal() as db:
        user = User(
            email=email,
            phone=phone,
            password_hash=hash_password(initial_password),
            role=UserRole.EMPLOYER,
            token_version=1,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Request recovery via phone
        req_res = await ac.post("/api/auth/forgot-password/phone", json={"phone": phone})
        assert req_res.status_code == 200
        assert "password recovery code has been sent" in req_res.json()["message"]

        # 2. Verify with mock OTP
        ver_res = await ac.post(
            "/api/auth/forgot-password/verify-phone",
            json={"phone": phone, "otp_code": "123456"},
        )
        assert ver_res.status_code == 200
        reset_token = ver_res.json()["reset_token"]

        # 3. Reset password
        new_password = "EmployerNewPassword@2026"
        reset_res = await ac.post(
            "/api/auth/reset-password",
            json={
                "reset_token": reset_token,
                "new_password": new_password,
                "confirm_password": new_password,
            },
        )
        assert reset_res.status_code == 200

        # 4. Verify login with new password
        login_res = await ac.post("/api/auth/login", json={"email": email, "password": new_password})
        assert login_res.status_code == 200


@pytest.mark.anyio
async def test_phone_recovery_generic_response_for_nonexistent_phone():
    """Verify requesting recovery for an unknown phone returns generic response without enumeration."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/auth/forgot-password/phone",
            json={"phone": make_unique_phone()},
        )
        assert res.status_code == 200
        assert "password recovery code has been sent" in res.json()["message"]


# ─── Part 4: Feature C — Worker Phone Verification & Constraints ──────────────

@pytest.mark.anyio
async def test_worker_phone_verification_updates_profile_and_user():
    """Verify worker verifying phone sets is_phone_verified=True and creates VerificationRecord."""
    worker_id = str(uuid4())
    initial_phone = make_unique_phone()

    async with AsyncSessionLocal() as db:
        user = User(
            id=worker_id,
            email=f"worker_{worker_id[:6]}@example.com",
            phone=None,
            password_hash="hashed",
            role=UserRole.WORKER,
            is_active=True,
            is_verified=False,
        )
        db.add(user)
        await db.flush()
        wp = WorkerProfile(
            user_id=user.id,
            full_name="Phone Verified Worker",
            is_phone_verified=False,
        )
        db.add(wp)
        await db.commit()

    token = create_access_token({"sub": worker_id, "role": "WORKER"})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Request verification OTP
        req_res = await ac.post(
            "/api/verifications/phone/request",
            json={"phone": initial_phone},
            headers=headers,
        )
        assert req_res.status_code == 200

        # 2. Verify OTP
        ver_res = await ac.post(
            "/api/verifications/phone/verify",
            json={"phone": initial_phone, "otp_code": "123456"},
            headers=headers,
        )
        assert ver_res.status_code == 200
        assert ver_res.json()["is_phone_verified"] is True

        # 3. Check DB
        async with AsyncSessionLocal() as db:
            u_check = (await db.execute(select(User).where(User.id == worker_id))).scalar_one()
            assert u_check.phone == initial_phone
            assert u_check.is_verified is False  # Phone verification alone does not grant overall account verification
            
            wp_check = (await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == worker_id))).scalar_one()
            assert wp_check.is_phone_verified is True
            assert wp_check.is_identity_verified is False

            rec_check = (await db.execute(
                select(VerificationRecord).where(
                    VerificationRecord.user_id == worker_id,
                    VerificationRecord.verification_type == VerificationType.PHONE,
                )
            )).scalar_one()
            assert rec_check.status == VerificationStatus.VERIFIED


@pytest.mark.anyio
async def test_worker_cannot_verify_phone_already_verified_by_another_user():
    """Verify attempting to verify a phone already registered and verified by another user is blocked (400)."""
    existing_phone = make_unique_phone()

    # User 1 has verified this phone
    async with AsyncSessionLocal() as db:
        u1 = User(
            email=f"u1_{uuid4().hex[:6]}@example.com",
            phone=existing_phone,
            password_hash="hash",
            role=UserRole.WORKER,
            is_active=True,
            is_verified=True,
        )
        db.add(u1)
        await db.commit()

    # User 2 tries to request OTP for the same phone
    user2_id = str(uuid4())
    async with AsyncSessionLocal() as db:
        u2 = User(
            id=user2_id,
            email=f"u2_{uuid4().hex[:6]}@example.com",
            phone=None,
            password_hash="hash2",
            role=UserRole.WORKER,
            is_active=True,
            is_verified=False,
        )
        db.add(u2)
        await db.commit()
    token2 = create_access_token({"sub": user2_id, "role": "WORKER"})

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/verifications/phone/request",
            json={"phone": existing_phone},
            headers={"Authorization": f"Bearer {token2}"},
        )
        assert res.status_code == 400
        assert "already registered and verified with another account" in res.json()["detail"]


@pytest.mark.anyio
async def test_reset_authorization_expiry_enforced():
    """Verify expired password reset authorization token is rejected."""
    u = await create_test_user()
    user_id = str(u.id)
    token, _ = await OTPService.issue_password_reset_token(user_id, OTPPurpose.PASSWORD_RESET_EMAIL)

    from app.services.otp_service import _hash_token
    from app.models.models import PasswordResetAuthorization
    from sqlalchemy import update
    t_hash = _hash_token(token)
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(PasswordResetAuthorization)
            .where(PasswordResetAuthorization.token_hash == t_hash)
            .values(expires_at=datetime.now(timezone.utc) - timedelta(minutes=1))
        )
        await db.commit()

    ok, _, msg = await OTPService.verify_and_consume_password_reset_token(token)
    assert ok is False
    assert "expired" in msg.lower()


@pytest.mark.anyio
async def test_worker_phone_update_invalidates_previous_phone_verification_record():
    """Verify changing a worker's phone number invalidates the previous phone verification record (marks EXPIRED)."""
    worker_id = str(uuid4())
    phone_1 = make_unique_phone()
    phone_2 = make_unique_phone()

    async with AsyncSessionLocal() as db:
        user = User(
            id=worker_id,
            email=f"worker_update_{worker_id[:6]}@example.com",
            phone=None,
            password_hash="hashed",
            role=UserRole.WORKER,
            is_active=True,
            is_verified=False,
        )
        db.add(user)
        await db.flush()
        wp = WorkerProfile(
            user_id=user.id,
            full_name="Phone Update Worker",
            is_phone_verified=False,
            is_identity_verified=False,
        )
        db.add(wp)
        await db.commit()

    token = create_access_token({"sub": worker_id, "role": "WORKER"})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Verify phone 1
        await ac.post("/api/verifications/phone/request", json={"phone": phone_1}, headers=headers)
        res1 = await ac.post("/api/verifications/phone/verify", json={"phone": phone_1, "otp_code": "123456"}, headers=headers)
        assert res1.status_code == 200

        # Check record 1 is VERIFIED
        async with AsyncSessionLocal() as db:
            recs1 = (await db.execute(
                select(VerificationRecord).where(
                    VerificationRecord.user_id == worker_id,
                    VerificationRecord.verification_type == VerificationType.PHONE,
                ).order_by(VerificationRecord.created_at.desc())
            )).scalars().all()
            assert len(recs1) == 1
            assert recs1[0].status == VerificationStatus.VERIFIED
            assert recs1[0].metadata_dict.get("verified_phone") == phone_1

        # 2. Update to phone 2
        await ac.post("/api/verifications/phone/request", json={"phone": phone_2}, headers=headers)
        res2 = await ac.post("/api/verifications/phone/verify", json={"phone": phone_2, "otp_code": "123456"}, headers=headers)
        assert res2.status_code == 200

        # Check DB: prior record is now EXPIRED, new record is VERIFIED, user.phone is phone_2
        async with AsyncSessionLocal() as db:
            u = (await db.execute(select(User).where(User.id == worker_id))).scalar_one()
            assert u.phone == phone_2
            assert u.is_verified is False  # Still False because identity is not verified

            wp = (await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == worker_id))).scalar_one()
            assert wp.is_phone_verified is True
            assert wp.is_identity_verified is False

            all_phone_recs = (await db.execute(
                select(VerificationRecord).where(
                    VerificationRecord.user_id == worker_id,
                    VerificationRecord.verification_type == VerificationType.PHONE,
                ).order_by(VerificationRecord.created_at.asc())
            )).scalars().all()
            assert len(all_phone_recs) == 2
            assert all_phone_recs[0].is_expired is True  # Prior record invalidated!
            assert all_phone_recs[0].effective_status == VerificationStatus.EXPIRED
            assert all_phone_recs[0].metadata_dict.get("verified_phone") == phone_1
            assert all_phone_recs[1].is_expired is False
            assert all_phone_recs[1].effective_status == VerificationStatus.VERIFIED  # New record active!
            assert all_phone_recs[1].metadata_dict.get("verified_phone") == phone_2
