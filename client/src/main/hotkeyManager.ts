/**
 * HotkeyManager – globální klávesové zkratky přes Electron globalShortcut.
 *
 * Klávesové zkratky fungují i když je aplikace minimalizovaná nebo
 * uživatel pracuje v jiném programu (hra, Discord atd.).
 *
 * Formát acceleratoru: "F1", "Ctrl+Shift+1", "Alt+F5" atd.
 * https://www.electronjs.org/docs/latest/api/accelerator
 */

import { globalShortcut } from "electron";
import { createLogger } from "./logger";

const logger = createLogger("hotkeyManager");

type HotkeyCallback = (soundId: string) => void;

interface HotkeyEntry {
  accelerator: string;
  soundId: string;
  callback: HotkeyCallback;
}

export class HotkeyManager {
  // soundId → HotkeyEntry
  private _hotkeys: Map<string, HotkeyEntry> = new Map();
  // accelerator → soundId (pro detekci duplikátů)
  private _acceleratorMap: Map<string, string> = new Map();

  /**
   * Registruje globální klávesovou zkratku pro daný zvuk.
   * Pokud aktualizujeme existující zkratku pro sound, stará se odregistruje.
   */
  register(accelerator: string, soundId: string, callback: HotkeyCallback): void {
    // Odregistrujeme starý accelerator pro tento sound (pokud existuje)
    const existing = this._hotkeys.get(soundId);
    if (existing) {
      this._unregisterAccelerator(existing.accelerator);
    }

    // Zkontrolujeme, zda accelerator není obsazený jiným zvukem
    const occupiedBy = this._acceleratorMap.get(accelerator);
    if (occupiedBy && occupiedBy !== soundId) {
      throw new Error(
        `Klávesová zkratka "${accelerator}" je již přiřazena jinému zvuku.`
      );
    }

    // Registrujeme novou zkratku
    const success = globalShortcut.register(accelerator, () => {
      logger.debug("Hotkey triggered", { accelerator, soundId });
      callback(soundId);
    });

    if (!success) {
      throw new Error(
        `Klávesovou zkratku "${accelerator}" nelze registrovat. ` +
        `Může být blokována systémem nebo jinou aplikací.`
      );
    }

    this._hotkeys.set(soundId, { accelerator, soundId, callback });
    this._acceleratorMap.set(accelerator, soundId);

    logger.info("Hotkey registered", { accelerator, soundId });
  }

  /**
   * Odregistruje zkratku pro konkrétní zvuk.
   */
  unregister(soundId: string): void {
    const entry = this._hotkeys.get(soundId);
    if (!entry) return;

    this._unregisterAccelerator(entry.accelerator);
    this._hotkeys.delete(soundId);
    this._acceleratorMap.delete(entry.accelerator);

    logger.info("Hotkey unregistered", { soundId, accelerator: entry.accelerator });
  }

  /**
   * Odregistruje všechny zkratky (voláno při ukončení aplikace).
   */
  unregisterAll(): void {
    globalShortcut.unregisterAll();
    this._hotkeys.clear();
    this._acceleratorMap.clear();
    logger.info("All hotkeys unregistered");
  }

  /**
   * Vrátí mapu soundId → accelerator.
   */
  getAll(): Record<string, string> {
    const result: Record<string, string> = {};
    this._hotkeys.forEach((entry, soundId) => {
      result[soundId] = entry.accelerator;
    });
    return result;
  }

  private _unregisterAccelerator(accelerator: string): void {
    try {
      globalShortcut.unregister(accelerator);
    } catch {
      // Ignorujeme chybu při odregistraci (zkratka mohla být odregistrována jinak)
    }
  }
}
