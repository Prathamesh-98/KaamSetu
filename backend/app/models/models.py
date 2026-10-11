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
    UniqueConstraint, ARRAY, CheckConstraint, Index
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


class MessageType(str, enum.Enum):
    TEXT = "TEXT"
    IMAGE = "IMAGE"
    FILE = "FILE"


class RaterRole(str, enum.Enum):
    WORKER = "WORKER"
    EMPLOYER = "EMPLOYER"


# ─── Models ───────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now_utc, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False)

    # Relationships
    worker_profile = relationship("WorkerProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    employer_profile = relationship("EmployerProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    sent_messages = relationship("Message", back_populates="sender", foreign_keys="Message.sender_id")
    ratings_given = relationship("Rating", back_populates="rater", foreign_keys="Rating.rated_by")
    ratings_received = relationship("Rating", back_populates="rated_user_obj", foreign_keys="Rating.rated_user")
    verification_records = relationship("VerificationRecord", back_populates="user", foreign_keys="VerificationRecord.user_id")


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

