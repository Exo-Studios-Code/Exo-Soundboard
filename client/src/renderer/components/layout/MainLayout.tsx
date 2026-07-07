import React from "react";
import { TitleBar } from "./TitleBar";
import { TopBar } from "./TopBar";
import { SoundGrid } from "../soundboard/SoundGrid";
import { UploadDialog } from "../soundboard/UploadDialog";
import { SettingsPanel } from "../settings/SettingsPanel";
import { useAppStore } from "../../stores/appStore";

export function MainLayout() {
  const isUploadDialogOpen = useAppStore((s) => s.isUploadDialogOpen);
  const isSettingsOpen = useAppStore((s) => s.isSettingsOpen);

  return (
    <div className="app-shell">
      <TitleBar />
      <TopBar />
      <main className="content-area">
        <SoundGrid />
      </main>

      {isUploadDialogOpen && <UploadDialog />}
      {isSettingsOpen && <SettingsPanel />}
    </div>
  );
}
