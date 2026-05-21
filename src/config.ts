const env = process.env;

function getRequiredEnv(key: keyof typeof env) {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export const API_URL = getRequiredEnv("EXPO_PUBLIC_API_URL");
export const WS_BASE = getRequiredEnv("EXPO_PUBLIC_WS_BASE");
