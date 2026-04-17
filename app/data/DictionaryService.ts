import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDictionaryStore } from './useDictionaryStore';
import { API_URL } from '../../src/config';

export const syncDictionary = async (region: string) => {
  console.log(`\n=== BẮT ĐẦU ĐỒNG BỘ [Vùng: ${region}] ===`);
  const VERSION_KEY = `@dict_version_${region}`;
  const FILE_URI = FileSystem.documentDirectory + `dictionary_${region}.json`;
  let dictionaryData = {};

  try {
    const localVersionStr = await AsyncStorage.getItem(VERSION_KEY);
    const localVersion = localVersionStr ? parseInt(localVersionStr) : 0;
    console.log(`[1] Phiên bản máy hiện tại: ${localVersion}`);

    const checkVersionUrl = `${API_URL}/admin/check-version/${region}`;
    console.log(`[2] Đang gọi API: ${checkVersionUrl}`);
    
    const response = await fetch(checkVersionUrl);
    
    if (response.ok) {
      const server = await response.json();
      console.log(`[2] Server trả về latest_version: ${server.latest_version}`);

      if (server.latest_version > localVersion || localVersion === 0) {
        console.log(`[3] PHÁT HIỆN BẢN MỚI. Đang tải từ: ${server.download_url}`);
        
        const downloadRes = await FileSystem.downloadAsync(server.download_url, FILE_URI);
        
        if (downloadRes.status === 200) {
          console.log(`[3] Tải file thành công!`);
          await AsyncStorage.setItem(VERSION_KEY, server.latest_version.toString());
        }
      } else {
        console.log(`[3] Dữ liệu đã là bản mới nhất.`);
      }
    } else {
      console.log(`[2] LỖI: Server trả về status ${response.status}`);
    }
  } catch (error) {
    console.log(`Lỗi mạng/Hệ thống: ${error.message}`);
  } finally {
    try {
      const fileInfo = await FileSystem.getInfoAsync(FILE_URI);
      if (fileInfo.exists) {
        const jsonString = await FileSystem.readAsStringAsync(FILE_URI);
        const parsed = JSON.parse(jsonString);
        dictionaryData = parsed.data || parsed; 
        console.log(`[5] Nạp thành công ${Object.keys(dictionaryData).length} từ lên RAM.`);
      }
    } catch (e) {
      console.log(`[5] Lỗi đọc file JSON: ${e.message}`);
    }
    
    useDictionaryStore.getState().setDictionary(dictionaryData);
    console.log(`=== ĐỒNG BỘ HOÀN TẤT ===\n`);
  }
};