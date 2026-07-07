"""
WebSocket endpoint pro real-time notifikace.

Autentizace probíhá přes query parametr `token` (JWT),
protože browser WebSocket API nepodporuje custom hlavičky.
"""
import asyncio

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.security import decode_access_token
from app.core.logging import get_logger
from app.services.websocket_manager import ws_manager

router = APIRouter(prefix="/ws", tags=["websocket"])
logger = get_logger(__name__)

PING_INTERVAL_SECONDS = 30  # Heartbeat interval


@router.websocket("/connect")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token"),
) -> None:
    """
    Hlavní WebSocket endpoint.

    Protokol:
    - Klient se připojí s ?token=<JWT>
    - Server odešle zprávu `connected` s user info
    - Server broadcastuje `sound_added`, `sound_deleted`, `sound_updated`
    - Každých 30s server odesílá `ping`, klient odpovídá `pong`
    - Při odpojení se automaticky odstraní ze seznamu připojených
    """
    # ── Auth ──────────────────────────────────────────────────────────────────
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Neplatný nebo expirovaný token.")
        logger.warning("ws_auth_failed", client=websocket.client)
        return

    user_id: str = payload["sub"]

    # ── Připojení ─────────────────────────────────────────────────────────────
    await ws_manager.connect(websocket, user_id)

    # Potvrzení připojení
    await ws_manager.send_to_user(user_id, "connected", {
        "user_id": user_id,
        "message": "Připojeno k CloudSoundboard.",
        "active_connections": ws_manager.connection_count,
    })

    # ── Heartbeat task ────────────────────────────────────────────────────────
    async def heartbeat() -> None:
        while True:
            await asyncio.sleep(PING_INTERVAL_SECONDS)
            try:
                await ws_manager.send_to_user(user_id, "ping", {})
            except Exception:
                break

    heartbeat_task = asyncio.create_task(heartbeat())

    # ── Příjem zpráv ──────────────────────────────────────────────────────────
    try:
        while True:
            raw = await websocket.receive_text()

            # Zpracujeme pong zprávy od klienta (ignorujeme ostatní)
            # V budoucnu zde lze přidat více typů zpráv (chat, akce atd.)
            if '"pong"' in raw or "pong" in raw:
                pass  # Heartbeat potvrzení – nic neděláme

    except WebSocketDisconnect as exc:
        logger.info("ws_client_disconnected_cleanly", user_id=user_id, code=exc.code)
    except Exception as exc:
        logger.error("ws_unexpected_error", user_id=user_id, error=str(exc))
    finally:
        heartbeat_task.cancel()
        await ws_manager.disconnect(websocket, user_id)
