"""
WebSocket Connection Manager – správa všech aktivních připojení klientů.
Thread-safe pomocí asyncio.Lock, broadcast je fire-and-forget (neblokuje).
"""
import asyncio
import json
from datetime import datetime
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

from app.core.logging import get_logger

logger = get_logger(__name__)


class ConnectionManager:
    """
    Spravuje životní cyklus WebSocket připojení a broadcastuje zprávy.

    Každý klient je identifikován svým user_id. Jeden uživatel může mít
    více aktivních připojení (např. otevřeno ve více oknech).
    """

    def __init__(self) -> None:
        # { user_id: [WebSocket, ...] }
        self._connections: dict[str, list[WebSocket]] = {}
        self._lock = asyncio.Lock()

    # ── Životní cyklus připojení ──────────────────────────────────────────────

    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        async with self._lock:
            if user_id not in self._connections:
                self._connections[user_id] = []
            self._connections[user_id].append(websocket)
        logger.info(
            "ws_client_connected",
            user_id=user_id,
            total_connections=self.connection_count,
        )

    async def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        async with self._lock:
            if user_id in self._connections:
                try:
                    self._connections[user_id].remove(websocket)
                except ValueError:
                    pass
                if not self._connections[user_id]:
                    del self._connections[user_id]
        logger.info(
            "ws_client_disconnected",
            user_id=user_id,
            total_connections=self.connection_count,
        )

    # ── Odesílání zpráv ───────────────────────────────────────────────────────

    async def send_to_user(self, user_id: str, event: str, data: dict | None = None) -> None:
        """Odešle zprávu konkrétnímu uživateli (na všechna jeho připojení)."""
        message = self._build_message(event, data)
        async with self._lock:
            sockets = list(self._connections.get(user_id, []))

        dead: list[WebSocket] = []
        for ws in sockets:
            try:
                await ws.send_text(message)
            except Exception as exc:
                logger.warning("ws_send_failed", user_id=user_id, error=str(exc))
                dead.append(ws)

        if dead:
            await self._remove_dead_connections(user_id, dead)

    async def broadcast(self, event: str, data: dict | None = None) -> None:
        """
        Odešle zprávu VŠEM připojeným klientům.
        Mrtvá připojení jsou tiše odstraněna.
        """
        message = self._build_message(event, data)

        async with self._lock:
            all_sockets: list[tuple[str, WebSocket]] = [
                (uid, ws)
                for uid, sockets in self._connections.items()
                for ws in sockets
            ]

        dead: list[tuple[str, WebSocket]] = []
        tasks = [self._safe_send(ws, message, uid, dead) for uid, ws in all_sockets]
        await asyncio.gather(*tasks)

        if dead:
            for uid, ws in dead:
                await self._remove_dead_connections(uid, [ws])

        logger.debug(
            "ws_broadcast",
            ws_event=event,
            recipients=len(all_sockets),
            dead=len(dead),
        )

    async def broadcast_except(
        self, exclude_user_id: str, event: str, data: dict | None = None
    ) -> None:
        """Broadcast kromě jednoho uživatele (např. uploader nemusí být notifikován znovu)."""
        message = self._build_message(event, data)

        async with self._lock:
            all_sockets: list[tuple[str, WebSocket]] = [
                (uid, ws)
                for uid, sockets in self._connections.items()
                if uid != exclude_user_id
                for ws in sockets
            ]

        dead: list[tuple[str, WebSocket]] = []
        tasks = [self._safe_send(ws, message, uid, dead) for uid, ws in all_sockets]
        await asyncio.gather(*tasks)

        if dead:
            for uid, ws in dead:
                await self._remove_dead_connections(uid, [ws])

    # ── Heartbeat ─────────────────────────────────────────────────────────────

    async def ping_all(self) -> None:
        """Odešle ping všem klientům – detekuje mrtvá připojení."""
        await self.broadcast("ping", {"ts": datetime.utcnow().isoformat()})

    # ── Pomocné metody ────────────────────────────────────────────────────────

    @staticmethod
    def _build_message(event: str, data: dict | None) -> str:
        return json.dumps({
            "event": event,
            "data": data or {},
            "timestamp": datetime.utcnow().isoformat(),
        })

    async def _safe_send(
        self,
        ws: WebSocket,
        message: str,
        user_id: str,
        dead: list[tuple[str, WebSocket]],
    ) -> None:
        try:
            await ws.send_text(message)
        except Exception:
            dead.append((user_id, ws))

    async def _remove_dead_connections(
        self, user_id: str, dead: list[WebSocket]
    ) -> None:
        async with self._lock:
            if user_id in self._connections:
                for ws in dead:
                    try:
                        self._connections[user_id].remove(ws)
                    except ValueError:
                        pass
                if not self._connections[user_id]:
                    del self._connections[user_id]

    @property
    def connection_count(self) -> int:
        return sum(len(v) for v in self._connections.values())

    @property
    def connected_users(self) -> list[str]:
        return list(self._connections.keys())


# Singleton instance sdílená přes celou aplikaci
ws_manager = ConnectionManager()
