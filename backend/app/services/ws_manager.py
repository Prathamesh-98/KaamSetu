"""KaamSetu - Real-Time WebSocket Connection Manager"""
import asyncio
from collections import defaultdict, deque
from typing import Any, Deque, Dict, List, Tuple
from uuid import UUID, uuid4
from fastapi import WebSocket

MAX_CONNECTIONS_PER_USER = 5
MAX_TOTAL_CONNECTIONS = 500


class ConnectionManager:
    """Tracks authenticated WebSocket connections per user ID with bounded capacity."""

    def __init__(self) -> None:
        self._connections: Dict[str, Deque[WebSocket]] = defaultdict(deque)

    async def register(self, user_id: UUID | str, websocket: WebSocket) -> None:
        """Register an already-accepted & authenticated WebSocket with per-user cap."""
        uid = str(user_id)
        if self.active_count() >= MAX_TOTAL_CONNECTIONS:
            await websocket.close(code=4503)
            raise RuntimeError("Server WebSocket connection limit reached")

        user_sockets = self._connections[uid]
        while len(user_sockets) >= MAX_CONNECTIONS_PER_USER:
            oldest = user_sockets.popleft()
            try:
                await oldest.close(code=4000)
            except Exception:
                pass
        user_sockets.append(websocket)

    def disconnect(self, user_id: UUID | str, websocket: WebSocket) -> None:
        uid = str(user_id)
        if uid in self._connections:
            try:
                self._connections[uid].remove(websocket)
            except ValueError:
                pass
            if not self._connections[uid]:
                del self._connections[uid]

    def active_count(self, user_id: UUID | str | None = None) -> int:
        if user_id is not None:
            return len(self._connections.get(str(user_id), ()))
        return sum(len(s) for s in self._connections.values())

    async def emit_to_user(self, user_id: UUID | str, event_type: str, payload: Dict[str, Any]) -> None:
        uid = str(user_id)
        sockets = list(self._connections.get(uid, ()))
        if not sockets:
            return
        message = {
            "event_id": uuid4().hex,
            "event": event_type,
            "data": payload,
        }
        stale: list[WebSocket] = []
        for ws in sockets:
            try:
                await ws.send_json(message)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self.disconnect(uid, ws)

    async def emit_batch(self, events: List[Tuple[str, str, Dict[str, Any]]]) -> None:
        for uid, event_type, payload in events:
            await self.emit_to_user(uid, event_type, payload)


ws_manager = ConnectionManager()


def queue_ws_event(db: Any, user_id: UUID | str, event_type: str, payload: Dict[str, Any]) -> None:
    """Queue a WebSocket event to be emitted only after the SQLAlchemy session commits."""
    if db is None:
        return
    sync_sess = getattr(db, "sync_session", db)
    pending = sync_sess.info.setdefault("pending_ws_events", [])
    pending.append((str(user_id), event_type, payload))


def schedule_ws_flush(pending: List[Tuple[str, str, Dict[str, Any]]]) -> None:
    if not pending:
        return
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(ws_manager.emit_batch(pending))
    except RuntimeError:
        pass
