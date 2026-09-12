import { NativeModules, Platform } from 'react-native';

type QipedcVideoNativeModule = {
  getPlayableUrl: (remoteUrl: string) => Promise<string>;
};

const QIPEDC_HOST = 'qipedc.moet.gov.vn';

export async function resolveQipedcVideoUrl(remoteUrl: string): Promise<string> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(remoteUrl);
  } catch {
    throw new Error('URL video không hợp lệ.');
  }

  if (parsedUrl.hostname !== QIPEDC_HOST) return remoteUrl;
  if (Platform.OS !== 'android') {
    throw new Error('Bypass TLS QIPEDC hiện chỉ hỗ trợ Android.');
  }

  const module = NativeModules.QipedcVideo as QipedcVideoNativeModule | undefined;
  if (!module?.getPlayableUrl) {
    throw new Error('Cần build lại ứng dụng Android để kích hoạt bộ tải video QIPEDC.');
  }

  return module.getPlayableUrl(remoteUrl);
}
