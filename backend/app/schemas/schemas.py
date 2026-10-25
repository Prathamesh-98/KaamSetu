"""
KaamSetu — Pydantic Schemas
Request/response schemas for all API endpoints.
"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Dict, Any, Literal
import re
from datetime import datetime, date, time
from decimal import Decimal
from uuid import UUID
from app.models.models import (
    UserRole, AvailabilityStatus, SalaryType, WorkType,
    JobStatus, ApplicationStatus, ProficiencyLevel,
    VerificationType, VerificationStatus, MessageType, RaterRole, BookingStatus,
    PaymentMethod, PaymentStatus
)


# ─── Base ─────────────────────────────────────────────────────────────────────

class TimestampMixin(BaseModel):
    created_at: datetime
    updated_at: Optional[datetime] = None


# ─── Auth ─────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)
    role: UserRole
    phone: Optional[str] = Field(None, max_length=20)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: "UserBasic"


# ─── Password Recovery Schemas ────────────────────────────────────────────────

class ForgotPasswordEmailRequest(BaseModel):
    email: EmailStr


class ForgotPasswordPhoneRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, v: str) -> str:
        cleaned = re.sub(r"[\s\-\(\)]", "", v)
        if not re.match(r"^\+?[0-9]{10,14}$", cleaned):
            raise ValueError("Invalid phone number format. Must contain 10 to 14 digits.")
        return cleaned


class VerifyRecoveryEmailRequest(BaseModel):
    email: EmailStr
    otp_code: str = Field(..., min_length=4, max_length=8)


class VerifyRecoveryPhoneRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)
    otp_code: str = Field(..., min_length=4, max_length=8)

    @field_validator("phone")
    @classmethod
    def clean_phone(cls, v: str) -> str:
        return re.sub(r"[\s\-\(\)]", "", v)


class RecoveryVerifyResponse(BaseModel):
    message: str
    reset_token: str
    expires_in: int = 900


class ResetPasswordRequest(BaseModel):
    reset_token: str = Field(..., min_length=20)
    new_password: str = Field(..., min_length=8, max_length=100)
    confirm_password: str = Field(..., min_length=8, max_length=100)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v

    @field_validator("confirm_password")
    @classmethod
    def passwords_must_match(cls, v: str, info) -> str:
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Passwords do not match")
        return v


# ─── Users ────────────────────────────────────────────────────────────────────

class UserBasic(BaseModel):
    id: UUID
    email: str
    phone: Optional[str] = None
    role: UserRole
    is_active: bool
    is_verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Skills ───────────────────────────────────────────────────────────────────

class SkillBase(BaseModel):
    name: str = Field(max_length=100)
    category: Optional[str] = Field(None, max_length=100)


class SkillCreate(SkillBase):
    pass


class SkillResponse(SkillBase):
    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkerSkillAdd(BaseModel):
    skill_id: UUID
    proficiency_level: ProficiencyLevel = ProficiencyLevel.INTERMEDIATE
    years_experience: int = Field(default=0, ge=0)


class WorkerSkillResponse(BaseModel):
    id: UUID
    skill: SkillResponse
    proficiency_level: ProficiencyLevel
    years_experience: int

    model_config = {"from_attributes": True}


# ─── Worker Profile ───────────────────────────────────────────────────────────

class WorkerProfileCreate(BaseModel):
    full_name: str = Field(max_length=150)
    bio: Optional[str] = None
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    years_experience: int = Field(default=0, ge=0)
    expected_salary: Optional[float] = None
    salary_type: Optional[SalaryType] = None
    availability_status: AvailabilityStatus = AvailabilityStatus.AVAILABLE
    preferred_work_types: Optional[List[str]] = None
    job_alerts_enabled: Optional[bool] = None


class WorkerProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=150)
    profile_image_url: Optional[str] = None
    bio: Optional[str] = None
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    years_experience: Optional[int] = Field(None, ge=0)
    expected_salary: Optional[float] = None
    salary_type: Optional[SalaryType] = None
    availability_status: Optional[AvailabilityStatus] = None
    preferred_work_types: Optional[List[str]] = None
    job_alerts_enabled: Optional[bool] = None


class WorkerProfileResponse(BaseModel):
    id: UUID
    user_id: UUID
    full_name: str
    profile_image_url: Optional[str]
    bio: Optional[str]
    city: Optional[str]
    state: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    years_experience: int
    expected_salary: Optional[float]
    salary_type: Optional[SalaryType]
    availability_status: AvailabilityStatus
    preferred_work_types: Optional[List[str]]
    is_phone_verified: bool
    is_identity_verified: bool
    average_rating: float
    total_ratings: int
    job_alerts_enabled: bool
    skills: List[WorkerSkillResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Employer Profile ─────────────────────────────────────────────────────────

class EmployerProfileCreate(BaseModel):
    full_name: str = Field(max_length=150)
    organization_name: Optional[str] = Field(None, max_length=200)
    organization_type: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = None
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    website: Optional[str] = None


class EmployerProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=150)
    organization_name: Optional[str] = Field(None, max_length=200)
    organization_type: Optional[str] = Field(None, max_length=100)
    profile_image_url: Optional[str] = None
    bio: Optional[str] = None
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    website: Optional[str] = None


class EmployerProfileResponse(BaseModel):
    id: UUID
    user_id: UUID
    full_name: str
    organization_name: Optional[str]
    organization_type: Optional[str]
    profile_image_url: Optional[str]
    bio: Optional[str]
    city: Optional[str]
    state: Optional[str]
    website: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    is_verified: bool
    average_rating: float
    total_ratings: int
    job_alerts_enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Job Category ─────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str = Field(max_length=100)
    icon: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None


class CategoryResponse(BaseModel):
    id: UUID
    name: str
    icon: Optional[str]
    description: Optional[str]
    is_active: bool

    model_config = {"from_attributes": True}


# ─── Jobs ─────────────────────────────────────────────────────────────────────

class JobCreate(BaseModel):
    title: str = Field(max_length=200)
    category_id: UUID
    description: str
    work_type: WorkType
    city: str = Field(max_length=100)
    state: str = Field(max_length=100)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address_detail: Optional[str] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    salary_type: SalaryType
    workers_needed: int = Field(default=1, ge=1)
    experience_required: int = Field(default=0, ge=0)
    is_urgent: bool = False
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    duration_days: Optional[int] = None
    additional_requirements: Optional[str] = None
    image_url: Optional[str] = None
    required_skill_ids: Optional[List[UUID]] = None


class JobUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    work_type: Optional[WorkType] = None
    status: Optional[JobStatus] = None
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address_detail: Optional[str] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    salary_type: Optional[SalaryType] = None
    workers_needed: Optional[int] = Field(None, ge=1)
    experience_required: Optional[int] = Field(None, ge=0)
    is_urgent: Optional[bool] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    duration_days: Optional[int] = None
    additional_requirements: Optional[str] = None
    image_url: Optional[str] = None
    required_skill_ids: Optional[List[UUID]] = None


class JobSkillResponse(BaseModel):
    skill: SkillResponse
    is_mandatory: bool

    model_config = {"from_attributes": True}


class JobResponse(BaseModel):
    id: UUID
    title: str
    description: str
    work_type: WorkType
    status: JobStatus
    city: str
    state: str
    latitude: Optional[float]
    longitude: Optional[float]
    address_detail: Optional[str] = None
    salary_min: Optional[float]
    salary_max: Optional[float]
    salary_type: SalaryType
    workers_needed: int
    experience_required: int
    is_urgent: bool
    start_date: Optional[date]
    end_date: Optional[date]
    duration_days: Optional[int]
    additional_requirements: Optional[str]
    image_url: Optional[str]
    views_count: int
    applications_count: int
    created_at: datetime
    updated_at: datetime
    employer: EmployerProfileResponse
    category: CategoryResponse
    required_skills: List[JobSkillResponse] = []

    model_config = {"from_attributes": True}


class JobListResponse(BaseModel):
    id: UUID
    title: str
    work_type: WorkType
    status: JobStatus
    city: str
    state: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address_detail: Optional[str] = None
    distance_km: Optional[float] = None
    estimated_travel_time: Optional[str] = None
    salary_min: Optional[float]
    salary_max: Optional[float]
    salary_type: SalaryType
    is_urgent: bool
    start_date: Optional[date]
    applications_count: int
    views_count: int = 0
    created_at: datetime
    employer: EmployerProfileResponse
    category: CategoryResponse
    required_skills: List[JobSkillResponse] = []

    model_config = {"from_attributes": True}


class SavedJobResponse(BaseModel):
    id: UUID
    saved_at: datetime
    job: JobListResponse

    model_config = {"from_attributes": True}


class SavedWorkerCreate(BaseModel):
    notes: Optional[str] = None


class SavedWorkerResponse(BaseModel):
    id: UUID
    employer_id: UUID
    worker_id: UUID
    notes: Optional[str] = None
    saved_at: datetime
    worker: WorkerProfileResponse

    model_config = {"from_attributes": True}
class PaginatedJobListResponse(BaseModel):
    items: List[JobListResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ─── Applications ─────────────────────────────────────────────────────────────

class ApplicationCreate(BaseModel):
    cover_note: Optional[str] = None


class ApplicationStatusUpdate(BaseModel):
    status: ApplicationStatus
    employer_notes: Optional[str] = None


class ApplicationResponse(BaseModel):
    id: UUID
    status: ApplicationStatus
    cover_note: Optional[str]
    employer_notes: Optional[str]
    applied_at: datetime
    updated_at: datetime
    job: JobListResponse
    worker: WorkerProfileResponse

    model_config = {"from_attributes": True}


# ─── Messages / Conversations ─────────────────────────────────────────────────

class ConversationCreate(BaseModel):
    application_id: UUID

class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)

class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: UUID
    content: str
    message_type: MessageType
    is_read: bool
    sent_at: datetime

    model_config = {"from_attributes": True}

class ConversationResponse(BaseModel):
    id: UUID
    application_id: UUID
    worker: WorkerProfileResponse
    employer: EmployerProfileResponse
    last_message_at: Optional[datetime]
    created_at: datetime
    unread_count: int = 0
    last_message: Optional[MessageResponse] = None
    application_status: ApplicationStatus

    model_config = {"from_attributes": True}

class UnreadCountResponse(BaseModel):
    unread_count: int

class PaginatedMessageResponse(BaseModel):
    items: List[MessageResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ─── Ratings ──────────────────────────────────────────────────────────────────

class RatingCreate(BaseModel):
    application_id: UUID
    rating: int = Field(ge=1, le=5)
    review_text: Optional[str] = None
    rater_role: RaterRole


class RatingResponse(BaseModel):
    id: UUID
    rating: int
    review_text: Optional[str]
    rater_role: RaterRole
    created_at: datetime
    rater: UserBasic

    model_config = {"from_attributes": True}


# ─── Notifications ────────────────────────────────────────────────────────────

class NotificationResponse(BaseModel):
    id: UUID
    type: str
    title: str
    body: str
    is_read: bool
    reference_id: Optional[UUID]
    reference_type: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Admin ────────────────────────────────────────────────────────────────────

class AdminStats(BaseModel):
    total_users: int
    total_workers: int
    total_employers: int
    active_jobs: int
    total_jobs: int
    total_applications: int
    completed_jobs: int


class PaginatedResponse(BaseModel):
    total: int
    page: int
    per_page: int
    pages: int
    items: List


# ─── Matching ─────────────────────────────────────────────────────────────────

class MatchFactors(BaseModel):
    skills: int
    location: int
    experience: int
    salary: int
    work_type: int
    availability: int
    category: int

class MatchExplanation(BaseModel):
    key: str
    args: dict

class JobMatchResponse(BaseModel):
    job_id: str
    score: int
    factors: MatchFactors
    explanations: List[MatchExplanation]



class CandidateMatchResponse(BaseModel):
    worker: WorkerProfileResponse
    match_score: int
    match_factors: MatchFactors
    match_explanations: List[MatchExplanation]
    application_status: Optional[ApplicationStatus] = None

class PaginatedCandidateMatchResponse(BaseModel):
    items: List[CandidateMatchResponse]
    total: int
    page: int
    size: int
    pages: int

# Forward reference resolution
TokenResponse.model_rebuild()


# -----------------------------------------------------------------------------
# Availability
# -----------------------------------------------------------------------------

class WorkerAvailabilityBase(BaseModel):
    start_time: datetime
    end_time: datetime
    status: AvailabilityStatus = AvailabilityStatus.AVAILABLE
    notes: Optional[str] = None

class WorkerAvailabilityCreate(WorkerAvailabilityBase):
    @field_validator('end_time')
    def end_time_must_be_after_start_time(cls, v, info):
        if 'start_time' in info.data:
            st = info.data['start_time']
            v_cmp, st_cmp = v, st
            if st_cmp.tzinfo is not None and v_cmp.tzinfo is None:
                v_cmp = v_cmp.replace(tzinfo=st_cmp.tzinfo)
            elif st_cmp.tzinfo is None and v_cmp.tzinfo is not None:
                st_cmp = st_cmp.replace(tzinfo=v_cmp.tzinfo)
            if v_cmp <= st_cmp:
                raise ValueError('end_time must be after start_time')
        return v

class WorkerAvailabilityUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[AvailabilityStatus] = None
    notes: Optional[str] = None

class WorkerAvailabilityResponse(WorkerAvailabilityBase, TimestampMixin):
    id: UUID
    worker_id: UUID

    class Config:
        from_attributes = True


# -----------------------------------------------------------------------------
# Shift Bookings
# -----------------------------------------------------------------------------

class ShiftBookingBase(BaseModel):
    job_id: Optional[UUID] = None
    application_id: Optional[UUID] = None
    start_time: datetime
    end_time: datetime
    proposed_rate: Optional[float] = None
    rate_type: Optional[SalaryType] = None
    notes: Optional[str] = None

class ShiftBookingCreate(ShiftBookingBase):
    worker_id: UUID

    @field_validator('end_time')
    def end_time_must_be_after_start_time(cls, v, info):
        if 'start_time' in info.data:
            st = info.data['start_time']
            v_cmp, st_cmp = v, st
            if st_cmp.tzinfo is not None and v_cmp.tzinfo is None:
                v_cmp = v_cmp.replace(tzinfo=st_cmp.tzinfo)
            elif st_cmp.tzinfo is None and v_cmp.tzinfo is not None:
                st_cmp = st_cmp.replace(tzinfo=v_cmp.tzinfo)
            if v_cmp <= st_cmp:
                raise ValueError('end_time must be after start_time')
        return v

class ShiftBookingUpdate(BaseModel):
    status: Optional[BookingStatus] = None
    notes: Optional[str] = None

class ShiftBookingReschedule(BaseModel):
    start_time: datetime
    end_time: datetime
    notes: Optional[str] = None

    @field_validator('end_time')
    def end_time_must_be_after_start_time(cls, v, info):
        if 'start_time' in info.data:
            st = info.data['start_time']
            v_cmp, st_cmp = v, st
            if st_cmp.tzinfo is not None and v_cmp.tzinfo is None:
                v_cmp = v_cmp.replace(tzinfo=st_cmp.tzinfo)
            elif st_cmp.tzinfo is None and v_cmp.tzinfo is not None:
                st_cmp = st_cmp.replace(tzinfo=v_cmp.tzinfo)
            if v_cmp <= st_cmp:
                raise ValueError('end_time must be after start_time')
        return v

class ShiftBookingResponse(ShiftBookingBase, TimestampMixin):
    id: UUID
    worker_id: UUID
    employer_id: UUID
    status: BookingStatus
    cancelled_by: Optional[UUID] = None

    class Config:
        from_attributes = True


# ─── Trust & Verification Schemas ──────────────────────────────────────────────

class PhoneOTPRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15, description="Mobile number with optional country code")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = re.sub(r"[\s\-\(\)]", "", v)
        if not re.match(r"^\+?[0-9]{10,14}$", cleaned):
            raise ValueError("Invalid phone number format. Must contain 10 to 14 digits.")
        return cleaned


class PhoneOTPVerify(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)
    otp_code: str = Field(..., min_length=4, max_length=8)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return re.sub(r"[\s\-\(\)]", "", v)


class PhoneVerificationResponse(BaseModel):
    message: str
    phone: str
    is_phone_verified: bool
    verified_at: Optional[datetime] = None


class VerificationRecordResponse(BaseModel):
    id: UUID
    user_id: UUID
    verification_type: str
    status: str
    document_type: Optional[str] = None
    has_document: bool
    rejection_reason: Optional[str] = None
    expires_at: Optional[datetime] = None
    verified_by: Optional[UUID] = None
    verified_at: Optional[datetime] = None
    created_at: datetime
    metadata: Optional[Dict[str, Any]] = None

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_record(cls, record: Any) -> "VerificationRecordResponse":
        eff_status = getattr(record, "effective_status", record.status)
        v_status = eff_status.value if hasattr(eff_status, "value") else str(eff_status)
        v_type = record.verification_type.value if hasattr(record.verification_type, "value") else str(record.verification_type)
        return cls(
            id=record.id,
            user_id=record.user_id,
            verification_type=v_type,
            status=v_status,
            document_type=getattr(record, "document_type", None),
            has_document=bool(record.document_url),
            rejection_reason=getattr(record, "rejection_reason", None),
            expires_at=getattr(record, "expires_at", None),
            verified_by=record.verified_by,
            verified_at=record.verified_at,
            created_at=record.created_at,
            metadata=record.metadata_dict if hasattr(record, "metadata_dict") else None,
        )


class IdentityVerificationSubmit(BaseModel):
    document_type: str = Field(..., max_length=50, description="e.g. DRIVING_LICENSE, VOTER_ID, PASSPORT, TRADE_LICENSE")
    notes: Optional[str] = Field(None, max_length=500)


class SkillVerificationSubmit(BaseModel):
    skill_id: UUID
    certificate_title: str = Field(..., max_length=150)
    issuing_authority: Optional[str] = Field(None, max_length=150)
    notes: Optional[str] = Field(None, max_length=500)


class CompanyVerificationSubmit(BaseModel):
    organization_name: Optional[str] = Field(None, max_length=200)
    organization_type: Optional[str] = Field(None, max_length=100)
    tax_id: Optional[str] = Field(None, max_length=50, description="GSTIN, CIN, or Trade Registration Number")
    notes: Optional[str] = Field(None, max_length=500)


class AdminVerificationReviewRequest(BaseModel):
    decision: Literal["APPROVE", "REJECT", "REVOKE"]
    rejection_reason: Optional[str] = Field(None, max_length=500)
    expires_at: Optional[datetime] = None
    reviewer_notes: Optional[str] = Field(None, max_length=500)

    @field_validator("rejection_reason")
    @classmethod
    def validate_rejection_reason(cls, v: Optional[str], info: Any) -> Optional[str]:
        if info.data.get("decision") == "REJECT":
            if not v or not v.strip():
                raise ValueError("rejection_reason is required and cannot be empty when rejecting a verification submission.")
        return v


class UserVerificationStatusSummary(BaseModel):
    phone_status: str
    identity_status: str
    company_status: Optional[str] = None
    skills_status: List[Dict[str, Any]] = []
    is_verified: bool
    is_phone_verified: bool
    is_identity_verified: bool
    active_records: List[VerificationRecordResponse] = []
    phone: Optional[str] = None


# ─── Work Completion & Payment Schemas ──────────────────────────────────────────

class WorkCompletionCreate(BaseModel):
    actual_start_time: datetime
    actual_end_time: datetime
    hours_worked: Decimal = Field(..., gt=0, le=24)
    completion_notes: Optional[str] = Field(None, max_length=1000)
    agreed_amount: Optional[Decimal] = Field(None, ge=0)
    amount_paid: Decimal = Field(..., ge=0)
    payment_method: PaymentMethod
    payment_date: datetime
    payment_reference: Optional[str] = Field(None, max_length=100)
    payment_notes: Optional[str] = Field(None, max_length=1000)

    @field_validator('actual_end_time')
    def end_time_must_be_after_start_time(cls, v, info):
        if 'actual_start_time' in info.data:
            st = info.data['actual_start_time']
            v_cmp, st_cmp = v, st
            if st_cmp.tzinfo is not None and v_cmp.tzinfo is None:
                v_cmp = v_cmp.replace(tzinfo=st_cmp.tzinfo)
            elif st_cmp.tzinfo is None and v_cmp.tzinfo is not None:
                st_cmp = st_cmp.replace(tzinfo=v_cmp.tzinfo)
            if v_cmp <= st_cmp:
                raise ValueError('actual_end_time must be after actual_start_time')
        return v


class PaymentInstallmentCreate(BaseModel):
    amount: Decimal = Field(..., gt=0, description="Amount of this payment installment")
    payment_method: PaymentMethod
    payment_date: datetime
    payment_reference: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)


class PaymentInstallmentResponse(BaseModel):
    id: UUID
    payment_record_id: UUID
    installment_number: int
    amount: Decimal
    payment_method: PaymentMethod
    payment_date: datetime
    payment_reference: Optional[str] = None
    notes: Optional[str] = None
    recorded_by: UUID
    worker_confirmed_at: Optional[datetime] = None
    is_confirmed: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class PaymentRecordResponse(BaseModel):
    id: UUID
    work_completion_id: UUID
    shift_booking_id: UUID
    agreed_amount: Decimal
    amount_paid: Decimal
    outstanding_balance: Decimal
    currency: str = "INR"
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    payment_date: datetime
    payment_reference: Optional[str] = None
    notes: Optional[str] = None
    employer_recorded_at: datetime
    worker_confirmed_at: Optional[datetime] = None
    dispute_reason: Optional[str] = None
    disputed_at: Optional[datetime] = None
    disputed_by: Optional[UUID] = None
    dispute_history: Optional[List[Dict[str, Any]]] = []
    installments: List[PaymentInstallmentResponse] = []
    total_installments_count: int = 1
    is_partial: bool = False
    is_fully_paid: bool = False
    disclaimer: str = "KaamSetu is an informational record of offline settlement. KaamSetu does not process, hold, or transfer funds."
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkCompletionResponse(BaseModel):
    id: UUID
    shift_booking_id: UUID
    actual_start_time: datetime
    actual_end_time: datetime
    hours_worked: Decimal
    completion_notes: Optional[str] = None
    completed_by: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkCompletionWithPaymentResponse(BaseModel):
    id: UUID
    shift_booking_id: UUID
    actual_start_time: datetime
    actual_end_time: datetime
    hours_worked: Decimal
    completion_notes: Optional[str] = None
    completed_by: UUID
    payment_record: Optional[PaymentRecordResponse] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaymentDisputeRequest(BaseModel):
    dispute_reason: str = Field(..., min_length=5, max_length=1000)

    @field_validator("dispute_reason")
    @classmethod
    def validate_dispute_reason(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 5:
            raise ValueError("Dispute reason must be at least 5 characters long.")
        return cleaned


class PaymentUpdateRequest(BaseModel):
    amount_paid: Optional[Decimal] = Field(None, ge=0, description="Cumulative total amount paid")
    installment_amount: Optional[Decimal] = Field(None, gt=0, description="Additional installment amount")
    payment_method: Optional[PaymentMethod] = None
    payment_date: Optional[datetime] = None
    payment_reference: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)
    correction_note: Optional[str] = Field(None, max_length=500)


class WorkHistoryItemResponse(BaseModel):
    shift_booking: ShiftBookingResponse
    work_completion: Optional[WorkCompletionResponse] = None
    payment_record: Optional[PaymentRecordResponse] = None
    job_title: Optional[str] = None
    counterpart_name: Optional[str] = None
    counterpart_id: Optional[UUID] = None
    can_rate: bool = False
    application_id: Optional[UUID] = None

    model_config = {"from_attributes": True}


class WorkHistoryListResponse(BaseModel):
    items: List[WorkHistoryItemResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


# ─── Admin Profile & Account Management (Phase 2) ──────────────────────────────

class AdminProfileResponse(BaseModel):
    id: UUID
    user_id: UUID
    email: EmailStr
    role: UserRole
    full_name: str
    phone: Optional[str] = None
    department: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AdminProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=150)
    phone: Optional[str] = Field(None, max_length=20)
    department: Optional[str] = Field(None, max_length=100)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if len(v) < 2:
                raise ValueError("Full name must be at least 2 characters long")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if v and not re.match(r"^[\+0-9\s\-\(\)]+$", v):
                raise ValueError("Phone number contains invalid characters")
        return v


class AdminChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=100)
    new_password: str = Field(..., min_length=8, max_length=100)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class AdminChangePasswordResponse(BaseModel):
    message: str = "Password changed successfully"


# ─── Admin Dashboard Management Schemas (Phase 3.3) ──────────────────────────

class AdminUserResponse(BaseModel):
    id: UUID
    email: str
    phone: Optional[str] = None
    role: UserRole
    is_active: bool
    is_verified: bool
    full_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AdminUserListResponse(BaseModel):
    items: List[AdminUserResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


class AdminWorkerListItem(BaseModel):
    id: UUID
    user_id: UUID
    full_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    bio: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    experience_years: Optional[int] = None
    hourly_rate: Optional[float] = None
    daily_rate: Optional[float] = None
    is_verified: bool
    is_identity_verified: bool
    is_phone_verified: bool
    is_active: bool
    skills: List[str] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminWorkerListResponse(BaseModel):
    items: List[AdminWorkerListItem]
    total: int
    page: int
    per_page: int
    total_pages: int


class AdminEmployerListItem(BaseModel):
    id: UUID
    user_id: UUID
    full_name: str
    organization_name: Optional[str] = None
    organization_type: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    is_verified: bool
    is_active: bool
    active_jobs_count: int = 0
    total_jobs_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminEmployerListResponse(BaseModel):
    items: List[AdminEmployerListItem]
    total: int
    page: int
    per_page: int
    total_pages: int


class AdminJobListItem(BaseModel):
    id: UUID
    employer_id: UUID
    employer_name: Optional[str] = None
    organization_name: Optional[str] = None
    title: str
    category_name: Optional[str] = None
    work_type: WorkType
    status: JobStatus
    city: Optional[str] = None
    state: Optional[str] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    salary_type: SalaryType
    applications_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminJobListResponse(BaseModel):
    items: List[AdminJobListItem]
    total: int
    page: int
    per_page: int
    total_pages: int


class AdminJobStatusUpdate(BaseModel):
    status: JobStatus
    reason: Optional[str] = None


class AdminApplicationListItem(BaseModel):
    id: UUID
    job_id: UUID
    job_title: str
    employer_name: Optional[str] = None
    worker_id: UUID
    worker_name: str
    worker_email: Optional[str] = None
    worker_phone: Optional[str] = None
    status: ApplicationStatus
    proposed_rate: Optional[float] = None
    cover_letter: Optional[str] = None
    applied_at: datetime

    model_config = {"from_attributes": True}


class AdminApplicationListResponse(BaseModel):
    items: List[AdminApplicationListItem]
    total: int
    page: int
    per_page: int
    total_pages: int


class AdminPaymentInstallmentItem(BaseModel):
    id: UUID
    installment_number: int
    amount: float
    payment_method: PaymentMethod
    payment_date: datetime
    payment_reference: Optional[str] = None
    notes: Optional[str] = None
    is_confirmed: bool
    worker_confirmed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AdminCompletedWorkItem(BaseModel):
    completion_id: UUID
    booking_id: UUID
    job_title: Optional[str] = None
    worker_name: str
    employer_name: str
    actual_start_time: datetime
    actual_end_time: datetime
    hours_worked: float
    completion_notes: Optional[str] = None
    agreed_amount: float
    amount_paid: float
    outstanding_balance: float
    payment_status: PaymentStatus
    dispute_reason: Optional[str] = None
    disputed_at: Optional[datetime] = None
    installments: List[AdminPaymentInstallmentItem] = []
    completed_at: datetime

    model_config = {"from_attributes": True}


class AdminCompletedWorkListResponse(BaseModel):
    items: List[AdminCompletedWorkItem]
    total: int
    page: int
    per_page: int
    total_pages: int
