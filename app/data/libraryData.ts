import alphabetPublicIds from './alphabetVideoPublicIds.json';
import { MOET_DATA } from './dictionaryData';
import { getAlphabetVideoUrl } from '../utils/CloudinaryHelper';

export const VIETNAMESE_ALPHABET = [
  'A', 'Ă', 'Â', 'B', 'C', 'D', 'Đ', 'E', 'Ê', 'G',
  'H', 'I', 'K', 'L', 'M', 'N', 'O', 'Ô', 'Ơ', 'P',
  'Q', 'R', 'S', 'T', 'U', 'Ư', 'V', 'X', 'Y',
] as const;

export type VietnameseLetter = typeof VIETNAMESE_ALPHABET[number];
export type LibraryCategory = 'vocabulary' | 'alphabet';
export type RegionFilter = 'Tất cả' | 'Bắc' | 'Trung' | 'Nam' | 'Chung';
export type SortOrder = 'AZ' | 'ZA';
export type LibraryItem = { id: string; word: string; videoUrl: string | null };

const publicIds: Record<VietnameseLetter, string | null> = alphabetPublicIds;
export const ALPHABET_LIBRARY: LibraryItem[] = VIETNAMESE_ALPHABET.map(letter => ({
  id: `alphabet-${letter}`,
  word: letter,
  videoUrl: getAlphabetVideoUrl(publicIds[letter]),
}));

// Sort vocabulary once, rather than sorting thousands of entries on every keystroke.
const VOCABULARY_AZ: LibraryItem[] = [...MOET_DATA].sort((a, b) => a.word.localeCompare(b.word, 'vi'));

export function getRegionCode(id: string): RegionFilter {
  const suffix = id.slice(-1).toUpperCase();
  if (suffix === 'B') return 'Bắc';
  if (suffix === 'N') return 'Nam';
  if (suffix === 'T') return 'Trung';
  return 'Chung';
}

function normalizeVocabularySearch(value: string): string {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

export function filterLibraryItems(
  category: LibraryCategory,
  searchQuery: string,
  region: RegionFilter,
  sortOrder: SortOrder,
): LibraryItem[] {
  const query = category === 'alphabet'
    ? searchQuery.trim().normalize('NFC').toLowerCase()
    : normalizeVocabularySearch(searchQuery);
  const source = category === 'alphabet' ? ALPHABET_LIBRARY : VOCABULARY_AZ;
  const result = source.filter(item => {
    const name = category === 'alphabet' ? item.word.toLowerCase() : normalizeVocabularySearch(item.word);
    return (!query || name.includes(query)) &&
      (category === 'alphabet' || region === 'Tất cả' || getRegionCode(item.id) === region);
  });
  // Alphabet follows the explicit Vietnamese order, keeping A, Ă and Â distinct.
  return sortOrder === 'ZA' ? result.reverse() : result;
}
