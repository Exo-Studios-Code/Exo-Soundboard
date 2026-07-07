"use strict";
/**
 * HotkeyManager – globální klávesové zkratky přes Electron globalShortcut.
 *
 * Klávesové zkratky fungují i když je aplikace minimalizovaná nebo
 * uživatel pracuje v jiném programu (hra, Discord atd.).
 *
 * Formát acceleratoru: "F1", "Ctrl+Shift+1", "Alt+F5" atd.
 * https://www.electronjs.org/docs/latest/api/accelerator
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HotkeyManager = void 0;
const electron_1 = require("electron");
const logger_1 = require("./logger");
const logger = (0, logger_1.createLogger)("hotkeyManager");
class HotkeyManager {
    // soundId → HotkeyEntry
    _hotkeys = new Map();
    // accelerator → soundId (pro detekci duplikátů)
    _acceleratorMap = new Map();
    /**
     * Registruje globální klávesovou zkratku pro daný zvuk.
     * Pokud aktualizujeme existující zkratku pro sound, stará se odregistruje.
     */
    register(accelerator, soundId, callback) {
        // Odregistrujeme starý accelerator pro tento sound (pokud existuje)
        const existing = this._hotkeys.get(soundId);
        if (existing) {
            this._unregisterAccelerator(existing.accelerator);
        }
        // Zkontrolujeme, zda accelerator není obsazený jiným zvukem
        const occupiedBy = this._acceleratorMap.get(accelerator);
        if (occupiedBy && occupiedBy !== soundId) {
            throw new Error(`Klávesová zkratka "${accelerator}" je již přiřazena jinému zvuku.`);
        }
        // Registrujeme novou zkratku
        const success = electron_1.globalShortcut.register(accelerator, () => {
            logger.debug("Hotkey triggered", { accelerator, soundId });
            callback(soundId);
        });
        if (!success) {
            throw new Error(`Klávesovou zkratku "${accelerator}" nelze registrovat. ` +
                `Může být blokována systémem nebo jinou aplikací.`);
        }
        this._hotkeys.set(soundId, { accelerator, soundId, callback });
        this._acceleratorMap.set(accelerator, soundId);
        logger.info("Hotkey registered", { accelerator, soundId });
    }
    /**
     * Odregistruje zkratku pro konkrétní zvuk.
     */
    unregister(soundId) {
        const entry = this._hotkeys.get(soundId);
        if (!entry)
            return;
        this._unregisterAccelerator(entry.accelerator);
        this._hotkeys.delete(soundId);
        this._acceleratorMap.delete(entry.accelerator);
        logger.info("Hotkey unregistered", { soundId, accelerator: entry.accelerator });
    }
    /**
     * Odregistruje všechny zkratky (voláno při ukončení aplikace).
     */
    unregisterAll() {
        electron_1.globalShortcut.unregisterAll();
        this._hotkeys.clear();
        this._acceleratorMap.clear();
        logger.info("All hotkeys unregistered");
    }
    /**
     * Vrátí mapu soundId → accelerator.
     */
    getAll() {
        const result = {};
        this._hotkeys.forEach((entry, soundId) => {
            result[soundId] = entry.accelerator;
        });
        return result;
    }
    _unregisterAccelerator(accelerator) {
        try {
            electron_1.globalShortcut.unregister(accelerator);
        }
        catch {
            // Ignorujeme chybu při odregistraci (zkratka mohla být odregistrována jinak)
        }
    }
}
exports.HotkeyManager = HotkeyManager;
