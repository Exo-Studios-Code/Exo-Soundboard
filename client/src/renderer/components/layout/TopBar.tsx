import React, { useState, useCallback, useMemo } from "react";
import { Upload, Settings, Volume2, LogOut } from "lucide-react"; // Odstranil jsem Globe
import { useAppStore } from "../../stores/appStore";
// import { OnlineSearchDialog } from "../soundboard/OnlineSearchDialog"; // Smaž tento import
import { SearchBar } from "../soundboard/SearchBar";
import { searchService } from "../../services/searchService";

export function TopBar() {
  const setUploadDialogOpen = useAppStore((s) => s.setUploadDialogOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const logout = useAppStore((s) => s.logout);
  const user = useAppStore((s) => s.user);
  const sounds = useAppStore((s) => s.sounds);
  const volume = useAppStore((s) => s.volume);
  const setVolume = useAppStore((s) => s.setVolume);

  // showOnlineSearch stav je teď zbytečný, pryč s ním
  // const [showOnlineSearch, setShowOnlineSearch] = useState(false);

  const availableTags = useMemo(() => searchService.extractTags(sounds), [sounds]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("audio/")
    );
    if (files.length === 0) return;
    setUploadDialogOpen(true);
  }, [setUploadDialogOpen]);

  return (
    <div
      className="topbar"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="search-container" style={{ flex: 1, maxWidth: 480 }}>
        <SearchBar availableTags={availableTags} />
      </div>

      <div className="volume-control">
        <Volume2 size={14} className="volume-icon" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="volume-slider"
          title={`Hlasitost: ${Math.round(volume * 100)}%`}
        />
        <span className="volume-label">{Math.round(volume * 100)}%</span>
      </div>

      <div className="topbar-actions">
        {/* Tlačítko Hledat online a modální okno byly odstraněny */}
        
        <button
          className="btn btn-primary"
          onClick={() => setUploadDialogOpen(true)}
          title="Přidat zvuk (nebo přetáhnout soubor)"
        >
          <Upload size={15} />
          <span>Přidat</span>
        </button>

        <button
          className="btn btn-ghost icon-btn"
          onClick={() => setSettingsOpen(true)}
          title="Nastavení"
        >
          <Settings size={16} />
        </button>

        <div className="user-chip">
          <span className="user-avatar">
            {user?.username?.[0]?.toUpperCase() || "U"}
          </span>
          <span className="user-name">{user?.username}</span>
        </div>

        <button
          className="btn btn-ghost icon-btn"
          onClick={logout}
          title="Odhlásit se"
        >
          <LogOut size={15} />
        </button>
      </div>
    </div>
  );
}