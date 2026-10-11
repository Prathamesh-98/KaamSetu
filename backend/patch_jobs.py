filepath = "app/api/routes/jobs.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

import re

if "from app.services.notification_service import create_notification" not in content:
    content = content.replace(
        'from app.services.matching_service import MatchingService',
        'from app.services.matching_service import MatchingService\nfrom app.services.notification_service import create_notification'
    )

create_pattern = r'(db\.add\(JobRequiredSkill\(job_id=job\.id, skill_id=skill_id\)\)\s+await db\.flush\(\))'
def create_repl(m):
    return f'''{m.group(1)}
    
    # Smart Job Alerts (using index on city to avoid full table scan)
    if job.city:
        workers_res = await db.execute(
            select(WorkerProfile).where(
                WorkerProfile.city == job.city,
                WorkerProfile.job_alerts_enabled == True
            ).options(
                selectinload(WorkerProfile.skills).selectinload(WorkerSkill.skill)
            )
        )
        for w in workers_res.scalars().all():
            match = MatchingService.calculate_match(w, job)
            if match["score"] >= 30.0:  # Threshold for alerts
                await create_notification(
                    db=db,
                    user_id=w.user_id,
                    type="NEW_MATCHING_JOB",
                    title="New Job Alert",
                    body=f"A new job '{{job.title}}' matches your profile.",
                    reference_id=job.id,
                    reference_type="JOB"
                )
'''
content = re.sub(create_pattern, create_repl, content)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Patched jobs.py")
