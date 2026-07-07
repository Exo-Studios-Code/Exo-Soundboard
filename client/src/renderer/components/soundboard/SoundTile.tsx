import React, { useState, useCallback, useRef } from "react";
import {
  Play,
  Square,
  Trash2,
  Keyboard,
  User,
  Tag,
  MoreVertical,
  Loader2,
  Heart,
} from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import type { Sound } from "../../types";

interface SoundTileProps {
  sound: Sound;
}

export function SoundTile({ sound }: SoundTileProps) {
  const playSound = useAppStore((s) => s.playSound);
  const stopSound = useAppStore((s) => s.stopSound);
  const deleteSound = useAppStore((s) => s.deleteSound);
  const registerHotkey = useAppStore((s) => s.registerHotkey);
  const unregisterHotkey = useAppStore((s) => s.unregisterHotkey);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const hotkeys = useAppStore((s) => s.hotkeys);
  const playingSoundIds = useAppStore((s) => s.playingSoundIds);
  const currentUser = useAppStore((s) => s.user);

  const isPlaying = playingSoundIds.has(sound.id);
  const hotkey = hotkeys[sound.id];
  const isOwner = currentUser?.id === sound.author_id || currentUser?.is_admin;
  const isFavorite = sound.is_favorite;

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBindingHotkey, setIsBindingHotkey] = useState(false);
  const [hotkeyError, setHotkeyError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // OPRAVENO: Přehrávání s kontrolou dat
  const handlePlayStop = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isPlaying) {
        stopSound(sound.id);
      } else {
        // DEBUG: Zkontroluj, co je v objektu sound před přehráním
        if (!sound) {
          console.error("SoundTile: Sound object is missing!");
          return;
        }
        
        console.log("Pokus o přehrání zvuku:", sound);
        
        // Zde můžeš přidat podmínku, pokud tvoje API vrací cestu v jiném poli
        // await playSound(sound);
        await playSound(sound);
      }
    },
    [isPlaying, sound, playSound, stopSound]
  );

  // Zachytávání nové klávesové zkratky
  const handleHotkeyBinding = useCallback(() => {
    setIsBindingHotkey(true);
    setHotkeyError(null);
    setIsMenuOpen(false);

    const handleKeyDown = async (e: KeyboardEvent) => {
      e.preventDefault();

      if (e.key === "Escape") {
        setIsBindingHotkey(false);
        document.removeEventListener("keydown", handleKeyDown);
        return;
      }

      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      parts.push(e.key.toUpperCase());
      const accelerator = parts.join("+");

      document.removeEventListener("keydown", handleKeyDown);

      try {
        await registerHotkey(sound.id, accelerator);
        setIsBindingHotkey(false);
      } catch (err) {
        setHotkeyError(String(err));
        setIsBindingHotkey(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
  }, [sound.id, registerHotkey]);

  const handleUnbindHotkey = useCallback(async () => {
    await unregisterHotkey(sound.id);
    setIsMenuOpen(false);
  }, [sound.id, unregisterHotkey]);

  const handleFavorite = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      await toggleFavorite(sound.id);
    },
    [sound.id, toggleFavorite]
  );

  const handleDelete = useCallback(async () => {
    if (!window.confirm(`Smazat zvuk „${sound.name}"?`)) return;
    setIsDeleting(true);
    setIsMenuOpen(false);
    try {
      await deleteSound(sound.id);
    } catch (err) {
      console.error("Smazání selhalo:", err);
      setIsDeleting(false);
    }
  }, [sound, deleteSound]);

  const tileColor = getTileAccent(sound.id);

  return (
    <div
      className={`sound-tile ${isPlaying ? "sound-tile--playing" : ""} ${isDeleting ? "sound-tile--deleting" : ""}`}
      style={{ "--tile-accent": tileColor } as React.CSSProperties}
      onDoubleClick={handlePlayStop}
    >
      <div className="tile-accent-bar" />

      <div className="tile-body">
        <div className="tile-name" title={sound.name}>
          {sound.name}
        </div>

        {sound.description && (
          <div className="tile-desc" title={sound.description}>
            {sound.description}
          </div>
        )}

        {sound.tags && sound.tags.length > 0 && (
          <div className="tile-tags">
            {sound.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="tile-tag">
                <Tag size={9} />
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="tile-footer">
        <div className="tile-meta">
          <span className="tile-author" title={`Nahráno: ${sound.author?.username || 'Neznámý'}`}>
            <User size={10} />
            {sound.author?.username || 'Neznámý'}
          </span>
          {sound.duration_seconds && (
            <span className="tile-duration">
              {formatDuration(sound.duration_seconds)}
            </span>
          )}
        </div>

        <div className="tile-actions">
          {isBindingHotkey ? (
            <div className="hotkey-binding-prompt">
              <Keyboard size={11} />
              <span>Stiskni zkratku…</span>
            </div>
          ) : hotkey ? (
            <div className="hotkey-badge" title={`Zkratka: ${hotkey}`}>
              <Keyboard size={10} />
              <span>{hotkey}</span>
            </div>
          ) : null}

          {hotkeyError && (
            <div className="hotkey-error" title={hotkeyError}>!</div>
          )}

          <button
            className={`tile-favorite-btn ${isFavorite ? "tile-favorite-btn--active" : ""}`}
            onClick={handleFavorite}
            aria-label={isFavorite ? "Odebrat z oblíbených" : "Přidat do oblíbených"}
            title={isFavorite ? "Odebrat z oblíbených" : "Přidat do oblíbených"}
          >
            <Heart size={13} fill={isFavorite ? "currentColor" : "none"} />
          </button>

          <button
            className={`tile-play-btn ${isPlaying ? "tile-play-btn--playing" : ""}`}
            onClick={handlePlayStop}
            aria-label={isPlaying ? "Zastavit" : "Přehrát"}
          >
            {isPlaying ? <Square size={14} /> : <Play size={14} />}
          </button>

          <div className="tile-menu-container" ref={menuRef}>
            <button
              className="tile-menu-btn"
              onClick={(e) => { e.stopPropagation(); setIsMenuOpen((v) => !v); }}
              aria-label="Více možností"
            >
              <MoreVertical size={14} />
            </button>

            {isMenuOpen && (
              <div className="tile-menu" onClick={(e) => e.stopPropagation()}>
                <button className="tile-menu-item" onClick={handleHotkeyBinding}>
                  <Keyboard size={13} />
                  {hotkey ? "Změnit zkratku" : "Přiřadit zkratku"}
                </button>
                {hotkey && (
                  <button className="tile-menu-item" onClick={handleUnbindHotkey}>
                    <Keyboard size={13} />
                    Odebrat zkratku
                  </button>
                )}
                {isOwner && (
                  <button
                    className="tile-menu-item tile-menu-item--danger"
                    onClick={handleDelete}
                  >
                    <Trash2 size={13} />
                    Smazat
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {isPlaying && (
        <div className="tile-playing-overlay">
          <div className="playing-bars">
            <span /><span /><span /><span />
          </div>
        </div>
      )}

      {isDeleting && (
        <div className="tile-deleting-overlay">
          <Loader2 size={20} className="spin" />
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const ACCENT_PALETTE = [
  "#e05c4b", "#e07a3a", "#d4a017", "#52b788",
  "#4895ef", "#7b61ff", "#c77dff", "#f72585",
  "#06d6a0", "#118ab2",
];

function getTileAccent(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return ACCENT_PALETTE[hash % ACCENT_PALETTE.length];
}