import type { Ionicons } from '@expo/vector-icons';

export const APP_LANGUAGES = [
  { label: 'Tiếng Việt', value: 'vi' },
  { label: 'English',    value: 'en' },
];

export const SIGN_LANGUAGES = [
  { label: 'Hòa Đê', value: 'hoa_de' },
  { label: 'VSL',    value: 'vsl'    },
];

export type RegionAccent = 'primary' | 'success';

export type RegionMeta = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  sub: string;
  color: RegionAccent;
};

export const REGION_META: Record<string, RegionMeta> = {
  hoa_de: {
    icon: 'location-outline',
    sub: 'Sóc Trăng, Việt Nam',
    color: 'primary',
  },
  vsl: {
    icon: 'hand-left-outline',
    sub: 'Ngôn ngữ ký hiệu chuẩn Việt Nam',
    color: 'success',
  },
};
