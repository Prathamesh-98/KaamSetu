import re

content = ""
with open("backend/app/models/models.py", "r", encoding="utf-8") as f:
    content = f.read()

# Add BookingStatus to Enums
if "BookingStatus" not in content:
    enum_def = '''class BookingStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    DECLINED = "DECLINED"
    RESCHEDULE_REQUESTED = "RESCHEDULE_REQUESTED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"

'''
    # Find position to insert
    pos = content.find("class ApplicationStatus")
    content = content[:pos] + enum_def + content[pos:]


# Add models WorkerAvailability and ShiftBooking at the end
if "WorkerAvailability" not in content:
    models_def = '''
class WorkerAvailability(Base):
    __tablename__ = "worker_availability"

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

'''
    content += models_def
    
    # Add relationships to WorkerProfile
    content = content.replace(
        'conversations = relationship("Conversation", back_populates="worker", foreign_keys="Conversation.worker_id")',
        'conversations = relationship("Conversation", back_populates="worker", foreign_keys="Conversation.worker_id")\n    availabilities = relationship("WorkerAvailability", back_populates="worker", cascade="all, delete-orphan")\n    shift_bookings = relationship("ShiftBooking", back_populates="worker", cascade="all, delete-orphan")'
    )
    
    # Add relationships to EmployerProfile
    content = content.replace(
        'conversations = relationship("Conversation", back_populates="employer", foreign_keys="Conversation.employer_id")',
        'conversations = relationship("Conversation", back_populates="employer", foreign_keys="Conversation.employer_id")\n    shift_bookings = relationship("ShiftBooking", back_populates="employer", cascade="all, delete-orphan")'
    )
    
    # Add relationships to Job
    content = content.replace(
        'saved_by = relationship("SavedJob", back_populates="job", cascade="all, delete-orphan")',
        'saved_by = relationship("SavedJob", back_populates="job", cascade="all, delete-orphan")\n    shift_bookings = relationship("ShiftBooking", back_populates="job", cascade="all, delete-orphan")'
    )

    # Add relationships to JobApplication
    content = content.replace(
        'conversation = relationship("Conversation", back_populates="application", uselist=False, cascade="all, delete-orphan")',
        'conversation = relationship("Conversation", back_populates="application", uselist=False, cascade="all, delete-orphan")\n    shift_booking = relationship("ShiftBooking", back_populates="application", uselist=False, cascade="all, delete-orphan")'
    )

with open("backend/app/models/models.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Models appended.")
