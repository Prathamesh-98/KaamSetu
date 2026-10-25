"""
KaamSetu — Verification Routes
Handles user-facing verification flows: Phone OTP, Worker Identity,
Worker Skill Certificates, Employer Company Verification, Status, and
Secure Private Document Retrieval.
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone

from app.db.session import get_db
from app.models.models import (
    User, UserRole, WorkerProfile, EmployerProfile, WorkerSkill,
    VerificationRecord, VerificationType, VerificationStatus
)
from app.schemas.schemas import (
    PhoneOTPRequest, PhoneOTPVerify, PhoneVerificationResponse,
    VerificationRecordResponse, UserVerificationStatusSummary
)
from app.api.dependencies import (
    get_current_user, require_worker, require_employer,
    get_worker_profile, get_employer_profile
)
from app.services.otp_service import OTPService, OTPPurpose, normalize_phone
from app.services.sms_service import sms_service
from app.services.private_storage_service import private_storage

router = APIRouter(prefix="/verifications", tags=["Verifications"])


def _now_utc():
    return datetime.now(timezone.utc)


# ─── Phone OTP Verification ───────────────────────────────────────────────────

@router.post("/phone/request", status_code=status.HTTP_200_OK)
async def request_phone_otp(
    payload: PhoneOTPRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Request a one-time password (OTP) to verify a phone number.
    Rate-limited: maximum 3 requests per 10 minutes.
    """
    phone = normalize_phone(payload.phone)

    # Check if this phone is already registered/verified by another user
    existing = await db.execute(
        select(User).where(and_(User.phone == phone, User.id != current_user.id))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This phone number is already registered and verified with another account.",
        )

    success, message, retry_after, code = await OTPService.request_challenge(
        purpose=OTPPurpose.WORKER_PHONE_VERIFICATION,
        destination=phone,
        user_id=str(current_user.id),
        db=db,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=message,
            headers={"Retry-After": str(retry_after or 600)},
        )

    # Deliver SMS via configured provider or mock mode
    delivered, delivery_msg = await sms_service.send_otp_sms(
        phone=phone,
        otp_code=code,
        purpose="Worker Phone Verification"
    )
    if not delivered:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=delivery_msg,
        )

    masked_phone = f"{phone[:3]}****{phone[-4:]}" if len(phone) >= 7 else phone
    return {
        "message": message,
        "masked_phone": masked_phone,
    }


@router.post("/phone/verify", response_model=PhoneVerificationResponse)
async def verify_phone_otp(
    payload: PhoneOTPVerify,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Verify the submitted OTP code. Upon successful verification,
    updates user and profile summary flags and logs an authoritative VerificationRecord.
    """
    phone = normalize_phone(payload.phone)
    code = payload.otp_code

    success, message, _ = await OTPService.verify_challenge(
        purpose=OTPPurpose.WORKER_PHONE_VERIFICATION,
        destination=phone,
        code=code,
        user_id=str(current_user.id),
        db=db,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message,
        )

    now = _now_utc()

    # Expire prior PHONE verification records if this is a phone number change
    old_phone = current_user.phone
    is_phone_changed = bool(old_phone and old_phone != phone)

    prior_recs = await db.execute(
        select(VerificationRecord).where(
            and_(
                VerificationRecord.user_id == current_user.id,
                VerificationRecord.verification_type == VerificationType.PHONE,
            )
        )
    )
    from datetime import timedelta
    for rec in prior_recs.scalars().all():
        if rec.status == VerificationStatus.VERIFIED and is_phone_changed:
            rec.expires_at = now - timedelta(seconds=1)

    # Update user phone
    current_user.phone = phone
    
    # Sync WorkerProfile if user is a worker
    if current_user.role == UserRole.WORKER:
        w_res = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == current_user.id))
        w_prof = w_res.scalar_one_or_none()
        if w_prof:
            w_prof.is_phone_verified = True
            # Keep User.is_verified strictly bound to identity verification, NOT phone verification alone
            current_user.is_verified = bool(w_prof.is_identity_verified)
    elif current_user.role == UserRole.EMPLOYER:
        e_res = await db.execute(select(EmployerProfile).where(EmployerProfile.user_id == current_user.id))
        e_prof = e_res.scalar_one_or_none()
        if e_prof:
            current_user.is_verified = bool(e_prof.is_verified)

    # Check for existing phone verification record or create new
    rec_res = await db.execute(
        select(VerificationRecord).where(
            and_(
                VerificationRecord.user_id == current_user.id,
                VerificationRecord.verification_type == VerificationType.PHONE,
            )
        ).order_by(desc(VerificationRecord.created_at))
    )
    existing_rec = rec_res.scalars().first()

    if existing_rec and existing_rec.status == VerificationStatus.PENDING:
        existing_rec.status = VerificationStatus.VERIFIED
        existing_rec.verified_at = now
        existing_rec.set_metadata(verified_phone=phone)
    else:
        new_rec = VerificationRecord(
            user_id=current_user.id,
            verification_type=VerificationType.PHONE,
            status=VerificationStatus.VERIFIED,
            verified_at=now,
        )
        new_rec.set_metadata(verified_phone=phone)
        db.add(new_rec)

    await db.flush()

    return PhoneVerificationResponse(
        message="Phone number successfully verified.",
        phone=phone,
        is_phone_verified=True,
        verified_at=now,
    )


# ─── Worker Identity Verification ─────────────────────────────────────────────

@router.post("/identity", response_model=VerificationRecordResponse, status_code=status.HTTP_201_CREATED)
async def submit_identity_verification(
    document: UploadFile = File(...),
    document_type: str = Form(..., description="e.g. DRIVING_LICENSE, VOTER_ID, PASSPORT, TRADE_LICENSE"),
    notes: Optional[str] = Form(None),
    current_user: User = Depends(require_worker),
    worker_profile: WorkerProfile = Depends(get_worker_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Worker: Submit government identity document evidence for review.
    Document is stored in private storage and record is placed in PENDING status.
    """
    file_bytes = await document.read()
    content_type = document.content_type or "application/octet-stream"

    try:
        doc_uri = private_storage.store_document(file_bytes, content_type, "identity")
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

    # Create new PENDING record (historical resubmissions are preserved)
    record = VerificationRecord(
        user_id=current_user.id,
        verification_type=VerificationType.IDENTITY,
        status=VerificationStatus.PENDING,
        document_url=doc_uri,
    )
    record.set_metadata(
        document_type=document_type.upper(),
        user_notes=notes,
        submitted_filename=document.filename,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)

    return VerificationRecordResponse.from_orm_record(record)


# ─── Worker Skill Certificate Verification ────────────────────────────────────

@router.post("/skill", response_model=VerificationRecordResponse, status_code=status.HTTP_201_CREATED)
async def submit_skill_certificate(
    document: UploadFile = File(...),
    skill_id: UUID = Form(...),
    certificate_title: str = Form(...),
    issuing_authority: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    current_user: User = Depends(require_worker),
    worker_profile: WorkerProfile = Depends(get_worker_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Worker: Submit a qualification or trade certificate for an added skill.
    """
    # Verify skill belongs to worker profile
    ws_res = await db.execute(
        select(WorkerSkill).where(
            and_(
                WorkerSkill.worker_profile_id == worker_profile.id,
                WorkerSkill.skill_id == skill_id,
            )
        )
    )
    worker_skill = ws_res.scalar_one_or_none()
    if not worker_skill:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The specified skill has not been added to your worker profile yet. Please add it first.",
        )

    file_bytes = await document.read()
    content_type = document.content_type or "application/octet-stream"

    try:
        doc_uri = private_storage.store_document(file_bytes, content_type, "skills")
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

    record = VerificationRecord(
        user_id=current_user.id,
        verification_type=VerificationType.SKILL,
        status=VerificationStatus.PENDING,
        document_url=doc_uri,
    )
    record.set_metadata(
        skill_id=str(skill_id),
        certificate_title=certificate_title,
        issuing_authority=issuing_authority,
        document_type="SKILL_CERTIFICATE",
        user_notes=notes,
        submitted_filename=document.filename,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)

    return VerificationRecordResponse.from_orm_record(record)


# ─── Employer Company Verification ────────────────────────────────────────────

@router.post("/company", response_model=VerificationRecordResponse, status_code=status.HTTP_201_CREATED)
async def submit_company_verification(
    document: UploadFile = File(...),
    organization_name: Optional[str] = Form(None),
    organization_type: Optional[str] = Form(None),
    tax_id: Optional[str] = Form(None, description="GSTIN, CIN, or Registration ID"),
    notes: Optional[str] = Form(None),
    current_user: User = Depends(require_employer),
    employer_profile: EmployerProfile = Depends(get_employer_profile),
    db: AsyncSession = Depends(get_db),
):
    """
    Employer: Submit business registration or GST certificate evidence for review.
    """
    file_bytes = await document.read()
    content_type = document.content_type or "application/octet-stream"

    try:
        doc_uri = private_storage.store_document(file_bytes, content_type, "company")
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

    # Update employer profile organization details if provided
    if organization_name and not employer_profile.organization_name:
        employer_profile.organization_name = organization_name
    if organization_type and not employer_profile.organization_type:
        employer_profile.organization_type = organization_type

    record = VerificationRecord(
        user_id=current_user.id,
        verification_type=VerificationType.PROFILE,
        status=VerificationStatus.PENDING,
        document_url=doc_uri,
    )
    record.set_metadata(
        organization_name=organization_name or employer_profile.organization_name,
        organization_type=organization_type or employer_profile.organization_type,
        tax_id=tax_id,
        document_type="COMPANY_REGISTRATION",
        user_notes=notes,
        submitted_filename=document.filename,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)

    return VerificationRecordResponse.from_orm_record(record)


# ─── Status & History ─────────────────────────────────────────────────────────

@router.get("/my-status", response_model=UserVerificationStatusSummary)
async def get_my_verification_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get the authenticated user's verification summary across all dimensions.
    Returns computed status (NOT_SUBMITTED, PENDING, VERIFIED, REJECTED, EXPIRED).
    """
    rec_res = await db.execute(
        select(VerificationRecord)
        .where(VerificationRecord.user_id == current_user.id)
        .order_by(desc(VerificationRecord.created_at))
    )
    all_records = rec_res.scalars().all()

    # Map latest record by type
    latest_by_type = {}
    for r in all_records:
        t_key = r.verification_type.value
        # For skills, key by skill_id
        if r.verification_type == VerificationType.SKILL:
            sk_id = r.metadata_dict.get("skill_id", "default")
            t_key = f"SKILL_{sk_id}"
        if t_key not in latest_by_type:
            latest_by_type[t_key] = r

    phone_rec = latest_by_type.get("PHONE")
    phone_status = phone_rec.effective_status.value if phone_rec else "NOT_SUBMITTED"

    id_rec = latest_by_type.get("IDENTITY")
    identity_status = id_rec.effective_status.value if id_rec else "NOT_SUBMITTED"

    comp_rec = latest_by_type.get("PROFILE")
    company_status = comp_rec.effective_status.value if comp_rec else ("NOT_SUBMITTED" if current_user.role == UserRole.EMPLOYER else None)

    # Worker skills summary
    skills_status = []
    if current_user.role == UserRole.WORKER:
        w_res = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == current_user.id))
        w_prof = w_res.scalar_one_or_none()
        if w_prof:
            ws_res = await db.execute(
                select(WorkerSkill).where(WorkerSkill.worker_profile_id == w_prof.id)
            )
            worker_skills = ws_res.scalars().all()
            for ws in worker_skills:
                sk_rec = latest_by_type.get(f"SKILL_{str(ws.skill_id)}")
                st = sk_rec.effective_status.value if sk_rec else "NOT_SUBMITTED"
                skills_status.append({
                    "skill_id": str(ws.skill_id),
                    "status": st,
                    "certificate_title": sk_rec.metadata_dict.get("certificate_title") if sk_rec else None,
                })

    is_phone_ver = False
    is_id_ver = False
    if current_user.role == UserRole.WORKER:
        w_res = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == current_user.id))
        wp = w_res.scalar_one_or_none()
        if wp:
            is_phone_ver = wp.is_phone_verified
            is_id_ver = wp.is_identity_verified
    else:
        is_phone_ver = (phone_status == "VERIFIED")

    return UserVerificationStatusSummary(
        phone_status=phone_status,
        identity_status=identity_status,
        company_status=company_status,
        skills_status=skills_status,
        is_verified=is_id_ver if current_user.role == UserRole.WORKER else (company_status == "VERIFIED" if current_user.role == UserRole.EMPLOYER else current_user.is_verified),
        is_phone_verified=is_phone_ver,
        is_identity_verified=is_id_ver,
        active_records=[VerificationRecordResponse.from_orm_record(r) for r in all_records[:10]],
        phone=current_user.phone,
    )


@router.get("/my-history", response_model=List[VerificationRecordResponse])
async def get_my_verification_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get complete audit history of all verification submissions for current user."""
    rec_res = await db.execute(
        select(VerificationRecord)
        .where(VerificationRecord.user_id == current_user.id)
        .order_by(desc(VerificationRecord.created_at))
    )
    records = rec_res.scalars().all()
    return [VerificationRecordResponse.from_orm_record(r) for r in records]


# ─── Secure Private Document Gateway ──────────────────────────────────────────

@router.get("/{record_id}/document")
async def get_verification_document(
    record_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Secure Document Gateway.
    Only the document owner OR an authorized ADMIN may retrieve the document bytes.
    All other requests receive HTTP 403 Forbidden.
    """
    rec_res = await db.execute(
        select(VerificationRecord).where(VerificationRecord.id == record_id)
    )
    record = rec_res.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification record not found.")

    if not record.document_url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No document attached to this verification record.")

    # Authorization guard: Owner or Admin
    if current_user.id != record.user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden. You do not have permission to view this document.",
        )

    try:
        file_bytes, content_type, filename = private_storage.retrieve_document(record.document_url)
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document file could not be found in storage.")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve document.")

    return Response(
        content=file_bytes,
        media_type=content_type,
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )
