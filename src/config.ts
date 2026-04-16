import { Platform } from "react-native";
import Constants from "expo-constants";

const MY_PC_IP = "192.168.1.15";

function getLocalhost() {
  // Nếu là Android Emulator (Máy ảo Android Studio mặc định)
  if (Platform.OS === "android" && !Constants.isDevice) {
    return "10.0.2.2"; 
  }

  // Nếu là iOS Simulator
  if (Platform.OS === "ios" && !Constants.isDevice) {
    return "localhost";
  }

  // Nếu là Device thật (cả iOS và Android) chạy qua Expo Go
  // Logic này lấy IP của máy tính đang chạy Metro Bundler
  const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
  
  if (debuggerHost) {
    return debuggerHost.split(":").shift();
  }

  // Fallback nếu không tự detect được
  return MY_PC_IP;
}

const HOST = getLocalhost();

// Sử dụng dynamic HOST thay vì cứng
//export const API_URL = `http://${HOST}:8000/api/v1`;
//export const WS_BASE = `ws://${HOST}:8000/api/v1`;
export const API_URL = "https://se.cit.ctu.edu.vn/signbridge/api/v1"
export const WS_BASE = "wss://se.cit.ctu.edu.vn:8443/signbridge";
//export const API_URL = "https://signbridgeapi.tamdevx.id.vn/api/v1";
//export const WS_BASE = "wss://signbridgeapi.tamdevx.id.vn";