
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
