/**
 * StoreManager – persistentní uložiště nastavení pomocí electron-store.
 * Data jsou uložena v AppData/CloudSoundboard/config.json
 */

import Store from "electron-store";

interface StoreSchema {
  serverUrl: string;
  authToken: string | null;
  audioDeviceId: string;
  volume: number;
  hotkeys: Record<string, string>; // soundId → accelerator
  theme: "dark" | "light";
  userId: string | null;
  username: string | null;
}

const defaults: StoreSchema = {
  serverUrl: "http://localhost:8000",
  authToken: null,
  audioDeviceId: "default",
  volume: 1.0,
  hotkeys: {},
  theme: "dark",
  userId: null,
  username: null,
};

export class StoreManager {
  private _store: Store<StoreSchema>;

  constructor() {
    this._store = new Store<StoreSchema>({
      name: "config",
      defaults,
      encryptionKey: "cloudsoundboard-secure-storage",
    });
  }

  get<K extends keyof StoreSchema>(key: K): StoreSchema[K] {
    return this._store.get(key);
  }

  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void {
    this._store.set(key, value);
  }

  setHotkey(soundId: string, accelerator: string): void {
    const hotkeys = this._store.get("hotkeys");
    hotkeys[soundId] = accelerator;
    this._store.set("hotkeys", hotkeys);
  }

  removeHotkey(soundId: string): void {
    const hotkeys = this._store.get("hotkeys");
    delete hotkeys[soundId];
    this._store.set("hotkeys", hotkeys);
  }

  getAllHotkeys(): Record<string, string> {
    return this._store.get("hotkeys");
  }

  clear(): void {
    this._store.clear();
  }
}
