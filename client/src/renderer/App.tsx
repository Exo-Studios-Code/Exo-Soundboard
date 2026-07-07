/**
 * App.tsx – aktualizace pro Setup Wizard
 * 
 * Přidán stav firstRun: zobrazí SetupWizard pokud:
 *   - electron store neobsahuje "setupCompleted: true", NEBO
 *   - uživatel není přihlášen
 * 
 * NAHRAĎ celý obsah src/renderer/App.tsx tímto:
 */

import React, { useEffect, useState } from "react";
import { useAppStore } from "./stores/appStore";
import { LoginPage } from "./components/layout/LoginPage";
import { MainLayout } from "./components/layout/MainLayout";
import { AudioBridge } from "./components/soundboard/AudioBridge";
import { SetupWizard } from "./components/layout/SetupWizard";

export default function App() {
  const { isAuthenticated, token, serverUrl, connectWebSocket, fetchSounds, loadAudioDevices } =
    useAppStore();
  
  const [showSetup, setShowSetup] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    // Zkontrolujeme zda byl setup dokončen
    const checkSetup = async () => {
      const completed = await window.electron?.store.get("setupCompleted");
      setShowSetup(!completed);
    };
    checkSetup();
  }, []);

  // Při rehydrataci ze store obnovíme připojení
  useEffect(() => {
    if (isAuthenticated && token) {
      import("./services/api").then(({ configureApi }) => configureApi(serverUrl, token));
      import("./services/audioService").then(({ audioService }) =>
        audioService.setServerConfig(serverUrl, token)
      );
      connectWebSocket();
      fetchSounds();
      loadAudioDevices();
      window.electron?.hotkey.getAll().then((hotkeys) => {
        useAppStore.setState({ hotkeys });
      });
    }
  }, []); // eslint-disable-line

  // Nasloucháme na hotkey triggery z main procesu
  useEffect(() => {
    const off = window.electron?.hotkey.onTriggered((soundId) => {
      const { sounds, playSound } = useAppStore.getState();
      const sound = sounds.find((s) => s.id === soundId);
      if (sound) playSound(sound);
    });
    return () => off?.();
  }, []);

  // Loading state
  if (showSetup === null) {
    return <div style={{ background: "#0d0d0f", width: "100vw", height: "100vh" }} />;
  }

  return (
    <>
      <AudioBridge />
      
      {/* Setup Wizard při prvním spuštění */}
      {showSetup && (
        <SetupWizard onComplete={() => setShowSetup(false)} />
      )}
      
      {/* Hlavní aplikace */}
      {!showSetup && (
        isAuthenticated ? <MainLayout /> : <LoginPage />
      )}
    </>
  );
}
