/**
 * Electron Main Process
 * Zodpovídá za: tvorbu okna, IPC bridge, registraci globálních hotkeys,
 * audio přehrávání přes Node.js a systémový tray.
 */

import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  shell,
  Tray,
  dialog,
} from "electron";
import path from "path";
import fs from "fs";
import os from "os";
import { AudioPlayer } from "./audioPlayer";
import { HotkeyManager } from "./hotkeyManager";
import { StoreManager } from "./storeManager";
import { createLogger } from "./logger";

const logger = createLogger("main");
const isDev = process.env.NODE_ENV === "development";
const RENDERER_URL = "http://localhost:5173";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
const audioPlayer = new AudioPlayer();
const hotkeyManager = new HotkeyManager();
const store = new StoreManager();

// ── Vytvoření okna ────────────────────────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,           // Vlastní titlebar v Reactu
    titleBarStyle: "hidden",
    backgroundColor: "#0d0d0f",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, "../../assets/icon.png"),
  });

  // Vynutíme načtení localhostu pro vývoj
  if (isDev || !app.isPackaged) {
    mainWindow.loadURL("http://localhost:5173/");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Minimalizace do tray místo zavření
  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  logger.info("Main window created");
}

// ── System Tray ───────────────────────────────────────────────────────────────

function createTray(): void {
  const iconPath = path.join(__dirname, "../../assets/tray-icon.png");
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  tray.setToolTip("CloudSoundboard");

  const contextMenu = Menu.buildFromTemplate([
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
        app.isQuitting = true;
        app.quit();
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

function registerIpcHandlers(): void {
  // ── Window controls ────────────────────────────────────────────────────────
  ipcMain.on("window:minimize", () => mainWindow?.minimize());
  ipcMain.on("window:maximize", () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on("window:close", () => mainWindow?.hide());

  // ── Audio zařízení ─────────────────────────────────────────────────────────
  ipcMain.handle("audio:get-devices", async () => {
    return audioPlayer.getOutputDevices();
  });

  ipcMain.handle("audio:set-device", async (_, deviceId: string) => {
    store.set("audioDeviceId", deviceId);
    audioPlayer.setOutputDevice(deviceId);
    return { success: true };
  });

  ipcMain.handle("audio:play", async (_, filePath: string, volume: number = 1.0) => {
    try {
      await audioPlayer.play(filePath, volume);
      return { success: true };
    } catch (err) {
      logger.error("Audio playback failed", { error: err });
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle("audio:stop", async () => {
    audioPlayer.stopAll();
    return { success: true };
  });

  // ── Hotkeys ────────────────────────────────────────────────────────────────
  ipcMain.handle("hotkey:register", async (_, soundId: string, accelerator: string) => {
    try {
      hotkeyManager.register(accelerator, soundId, (sid) => {
        mainWindow?.webContents.send("hotkey:triggered", sid);
      });
      store.setHotkey(soundId, accelerator);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle("hotkey:unregister", async (_, soundId: string) => {
    hotkeyManager.unregister(soundId);
    store.removeHotkey(soundId);
    return { success: true };
  });

  ipcMain.handle("hotkey:get-all", async () => {
    return store.getAllHotkeys();
  });

  // ── Lokální cache souborů ──────────────────────────────────────────────────
  ipcMain.handle("cache:get-dir", async () => {
    return getCacheDir();
  });

  ipcMain.handle("cache:file-exists", async (_, filename: string) => {
    const filePath = path.join(getCacheDir(), filename);
    return fs.existsSync(filePath);
  });

  // ── Store / Settings ───────────────────────────────────────────────────────
  ipcMain.handle("store:get", async (_, key: string) => {
    // Cast přes unknown – IPC přijímá string, StoreManager ověří interně
    return store.get(key as Parameters<typeof store.get>[0]);
  });

  ipcMain.handle("store:set", async (_, key: string, value: unknown) => {
    store.set(
      key as Parameters<typeof store.set>[0],
      value as Parameters<typeof store.set>[1],
    );
    return { success: true };
  });

  // ── Soubor picker pro upload ───────────────────────────────────────────────
  ipcMain.handle("dialog:open-audio", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
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

function getCacheDir(): string {
  const cacheDir = path.join(
    app.getPath("userData"),
    "sound-cache"
  );
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return cacheDir;
}

// ── Nastavení hotkeys ze store při startu ─────────────────────────────────────

function restoreHotkeys(): void {
  const hotkeys = store.getAllHotkeys();
  for (const [soundId, accelerator] of Object.entries(hotkeys)) {
    try {
      hotkeyManager.register(accelerator as string, soundId, (sid) => {
        mainWindow?.webContents.send("hotkey:triggered", sid);
      });
    } catch (err) {
      logger.warn("Failed to restore hotkey", { soundId, accelerator, error: err });
    }
  }
  logger.info(`Restored ${Object.keys(hotkeys).length} hotkeys`);
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerIpcHandlers();
  restoreHotkeys();
  logger.info("App ready", { platform: process.platform, version: app.getVersion() });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Na Windows zůstaneme v trayi
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  hotkeyManager.unregisterAll();
  audioPlayer.cleanup();
  logger.info("App quitting – cleanup done");
});

// Rozšíření typů pro app.isQuitting
declare global {
  namespace Electron {
    interface App {
      isQuitting?: boolean;
    }
  }
}
