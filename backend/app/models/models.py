"""
KaamSetu — SQLAlchemy Models
All ORM models for the database. Each model maps to a table.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    Column, String, Boolean, Integer, Float, Text, Enum as SAEnum,
    ForeignKey, DateTime, Date, Time, Numeric, SmallInteger,
    UniqueConstraint, ARRAY, CheckConstraint, Index, JSON
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.db.session import Base


def now_utc():
    return datetime.now(timezone.utc)


# ─── Enums ────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    WORKER = "WORKER"
    EMPLOYER = "EMPLOYER"
    ADMIN = "ADMIN"


class AvailabilityStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    BUSY = "BUSY"
    UNAVAILABLE = "UNAVAILABLE"


class SalaryType(str, enum.Enum):
    HOURLY = "HOURLY"
    DAILY = "DAILY"
    MONTHLY = "MONTHLY"
    PROJECT = "PROJECT"
    FIXED = "FIXED"


class WorkType(str, enum.Enum):
    FULL_TIME = "FULL_TIME"
    PART_TIME = "PART_TIME"
    DAILY = "DAILY"
    HOURLY = "HOURLY"
    PROJECT = "PROJECT"
    TEMPORARY = "TEMPORARY"
    REMOTE = "REMOTE"
    LOCAL = "LOCAL"


class JobStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class BookingStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    DECLINED = "DECLINED"
    RESCHEDULE_REQUESTED = "RESCHEDULE_REQUESTED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"

class ApplicationStatus(str, enum.Enum):
    PENDING = "PENDING"
    SHORTLISTED = "SHORTLISTED"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    WITHDRAWN = "WITHDRAWN"
    COMPLETED = "COMPLETED"


class ProficiencyLevel(str, enum.Enum):
    BEGINNER = "BEGINNER"
    INTERMEDIATE = "INTERMEDIATE"
    EXPERT = "EXPERT"


class VerificationType(str, enum.Enum):
    PHONE = "PHONE"
    IDENTITY = "IDENTITY"
    SKILL = "SKILL"
    PROFILE = "PROFILE"


class VerificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"


class MessageType(str, enum.Enum):
    TEXT = "TEXT"
    IMAGE = "IMAGE"
    FILE = "FILE"


class RaterRole(str, enum.Enum):
    WORKER = "WORKER"
    EMPLOYER = "EMPLOYER"


class PaymentMethod(str, enum.Enum):
    CASH = "CASH"
    UPI = "UPI"
    BANK_TRANSFER = "BANK_TRANSFER"
    OTHER = "OTHER"


class PaymentStatus(str, enum.Enum):
    PENDING_CONFIRMATION = "PENDING_CONFIRMATION"
    CONFIRMED = "CONFIRMED"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    DISPUTED = "DISPUTED"


# ─── Models ───────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), nullable=False)
    token_version = Column(Integer, default=1, server_default="1", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    # Relationships
    worker_profile = relationship("WorkerProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    employer_profile = relationship("EmployerProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    admin_profile = relationship("AdminProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    sent_messages = relationship("Message", back_populates="sender", foreign_keys="Message.sender_id")
    ratings_given = relationship("Rating", back_populates="rater", foreign_keys="Rating.rated_by")
    ratings_received = relationship("Rating", back_populates="rated_user_obj", foreign_keys="Rating.rated_user")
    verification_records = relationship("VerificationRecord", back_populates="user", foreign_keys="VerificationRecord.user_id")
    otp_challenges = relationship("OTPChallenge", back_populates="user", cascade="all, delete-orphan")
    password_reset_authorizations = relationship("PasswordResetAuthorization", back_populates="user", cascade="all, delete-orphan")


class WorkerProfile(Base):
    __tablename__ = "worker_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    full_name = Column(String(150), nullable=False)
    profile_image_url = Column(Text, nullable=True)
    bio = Column(Text, nullable=True)
    city = Column(String(100), nullable=True, index=True)
    state = Column(String(100), nullable=True, index=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    years_experience = Column(Integer, default=0, nullable=False)
    expected_salary = Column(Numeric(10, 2), nullable=True)
    salary_type = Column(SAEnum(SalaryType), nullable=True)
    availability_status = Column(SAEnum(AvailabilityStatus), default=AvailabilityStatus.AVAILABLE, nullable=False)
    preferred_work_types = Column(ARRAY(String), nullable=True)
    is_phone_verified = Column(Boolean, default=False, nullable=False)
    is_identity_verified = Column(Boolean, default=False, nullable=False)
    average_rating = Column(Float, default=0.0, nullable=False)
    total_ratings = Column(Integer, default=0, nullable=False)
    job_alerts_enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    # Relationships
    user = relationship("User", back_populates="worker_profile")
    skills = relationship("WorkerSkill", back_populates="worker_profile", cascade="all, delete-orphan")
    applications = relationship("JobApplication", back_populates="worker", cascade="all, delete-orphan")
    saved_jobs = relationship("SavedJob", back_populates="worker", cascade="all, delete-orphan")
    saved_by_employers = relationship("SavedWorker", back_populates="worker", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="worker", foreign_keys="Conversation.worker_id")
    availabilities = relationship("WorkerAvailability", back_populates="worker", cascade="all, delete-orphan")
    shift_bookings = relationship("ShiftBooking", back_populates="worker", cascade="all, delete-orphan")


class EmployerProfile(Base):
    __tablename__ = "employer_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    full_name = Column(String(150), nullable=False)
    organization_name = Column(String(200), nullable=True)
    organization_type = Column(String(100), nullable=True)
    profile_image_url = Column(Text, nullable=True)
    bio = Column(Text, nullable=True)
    city = Column(String(100), nullable=True, index=True)
    state = Column(String(100), nullable=True, index=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    website = Column(Text, nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    average_rating = Column(Float, default=0.0, nullable=False)
    total_ratings = Column(Integer, default=0, nullable=False)
    job_alerts_enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    # Relationships
    user = relationship("User", back_populates="employer_profile")
    jobs = relationship("Job", back_populates="employer", cascade="all, delete-orphan")
    saved_workers = relationship("SavedWorker", back_populates="employer", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="employer", foreign_keys="Conversation.employer_id")
    shift_bookings = relationship("ShiftBooking", back_populates="employer", cascade="all, delete-orphan")


class AdminProfile(Base):
    __tablename__ = "admin_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    full_name = Column(String(150), nullable=False)
    phone = Column(String(20), nullable=True)
    department = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    # Relationships
    user = relationship("User", back_populates="admin_profile")


class Skill(Base):
    __tablename__ = "skills"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False, index=True)
    category = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    # Relationships
    worker_skills = relationship("WorkerSkill", back_populates="skill")
    job_skills = relationship("JobRequiredSkill", back_populates="skill")


class WorkerSkill(Base):
    __tablename__ = "worker_skills"
    __table_args__ = (UniqueConstraint("worker_profile_id", "skill_id", name="uq_worker_skill"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_profile_id = Column(UUID(as_uuid=True), ForeignKey("worker_profiles.id", ondelete="CASCADE"), nullable=False)
    skill_id = Column(UUID(as_uuid=True), ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    proficiency_level = Column(SAEnum(ProficiencyLevel), default=ProficiencyLevel.INTERMEDIATE, nullable=False)
    years_experience = Column(Integer, default=0, nullable=False)

    # Relationships
    worker_profile = relationship("WorkerProfile", back_populates="skills")
    skill = relationship("Skill", back_populates="worker_skills")


class JobCategory(Base):
    __tablename__ = "job_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)
    icon = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    # Relationships
    jobs = relationship("Job", back_populates="category")


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        Index("ix_jobs_coordinates", "latitude", "longitude"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employer_id = Column(UUID(as_uuid=True), ForeignKey("employer_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("job_categories.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    work_type = Column(SAEnum(WorkType), nullable=False)
    status = Column(SAEnum(JobStatus), default=JobStatus.ACTIVE, nullable=False, index=True)

    # Location
    city = Column(String(100), nullable=False, index=True)
    state = Column(String(100), nullable=False, index=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    address_detail = Column(Text, nullable=True)

    # Compensation
    salary_min = Column(Numeric(10, 2), nullable=True)
    salary_max = Column(Numeric(10, 2), nullable=True)
    salary_type = Column(SAEnum(SalaryType), nullable=False)

    # Requirements
    workers_needed = Column(Integer, default=1, nullable=False)
    experience_required = Column(Integer, default=0, nullable=False)
    is_urgent = Column(Boolean, default=False, nullable=False)

    # Schedule
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    duration_days = Column(Integer, nullable=True)

    # Media
    image_url = Column(Text, nullable=True)
    additional_requirements = Column(Text, nullable=True)

    # Stats
    views_count = Column(Integer, default=0, nullable=False)
    applications_count = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    # Relationships
    employer = relationship("EmployerProfile", back_populates="jobs")
    category = relationship("JobCategory", back_populates="jobs")
    required_skills = relationship("JobRequiredSkill", back_populates="job", cascade="all, delete-orphan")
    applications = relationship("JobApplication", back_populates="job", cascade="all, delete-orphan")
    saved_by = relationship("SavedJob", back_populates="job", cascade="all, delete-orphan")
    shift_bookings = relationship("ShiftBooking", back_populates="job", cascade="all, delete-orphan")


class JobRequiredSkill(Base):
    __tablename__ = "job_required_skills"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    skill_id = Column(UUID(as_uuid=True), ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    is_mandatory = Column(Boolean, default=True, nullable=False)

    # Relationships
    job = relationship("Job", back_populates="required_skills")
    skill = relationship("Skill", back_populates="job_skills")


class JobApplication(Base):
    __tablename__ = "job_applications"
    __table_args__ = (UniqueConstraint("job_id", "worker_id", name="uq_job_application"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    worker_id = Column(UUID(as_uuid=True), ForeignKey("worker_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(SAEnum(ApplicationStatus), default=ApplicationStatus.PENDING, nullable=False, index=True)
    cover_note = Column(Text, nullable=True)
    employer_notes = Column(Text, nullable=True)
    applied_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    # Relationships
    job = relationship("Job", back_populates="applications")
    worker = relationship("WorkerProfile", back_populates="applications")
    rating = relationship("Rating", back_populates="application", uselist=False)
    conversation = relationship("Conversation", back_populates="application", uselist=False, cascade="all, delete-orphan")
    shift_booking = relationship("ShiftBooking", back_populates="application", uselist=False, cascade="all, delete-orphan")


class SavedJob(Base):
    __tablename__ = "saved_jobs"
    __table_args__ = (UniqueConstraint("worker_id", "job_id", name="uq_saved_job"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id = Column(UUID(as_uuid=True), ForeignKey("worker_profiles.id", ondelete="CASCADE"), nullable=False)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    saved_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    # Relationships
    worker = relationship("WorkerProfile", back_populates="saved_jobs")
    job = relationship("Job", back_populates="saved_by")


class SavedWorker(Base):
    __tablename__ = "saved_workers"
    __table_args__ = (
        UniqueConstraint("employer_id", "worker_id", name="uq_employer_saved_worker"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employer_id = Column(UUID(as_uuid=True), ForeignKey("employer_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    worker_id = Column(UUID(as_uuid=True), ForeignKey("worker_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    notes = Column(Text, nullable=True)
    saved_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    # Relationships
    employer = relationship("EmployerProfile", back_populates="saved_workers")
    worker = relationship("WorkerProfile", back_populates="saved_by_employers")


class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = (UniqueConstraint("application_id", name="uq_conversation_application"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id = Column(UUID(as_uuid=True), ForeignKey("job_applications.id", ondelete="CASCADE"), nullable=False, index=True)
    worker_id = Column(UUID(as_uuid=True), ForeignKey("worker_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    employer_id = Column(UUID(as_uuid=True), ForeignKey("employer_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    last_message_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    # Relationships
    application = relationship("JobApplication", back_populates="conversation")
    worker = relationship("WorkerProfile", back_populates="conversations", foreign_keys=[worker_id])
    employer = relationship("EmployerProfile", back_populates="conversations", foreign_keys=[employer_id])
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.sent_at")


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    message_type = Column(SAEnum(MessageType), default=MessageType.TEXT, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    sent_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", back_populates="sent_messages", foreign_keys=[sender_id])


class Rating(Base):
    __tablename__ = "ratings"
    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="chk_rating_range"),
        UniqueConstraint("application_id", "rated_by", name="uq_application_rater"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id = Column(UUID(as_uuid=True), ForeignKey("job_applications.id", ondelete="CASCADE"), nullable=False)
    rated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    rated_user = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    rating = Column(SmallInteger, nullable=False)
    review_text = Column(Text, nullable=True)
    rater_role = Column(SAEnum(RaterRole), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    # Relationships
    application = relationship("JobApplication", back_populates="rating")
    rater = relationship("User", back_populates="ratings_given", foreign_keys=[rated_by])
    rated_user_obj = relationship("User", back_populates="ratings_received", foreign_keys=[rated_user])


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    reference_id = Column(UUID(as_uuid=True), nullable=True)
    reference_type = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    # Relationships
    user = relationship("User", back_populates="notifications")


class VerificationRecord(Base):
    __tablename__ = "verification_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    verification_type = Column(SAEnum(VerificationType), nullable=False)
    status = Column(SAEnum(VerificationStatus), default=VerificationStatus.PENDING, nullable=False)
    document_url = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    verified_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    # Relationships
    user = relationship("User", back_populates="verification_records", foreign_keys=[user_id])
    verifier = relationship("User", foreign_keys=[verified_by])

    @property
    def metadata_dict(self) -> dict:
        """Parse structured metadata and rejection reasons stored in notes."""
        if not self.notes:
            return {}
        try:
            import json
            data = json.loads(self.notes)
            if isinstance(data, dict):
                return data
        except Exception:
            pass
        return {"notes_text": self.notes}

    def set_metadata(self, **kwargs):
        """Update structured metadata payload in notes."""
        import json
        current = self.metadata_dict
        current.update({k: v for k, v in kwargs.items() if v is not None})
        self.notes = json.dumps(current, default=str)

    @property
    def rejection_reason(self) -> Optional[str]:
        md = self.metadata_dict
        if "rejection_reason" in md:
            return md["rejection_reason"]
        if self.status == VerificationStatus.REJECTED and self.notes and not self.notes.startswith("{"):
            return self.notes
        return None

    @rejection_reason.setter
    def rejection_reason(self, value: Optional[str]):
        if value:
            self.set_metadata(rejection_reason=value)

    @property
    def document_type(self) -> Optional[str]:
        return self.metadata_dict.get("document_type")

    @document_type.setter
    def document_type(self, value: Optional[str]):
        if value:
            self.set_metadata(document_type=value)

    @property
    def expires_at(self) -> Optional[datetime]:
        exp = self.metadata_dict.get("expires_at")
        if exp:
            try:
                from datetime import datetime
                return datetime.fromisoformat(exp)
            except Exception:
                return None
        return None

    @expires_at.setter
    def expires_at(self, value: Optional[datetime]):
        if value:
            self.set_metadata(expires_at=value.isoformat())

    @property
    def is_expired(self) -> bool:
        exp = self.expires_at
        if exp is not None:
            return now_utc() > exp
        return False

    @property
    def effective_status(self) -> VerificationStatus:
        if self.status == VerificationStatus.VERIFIED and self.is_expired:
            return VerificationStatus.EXPIRED
        return self.status

class WorkerAvailability(Base):
    __tablename__ = "worker_availability"
    __table_args__ = (
        Index("ix_worker_availability_worker_start", "worker_id", "start_time"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id = Column(UUID(as_uuid=True), ForeignKey("worker_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(SAEnum(AvailabilityStatus), default=AvailabilityStatus.AVAILABLE, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    worker = relationship("WorkerProfile", back_populates="availabilities")


class ShiftBooking(Base):
    __tablename__ = "shift_bookings"
    __table_args__ = (
        CheckConstraint("start_time < end_time", name="chk_booking_times"),
        Index("ix_shift_bookings_worker_start", "worker_id", "start_time"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id = Column(UUID(as_uuid=True), ForeignKey("worker_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    employer_id = Column(UUID(as_uuid=True), ForeignKey("employer_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True, index=True)
    application_id = Column(UUID(as_uuid=True), ForeignKey("job_applications.id", ondelete="SET NULL"), nullable=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    proposed_rate = Column(Numeric(10, 2), nullable=True)
    rate_type = Column(SAEnum(SalaryType), nullable=True)
    status = Column(SAEnum(BookingStatus), default=BookingStatus.PENDING, nullable=False, index=True)
    notes = Column(Text, nullable=True)
    cancelled_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    worker = relationship("WorkerProfile", back_populates="shift_bookings")
    employer = relationship("EmployerProfile", back_populates="shift_bookings")
    job = relationship("Job", back_populates="shift_bookings")
    application = relationship("JobApplication", back_populates="shift_booking")
    canceller = relationship("User", foreign_keys=[cancelled_by])
    work_completion = relationship("WorkCompletion", back_populates="shift_booking", uselist=False, cascade="all, delete-orphan")
    payment_record = relationship("PaymentRecord", back_populates="shift_booking", uselist=False, cascade="all, delete-orphan")


class WorkCompletion(Base):
    __tablename__ = "work_completions"
    __table_args__ = (
        CheckConstraint("actual_start_time < actual_end_time", name="chk_completion_times"),
        CheckConstraint("hours_worked > 0 AND hours_worked <= 24", name="chk_completion_hours"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shift_booking_id = Column(UUID(as_uuid=True), ForeignKey("shift_bookings.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    actual_start_time = Column(DateTime(timezone=True), nullable=False)
    actual_end_time = Column(DateTime(timezone=True), nullable=False)
    hours_worked = Column(Numeric(5, 2), nullable=False)
    completion_notes = Column(Text, nullable=True)
    completed_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    shift_booking = relationship("ShiftBooking", back_populates="work_completion")
    payment_record = relationship("PaymentRecord", back_populates="work_completion", uselist=False, cascade="all, delete-orphan")
    completer = relationship("User", foreign_keys=[completed_by])


class PaymentRecord(Base):
    __tablename__ = "payment_records"
    __table_args__ = (
        CheckConstraint("agreed_amount >= 0", name="chk_payment_agreed_amount_non_negative"),
        CheckConstraint("amount_paid >= 0", name="chk_payment_amount_paid_non_negative"),
        CheckConstraint("currency = 'INR'", name="chk_payment_currency_inr"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    work_completion_id = Column(UUID(as_uuid=True), ForeignKey("work_completions.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    shift_booking_id = Column(UUID(as_uuid=True), ForeignKey("shift_bookings.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    agreed_amount = Column(Numeric(10, 2), nullable=False)
    amount_paid = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), default="INR", nullable=False)
    payment_method = Column(SAEnum(PaymentMethod, name="paymentmethod"), nullable=False)
    payment_status = Column(SAEnum(PaymentStatus, name="paymentstatus"), default=PaymentStatus.PENDING_CONFIRMATION, nullable=False, index=True)
    payment_date = Column(DateTime(timezone=True), nullable=False)
    payment_reference = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    employer_recorded_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    worker_confirmed_at = Column(DateTime(timezone=True), nullable=True)
    dispute_reason = Column(Text, nullable=True)
    disputed_at = Column(DateTime(timezone=True), nullable=True)
    disputed_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    dispute_history = Column(JSON, default=list, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    work_completion = relationship("WorkCompletion", back_populates="payment_record")
    shift_booking = relationship("ShiftBooking", back_populates="payment_record")
    disputer = relationship("User", foreign_keys=[disputed_by])
    installments = relationship("PaymentInstallment", back_populates="payment_record", cascade="all, delete-orphan", order_by="PaymentInstallment.installment_number")

    @property
    def outstanding_balance(self):
        agreed = self.agreed_amount or 0
        paid = self.amount_paid or 0
        diff = agreed - paid
        return diff if diff > 0 else 0




class PaymentInstallment(Base):
    __tablename__ = "payment_installments"
    __table_args__ = (
        CheckConstraint("amount > 0", name="chk_installment_amount_positive"),
        Index("ix_payment_installments_payment_record", "payment_record_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payment_record_id = Column(UUID(as_uuid=True), ForeignKey("payment_records.id", ondelete="CASCADE"), nullable=False, index=True)
    installment_number = Column(Integer, default=1, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    payment_method = Column(SAEnum(PaymentMethod, name="paymentmethod"), nullable=False)
    payment_date = Column(DateTime(timezone=True), nullable=False)
    payment_reference = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    recorded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    worker_confirmed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    payment_record = relationship("PaymentRecord", back_populates="installments")
    recorder = relationship("User", foreign_keys=[recorded_by])

    @property
    def is_confirmed(self) -> bool:
        return self.worker_confirmed_at is not None


# ─── Persistent OTP Challenges & Reset Authorizations ────────────────────────

class OTPChallenge(Base):
    __tablename__ = "otp_challenges"
    __table_args__ = (
        Index("ix_otp_challenges_lookup", "purpose", "destination", "is_consumed"),
        Index("ix_otp_challenges_user_lookup", "user_id", "purpose", "is_consumed"),
        Index("ix_otp_challenges_created_at", "created_at"),
        Index("ix_otp_challenges_expires_at", "expires_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purpose = Column(String(50), nullable=False)
    destination = Column(String(255), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    code_hash = Column(String(128), nullable=False)
    salt = Column(String(64), nullable=False)
    attempts_left = Column(Integer, default=5, nullable=False)
    max_attempts = Column(Integer, default=5, nullable=False)
    is_consumed = Column(Boolean, default=False, nullable=False)
    consumed_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    user = relationship("User", back_populates="otp_challenges")


class PasswordResetAuthorization(Base):
    __tablename__ = "password_reset_authorizations"
    __table_args__ = (
        Index("ix_pwd_reset_auth_lookup", "token_hash", "is_consumed"),
        Index("ix_pwd_reset_auth_user", "user_id", "is_consumed"),
        Index("ix_pwd_reset_auth_expires_at", "expires_at"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(128), unique=True, nullable=False)
    purpose = Column(String(50), nullable=False)
    is_consumed = Column(Boolean, default=False, nullable=False)
    consumed_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)

    user = relationship("User", back_populates="password_reset_authorizations")
