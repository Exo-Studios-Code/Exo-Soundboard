/**
 * AudioBridge – neviditelná komponenta.
 * Naslouchá na IPC zprávy z main procesu pro přehrávání zvuků.
 * Přehrávání přes Web Audio API s výběrem výstupního zařízení.
 */

import { useEffect } from "react";
import { audioService } from "../../services/audioService";
import { useAppStore } from "../../stores/appStore";

export function AudioBridge() {
  const audioDeviceId = useAppStore((s) => s.audioDeviceId);
  const volume = useAppStore((s) => s.volume);

  useEffect(() => {
    audioService.setOutputDevice(audioDeviceId);
  }, [audioDeviceId]);

  useEffect(() => {
    audioService.setVolume(volume);
  }, [volume]);

  // Nasloucháme na play příkazy z main procesu (přes hotkeys)
  useEffect(() => {
    const offPlay = window.electron?.audio.onPlayInternal(async ({ filePath, deviceId, volume }) => {
      audioService.setOutputDevice(deviceId);
      await audioService.play("hotkey-play", filePath, volume).catch(console.error);
    });

    const offStop = window.electron?.audio.onStopAllInternal(() => {
      audioService.stopAll();
    });

    return () => {
      offPlay?.();
      offStop?.();
    };
  }, []);

  return null; // Tato komponenta nemá žádné UI
}
