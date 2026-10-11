content = ""
with open("backend/app/schemas/schemas.py", "r", encoding="utf-8") as f:
    content = f.read()

# Add BookingStatus import
content = content.replace(
    "VerificationType, VerificationStatus, MessageType, RaterRole",
    "VerificationType, VerificationStatus, MessageType, RaterRole, BookingStatus"
)

new_schemas = '''

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
        if 'start_time' in info.data and v <= info.data['start_time']:
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
        if 'start_time' in info.data and v <= info.data['start_time']:
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
        if 'start_time' in info.data and v <= info.data['start_time']:
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

'''
if "WorkerAvailabilityCreate" not in content:
    with open("backend/app/schemas/schemas.py", "w", encoding="utf-8") as f:
        f.write(content + new_schemas)
    print("Schemas appended")
else:
    print("Schemas already exist")
