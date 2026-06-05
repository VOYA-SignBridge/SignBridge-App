import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ReactNativeBlobUtil from "react-native-blob-util";
import hotUpdate from "react-native-ota-hot-update";
import { API_GITHUB, current_OTA_version } from "@/config";

interface GithubRelease {
  url: string;
  id: number;
  tag_name: string;
  assets: {
    url: string;
    id: number;
    browser_download_url: string;
  }[];
  body: string;
}

const compareVersion = (v1: string, v2: string): number => {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const version1 = parse(v1);
  const version2 = parse(v2);
  const maxLength = Math.max(version1.length, version2.length);

  for (let i = 0; i < maxLength; i++) {
    const num1 = version1[i] || 0;
    const num2 = version2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
};

export const checkAndRunOTA = async (callbacks: {
  onChecking: () => void;
  onDownloading: (version: string) => void;
  onSuccess: () => void;
  onFail: (error: string) => void;
  onUpToDate: () => void;
}) => {
  try {
    callbacks.onChecking();
    const response = await fetch(API_GITHUB);
    if (!response.ok) throw new Error("Không thể kết nối đến máy chủ cập nhật.");

    const releases: GithubRelease[] = await response.json();
    if (!releases || releases.length === 0) {
      callbacks.onUpToDate();
      return;
    }

    const latestRelease = releases[0];
    let currentVersion = await AsyncStorage.getItem("ota-version");
    
    if (!currentVersion) {
      currentVersion = current_OTA_version;
      await AsyncStorage.setItem("ota-version", currentVersion);
    }

    if (compareVersion(latestRelease.tag_name, `v${currentVersion}`) > 0) {
      callbacks.onDownloading(latestRelease.tag_name);
      const bundleUrl = latestRelease.assets?.[0]?.browser_download_url || latestRelease.url;
      
      hotUpdate.downloadBundleUri(ReactNativeBlobUtil, bundleUrl, undefined, {
        updateSuccess: async () => {
          await AsyncStorage.setItem("ota-version", latestRelease.tag_name.replace(/^v/, ""));
          callbacks.onSuccess();
        },
        updateFail: (message: string) => {
          callbacks.onFail(message);
        },
        restartAfterInstall: true,
      });
    } else {
      callbacks.onUpToDate();
    }
  } catch (error: any) {
    callbacks.onFail(error.message || "Lỗi không xác định");
  }
};