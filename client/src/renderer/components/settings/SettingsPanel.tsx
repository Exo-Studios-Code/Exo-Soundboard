import React, { useEffect, useState } from "react";
import { X, Server, Speaker, Volume2, RefreshCw, Info, Wifi } from "lucide-react";
import { useAppStore } from "../../stores/appStore";

export function SettingsPanel() {
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const serverUrl = useAppStore((s) => s.serverUrl);
  const setServerUrl = useAppStore((s) => s.setServerUrl);
  const audioDeviceId = useAppStore((s) => s.audioDeviceId);
  const setAudioDevice = useAppStore((s) => s.setAudioDevice);
  const audioDevices = useAppStore((s) => s.audioDevices);
  const loadAudioDevices = useAppStore((s) => s.loadAudioDevices);
  const volume = useAppStore((s) => s.volume);
  const setVolume = useAppStore((s) => s.setVolume);
  const isWsConnected = useAppStore((s) => s.isWsConnected);
  const connectWebSocket = useAppStore((s) => s.connectWebSocket);
  const sounds = useAppStore((s) => s.sounds);
  const hotkeys = useAppStore((s) => s.hotkeys);

  const [localServerUrl, setLocalServerUrl] = useState(serverUrl);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    loadAudioDevices();
  }, []);

  const handleSaveServer = () => {
    setServerUrl(localServerUrl.trim());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleReconnect = () => {
    connectWebSocket();
  };

  return (
    <div className="dialog-overlay" onClick={() => setSettingsOpen(false)}>
      <div className="dialog dialog--settings" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2 className="dialog-title">Nastavení</h2>
          <button className="btn btn-ghost icon-btn" onClick={() => setSettingsOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="dialog-body settings-body">

          {/* ── Server ───────────────────────────────────────────────────── */}
          <section className="settings-section">
            <h3 className="settings-section-title">
              <Server size={15} /> Server
            </h3>

            <div className="form-group">
              <label className="form-label">URL serveru</label>
              <div className="input-row">
                <input
                  type="text"
                  className="form-input"
                  value={localServerUrl}
                  onChange={(e) => setLocalServerUrl(e.target.value)}
                  placeholder="http://localhost:8000"
                />
                <button
                  className={`btn ${isSaved ? "btn-success" : "btn-primary"}`}
                  onClick={handleSaveServer}
                >
                  {isSaved ? "✓" : "Uložit"}
                </button>
              </div>
            </div>

            <div className="settings-status">
              <div className={`ws-indicator ${isWsConnected ? "connected" : "disconnected"}`}>
                <span className="ws-dot" />
                <span>{isWsConnected ? "WebSocket připojen" : "WebSocket odpojen"}</span>
              </div>
              {!isWsConnected && (
                <button className="btn btn-ghost btn--sm" onClick={handleReconnect}>
                  <RefreshCw size={13} />
                  Připojit
                </button>
              )}
            </div>
          </section>

          {/* ── Audio zařízení ───────────────────────────────────────────── */}
          <section className="settings-section">
            <h3 className="settings-section-title">
              <Speaker size={15} /> Audio výstup
            </h3>

            <div className="form-group">
              <label className="form-label">Výstupní zařízení</label>
              <div className="input-row">
                <select
                  className="form-select"
                  value={audioDeviceId}
                  onChange={(e) => setAudioDevice(e.target.value)}
                >
                  <option value="default">Výchozí zařízení</option>
                  {audioDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <button className="btn btn-ghost" onClick={loadAudioDevices} title="Obnovit seznam">
                  <RefreshCw size={14} />
                </button>
              </div>
              <p className="form-hint-block">
                <Info size={12} />
                Pro routování do Discordu vyberte „CABLE Input" (VB-Audio Virtual Cable)
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">
                <Volume2 size={14} />
                Hlasitost: {Math.round(volume * 100)}%
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="volume-slider-full"
              />
            </div>
          </section>

          {/* ── Statistiky ───────────────────────────────────────────────── */}
          <section className="settings-section">
            <h3 className="settings-section-title">
              <Info size={15} /> Statistiky
            </h3>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-value">{sounds.length}</span>
                <span className="stat-label">Zvuků v knihovně</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{Object.keys(hotkeys).length}</span>
                <span className="stat-label">Aktivních zkratek</span>
              </div>
              <div className="stat-card">
                <span className={`stat-value ${isWsConnected ? "stat-value--green" : "stat-value--red"}`}>
                  {isWsConnected ? "Online" : "Offline"}
                </span>
                <span className="stat-label">Stav připojení</span>
              </div>
            </div>
          </section>

          {/* ── Hotkey seznam ────────────────────────────────────────────── */}
          {Object.keys(hotkeys).length > 0 && (
            <section className="settings-section">
              <h3 className="settings-section-title">Přiřazené zkratky</h3>
              <div className="hotkeys-list">
                {Object.entries(hotkeys).map(([soundId, accelerator]) => {
                  const sound = sounds.find((s) => s.id === soundId);
                  return (
                    <div key={soundId} className="hotkey-row">
                      <span className="hotkey-sound-name">
                        {sound?.name || soundId}
                      </span>
                      <kbd className="kbd">{accelerator}</kbd>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
