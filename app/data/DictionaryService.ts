import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDictionaryStore } from './useDictionaryStore';
import { API_URL } from '../../src/config';

const getFilePath = (region: string) =>
  FileSystem.documentDirectory + `dictionary_${region}.json`;

const readLocalFile = async (filePath: string): Promise<Record<string, any>> => {
  const info = await FileSystem.getInfoAsync(filePath);
  if (!info.exists) return {};
  const json = await FileSystem.readAsStringAsync(filePath);
  const parsed = JSON.parse(json);
  return parsed.data || parsed;
};

// Reads whatever is already on disk and marks the store ready immediately.
export const loadLocalDictionary = async (region: string): Promise<void> => {
  const filePath = getFilePath(region);
  try {
    const data = await readLocalFile(filePath);
    useDictionaryStore.getState().setDictionary(data);
    console.log(`[Dict] Local: ${Object.keys(data).length} từ`);
  } catch {
    useDictionaryStore.getState().setDictionary({});
    console.log('[Dict] Đọc file cục bộ thất bại, dùng dict rỗng');
  }
};

// Fire-and-forget: compares versions, downloads if newer, then reloads the store.
export const syncInBackground = (region: string): void => {
  const VERSION_KEY = `@dict_version_${region}`;
  const filePath = getFilePath(region);

  (async () => {
    try {
      const localVersionStr = await AsyncStorage.getItem(VERSION_KEY);
      const localVersion = localVersionStr ? parseInt(localVersionStr, 10) : 0;

      const response = await fetch(`${API_URL}/admin/check-version/${region}`);
      if (!response.ok) return;
      const server = await response.json();

      if (server.latest_version <= localVersion && localVersion !== 0) {
        console.log('[Dict] Đã là bản mới nhất, không cần tải.');
        return;
      }

      console.log(`[Dict] Đang tải bản v${server.latest_version}...`);
      const downloadResult = await Promise.race([
        FileSystem.downloadAsync(server.download_url, filePath),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Download timeout')), 60_000)
        ),
      ]);

      if (downloadResult.status === 200) {
        await AsyncStorage.setItem(VERSION_KEY, server.latest_version.toString());
        const data = await readLocalFile(filePath);
        useDictionaryStore.getState().setDictionary(data);
        console.log(`[Dict] Cập nhật lên v${server.latest_version} thành công.`);
      }
    } catch (e: any) {
      console.log(`[Dict] Lỗi đồng bộ nền: ${e?.message}`);
    }
  })();
};

// Backward-compatible wrapper used by RegionSelection and account screen.
// Loads local dict immediately (fast path), then syncs in background.
export const syncDictionary = async (region: string): Promise<void> => {
  await loadLocalDictionary(region);
  syncInBackground(region);
};
