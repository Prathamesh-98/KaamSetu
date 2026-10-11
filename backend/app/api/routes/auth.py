"""KaamSetu — Auth Routes"""
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.models import User, UserRole
from app.schemas.schemas import RegisterRequest, LoginRequest, TokenResponse, UserBasic
from app.core.security import hash_password, verify_password, create_access_token
from app.api.dependencies import get_current_user
from app.core.config import settings
from app.core.rate_limit import RateLimiter

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db), _: None = Depends(RateLimiter(requests=5, window_seconds=60))):
    """Register a new user (WORKER or EMPLOYER)."""
    # Check email uniqueness
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Block admin self-registration
    if payload.role == UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin registration not permitted")

    # Run bcrypt in thread pool so we don't block the event loop
    loop = asyncio.get_event_loop()
    hashed = await loop.run_in_executor(None, hash_password, payload.password)

    user = User(
        email=payload.email,
        phone=payload.phone,
        password_hash=hashed,
        role=payload.role,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    # Commit immediately so the user is visible to subsequent authenticated requests
    await db.commit()

    token = create_access_token({"sub": str(user.id), "role": user.role.value})

    return TokenResponse(
        access_token=token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserBasic.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db), _: None = Depends(RateLimiter(requests=10, window_seconds=60))):
    """Login with email and password, returns JWT token."""
    result = await db.execute(select(User).where(User.email == payload.email))
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

    token = create_access_token({"sub": str(user.id), "role": user.role.value})

    return TokenResponse(
        access_token=token,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserBasic.model_validate(user),
    )


@router.get("/me", response_model=UserBasic)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get the currently authenticated user."""
    return UserBasic.model_validate(current_user)
