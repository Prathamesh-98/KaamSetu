filepath = "app/api/routes/shifts.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

import re

helper = """
async def _notify_booking_counterpart(db, booking, user_role, action):
    if user_role == "WORKER":
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
"""

content = content.replace("from app.api.dependencies import get_current_user", helper + "\nfrom app.api.dependencies import get_current_user")

def patch_action(content, method_name, action, role):
    pattern = rf'(async def {method_name}\(.*?:.*?)(\s+return booking)'
    def repl(m):
        return f'{m.group(1)}\n    await _notify_booking_counterpart(db, booking, "{role}", "{action}"){m.group(2)}'
    return re.sub(pattern, repl, content, flags=re.DOTALL)

content = patch_action(content, "accept_shift", "Accepted", "WORKER")
content = patch_action(content, "decline_shift", "Declined", "WORKER")

cancel_pattern = r'(async def cancel_shift\(.*?:.*?)(    return booking)'
def cancel_repl(m):
    return f'{m.group(1)}    await _notify_booking_counterpart(db, booking, current_user.role.value, "Cancelled")\n{m.group(2)}'
content = re.sub(cancel_pattern, cancel_repl, content, flags=re.DOTALL)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Patched shift actions")
