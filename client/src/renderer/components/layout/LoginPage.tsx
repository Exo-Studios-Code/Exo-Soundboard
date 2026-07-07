import React, { useState } from "react";
import { Radio, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useAppStore } from "../../stores/appStore";

type Mode = "login" | "register";

export function LoginPage() {
  const login = useAppStore((s) => s.login);
  const register = useAppStore((s) => s.register);
  const serverUrl = useAppStore((s) => s.serverUrl);
  const setServerUrl = useAppStore((s) => s.setServerUrl);

  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await register(username, email, password);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Ambient background */}
      <div className="login-bg">
        <div className="login-bg-orb login-bg-orb--1" />
        <div className="login-bg-orb login-bg-orb--2" />
      </div>

      <div className="login-container">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <Radio size={28} />
          </div>
          <h1 className="login-logo-text">CloudSoundboard</h1>
          <p className="login-logo-sub">Sdílená zvuková knihovna v reálném čase</p>
        </div>

        {/* Formulář */}
        <div className="login-card">
          {/* Přepínač mode */}
          <div className="login-tabs">
            <button
              className={`login-tab ${mode === "login" ? "active" : ""}`}
              onClick={() => { setMode("login"); setError(null); }}
            >
              Přihlášení
            </button>
            <button
              className={`login-tab ${mode === "register" ? "active" : ""}`}
              onClick={() => { setMode("register"); setError(null); }}
            >
              Registrace
            </button>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label className="form-label">Uživatelské jméno</label>
              <input
                type="text"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="jmeno123"
                required
                autoFocus
                autoComplete="username"
                minLength={3}
                maxLength={64}
              />
            </div>

            {mode === "register" && (
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vas@email.cz"
                  required
                  autoComplete="email"
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Heslo</label>
              <div className="input-password">
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "Min. 8 znaků, 1 velké, 1 číslice" : "Vaše heslo"}
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={mode === "register" ? 8 : 1}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="form-status form-status--error">
                <AlertCircle size={15} />
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn--full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 size={15} className="spin" />
                  {mode === "login" ? "Přihlašuji…" : "Registruji…"}
                </>
              ) : mode === "login" ? (
                "Přihlásit se"
              ) : (
                "Vytvořit účet"
              )}
            </button>
          </form>
        </div>

        {/* Server URL */}
        <div className="login-server">
          <label className="login-server-label">Server URL</label>
          <input
            type="text"
            className="form-input login-server-input"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="http://localhost:8000"
          />
        </div>
      </div>
    </div>
  );
}
