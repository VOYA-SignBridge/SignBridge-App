import { create } from 'zustand';

interface DictionaryState {
  isReady: boolean;
  region: string | null;
  data: any;
  setRegion: (region: string) => void;
  setDictionary: (data: any) => void;
  findWord: (searchText: string) => string | null;
}

export const useDictionaryStore = create<DictionaryState>((set, get) => ({
  isReady: false,
  region: null,
  data: {},
  setRegion: (region) => set({ region }),
  setDictionary: (data) => set({ data, isReady: true }),
  findWord: (searchText) => {
    const { data } = get();
    const query = searchText.trim().toLowerCase();
    const slug = query.replace(/\s+/g, '_');
    if (data[slug]) return data[slug].variants?.actor_male || null;

    for (const key in data) {
      if (data[key].word?.toLowerCase() === query) return data[key].variants?.actor_male || null;
    }
    return null;
  }
}));