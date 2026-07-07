"use strict";
/**
 * Electron Main Process
 * Zodpovídá za: tvorbu okna, IPC bridge, registraci globálních hotkeys,
 * audio přehrávání přes Node.js a systémový tray.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const audioPlayer_1 = require("./audioPlayer");
const hotkeyManager_1 = require("./hotkeyManager");
const storeManager_1 = require("./storeManager");
const logger_1 = require("./logger");
const logger = (0, logger_1.createLogger)("main");
const isDev = process.env.NODE_ENV === "development";
const RENDERER_URL = "http://localhost:5173";
let mainWindow = null;
let tray = null;
const audioPlayer = new audioPlayer_1.AudioPlayer();
const hotkeyManager = new hotkeyManager_1.HotkeyManager();
const store = new storeManager_1.StoreManager();
// ── Vytvoření okna ────────────────────────────────────────────────────────────
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        frame: false, // Vlastní titlebar v Reactu
        titleBarStyle: "hidden",
        backgroundColor: "#0d0d0f",
        webPreferences: {
            preload: path_1.default.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
        icon: path_1.default.join(__dirname, "../../assets/icon.png"),
    });
    // Vynutíme načtení localhostu pro vývoj
    if (isDev || !electron_1.app.isPackaged) {
        mainWindow.loadURL("http://localhost:5173/");
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, "../../dist/renderer/index.html"));
    }
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
    // Minimalizace do tray místo zavření
    mainWindow.on("close", (event) => {
        if (!electron_1.app.isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
        }
    });
    logger.info("Main window created");
}
// ── System Tray ───────────────────────────────────────────────────────────────
function createTray() {
    const iconPath = path_1.default.join(__dirname, "../../assets/tray-icon.png");
    const icon = fs_1.default.existsSync(iconPath)
        ? electron_1.nativeImage.createFromPath(iconPath)
        : electron_1.nativeImage.createEmpty();
    tray = new electron_1.Tray(icon);
    tray.setToolTip("CloudSoundboard");
    const contextMenu = electron_1.Menu.buildFromTemplate([
        {
            label: "Otevřít",
            click: () => {
                mainWindow?.show();
                mainWindow?.focus();
            },
        },
        { type: "separator" },
        {
            label: "Ukončit",
            click: () => {
                electron_1.app.isQuitting = true;
                electron_1.app.quit();
            },
        },
    ]);
    tray.setContextMenu(contextMenu);
    tray.on("double-click", () => {
        mainWindow?.show();
        mainWindow?.focus();
    });
}
// ── IPC Handlers ──────────────────────────────────────────────────────────────
function registerIpcHandlers() {
    // ── Window controls ────────────────────────────────────────────────────────
    electron_1.ipcMain.on("window:minimize", () => mainWindow?.minimize());
    electron_1.ipcMain.on("window:maximize", () => {
        if (mainWindow?.isMaximized()) {
            mainWindow.unmaximize();
        }
        else {
            mainWindow?.maximize();
        }
    });
    electron_1.ipcMain.on("window:close", () => mainWindow?.hide());
    // ── Audio zařízení ─────────────────────────────────────────────────────────
    electron_1.ipcMain.handle("audio:get-devices", async () => {
        return audioPlayer.getOutputDevices();
    });
    electron_1.ipcMain.handle("audio:set-device", async (_, deviceId) => {
        store.set("audioDeviceId", deviceId);
        audioPlayer.setOutputDevice(deviceId);
        return { success: true };
    });
    electron_1.ipcMain.handle("audio:play", async (_, filePath, volume = 1.0) => {
        try {
            await audioPlayer.play(filePath, volume);
            return { success: true };
        }
        catch (err) {
            logger.error("Audio playback failed", { error: err });
            return { success: false, error: String(err) };
        }
    });
    electron_1.ipcMain.handle("audio:stop", async () => {
        audioPlayer.stopAll();
        return { success: true };
    });
    // ── Hotkeys ────────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle("hotkey:register", async (_, soundId, accelerator) => {
        try {
            hotkeyManager.register(accelerator, soundId, (sid) => {
                mainWindow?.webContents.send("hotkey:triggered", sid);
            });
            store.setHotkey(soundId, accelerator);
            return { success: true };
        }
        catch (err) {
            return { success: false, error: String(err) };
        }
    });
    electron_1.ipcMain.handle("hotkey:unregister", async (_, soundId) => {
        hotkeyManager.unregister(soundId);
        store.removeHotkey(soundId);
        return { success: true };
    });
    electron_1.ipcMain.handle("hotkey:get-all", async () => {
        return store.getAllHotkeys();
    });
    // ── Lokální cache souborů ──────────────────────────────────────────────────
    electron_1.ipcMain.handle("cache:get-dir", async () => {
        return getCacheDir();
    });
    electron_1.ipcMain.handle("cache:file-exists", async (_, filename) => {
        const filePath = path_1.default.join(getCacheDir(), filename);
        return fs_1.default.existsSync(filePath);
    });
    // ── Store / Settings ───────────────────────────────────────────────────────
    electron_1.ipcMain.handle("store:get", async (_, key) => {
        // Cast přes unknown – IPC přijímá string, StoreManager ověří interně
        return store.get(key);
    });
    electron_1.ipcMain.handle("store:set", async (_, key, value) => {
        store.set(key, value);
        return { success: true };
    });
    // ── Soubor picker pro upload ───────────────────────────────────────────────
    electron_1.ipcMain.handle("dialog:open-audio", async () => {
        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
            title: "Vybrat zvuk",
            filters: [
                { name: "Audio soubory", extensions: ["mp3", "wav", "ogg", "flac"] },
            ],
            properties: ["openFile", "multiSelections"],
        });
        return result.canceled ? [] : result.filePaths;
    });
}
// ── Cache složka ──────────────────────────────────────────────────────────────
function getCacheDir() {
    const cacheDir = path_1.default.join(electron_1.app.getPath("userData"), "sound-cache");
    if (!fs_1.default.existsSync(cacheDir)) {
        fs_1.default.mkdirSync(cacheDir, { recursive: true });
    }
    return cacheDir;
}
// ── Nastavení hotkeys ze store při startu ─────────────────────────────────────
function restoreHotkeys() {
    const hotkeys = store.getAllHotkeys();
    for (const [soundId, accelerator] of Object.entries(hotkeys)) {
        try {
            hotkeyManager.register(accelerator, soundId, (sid) => {
                mainWindow?.webContents.send("hotkey:triggered", sid);
            });
        }
        catch (err) {
            logger.warn("Failed to restore hotkey", { soundId, accelerator, error: err });
        }
    }
    logger.info(`Restored ${Object.keys(hotkeys).length} hotkeys`);
}
// ── App lifecycle ─────────────────────────────────────────────────────────────
electron_1.app.whenReady().then(() => {
    createWindow();
    createTray();
    registerIpcHandlers();
    restoreHotkeys();
    logger.info("App ready", { platform: process.platform, version: electron_1.app.getVersion() });
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        // Na Windows zůstaneme v trayi
    }
});
electron_1.app.on("activate", () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
electron_1.app.on("will-quit", () => {
    electron_1.globalShortcut.unregisterAll();
    hotkeyManager.unregisterAll();
    audioPlayer.cleanup();
    logger.info("App quitting – cleanup done");
});
