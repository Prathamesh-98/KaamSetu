"""KaamSetu - Authenticated WebSocket Real-Time Event Endpoint"""
import asyncio
import json
import time
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
        token_exp = payload.get("exp")
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
        token_ver = payload.get("token_version")
        if token_ver is None:
            token_ver = payload.get("ver")
        user_ver = getattr(user, "token_version", 1) or 1
        effective_token_ver = 1 if token_ver is None else token_ver
        if effective_token_ver != user_ver:
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
            read_timeout = IDLE_READ_TIMEOUT_SECONDS
            if token_exp is not None:
                remaining = float(token_exp) - time.time()
                if remaining <= 0:
                    try:
                        await websocket.close(code=4401)
                    except Exception:
                        pass
                    ws_manager.disconnect(user_id, websocket)
                    return
                read_timeout = min(read_timeout, max(0.05, remaining))

            msg = await asyncio.wait_for(
                websocket.receive_text(),
                timeout=read_timeout,
            )
            if msg == "ping":
                await websocket.send_text("pong")
                continue
            try:
                ctrl = json.loads(msg)
            except Exception:
                ctrl = None
            if isinstance(ctrl, dict) and ctrl.get("type") == "ping":
                await websocket.send_json({"event": "pong", "data": {}})
    except asyncio.TimeoutError:
        expired = token_exp is not None and time.time() >= float(token_exp)
        close_code = 4401 if expired else 4000
        try:
            await websocket.close(code=close_code)
        except Exception:
            pass
        ws_manager.disconnect(user_id, websocket)
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id, websocket)
    except Exception:
        ws_manager.disconnect(user_id, websocket)
