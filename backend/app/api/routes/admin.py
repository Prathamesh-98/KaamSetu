import math
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.orm import selectinload

from app.db.session import get_db
import asyncio
from app.models.models import (
    User, Job, JobApplication, WorkerProfile, EmployerProfile, AdminProfile, UserRole,
    JobStatus, ApplicationStatus, VerificationRecord, VerificationType, VerificationStatus,
    ShiftBooking, WorkCompletion, PaymentRecord, PaymentInstallment, PaymentStatus,
    WorkerSkill, Skill, JobCategory
)
from app.schemas.schemas import (
    UserBasic, AdminStats, VerificationRecordResponse, AdminVerificationReviewRequest,
    AdminProfileResponse, AdminProfileUpdate, AdminChangePasswordRequest, AdminChangePasswordResponse,
    AdminUserResponse, AdminUserListResponse, AdminWorkerListItem, AdminWorkerListResponse,
    AdminEmployerListItem, AdminEmployerListResponse, AdminJobListItem, AdminJobListResponse,
    AdminJobStatusUpdate, AdminApplicationListItem, AdminApplicationListResponse,
    AdminPaymentInstallmentItem, AdminCompletedWorkItem, AdminCompletedWorkListResponse,
    WorkType, SalaryType
)
from app.api.dependencies import require_admin, get_admin_profile
from app.core.security import hash_password, verify_password

router = APIRouter(prefix="/admin", tags=["Admin"])


# ─── Admin Profile & Account Management ──────────────────────────────────────

@router.get("/profile", response_model=AdminProfileResponse)
async def get_admin_profile_endpoint(
    current_admin: User = Depends(require_admin),
    profile: AdminProfile = Depends(get_admin_profile),
):
    """
    Get the authenticated admin user's profile details.
    Combines user identity fields (email, role) with admin profile fields.
    """
    return AdminProfileResponse(
        id=profile.id,
        user_id=current_admin.id,
        email=current_admin.email,
        role=current_admin.role,
        full_name=profile.full_name,
        phone=profile.phone or current_admin.phone,
        department=profile.department,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.put("/profile", response_model=AdminProfileResponse)
async def update_admin_profile_endpoint(
    payload: AdminProfileUpdate,
    current_admin: User = Depends(require_admin),
    profile: AdminProfile = Depends(get_admin_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Update the authenticated admin user's profile information (full_name, phone, department).
    Protected fields (role, email, account status) cannot be modified.
    """
    if payload.full_name is not None:
        profile.full_name = payload.full_name.strip()
    if payload.phone is not None:
        profile.phone = payload.phone.strip() if payload.phone else None
        current_admin.phone = profile.phone
    if payload.department is not None:
        profile.department = payload.department.strip() if payload.department else None

    profile.updated_at = datetime.now(timezone.utc)
    current_admin.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(profile)
    await db.refresh(current_admin)

    return AdminProfileResponse(
        id=profile.id,
        user_id=current_admin.id,
        email=current_admin.email,
        role=current_admin.role,
        full_name=profile.full_name,
        phone=profile.phone or current_admin.phone,
        department=profile.department,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.post("/change-password", response_model=AdminChangePasswordResponse)
async def change_admin_password_endpoint(
    payload: AdminChangePasswordRequest,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Change the authenticated admin user's password.
    Requires and verifies current password, validates new password complexity,
    rejects password reuse, and updates bcrypt hash.
    """
    loop = asyncio.get_event_loop()

    # Verify current password
    is_correct = await loop.run_in_executor(
        None, verify_password, payload.current_password, current_admin.password_hash
    )
    if not is_correct:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password.",
        )

    # Reject password reuse
    is_same = await loop.run_in_executor(
        None, verify_password, payload.new_password, current_admin.password_hash
    )
    if is_same:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password cannot be the same as the current password.",
        )

    # Hash new password
    new_hashed = await loop.run_in_executor(
        None, hash_password, payload.new_password
    )
    current_admin.password_hash = new_hashed
    # Increment token_version to immediately revoke all previously issued access tokens
    current_admin.token_version = (current_admin.token_version or 1) + 1
    current_admin.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(current_admin)

    return AdminChangePasswordResponse(
        message="Password changed successfully"
    )


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


# ─── A. User Management ──────────────────────────────────────────────────────

@router.get("/users", response_model=AdminUserListResponse)
async def list_all_users(
    search: Optional[str] = Query(None, description="Search by email or phone"),
    role: Optional[str] = Query(None, description="WORKER, EMPLOYER, ADMIN, or ALL"),
    status: Optional[str] = Query(None, description="active, suspended, or ALL"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Searchable, paginated user list with role and status filtering."""
    stmt = select(User)
    count_stmt = select(func.count(User.id))
    conditions = []

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        conditions.append(
            or_(
                func.lower(User.email).like(term),
                User.phone.like(term),
            )
        )

    if role and role.upper() != "ALL":
        try:
            r_enum = UserRole(role.upper())
            conditions.append(User.role == r_enum)
        except ValueError:
            pass

    if status and status.upper() != "ALL":
        s_lower = status.strip().lower()
        if s_lower == "active":
            conditions.append(User.is_active == True)
        elif s_lower in ("suspended", "inactive"):
            conditions.append(User.is_active == False)

    if conditions:
        stmt = stmt.where(and_(*conditions))
        count_stmt = count_stmt.where(and_(*conditions))

    total = (await db.execute(count_stmt)).scalar_one()
    total_pages = max(1, math.ceil(total / per_page))

    stmt = stmt.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    users = (await db.execute(stmt)).scalars().all()

    # Pre-fetch profile full names for workers, employers, and admins
    user_ids = [u.id for u in users]
    names_map = {}
    if user_ids:
        # Workers
        w_res = await db.execute(
            select(WorkerProfile.user_id, WorkerProfile.full_name)
            .where(WorkerProfile.user_id.in_(user_ids))
        )
        for uid, fn in w_res.all():
            if fn:
                names_map[uid] = fn

        # Employers
        e_res = await db.execute(
            select(EmployerProfile.user_id, EmployerProfile.full_name, EmployerProfile.organization_name)
            .where(EmployerProfile.user_id.in_(user_ids))
        )
        for uid, fn, org in e_res.all():
            names_map[uid] = org or fn

        # Admins
        a_res = await db.execute(
            select(AdminProfile.user_id, AdminProfile.full_name)
            .where(AdminProfile.user_id.in_(user_ids))
        )
        for uid, fn in a_res.all():
            if fn:
                names_map[uid] = fn

    items = [
        AdminUserResponse(
            id=u.id,
            email=u.email,
            phone=u.phone,
            role=u.role,
            is_active=u.is_active,
            is_verified=u.is_verified,
            full_name=names_map.get(u.id),
            created_at=u.created_at,
            updated_at=u.updated_at,
        )
        for u in users
    ]

    return AdminUserListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.put("/users/{user_id}/status")
async def toggle_user_status(
    user_id: UUID,
    is_active: bool,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin: Activate or suspend a user account.
    Safeguard: Protects the current admin from accidental self-lockout.
    Revokes access tokens immediately upon suspension.
    """
    if user_id == current_admin.id and not is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own administrator account.",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = is_active
    if not is_active:
        # Invalidate existing JWT sessions for suspended account
        user.token_version = (user.token_version or 1) + 1
    user.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(user)
    return {
        "message": f"User {'activated' if is_active else 'suspended'} successfully",
        "is_active": user.is_active,
    }


# ─── B. Worker Management ────────────────────────────────────────────────────

@router.get("/workers", response_model=AdminWorkerListResponse)
async def list_all_workers(
    search: Optional[str] = Query(None, description="Search by worker name, city, or bio"),
    verified_only: Optional[bool] = Query(None, description="Filter verified workers"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Searchable, paginated listing of worker profiles with skills and verification status."""
    stmt = (
        select(WorkerProfile)
        .join(User, WorkerProfile.user_id == User.id)
        .options(
            selectinload(WorkerProfile.skills).selectinload(WorkerSkill.skill),
            selectinload(WorkerProfile.user),
        )
    )
    count_stmt = select(func.count(WorkerProfile.id)).join(User, WorkerProfile.user_id == User.id)
    conditions = []

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        conditions.append(
            or_(
                func.lower(WorkerProfile.full_name).like(term),
                func.lower(WorkerProfile.city).like(term),
                func.lower(User.email).like(term),
                User.phone.like(term),
            )
        )

    if verified_only is True:
        conditions.append(WorkerProfile.is_identity_verified == True)

    if conditions:
        stmt = stmt.where(and_(*conditions))
        count_stmt = count_stmt.where(and_(*conditions))

    total = (await db.execute(count_stmt)).scalar_one()
    total_pages = max(1, math.ceil(total / per_page))

    stmt = stmt.order_by(WorkerProfile.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    workers = (await db.execute(stmt)).scalars().all()

    items = [
        AdminWorkerListItem(
            id=w.id,
            user_id=w.user_id,
            full_name=w.full_name,
            phone=w.user.phone if w.user else None,
            email=w.user.email if w.user else None,
            bio=w.bio,
            city=w.city,
            state=w.state,
            experience_years=w.years_experience,
            hourly_rate=float(w.expected_salary) if (w.expected_salary is not None and w.salary_type == SalaryType.HOURLY) else None,
            daily_rate=float(w.expected_salary) if (w.expected_salary is not None and w.salary_type == SalaryType.DAILY) else None,
            is_verified=w.is_identity_verified,
            is_identity_verified=w.is_identity_verified,
            is_phone_verified=w.is_phone_verified,
            is_active=w.user.is_active if w.user else True,
            skills=[ws.skill.name for ws in w.skills if ws.skill],
            created_at=w.created_at,
        )
        for w in workers
    ]

    return AdminWorkerListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.get("/workers/{worker_id}", response_model=AdminWorkerListItem)
async def get_worker_detail(
    worker_id: UUID,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Get detailed worker profile by ID."""
    stmt = (
        select(WorkerProfile)
        .where(WorkerProfile.id == worker_id)
        .options(
            selectinload(WorkerProfile.skills).selectinload(WorkerSkill.skill),
            selectinload(WorkerProfile.user),
        )
    )
    worker = (await db.execute(stmt)).scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker profile not found")

    return AdminWorkerListItem(
        id=worker.id,
        user_id=worker.user_id,
        full_name=worker.full_name,
        phone=worker.user.phone if worker.user else None,
        email=worker.user.email if worker.user else None,
        bio=worker.bio,
        city=worker.city,
        state=worker.state,
        experience_years=worker.years_experience,
        hourly_rate=float(worker.expected_salary) if (worker.expected_salary is not None and worker.salary_type == SalaryType.HOURLY) else None,
        daily_rate=float(worker.expected_salary) if (worker.expected_salary is not None and worker.salary_type == SalaryType.DAILY) else None,
        is_verified=(worker.user.is_verified if worker.user else False) or worker.is_identity_verified,
        is_identity_verified=worker.is_identity_verified,
        is_phone_verified=worker.is_phone_verified,
        is_active=worker.user.is_active if worker.user else True,
        skills=[ws.skill.name for ws in worker.skills if ws.skill],
        created_at=worker.created_at,
    )


# ─── C. Employer Management ──────────────────────────────────────────────────

@router.get("/employers", response_model=AdminEmployerListResponse)
async def list_all_employers(
    search: Optional[str] = Query(None, description="Search by name, organization, or city"),
    verified_only: Optional[bool] = Query(None, description="Filter verified employers"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Searchable, paginated listing of employers with active job counts."""
    stmt = (
        select(EmployerProfile)
        .join(User, EmployerProfile.user_id == User.id)
        .options(selectinload(EmployerProfile.user))
    )
    count_stmt = select(func.count(EmployerProfile.id)).join(User, EmployerProfile.user_id == User.id)
    conditions = []

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        conditions.append(
            or_(
                func.lower(EmployerProfile.full_name).like(term),
                func.lower(EmployerProfile.organization_name).like(term),
                func.lower(EmployerProfile.city).like(term),
                func.lower(User.email).like(term),
                User.phone.like(term),
            )
        )

    if verified_only is True:
        conditions.append(EmployerProfile.is_verified == True)

    if conditions:
        stmt = stmt.where(and_(*conditions))
        count_stmt = count_stmt.where(and_(*conditions))

    total = (await db.execute(count_stmt)).scalar_one()
    total_pages = max(1, math.ceil(total / per_page))

    stmt = stmt.order_by(EmployerProfile.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    employers = (await db.execute(stmt)).scalars().all()

    # Pre-fetch job counts
    emp_ids = [e.id for e in employers]
    active_counts = {}
    total_counts = {}
    if emp_ids:
        # Total jobs
        tot_res = await db.execute(
            select(Job.employer_id, func.count(Job.id))
            .where(Job.employer_id.in_(emp_ids))
            .group_by(Job.employer_id)
        )
        for eid, cnt in tot_res.all():
            total_counts[eid] = cnt

        # Active jobs
        act_res = await db.execute(
            select(Job.employer_id, func.count(Job.id))
            .where(and_(Job.employer_id.in_(emp_ids), Job.status == JobStatus.ACTIVE))
            .group_by(Job.employer_id)
        )
        for eid, cnt in act_res.all():
            active_counts[eid] = cnt

    items = [
        AdminEmployerListItem(
            id=e.id,
            user_id=e.user_id,
            full_name=e.full_name,
            organization_name=e.organization_name,
            organization_type=e.organization_type,
            email=e.user.email if e.user else None,
            phone=e.user.phone if e.user else None,
            city=e.city,
            state=e.state,
            is_verified=e.is_verified,
            is_active=e.user.is_active if e.user else True,
            active_jobs_count=active_counts.get(e.id, 0),
            total_jobs_count=total_counts.get(e.id, 0),
            created_at=e.created_at,
        )
        for e in employers
    ]

    return AdminEmployerListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.get("/employers/{employer_id}", response_model=AdminEmployerListItem)
async def get_employer_detail(
    employer_id: UUID,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Get detailed employer profile by ID."""
    stmt = (
        select(EmployerProfile)
        .where(EmployerProfile.id == employer_id)
        .options(selectinload(EmployerProfile.user))
    )
    employer = (await db.execute(stmt)).scalar_one_or_none()
    if not employer:
        raise HTTPException(status_code=404, detail="Employer profile not found")

    active_cnt = (await db.execute(
        select(func.count(Job.id)).where(and_(Job.employer_id == employer.id, Job.status == JobStatus.ACTIVE))
    )).scalar_one()

    total_cnt = (await db.execute(
        select(func.count(Job.id)).where(Job.employer_id == employer.id)
    )).scalar_one()

    return AdminEmployerListItem(
        id=employer.id,
        user_id=employer.user_id,
        full_name=employer.full_name,
        organization_name=employer.organization_name,
        organization_type=employer.organization_type,
        email=employer.user.email if employer.user else None,
        phone=employer.user.phone if employer.user else None,
        city=employer.city,
        state=employer.state,
        is_verified=employer.is_verified,
        is_active=employer.user.is_active if employer.user else True,
        active_jobs_count=active_cnt,
        total_jobs_count=total_cnt,
        created_at=employer.created_at,
    )


# ─── D. Jobs Management ──────────────────────────────────────────────────────

@router.get("/jobs", response_model=AdminJobListResponse)
async def list_all_jobs(
    search: Optional[str] = Query(None, description="Search by title, city, or employer"),
    status: Optional[str] = Query(None, description="ACTIVE, CLOSED, COMPLETED, DRAFT, CANCELLED, or ALL"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Searchable, paginated listing of all platform jobs across all lifecycle statuses."""
    stmt = (
        select(Job)
        .join(EmployerProfile, Job.employer_id == EmployerProfile.id)
        .options(
            selectinload(Job.employer),
            selectinload(Job.category),
        )
    )
    count_stmt = select(func.count(Job.id)).join(EmployerProfile, Job.employer_id == EmployerProfile.id)
    conditions = []

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        conditions.append(
            or_(
                func.lower(Job.title).like(term),
                func.lower(Job.city).like(term),
                func.lower(EmployerProfile.organization_name).like(term),
                func.lower(EmployerProfile.full_name).like(term),
            )
        )

    if status and status.upper() != "ALL":
        try:
            j_status = JobStatus(status.upper())
            conditions.append(Job.status == j_status)
        except ValueError:
            pass

    if conditions:
        stmt = stmt.where(and_(*conditions))
        count_stmt = count_stmt.where(and_(*conditions))

    total = (await db.execute(count_stmt)).scalar_one()
    total_pages = max(1, math.ceil(total / per_page))

    stmt = stmt.order_by(Job.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    jobs = (await db.execute(stmt)).scalars().all()

    # Pre-fetch application counts
    job_ids = [j.id for j in jobs]
    app_counts = {}
    if job_ids:
        app_res = await db.execute(
            select(JobApplication.job_id, func.count(JobApplication.id))
            .where(JobApplication.job_id.in_(job_ids))
            .group_by(JobApplication.job_id)
        )
        for jid, cnt in app_res.all():
            app_counts[jid] = cnt

    items = [
        AdminJobListItem(
            id=j.id,
            employer_id=j.employer_id,
            employer_name=j.employer.full_name if j.employer else None,
            organization_name=j.employer.organization_name if j.employer else None,
            title=j.title,
            category_name=j.category.name if j.category else None,
            work_type=j.work_type,
            status=j.status,
            city=j.city,
            state=j.state,
            salary_min=float(j.salary_min) if j.salary_min is not None else None,
            salary_max=float(j.salary_max) if j.salary_max is not None else None,
            salary_type=j.salary_type,
            applications_count=app_counts.get(j.id, 0),
            created_at=j.created_at,
        )
        for j in jobs
    ]

    return AdminJobListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.put("/jobs/{job_id}/status")
async def update_job_status(
    job_id: UUID,
    payload: AdminJobStatusUpdate,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin: Moderate job status (CLOSE, CANCEL, or REOPEN).
    Does NOT permanently delete jobs, preserving referential integrity and audit records.
    """
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job.status = payload.status
    job.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(job)
    return {
        "message": f"Job status updated to '{job.status.value}' successfully",
        "job_id": job.id,
        "status": job.status,
    }


# ─── E. Applications Management ──────────────────────────────────────────────

@router.get("/applications", response_model=AdminApplicationListResponse)
async def list_all_applications(
    status: Optional[str] = Query(None, description="PENDING, ACCEPTED, REJECTED, SHORTLISTED, etc."),
    search: Optional[str] = Query(None, description="Search by job title or worker name"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Cross-platform view of job applications with worker and job counterpart details."""
    stmt = (
        select(JobApplication)
        .join(Job, JobApplication.job_id == Job.id)
        .join(WorkerProfile, JobApplication.worker_id == WorkerProfile.id)
        .options(
            selectinload(JobApplication.job).selectinload(Job.employer),
            selectinload(JobApplication.worker).selectinload(WorkerProfile.user),
            selectinload(JobApplication.shift_booking),
        )
    )
    count_stmt = (
        select(func.count(JobApplication.id))
        .join(Job, JobApplication.job_id == Job.id)
        .join(WorkerProfile, JobApplication.worker_id == WorkerProfile.id)
    )
    conditions = []

    if status and status.upper() != "ALL":
        try:
            a_status = ApplicationStatus(status.upper())
            conditions.append(JobApplication.status == a_status)
        except ValueError:
            pass

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        conditions.append(
            or_(
                func.lower(Job.title).like(term),
                func.lower(WorkerProfile.full_name).like(term),
            )
        )

    if conditions:
        stmt = stmt.where(and_(*conditions))
        count_stmt = count_stmt.where(and_(*conditions))

    total = (await db.execute(count_stmt)).scalar_one()
    total_pages = max(1, math.ceil(total / per_page))

    stmt = stmt.order_by(JobApplication.applied_at.desc()).offset((page - 1) * per_page).limit(per_page)
    applications = (await db.execute(stmt)).scalars().all()

    items = [
        AdminApplicationListItem(
            id=a.id,
            job_id=a.job_id,
            job_title=a.job.title if a.job else "Untitled Job",
            employer_name=(
                a.job.employer.organization_name or a.job.employer.full_name
                if (a.job and a.job.employer) else "Unknown"
            ),
            worker_id=a.worker_id,
            worker_name=a.worker.full_name if a.worker else "Unknown",
            worker_email=a.worker.user.email if (a.worker and a.worker.user) else None,
            worker_phone=a.worker.user.phone if (a.worker and a.worker.user) else None,
            status=a.status,
            proposed_rate=float(a.shift_booking.proposed_rate) if (a.shift_booking and a.shift_booking.proposed_rate is not None) else None,
            cover_letter=a.cover_note,
            applied_at=a.applied_at,
        )
        for a in applications
    ]

    return AdminApplicationListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


# ─── F. Completed Work & Offline Settlement Ledger ───────────────────────────

@router.get("/completed-work", response_model=AdminCompletedWorkListResponse)
async def list_all_completed_work(
    payment_status: Optional[str] = Query(None, description="CONFIRMED, PENDING_CONFIRMATION, PARTIALLY_PAID, DISPUTED"),
    disputed_only: Optional[bool] = Query(None, description="Filter only disputed payments"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin: Review platform-wide completed work completions and offline payment records.
    Strictly read-only audit ledger (no payment gateway / escrow integrations).
    """
    stmt = (
        select(WorkCompletion)
        .join(ShiftBooking, WorkCompletion.shift_booking_id == ShiftBooking.id)
        .outerjoin(PaymentRecord, PaymentRecord.work_completion_id == WorkCompletion.id)
        .options(
            selectinload(WorkCompletion.payment_record).selectinload(PaymentRecord.installments),
            selectinload(WorkCompletion.shift_booking).selectinload(ShiftBooking.job),
            selectinload(WorkCompletion.shift_booking).selectinload(ShiftBooking.worker),
            selectinload(WorkCompletion.shift_booking).selectinload(ShiftBooking.employer),
        )
    )
    count_stmt = (
        select(func.count(WorkCompletion.id))
        .join(ShiftBooking, WorkCompletion.shift_booking_id == ShiftBooking.id)
        .outerjoin(PaymentRecord, PaymentRecord.work_completion_id == WorkCompletion.id)
    )
    conditions = []

    if payment_status and payment_status.upper() != "ALL":
        try:
            p_status = PaymentStatus(payment_status.upper())
            conditions.append(PaymentRecord.payment_status == p_status)
        except ValueError:
            pass

    if disputed_only is True:
        conditions.append(PaymentRecord.payment_status == PaymentStatus.DISPUTED)

    if conditions:
        stmt = stmt.where(and_(*conditions))
        count_stmt = count_stmt.where(and_(*conditions))

    total = (await db.execute(count_stmt)).scalar_one()
    total_pages = max(1, math.ceil(total / per_page))

    stmt = stmt.order_by(WorkCompletion.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
    completions = (await db.execute(stmt)).scalars().all()

    items = []
    for c in completions:
        pr = c.payment_record
        sb = c.shift_booking
        job_title = sb.job.title if (sb and sb.job) else "Direct Shift"
        worker_name = sb.worker.full_name if (sb and sb.worker) else "Unknown Worker"
        employer_name = (
            sb.employer.organization_name or sb.employer.full_name
            if (sb and sb.employer) else "Unknown Employer"
        )

        installments_list = []
        if pr and pr.installments:
            installments_list = [
                AdminPaymentInstallmentItem(
                    id=inst.id,
                    installment_number=inst.installment_number,
                    amount=float(inst.amount),
                    payment_method=inst.payment_method,
                    payment_date=inst.payment_date,
                    payment_reference=inst.payment_reference,
                    notes=inst.notes,
                    is_confirmed=inst.is_confirmed,
                    worker_confirmed_at=inst.worker_confirmed_at,
                )
                for inst in sorted(pr.installments, key=lambda x: x.installment_number)
            ]

        items.append(
            AdminCompletedWorkItem(
                completion_id=c.id,
                booking_id=c.shift_booking_id,
                job_title=job_title,
                worker_name=worker_name,
                employer_name=employer_name,
                actual_start_time=c.actual_start_time,
                actual_end_time=c.actual_end_time,
                hours_worked=float(c.hours_worked),
                completion_notes=c.completion_notes,
                agreed_amount=float(pr.agreed_amount) if pr else 0.0,
                amount_paid=float(pr.amount_paid) if pr else 0.0,
                outstanding_balance=float(pr.outstanding_balance) if pr else 0.0,
                payment_status=pr.payment_status if pr else PaymentStatus.PENDING_CONFIRMATION,
                dispute_reason=pr.dispute_reason if pr else None,
                disputed_at=pr.disputed_at if pr else None,
                installments=installments_list,
                completed_at=c.created_at,
            )
        )

    return AdminCompletedWorkListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


# ─── Verification Review Queue & Actions (Feature 2) ─────────────────────────

async def recalculate_user_trust_flags(user_id: UUID, db: AsyncSession):
    """
    Recalculates authoritative profile trust flags for a user based on active,
    non-expired VERIFIED verification records.
    Never clears a flag if another active verified record still justifies it.
    Excludes REJECTED, PENDING, and EXPIRED records.
    Must be executed within the active database transaction before commit/flush.
    """
    res = await db.execute(
        select(VerificationRecord).where(
            and_(
                VerificationRecord.user_id == user_id,
                VerificationRecord.status == VerificationStatus.VERIFIED,
            )
        )
    )
    verified_records = res.scalars().all()

    # Filter out expired records
    active_records = [r for r in verified_records if not r.is_expired]

    has_active_phone = any(r.verification_type == VerificationType.PHONE for r in active_records)
    has_active_identity = any(r.verification_type == VerificationType.IDENTITY for r in active_records)
    has_active_company = any(r.verification_type == VerificationType.PROFILE for r in active_records)
    has_any_verified = len(active_records) > 0

    user_res = await db.execute(select(User).where(User.id == user_id))
    user = user_res.scalar_one_or_none()
    if not user:
        return

    if user.role == UserRole.WORKER:
        wp_res = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == user_id))
        wp = wp_res.scalar_one_or_none()
        if wp:
            wp.is_identity_verified = has_active_identity
            wp.is_phone_verified = has_active_phone
        user.is_verified = has_active_identity
    elif user.role == UserRole.EMPLOYER:
        ep_res = await db.execute(select(EmployerProfile).where(EmployerProfile.user_id == user_id))
        ep = ep_res.scalar_one_or_none()
        if ep:
            ep.is_verified = has_active_company
        user.is_verified = has_active_company
    else:
        user.is_verified = has_any_verified


@router.get("/verifications/queue", response_model=List[VerificationRecordResponse])
async def get_verification_queue(
    status_filter: Optional[str] = Query(None, alias="status", description="PENDING, VERIFIED, REJECTED, EXPIRED, or ALL"),
    type_filter: Optional[str] = Query(None, alias="type", description="PHONE, IDENTITY, SKILL, PROFILE"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin: Review verification submissions across the platform.
    Defaults to all submissions or filtered by status and verification type.
    """
    stmt = select(VerificationRecord)

    conditions = []
    if status_filter and status_filter.upper() != "ALL":
        try:
            v_status = VerificationStatus(status_filter.upper())
            conditions.append(VerificationRecord.status == v_status)
        except ValueError:
            pass
    if type_filter and type_filter.upper() != "ALL":
        try:
            v_type = VerificationType(type_filter.upper())
            conditions.append(VerificationRecord.verification_type == v_type)
        except ValueError:
            pass

    if conditions:
        stmt = stmt.where(and_(*conditions))

    stmt = stmt.order_by(desc(VerificationRecord.created_at)).offset((page - 1) * per_page).limit(per_page)
    res = await db.execute(stmt)
    records = res.scalars().all()
    return [VerificationRecordResponse.from_orm_record(r) for r in records]


@router.get("/verifications/{record_id}", response_model=VerificationRecordResponse)
async def get_verification_record_detail(
    record_id: UUID,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin: Get detailed information for a specific verification submission."""
    res = await db.execute(select(VerificationRecord).where(VerificationRecord.id == record_id))
    record = res.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification record not found.")
    return VerificationRecordResponse.from_orm_record(record)


@router.post("/verifications/{record_id}/approve", response_model=VerificationRecordResponse)
async def approve_verification(
    record_id: UUID,
    payload: Optional[AdminVerificationReviewRequest] = None,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin: Approve a verification submission.
    Enforces PENDING status, uses row locking, prevents self-approval,
    and recalculates profile trust flags based on active verified records.
    """
    res = await db.execute(
        select(VerificationRecord)
        .where(VerificationRecord.id == record_id)
        .with_for_update()
    )
    record = res.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification record not found.")

    if record.status != VerificationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve verification record in '{record.status.value}' status. Only PENDING submissions can be approved.",
        )

    if record.user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Self-approval is forbidden. An admin cannot approve their own verification record.",
        )

    now = datetime.now(timezone.utc)
    record.status = VerificationStatus.VERIFIED
    record.verified_by = current_admin.id
    record.verified_at = now

    exp = payload.expires_at if payload else None
    reviewer_notes = payload.reviewer_notes if payload else None
    if exp:
        record.expires_at = exp
    if reviewer_notes:
        record.set_metadata(reviewer_notes=reviewer_notes)

    await db.flush()
    await recalculate_user_trust_flags(record.user_id, db)
    await db.flush()
    await db.refresh(record)
    return VerificationRecordResponse.from_orm_record(record)


@router.post("/verifications/{record_id}/reject", response_model=VerificationRecordResponse)
async def reject_verification(
    record_id: UUID,
    payload: AdminVerificationReviewRequest,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin: Reject a verification submission.
    Enforces PENDING status, requires non-empty rejection reason, uses row locking,
    and recalculates trust flags.
    """
    if not payload.rejection_reason or not payload.rejection_reason.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A non-empty rejection_reason is mandatory when rejecting a verification submission.",
        )

    res = await db.execute(
        select(VerificationRecord)
        .where(VerificationRecord.id == record_id)
        .with_for_update()
    )
    record = res.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification record not found.")

    if record.status != VerificationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject verification record in '{record.status.value}' status. Only PENDING submissions can be rejected.",
        )

    now = datetime.now(timezone.utc)
    record.status = VerificationStatus.REJECTED
    record.verified_by = current_admin.id
    record.verified_at = now
    record.rejection_reason = payload.rejection_reason.strip()
    if payload.reviewer_notes:
        record.set_metadata(reviewer_notes=payload.reviewer_notes)

    await db.flush()
    await recalculate_user_trust_flags(record.user_id, db)
    await db.flush()
    await db.refresh(record)
    return VerificationRecordResponse.from_orm_record(record)


@router.post("/verifications/{record_id}/revoke", response_model=VerificationRecordResponse)
async def revoke_verification(
    record_id: UUID,
    payload: AdminVerificationReviewRequest,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin: Revoke an existing verified record if discovered fraudulent or invalidated.
    Enforces VERIFIED status, requires non-empty revocation reason, uses row locking,
    and recalculates trust flags.
    """
    if not payload.rejection_reason or not payload.rejection_reason.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A revocation reason is required.",
        )

    res = await db.execute(
        select(VerificationRecord)
        .where(VerificationRecord.id == record_id)
        .with_for_update()
    )
    record = res.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification record not found.")

    if record.status != VerificationStatus.VERIFIED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot revoke verification record in '{record.status.value}' status. Only VERIFIED records can be revoked.",
        )

    now = datetime.now(timezone.utc)
    record.status = VerificationStatus.REJECTED
    record.verified_by = current_admin.id
    record.verified_at = now
    record.rejection_reason = f"[REVOKED] {payload.rejection_reason.strip()}"

    await db.flush()
    await recalculate_user_trust_flags(record.user_id, db)
    await db.flush()
    await db.refresh(record)
    return VerificationRecordResponse.from_orm_record(record)
