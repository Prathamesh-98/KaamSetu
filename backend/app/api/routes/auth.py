"""KaamSetu — Auth Routes"""
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.db.session import get_db
from app.models.models import User, UserRole
from app.schemas.schemas import (
    RegisterRequest, LoginRequest, TokenResponse, UserBasic,
    ForgotPasswordEmailRequest, ForgotPasswordPhoneRequest,
    VerifyRecoveryEmailRequest, VerifyRecoveryPhoneRequest,
    RecoveryVerifyResponse, ResetPasswordRequest
)
from app.core.security import hash_password, verify_password, create_access_token
from app.api.dependencies import get_current_user
from app.core.config import settings
from app.core.rate_limit import RateLimiter
from app.services.otp_service import OTPService, OTPPurpose, normalize_email, normalize_phone
from app.services.email_service import email_service
from app.services.sms_service import sms_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db), _: None = Depends(RateLimiter(requests=5, window_seconds=60))):
    """Register a new user (WORKER or EMPLOYER)."""
    norm_email = normalize_email(payload.email)

    # Check email uniqueness
    existing = await db.execute(select(User).where(User.email == norm_email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check phone uniqueness if provided
    clean_phone = normalize_phone(payload.phone) if payload.phone and payload.phone.strip() else None
    if clean_phone:
        existing_phone = await db.execute(select(User).where(User.phone == clean_phone))
        if existing_phone.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Phone number already registered with another account")

    # Block admin self-registration
    if payload.role == UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin registration not permitted")

    # Run bcrypt in thread pool so we don't block the event loop
    loop = asyncio.get_event_loop()
    hashed = await loop.run_in_executor(None, hash_password, payload.password)

    user = User(
        email=norm_email,
        phone=clean_phone,
        password_hash=hashed,
        role=payload.role,
    )

    try:
        db.add(user)
        await db.flush()
        await db.refresh(user)
        # Commit immediately so the user is visible to subsequent authenticated requests
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        err_msg = str(e.orig).lower() if hasattr(e, "orig") else str(e).lower()
        if "phone" in err_msg or "users_phone_key" in err_msg:
            raise HTTPException(status_code=400, detail="Phone number already registered with another account")
        elif "email" in err_msg or "users_email_key" in err_msg:
            raise HTTPException(status_code=400, detail="Email already registered")
        logger.error(f"IntegrityError during registration: {e}")
        raise HTTPException(status_code=400, detail="Account registration could not be completed.")

    token = create_access_token({
        "sub": str(user.id),
        "role": user.role.value,
        "token_version": user.token_version,
    })

    return TokenResponse(
        access_token=token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserBasic.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db), _: None = Depends(RateLimiter(requests=10, window_seconds=60))):
    """Login with email and password, returns JWT token."""
    norm_email = normalize_email(payload.email)
    result = await db.execute(select(User).where(User.email == norm_email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Run bcrypt verify in thread pool to avoid blocking event loop
    loop = asyncio.get_event_loop()
    password_ok = await loop.run_in_executor(None, verify_password, payload.password, user.password_hash)

    if not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    token = create_access_token({
        "sub": str(user.id),
        "role": user.role.value,
        "token_version": user.token_version,
    })

    return TokenResponse(
        access_token=token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserBasic.model_validate(user),
    )


@router.get("/me", response_model=UserBasic)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get the currently authenticated user."""
    return UserBasic.model_validate(current_user)


# ─── Password Recovery Endpoints ─────────────────────────────────────────────

GENERIC_EMAIL_RECOVERY_RESPONSE = {
    "message": "If an account exists with this email address, a password recovery code has been sent."
}

GENERIC_PHONE_RECOVERY_RESPONSE = {
    "message": "If an account exists with this mobile number, a password recovery code has been sent."
}


@router.post("/forgot-password/email", status_code=status.HTTP_200_OK)
async def forgot_password_email(
    payload: ForgotPasswordEmailRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(RateLimiter(requests=5, window_seconds=60)),
):
    """
    Request password recovery via email.
    Uses generic responses to prevent email address enumeration.
    """
    norm_email = normalize_email(payload.email)

    # Check if provider is available in production
    env = (getattr(settings, "ENVIRONMENT", "") or "").strip().lower()
    if env in ("production", "prod") and not email_service.get_provider():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password recovery service is temporarily unavailable. Please contact support.",
        )

    result = await db.execute(select(User).where(User.email == norm_email))
    user = result.scalar_one_or_none()

    if user and user.is_active:
        success, msg, retry_after, code = await OTPService.request_challenge(
            purpose=OTPPurpose.PASSWORD_RESET_EMAIL,
            destination=norm_email,
            user_id=str(user.id),
            db=db,
        )
        if not success:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=msg,
                headers={"Retry-After": str(retry_after or 600)},
            )

        delivered, delivery_msg = await email_service.send_password_reset_email(
            to_email=norm_email,
            otp_code=code,
        )
        if not delivered:
            logger.error(f"Password reset email delivery failed for user {user.id}: {delivery_msg}")
            # Do not leak account existence via 503; maintain uniform generic response

    return GENERIC_EMAIL_RECOVERY_RESPONSE


@router.post("/forgot-password/phone", status_code=status.HTTP_200_OK)
async def forgot_password_phone(
    payload: ForgotPasswordPhoneRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(RateLimiter(requests=5, window_seconds=60)),
):
    """
    Request password recovery via registered mobile phone.
    Uses generic responses to prevent phone number enumeration.
    """
    norm_phone = normalize_phone(payload.phone)

    # Check if provider is available in production
    env = (getattr(settings, "ENVIRONMENT", "") or "").strip().lower()
    if env in ("production", "prod") and not sms_service.get_provider():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SMS password recovery service is temporarily unavailable. Please contact support.",
        )

    result = await db.execute(select(User).where(User.phone == norm_phone))
    user = result.scalar_one_or_none()

    if user and user.is_active:
        success, msg, retry_after, code = await OTPService.request_challenge(
            purpose=OTPPurpose.PASSWORD_RESET_PHONE,
            destination=norm_phone,
            user_id=str(user.id),
            db=db,
        )
        if not success:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=msg,
                headers={"Retry-After": str(retry_after or 600)},
            )

        delivered, delivery_msg = await sms_service.send_otp_sms(
            phone=norm_phone,
            otp_code=code,
            purpose="password_recovery",
        )
        if not delivered:
            logger.error(f"Password reset SMS delivery failed for user {user.id}: {delivery_msg}")
            # Do not leak account existence via 503; maintain uniform generic response

    return GENERIC_PHONE_RECOVERY_RESPONSE


@router.post("/forgot-password/verify-email", response_model=RecoveryVerifyResponse)
async def verify_forgot_password_email(
    payload: VerifyRecoveryEmailRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(RateLimiter(requests=10, window_seconds=60)),
):
    """
    Verify recovery OTP sent to email. Issues a short-lived single-use reset authorization token.
    """
    norm_email = normalize_email(payload.email)
    success, message, bound_user_id = await OTPService.verify_challenge(
        purpose=OTPPurpose.PASSWORD_RESET_EMAIL,
        destination=norm_email,
        code=payload.otp_code,
        db=db,
    )
    if not success or not bound_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message or "Invalid or expired recovery code.",
        )

    # Confirm user exists and active
    u_res = await db.execute(select(User).where(User.id == bound_user_id))
    user = u_res.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account is inactive or not found.")

    reset_token, expires_in = await OTPService.issue_password_reset_token(
        user_id=str(user.id),
        purpose=OTPPurpose.PASSWORD_RESET_EMAIL,
        db=db,
    )

    return RecoveryVerifyResponse(
        message="Verification code confirmed. You may now reset your password.",
        reset_token=reset_token,
        expires_in=expires_in,
    )


@router.post("/forgot-password/verify-phone", response_model=RecoveryVerifyResponse)
async def verify_forgot_password_phone(
    payload: VerifyRecoveryPhoneRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(RateLimiter(requests=10, window_seconds=60)),
):
    """
    Verify recovery OTP sent to mobile phone. Issues a short-lived single-use reset authorization token.
    """
    norm_phone = normalize_phone(payload.phone)
    success, message, bound_user_id = await OTPService.verify_challenge(
        purpose=OTPPurpose.PASSWORD_RESET_PHONE,
        destination=norm_phone,
        code=payload.otp_code,
        db=db,
    )
    if not success or not bound_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message or "Invalid or expired recovery code.",
        )

    # Confirm user exists and active
    u_res = await db.execute(select(User).where(User.id == bound_user_id))
    user = u_res.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account is inactive or not found.")

    reset_token, expires_in = await OTPService.issue_password_reset_token(
        user_id=str(user.id),
        purpose=OTPPurpose.PASSWORD_RESET_PHONE,
        db=db,
    )

    return RecoveryVerifyResponse(
        message="Verification code confirmed. You may now reset your password.",
        reset_token=reset_token,
        expires_in=expires_in,
    )


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(RateLimiter(requests=5, window_seconds=60)),
):
    """
    Reset user password using a verified, single-use password reset authorization token.
    Increments token_version to invalidate all existing sessions.
    """
    success, user_id, msg = await OTPService.verify_and_consume_password_reset_token(payload.reset_token, db=db)
    if not success or not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg or "Invalid, expired, or already used password reset authorization.",
        )

    u_res = await db.execute(select(User).where(User.id == user_id))
    user = u_res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User account not found.")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled.")

    # Hash new password in thread executor
    loop = asyncio.get_event_loop()
    new_hash = await loop.run_in_executor(None, hash_password, payload.new_password)

    # Atomic update
    user.password_hash = new_hash
    user.token_version = (user.token_version or 1) + 1
    await db.commit()

    return {
        "message": "Password has been reset successfully. Please sign in with your new password."
    }
