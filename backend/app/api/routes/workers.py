"""KaamSetu — Worker Routes"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional, List
from uuid import UUID
from app.db.session import get_db
from app.models.models import (
    User, WorkerProfile, WorkerSkill, Skill, SavedJob, Job,
    JobCategory, JobRequiredSkill, EmployerProfile
)
from app.schemas.schemas import (
    WorkerProfileCreate, WorkerProfileUpdate, WorkerProfileResponse,
    WorkerSkillAdd, WorkerSkillResponse, JobListResponse, SavedJobResponse
)
from app.api.dependencies import get_current_user, require_worker, get_worker_profile

router = APIRouter(prefix="/workers", tags=["Workers"])


@router.post("/profile", response_model=WorkerProfileResponse, status_code=201)
async def create_worker_profile(
    payload: WorkerProfileCreate,
    current_user: User = Depends(require_worker),
    db: AsyncSession = Depends(get_db),
):
    """Create worker profile for the authenticated worker."""
    existing = await db.execute(
        select(WorkerProfile).where(WorkerProfile.user_id == current_user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Profile already exists")

    profile = WorkerProfile(user_id=current_user.id, **payload.model_dump())
    db.add(profile)
    await db.flush()

    result = await db.execute(
        select(WorkerProfile)
        .where(WorkerProfile.id == profile.id)
        .options(selectinload(WorkerProfile.skills).selectinload(WorkerSkill.skill))
    )
    return WorkerProfileResponse.model_validate(result.scalar_one())


@router.get("/profile", response_model=WorkerProfileResponse)
async def get_my_worker_profile(
    profile: WorkerProfile = Depends(get_worker_profile),
    db: AsyncSession = Depends(get_db),
):
    """Get the current worker's profile."""
    result = await db.execute(
        select(WorkerProfile)
        .where(WorkerProfile.id == profile.id)
        .options(selectinload(WorkerProfile.skills).selectinload(WorkerSkill.skill))
    )
    return WorkerProfileResponse.model_validate(result.scalar_one())


@router.put("/profile", response_model=WorkerProfileResponse)
async def update_worker_profile(
    payload: WorkerProfileUpdate,
    profile: WorkerProfile = Depends(get_worker_profile),
    db: AsyncSession = Depends(get_db),
):
    """Update the current worker's profile."""
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    await db.flush()

    result = await db.execute(
        select(WorkerProfile)
        .where(WorkerProfile.id == profile.id)
        .options(selectinload(WorkerProfile.skills).selectinload(WorkerSkill.skill))
    )
    return WorkerProfileResponse.model_validate(result.scalar_one())


@router.post("/skills", response_model=WorkerSkillResponse, status_code=201)
async def add_worker_skill(
    payload: WorkerSkillAdd,
    profile: WorkerProfile = Depends(get_worker_profile),
    db: AsyncSession = Depends(get_db),
):
    """Add a skill to the worker's profile."""
    skill_result = await db.execute(select(Skill).where(Skill.id == payload.skill_id))
    if not skill_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Skill not found")

    existing = await db.execute(
        select(WorkerSkill).where(
            WorkerSkill.worker_profile_id == profile.id,
            WorkerSkill.skill_id == payload.skill_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Skill already added")

    worker_skill = WorkerSkill(
        worker_profile_id=profile.id,
        skill_id=payload.skill_id,
        proficiency_level=payload.proficiency_level,
        years_experience=payload.years_experience,
    )
    db.add(worker_skill)
    await db.commit()

    result = await db.execute(
        select(WorkerSkill)
        .where(WorkerSkill.id == worker_skill.id)
        .options(selectinload(WorkerSkill.skill))
    )
    return WorkerSkillResponse.model_validate(result.scalar_one())


@router.delete("/skills/{skill_id}", status_code=204)
async def remove_worker_skill(
    skill_id: UUID,
    profile: WorkerProfile = Depends(get_worker_profile),
    db: AsyncSession = Depends(get_db),
):
    """Remove a skill from the worker's profile."""
    result = await db.execute(
        select(WorkerSkill).where(
            WorkerSkill.worker_profile_id == profile.id,
            WorkerSkill.skill_id == skill_id,
        )
    )
    worker_skill = result.scalar_one_or_none()
    if not worker_skill:
        raise HTTPException(status_code=404, detail="Skill not found on your profile")

    await db.delete(worker_skill)
    await db.commit()


@router.get("/{worker_id}", response_model=WorkerProfileResponse)
async def get_worker_by_id(
    worker_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a worker profile by ID (public within platform)."""
    result = await db.execute(
        select(WorkerProfile)
        .where(WorkerProfile.id == worker_id)
        .options(selectinload(WorkerProfile.skills).selectinload(WorkerSkill.skill))
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Worker not found")
    return WorkerProfileResponse.model_validate(profile)


@router.get("/me/saved-jobs", response_model=List[SavedJobResponse])
async def get_my_saved_jobs(
    profile: WorkerProfile = Depends(get_worker_profile),
    db: AsyncSession = Depends(get_db),
):
    """Get all saved jobs for the authenticated worker."""
    result = await db.execute(
        select(SavedJob)
        .where(SavedJob.worker_id == profile.id)
        .options(
            selectinload(SavedJob.job).selectinload(Job.employer),
            selectinload(SavedJob.job).selectinload(Job.category),
            selectinload(SavedJob.job).selectinload(Job.required_skills).selectinload(JobRequiredSkill.skill),
        )
        .order_by(SavedJob.saved_at.desc())
    )
    saved_jobs = result.scalars().all()
    return [SavedJobResponse.model_validate(sj) for sj in saved_jobs]


@router.post("/saved-jobs/{job_id}", status_code=201)
async def save_job(
    job_id: UUID,
    profile: WorkerProfile = Depends(get_worker_profile),
    db: AsyncSession = Depends(get_db),
):
    """Worker saves a job."""
    # Verify job exists
    job_result = await db.execute(select(Job).where(Job.id == job_id))
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Check for duplicates
    existing = await db.execute(
        select(SavedJob)
        .where(SavedJob.worker_id == profile.id, SavedJob.job_id == job_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Job already saved")

    saved_job = SavedJob(worker_id=profile.id, job_id=job_id)
    db.add(saved_job)
    await db.flush()
    return {"message": "Job saved successfully"}


@router.delete("/saved-jobs/{job_id}", status_code=204)
async def unsave_job(
    job_id: UUID,
    profile: WorkerProfile = Depends(get_worker_profile),
    db: AsyncSession = Depends(get_db),
):
    """Worker unsaves a job."""
    result = await db.execute(
        select(SavedJob)
        .where(SavedJob.worker_id == profile.id, SavedJob.job_id == job_id)
    )
    saved_job = result.scalar_one_or_none()
    
    if not saved_job:
        raise HTTPException(status_code=404, detail="Saved job not found")

    await db.delete(saved_job)
