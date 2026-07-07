/**
 * Preload script – bezpečný most mezi renderer (React) a main process.
 * Vystavuje pouze explicitně definované API přes contextBridge.
 * nodeIntegration je vypnuta – žádný přímý přístup k Node.js z rendereru.
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";

// ── Typy ──────────────────────────────────────────────────────────────────────

export interface ElectronAPI {
  // Window controls
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };

  // Audio
  audio: {
    getDevices: () => Promise<{ id: string; label: string }[]>;
    setDevice: (deviceId: string) => Promise<{ success: boolean }>;
    play: (filePath: string, volume?: number) => Promise<{ success: boolean; error?: string }>;
    stop: () => Promise<{ success: boolean }>;
    onPlayInternal: (callback: (data: { filePath: string; deviceId: string; volume: number }) => void) => () => void;
    onStopAllInternal: (callback: () => void) => () => void;
  };

  // Hotkeys
  hotkey: {
    register: (soundId: string, accelerator: string) => Promise<{ success: boolean; error?: string }>;
    unregister: (soundId: string) => Promise<{ success: boolean }>;
    getAll: () => Promise<Record<string, string>>;
    onTriggered: (callback: (soundId: string) => void) => () => void;
  };

  // Cache
  cache: {
    getDir: () => Promise<string>;
    fileExists: (filename: string) => Promise<boolean>;
  };

  // Store
  store: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<{ success: boolean }>;
  };

  // Dialog
  dialog: {
    openAudio: () => Promise<string[]>;
  };
}

// ── Implementace ──────────────────────────────────────────────────────────────

const electronAPI: ElectronAPI = {
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close: () => ipcRenderer.send("window:close"),
  },

  audio: {
    getDevices: () => ipcRenderer.invoke("audio:get-devices"),
    setDevice: (deviceId) => ipcRenderer.invoke("audio:set-device", deviceId),
    play: (filePath, volume) => ipcRenderer.invoke("audio:play", filePath, volume),
    stop: () => ipcRenderer.invoke("audio:stop"),
    onPlayInternal: (callback) => {
      const handler = (_: IpcRendererEvent, data: { filePath: string; deviceId: string; volume: number }) =>
        callback(data);
      ipcRenderer.on("audio:play-internal", handler);
      return () => ipcRenderer.removeListener("audio:play-internal", handler);
    },
    onStopAllInternal: (callback) => {
      const handler = () => callback();
      ipcRenderer.on("audio:stop-all-internal", handler);
      return () => ipcRenderer.removeListener("audio:stop-all-internal", handler);
    },
  },

  hotkey: {
    register: (soundId, accelerator) =>
      ipcRenderer.invoke("hotkey:register", soundId, accelerator),
    unregister: (soundId) => ipcRenderer.invoke("hotkey:unregister", soundId),
    getAll: () => ipcRenderer.invoke("hotkey:get-all"),
    onTriggered: (callback) => {
      const handler = (_: IpcRendererEvent, soundId: string) => callback(soundId);
      ipcRenderer.on("hotkey:triggered", handler);
      return () => ipcRenderer.removeListener("hotkey:triggered", handler);
    },
  },

  cache: {
    getDir: () => ipcRenderer.invoke("cache:get-dir"),
    fileExists: (filename) => ipcRenderer.invoke("cache:file-exists", filename),
  },

  store: {
    get: (key) => ipcRenderer.invoke("store:get", key),
    set: (key, value) => ipcRenderer.invoke("store:set", key, value),
  },

  dialog: {
    openAudio: () => ipcRenderer.invoke("dialog:open-audio"),
  },
};

contextBridge.exposeInMainWorld("electron", electronAPI);
