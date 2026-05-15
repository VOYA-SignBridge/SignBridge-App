import { create } from 'zustand';

interface DictionaryState {
  isReady: boolean;
  region: string | null;
  data: any;
  setRegion: (region: string) => void;
  setDictionary: (data: any) => void;
  findWord: (searchText: string) => string | null;
}

// Bỏ dấu tiếng Việt để so sánh không phân biệt dấu
const normalize = (str: string): string =>
  str.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd');

// Ưu tiên actor_male, fallback sang các variant khác nếu null
const pickVariant = (entry: any): string | null =>
  entry?.variants?.actor_male ||
  entry?.variants?.actor_female ||
  entry?.variants?.default ||
  null;

export const useDictionaryStore = create<DictionaryState>((set, get) => ({
  isReady: false,
  region: null,
  data: {},
  setRegion: (region) => set({ region }),
  setDictionary: (data) => set({ data, isReady: true }),
  findWord: (searchText) => {
    const { data } = get();
    const query = searchText.trim().toLowerCase();
    const queryNorm = normalize(query);

    // 1. Slug chuẩn hóa (không dấu) — ví dụ "xin chao" → "xin_chao"
    const slugNorm = queryNorm.replace(/\s+/g, '_');
    if (data[slugNorm]) return pickVariant(data[slugNorm]);

    // 2. Slug gốc (có dấu) — ví dụ "xin chào" → "xin_chào"
    const slugOrig = query.replace(/\s+/g, '_');
    if (data[slugOrig]) return pickVariant(data[slugOrig]);

    // 3. So sánh trường word, normalize cả hai phía
    for (const key in data) {
      const wordNorm = normalize(data[key].word?.toLowerCase() ?? '');
      if (wordNorm === queryNorm) return pickVariant(data[key]);
    }

    // 4. So sánh trường word chính xác (giữ nguyên dấu)
    for (const key in data) {
      if (data[key].word?.toLowerCase() === query) return pickVariant(data[key]);
    }

    return null;
  },
}));