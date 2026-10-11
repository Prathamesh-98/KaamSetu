import os

service_code = '''
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import Notification
from uuid import UUID
from typing import Optional

async def create_notification(
    db: AsyncSession,
    user_id: UUID,
    type: str,
    title: str,
    body: str,
    reference_id: Optional[UUID] = None,
    reference_type: Optional[str] = None
):
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        reference_id=reference_id,
        reference_type=reference_type
    )
    db.add(notification)
    await db.flush()
    return notification
'''

with open("app/services/notification_service.py", "w", encoding="utf-8") as f:
    f.write(service_code)

filepath = "app/api/routes/notifications.py"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

count_endpoint = '''
from sqlalchemy import func

@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(func.count()).select_from(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    )
    return {"count": result.scalar_one()}

@router.get("",
'''

content = content.replace('@router.get("",', count_endpoint)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Created notification_service and added unread-count endpoint")
