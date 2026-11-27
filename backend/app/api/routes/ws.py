"""KaamSetu - Authenticated WebSocket Real-Time Event Endpoint"""
from uuid import UUID
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select
from app.core.security import decode_access_token
from app.db.session import AsyncSessionLocal
from app.models.models import User
from app.services.ws_manager import ws_manager

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="Bearer JWT access token"),
):
    """
    Authenticated WebSocket stream delivering real-time notification, chat, application,
    and shift updates to active Worker/Employer/Admin clients.
    """
    try:
        payload = decode_access_token(token)
        user_id = UUID(str(payload["sub"]))
    except Exception:
        await websocket.close(code=4401)
        return

    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
        user = res.scalar_one_or_none()
        if not user:
            await websocket.close(code=4401)
            return

    await ws_manager.connect(user_id, websocket)
    await websocket.send_json({"event": "connected", "data": {"user_id": str(user_id)}})

    try:
        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id, websocket)
    except Exception:
        ws_manager.disconnect(user_id, websocket)
