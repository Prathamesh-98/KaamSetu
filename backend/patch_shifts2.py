filepath = "app/api/routes/shifts.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

import re

# Insert notification import
if "from app.services.notification_service import create_notification" not in content:
    content = content.replace(
        'from app.schemas.schemas import',
        'from app.services.notification_service import create_notification\nfrom app.schemas.schemas import'
    )

new_request_shift = '''async def request_shift(
    data: ShiftBookingCreate,
    employer: EmployerProfile = Depends(get_employer_profile),
    db: AsyncSession = Depends(get_db)
):
    worker_check = await db.execute(select(WorkerProfile).where(WorkerProfile.id == data.worker_id))
    worker = worker_check.scalar_one_or_none()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
        
    booking = ShiftBooking(**data.model_dump(), employer_id=employer.id)
    db.add(booking)
    await db.flush()
    
    await create_notification(
        db=db,
        user_id=worker.user_id,
        type="SHIFT_REQUESTED",
        title="Shift Requested",
        body=f"{employer.company_name or 'An employer'} requested a shift.",
        reference_id=booking.id,
        reference_type="SHIFT_BOOKING"
    )
    
    return booking'''

content = re.sub(r'async def request_shift\(.*?:.*?return booking', new_request_shift, content, flags=re.DOTALL)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Patched shifts.py part 2")
