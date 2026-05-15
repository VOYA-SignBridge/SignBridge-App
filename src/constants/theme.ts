import { Platform } from 'react-native';

const tintColorLight = '#45C8C2';
const tintColorDark = '#45C8C2';

export const Colors = {
  light: {
    text: '#11181C',
    text2: '#45C8C2',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    primary: '#45C8C2',
    lightGray: '#E8E8E8',
    mediumGray: '#666666',
    darkGray: '#111111',
    white: '#FFFFFF',
    textInputBG: '#f0f0f0',
    controlBG: '#f9f9f9',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    avatarBG: '#9BA1A6',
    cardBG: '#F5F5F5',
    borderColor: '#E8E8E8',
  },
  dark: {
    text: '#ECEDEE',
    text2: '#ECEDEE',
    background: '#111111',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    primary: '#45C8C2',
    lightGray: '#2A2A2A',
    mediumGray: '#888888',
    darkGray: '#111111',
    white: '#FFFFFF',
    textInputBG: '#333333',
    controlBG: '#333333',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    avatarBG: '#555555',
    cardBG: '#1E1E1E',
    borderColor: '#555555',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
