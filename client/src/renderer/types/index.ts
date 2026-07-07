export interface User {
  id: string;
  username: string;
  email: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

export interface Sound {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  duration_seconds: number | null;
  file_url: string;
  author_id: string;
  uploader_id: string;
  author: User;
  created_at: string;
  updated_at: string;
  play_count: number;
  is_favorite: boolean;
}

export interface SoundListResponse {
  items: Sound[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface AppSettings {
  serverUrl: string;
  audioDeviceId: string;
  volume: number;
}

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

export type WSEventType = "sound_added" | "sound_deleted" | "sound_updated" | "ping" | "connected";

export interface WSMessage {
  event: WSEventType;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface HotkeyMap {
  [soundId: string]: string; // soundId → accelerator
}

export type PlaybackStatus = "idle" | "playing" | "loading" | "error";

export interface SoundPlaybackState {
  soundId: string;
  status: PlaybackStatus;
}
