"""KaamSetu - Real-Time WebSocket Connection Manager"""
from collections import defaultdict
from typing import Any, Dict, Set
from uuid import UUID
from fastapi import WebSocket


class ConnectionManager:
    """Tracks authenticated WebSocket connections per user ID and broadcasts JSON events."""

    def __init__(self) -> None:
        self._connections: Dict[str, Set[WebSocket]] = defaultdict(set)

    async def connect(self, user_id: UUID | str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[str(user_id)].add(websocket)

    def disconnect(self, user_id: UUID | str, websocket: WebSocket) -> None:
        uid = str(user_id)
        if uid in self._connections:
            self._connections[uid].discard(websocket)
            if not self._connections[uid]:
                del self._connections[uid]

    def active_count(self, user_id: UUID | str | None = None) -> int:
        if user_id is not None:
            return len(self._connections.get(str(user_id), set()))
        return sum(len(s) for s in self._connections.values())

    async def emit_to_user(self, user_id: UUID | str, event_type: str, payload: Dict[str, Any]) -> None:
        uid = str(user_id)
        sockets = list(self._connections.get(uid, set()))
        if not sockets:
            return
        message = {"event": event_type, "data": payload}
        stale: list[WebSocket] = []
        for ws in sockets:
            try:
                await ws.send_json(message)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self.disconnect(uid, ws)


ws_manager = ConnectionManager()
