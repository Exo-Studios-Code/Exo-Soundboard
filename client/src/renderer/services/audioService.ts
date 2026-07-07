/**
 * AudioService – přehrávání zvuků přes Web Audio API.
 *
 * DUAL-ROUTING: Přehrává zvuk do virtuálního kabelu pro Discord
 * a zároveň do výchozích sluchátek.
 *
 * OPRAVY:
 * - cacheSound přidává ngrok-skip-browser-warning header (jinak Ngrok vrátí
 *   HTML warning page místo MP3 → net::ERR_FAILED 200 / CORS chyba)
 * - playSound ověřuje platnost fileUrl před sestavením URL
 * - play() má explicitní guard před každým .push() voláním
 * - cacheSound používá blob URL místo přímé URL v <audio>, čímž obchází
 *   problém s chybějícími hlavičkami v browser audio requestech
 */

export interface AudioDevice {
  deviceId: string;
  label: string;
}

// Hlavičky potřebné pro Ngrok tunel (zabraňují zobrazení HTML interstitial stránky)
const NGROK_HEADERS: Record<string, string> = {
  "ngrok-skip-browser-warning": "true",
};

class AudioService {
  private _outputDeviceId: string = "default";
  private _volume: number = 1.0;
  private _activeAudios: Map<string, HTMLAudioElement[]> = new Map();
  private _serverUrl: string = "http://127.0.0.1:8000";
  private _token: string = "";

  setServerConfig(serverUrl: string, token: string): void {
    this._serverUrl = serverUrl.replace(/\/$/, ""); // odstraníme trailing slash
    this._token = token;
  }

  setOutputDevice(deviceId: string): void {
    this._outputDeviceId = deviceId;
  }

  setVolume(volume: number): void {
    this._volume = Math.max(0, Math.min(1, volume));
  }

  // ── Získání audio zařízení ────────────────────────────────────────────────

  async getOutputDevices(): Promise<AudioDevice[]> {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {});
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === "audiooutput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Zařízení ${d.deviceId.substring(0, 8)}`,
        }));
    } catch (err) {
      console.error("Nelze načíst audio zařízení:", err);
      return [{ deviceId: "default", label: "Výchozí zařízení" }];
    }
  }

  // ── Přehrávání ────────────────────────────────────────────────────────────

  async play(
    soundId: string,
    audioSrc: string,
    volume: number = 1.0
  ): Promise<void> {
    if (!audioSrc) {
      console.error(`AudioService.play: chybí audioSrc pro zvuk ${soundId}`);
      return;
    }

    const computedVolume = Math.min(1, this._volume * volume);
    const audiosToPlay: HTMLAudioElement[] = [];

    // 1. Zvuková stopa pro Discord (do virtuálního kabelu)
    const primaryAudio = new Audio();
    primaryAudio.volume = computedVolume;
    primaryAudio.preload = "auto";
    if (this._outputDeviceId !== "default" && "setSinkId" in primaryAudio) {
      try {
        await (primaryAudio as any).setSinkId(this._outputDeviceId);
      } catch (err) {
        console.warn("setSinkId selhal, použije se výchozí zařízení:", err);
      }
    }
    primaryAudio.src = audioSrc;
    audiosToPlay.push(primaryAudio);

    // 2. Záloha do sluchátek (pokud je vybrán kabel)
    if (this._outputDeviceId !== "default") {
      const secondaryAudio = new Audio();
      secondaryAudio.volume = computedVolume;
      secondaryAudio.preload = "auto";
      secondaryAudio.src = audioSrc;
      audiosToPlay.push(secondaryAudio);
    }

    // Inicializujeme nebo zachováme existující pole pro tento zvuk
    if (!this._activeAudios.has(soundId)) {
      this._activeAudios.set(soundId, []);
    }

    const activeList = this._activeAudios.get(soundId);
    if (!activeList) {
      // Paranoidní guard – neměl by nastat, ale zabrání havárii
      console.error(`AudioService: _activeAudios.get(${soundId}) vrátil undefined po set()`);
      return;
    }

    for (const audio of audiosToPlay) {
      activeList.push(audio);

      audio.addEventListener("ended", () => {
        this._cleanup(soundId, audio);
      });

      audio.addEventListener("error", (e) => {
        console.error(`Chyba přehrávání zvuku ${soundId}:`, e);
        this._cleanup(soundId, audio);
      });

      await audio.play().catch((err) =>
        console.error(`Nelze přehrát zvuk ${soundId}:`, err)
      );
    }
  }

  /**
   * Přehraje zvuk podle ID a URL.
   * Pokud je zvuk v cache, použije blob URL (nevyžaduje auth ani Ngrok hlavičky).
   * Pokud není v cache, sestaví absolutní URL a přehraje přímo.
   */
  async playSound(
    soundId: string,
    filename: string,
    fileUrl: string,
    volume: number = 1.0
  ): Promise<void> {
    // Validace vstupů
    if (!filename || !fileUrl) {
      console.error(
        `AudioService.playSound: chybí filename nebo fileUrl pro zvuk ${soundId}`,
        { filename, fileUrl }
      );
      return;
    }

    // Přednost má cache – blob URL obchází všechny síťové problémy
    const cachedBlob = await this._getCachedBlob(filename);
    if (cachedBlob) {
      const blobUrl = URL.createObjectURL(cachedBlob);
      await this.play(soundId, blobUrl, volume);
      return;
    }

    // Pokus o přehrání přes síť
    // Pokud není v cache, zkusíme ji nejdříve stáhnout a pak přehrát z blob URL.
    // Tím se vyhneme problémům s CORS a Ngrok u <audio> elementu.
    try {
      await this.cacheSound(filename, fileUrl);
      const freshBlob = await this._getCachedBlob(filename);
      if (freshBlob) {
        const blobUrl = URL.createObjectURL(freshBlob);
        await this.play(soundId, blobUrl, volume);
        return;
      }
    } catch {
      // Cache selhala – fallback na přímou URL
    }

    // Poslední záchrana: přímá URL (může selhat kvůli CORS/auth, ale nevzdáváme se)
    const fullUrl = this._buildAbsoluteUrl(fileUrl);
    await this.play(soundId, fullUrl, volume);
  }

  stopSound(soundId: string): void {
    const audios = this._activeAudios.get(soundId) || [];
    audios.forEach((a) => {
      a.pause();
      if (a.src.startsWith("blob:")) {
        URL.revokeObjectURL(a.src);
      }
      a.src = "";
    });
    this._activeAudios.delete(soundId);
  }

  stopAll(): void {
    this._activeAudios.forEach((audios) => {
      audios.forEach((a) => {
        a.pause();
        if (a.src.startsWith("blob:")) {
          URL.revokeObjectURL(a.src);
        }
        a.src = "";
      });
    });
    this._activeAudios.clear();
  }

  isPlaying(soundId: string): boolean {
    return (this._activeAudios.get(soundId)?.length || 0) > 0;
  }

  // ── Cache management ──────────────────────────────────────────────────────

  private _cache: Map<string, Blob> = new Map();

  /**
   * Stáhne audio soubor a uloží ho do cache jako Blob.
   *
   * KLÍČOVÉ OPRAVY oproti původní verzi:
   * 1. Posíláme ngrok-skip-browser-warning hlavičku – jinak Ngrok vrátí
   *    HTML stránku (200 OK) místo MP3, což způsobí CORS/ERR_FAILED chybu.
   * 2. Ověřujeme MIME typ odpovědi – pokud server vrátí HTML (Ngrok warning),
   *    nepokusíme se ho uložit jako audio.
   */
  async cacheSound(filename: string, fileUrl: string): Promise<void> {
    if (!filename || !fileUrl) return;
    if (this._cache.has(filename)) return;

    const fullUrl = this._buildAbsoluteUrl(fileUrl);

    try {
      const headers: Record<string, string> = {
        ...NGROK_HEADERS,
      };

      // Přidáme auth token jen pro API endpointy (ne pro /files/ static mount)
      if (this._token && !fileUrl.startsWith("/files/")) {
        headers["Authorization"] = `Bearer ${this._token}`;
      }

      const response = await fetch(fullUrl, { headers });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Ověříme, že odpověď je skutečně audio – ne Ngrok HTML stránka
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/html")) {
        throw new Error(
          `Server vrátil HTML místo audia (${contentType}). ` +
          `Zkontrolujte Ngrok konfiguraci nebo CORS nastavení serveru.`
        );
      }

      const blob = await response.blob();

      // Sekundární kontrola – skutečná velikost a typ blob
      if (blob.size === 0) {
        throw new Error("Stažený soubor je prázdný.");
      }

      this._cache.set(filename, blob);
    } catch (err) {
      console.warn(`Nepodařilo se cachovat ${filename} (${fullUrl}):`, err);
      // Záměrně neháváme výjimku – cache je optimalizace, ne nutnost
    }
  }

  async cacheSoundsInBackground(
    sounds: Array<{ filename: string; file_url: string }>
  ): Promise<void> {
    if (!sounds || sounds.length === 0) return;

    const chunkSize = 3;
    for (let i = 0; i < sounds.length; i += chunkSize) {
      const chunk = sounds.slice(i, i + chunkSize);
      await Promise.allSettled(
        chunk
          .filter((s) => s?.filename && s?.file_url) // přeskočíme neplatné záznamy
          .map((s) => this.cacheSound(s.filename, s.file_url))
      );
    }
  }

  private async _getCachedBlob(filename: string): Promise<Blob | null> {
    return this._cache.get(filename) || null;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Sestaví absolutní URL ze serverUrl + relativní cesty.
   * Pokud fileUrl začíná http/https, vrátí ho beze změny (externích URL).
   */
  private _buildAbsoluteUrl(fileUrl: string): string {
    if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
      return fileUrl;
    }
    // Zajistíme, že mezi serverUrl a fileUrl je právě jedno lomítko
    const base = this._serverUrl.replace(/\/$/, "");
    const path = fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`;
    return `${base}${path}`;
  }

  private _cleanup(soundId: string, audio: HTMLAudioElement): void {
    const audios = this._activeAudios.get(soundId);
    if (!audios) return;

    const idx = audios.indexOf(audio);
    if (idx !== -1) audios.splice(idx, 1);

    if (audios.length === 0) {
      this._activeAudios.delete(soundId);
    }

    if (audio.src.startsWith("blob:")) {
      URL.revokeObjectURL(audio.src);
    }
  }
}

export const audioService = new AudioService();