"""KaamSetu — Admin Routes"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from uuid import UUID
from app.db.session import get_db
from app.models.models import User, Job, JobApplication, WorkerProfile, EmployerProfile, UserRole, JobStatus, ApplicationStatus
from app.schemas.schemas import UserBasic, AdminStats
from app.api.dependencies import require_admin

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/stats", response_model=AdminStats)
async def get_platform_stats(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get platform-wide statistics."""
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    total_workers = (await db.execute(select(func.count(WorkerProfile.id)))).scalar_one()
    total_employers = (await db.execute(select(func.count(EmployerProfile.id)))).scalar_one()
    total_jobs = (await db.execute(select(func.count(Job.id)))).scalar_one()
    active_jobs = (await db.execute(
        select(func.count(Job.id)).where(Job.status == JobStatus.ACTIVE)
    )).scalar_one()
    completed_jobs = (await db.execute(
        select(func.count(Job.id)).where(Job.status == JobStatus.COMPLETED)
    )).scalar_one()
    total_applications = (await db.execute(select(func.count(JobApplication.id)))).scalar_one()

    return AdminStats(
        total_users=total_users,
        total_workers=total_workers,
        total_employers=total_employers,
        active_jobs=active_jobs,
        total_jobs=total_jobs,
        total_applications=total_applications,
        completed_jobs=completed_jobs,
    )


@router.get("/users", response_model=List[UserBasic])
async def list_all_users(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    page: int = 1,
    per_page: int = 50,
):
    """Admin: list all users."""
    result = await db.execute(
        select(User).offset((page - 1) * per_page).limit(per_page).order_by(User.created_at.desc())
    )
    return [UserBasic.model_validate(u) for u in result.scalars().all()]


@router.put("/users/{user_id}/status")
async def toggle_user_status(
    user_id: UUID,
    is_active: bool,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: activate or suspend a user."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = is_active
    await db.flush()
    return {"message": f"User {'activated' if is_active else 'suspended'} successfully"}
