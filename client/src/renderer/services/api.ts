/**
 * API Service – komunikace s FastAPI backendem.
 * Axios instance s interceptory pro automatické vložení JWT tokenu.
 */

import axios, { AxiosError, AxiosInstance } from "axios";
import type { Sound, SoundListResponse, User } from "../types";

// ── Axios instance ────────────────────────────────────────────────────────────

// Výchozí URL rovnou s vynuceným /api/v1
let _baseURL = "http://127.0.0.1:8000/api/v1";
let _token: string | null = null;

function createAxiosInstance(): AxiosInstance {
  const instance = axios.create({
    baseURL: _baseURL,
    timeout: 5000, // Zkráceno na 5 sekund
    headers: { 
      "Content-Type": "application/json",
      "Accept": "application/json",
      "ngrok-skip-browser-warning": "true" // Přidáno pro Ngrok tunel
    },
  });

  // Request interceptor – přidá Authorization header
  instance.interceptors.request.use((config) => {
    if (_token) {
      config.headers.Authorization = `Bearer ${_token}`;
    }
    return config;
  });

  // Response interceptor – normalizuje chyby
  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      const detail = (error.response?.data as any)?.detail;
      const message =
        typeof detail === "object" ? detail?.message : detail || error.message;
      return Promise.reject(new Error(message || "Neznámá chyba serveru."));
    }
  );

  return instance;
}

let _api = createAxiosInstance();

export function configureApi(serverUrl: string, token: string | null): void {
  // Očistíme URL od lomítek na konci a bezpečně přidáme /api/v1
  let cleanUrl = serverUrl.replace(/\/$/, "");
  if (!cleanUrl.endsWith("/api/v1")) {
    cleanUrl = `${cleanUrl}/api/v1`;
  }
  
  _baseURL = cleanUrl;
  _token = token;
  _api = createAxiosInstance();
  
  console.log("API překonfigurováno na:", _baseURL);
}

export function setToken(token: string | null): void {
  _token = token;
  _api = createAxiosInstance();
}

// ── Server info ───────────────────────────────────────────────────────────────

export const serverApi = {
  async getInfo(serverUrl: string): Promise<{ base_url: string; version: string; app_name: string }> {
    // Zavoláme bez tokenu – endpoint je veřejný
    const cleanUrl = serverUrl.replace(/\/$/, "");
    const res = await fetch(`${cleanUrl}/api/v1/server-info`, {
      headers: {
        "ngrok-skip-browser-warning": "true" // Přidáno pro Ngrok tunel
      }
    });
    if (!res.ok) throw new Error(`Server nedostupný: ${res.status}`);
    return res.json();
  },
};

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  async register(data: { username: string; email: string; password: string }): Promise<User> {
    // Cesty už jsou bez /api/v1, protože to řeší baseURL
    const res = await _api.post<User>("/auth/register", data);
    return res.data;
  },

  async login(data: { username: string; password: string }): Promise<{ access_token: string; user: User }> {
    const res = await _api.post<{ access_token: string; token_type: string; user: User }>(
      "/auth/login",
      data
    );
    return res.data;
  },
};

// ── Sounds ────────────────────────────────────────────────────────────────────

export const soundsApi = {
  async list(params?: {
    page?: number;
    per_page?: number;
    search?: string;
    tag?: string;
  }): Promise<SoundListResponse> {
    const res = await _api.get<SoundListResponse>("/sounds/", { params });
    return res.data;
  },
  // Přidej to kamkoliv dovnitř export const soundsApi = { ... }
  async searchOnline(query: string): Promise<{ results: { name: string; preview_url: string }[] }> {
    const res = await _api.get(`/sounds/search-online`, { params: { query } });
    return res.data;
  },
  async upload(
    file: File,
    metadata: { name: string; description?: string; tags?: string[] },
    onProgress?: (percent: number) => void
  ): Promise<Sound> {
    const form = new FormData();
    form.append("file", file);
    form.append("name", metadata.name);
    if (metadata.description) form.append("description", metadata.description);
    form.append("tags", (metadata.tags || []).join(","));

    const res = await _api.post<Sound>("/sounds/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (evt) => {
        if (evt.total && onProgress) {
          onProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      },
    });
    return res.data;
  },

  async delete(soundId: string): Promise<void> {
    await _api.delete(`/sounds/${soundId}`);
  },

  async update(soundId: string, data: { name?: string; description?: string; tags?: string[] }): Promise<Sound> {
    const res = await _api.patch<Sound>(`/sounds/${soundId}`, data);
    return res.data;
  },

  async trackPlay(soundId: string): Promise<void> {
    await _api.post(`/sounds/${soundId}/play`).catch(() => {}); // non-critical
  },

  async addFavorite(soundId: string): Promise<void> {
    await _api.post(`/sounds/${soundId}/favorite`);
  },

  async removeFavorite(soundId: string): Promise<void> {
    await _api.delete(`/sounds/${soundId}/favorite`);
  },

  async listFavorites(): Promise<Sound[]> {
    const res = await _api.get<Sound[]>("/sounds/favorites");
    return res.data;
  },

  getFileUrl(serverUrl: string, fileUrl: string): string {
    const base = serverUrl.replace(/\/$/, "");
    const path = fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`;
    return `${base}${path}`;
  },

  async downloadToCache(
    serverUrl: string,
    fileUrl: string,
    filename: string,
    cacheDir: string,
    token: string
  ): Promise<string> {
    const base = serverUrl.replace(/\/$/, "");
    const path = fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`;
    const fullUrl = `${base}${path}`;
    
    const response = await fetch(fullUrl, {
      headers: { 
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true" // Přidáno pro Ngrok tunel
      },
    });

    if (!response.ok) {
      throw new Error(`Stažení souboru selhalo: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    
    // Uložení přes Electron File API (renderer má přístup k fs přes preload)
    const blob = new Blob([buffer]);
    const url = URL.createObjectURL(blob);

    // Vrátíme blob URL pro okamžité přehrání
    return url;
  },
};