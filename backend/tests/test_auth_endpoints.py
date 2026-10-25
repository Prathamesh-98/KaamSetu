"""
KaamSetu — Authentication Endpoints & Security Test Suite
Covers Phase 4.4.2 requirements:
- Successful worker and employer registration
- Phone uniqueness pre-check and duplicate-phone rejection (HTTP 400)
- Missing optional phone registration
- Duplicate email rejection (HTTP 400)
- Admin self-registration rejection (HTTP 403)
- Password validation failures (HTTP 422)
- Successful login (including case-insensitive email)
- Invalid password and non-existent email rejection (HTTP 401)
- Inactive user account login rejection (HTTP 403)
- Safe IntegrityError handling and transaction rollback
- Production Settings validation for email and SMS provider configurations
"""
import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from uuid import uuid4
import secrets
from unittest.mock import patch
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select

from app.main import app
from app.db.session import engine, AsyncSessionLocal
from app.models.models import User, UserRole
from app.core.security import hash_password, decode_access_token
from app.core.rate_limit import _rate_limits
from app.core.config import Settings


def make_unique_phone() -> str:
    """Generate a unique valid Indian E.164 phone number."""
    return f"+9198{secrets.randbelow(89999999) + 10000000}"


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
async def reset_rate_limits():
    """Ensure clean rate-limit counters before and after each test."""
    _rate_limits.clear()
    yield
    _rate_limits.clear()
    await engine.dispose()


# ─── 1. Registration Success Cases ──────────────────────────────────────────

@pytest.mark.anyio
async def test_worker_registration_success():
    """Verify that a worker can register with email, phone, and strong password."""
    unique_email = f"worker_{uuid4().hex[:8]}@example.com"
    phone = make_unique_phone()
    payload = {
        "email": unique_email,
        "password": "ValidPassword123!",
        "role": "WORKER",
        "phone": phone,
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/auth/register", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["expires_in"] > 0
    assert data["user"]["email"] == unique_email.lower()
    assert data["user"]["role"] == "WORKER"
    assert data["user"]["phone"] == phone

    # Verify access token payload
    token_claims = decode_access_token(data["access_token"])
    assert token_claims is not None
    assert token_claims["sub"] == data["user"]["id"]
    assert token_claims["role"] == "WORKER"


@pytest.mark.anyio
async def test_employer_registration_success():
    """Verify that an employer can register with valid credentials."""
    unique_email = f"employer_{uuid4().hex[:8]}@example.com"
    phone = make_unique_phone()
    payload = {
        "email": unique_email,
        "password": "SecurePassword456!",
        "role": "EMPLOYER",
        "phone": phone,
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/auth/register", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == unique_email.lower()
    assert data["user"]["role"] == "EMPLOYER"


@pytest.mark.anyio
async def test_registration_missing_optional_phone():
    """Verify that phone is optional during registration."""
    unique_email = f"nophone_{uuid4().hex[:8]}@example.com"
    payload = {
        "email": unique_email,
        "password": "ValidPassword123!",
        "role": "WORKER",
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/auth/register", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["user"]["phone"] is None


# ─── 2. Registration Validation & Constraint Rejections ─────────────────────

@pytest.mark.anyio
async def test_duplicate_email_registration_rejected():
    """Verify registration rejects duplicate email (including case variations) with HTTP 400."""
    base_name = uuid4().hex[:8]
    email = f"test_{base_name}@example.com"
    phone1 = make_unique_phone()
    phone2 = make_unique_phone()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Register first user
        r1 = await client.post("/api/auth/register", json={
            "email": email,
            "password": "ValidPassword123!",
            "role": "WORKER",
            "phone": phone1,
        })
        assert r1.status_code == 201

        # Attempt to register second user with same email (uppercase variation)
        r2 = await client.post("/api/auth/register", json={
            "email": email.upper(),
            "password": "ValidPassword123!",
            "role": "EMPLOYER",
            "phone": phone2,
        })
        assert r2.status_code == 400
        assert "Email already registered" in r2.json()["detail"]


@pytest.mark.anyio
async def test_duplicate_phone_registration_rejected():
    """Verify registration rejects an already-registered phone number with HTTP 400."""
    shared_phone = make_unique_phone()
    email1 = f"user1_{uuid4().hex[:8]}@example.com"
    email2 = f"user2_{uuid4().hex[:8]}@example.com"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Register first user with shared phone
        r1 = await client.post("/api/auth/register", json={
            "email": email1,
            "password": "ValidPassword123!",
            "role": "WORKER",
            "phone": shared_phone,
        })
        assert r1.status_code == 201

        # Attempt to register second user with DIFFERENT email but SAME phone
        r2 = await client.post("/api/auth/register", json={
            "email": email2,
            "password": "ValidPassword123!",
            "role": "WORKER",
            "phone": shared_phone,
        })
        assert r2.status_code == 400
        assert "Phone number already registered with another account" in r2.json()["detail"]

    # Verify that user2 was NOT created in the database
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.email == email2.lower()))
        assert res.scalar_one_or_none() is None


@pytest.mark.anyio
async def test_admin_self_registration_blocked():
    """Verify that attempting to self-register with role ADMIN is forbidden (HTTP 403)."""
    payload = {
        "email": f"hacker_{uuid4().hex[:8]}@example.com",
        "password": "ValidPassword123!",
        "role": "ADMIN",
        "phone": make_unique_phone(),
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/auth/register", json=payload)

    assert response.status_code == 403
    assert "Admin registration not permitted" in response.json()["detail"]


@pytest.mark.anyio
async def test_password_strength_validation():
    """Verify that passwords missing uppercase or digits fail schema validation (HTTP 422)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Missing uppercase
        r1 = await client.post("/api/auth/register", json={
            "email": f"pw1_{uuid4().hex[:8]}@example.com",
            "password": "lowercase12345",
            "role": "WORKER",
        })
        assert r1.status_code == 422

        # Missing digit
        r2 = await client.post("/api/auth/register", json={
            "email": f"pw2_{uuid4().hex[:8]}@example.com",
            "password": "UppercaseNoDigits",
            "role": "WORKER",
        })
        assert r2.status_code == 422

        # Too short (< 8 chars)
        r3 = await client.post("/api/auth/register", json={
            "email": f"pw3_{uuid4().hex[:8]}@example.com",
            "password": "Sh1",
            "role": "WORKER",
        })
        assert r3.status_code == 422


# ─── 3. Login Endpoint Tests ────────────────────────────────────────────────

@pytest.mark.anyio
async def test_login_success_and_case_insensitivity():
    """Verify login succeeds and handles email case insensitively."""
    email = f"login_user_{uuid4().hex[:8]}@example.com"
    password = "ValidPassword123!"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        reg = await client.post("/api/auth/register", json={
            "email": email,
            "password": password,
            "role": "WORKER",
            "phone": make_unique_phone(),
        })
        assert reg.status_code == 201

        # Login with uppercase email variation
        login_res = await client.post("/api/auth/login", json={
            "email": email.upper(),
            "password": password,
        })
        assert login_res.status_code == 200
        data = login_res.json()
        assert "access_token" in data
        assert data["user"]["email"] == email.lower()


@pytest.mark.anyio
async def test_login_invalid_password():
    """Verify login with incorrect password returns HTTP 401."""
    email = f"user_{uuid4().hex[:8]}@example.com"
    password = "ValidPassword123!"

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post("/api/auth/register", json={
            "email": email,
            "password": password,
            "role": "WORKER",
            "phone": make_unique_phone(),
        })

        login_res = await client.post("/api/auth/login", json={
            "email": email,
            "password": "WrongPassword999!",
        })
        assert login_res.status_code == 401
        assert "Invalid email or password" in login_res.json()["detail"]


@pytest.mark.anyio
async def test_login_nonexistent_email():
    """Verify login with unregistered email returns generic HTTP 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post("/api/auth/login", json={
            "email": "nonexistent_email_12345@example.com",
            "password": "SomePassword123!",
        })
        assert login_res.status_code == 401
        assert "Invalid email or password" in login_res.json()["detail"]


@pytest.mark.anyio
async def test_login_inactive_account_blocked():
    """Verify login is blocked with HTTP 403 when user is_active is False."""
    email = f"inactive_{uuid4().hex[:8]}@example.com"
    password = "ValidPassword123!"

    # Create inactive user in database
    async with AsyncSessionLocal() as db:
        loop = asyncio.get_event_loop()
        hashed = await loop.run_in_executor(None, hash_password, password)
        user = User(
            email=email,
            phone=make_unique_phone(),
            password_hash=hashed,
            role=UserRole.WORKER,
            is_active=False,
        )
        db.add(user)
        await db.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_res = await client.post("/api/auth/login", json={
            "email": email,
            "password": password,
        })
        assert login_res.status_code == 403
        assert "Account is disabled" in login_res.json()["detail"]


# ─── 4. Database Integrity & Rollback Safety ────────────────────────────────

@pytest.mark.anyio
async def test_registration_integrity_error_rollback_safety():
    """
    Verify that if a database IntegrityError occurs during flush/commit (e.g. concurrent race condition),
    the endpoint catches it, rolls back the transaction cleanly, and returns HTTP 400.
    """
    email = f"race_{uuid4().hex[:8]}@example.com"
    phone = make_unique_phone()
    payload = {
        "email": email,
        "password": "ValidPassword123!",
        "role": "WORKER",
        "phone": phone,
    }

    # Simulate IntegrityError on db.flush
    with patch("sqlalchemy.ext.asyncio.AsyncSession.flush", side_effect=IntegrityError("Key (phone)=(...) already exists.", orig=Exception("duplicate key value violates unique constraint 'users_phone_key'"), params={})):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post("/api/auth/register", json=payload)

    assert response.status_code == 400
    assert "Phone number already registered with another account" in response.json()["detail"]


# ─── 5. Production Provider Validation Safety ────────────────────────────────

@pytest.mark.anyio
async def test_production_settings_validation_rejects_mock_and_missing_credentials():
    """
    Verify that in production environment:
    - Mock OTP mode is strictly forbidden.
    - Console/mock email or SMS provider is strictly forbidden.
    - Missing Resend API key or Twilio/MSG91 credentials trigger validation errors.
    """
    # 1. Production with MOCK_OTP_MODE=True must fail
    with pytest.raises(ValueError, match="MOCK_OTP_MODE must NEVER be enabled in production"):
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET_KEY="production-super-secret-key-minimum-32-chars",
            MOCK_OTP_MODE=True,
            EMAIL_PROVIDER="resend",
            RESEND_API_KEY="re_test_key",
            SMS_PROVIDER="twilio",
            TWILIO_ACCOUNT_SID="AC1234567890",
            TWILIO_AUTH_TOKEN="token123",
            TWILIO_FROM_NUMBER="+1234567890",
        )

    # 2. Production with missing EMAIL_PROVIDER or mock email must fail
    with pytest.raises(ValueError, match="A real EMAIL_PROVIDER"):
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET_KEY="production-super-secret-key-minimum-32-chars",
            MOCK_OTP_MODE=False,
            EMAIL_PROVIDER="mock",
            SMS_PROVIDER="twilio",
            TWILIO_ACCOUNT_SID="AC1234567890",
            TWILIO_AUTH_TOKEN="token123",
            TWILIO_FROM_NUMBER="+1234567890",
        )

    # 3. Production with EMAIL_PROVIDER='resend' but missing RESEND_API_KEY must fail
    with pytest.raises(ValueError, match="RESEND_API_KEY is required"):
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET_KEY="production-super-secret-key-minimum-32-chars",
            MOCK_OTP_MODE=False,
            EMAIL_PROVIDER="resend",
            RESEND_API_KEY="",
            SMS_PROVIDER="twilio",
            TWILIO_ACCOUNT_SID="AC1234567890",
            TWILIO_AUTH_TOKEN="token123",
            TWILIO_FROM_NUMBER="+1234567890",
        )

    # 4. Production with missing SMS_PROVIDER or mock sms must fail
    with pytest.raises(ValueError, match="A real SMS_PROVIDER"):
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET_KEY="production-super-secret-key-minimum-32-chars",
            MOCK_OTP_MODE=False,
            EMAIL_PROVIDER="resend",
            RESEND_API_KEY="re_valid_key",
            SMS_PROVIDER="console",
        )

    # 5. Production with SMS_PROVIDER='msg91' but missing auth key must fail
    with pytest.raises(ValueError, match="MSG91_AUTH_KEY and MSG91_TEMPLATE_ID are required"):
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET_KEY="production-super-secret-key-minimum-32-chars",
            MOCK_OTP_MODE=False,
            EMAIL_PROVIDER="resend",
            RESEND_API_KEY="re_valid_key",
            SMS_PROVIDER="msg91",
            MSG91_AUTH_KEY=None,
            MSG91_TEMPLATE_ID=None,
        )

    # 6. Valid production configuration succeeds
    prod_valid = Settings(
        ENVIRONMENT="production",
        JWT_SECRET_KEY="production-super-secret-key-minimum-32-chars",
        MOCK_OTP_MODE=False,
        EMAIL_PROVIDER="resend",
        RESEND_API_KEY="re_valid_key",
        RESEND_FROM_EMAIL="noreply@kaamsetu.in",
        SMS_PROVIDER="twilio",
        TWILIO_ACCOUNT_SID="AC1234567890",
        TWILIO_AUTH_TOKEN="token123",
        TWILIO_FROM_NUMBER="+1234567890",
    )
    assert prod_valid.ENVIRONMENT == "production"
    assert prod_valid.DEBUG is False  # Forced to False in production

    # 7. Development configuration allows mock without errors
    dev_valid = Settings(
        ENVIRONMENT="development",
        JWT_SECRET_KEY="change-this-secret-key-in-production",
        MOCK_OTP_MODE=True,
        EMAIL_PROVIDER="mock",
        SMS_PROVIDER="mock",
    )
    assert dev_valid.ENVIRONMENT == "development"
    assert dev_valid.MOCK_OTP_MODE is True
