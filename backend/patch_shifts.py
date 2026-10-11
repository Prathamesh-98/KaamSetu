filepath = "app/api/routes/shifts.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

import re
content = content.replace(
    'from app.schemas.schemas import',
    'from app.services.notification_service import create_notification\nfrom app.schemas.schemas import'
)

# 1. Employer requests a shift
req_pattern = r'(db\.add\(booking\)\s+await db\.flush\(\)\s+await db\.refresh\(booking\))'
def req_repl(m):
    return f'''{m.group(1)}
    
    # Notify worker
    await create_notification(
        db=db,
        user_id=booking.worker.user_id,
        type="SHIFT_REQUESTED",
        title="Shift Requested",
        body=f"{{employer_profile.company_name}} requested a shift for job {{booking.job.title}}.",
        reference_id=booking.id,
        reference_type="SHIFT_BOOKING"
    )'''
content = re.sub(req_pattern, req_repl, content)

# 2. Worker accepts/declines a shift
# Actually, I should use regex for the update logic... let's just write a script to patch it safely.
with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Patched shifts.py part 1")
