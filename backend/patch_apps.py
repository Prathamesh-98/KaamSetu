filepath = "app/api/routes/applications.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

import re

# Insert import
content = content.replace(
    'from app.schemas.schemas import',
    'from app.services.notification_service import create_notification\nfrom app.schemas.schemas import'
)

# 1. Apply to a job (Worker applies -> Notify Employer)
apply_pattern = r'(db\.add\(application\)\s+await db\.flush\(\)\s+await db\.refresh\(application\))'
def apply_repl(m):
    return f'''{m.group(1)}
    
    # Notify employer
    await create_notification(
        db=db,
        user_id=job.employer.user_id,
        type="NEW_APPLICATION",
        title="New Job Application",
        body=f"{{worker_profile.full_name}} has applied for {{job.title}}.",
        reference_id=application.id,
        reference_type="JOB_APPLICATION"
    )'''

content = re.sub(apply_pattern, apply_repl, content)

# 2. Update status (Employer updates -> Notify Worker)
update_pattern = r'(application\.status = payload\.status\s+await db\.flush\(\)\s+await db\.refresh\(application\))'
def update_repl(m):
    return f'''{m.group(1)}
    
    # Notify worker
    await create_notification(
        db=db,
        user_id=application.worker.user_id,
        type="APPLICATION_STATUS_UPDATE",
        title="Application Status Updated",
        body=f"Your application for {{application.job.title}} is now {{payload.status.value}}.",
        reference_id=application.id,
        reference_type="JOB_APPLICATION"
    )'''

content = re.sub(update_pattern, update_repl, content)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Patched applications.py")
