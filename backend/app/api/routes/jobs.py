"""KaamSetu — Jobs Routes"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, delete
from sqlalchemy.orm import selectinload
from typing import Optional, List
from uuid import UUID
from math import radians, cos, sin, asin, sqrt
from app.db.session import get_db
from app.models.models import WorkerProfile, JobApplication
from app.models.models import (
    User, Job, JobCategory, JobRequiredSkill, Skill,
    EmployerProfile, WorkerProfile, WorkerSkill,
    JobStatus, WorkType, SalaryType, UserRole,
    ShiftBooking, BookingStatus
)
from datetime import date
from app.schemas.schemas import (
    JobCreate, JobUpdate, JobResponse, JobListResponse, PaginatedJobListResponse, CategoryCreate, CategoryResponse, JobMatchResponse, PaginatedCandidateMatchResponse, CandidateMatchResponse
)
from app.services.matching_service import MatchingService
from app.services.notification_service import create_notification
from app.api.dependencies import get_current_user, require_employer, get_employer_profile

router = APIRouter(tags=["Jobs"])

# ─── Categories ───────────────────────────────────────────────────────────────

@router.get("/categories", response_model=List[CategoryResponse])
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(JobCategory).where(JobCategory.is_active == True).order_by(JobCategory.name)
    )
    return [CategoryResponse.model_validate(c) for c in result.scalars().all()]


@router.post("/categories", response_model=CategoryResponse, status_code=201)
async def create_category(
    payload: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin only")
    cat = JobCategory(**payload.model_dump())
    db.add(cat)
    await db.flush()
    await db.refresh(cat)
    return CategoryResponse.model_validate(cat)


# ─── Skills ───────────────────────────────────────────────────────────────────

@router.get("/skills", response_model=List[dict])
async def list_skills(
    q: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(Skill).order_by(Skill.name)
    if q:
        query = query.where(Skill.name.ilike(f"%{q}%"))
    result = await db.execute(query)
    return [{"id": str(s.id), "name": s.name, "category": s.category} for s in result.scalars().all()]


# ─── Jobs ─────────────────────────────────────────────────────────────────────

def _load_job_opts():
    return [
        selectinload(Job.employer),
        selectinload(Job.category),
        selectinload(Job.required_skills).selectinload(JobRequiredSkill.skill),
    ]


@router.get("/jobs/my", response_model=List[JobListResponse])
async def list_my_jobs(
    employer_profile: EmployerProfile = Depends(get_employer_profile),
    db: AsyncSession = Depends(get_db),
):
    """Return all jobs belonging to the authenticated employer (all statuses)."""
    result = await db.execute(
        select(Job)
        .where(Job.employer_id == employer_profile.id)
        .options(*_load_job_opts())
        .order_by(Job.created_at.desc())
    )
    return [JobListResponse.model_validate(j) for j in result.scalars().all()]


@router.get("/jobs", response_model=PaginatedJobListResponse)
async def list_jobs(
    keyword: Optional[str] = Query(None),
    category_id: Optional[UUID] = Query(None),
    city: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    work_type: Optional[WorkType] = Query(None),
    salary_min: Optional[float] = Query(None),
    salary_max: Optional[float] = Query(None),
    is_urgent: Optional[bool] = Query(None),
    skill_id: Optional[UUID] = Query(None),
    experience_max: Optional[int] = Query(None),
    start_date_from: Optional[date] = Query(None),
    sort_by: Optional[str] = Query(None),
    status: Optional[JobStatus] = Query(None, description="Default: ACTIVE"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List jobs with filters and pagination."""
    filters = [Job.status == (status or JobStatus.ACTIVE)]

    if keyword:
        filters.append(
            or_(
                Job.title.ilike(f"%{keyword}%"),
                Job.description.ilike(f"%{keyword}%"),
            )
        )
    if category_id:
        filters.append(Job.category_id == category_id)
    if city:
        filters.append(Job.city.ilike(f"%{city}%"))
    if state:
        filters.append(Job.state.ilike(f"%{state}%"))
    if work_type:
        filters.append(Job.work_type == work_type)
    if salary_min is not None:
        filters.append(
            or_(Job.salary_max >= salary_min, Job.salary_min >= salary_min)
        )
    if salary_max is not None:
        filters.append(
            or_(Job.salary_min <= salary_max, Job.salary_max <= salary_max)
        )
    if is_urgent is not None:
        filters.append(Job.is_urgent == is_urgent)
    if skill_id:
        filters.append(Job.required_skills.any(JobRequiredSkill.skill_id == skill_id))
    if experience_max is not None:
        # User has max X experience, so job's required experience must be <= X
        filters.append(Job.experience_required <= experience_max)
    if start_date_from:
        filters.append(Job.start_date >= start_date_from)

    # Calculate total count
    count_query = select(func.count()).select_from(Job).where(and_(*filters))
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Sorting
    order_clauses = [Job.is_urgent.desc()]
    if sort_by == "newest":
        order_clauses.append(Job.created_at.desc())
    elif sort_by == "oldest":
        order_clauses.append(Job.created_at.asc())
    elif sort_by == "salary_desc":
        order_clauses.append(Job.salary_max.desc().nulls_last())
        order_clauses.append(Job.salary_min.desc().nulls_last())
    elif sort_by == "salary_asc":
        order_clauses.append(Job.salary_min.asc().nulls_last())
        order_clauses.append(Job.salary_max.asc().nulls_last())
    else:
        # Default sort
        order_clauses.append(Job.created_at.desc())

    offset = (page - 1) * per_page
    query = (
        select(Job)
        .where(and_(*filters))
        .options(*_load_job_opts())
        .order_by(*order_clauses)
        .offset(offset)
        .limit(per_page)
    )
    result = await db.execute(query)
    items = [JobListResponse.model_validate(j) for j in result.scalars().all()]
    total_pages = (total + per_page - 1) // per_page

    return PaginatedJobListResponse(
        items=items,
        total=total,
        page=page,
        page_size=per_page,
        total_pages=total_pages
    )


@router.post("/jobs", response_model=JobResponse, status_code=201)
async def create_job(
    payload: JobCreate,
    employer_profile: EmployerProfile = Depends(get_employer_profile),
    db: AsyncSession = Depends(get_db),
):
    """Create a new job posting."""
    # Validate category
    cat_result = await db.execute(
        select(JobCategory).where(JobCategory.id == payload.category_id, JobCategory.is_active == True)
    )
    if not cat_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Category not found")

    skill_ids = payload.required_skill_ids or []

    # Validate skill IDs if provided
    if skill_ids:
        skill_result = await db.execute(select(Skill).where(Skill.id.in_(skill_ids)))
        found_skills = {str(s.id) for s in skill_result.scalars().all()}
        invalid = [str(sid) for sid in skill_ids if str(sid) not in found_skills]
        if invalid:
            raise HTTPException(status_code=422, detail=f"Invalid skill IDs: {invalid}")

    job_data = payload.model_dump(exclude={"required_skill_ids"})
    job = Job(employer_id=employer_profile.id, **job_data)
    db.add(job)
    await db.flush()

    # Add required skills
    for skill_id in set(skill_ids):
        db.add(JobRequiredSkill(job_id=job.id, skill_id=skill_id))

    await db.flush()
    
    # Smart Job Alerts (using index on city to avoid full table scan)
    try:
        if job.city:
            # Reload job with required skills to avoid MissingGreenlet
            job_loaded = (await db.execute(select(Job).where(Job.id == job.id).options(*_load_job_opts()))).scalar_one()
            workers_res = await db.execute(
                select(WorkerProfile).where(
                    WorkerProfile.city == job.city,
                    WorkerProfile.job_alerts_enabled == True
                ).options(
                    selectinload(WorkerProfile.skills).selectinload(WorkerSkill.skill)
                )
            )
            for w in workers_res.scalars().all():
                match = MatchingService.calculate_match(w, job_loaded)
                if match["score"] >= 30.0:  # Threshold for alerts
                    await create_notification(
                        db=db,
                        user_id=w.user_id,
                        type="NEW_MATCHING_JOB",
                        title="New Job Alert",
                        body=f"A new job '{job.title}' matches your profile.",
                        reference_id=job.id,
                        reference_type="JOB"
                    )
    except Exception as e:
        # Prevent job creation from failing if alert matching encounters an error
        pass


    result = await db.execute(
        select(Job).where(Job.id == job.id).options(*_load_job_opts())
    )
    return JobResponse.model_validate(result.scalar_one())


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get job details and increment view count."""
    result = await db.execute(
        select(Job).where(Job.id == job_id).options(*_load_job_opts())
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Increment views
    job.views_count += 1
    await db.flush()

    return JobResponse.model_validate(job)


@router.get("/jobs/{job_id}/match", response_model=JobMatchResponse)
async def get_job_match(
    job_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get Smart Matching score between current worker and the specified job."""
    if current_user.role != UserRole.WORKER:
        raise HTTPException(status_code=403, detail="Only workers can calculate match scores")

    # Load job with required skills
    job_result = await db.execute(
        select(Job).where(Job.id == job_id).options(*_load_job_opts())
    )
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Load worker profile with skills
    worker_result = await db.execute(
        select(WorkerProfile)
        .where(WorkerProfile.user_id == current_user.id)
        .options(selectinload(WorkerProfile.skills).selectinload(WorkerSkill.skill))
    )
    worker = worker_result.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found")

    # Calculate match
    match_result = MatchingService.calculate_match(worker, job)
    return JobMatchResponse(**match_result)



@router.get("/jobs/{job_id}/candidates", response_model=PaginatedCandidateMatchResponse)
async def get_job_candidates(
    job_id: UUID,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    employer_profile: EmployerProfile = Depends(get_employer_profile),
    db: AsyncSession = Depends(get_db)
):
    """Get matching candidates for a specific job owned by the employer."""
    # Verify employer owns the job
    job_result = await db.execute(
        select(Job).where(Job.id == job_id, Job.employer_id == employer_profile.id).options(*_load_job_opts())
    )
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not owned by employer")

    # Fetch all active worker profiles with skills (we exclude the employer's own user_id just in case)
    workers_result = await db.execute(
        select(WorkerProfile)
        .where(WorkerProfile.user_id != employer_profile.user_id)
        .options(selectinload(WorkerProfile.skills).selectinload(WorkerSkill.skill))
    )
    workers = workers_result.scalars().all()

    # Fetch existing applications for this job
    applications_result = await db.execute(
        select(JobApplication).where(JobApplication.job_id == job_id)
    )
    applications = {app.worker_id: app.status for app in applications_result.scalars().all()}

    # Calculate matches
    candidates = []
    for worker in workers:
        match_result = MatchingService.calculate_match(worker, job)
        app_status = applications.get(worker.id)
        
        candidates.append({
            "worker": worker,
            "match_score": match_result["score"],
            "match_factors": match_result["factors"],
            "match_explanations": match_result["explanations"],
            "application_status": app_status
        })

    # Sort by match_score descending, then by worker full_name for deterministic sort
    candidates.sort(key=lambda x: (-x["match_score"], x["worker"].full_name or ""))

    # Pagination
    total = len(candidates)
    pages = (total + size - 1) // size if size > 0 else 0
    start_idx = (page - 1) * size
    end_idx = start_idx + size
    paginated_candidates = candidates[start_idx:end_idx]

    return PaginatedCandidateMatchResponse(
        items=paginated_candidates,
        total=total,
        page=page,
        size=size,
        pages=pages
    )


@router.put("/jobs/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: UUID,
    payload: JobUpdate,
    employer_profile: EmployerProfile = Depends(get_employer_profile),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Job).where(Job.id == job_id).options(*_load_job_opts())
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.employer_id != employer_profile.id:
        raise HTTPException(status_code=403, detail="Not your job")

    update_data = payload.model_dump(exclude_unset=True)

    if "required_skill_ids" in update_data:
        skill_ids = update_data.pop("required_skill_ids")
        # Remove old skills — synchronize session so identity map reflects deletion
        await db.execute(
            delete(JobRequiredSkill)
            .where(JobRequiredSkill.job_id == job_id)
            .execution_options(synchronize_session="fetch")
        )
        await db.flush()
        # Add new skills (deduplicated)
        for skill_id in set(skill_ids):
            db.add(JobRequiredSkill(job_id=job.id, skill_id=skill_id))

    for field, value in update_data.items():
        setattr(job, field, value)
    await db.flush()
    await db.commit()
    db.expire_all()

    result = await db.execute(
        select(Job).where(Job.id == job_id).options(*_load_job_opts())
    )
    return JobResponse.model_validate(result.scalar_one())


@router.delete("/jobs/{job_id}", status_code=204)
async def delete_job(
    job_id: UUID,
    employer_profile: EmployerProfile = Depends(get_employer_profile),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.employer_id != employer_profile.id:
        raise HTTPException(status_code=403, detail="Not your job")
    shift_res = await db.execute(
        select(func.count(ShiftBooking.id)).where(
            ShiftBooking.job_id == job_id,
            ShiftBooking.status == BookingStatus.CONFIRMED,
        )
    )
    confirmed_shifts = shift_res.scalar_one()

    if confirmed_shifts > 0 and job.status != JobStatus.CANCELLED:
        job.status = JobStatus.CANCELLED
        await db.flush()
    else:
        await db.delete(job)
        await db.flush()
