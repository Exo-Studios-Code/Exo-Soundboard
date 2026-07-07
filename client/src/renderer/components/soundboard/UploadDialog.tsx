import React, { useState, useRef, useCallback, useEffect } from "react";
import { X, Upload, Music, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useAppStore } from "../../stores/appStore";

type UploadStatus = "idle" | "uploading" | "success" | "error";

export function UploadDialog() {
  const setUploadDialogOpen = useAppStore((s) => s.setUploadDialogOpen);
  const uploadSound = useAppStore((s) => s.uploadSound);
  const uploadProgress = useAppStore((s) => s.uploadProgress);

  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isUploading = status === "uploading";

  // Auto-fill name z názvu souboru
  useEffect(() => {
    if (files.length > 0 && !name) {
      const stem = files[0].name.replace(/\.[^.]+$/, "");
      setName(stem.replace(/[-_]/g, " "));
    }
  }, [files]);

  const handleFiles = useCallback((incoming: FileList | File[]) => {
    const audio = Array.from(incoming).filter((f) => f.type.startsWith("audio/"));
    if (audio.length === 0) {
      setError("Vyberte prosím audio soubory (.mp3, .wav, .ogg, .flac)");
      return;
    }
    setFiles(audio.slice(0, 1)); // Jeden soubor najednou
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files[0] || !name.trim()) return;

    setStatus("uploading");
    setError(null);

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      await uploadSound(files[0], name.trim(), description.trim() || undefined, tags);
      setStatus("success");
      setTimeout(() => setUploadDialogOpen(false), 1200);
    } catch (err) {
      setStatus("error");
      setError(String(err));
    }
  };

  // OPRAVENÁ FUNKCE: Už jen programově klikne na input a zabrání zdvojování událostí
  const handleBrowse = (e: React.MouseEvent) => {
    // Zabráníme prokliknutí, pokud už uživatel klikl přímo na ikonku odebrání
    e.stopPropagation();
    if (!files[0]) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="dialog-overlay" onClick={() => !isUploading && setUploadDialogOpen(false)}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="dialog-header">
          <h2 className="dialog-title">
            <Music size={18} />
            Přidat zvuk
          </h2>
          <button
            type="button"
            className="btn btn-ghost icon-btn"
            onClick={() => !isUploading && setUploadDialogOpen(false)}
            disabled={isUploading}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="dialog-body">
          {/* Drop zone */}
          <div
            className={`dropzone ${isDragging ? "dropzone--active" : ""} ${files[0] ? "dropzone--has-file" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={handleBrowse}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />

            {files[0] ? (
              <div className="dropzone-file">
                <Music size={24} className="dropzone-file-icon" />
                <div>
                  <p className="dropzone-filename">{files[0].name}</p>
                  <p className="dropzone-filesize">{formatBytes(files[0].size)}</p>
                </div>
                <button
                  type="button"
                  className="dropzone-remove"
                  onClick={(e) => { e.stopPropagation(); setFiles([]); setName(""); }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="dropzone-empty">
                <Upload size={28} className="dropzone-icon" />
                <p className="dropzone-label">Přetáhněte soubor nebo klikněte</p>
                <p className="dropzone-hint">MP3, WAV, OGG, FLAC · Max 50 MB</p>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="form-group">
            <label className="form-label" htmlFor="sound-name">
              Název <span className="required">*</span>
            </label>
            <input
              id="sound-name"
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Název zvuku"
              maxLength={128}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="sound-desc">Popis</label>
            <input
              id="sound-desc"
              type="text"
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Volitelný popis"
              maxLength={512}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="sound-tags">
              Tagy
              <span className="form-hint">oddělené čárkou</span>
            </label>
            <input
              id="sound-tags"
              type="text"
              className="form-input"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="meme, reaction, funny"
            />
          </div>

          {/* Progress */}
          {isUploading && uploadProgress !== null && (
            <div className="upload-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <span className="progress-label">{uploadProgress}%</span>
            </div>
          )}

          {/* Status */}
          {status === "success" && (
            <div className="form-status form-status--success">
              <CheckCircle size={16} />
              Zvuk úspěšně nahrán!
            </div>
          )}

          {error && (
            <div className="form-status form-status--error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="dialog-footer">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setUploadDialogOpen(false)}
              disabled={isUploading}
            >
              Zrušit
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!files[0] || !name.trim() || isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 size={15} className="spin" />
                  Nahrávám…
                </>
              ) : (
                <>
                  <Upload size={15} />
                  Nahrát
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}