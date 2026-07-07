/**
 * SetupWizard.tsx
 * 
 * Zobrazí se při PRVNÍM spuštění aplikace (nebo pokud VB-Cable není detekován).
 * Provede uživatele nastavením: server URL → VB-Cable → audio výstup.
 * 
 * Umístění: src/renderer/components/layout/SetupWizard.tsx
 */

import React, { useState, useEffect } from "react";
import { Radio, Server, Speaker, ExternalLink, Check, ChevronRight, AlertTriangle } from "lucide-react";
import { useAppStore } from "../../stores/appStore";

type Step = "welcome" | "server" | "vbcable" | "audio" | "done";

interface SetupWizardProps {
  onComplete: () => void;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<Step>("welcome");
  const [serverInput, setServerInput] = useState("http://localhost:8000");
  const [serverStatus, setServerStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [serverError, setServerError] = useState("");

  const setServerUrl = useAppStore((s) => s.setServerUrl);
  const loadAudioDevices = useAppStore((s) => s.loadAudioDevices);
  const audioDevices = useAppStore((s) => s.audioDevices);
  const setAudioDevice = useAppStore((s) => s.setAudioDevice);
  const audioDeviceId = useAppStore((s) => s.audioDeviceId);

  // Detekujeme VB-Cable v seznamu zařízení
  const vbCableDevice = audioDevices.find(
    (d) => d.label.toLowerCase().includes("cable input") || d.label.toLowerCase().includes("vb-audio")
  );

  useEffect(() => {
    if (step === "audio") {
      loadAudioDevices();
    }
  }, [step]);

  const checkServer = async () => {
    setServerStatus("checking");
    setServerError("");
    try {
      const cleanUrl = serverInput.replace(/\/$/, "");
      const res = await fetch(`${cleanUrl}/health`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        setServerStatus("ok");
        setServerUrl(cleanUrl);
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      setServerStatus("error");
      setServerError("Server nedosažitelný. Zkontroluj URL a zda server běží.");
    }
  };

  const handleComplete = () => {
    // Uložíme příznak, že setup byl dokončen
    window.electron?.store.set("setupCompleted" as any, true);
    onComplete();
  };

  const steps: { id: Step; label: string }[] = [
    { id: "welcome", label: "Vítej" },
    { id: "server", label: "Server" },
    { id: "vbcable", label: "VB-Cable" },
    { id: "audio", label: "Audio" },
    { id: "done", label: "Hotovo" },
  ];

  const currentStepIdx = steps.findIndex((s) => s.id === step);

  return (
    <div className="setup-wizard-overlay">
      <div className="setup-wizard">
        {/* Header */}
        <div className="setup-header">
          <div className="setup-logo">
            <Radio size={24} />
          </div>
          <h1>CloudSoundboard</h1>
          <p>Nastavení aplikace</p>
        </div>

        {/* Progress */}
        <div className="setup-progress">
          {steps.map((s, i) => (
            <div
              key={s.id}
              className={`setup-step-dot ${i < currentStepIdx ? "done" : i === currentStepIdx ? "active" : ""}`}
            >
              {i < currentStepIdx ? <Check size={10} /> : i + 1}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="setup-content">

          {/* ── STEP: Welcome ─────────────────────────────────────────────── */}
          {step === "welcome" && (
            <div className="setup-step">
              <h2>Vítej v CloudSoundboard!</h2>
              <p>Provedeme tě základním nastavením za pár kroků.</p>
              <div className="setup-checklist">
                <div className="setup-check-item">
                  <Server size={16} /> Připojení k serveru
                </div>
                <div className="setup-check-item">
                  <Speaker size={16} /> VB-Audio Virtual Cable (pro Discord)
                </div>
                <div className="setup-check-item">
                  <Check size={16} /> Výběr audio výstupu
                </div>
              </div>
              <button className="btn btn-primary btn--full" onClick={() => setStep("server")}>
                Začít <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* ── STEP: Server ──────────────────────────────────────────────── */}
          {step === "server" && (
            <div className="setup-step">
              <Server size={32} className="setup-icon" />
              <h2>Adresa serveru</h2>
              <p>Zadej IP adresu nebo URL počítače / Raspberry Pi kde běží backend.</p>
              <div className="form-group">
                <input
                  type="text"
                  className="form-input"
                  value={serverInput}
                  onChange={(e) => { setServerInput(e.target.value); setServerStatus("idle"); }}
                  placeholder="http://192.168.1.100:8000"
                />
              </div>
              {serverStatus === "ok" && (
                <div className="form-status form-status--success">
                  <Check size={14} /> Server dostupný!
                </div>
              )}
              {serverStatus === "error" && (
                <div className="form-status form-status--error">
                  <AlertTriangle size={14} /> {serverError}
                </div>
              )}
              <div className="setup-actions">
                <button className="btn btn-ghost" onClick={() => setStep("welcome")}>Zpět</button>
                {serverStatus === "ok" ? (
                  <button className="btn btn-primary" onClick={() => setStep("vbcable")}>
                    Pokračovat <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={checkServer}
                    disabled={serverStatus === "checking"}
                  >
                    {serverStatus === "checking" ? "Testuji..." : "Otestovat připojení"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── STEP: VB-Cable ────────────────────────────────────────────── */}
          {step === "vbcable" && (
            <div className="setup-step">
              <Speaker size={32} className="setup-icon" />
              <h2>VB-Audio Virtual Cable</h2>
              <p>
                Pro přehrávání zvuků jako mikrofon v Discordu potřebuješ
                nainstalovat <strong>VB-Audio Virtual Cable</strong> (zdarma).
              </p>

              <div className="vbcable-info">
                <div className="vbcable-step">
                  <span className="vbcable-num">1</span>
                  <div>
                    <strong>Stáhni a nainstaluj VB-Cable</strong>
                    <p>Klikni na odkaz níže, stáhni installer a spusť ho jako administrátor.</p>
                    <a
                      className="btn btn-primary"
                      onClick={() => window.electron && (window as any).electron.shell?.openExternal("https://vb-audio.com/Cable/index.htm")}
                      href="https://vb-audio.com/Cable/index.htm"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={14} /> Stáhnout VB-Cable (zdarma)
                    </a>
                  </div>
                </div>
                <div className="vbcable-step">
                  <span className="vbcable-num">2</span>
                  <div>
                    <strong>Nastav Discord</strong>
                    <p>V Discordu → Nastavení → Hlas a video → Vstupní zařízení: <code>CABLE Output</code></p>
                  </div>
                </div>
                <div className="vbcable-step">
                  <span className="vbcable-num">3</span>
                  <div>
                    <strong>Nastav CloudSoundboard</strong>
                    <p>V nastavení aplikace vyber jako audio výstup: <code>CABLE Input</code></p>
                  </div>
                </div>
              </div>

              <div className="setup-actions">
                <button className="btn btn-ghost" onClick={() => setStep("server")}>Zpět</button>
                <button className="btn btn-primary" onClick={() => setStep("audio")}>
                  Mám nainstalováno <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: Audio výstup ────────────────────────────────────────── */}
          {step === "audio" && (
            <div className="setup-step">
              <Speaker size={32} className="setup-icon" />
              <h2>Audio výstup</h2>

              {vbCableDevice ? (
                <div className="form-status form-status--success" style={{ marginBottom: 12 }}>
                  <Check size={14} /> VB-Cable detekován!
                </div>
              ) : (
                <div className="form-status form-status--error" style={{ marginBottom: 12 }}>
                  <AlertTriangle size={14} /> VB-Cable nebyl nalezen. Nainstaluj ho a restartuj aplikaci.
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Výstupní zařízení pro soundboard</label>
                <select
                  className="form-select"
                  value={audioDeviceId}
                  onChange={(e) => setAudioDevice(e.target.value)}
                >
                  <option value="default">Výchozí zařízení (sluchátka)</option>
                  {audioDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Pro Discord routing vyber <strong>CABLE Input (VB-Audio Virtual Cable)</strong>.
                Zvuky půjdou do Discordu ale NE do tvých sluchátek – použij Dual Routing v nastavení.
              </p>

              <div className="setup-actions">
                <button className="btn btn-ghost" onClick={() => setStep("vbcable")}>Zpět</button>
                <button className="btn btn-primary" onClick={() => setStep("done")}>
                  Pokračovat <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP: Done ────────────────────────────────────────────────── */}
          {step === "done" && (
            <div className="setup-step setup-step--done">
              <div className="setup-done-icon">
                <Check size={40} />
              </div>
              <h2>Vše je nastaveno!</h2>
              <p>CloudSoundboard je připraven k použití.</p>
              <div className="setup-summary">
                <div className="setup-summary-item">
                  <Server size={14} /> Server: <strong>{serverInput}</strong>
                </div>
                <div className="setup-summary-item">
                  <Speaker size={14} /> Audio: <strong>{
                    audioDevices.find(d => d.deviceId === audioDeviceId)?.label || "Výchozí"
                  }</strong>
                </div>
              </div>
              <button className="btn btn-primary btn--full" onClick={handleComplete}>
                Spustit CloudSoundboard
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .setup-wizard-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: var(--bg-base);
          display: flex; align-items: center; justify-content: center;
        }
        .setup-wizard {
          width: 520px; max-width: 92vw;
          background: var(--bg-elevated); border: 1px solid var(--border);
          border-radius: var(--radius-lg); overflow: hidden;
          box-shadow: var(--shadow-lg);
        }
        .setup-header {
          background: linear-gradient(135deg, var(--accent-dim), transparent);
          border-bottom: 1px solid var(--border);
          padding: 24px; text-align: center;
        }
        .setup-logo {
          width: 48px; height: 48px; border-radius: 14px;
          background: var(--accent-dim); border: 1px solid var(--accent);
          display: flex; align-items: center; justify-content: center;
          color: var(--accent); margin: 0 auto 12px;
        }
        .setup-header h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
        .setup-header p { color: var(--text-muted); font-size: 13px; }
        .setup-progress {
          display: flex; justify-content: center; gap: 8px;
          padding: 16px; border-bottom: 1px solid var(--border-subtle);
        }
        .setup-step-dot {
          width: 24px; height: 24px; border-radius: 50%;
          background: var(--bg-surface); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; color: var(--text-muted); transition: all 0.2s;
        }
        .setup-step-dot.active { border-color: var(--accent); color: var(--accent); }
        .setup-step-dot.done { background: var(--accent); border-color: var(--accent); color: white; }
        .setup-content { padding: 28px; }
        .setup-step { display: flex; flex-direction: column; gap: 16px; }
        .setup-step h2 { font-size: 18px; font-weight: 600; }
        .setup-step p { color: var(--text-secondary); font-size: 13px; line-height: 1.6; }
        .setup-icon { color: var(--accent); }
        .setup-checklist { display: flex; flex-direction: column; gap: 10px; padding: 14px;
          background: var(--bg-surface); border-radius: var(--radius-md); }
        .setup-check-item { display: flex; align-items: center; gap: 10px;
          font-size: 13px; color: var(--text-secondary); }
        .setup-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px; }
        .vbcable-info { display: flex; flex-direction: column; gap: 14px; }
        .vbcable-step { display: flex; gap: 12px; align-items: flex-start; }
        .vbcable-num {
          width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
          background: var(--accent); color: white;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700;
        }
        .vbcable-step strong { display: block; margin-bottom: 4px; font-size: 13px; }
        .vbcable-step p { margin: 0; font-size: 12px; }
        .vbcable-step code { background: var(--bg-overlay); padding: 1px 5px;
          border-radius: 3px; font-family: var(--font-mono); font-size: 11px; }
        .setup-step--done { align-items: center; text-align: center; }
        .setup-done-icon {
          width: 72px; height: 72px; border-radius: 50%;
          background: rgba(82,183,136,0.15); border: 2px solid var(--green);
          display: flex; align-items: center; justify-content: center;
          color: var(--green);
        }
        .setup-summary { display: flex; flex-direction: column; gap: 8px; width: 100%; }
        .setup-summary-item { display: flex; align-items: center; gap: 8px;
          background: var(--bg-surface); border-radius: var(--radius-sm);
          padding: 10px 14px; font-size: 13px; color: var(--text-secondary); }
        .setup-summary-item strong { color: var(--text-primary); margin-left: auto; }
      `}</style>
    </div>
  );
}
