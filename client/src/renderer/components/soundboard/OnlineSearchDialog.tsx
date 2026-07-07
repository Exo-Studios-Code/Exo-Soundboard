import React, { useState } from "react";
import { Search, Download, Play, X, Loader2 } from "lucide-react";
import { soundsApi } from "../../services/api";
import { useAppStore } from "../../stores/appStore";

interface OnlineSearchDialogProps {
  onClose: () => void;
}

interface SearchResult {
  name: string;
  preview_url: string;
}

export function OnlineSearchDialog({ onClose }: OnlineSearchDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  
  // Získáme funkci na obnovení seznamu zvuků z globálního storu
  const fetchSounds = useAppStore((s) => s.fetchSounds);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const data = await soundsApi.searchOnline(query);
      setResults(data.results);
    } catch (err) {
      console.error("Chyba při vyhledávání:", err);
      alert("Nepodařilo se prohledat databázi.");
    } finally {
      setIsSearching(false);
    }
  };

  const handlePreview = (url: string) => {
    // Rychlý náhled zvuku přímo z URL Myinstants
    const audio = new Audio(url);
    audio.volume = 0.5;
    audio.play().catch(console.error);
  };

  const handleDownload = async (result: SearchResult) => {
    setDownloadingUrl(result.preview_url);
    try {
      // 1. Stáhneme MP3 soubor z Myinstants do paměti prohlížeče
      const response = await fetch(result.preview_url);
      const blob = await response.blob();
      
      // 2. Vytvoříme z něj standardní File objekt, jako bys ho vybral z disku
      const file = new File([blob], `${result.name}.mp3`, { type: "audio/mpeg" });
      
      // 3. Nahrajeme ho přes tvoje stávající API do databáze
      await soundsApi.upload(file, { 
        name: result.name, 
        tags: ["myinstants"] // Automaticky mu dáme tag
      });

      // 4. Aktualizujeme plochu, aby se tam nový zvuk hned objevil
      await fetchSounds();
      
      alert(`Zvuk "${result.name}" byl úspěšně přidán!`);
    } catch (err) {
      console.error("Chyba při stahování:", err);
      alert("Něco se pokazilo při stahování zvuku. Možná blokace prohlížečem (CORS).");
    } finally {
      setDownloadingUrl(null);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose} style={overlayStyle}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()} style={contentStyle}>
        <div style={headerStyle}>
          <h2>Hledat na Myinstants</h2>
          <button onClick={onClose} style={iconBtnStyle}><X size={20} /></button>
        </div>

        <form onSubmit={handleSearch} style={formStyle}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Napiš hlášku (např. bruh, csgo...)"
            style={inputStyle}
            autoFocus
          />
          <button type="submit" disabled={isSearching} style={btnStyle}>
            {isSearching ? <Loader2 size={18} className="spin" /> : <Search size={18} />}
          </button>
        </form>

        <div style={resultsStyle}>
          {results.length === 0 && !isSearching && (
            <p style={{ textAlign: "center", color: "#888" }}>Zatím žádné výsledky...</p>
          )}
          
          {results.map((res, idx) => (
            <div key={idx} style={resultItemStyle}>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {res.name}
              </span>
              
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => handlePreview(res.preview_url)} style={iconBtnStyle} title="Přehrát náhled">
                  <Play size={18} />
                </button>
                <button 
                  onClick={() => handleDownload(res)} 
                  disabled={downloadingUrl === res.preview_url}
                  style={{...iconBtnStyle, color: "#06d6a0"}}
                  title="Stáhnout a přidat"
                >
                  {downloadingUrl === res.preview_url ? <Loader2 size={18} className="spin" /> : <Download size={18} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Rychlé inline styly (abychom nemuseli řešit CSS soubory) ──
const overlayStyle: React.CSSProperties = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const contentStyle: React.CSSProperties = { backgroundColor: "#1e1e24", padding: "20px", borderRadius: "8px", width: "400px", maxWidth: "90%", display: "flex", flexDirection: "column", gap: "15px", color: "white" };
const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", margin: 0 };
const formStyle: React.CSSProperties = { display: "flex", gap: "10px" };
const inputStyle: React.CSSProperties = { flex: 1, padding: "10px", borderRadius: "4px", border: "1px solid #333", backgroundColor: "#2b2b36", color: "white", outline: "none" };
const btnStyle: React.CSSProperties = { padding: "10px 15px", borderRadius: "4px", border: "none", backgroundColor: "#e05c4b", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
const resultsStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "10px", maxHeight: "300px", overflowY: "auto", paddingRight: "5px" };
const resultItemStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#2b2b36", padding: "10px", borderRadius: "4px" };
const iconBtnStyle: React.CSSProperties = { background: "none", border: "none", color: "#aaa", cursor: "pointer", display: "flex", alignItems: "center" };