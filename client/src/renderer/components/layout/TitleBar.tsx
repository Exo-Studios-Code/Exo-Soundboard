import React from "react";
import { Minus, Square, X, Radio } from "lucide-react";
import { useAppStore } from "../../stores/appStore";

export function TitleBar() {
  const isWsConnected = useAppStore((s) => s.isWsConnected);

  return (
    <div className="titlebar">
      <div className="titlebar-left">
        <div className="titlebar-logo">
          <Radio size={14} />
        </div>
        <span className="titlebar-title">CloudSoundboard</span>
        <div className={`ws-indicator ${isWsConnected ? "connected" : "disconnected"}`}>
          <span className="ws-dot" />
          <span className="ws-label">{isWsConnected ? "Live" : "Offline"}</span>
        </div>
      </div>

      <div className="titlebar-controls" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <button
          className="titlebar-btn minimize"
          onClick={() => window.electron?.window.minimize()}
          aria-label="Minimalizovat"
        >
          <Minus size={12} />
        </button>
        <button
          className="titlebar-btn maximize"
          onClick={() => window.electron?.window.maximize()}
          aria-label="Maximalizovat"
        >
          <Square size={12} />
        </button>
        <button
          className="titlebar-btn close"
          onClick={() => window.electron?.window.close()}
          aria-label="Zavřít"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
