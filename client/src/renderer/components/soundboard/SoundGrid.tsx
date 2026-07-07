import React, { useEffect, useRef } from "react";
import { Loader2, WifiOff, Music } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { SoundTile } from "./SoundTile";

export function SoundGrid() {
  const filteredSounds = useAppStore((s) => s.filteredSounds);
  const isLoadingSounds = useAppStore((s) => s.isLoadingSounds);
  const soundsError = useAppStore((s) => s.soundsError);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const fetchSounds = useAppStore((s) => s.fetchSounds);

  // Drag-over highlight
  const gridRef = useRef<HTMLDivElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    gridRef.current?.classList.add("drag-over");
  };

  const handleDragLeave = () => {
    gridRef.current?.classList.remove("drag-over");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    gridRef.current?.classList.remove("drag-over");
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("audio/")
    );
    if (files.length > 0) {
      useAppStore.getState().setUploadDialogOpen(true);
    }
  };

  if (isLoadingSounds) {
    return (
      <div className="grid-state">
        <Loader2 size={32} className="spin" />
        <p>Načítám zvuky…</p>
      </div>
    );
  }

  if (soundsError) {
    return (
      <div className="grid-state grid-state--error">
        <WifiOff size={32} />
        <p>Chyba připojení k serveru</p>
        <p className="grid-state-sub">{soundsError}</p>
        <button className="btn btn-primary" onClick={() => fetchSounds()}>
          Zkusit znovu
        </button>
      </div>
    );
  }

  if (filteredSounds.length === 0) {
    return (
      <div
        className="grid-state"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Music size={40} className="grid-empty-icon" />
        {searchQuery ? (
          <p>Žádné výsledky pro „{searchQuery}"</p>
        ) : (
          <>
            <p>Zatím žádné zvuky</p>
            <p className="grid-state-sub">Přetáhněte soubory sem nebo klikněte na „Přidat"</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      ref={gridRef}
      className="sound-grid"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {filteredSounds.map((sound) => (
        <SoundTile key={sound.id} sound={sound} />
      ))}
    </div>
  );
}
