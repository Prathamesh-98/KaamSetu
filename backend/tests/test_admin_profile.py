"""KaamSetu — Admin Profile and Account Management Test Suite (Phase 2)

Verifies:
- Admin profile retrieval and automatic profile initialization if absent.
- Admin profile updates (full_name, phone, department).
- Profile input validation (short name, invalid phone characters).
- RBAC guards: Workers and Employers receive 403 Forbidden.
- Unauthenticated requests receive 401 Unauthorized.
- Admin password change workflow:
  - Success with valid current password and login verification.
  - Failure on incorrect current password (400).
  - Failure on password reuse (400).
  - Validation failure on weak password (422).
- Password hashes and raw passwords are never exposed in profile or password responses.
- Existing admin stats and verification queue endpoints remain functional and protected.

All tests run strictly against the isolated test database: kaamsetu_test.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from uuid import uuid4
from datetime import datetime, timezone
from sqlalchemy import select

from app.main import app
from app.core.security import create_access_token, hash_password, verify_password
from app.core.config import settings
from app.db.session import engine, AsyncSessionLocal
from app.models.models import (
    Base, User, UserRole, AdminProfile, WorkerProfile, EmployerProfile
)


@pytest.fixture
def anyio_backend():
    return 'asyncio'


@pytest.fixture(autouse=True)
async def ensure_test_schema_and_cleanup():
    """Ensure admin_profiles and required tables exist in kaamsetu_test."""
    from sqlalchemy import update
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Release +919876543210 if held by a test admin
    async with AsyncSessionLocal() as session:
        await session.execute(
            update(User)
            .where((User.phone == "+919876543210") & (User.id != "58427761-6768-4988-aead-b304fd2760a4"))
            .values(phone=None)
        )
        await session.commit()

    yield
    await engine.dispose()


def random_phone() -> str:
    return f"+9198{uuid4().int % 100000000:08d}"


async def create_synthetic_admin(
    email: str = None,
    password: str = "AdminSecret123",
    full_name: str = "System Admin",
    department: str = "Platform Operations",
    phone: str = None
) -> tuple[User, str]:
    """Helper to create a fresh synthetic admin in the isolated test DB."""
    admin_id = str(uuid4())
    if not email:
        email = f"admin_{admin_id[:8]}@kaamsetu.in"
    if not phone:
        phone = random_phone()

    hashed = hash_password(password)
    async with AsyncSessionLocal() as session:
        user = User(
            id=admin_id,
            email=email,
            password_hash=hashed,
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
            phone=phone,
        )
        session.add(user)
        await session.flush()

        profile = AdminProfile(
            user_id=user.id,
            full_name=full_name,
            phone=phone,
            department=department,
        )
        session.add(profile)
        await session.commit()
        await session.refresh(user)

    token = create_access_token({
        "sub": str(admin_id),
        "role": "ADMIN",
        "token_version": user.token_version,
    })
    return user, token


# ─── Part 1: Admin Profile Retrieval and Auto-Initialization ──────────────────

@pytest.mark.anyio
async def test_get_admin_profile_success():
    """Verify an admin can retrieve their profile details."""
    phone = random_phone()
    admin_user, token = await create_synthetic_admin(
        full_name="Chief Administrator",
        department="Governance",
        phone=phone
    )
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/admin/profile", headers=headers)
        assert res.status_code == 200
        data = res.json()

        assert data["email"] == admin_user.email
        assert data["role"] == "ADMIN"
        assert data["full_name"] == "Chief Administrator"
        assert data["department"] == "Governance"
        assert data["phone"] == phone
        assert "password_hash" not in data
        assert "password" not in data


@pytest.mark.anyio
async def test_get_admin_profile_auto_initialization():
    """Verify an admin user without an AdminProfile record gets auto-initialized on first fetch."""
    admin_id = str(uuid4())
    email = f"bare_admin_{admin_id[:8]}@kaamsetu.in"
    hashed = hash_password("BareAdminPass1")
    phone = random_phone()

    async with AsyncSessionLocal() as session:
        user = User(
            id=admin_id,
            email=email,
            password_hash=hashed,
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
            phone=phone,
        )
        session.add(user)
        await session.commit()

    token = create_access_token({
        "sub": str(admin_id),
        "role": "ADMIN",
        "token_version": user.token_version,
    })
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/admin/profile", headers=headers)
        assert res.status_code == 200
        data = res.json()

        assert data["email"] == email
        assert data["role"] == "ADMIN"
        assert data["full_name"] == email.split("@")[0].capitalize()
        assert data["department"] == "Operations"
        assert data["phone"] == phone

    # Verify row was persisted in DB
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(AdminProfile).where(AdminProfile.user_id == admin_id))
        prof = result.scalar_one_or_none()
        assert prof is not None
        assert prof.department == "Operations"


# ─── Part 2: Admin Profile Updates and Validation ─────────────────────────────

@pytest.mark.anyio
async def test_update_admin_profile_success():
    """Verify admin can update full_name, phone, and department."""
    admin_user, token = await create_synthetic_admin()
    headers = {"Authorization": f"Bearer {token}"}

    new_phone = random_phone()
    update_payload = {
        "full_name": "Senior Trust & Safety Officer",
        "phone": new_phone,
        "department": "Trust & Safety",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.put("/api/admin/profile", json=update_payload, headers=headers)
        assert res.status_code == 200
        data = res.json()

        assert data["full_name"] == "Senior Trust & Safety Officer"
        assert data["phone"] == new_phone
        assert data["department"] == "Trust & Safety"
        assert data["email"] == admin_user.email
        assert data["role"] == "ADMIN"

    # Verify persistence in DB
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(AdminProfile).where(AdminProfile.user_id == admin_user.id))
        prof = result.scalar_one()
        assert prof.full_name == "Senior Trust & Safety Officer"
        assert prof.phone == new_phone
        assert prof.department == "Trust & Safety"


@pytest.mark.anyio
async def test_admin_profile_validation_errors():
    """Verify input validation fails for invalid phone or short full_name."""
    _, token = await create_synthetic_admin()
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Invalid phone characters
        res1 = await ac.put(
            "/api/admin/profile",
            json={"phone": "INVALID_PHONE_#$@!"},
            headers=headers
        )
        assert res1.status_code == 422

        # Too short full_name (<2 chars)
        res2 = await ac.put(
            "/api/admin/profile",
            json={"full_name": "A"},
            headers=headers
        )
        assert res2.status_code == 422

        # Whitespace-only full_name
        res3 = await ac.put(
            "/api/admin/profile",
            json={"full_name": "   "},
            headers=headers
        )
        assert res3.status_code == 422


# ─── Part 3: RBAC and Unauthorized Access Denial ──────────────────────────────

@pytest.mark.anyio
async def test_worker_and_employer_forbidden_from_admin_profile():
    """Verify workers and employers receive 403 Forbidden for admin profile endpoints."""
    worker_id = "58427761-6768-4988-aead-b304fd2760a4"
    employer_id = "da87f7a4-6cbf-419c-af92-5c1754ec6662"

    worker_token = create_access_token({"sub": worker_id, "role": "WORKER"})
    employer_token = create_access_token({"sub": employer_id, "role": "EMPLOYER"})

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Worker attempts
        w_get = await ac.get("/api/admin/profile", headers={"Authorization": f"Bearer {worker_token}"})
        assert w_get.status_code == 403

        w_put = await ac.put(
            "/api/admin/profile",
            json={"full_name": "Hacker"},
            headers={"Authorization": f"Bearer {worker_token}"}
        )
        assert w_put.status_code == 403

        w_pwd = await ac.post(
            "/api/admin/change-password",
            json={"current_password": "pass", "new_password": "NewPassword123"},
            headers={"Authorization": f"Bearer {worker_token}"}
        )
        assert w_pwd.status_code == 403

        # Employer attempts
        e_get = await ac.get("/api/admin/profile", headers={"Authorization": f"Bearer {employer_token}"})
        assert e_get.status_code == 403

        e_put = await ac.put(
            "/api/admin/profile",
            json={"full_name": "Hacker"},
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert e_put.status_code == 403

        e_pwd = await ac.post(
            "/api/admin/change-password",
            json={"current_password": "pass", "new_password": "NewPassword123"},
            headers={"Authorization": f"Bearer {employer_token}"}
        )
        assert e_pwd.status_code == 403


@pytest.mark.anyio
async def test_unauthenticated_requests_denied():
    """Verify unauthenticated requests receive 401 or 403 (FastAPI HTTPBearer missing header)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Missing Authorization header
        res_get = await ac.get("/api/admin/profile")
        assert res_get.status_code in (401, 403)

        res_put = await ac.put("/api/admin/profile", json={"full_name": "Test"})
        assert res_put.status_code in (401, 403)

        res_pwd = await ac.post("/api/admin/change-password", json={"current_password": "a", "new_password": "b"})
        assert res_pwd.status_code in (401, 403)

        # Invalid bearer token
        invalid_headers = {"Authorization": "Bearer invalid_token_123"}
        res_invalid = await ac.get("/api/admin/profile", headers=invalid_headers)
        assert res_invalid.status_code == 401


# ─── Part 4: Change Password Workflow ─────────────────────────────────────────

@pytest.mark.anyio
async def test_change_password_success_and_login_verification():
    """Verify admin changes password, can login with new password, and old password fails."""
    old_password = "OldAdminPass123"
    new_password = "NewStrongPass456"
    admin_user, token = await create_synthetic_admin(password=old_password)
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Change password
        res = await ac.post(
            "/api/admin/change-password",
            json={"current_password": old_password, "new_password": new_password},
            headers=headers
        )
        assert res.status_code == 200
        assert res.json()["message"] == "Password changed successfully"

        # 2. Login with old password must fail
        login_old = await ac.post(
            "/api/auth/login",
            json={"email": admin_user.email, "password": old_password}
        )
        assert login_old.status_code == 401

        # 3. Login with new password must succeed
        login_new = await ac.post(
            "/api/auth/login",
            json={"email": admin_user.email, "password": new_password}
        )
        assert login_new.status_code == 200
        new_token = login_new.json()["access_token"]
        assert new_token is not None

        # 4. Previously issued token MUST now be revoked and rejected with 401
        revoked_res = await ac.get("/api/admin/profile", headers=headers)
        assert revoked_res.status_code == 401
        assert "revoked" in revoked_res.json()["detail"].lower()

        # 5. New token must work cleanly
        valid_res = await ac.get("/api/admin/profile", headers={"Authorization": f"Bearer {new_token}"})
        assert valid_res.status_code == 200
        assert valid_res.json()["email"] == admin_user.email


@pytest.mark.anyio
async def test_change_password_wrong_current_password():
    """Verify changing password fails when incorrect current password is provided."""
    admin_user, token = await create_synthetic_admin(password="CorrectPass123")
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/admin/change-password",
            json={"current_password": "WrongPassword999", "new_password": "BrandNewPass123"},
            headers=headers
        )
        assert res.status_code == 400
        assert "Incorrect current password" in res.json()["detail"]


@pytest.mark.anyio
async def test_change_password_reuse_rejected():
    """Verify changing password rejects reusing the same password."""
    current_pass = "ExistingPassword123"
    admin_user, token = await create_synthetic_admin(password=current_pass)
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/admin/change-password",
            json={"current_password": current_pass, "new_password": current_pass},
            headers=headers
        )
        assert res.status_code == 400
        assert "same as the current password" in res.json()["detail"]


@pytest.mark.anyio
async def test_change_password_complexity_validation():
    """Verify password complexity rules: >=8 chars, uppercase, digit."""
    admin_user, token = await create_synthetic_admin(password="CurrentValidPass1")
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Too short (<8 chars)
        res1 = await ac.post(
            "/api/admin/change-password",
            json={"current_password": "CurrentValidPass1", "new_password": "Short1"},
            headers=headers
        )
        assert res1.status_code == 422

        # No uppercase letter
        res2 = await ac.post(
            "/api/admin/change-password",
            json={"current_password": "CurrentValidPass1", "new_password": "nouppercasehere123"},
            headers=headers
        )
        assert res2.status_code == 422

        # No digit
        res3 = await ac.post(
            "/api/admin/change-password",
            json={"current_password": "CurrentValidPass1", "new_password": "NoDigitsAtAllHere"},
            headers=headers
        )
        assert res3.status_code == 422


# ─── Part 5: Password Hash Exposure Security Check ────────────────────────────

@pytest.mark.anyio
async def test_password_hash_never_exposed():
    """Verify password hash is never exposed in profile or password responses."""
    admin_user, token = await create_synthetic_admin()
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # GET profile
        res_get = await ac.get("/api/admin/profile", headers=headers)
        text_get = res_get.text.lower()
        assert "password_hash" not in text_get
        assert "password" not in res_get.json()

        # PUT profile
        res_put = await ac.put(
            "/api/admin/profile",
            json={"department": "Security Ops"},
            headers=headers
        )
        text_put = res_put.text.lower()
        assert "password_hash" not in text_put
        assert "password" not in res_put.json()

        # POST change-password
        res_pwd = await ac.post(
            "/api/admin/change-password",
            json={"current_password": "AdminSecret123", "new_password": "FreshNewSecret456"},
            headers=headers
        )
        text_pwd = res_pwd.text.lower()
        assert "password_hash" not in text_pwd
        assert "new_password" not in text_pwd


# ─── Part 6: Preservation of Existing Admin Endpoints ─────────────────────────

@pytest.mark.anyio
async def test_existing_admin_stats_and_verification_queue_intact():
    """Verify existing admin stats and verification queue endpoints remain functional and protected."""
    admin_user, token = await create_synthetic_admin()
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Stats endpoint
        res_stats = await ac.get("/api/admin/stats", headers=headers)
        assert res_stats.status_code == 200
        stats_data = res_stats.json()
        assert "total_users" in stats_data
        assert "total_jobs" in stats_data

        # Verification queue endpoint
        res_queue = await ac.get("/api/admin/verifications/queue", headers=headers)
        assert res_queue.status_code == 200
        assert isinstance(res_queue.json(), list)


# ─── Part 7: Phase 2.1 Token Revocation Hardening Tests ───────────────────────

@pytest.mark.anyio
async def test_token_revocation_old_token_rejected_after_password_change():
    """Verify that after an admin changes password, all previous sessions/tokens are revoked."""
    orig_password = "PasswordOriginal123"
    new_password = "PasswordUpdated456"
    admin_user, token_v1 = await create_synthetic_admin(password=orig_password)
    v1_headers = {"Authorization": f"Bearer {token_v1}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Pre-condition: token_v1 works
        pre_res = await ac.get("/api/admin/profile", headers=v1_headers)
        assert pre_res.status_code == 200

        # Change password
        change_res = await ac.post(
            "/api/admin/change-password",
            json={"current_password": orig_password, "new_password": new_password},
            headers=v1_headers
        )
        assert change_res.status_code == 200

        # Post-condition: token_v1 is now revoked!
        post_prof = await ac.get("/api/admin/profile", headers=v1_headers)
        assert post_prof.status_code == 401
        assert "revoked" in post_prof.json()["detail"].lower()

        post_stats = await ac.get("/api/admin/stats", headers=v1_headers)
        assert post_stats.status_code == 401
        assert "revoked" in post_stats.json()["detail"].lower()


@pytest.mark.anyio
async def test_token_revocation_legacy_token_compatibility_and_revocation():
    """Verify legacy tokens (without token_version claim) work before password change and are rejected after."""
    orig_password = "LegacyTestPass123"
    new_password = "LegacyNewPass456"
    admin_user, _ = await create_synthetic_admin(password=orig_password)

    # Synthetic legacy token: has NO token_version claim
    legacy_token = create_access_token({"sub": str(admin_user.id), "role": "ADMIN"})
    legacy_headers = {"Authorization": f"Bearer {legacy_token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Legacy token works prior to password change (backward compatibility)
        pre_res = await ac.get("/api/admin/profile", headers=legacy_headers)
        assert pre_res.status_code == 200

        # 2. Change password using legitimate request
        change_res = await ac.post(
            "/api/admin/change-password",
            json={"current_password": orig_password, "new_password": new_password},
            headers=legacy_headers
        )
        assert change_res.status_code == 200

        # 3. Legacy token is now revoked because DB token_version is 2
        post_res = await ac.get("/api/admin/profile", headers=legacy_headers)
        assert post_res.status_code == 401
        assert "revoked" in post_res.json()["detail"].lower()


@pytest.mark.anyio
async def test_token_revocation_tampered_or_stale_version_rejected():
    """Verify tokens with mismatched/stale version claims are rejected."""
    admin_user, _ = await create_synthetic_admin()

    # Token with forward/future version claim (e.g. 99)
    future_token = create_access_token({
        "sub": str(admin_user.id),
        "role": "ADMIN",
        "token_version": 99,
    })

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/admin/profile", headers={"Authorization": f"Bearer {future_token}"})
        assert res.status_code == 401
        assert "revoked" in res.json()["detail"].lower()


@pytest.mark.anyio
async def test_normal_login_issues_token_with_token_version():
    """Verify standard auth login returns an access token containing the active token_version."""
    from app.core.security import decode_access_token
    password = "NormalLoginPass123"
    admin_user, _ = await create_synthetic_admin(password=password)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        login_res = await ac.post(
            "/api/auth/login",
            json={"email": admin_user.email, "password": password}
        )
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        payload = decode_access_token(token)

        assert "token_version" in payload
        assert payload["token_version"] == 1
        assert payload["sub"] == str(admin_user.id)
        assert payload["role"] == "ADMIN"


@pytest.mark.anyio
async def test_worker_employer_admin_authorization_unaffected():
    """Verify role-based authorization guards remain strictly enforced with versioned tokens."""
    worker_id = "58427761-6768-4988-aead-b304fd2760a4"
    employer_id = "da87f7a4-6cbf-419c-af92-5c1754ec6662"

    worker_token = create_access_token({"sub": worker_id, "role": "WORKER", "token_version": 1})
    employer_token = create_access_token({"sub": employer_id, "role": "EMPLOYER", "token_version": 1})

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Worker cannot access admin profile
        w_res = await ac.get("/api/admin/profile", headers={"Authorization": f"Bearer {worker_token}"})
        assert w_res.status_code == 403

        # Employer cannot access admin profile
        e_res = await ac.get("/api/admin/profile", headers={"Authorization": f"Bearer {employer_token}"})
        assert e_res.status_code == 403

        # Worker can access /api/auth/me
        me_res = await ac.get("/api/auth/me", headers={"Authorization": f"Bearer {worker_token}"})
        assert me_res.status_code == 200
        assert me_res.json()["id"] == worker_id


# ─── Part 6: Secure Admin Password Reset Script Verification (CLI Tests) ──────

@pytest.mark.anyio
async def test_reset_script_environment_safety_fail_closed():
    """Verify reset script fails closed on missing, unrecognized, or production environments."""
    from scripts.reset_admin_password import verify_environment_safety

    # Valid environments pass
    verify_environment_safety("development")
    verify_environment_safety("test")
    verify_environment_safety("local")

    # Invalid / production / unrecognized fail closed
    for bad_env in ["production", "prod", "staging", "uat", "", None, "unknown_cloud"]:
        with pytest.raises(ValueError, match="CRITICAL SAFETY ABORT"):
            verify_environment_safety(bad_env)


@pytest.mark.anyio
async def test_reset_script_database_target_guard():
    """Verify reset script rejects remote database hosts."""
    from scripts.reset_admin_password import verify_database_target

    # Valid loopback targets pass
    verify_database_target("postgresql+asyncpg://postgres:secret@localhost:5432/kaamsetu")
    verify_database_target("postgresql+asyncpg://postgres:secret@127.0.0.1:5432/kaamsetu_test")

    # Remote hosts fail closed
    for bad_url in [
        "postgresql+asyncpg://admin:secret@192.168.1.50:5432/kaamsetu",
        "postgresql+asyncpg://admin:secret@db.prod.aws.com:5432/kaamsetu",
        "postgresql+asyncpg://admin:secret@10.0.0.5:5432/kaamsetu",
    ]:
        with pytest.raises(ValueError, match="CRITICAL SAFETY ABORT"):
            verify_database_target(bad_url)


@pytest.mark.anyio
async def test_reset_script_complexity_validation():
    """Verify reset script enforces password complexity matching application standards."""
    from scripts.reset_admin_password import validate_password_complexity

    # Valid passwords pass
    validate_password_complexity("ValidPass123!")
    validate_password_complexity("Another9Valid")

    # Invalid passwords fail
    with pytest.raises(ValueError, match="at least 8 characters"):
        validate_password_complexity("Short1A")

    with pytest.raises(ValueError, match="uppercase letter"):
        validate_password_complexity("nouppercase123")

    with pytest.raises(ValueError, match="at least one digit"):
        validate_password_complexity("NoDigitsHere!")


@pytest.mark.anyio
async def test_reset_script_atomic_reset_and_token_revocation():
    """Verify reset_admin_password_in_session atomically resets hash and revokes tokens."""
    from scripts.reset_admin_password import reset_admin_password_in_session
    from app.core.security import verify_password

    # Create synthetic admin in test database
    initial_pw = "OriginalAdmin123"
    new_pw = "BrandNewAdmin2026!"
    admin_user, _ = await create_synthetic_admin(password=initial_pw)
    orig_version = admin_user.token_version

    async with AsyncSessionLocal() as session:
        new_version = await reset_admin_password_in_session(
            session=session,
            new_password=new_pw,
            target_email=admin_user.email,
            enforce_target_check=False,
        )

    # Reload from DB and verify
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(User).where(User.id == admin_user.id))
        reloaded = res.scalar_one()

        assert new_version == orig_version + 1
        assert reloaded.token_version == new_version
        assert not verify_password(initial_pw, reloaded.password_hash)
        assert verify_password(new_pw, reloaded.password_hash)

        # Password reuse check: resetting with same password raises error
        with pytest.raises(ValueError, match="cannot be the same"):
            await reset_admin_password_in_session(
                session=session,
                new_password=new_pw,
                target_email=admin_user.email,
                enforce_target_check=False,
            )


@pytest.mark.anyio
async def test_reset_script_rejects_non_admin_and_non_existent():
    """Verify reset script rejects accounts that do not exist or are not ADMIN."""
    from scripts.reset_admin_password import reset_admin_password_in_session

    async with AsyncSessionLocal() as session:
        # 1. Non-existent email
        with pytest.raises(ValueError, match="does not exist"):
            await reset_admin_password_in_session(
                session=session,
                new_password="NewValidPass123",
                target_email="nonexistent_user@kaamsetu.in",
                enforce_target_check=False,
            )

        # 2. Worker account (cannot be reset by admin password reset script)
        worker_id = "58427761-6768-4988-aead-b304fd2760a4"
        res = await session.execute(select(User).where(User.id == worker_id))
        worker = res.scalar_one_or_none()
        if worker:
            with pytest.raises(ValueError, match="not 'ADMIN'"):
                await reset_admin_password_in_session(
                    session=session,
                    new_password="NewValidPass123",
                    target_email=worker.email,
                    enforce_target_check=False,
                )

        # 3. Target lock check: enforce_target_check=True blocks non-admin@kaamsetu.in
        with pytest.raises(ValueError, match="strictly locked"):
            await reset_admin_password_in_session(
                session=session,
                new_password="NewValidPass123",
                target_email="other_admin@kaamsetu.in",
                enforce_target_check=True,
            )
