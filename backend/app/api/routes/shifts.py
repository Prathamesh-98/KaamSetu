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

from decimal import Decimal
from sqlalchemy.orm import selectinload
from sqlalchemy import func, desc
from app.api.dependencies import get_current_user, require_worker, require_employer, get_worker_profile, get_employer_profile
from app.models.models import (
    User, UserRole, WorkerProfile, EmployerProfile, WorkerAvailability, ShiftBooking, Job,
    BookingStatus, AvailabilityStatus, WorkCompletion, PaymentRecord, PaymentMethod, PaymentStatus,
    PaymentInstallment, JobApplication, ApplicationStatus, Rating
)
from app.services.notification_service import create_notification
from app.schemas.schemas import (
    WorkerAvailabilityCreate, WorkerAvailabilityResponse, WorkerAvailabilityUpdate,
    ShiftBookingCreate, ShiftBookingResponse, ShiftBookingUpdate, ShiftBookingReschedule,
    WorkCompletionCreate, WorkCompletionResponse, WorkCompletionWithPaymentResponse,
    PaymentRecordResponse, PaymentDisputeRequest, PaymentUpdateRequest,
    PaymentInstallmentResponse, PaymentInstallmentCreate,
    WorkHistoryItemResponse, WorkHistoryListResponse
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


# ==============================================================================
# WORK COMPLETION & PAYMENT RECORDS (FEATURE 3)
# ==============================================================================

def _serialize_payment_record(p: Optional[PaymentRecord]) -> Optional[PaymentRecordResponse]:
    if not p:
        return None
    agreed = p.agreed_amount or Decimal("0.00")
    paid = p.amount_paid or Decimal("0.00")
    diff = agreed - paid
    balance = diff if diff > Decimal("0.00") else Decimal("0.00")
    is_partial = paid < agreed
    is_fully_paid = (paid >= agreed) and (p.payment_status == PaymentStatus.CONFIRMED)
    
    installments_data = []
    if hasattr(p, "installments") and p.installments:
        installments_data = [
            PaymentInstallmentResponse.model_validate(inst)
            for inst in p.installments
        ]

    return PaymentRecordResponse(
        id=p.id,
        work_completion_id=p.work_completion_id,
        shift_booking_id=p.shift_booking_id,
        agreed_amount=agreed,
        amount_paid=paid,
        outstanding_balance=balance,
        currency=p.currency,
        payment_method=p.payment_method,
        payment_status=p.payment_status,
        payment_date=p.payment_date,
        payment_reference=p.payment_reference,
        notes=p.notes,
        employer_recorded_at=p.employer_recorded_at,
        worker_confirmed_at=p.worker_confirmed_at,
        dispute_reason=p.dispute_reason,
        disputed_at=p.disputed_at,
        disputed_by=p.disputed_by,
        dispute_history=p.dispute_history or [],
        installments=installments_data,
        total_installments_count=len(installments_data) if installments_data else 1,
        is_partial=is_partial,
        is_fully_paid=is_fully_paid,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


def _serialize_completion_with_payment(
    c: WorkCompletion, p: Optional[PaymentRecord]
) -> WorkCompletionWithPaymentResponse:
    return WorkCompletionWithPaymentResponse(
        id=c.id,
        shift_booking_id=c.shift_booking_id,
        actual_start_time=c.actual_start_time,
        actual_end_time=c.actual_end_time,
        hours_worked=c.hours_worked,
        completion_notes=c.completion_notes,
        completed_by=c.completed_by,
        payment_record=_serialize_payment_record(p),
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


@router.post("/shift-bookings/{booking_id}/complete", response_model=WorkCompletionWithPaymentResponse)
async def complete_shift_and_record_payment(
    booking_id: UUID,
    payload: WorkCompletionCreate,
    employer: EmployerProfile = Depends(get_employer_profile),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Employer marks a confirmed shift as completed and records offline payment details.
    Uses row-level locking to serialize completion and prevent race conditions.
    """
    # 1. Row-level lock on ShiftBooking
    booking_res = await db.execute(
        select(ShiftBooking).where(ShiftBooking.id == booking_id).with_for_update()
    )
    booking = booking_res.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Shift booking not found")
        
    if booking.employer_id != employer.id:
        raise HTTPException(status_code=403, detail="Not authorized to complete this shift")

    if booking.status != BookingStatus.CONFIRMED:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot complete shift in {booking.status.value if hasattr(booking.status, 'value') else booking.status} state. Shift must be CONFIRMED."
        )

    # 2. Check for duplicate completion
    existing_comp = await db.execute(
        select(WorkCompletion).where(WorkCompletion.shift_booking_id == booking_id)
    )
    if existing_comp.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Shift already has a completion record")

    # 3. Guard against premature completion
    now = datetime.now(timezone.utc)
    booking_start_utc = ensure_utc(booking.start_time)
    if booking_start_utc > now:
        raise HTTPException(
            status_code=400,
            detail="Cannot complete shift: scheduled shift start time is in the future"
        )

    start_utc = ensure_utc(payload.actual_start_time)
    end_utc = ensure_utc(payload.actual_end_time)
    if end_utc <= start_utc:
        raise HTTPException(status_code=400, detail="actual_end_time must be after actual_start_time")
        
    if start_utc > now:
        raise HTTPException(status_code=400, detail="actual_start_time cannot be in the future")

    if end_utc > now:
        raise HTTPException(status_code=400, detail="actual_end_time cannot be in the future")

    # 4. Plausibility check for hours worked against elapsed duration
    if payload.hours_worked <= 0 or payload.hours_worked > 24:
        raise HTTPException(status_code=400, detail="hours_worked must be between 0 and 24")

    elapsed_seconds = (end_utc - start_utc).total_seconds()
    elapsed_hours = Decimal(str(round(elapsed_seconds / 3600.0, 4)))
    max_allowable_hours = elapsed_hours + Decimal("0.25")
    if payload.hours_worked > max_allowable_hours:
        raise HTTPException(
            status_code=400,
            detail=f"hours_worked ({payload.hours_worked}) exceeds the elapsed duration between actual_start_time and actual_end_time ({elapsed_hours:.2f} hours + 15 min buffer)"
        )

    # 5. Validate monetary amounts
    if payload.amount_paid < Decimal("0.00"):
        raise HTTPException(status_code=422, detail="Amount paid cannot be negative")

    if payload.agreed_amount is not None:
        agreed = payload.agreed_amount
    elif booking.proposed_rate is not None:
        agreed = booking.proposed_rate
    else:
        agreed = payload.amount_paid

    if agreed < Decimal("0.00"):
        raise HTTPException(status_code=422, detail="Agreed amount cannot be negative")

    # Determine initial payment status
    if payload.amount_paid < agreed:
        payment_status = PaymentStatus.PARTIALLY_PAID
    else:
        payment_status = PaymentStatus.PENDING_CONFIRMATION

    # 6. Create WorkCompletion
    completion = WorkCompletion(
        shift_booking_id=booking.id,
        actual_start_time=start_utc,
        actual_end_time=end_utc,
        hours_worked=payload.hours_worked,
        completion_notes=payload.completion_notes,
        completed_by=current_user.id,
    )
    db.add(completion)
    await db.flush()

    # 7. Create PaymentRecord
    payment_date_utc = ensure_utc(payload.payment_date)
    payment_rec = PaymentRecord(
        work_completion_id=completion.id,
        shift_booking_id=booking.id,
        agreed_amount=agreed,
        amount_paid=payload.amount_paid,
        currency="INR",
        payment_method=payload.payment_method,
        payment_status=payment_status,
        payment_date=payment_date_utc,
        payment_reference=payload.payment_reference,
        notes=payload.payment_notes,
        employer_recorded_at=now,
        dispute_history=[],
    )
    db.add(payment_rec)
    await db.flush()

    # 8. Create first PaymentInstallment if amount_paid > 0
    if payload.amount_paid > Decimal("0.00"):
        first_installment = PaymentInstallment(
            payment_record_id=payment_rec.id,
            installment_number=1,
            amount=payload.amount_paid,
            payment_method=payload.payment_method,
            payment_date=payment_date_utc,
            payment_reference=payload.payment_reference,
            notes=payload.payment_notes,
            recorded_by=current_user.id,
            worker_confirmed_at=None,
        )
        db.add(first_installment)
        await db.flush()

    # 9. Update ShiftBooking status
    booking.status = BookingStatus.COMPLETED

    # 10. Update linked JobApplication if ACCEPTED -> COMPLETED in same transaction
    if booking.application_id:
        app_res = await db.execute(
            select(JobApplication).where(JobApplication.id == booking.application_id).with_for_update()
        )
        application = app_res.scalar_one_or_none()
        if application and application.status == ApplicationStatus.ACCEPTED:
            application.status = ApplicationStatus.COMPLETED

    # 11. Notify Worker (resilient to notification errors)
    try:
        wp_res = await db.execute(select(WorkerProfile).where(WorkerProfile.id == booking.worker_id))
        wp = wp_res.scalar_one_or_none()
        if wp:
            method_str = payload.payment_method.value if hasattr(payload.payment_method, "value") else str(payload.payment_method)
            company_label = employer.organization_name or employer.full_name or "Employer"
            await create_notification(
                db=db,
                user_id=wp.user_id,
                type="SHIFT_COMPLETED_PAYMENT_RECORDED",
                title="Shift Completed & Payment Recorded",
                body=f"{company_label} recorded completion and payment of ₹{payload.amount_paid} ({method_str}) for your shift. Please review and confirm receipt.",
                reference_id=booking.id,
                reference_type="SHIFT_BOOKING"
            )
    except Exception:
        pass

    await db.commit()

    # Reload with installments for clean response serialization
    reload_res = await db.execute(
        select(PaymentRecord)
        .where(PaymentRecord.id == payment_rec.id)
        .options(selectinload(PaymentRecord.installments))
    )
    payment_rec = reload_res.scalar_one()

    return _serialize_completion_with_payment(completion, payment_rec)


@router.post("/shift-bookings/{booking_id}/payment/confirm", response_model=PaymentRecordResponse)
async def confirm_payment_received(
    booking_id: UUID,
    worker: WorkerProfile = Depends(get_worker_profile),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Worker confirms receipt of offline payment.
    - If paid in full, transitions status to CONFIRMED.
    - If partial, retains PARTIALLY_PAID status while recording confirmation timestamp.
    - Marks all pending installments as confirmed.
    """
    booking_res = await db.execute(select(ShiftBooking).where(ShiftBooking.id == booking_id))
    booking = booking_res.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Shift booking not found")
        
    if booking.worker_id != worker.id:
        raise HTTPException(status_code=403, detail="Not authorized to confirm payment for this shift")

    payment_res = await db.execute(
        select(PaymentRecord)
        .where(PaymentRecord.shift_booking_id == booking_id)
        .options(selectinload(PaymentRecord.installments))
        .with_for_update()
    )
    payment_rec = payment_res.scalar_one_or_none()
    if not payment_rec:
        raise HTTPException(status_code=404, detail="No payment record found for this shift")

    if payment_rec.payment_status == PaymentStatus.DISPUTED:
        raise HTTPException(status_code=400, detail="Cannot confirm a disputed payment record until employer updates it")

    # Idempotent if already fully confirmed
    if payment_rec.worker_confirmed_at is not None and payment_rec.payment_status == PaymentStatus.CONFIRMED:
        return _serialize_payment_record(payment_rec)

    now = datetime.now(timezone.utc)
    payment_rec.worker_confirmed_at = now
    
    # Confirm all unconfirmed installments
    for inst in (payment_rec.installments or []):
        if not inst.worker_confirmed_at:
            inst.worker_confirmed_at = now

    # If paid in full, transition to CONFIRMED. If partial, retain PARTIALLY_PAID
    if payment_rec.amount_paid >= payment_rec.agreed_amount:
        payment_rec.payment_status = PaymentStatus.CONFIRMED
    else:
        payment_rec.payment_status = PaymentStatus.PARTIALLY_PAID

    # Notify employer (resilient)
    try:
        ep_res = await db.execute(select(EmployerProfile).where(EmployerProfile.id == booking.employer_id))
        ep = ep_res.scalar_one_or_none()
        if ep:
            worker_label = worker.full_name or "Worker"
            await create_notification(
                db=db,
                user_id=ep.user_id,
                type="PAYMENT_CONFIRMED",
                title="Payment Confirmed by Worker",
                body=f"{worker_label} confirmed receipt of ₹{payment_rec.amount_paid} for shift.",
                reference_id=booking.id,
                reference_type="SHIFT_BOOKING"
            )
    except Exception:
        pass

    await db.commit()
    return _serialize_payment_record(payment_rec)


@router.post("/shift-bookings/{booking_id}/payment/dispute", response_model=PaymentRecordResponse)
async def dispute_payment_record(
    booking_id: UUID,
    payload: PaymentDisputeRequest,
    worker: WorkerProfile = Depends(get_worker_profile),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Worker disputes an offline payment record, providing a mandatory explanation.
    Cannot dispute if payment has already been confirmed in full.
    """
    booking_res = await db.execute(select(ShiftBooking).where(ShiftBooking.id == booking_id))
    booking = booking_res.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Shift booking not found")
        
    if booking.worker_id != worker.id:
        raise HTTPException(status_code=403, detail="Not authorized to dispute payment for this shift")

    payment_res = await db.execute(
        select(PaymentRecord)
        .where(PaymentRecord.shift_booking_id == booking_id)
        .options(selectinload(PaymentRecord.installments))
        .with_for_update()
    )
    payment_rec = payment_res.scalar_one_or_none()
    if not payment_rec:
        raise HTTPException(status_code=404, detail="No payment record found for this shift")

    if payment_rec.payment_status == PaymentStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="Payment has already been confirmed and cannot be disputed")

    # Record dispute
    payment_rec.payment_status = PaymentStatus.DISPUTED
    payment_rec.dispute_reason = payload.dispute_reason.strip()
    payment_rec.disputed_at = datetime.now(timezone.utc)
    payment_rec.disputed_by = current_user.id

    # Notify employer (resilient)
    try:
        ep_res = await db.execute(select(EmployerProfile).where(EmployerProfile.id == booking.employer_id))
        ep = ep_res.scalar_one_or_none()
        if ep:
            worker_label = worker.full_name or "Worker"
            await create_notification(
                db=db,
                user_id=ep.user_id,
                type="PAYMENT_DISPUTED",
                title="Payment Record Disputed",
                body=f"{worker_label} disputed the payment record for shift: '{payload.dispute_reason.strip()}'.",
                reference_id=booking.id,
                reference_type="SHIFT_BOOKING"
            )
    except Exception:
        pass

    await db.commit()
    return _serialize_payment_record(payment_rec)


@router.patch("/shift-bookings/{booking_id}/payment", response_model=PaymentRecordResponse)
async def update_payment_record(
    booking_id: UUID,
    payload: PaymentUpdateRequest,
    employer: EmployerProfile = Depends(get_employer_profile),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Employer updates payment record after dispute, corrections, or logs additional installments.
    Preserves audit and dispute history in dispute_history JSON field.
    Preserves prior confirmed installments in payment_installments ledger.
    Rejects modification if worker has already confirmed full payment.
    """
    booking_res = await db.execute(select(ShiftBooking).where(ShiftBooking.id == booking_id))
    booking = booking_res.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Shift booking not found")
        
    if booking.employer_id != employer.id:
        raise HTTPException(status_code=403, detail="Not authorized to update payment for this shift")

    payment_res = await db.execute(
        select(PaymentRecord)
        .where(PaymentRecord.shift_booking_id == booking_id)
        .options(selectinload(PaymentRecord.installments))
        .with_for_update()
    )
    payment_rec = payment_res.scalar_one_or_none()
    if not payment_rec:
        raise HTTPException(status_code=404, detail="No payment record found for this shift")

    if payment_rec.payment_status == PaymentStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="Confirmed payment records cannot be edited")

    now = datetime.now(timezone.utc)

    # 1. Archive snapshot into dispute_history if currently disputed
    if payment_rec.payment_status == PaymentStatus.DISPUTED:
        history_entry = {
            "dispute_reason": payment_rec.dispute_reason,
            "disputed_at": payment_rec.disputed_at.isoformat() if payment_rec.disputed_at else None,
            "disputed_by": str(payment_rec.disputed_by) if payment_rec.disputed_by else None,
            "previous_amount_paid": str(payment_rec.amount_paid),
            "previous_payment_method": payment_rec.payment_method.value if hasattr(payment_rec.payment_method, "value") else str(payment_rec.payment_method),
            "previous_payment_date": payment_rec.payment_date.isoformat() if payment_rec.payment_date else None,
            "previous_payment_reference": payment_rec.payment_reference,
            "previous_notes": payment_rec.notes,
            "previous_worker_confirmed_at": payment_rec.worker_confirmed_at.isoformat() if payment_rec.worker_confirmed_at else None,
            "correction_note": payload.correction_note or payload.notes,
            "corrected_at": now.isoformat(),
        }
        history_list = list(payment_rec.dispute_history or [])
        history_list.append(history_entry)
        payment_rec.dispute_history = history_list

    # 2. Determine metadata updates
    effective_method = payload.payment_method or payment_rec.payment_method
    effective_date = ensure_utc(payload.payment_date) if payload.payment_date else now
    effective_ref = payload.payment_reference if payload.payment_reference is not None else payment_rec.payment_reference
    effective_notes = payload.notes if payload.notes is not None else payment_rec.notes

    # 3. Apply installment logic
    new_installment_amount = None
    if payload.installment_amount is not None:
        if payload.installment_amount <= Decimal("0.00"):
            raise HTTPException(status_code=422, detail="installment_amount must be greater than zero")
        new_installment_amount = payload.installment_amount
        payment_rec.amount_paid = payment_rec.amount_paid + new_installment_amount
    elif payload.amount_paid is not None:
        if payload.amount_paid < Decimal("0.00"):
            raise HTTPException(status_code=422, detail="amount_paid cannot be negative")
        if payload.amount_paid > payment_rec.amount_paid:
            new_installment_amount = payload.amount_paid - payment_rec.amount_paid
            payment_rec.amount_paid = payload.amount_paid
        elif payload.amount_paid < payment_rec.amount_paid:
            # Downward correction (e.g. during dispute correction of unconfirmed installment)
            if payment_rec.installments:
                last_inst = payment_rec.installments[-1]
                if last_inst.worker_confirmed_at is not None:
                    raise HTTPException(status_code=400, detail="Cannot reduce payment amount below already confirmed installments")
                prior_sum = sum(inst.amount for inst in payment_rec.installments[:-1])
                revised_last = payload.amount_paid - prior_sum
                if revised_last <= Decimal("0.00"):
                    raise HTTPException(status_code=400, detail="Revised amount is less than or equal to confirmed prior installments")
                last_inst.amount = revised_last
                last_inst.payment_method = effective_method
                last_inst.payment_date = effective_date
                last_inst.payment_reference = effective_ref
                last_inst.notes = effective_notes
            payment_rec.amount_paid = payload.amount_paid

    # If adding a new installment
    if new_installment_amount is not None and new_installment_amount > Decimal("0.00"):
        next_num = len(payment_rec.installments) + 1
        new_inst = PaymentInstallment(
            payment_record_id=payment_rec.id,
            installment_number=next_num,
            amount=new_installment_amount,
            payment_method=effective_method,
            payment_date=effective_date,
            payment_reference=effective_ref,
            notes=effective_notes,
            recorded_by=current_user.id,
            worker_confirmed_at=None,
        )
        db.add(new_inst)
        payment_rec.installments.append(new_inst)

    # Update top-level latest metadata
    payment_rec.payment_method = effective_method
    payment_rec.payment_date = effective_date
    if payload.payment_reference is not None:
        payment_rec.payment_reference = payload.payment_reference
    if payload.notes is not None:
        payment_rec.notes = payload.notes

    # Recalculate status
    if payment_rec.amount_paid < payment_rec.agreed_amount:
        payment_rec.payment_status = PaymentStatus.PARTIALLY_PAID
    else:
        payment_rec.payment_status = PaymentStatus.PENDING_CONFIRMATION

    # Clear active dispute flags and reset worker confirmation if unconfirmed installments exist
    payment_rec.dispute_reason = None
    payment_rec.disputed_at = None
    payment_rec.disputed_by = None
    payment_rec.worker_confirmed_at = None

    # Notify worker of updated payment (resilient)
    try:
        wp_res = await db.execute(select(WorkerProfile).where(WorkerProfile.id == booking.worker_id))
        wp = wp_res.scalar_one_or_none()
        if wp:
            company_label = employer.organization_name or employer.full_name or "Employer"
            await create_notification(
                db=db,
                user_id=wp.user_id,
                type="PAYMENT_UPDATED",
                title="Payment Record Updated",
                body=f"{company_label} updated the payment record to ₹{payment_rec.amount_paid}. Please review and confirm.",
                reference_id=booking.id,
                reference_type="SHIFT_BOOKING"
            )
    except Exception:
        pass

    await db.commit()
    return _serialize_payment_record(payment_rec)


@router.get("/shift-bookings/{booking_id}/completion", response_model=WorkCompletionWithPaymentResponse)
async def get_shift_completion_record(
    booking_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Fetch completion and payment record for a shift booking.
    Authorized for booking worker, booking employer, or Admin.
    """
    q = select(ShiftBooking).where(ShiftBooking.id == booking_id).options(
        selectinload(ShiftBooking.work_completion)
        .selectinload(WorkCompletion.payment_record)
        .selectinload(PaymentRecord.installments)
    )
    res = await db.execute(q)
    booking = res.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Shift booking not found")

    # Authorization
    is_admin = current_user.role in ["ADMIN", UserRole.ADMIN]
    is_worker = False
    is_employer = False

    if not is_admin:
        if current_user.role in ["WORKER", UserRole.WORKER]:
            wp_res = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == current_user.id))
            wp = wp_res.scalar_one_or_none()
            if wp and wp.id == booking.worker_id:
                is_worker = True
        elif current_user.role in ["EMPLOYER", UserRole.EMPLOYER]:
            ep_res = await db.execute(select(EmployerProfile).where(EmployerProfile.user_id == current_user.id))
            ep = ep_res.scalar_one_or_none()
            if ep and ep.id == booking.employer_id:
                is_employer = True

        if not is_worker and not is_employer:
            raise HTTPException(status_code=403, detail="Not authorized to view completion records for this shift")

    if not booking.work_completion:
        raise HTTPException(status_code=404, detail="No completion record found for this shift")

    return _serialize_completion_with_payment(booking.work_completion, booking.work_completion.payment_record)


@router.get("/work-history/me", response_model=WorkHistoryListResponse)
async def get_my_work_history(
    page: int = 1,
    per_page: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve paginated history of completed shifts and associated payment records for the current user.
    """
    if page < 1:
        page = 1
    if per_page < 1 or per_page > 100:
        per_page = 20

    offset = (page - 1) * per_page

    is_worker = current_user.role in ["WORKER", UserRole.WORKER]
    is_employer = current_user.role in ["EMPLOYER", UserRole.EMPLOYER]

    if not is_worker and not is_employer:
        raise HTTPException(status_code=403, detail="Only workers and employers can view work history")

    if is_worker:
        wp_res = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == current_user.id))
        wp = wp_res.scalar_one_or_none()
        if not wp:
            return WorkHistoryListResponse(items=[], total=0, page=page, per_page=per_page, total_pages=0)
        filter_cond = (ShiftBooking.worker_id == wp.id)
    else:
        ep_res = await db.execute(select(EmployerProfile).where(EmployerProfile.user_id == current_user.id))
        ep = ep_res.scalar_one_or_none()
        if not ep:
            return WorkHistoryListResponse(items=[], total=0, page=page, per_page=per_page, total_pages=0)
        filter_cond = (ShiftBooking.employer_id == ep.id)

    # Base query for completed shifts
    base_cond = and_(filter_cond, ShiftBooking.status == BookingStatus.COMPLETED)

    # Count total
    count_res = await db.execute(select(func.count(ShiftBooking.id)).where(base_cond))
    total = count_res.scalar() or 0

    # Query with eager relations
    q = (
        select(ShiftBooking)
        .where(base_cond)
        .options(
            selectinload(ShiftBooking.work_completion),
            selectinload(ShiftBooking.payment_record).selectinload(PaymentRecord.installments),
            selectinload(ShiftBooking.job),
            selectinload(ShiftBooking.worker),
            selectinload(ShiftBooking.employer),
        )
        .order_by(desc(ShiftBooking.start_time))
        .offset(offset)
        .limit(per_page)
    )
    res = await db.execute(q)
    bookings = res.scalars().all()

    # Pre-fetch existing ratings for linked applications if applicable
    app_ids = [b.application_id for b in bookings if b.application_id]
    rated_app_ids = set()
    if app_ids:
        r_res = await db.execute(
            select(Rating.application_id).where(
                Rating.application_id.in_(app_ids),
                Rating.rated_by == current_user.id
            )
        )
        rated_app_ids = set(r_res.scalars().all())

    items: List[WorkHistoryItemResponse] = []
    for b in bookings:
        comp_resp = None
        if b.work_completion:
            comp_resp = WorkCompletionResponse.model_validate(b.work_completion)

        pay_resp = _serialize_payment_record(b.payment_record)

        job_title = b.job.title if b.job else None
        if is_worker:
            counterpart_name = (b.employer.organization_name or b.employer.full_name or "Employer") if b.employer else "Employer"
            counterpart_id = b.employer_id
        else:
            counterpart_name = b.worker.full_name or "Worker" if b.worker else "Worker"
            counterpart_id = b.worker_id

        can_rate = False
        if b.application_id and b.application_id not in rated_app_ids:
            can_rate = True

        items.append(
            WorkHistoryItemResponse(
                shift_booking=ShiftBookingResponse.model_validate(b),
                work_completion=comp_resp,
                payment_record=pay_resp,
                job_title=job_title,
                counterpart_name=counterpart_name,
                counterpart_id=counterpart_id,
                can_rate=can_rate,
                application_id=b.application_id,
            )
        )

    total_pages = (total + per_page - 1) // per_page if total > 0 else 0
    return WorkHistoryListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages
    )
