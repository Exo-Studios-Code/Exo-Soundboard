/**
 * Centrální Zustand store – globální stav aplikace.
 * Rozděleno na slices pro přehlednost.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AudioDevice, HotkeyMap, Sound, User } from "../types";
import { authApi, configureApi, serverApi, setToken, soundsApi } from "../services/api";
import { audioService } from "../services/audioService";
import { soundboardWS } from "../services/websocket";

// ── Typy ──────────────────────────────────────────────────────────────────────

interface AppState {
  // Auth
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  // Sounds
  sounds: Sound[];
  filteredSounds: Sound[];
  searchQuery: string;
  activeTag: string | null;
  favoriteIds: Set<string>;
  isLoadingSounds: boolean;
  soundsError: string | null;

  // Přehrávání
  playingSoundIds: Set<string>;

  // Nastavení
  serverUrl: string;
  audioDeviceId: string;
  audioDevices: AudioDevice[];
  volume: number;
  hotkeys: HotkeyMap;

  // WS stav
  isWsConnected: boolean;

  // UI
  isUploadDialogOpen: boolean;
  isSettingsOpen: boolean;
  uploadProgress: number | null;

  // Akce – Auth
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;

  // Akce – Sounds
  fetchSounds: (search?: string, tag?: string) => Promise<void>;
  uploadSound: (file: File, name: string, description?: string, tags?: string[]) => Promise<void>;
  deleteSound: (soundId: string) => Promise<void>;
  playSound: (sound: Sound) => Promise<void>;
  stopSound: (soundId: string) => void;
  toggleFavorite: (soundId: string) => Promise<void>;
  setActiveTag: (tag: string | null) => void;

  // Akce – Settings
  setServerUrl: (url: string) => void;
  setAudioDevice: (deviceId: string) => void;
  setVolume: (volume: number) => void;
  loadAudioDevices: () => Promise<void>;

  // Akce – Hotkeys
  registerHotkey: (soundId: string, accelerator: string) => Promise<void>;
  unregisterHotkey: (soundId: string) => Promise<void>;

  // Akce – WS
  connectWebSocket: () => void;
  setWsConnected: (connected: boolean) => void;

  // Akce – UI
  setSearchQuery: (q: string) => void;
  setUploadDialogOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  addSoundFromWS: (sound: Sound) => void;
  removeSoundFromWS: (soundId: string) => void;
  updateSoundFromWS: (sound: Sound) => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ── Initial state ─────────────────────────────────────────────────────
      user: null,
      token: null,
      isAuthenticated: false,
      sounds: [],
      filteredSounds: [],
      searchQuery: "",
      activeTag: null,
      favoriteIds: new Set(),
      isLoadingSounds: false,
      soundsError: null,
      playingSoundIds: new Set(),
      serverUrl: "http://localhost:8000",
      audioDeviceId: "default",
      audioDevices: [],
      volume: 1.0,
      hotkeys: {},
      isWsConnected: false,
      isUploadDialogOpen: false,
      isSettingsOpen: false,
      uploadProgress: null,

      // ── Auth ──────────────────────────────────────────────────────────────

      login: async (username, password) => {
        const { serverUrl } = get();

        // 1. Ověříme dostupnost serveru a získáme skutečnou BASE_URL
        //    (může se lišit od toho co uživatel zadal, pokud je za proxy)
        let effectiveUrl = serverUrl;
        try {
          const info = await serverApi.getInfo(serverUrl);
          effectiveUrl = info.base_url;
          set({ serverUrl: effectiveUrl }); // aktualizujeme store s kanonickou URL
        } catch {
          // Server nedostupný nebo starší verze bez /server-info – pokračujeme s zadanou URL
        }

        configureApi(effectiveUrl, null);
        const { access_token, user } = await authApi.login({ username, password });
        setToken(access_token);
        audioService.setServerConfig(effectiveUrl, access_token);
        set({ user, token: access_token, isAuthenticated: true, serverUrl: effectiveUrl });

        // Uložíme token do Electron store pro persistenci mezi restarty
        window.electron?.store.set("authToken", access_token);
        window.electron?.store.set("serverUrl", effectiveUrl);

        get().connectWebSocket();
        await get().fetchSounds();
        audioService.cacheSoundsInBackground(get().sounds).catch(console.error);
      },

      register: async (username, email, password) => {
        const { serverUrl } = get();
        configureApi(serverUrl, null);
        await authApi.register({ username, email, password });
        // Po registraci přihlásíme
        await get().login(username, password);
      },

      logout: () => {
        soundboardWS.disconnect();
        setToken(null);
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          sounds: [],
          filteredSounds: [],
          isWsConnected: false,
        });
      },

      // ── Sounds ────────────────────────────────────────────────────────────

      fetchSounds: async (search, tag) => {
        set({ isLoadingSounds: true, soundsError: null });
        try {
          const response = await soundsApi.list({ per_page: 200, search, tag });
          const sounds = response.items;
          // Extrahujeme ID oblíbených ze serverové odpovědi
          const favoriteIds = new Set(
            sounds.filter((s) => s.is_favorite).map((s) => s.id)
          );
          set({
            sounds,
            filteredSounds: sounds,
            favoriteIds,
            isLoadingSounds: false,
          });

          // Cachujeme nové soubory na pozadí
          audioService.cacheSoundsInBackground(sounds).catch(console.error);
        } catch (err) {
          set({
            isLoadingSounds: false,
            soundsError: String(err),
          });
        }
      },

      uploadSound: async (file, name, description, tags) => {
        set({ uploadProgress: 0 });
        try {
          const sound = await soundsApi.upload(
            file,
            { name, description, tags },
            (percent) => set({ uploadProgress: percent })
          );
          // WS broadcast přidá zvuk automaticky u ostatních klientů
          // U nás ho přidáme rovnou
          get().addSoundFromWS(sound);
        } finally {
          set({ uploadProgress: null, isUploadDialogOpen: false });
        }
      },

      deleteSound: async (soundId) => {
        await soundsApi.delete(soundId);
        get().removeSoundFromWS(soundId);
      },

      toggleFavorite: async (soundId) => {
        const { favoriteIds } = get();
        const isFav = favoriteIds.has(soundId);
        // Optimistická aktualizace
        const next = new Set(favoriteIds);
        if (isFav) {
          next.delete(soundId);
        } else {
          next.add(soundId);
        }
        set({
          favoriteIds: next,
          sounds: get().sounds.map((s) =>
            s.id === soundId ? { ...s, is_favorite: !isFav } : s
          ),
          filteredSounds: get().filteredSounds.map((s) =>
            s.id === soundId ? { ...s, is_favorite: !isFav } : s
          ),
        });
        try {
          if (isFav) {
            await soundsApi.removeFavorite(soundId);
          } else {
            await soundsApi.addFavorite(soundId);
          }
        } catch (err) {
          // Rollback při chybě
          set({
            favoriteIds,
            sounds: get().sounds.map((s) =>
              s.id === soundId ? { ...s, is_favorite: isFav } : s
            ),
            filteredSounds: get().filteredSounds.map((s) =>
              s.id === soundId ? { ...s, is_favorite: isFav } : s
            ),
          });
          console.error("Oblíbené – chyba:", err);
        }
      },

      setActiveTag: (tag) => {
        set({ activeTag: tag });
      },

      playSound: async (sound) => {
        const { playingSoundIds, volume } = get();
        const newSet = new Set(playingSoundIds);
        newSet.add(sound.id);
        set({ playingSoundIds: newSet });

        try {
          await audioService.playSound(sound.id, sound.filename, sound.file_url, volume);
          await soundsApi.trackPlay(sound.id);
        } catch (err) {
          console.error("Přehrávání selhalo:", err);
        } finally {
          setTimeout(() => {
            const current = new Set(get().playingSoundIds);
            current.delete(sound.id);
            set({ playingSoundIds: current });
          }, (sound.duration_seconds || 3) * 1000);
        }
      },

      stopSound: (soundId) => {
        audioService.stopSound(soundId);
        const newSet = new Set(get().playingSoundIds);
        newSet.delete(soundId);
        set({ playingSoundIds: newSet });
      },

      // ── Settings ──────────────────────────────────────────────────────────

      setServerUrl: (url) => {
        const cleanUrl = url.replace(/\/$/, "");
        set({ serverUrl: cleanUrl });
        const { token } = get();
        configureApi(cleanUrl, token);
        audioService.setServerConfig(cleanUrl, token || "");

        // Odpojíme a znovu připojíme WS na novou URL
        soundboardWS.disconnect();
        if (token) {
          setTimeout(() => get().connectWebSocket(), 500); // krátká pauza pro čisté odpojení
        }

        // Uložíme do Electron store
        window.electron?.store.set("serverUrl", cleanUrl);
      },

      setAudioDevice: (deviceId) => {
        set({ audioDeviceId: deviceId });
        audioService.setOutputDevice(deviceId);
        window.electron?.audio.setDevice(deviceId);
      },

      setVolume: (volume) => {
        set({ volume });
        audioService.setVolume(volume);
      },

      loadAudioDevices: async () => {
        const devices = await audioService.getOutputDevices();
        set({ audioDevices: devices });
      },

      // ── Hotkeys ───────────────────────────────────────────────────────────

      registerHotkey: async (soundId, accelerator) => {
        const result = await window.electron?.hotkey.register(soundId, accelerator);
        if (result?.success) {
          set((state) => ({ hotkeys: { ...state.hotkeys, [soundId]: accelerator } }));
        } else {
          throw new Error(result?.error || "Registrace zkratky selhala.");
        }
      },

      unregisterHotkey: async (soundId) => {
        await window.electron?.hotkey.unregister(soundId);
        set((state) => {
          const hotkeys = { ...state.hotkeys };
          delete hotkeys[soundId];
          return { hotkeys };
        });
      },

      // ── WebSocket ─────────────────────────────────────────────────────────

      connectWebSocket: () => {
        const { serverUrl, token } = get();
        if (!token) return;

        soundboardWS.connect(serverUrl, token);

        soundboardWS.onConnectionChange((connected) => {
          set({ isWsConnected: connected });
        });

        soundboardWS.on("sound_added", (msg) => {
          get().addSoundFromWS(msg.data as unknown as Sound);
        });

        soundboardWS.on("sound_deleted", (msg) => {
          get().removeSoundFromWS((msg.data as any).id);
        });

        soundboardWS.on("sound_updated", (msg) => {
          get().updateSoundFromWS(msg.data as unknown as Sound);
        });
      },

      setWsConnected: (connected) => set({ isWsConnected: connected }),

      // ── UI helpers ────────────────────────────────────────────────────────

      setSearchQuery: (q) => {
        const { sounds } = get();
        const filtered = q
          ? sounds.filter(
              (s) =>
                s.name.toLowerCase().includes(q.toLowerCase()) ||
                s.tags.some((t) => t.toLowerCase().includes(q.toLowerCase()))
            )
          : sounds;
        set({ searchQuery: q, filteredSounds: filtered });
      },

      setUploadDialogOpen: (open) => set({ isUploadDialogOpen: open }),
      setSettingsOpen: (open) => set({ isSettingsOpen: open }),

      addSoundFromWS: (sound) => {
        set((state) => {
          if (state.sounds.find((s) => s.id === sound.id)) return state;
          const sounds = [sound, ...state.sounds];
          const q = state.searchQuery;
          const filteredSounds = q
            ? sounds.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()))
            : sounds;
          return { sounds, filteredSounds };
        });
        // Cache nový zvuk na pozadí
        audioService.cacheSound(sound.filename, sound.file_url).catch(console.error);
      },

      removeSoundFromWS: (soundId) => {
        set((state) => ({
          sounds: state.sounds.filter((s) => s.id !== soundId),
          filteredSounds: state.filteredSounds.filter((s) => s.id !== soundId),
        }));
      },

      updateSoundFromWS: (sound) => {
        set((state) => ({
          sounds: state.sounds.map((s) => (s.id === sound.id ? sound : s)),
          filteredSounds: state.filteredSounds.map((s) => (s.id === sound.id ? sound : s)),
        }));
      },
    }),
    {
      name: "cloudsoundboard-store",
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        serverUrl: state.serverUrl,
        audioDeviceId: state.audioDeviceId,
        volume: state.volume,
        hotkeys: state.hotkeys,
      }),
    }
  )
);

// Typování pro window.electron
declare global {
  interface Window {
    electron?: import("../../../main/preload").ElectronAPI;
  }
}