from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import Notification
from app.services.ws_manager import ws_manager
from uuid import UUID
from typing import Optional


async def create_notification(
    db: AsyncSession,
    user_id: UUID,
    type: str,
    title: str,
    body: str,
    reference_id: Optional[UUID] = None,
    reference_type: Optional[str] = None,
):
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        reference_id=reference_id,
        reference_type=reference_type,
    )
    db.add(notification)
    await db.flush()

    try:
        await ws_manager.emit_to_user(
            user_id,
            "notification:created",
            {
                "id": str(notification.id),
                "type": type,
                "title": title,
                "body": body,
                "reference_id": str(reference_id) if reference_id else None,
                "reference_type": reference_type,
            },
        )
    except Exception:
        pass

    return notification
