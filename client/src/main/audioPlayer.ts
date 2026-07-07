/**
 * AudioPlayer – přehrávání audio souborů na konkrétní výstupní zařízení.
 *
 * Používá Web Audio API přes renderer process nebo node-speaker/naudiodon
 * pro přímé routování do virtuálního audio kabelu.
 *
 * Architektura: Main process posílá příkaz do renderer procesu,
 * který má přístup k Web Audio API s výběrem outputDevice.
 */

import { BrowserWindow } from "electron";
import { createLogger } from "./logger";

const logger = createLogger("audioPlayer");

export interface PlaybackState {
  soundId: string;
  isPlaying: boolean;
  startedAt: number;
}

export class AudioPlayer {
  private _outputDeviceId: string = "default";
  private _volume: number = 1.0;
  private _activeSounds: Map<string, PlaybackState> = new Map();

  setOutputDevice(deviceId: string): void {
    this._outputDeviceId = deviceId;
    logger.info("Output device changed", { deviceId });
  }

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Přehraje zvuk přes renderer process (Web Audio API).
   * Renderer má přístup k výběru audio output device.
   */
  async play(filePath: string, volume: number = 1.0): Promise<void> {
    const windows = BrowserWindow.getAllWindows();
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

  stopAll(): void {
    const windows = BrowserWindow.getAllWindows();
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
  getOutputDevices(): Promise<{ deviceId: string; label: string }[]> {
    // Zařízení se načítají v renderer procesu přes navigator.mediaDevices.
    // Main process vrací prázdný seznam – renderer si je načte sám.
    return Promise.resolve([]);
  }

  cleanup(): void {
    this.stopAll();
  }
}
