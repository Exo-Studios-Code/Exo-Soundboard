"use strict";
/**
 * StoreManager – persistentní uložiště nastavení pomocí electron-store.
 * Data jsou uložena v AppData/CloudSoundboard/config.json
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoreManager = void 0;
const electron_store_1 = __importDefault(require("electron-store"));
const defaults = {
    serverUrl: "http://localhost:8000",
    authToken: null,
    audioDeviceId: "default",
    volume: 1.0,
    hotkeys: {},
    theme: "dark",
    userId: null,
    username: null,
};
class StoreManager {
    _store;
    constructor() {
        this._store = new electron_store_1.default({
            name: "config",
            defaults,
            encryptionKey: "cloudsoundboard-secure-storage",
        });
    }
    get(key) {
        return this._store.get(key);
    }
    set(key, value) {
        this._store.set(key, value);
    }
    setHotkey(soundId, accelerator) {
        const hotkeys = this._store.get("hotkeys");
        hotkeys[soundId] = accelerator;
        this._store.set("hotkeys", hotkeys);
    }
    removeHotkey(soundId) {
        const hotkeys = this._store.get("hotkeys");
        delete hotkeys[soundId];
        this._store.set("hotkeys", hotkeys);
    }
    getAllHotkeys() {
        return this._store.get("hotkeys");
    }
    clear() {
        this._store.clear();
    }
}
exports.StoreManager = StoreManager;
