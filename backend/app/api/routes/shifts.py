from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from uuid import UUID
from typing import List, Optional
from datetime import datetime, timezone
from app.db.session import get_db

def ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

async def _notify_booking_counterpart(db, booking, user_role, action):
    try:
        if str(user_role).upper() == "WORKER":
            from app.models.models import EmployerProfile
            emp_res = await db.execute(select(EmployerProfile).where(EmployerProfile.id == booking.employer_id))
            emp = emp_res.scalar_one_or_none()
            if emp:
                await create_notification(db, emp.user_id, f"SHIFT_{action.upper()}", f"Shift {action}", f"A shift was {action.lower()}.", booking.id, "SHIFT_BOOKING")
        else:
            from app.models.models import WorkerProfile
            work_res = await db.execute(select(WorkerProfile).where(WorkerProfile.id == booking.worker_id))
            worker = work_res.scalar_one_or_none()
            if worker:
                await create_notification(db, worker.user_id, f"SHIFT_{action.upper()}", f"Shift {action}", f"A shift was {action.lower()}.", booking.id, "SHIFT_BOOKING")
    except Exception:
        pass

from app.api.dependencies import get_current_user, require_worker, require_employer, get_worker_profile, get_employer_profile
from app.models.models import User, UserRole, WorkerProfile, EmployerProfile, WorkerAvailability, ShiftBooking, Job, BookingStatus, AvailabilityStatus
from app.services.notification_service import create_notification
from app.schemas.schemas import (
    WorkerAvailabilityCreate, WorkerAvailabilityResponse, WorkerAvailabilityUpdate,
    ShiftBookingCreate, ShiftBookingResponse, ShiftBookingUpdate, ShiftBookingReschedule
)

router = APIRouter(tags=["Shifts & Availability"])

# ==========================================
# WORKER AVAILABILITY
# ==========================================

@router.get("/availability/me", response_model=List[WorkerAvailabilityResponse])
async def get_my_availability(
    profile: WorkerProfile = Depends(get_worker_profile),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(WorkerAvailability).where(WorkerAvailability.worker_id == profile.id)
        .order_by(WorkerAvailability.start_time)
    )
    return result.scalars().all()

@router.post("/availability", response_model=WorkerAvailabilityResponse)
async def create_availability(
    data: WorkerAvailabilityCreate,
    profile: WorkerProfile = Depends(get_worker_profile),
    db: AsyncSession = Depends(get_db)
):
    start_utc = ensure_utc(data.start_time)
    end_utc = ensure_utc(data.end_time)

    # Overlap check
    conflict = await db.execute(
        select(WorkerAvailability).where(
            WorkerAvailability.worker_id == profile.id,
            WorkerAvailability.start_time < end_utc,
            WorkerAvailability.end_time > start_utc
        )
    )
    if conflict.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Availability timeslot overlaps with an existing one")
        
    avail_dict = data.model_dump()
    avail_dict["start_time"] = start_utc
    avail_dict["end_time"] = end_utc
    avail = WorkerAvailability(**avail_dict, worker_id=profile.id)
    db.add(avail)
    await db.commit()
    await db.refresh(avail)
    return avail

@router.patch("/availability/{avail_id}", response_model=WorkerAvailabilityResponse)
async def update_availability(
    avail_id: UUID,
    data: WorkerAvailabilityUpdate,
    profile: WorkerProfile = Depends(get_worker_profile),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(WorkerAvailability).where(WorkerAvailability.id == avail_id, WorkerAvailability.worker_id == profile.id))
    avail = result.scalar_one_or_none()
    if not avail:
        raise HTTPException(status_code=404, detail="Availability not found")
        
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(avail, key, value)
        
    if avail.start_time >= avail.end_time:
        raise HTTPException(status_code=400, detail="Start time must precede end time")
        
    await db.commit()
    await db.refresh(avail)
    return avail

@router.delete("/availability/{avail_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_availability(
    avail_id: UUID,
    profile: WorkerProfile = Depends(get_worker_profile),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(WorkerAvailability).where(WorkerAvailability.id == avail_id, WorkerAvailability.worker_id == profile.id))
    avail = result.scalar_one_or_none()
    if not avail:
        raise HTTPException(status_code=404, detail="Availability not found")
        
    await db.delete(avail)
    await db.commit()
    return None

# ==========================================
# SHIFT BOOKINGS
# ==========================================

@router.post("/shift-bookings", response_model=ShiftBookingResponse)
async def request_shift(
    data: ShiftBookingCreate,
    employer: EmployerProfile = Depends(get_employer_profile),
    db: AsyncSession = Depends(get_db)
):
    start_utc = ensure_utc(data.start_time)
    end_utc = ensure_utc(data.end_time)

    if start_utc >= end_utc:
        raise HTTPException(status_code=400, detail="Start time must be before end time")

    # 1. Verify worker exists
    worker_check = await db.execute(select(WorkerProfile).where(WorkerProfile.id == data.worker_id))
    worker = worker_check.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    # 2. Verify job authorization if job_id is provided
    if data.job_id:
        job_result = await db.execute(select(Job).where(Job.id == data.job_id))
        job = job_result.scalar_one_or_none()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        if job.employer_id != employer.id:
            raise HTTPException(status_code=403, detail="You are not authorized to request shifts for this job")

    # 3. Check for conflicting confirmed bookings for this worker
    conflict = await db.execute(
        select(ShiftBooking).where(
            ShiftBooking.worker_id == data.worker_id,
            ShiftBooking.status == BookingStatus.CONFIRMED,
            ShiftBooking.start_time < end_utc,
            ShiftBooking.end_time > start_utc
        )
    )
    if conflict.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Worker already has a confirmed booking during this time")

    # 4. Check worker availability
    avail_res = await db.execute(
        select(WorkerAvailability).where(
            WorkerAvailability.worker_id == data.worker_id,
            WorkerAvailability.status == AvailabilityStatus.AVAILABLE
        )
    )
    available_slots = avail_res.scalars().all()
    if available_slots:
        is_compatible = any(
            ensure_utc(slot.start_time) <= start_utc and ensure_utc(slot.end_time) >= end_utc
            for slot in available_slots
        )
        if not is_compatible:
            raise HTTPException(
                status_code=400,
                detail="Requested shift is outside worker's saved availability"
            )
    elif worker.availability_status == AvailabilityStatus.UNAVAILABLE:
        raise HTTPException(
            status_code=400,
            detail="Worker is currently marked as unavailable"
        )

    # 5. Create booking
    booking_dict = data.model_dump()
    booking_dict["start_time"] = start_utc
    booking_dict["end_time"] = end_utc
    booking = ShiftBooking(**booking_dict, employer_id=employer.id)
    db.add(booking)
    await db.flush()
    await db.refresh(booking)

    # 6. Notify worker safely
    try:
        emp_name = employer.organization_name or employer.full_name or "An employer"
        await create_notification(
            db=db,
            user_id=worker.user_id,
            type="SHIFT_REQUESTED",
            title="Shift Requested",
            body=f"{emp_name} requested a shift.",
            reference_id=booking.id,
            reference_type="SHIFT_BOOKING"
        )
    except Exception:
        pass

    return booking

@router.get("/shift-bookings/me", response_model=List[ShiftBookingResponse])
async def get_my_shift_bookings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if user.role == "WORKER":
        profile_q = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == user.id))
        profile = profile_q.scalar_one_or_none()
        if not profile:
            return []
        q = select(ShiftBooking).where(ShiftBooking.worker_id == profile.id)
    elif user.role == "EMPLOYER":
        profile_q = await db.execute(select(EmployerProfile).where(EmployerProfile.user_id == user.id))
        profile = profile_q.scalar_one_or_none()
        if not profile:
            return []
        q = select(ShiftBooking).where(ShiftBooking.employer_id == profile.id)
    else:
        return []
        
    q = q.order_by(ShiftBooking.start_time.desc())
    result = await db.execute(q)
    return result.scalars().all()

@router.post("/shift-bookings/{booking_id}/accept", response_model=ShiftBookingResponse)
async def accept_shift(
    booking_id: UUID,
    worker: WorkerProfile = Depends(get_worker_profile),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(ShiftBooking).where(ShiftBooking.id == booking_id, ShiftBooking.worker_id == worker.id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking.status not in [BookingStatus.PENDING, BookingStatus.RESCHEDULE_REQUESTED]:
        raise HTTPException(status_code=400, detail=f"Cannot accept booking in {booking.status} state")
        
    # Acquire row-level lock on the worker to serialize acceptance decisions and prevent double-booking race conditions
    await db.execute(
        select(WorkerProfile.id).where(WorkerProfile.id == worker.id).with_for_update()
    )

    # Overlap check within lock boundary
    conflict = await db.execute(
        select(ShiftBooking).where(
            ShiftBooking.worker_id == worker.id,
            ShiftBooking.status == BookingStatus.CONFIRMED,
            ShiftBooking.start_time < booking.end_time,
            ShiftBooking.end_time > booking.start_time
        )
    )
    if conflict.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Shift overlaps with an existing confirmed booking")
        
    booking.status = BookingStatus.CONFIRMED
    await db.flush()
    await _notify_booking_counterpart(db, booking, "WORKER", "Accepted")
    await db.commit()
    return booking

@router.post("/shift-bookings/{booking_id}/decline", response_model=ShiftBookingResponse)
async def decline_shift(
    booking_id: UUID,
    worker: WorkerProfile = Depends(get_worker_profile),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(ShiftBooking).where(ShiftBooking.id == booking_id, ShiftBooking.worker_id == worker.id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    if booking.status != BookingStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only decline pending requests")
        
    booking.status = BookingStatus.DECLINED
    await db.flush()
    await _notify_booking_counterpart(db, booking, "WORKER", "Declined")
    return booking

@router.post("/shift-bookings/{booking_id}/cancel", response_model=ShiftBookingResponse)
async def cancel_shift(
    booking_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(ShiftBooking).where(ShiftBooking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    if user.role == "WORKER" or user.role == UserRole.WORKER:
        w_prof = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == user.id))
        w = w_prof.scalar_one_or_none()
        if not w or booking.worker_id != w.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif user.role == "EMPLOYER" or user.role == UserRole.EMPLOYER:
        e_prof = await db.execute(select(EmployerProfile).where(EmployerProfile.user_id == user.id))
        e = e_prof.scalar_one_or_none()
        if not e or booking.employer_id != e.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif user.role != "ADMIN" and user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
            
    if booking.status in [BookingStatus.CANCELLED, BookingStatus.COMPLETED]:
        raise HTTPException(status_code=400, detail="Booking already cancelled or completed")
        
    booking.status = BookingStatus.CANCELLED
    booking.cancelled_by = user.id
    await db.flush()
    await _notify_booking_counterpart(db, booking, user.role.value if hasattr(user.role, 'value') else str(user.role), "Cancelled")
    return booking

@router.get("/workers/{worker_id}/availability", response_model=List[WorkerAvailabilityResponse])
async def get_worker_availability(
    worker_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve public available slots for a worker."""
    result = await db.execute(
        select(WorkerAvailability).where(
            WorkerAvailability.worker_id == worker_id,
            WorkerAvailability.status == AvailabilityStatus.AVAILABLE
        ).order_by(WorkerAvailability.start_time)
    )
    return result.scalars().all()
