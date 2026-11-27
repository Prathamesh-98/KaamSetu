"""KaamSetu - Authenticated WebSocket Real-Time Event Endpoint"""
import asyncio
import json
from uuid import UUID, uuid4
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from app.core.security import decode_access_token
from app.db.session import AsyncSessionLocal
from app.models.models import User
from app.services.ws_manager import ws_manager

router = APIRouter(tags=["WebSocket"])

AUTH_HANDSHAKE_TIMEOUT_SECONDS = 5.0
IDLE_READ_TIMEOUT_SECONDS = 75.0


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Authenticated WebSocket stream using first-frame JSON auth:
      Client sends: {"type": "auth", "token": "<JWT>"} within 5 seconds.
    JWTs are never passed in URL query strings to prevent access-log exposure.
    """
    await websocket.accept()

    try:
        raw_auth = await asyncio.wait_for(
            websocket.receive_text(),
            timeout=AUTH_HANDSHAKE_TIMEOUT_SECONDS,
        )
        auth_msg = json.loads(raw_auth)
        if not isinstance(auth_msg, dict) or auth_msg.get("type") != "auth":
            await websocket.close(code=4401)
            return
        token = str(auth_msg.get("token") or "").strip()
        if not token:
            await websocket.close(code=4401)
            return
        payload = decode_access_token(token)
        user_id = UUID(str(payload["sub"]))
    except asyncio.TimeoutError:
        try:
            await websocket.close(code=4408)
        except Exception:
            pass
        return
    except WebSocketDisconnect:
        return
    except Exception:
        try:
            await websocket.close(code=4401)
        except Exception:
            pass
        return

    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
        user = res.scalar_one_or_none()
        if not user:
            await websocket.close(code=4401)
            return

    try:
        await ws_manager.register(user_id, websocket)
    except RuntimeError:
        return

    await websocket.send_json({
        "event_id": uuid4().hex,
        "event": "connected",
        "data": {"user_id": str(user_id)},
    })

    try:
        while True:
            msg = await asyncio.wait_for(
                websocket.receive_text(),
                timeout=IDLE_READ_TIMEOUT_SECONDS,
            )
            if msg == "ping":
                await websocket.send_text("pong")
    except asyncio.TimeoutError:
        try:
            await websocket.close(code=4000)
        except Exception:
            pass
        ws_manager.disconnect(user_id, websocket)
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id, websocket)
    except Exception:
        ws_manager.disconnect(user_id, websocket)
