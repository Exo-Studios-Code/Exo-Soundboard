/**
 * SearchService – full-text vyhledávání a tag filtrování zvuků.
 * Obaluje soundsApi.list() s parametry query a tag.
 */
import { soundsApi } from "./api";
import type { SoundListResponse } from "../types";

export interface SearchParams {
  query?: string;
  tag?: string;
  page?: number;
  perPage?: number;
}

export const searchService = {
  /**
   * Vyhledá zvuky na serveru s volitelným full-text dotazem a/nebo tagem.
   */
  async search(params: SearchParams = {}): Promise<SoundListResponse> {
    return soundsApi.list({
      search: params.query || undefined,
      tag: params.tag || undefined,
      page: params.page ?? 1,
      per_page: params.perPage ?? 50,
    });
  },

  /**
   * Vrátí všechny unikátní tagy ze seznamu zvuků (client-side).
   */
  extractTags(sounds: { tags: string[] }[]): string[] {
    const tagSet = new Set<string>();
    for (const sound of sounds) {
      for (const tag of sound.tags) {
        if (tag) tagSet.add(tag.toLowerCase());
      }
    }
    return Array.from(tagSet).sort();
  },
};
