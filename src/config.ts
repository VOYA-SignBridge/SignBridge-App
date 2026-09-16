export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  'https://se.cit.ctu.edu.vn/signbridge/api/v1';

export const WS_BASE =
  process.env.EXPO_PUBLIC_WS_BASE ??
  'wss://se.cit.ctu.edu.vn/signbridge';

// Temporarily hidden for the demo. Set true to restore sentence building and its UI.
export const SENTENCE_BUILDING_AVAILABLE = false;
