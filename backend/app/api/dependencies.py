"""
KaamSetu — API Dependencies
Authentication, authorization, and role-based guards.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.core.security import decode_access_token
from app.models.models import User, UserRole, WorkerProfile, EmployerProfile

# Bearer token extractor
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Decode JWT token and return the authenticated User object.
    Raises 401 if token is invalid or user not found.
    """
    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )
    return user


async def require_worker(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure the current user has the WORKER role."""
    if current_user.role != UserRole.WORKER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to workers",
        )
    return current_user


async def require_employer(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure the current user has the EMPLOYER role."""
    if current_user.role != UserRole.EMPLOYER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to employers",
        )
    return current_user


async def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure the current user has the ADMIN role."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


async def get_worker_profile(
    current_user: User = Depends(require_worker),
    db: AsyncSession = Depends(get_db),
) -> WorkerProfile:
    """Get the WorkerProfile for the current worker user."""
    result = await db.execute(
        select(WorkerProfile).where(WorkerProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Worker profile not found. Please create your profile first.",
        )
    return profile


async def get_employer_profile(
    current_user: User = Depends(require_employer),
    db: AsyncSession = Depends(get_db),
) -> EmployerProfile:
    """Get the EmployerProfile for the current employer user."""
    result = await db.execute(
        select(EmployerProfile).where(EmployerProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employer profile not found. Please create your profile first.",
        )
    return profile
