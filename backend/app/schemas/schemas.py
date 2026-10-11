"""
KaamSetu — Pydantic Schemas
Request/response schemas for all API endpoints.
"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import datetime, date, time
from uuid import UUID
from app.models.models import (
    UserRole, AvailabilityStatus, SalaryType, WorkType,
    JobStatus, ApplicationStatus, ProficiencyLevel,
    VerificationType, VerificationStatus, MessageType, RaterRole, BookingStatus
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


# ─── Users ────────────────────────────────────────────────────────────────────

class UserBasic(BaseModel):
    id: UUID
    email: str
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

