"use strict";
/**
 * AudioPlayer – přehrávání audio souborů na konkrétní výstupní zařízení.
 *
 * Používá Web Audio API přes renderer process nebo node-speaker/naudiodon
 * pro přímé routování do virtuálního audio kabelu.
 *
 * Architektura: Main process posílá příkaz do renderer procesu,
 * který má přístup k Web Audio API s výběrem outputDevice.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioPlayer = void 0;
const electron_1 = require("electron");
const logger_1 = require("./logger");
const logger = (0, logger_1.createLogger)("audioPlayer");
class AudioPlayer {
    _outputDeviceId = "default";
    _volume = 1.0;
    _activeSounds = new Map();
    setOutputDevice(deviceId) {
        this._outputDeviceId = deviceId;
        logger.info("Output device changed", { deviceId });
    }
    setVolume(volume) {
        this._volume = Math.max(0, Math.min(1, volume));
    }
    /**
     * Přehraje zvuk přes renderer process (Web Audio API).
     * Renderer má přístup k výběru audio output device.
     */
    async play(filePath, volume = 1.0) {
        const windows = electron_1.BrowserWindow.getAllWindows();
        if (!windows.length) {
            throw new Error("Žádné okno není otevřené pro přehrání zvuku.");
        }
        const win = windows[0];
        win.webContents.send("audio:play-internal", {
            filePath,
            deviceId: this._outputDeviceId,
            volume: volume * this._volume,
        });
        logger.debug("Playing sound", { filePath, device: this._outputDeviceId });
    }
    stopAll() {
        const windows = electron_1.BrowserWindow.getAllWindows();
        windows.forEach((win) => {
            win.webContents.send("audio:stop-all-internal");
        });
        this._activeSounds.clear();
        logger.info("All sounds stopped");
    }
    /**
     * Vrátí dostupná audio výstupní zařízení.
     * Toto běží v renderer contextu – voláno přes IPC.
     */
    getOutputDevices() {
        // Zařízení se načítají v renderer procesu přes navigator.mediaDevices.
        // Main process vrací prázdný seznam – renderer si je načte sám.
        return Promise.resolve([]);
    }
    cleanup() {
        this.stopAll();
    }
}
exports.AudioPlayer = AudioPlayer;
