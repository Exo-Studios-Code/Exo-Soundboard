/**
 * WebSocket klient s automatickým znovupřipojením.
 *
 * Implementuje exponenciální backoff při výpadku spojení.
 * Emituje události přes EventTarget pattern.
 */

import type { WSMessage } from "../types";

type WSListener = (message: WSMessage) => void;
type ConnectionListener = (connected: boolean) => void;

const BASE_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const MAX_RECONNECT_ATTEMPTS = 20;

export class SoundboardWebSocket extends EventTarget {
  private _ws: WebSocket | null = null;
  private _serverUrl: string = "";
  private _token: string = "";
  private _reconnectAttempts: number = 0;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _isConnecting: boolean = false;
  private _shouldReconnect: boolean = true;
  private _listeners: Map<string, Set<WSListener>> = new Map();
  private _connectionListeners: Set<ConnectionListener> = new Set();

  // ── Public API ─────────────────────────────────────────────────────────────

  connect(serverUrl: string, token: string): void {
    this._serverUrl = serverUrl;
    this._token = token;
    this._shouldReconnect = true;
    this._reconnectAttempts = 0;
    this._doConnect();
  }

  disconnect(): void {
    this._shouldReconnect = false;
    this._clearReconnectTimer();
    if (this._ws) {
      this._ws.close(1000, "Úmyslné odpojení");
      this._ws = null;
    }
    this._notifyConnectionListeners(false);
  }

  on(event: string, listener: WSListener): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(listener);
    return () => this._listeners.get(event)?.delete(listener);
  }

  onConnectionChange(listener: ConnectionListener): () => void {
    this._connectionListeners.add(listener);
    return () => this._connectionListeners.delete(listener);
  }

  get isConnected(): boolean {
    return this._ws?.readyState === WebSocket.OPEN;
  }

  // ── Připojení ──────────────────────────────────────────────────────────────

  private _doConnect(): void {
    if (this._isConnecting || !this._shouldReconnect) return;
    if (this._ws?.readyState === WebSocket.OPEN) return;

    this._isConnecting = true;

    // Převedeme HTTP URL na WS URL
    const wsUrl = this._serverUrl
      .replace(/^http:/, "ws:")
      .replace(/^https:/, "wss:");
    const url = `${wsUrl}/api/v1/ws/connect?token=${encodeURIComponent(this._token)}`;

    console.log(`[WebSocket] Připojuji se na ${wsUrl}...`);

    try {
      this._ws = new WebSocket(url);
    } catch (err) {
      this._isConnecting = false;
      this._scheduleReconnect();
      return;
    }

    this._ws.onopen = () => {
      this._isConnecting = false;
      this._reconnectAttempts = 0;
      console.log("[WebSocket] Připojeno.");
      this._notifyConnectionListeners(true);
    };

    this._ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        this._dispatch(message);
      } catch (err) {
        console.warn("[WebSocket] Nepodařilo se parsovat zprávu:", event.data);
      }
    };

    this._ws.onerror = (event) => {
      console.error("[WebSocket] Chyba připojení.", event);
      this._isConnecting = false;
    };

    this._ws.onclose = (event) => {
      this._isConnecting = false;
      this._notifyConnectionListeners(false);

      if (event.code === 4001) {
        // Autentizační chyba – nepokoušíme se znovu
        console.error("[WebSocket] Autentizace selhala. Opětovné připojení zastaveno.");
        this._shouldReconnect = false;
        return;
      }

      if (this._shouldReconnect) {
        console.log(`[WebSocket] Odpojeno (code ${event.code}). Znovupřipojení...`);
        this._scheduleReconnect();
      }
    };
  }

  private _scheduleReconnect(): void {
    if (this._reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error("[WebSocket] Maximální počet pokusů o připojení překročen.");
      return;
    }

    const delay = Math.min(
      BASE_RECONNECT_DELAY_MS * Math.pow(2, this._reconnectAttempts),
      MAX_RECONNECT_DELAY_MS
    );

    this._reconnectAttempts++;
    console.log(
      `[WebSocket] Pokus ${this._reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} za ${delay}ms`
    );

    this._clearReconnectTimer();
    this._reconnectTimer = setTimeout(() => {
      this._doConnect();
    }, delay);
  }

  private _clearReconnectTimer(): void {
    if (this._reconnectTimer !== null) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  private _dispatch(message: WSMessage): void {
    // Odpovídáme na ping
    if (message.event === "ping") {
      this._ws?.send(JSON.stringify({ event: "pong" }));
      return;
    }

    const listeners = this._listeners.get(message.event);
    if (listeners) {
      listeners.forEach((listener) => listener(message));
    }

    // Catch-all listener
    const allListeners = this._listeners.get("*");
    if (allListeners) {
      allListeners.forEach((listener) => listener(message));
    }
  }

  private _notifyConnectionListeners(connected: boolean): void {
    this._connectionListeners.forEach((listener) => listener(connected));
  }
}

// Singleton instance
export const soundboardWS = new SoundboardWebSocket();
