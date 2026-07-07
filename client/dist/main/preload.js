"use strict";
/**
 * Preload script – bezpečný most mezi renderer (React) a main process.
 * Vystavuje pouze explicitně definované API přes contextBridge.
 * nodeIntegration je vypnuta – žádný přímý přístup k Node.js z rendereru.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// ── Implementace ──────────────────────────────────────────────────────────────
const electronAPI = {
    window: {
        minimize: () => electron_1.ipcRenderer.send("window:minimize"),
        maximize: () => electron_1.ipcRenderer.send("window:maximize"),
        close: () => electron_1.ipcRenderer.send("window:close"),
    },
    audio: {
        getDevices: () => electron_1.ipcRenderer.invoke("audio:get-devices"),
        setDevice: (deviceId) => electron_1.ipcRenderer.invoke("audio:set-device", deviceId),
        play: (filePath, volume) => electron_1.ipcRenderer.invoke("audio:play", filePath, volume),
        stop: () => electron_1.ipcRenderer.invoke("audio:stop"),
        onPlayInternal: (callback) => {
            const handler = (_, data) => callback(data);
            electron_1.ipcRenderer.on("audio:play-internal", handler);
            return () => electron_1.ipcRenderer.removeListener("audio:play-internal", handler);
        },
        onStopAllInternal: (callback) => {
            const handler = () => callback();
            electron_1.ipcRenderer.on("audio:stop-all-internal", handler);
            return () => electron_1.ipcRenderer.removeListener("audio:stop-all-internal", handler);
        },
    },
    hotkey: {
        register: (soundId, accelerator) => electron_1.ipcRenderer.invoke("hotkey:register", soundId, accelerator),
        unregister: (soundId) => electron_1.ipcRenderer.invoke("hotkey:unregister", soundId),
        getAll: () => electron_1.ipcRenderer.invoke("hotkey:get-all"),
        onTriggered: (callback) => {
            const handler = (_, soundId) => callback(soundId);
            electron_1.ipcRenderer.on("hotkey:triggered", handler);
            return () => electron_1.ipcRenderer.removeListener("hotkey:triggered", handler);
        },
    },
    cache: {
        getDir: () => electron_1.ipcRenderer.invoke("cache:get-dir"),
        fileExists: (filename) => electron_1.ipcRenderer.invoke("cache:file-exists", filename),
    },
    store: {
        get: (key) => electron_1.ipcRenderer.invoke("store:get", key),
        set: (key, value) => electron_1.ipcRenderer.invoke("store:set", key, value),
    },
    dialog: {
        openAudio: () => electron_1.ipcRenderer.invoke("dialog:open-audio"),
    },
};
electron_1.contextBridge.exposeInMainWorld("electron", electronAPI);
