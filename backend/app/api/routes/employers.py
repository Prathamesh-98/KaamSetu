"""KaamSetu — Employer Routes"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
from app.db.session import get_db
from app.models.models import User, EmployerProfile, SavedWorker, WorkerProfile, WorkerSkill
from app.schemas.schemas import (
    EmployerProfileCreate, EmployerProfileUpdate, EmployerProfileResponse,
    SavedWorkerCreate, SavedWorkerResponse
)
from app.api.dependencies import get_current_user, require_employer, get_employer_profile

router = APIRouter(prefix="/employers", tags=["Employers"])


@router.post("/profile", response_model=EmployerProfileResponse, status_code=201)
async def create_employer_profile(
    payload: EmployerProfileCreate,
    current_user: User = Depends(require_employer),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(EmployerProfile).where(EmployerProfile.user_id == current_user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Profile already exists")

    profile = EmployerProfile(user_id=current_user.id, **payload.model_dump())
    db.add(profile)
    await db.flush()
    await db.refresh(profile)
    return EmployerProfileResponse.model_validate(profile)


@router.get("/profile", response_model=EmployerProfileResponse)
async def get_my_employer_profile(
    profile: EmployerProfile = Depends(get_employer_profile),
):
    return EmployerProfileResponse.model_validate(profile)


@router.put("/profile", response_model=EmployerProfileResponse)
async def update_employer_profile(
    payload: EmployerProfileUpdate,
    profile: EmployerProfile = Depends(get_employer_profile),
    db: AsyncSession = Depends(get_db),
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    await db.flush()
    await db.refresh(profile)
    return EmployerProfileResponse.model_validate(profile)


# ─── Saved / Favourite Workers ────────────────────────────────────────────────

@router.get("/saved-workers", response_model=List[SavedWorkerResponse])
async def get_my_saved_workers(
    profile: EmployerProfile = Depends(get_employer_profile),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all favorited workers for the authenticated employer."""
    result = await db.execute(
        select(SavedWorker)
        .where(SavedWorker.employer_id == profile.id)
        .options(
            selectinload(SavedWorker.worker)
            .selectinload(WorkerProfile.skills)
            .selectinload(WorkerSkill.skill)
        )
        .order_by(SavedWorker.saved_at.desc())
    )
    saved_workers = result.scalars().all()
    return [SavedWorkerResponse.model_validate(sw) for sw in saved_workers]


@router.get("/saved-workers/ids", response_model=List[str])
async def get_saved_worker_ids(
    profile: EmployerProfile = Depends(get_employer_profile),
    db: AsyncSession = Depends(get_db),
):
    """Fast lookup of favorited worker IDs for candidate badges."""
    result = await db.execute(
        select(SavedWorker.worker_id)
        .where(SavedWorker.employer_id == profile.id)
    )
    return [str(wid) for wid in result.scalars().all()]


@router.post("/saved-workers/{worker_id}", response_model=SavedWorkerResponse, status_code=status.HTTP_201_CREATED)
async def save_worker(
    worker_id: UUID,
    payload: Optional[SavedWorkerCreate] = None,
    profile: EmployerProfile = Depends(get_employer_profile),
    db: AsyncSession = Depends(get_db),
):
    """Add a worker to the employer's saved/favourite list."""
    worker_res = await db.execute(
        select(WorkerProfile)
        .where(WorkerProfile.id == worker_id)
        .options(
            selectinload(WorkerProfile.skills)
            .selectinload(WorkerSkill.skill)
        )
    )
    worker = worker_res.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    existing = await db.execute(
        select(SavedWorker)
        .where(SavedWorker.employer_id == profile.id, SavedWorker.worker_id == worker_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Worker already saved")

    saved = SavedWorker(
        employer_id=profile.id,
        worker_id=worker_id,
        notes=payload.notes if payload else None
    )
    db.add(saved)
    await db.commit()
    await db.refresh(saved)
    saved.worker = worker
    return SavedWorkerResponse.model_validate(saved)


@router.delete("/saved-workers/{worker_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_saved_worker(
    worker_id: UUID,
    profile: EmployerProfile = Depends(get_employer_profile),
    db: AsyncSession = Depends(get_db),
):
    """Remove a worker from the employer's saved/favourite list."""
    result = await db.execute(
        select(SavedWorker)
        .where(SavedWorker.employer_id == profile.id, SavedWorker.worker_id == worker_id)
    )
    saved = result.scalar_one_or_none()
    if not saved:
        raise HTTPException(status_code=404, detail="Saved worker not found")

    await db.delete(saved)
    await db.commit()
    return None


@router.get("/{employer_id}", response_model=EmployerProfileResponse)
async def get_employer_by_id(
    employer_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(EmployerProfile).where(EmployerProfile.id == employer_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Employer not found")
    return EmployerProfileResponse.model_validate(profile)
