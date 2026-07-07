/**
 * SearchBar – vyhledávací lišta s tag-filtry.
 * Komunikuje se serverem přes searchService.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Search, X, Tag } from "lucide-react";
import { useAppStore } from "../../stores/appStore";

interface SearchBarProps {
  /** Dostupné tagy pro rychlé filtrování */
  availableTags?: string[];
  className?: string;
}

export function SearchBar({ availableTags = [], className = "" }: SearchBarProps) {
  const searchQuery = useAppStore((s) => s.searchQuery);
  const activeTag = useAppStore((s) => s.activeTag);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const setActiveTag = useAppStore((s) => s.setActiveTag);
  const fetchSounds = useAppStore((s) => s.fetchSounds);

  const [localQuery, setLocalQuery] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce vyhledávání – čekáme 300 ms po poslední změně
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (localQuery !== searchQuery) {
        setSearchQuery(localQuery);
        fetchSounds(localQuery || undefined, activeTag || undefined);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [localQuery]);

  // Synchronizujeme zvenku (např. při resetu)
  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  const handleTagClick = useCallback(
    (tag: string) => {
      const next = activeTag === tag ? null : tag;
      setActiveTag(next);
      fetchSounds(localQuery || undefined, next || undefined);
    },
    [activeTag, localQuery, setActiveTag, fetchSounds]
  );

  const handleClear = useCallback(() => {
    setLocalQuery("");
    setSearchQuery("");
    setActiveTag(null);
    fetchSounds();
  }, [setSearchQuery, setActiveTag, fetchSounds]);

  const hasFilter = localQuery.length > 0 || !!activeTag;

  return (
    <div className={`search-bar-wrapper ${className}`}>
      {/* Textový vstup */}
      <div className="search-input-row">
        <div className="search-input-container">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Hledat zvuky…"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") handleClear();
            }}
            aria-label="Vyhledat zvuky"
          />
          {hasFilter && (
            <button
              className="search-clear-btn"
              onClick={handleClear}
              title="Zrušit filtr"
              aria-label="Zrušit filtr"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Tag filtry */}
      {availableTags.length > 0 && (
        <div className="tag-filter-row">
          {availableTags.slice(0, 12).map((tag) => (
            <button
              key={tag}
              className={`tag-filter-chip ${activeTag === tag ? "tag-filter-chip--active" : ""}`}
              onClick={() => handleTagClick(tag)}
              title={`Filtrovat: ${tag}`}
            >
              <Tag size={9} />
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
