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
    lightGray: '#E8E8E8', 
    mediumGray: '#666666', 
    darkGray: '#111111',     
    white: '#FFFFFF',
    textInputBG: '#333333', 
    controlBG: '#333333',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
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
