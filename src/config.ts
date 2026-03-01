import { Platform } from "react-native";
import Constants from "expo-constants";

function getLocalhost() {
  if (Platform.OS === "web") return "localhost";

  // iOS simulator
  if (Platform.OS === "ios" && Constants.appOwnership === "expo") {
    const isDevice = Constants.isDevice;
    if (!isDevice) return "10.13.129.186"; // simulator
  }

  // Android emulator
  if (Platform.OS === "android") return "10.13.129.186";

  // iOS device thật + Android device thật → dùng LAN IP
  const debuggerHost =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost;

  if (!debuggerHost) return "10.13.129.186"; // fallback LAN IP

  return debuggerHost.split(":").shift();
}


const HOST = getLocalhost();
// export const API_URL = `http://${HOST}:8000`;
export const API_URL = "https://voya-signbridge-backend.fly.dev"
//  export const API_URL="http://192.168.1.13:8000"
