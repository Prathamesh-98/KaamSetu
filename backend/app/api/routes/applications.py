"""KaamSetu — Applications Routes"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID
from app.db.session import get_db
from app.models.models import (
    User, Job, JobApplication, WorkerProfile, EmployerProfile,
    ApplicationStatus, JobStatus, JobRequiredSkill, UserRole, WorkerSkill
)
from app.services.notification_service import create_notification
from app.schemas.schemas import (
    ApplicationCreate, ApplicationStatusUpdate, ApplicationResponse,
    JobListResponse, WorkerProfileResponse, WorkerSkillResponse
)
from app.api.dependencies import get_current_user, require_worker, require_employer, get_worker_profile, get_employer_profile

router = APIRouter(tags=["Applications"])

WORKER_SKILL_OPTS = [selectinload(WorkerProfile.skills).selectinload(WorkerSkill.skill)]


def _app_opts():
    return [
        selectinload(JobApplication.job).selectinload(Job.employer),
        selectinload(JobApplication.job).selectinload(Job.category),
        selectinload(JobApplication.job).selectinload(Job.required_skills).selectinload(JobRequiredSkill.skill),
        selectinload(JobApplication.worker).selectinload(WorkerProfile.skills).selectinload(WorkerSkill.skill),
    ]


@router.post("/jobs/{job_id}/apply", response_model=ApplicationResponse, status_code=201)
async def apply_to_job(
    job_id: UUID,
    payload: ApplicationCreate,
    worker_profile: WorkerProfile = Depends(get_worker_profile),
    db: AsyncSession = Depends(get_db),
):
    """Worker applies for a job."""
    job_result = await db.execute(
        select(Job).where(Job.id == job_id).options(selectinload(Job.employer))
    )
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.employer.user_id == worker_profile.user_id:
        raise HTTPException(status_code=400, detail="Cannot apply to your own job")
    if job.status != JobStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Job is not accepting applications")

    # Check duplicate
    dup = await db.execute(
        select(JobApplication).where(
            JobApplication.job_id == job_id,
            JobApplication.worker_id == worker_profile.id,
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already applied to this job")

    application = JobApplication(
        job_id=job_id,
        worker_id=worker_profile.id,
        cover_note=payload.cover_note,
    )
    db.add(application)

    # Increment application count
    job.applications_count += 1
    await db.flush()

    result = await db.execute(
        select(JobApplication)
        .where(JobApplication.id == application.id)
        .options(*_app_opts())
    )
    return ApplicationResponse.model_validate(result.scalar_one())


@router.get("/applications", response_model=List[ApplicationResponse])
async def list_applications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List applications: worker sees own, employer sees their job applications."""
    if current_user.role == UserRole.WORKER:
        worker_result = await db.execute(
            select(WorkerProfile).where(WorkerProfile.user_id == current_user.id)
        )
        worker = worker_result.scalar_one_or_none()
        if not worker:
            return []
        query = (
            select(JobApplication)
            .where(JobApplication.worker_id == worker.id)
            .options(*_app_opts())
            .order_by(JobApplication.applied_at.desc())
        )
    else:
        employer_result = await db.execute(
            select(EmployerProfile).where(EmployerProfile.user_id == current_user.id)
        )
        employer = employer_result.scalar_one_or_none()
        if not employer:
            return []
        query = (
            select(JobApplication)
            .join(Job, JobApplication.job_id == Job.id)
            .where(Job.employer_id == employer.id)
            .options(*_app_opts())
            .order_by(JobApplication.applied_at.desc())
        )

    result = await db.execute(query)
    return [ApplicationResponse.model_validate(a) for a in result.scalars().all()]


@router.get("/jobs/{job_id}/applicants", response_model=List[ApplicationResponse])
async def get_job_applicants(
    job_id: UUID,
    employer_profile: EmployerProfile = Depends(get_employer_profile),
    db: AsyncSession = Depends(get_db),
):
    """Employer views all applicants for a specific job."""
    job_result = await db.execute(select(Job).where(Job.id == job_id))
    job = job_result.scalar_one_or_none()
    if not job or job.employer_id != employer_profile.id:
        raise HTTPException(status_code=404, detail="Job not found")

    result = await db.execute(
        select(JobApplication)
        .where(JobApplication.job_id == job_id)
        .options(*_app_opts())
        .order_by(JobApplication.applied_at.desc())
    )
    return [ApplicationResponse.model_validate(a) for a in result.scalars().all()]


@router.put("/applications/{application_id}/status", response_model=ApplicationResponse)
async def update_application_status(
    application_id: UUID,
    payload: ApplicationStatusUpdate,
    employer_profile: EmployerProfile = Depends(get_employer_profile),
    db: AsyncSession = Depends(get_db),
):
    """Employer accepts/rejects/shortlists an application."""
    result = await db.execute(
        select(JobApplication)
        .where(JobApplication.id == application_id)
        .options(*_app_opts())
    )
    application = result.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    if application.job.employer_id != employer_profile.id:
        raise HTTPException(status_code=403, detail="Not your job")

    # Validate transitions
    valid_transitions = {
        ApplicationStatus.PENDING: [ApplicationStatus.SHORTLISTED, ApplicationStatus.REJECTED],
        ApplicationStatus.SHORTLISTED: [ApplicationStatus.ACCEPTED, ApplicationStatus.REJECTED],
        ApplicationStatus.ACCEPTED: [ApplicationStatus.COMPLETED],
    }
    allowed = valid_transitions.get(application.status, [])
    if payload.status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from {application.status} to {payload.status}",
        )
        
    if payload.status == ApplicationStatus.ACCEPTED:
        # Row-level lock on the Job to serialize acceptance decisions and prevent exceeding workers_needed
        job_lock_res = await db.execute(
            select(Job).where(Job.id == application.job_id).with_for_update()
        )
        locked_job = job_lock_res.scalar_one()

        # Check workers_needed limit within the lock boundary
        count_result = await db.execute(
            select(func.count(JobApplication.id))
            .where(JobApplication.job_id == application.job_id)
            .where(JobApplication.status.in_([ApplicationStatus.ACCEPTED, ApplicationStatus.COMPLETED]))
        )
        accepted_count = count_result.scalar() or 0
        if accepted_count >= locked_job.workers_needed:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot accept application. Job already has the required {locked_job.workers_needed} worker(s)."
            )

    application.status = payload.status
    if payload.employer_notes:
        application.employer_notes = payload.employer_notes
    await db.flush()
    await db.commit()

    result = await db.execute(
        select(JobApplication)
        .where(JobApplication.id == application_id)
        .options(*_app_opts())
    )
    return ApplicationResponse.model_validate(result.scalar_one())


@router.delete("/applications/{application_id}", status_code=204)
async def withdraw_application(
    application_id: UUID,
    worker_profile: WorkerProfile = Depends(get_worker_profile),
    db: AsyncSession = Depends(get_db),
):
    """Worker withdraws their application."""
    result = await db.execute(
        select(JobApplication).where(JobApplication.id == application_id)
    )
    application = result.scalar_one_or_none()
    if not application or application.worker_id != worker_profile.id:
        raise HTTPException(status_code=404, detail="Application not found")
    if application.status not in [ApplicationStatus.PENDING, ApplicationStatus.SHORTLISTED]:
        raise HTTPException(status_code=400, detail="Cannot withdraw at this stage")

    application.status = ApplicationStatus.WITHDRAWN
    await db.flush()
