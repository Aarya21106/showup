export interface ThemeColors {
  bgMain: string;
  bgCard: string;
  bgCardElevated: string;
  bgInput: string;
  bgGlass: string;
  bgGlassLight: string;

  border: string;
  borderLight: string;
  borderGlow: string;

  primary: string;
  primaryBright: string;
  primarySubtle: string;

  azure: string;
  azureSubtle: string;
  coral: string;
  coralSubtle: string;
  amber: string;
  amberSubtle: string;

  text: string;
  textSecondary: string;
  textMuted: string;
  textDim: string;

  userBubbleBg: string;
  userBubbleBorder: string;
  userBubbleText: string;
  botBubbleBg: string;
  botBubbleBorder: string;

  online: string;
  offline: string;
  tickActive: string;
  tickSent: string;
}

// Apple-clean light theme — white/off-white surfaces, near-black ink, iMessage-style
// solid accent bubbles.
export const LightColors: ThemeColors = {
  bgMain: '#F5F5F7',
  bgCard: '#FFFFFF',
  bgCardElevated: '#F0F0F2',
  bgInput: '#F0F0F2',
  bgGlass: 'rgba(255, 255, 255, 0.92)',
  bgGlassLight: 'rgba(240, 240, 242, 0.7)',

  border: '#E5E5E7',
  borderLight: 'rgba(0, 0, 0, 0.06)',
  borderGlow: 'rgba(16, 185, 129, 0.25)',

  primary: '#10B981',
  primaryBright: '#0EA371',
  primarySubtle: 'rgba(16, 185, 129, 0.10)',

  azure: '#0A84FF',
  azureSubtle: 'rgba(10, 132, 255, 0.10)',
  coral: '#FF3B30',
  coralSubtle: 'rgba(255, 59, 48, 0.10)',
  amber: '#FF9500',
  amberSubtle: 'rgba(255, 149, 0, 0.10)',

  text: '#111113',
  textSecondary: '#3A3A3C',
  textMuted: '#8E8E93',
  textDim: '#C7C7CC',

  userBubbleBg: '#10B981',
  userBubbleBorder: '#10B981',
  userBubbleText: '#FFFFFF',
  botBubbleBg: '#FFFFFF',
  botBubbleBorder: '#FFFFFF',

  online: '#30D158',
  offline: '#FF3B30',
  tickActive: '#FFFFFF',
  tickSent: 'rgba(255, 255, 255, 0.65)',
};

// Apple Fitness-style dark theme — true black, elevated dark-gray cards, glowing accent.
export const DarkColors: ThemeColors = {
  bgMain: '#000000',
  bgCard: '#1C1C1E',
  bgCardElevated: '#2C2C2E',
  bgInput: '#1C1C1E',
  bgGlass: 'rgba(10, 10, 10, 0.85)',
  bgGlassLight: 'rgba(28, 28, 30, 0.7)',

  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.12)',
  borderGlow: 'rgba(52, 211, 153, 0.35)',

  primary: '#34D399',
  primaryBright: '#5EEAB0',
  primarySubtle: 'rgba(52, 211, 153, 0.15)',

  azure: '#0A84FF',
  azureSubtle: 'rgba(10, 132, 255, 0.15)',
  coral: '#FF453A',
  coralSubtle: 'rgba(255, 69, 58, 0.15)',
  amber: '#FF9F0A',
  amberSubtle: 'rgba(255, 159, 10, 0.15)',

  text: '#FFFFFF',
  textSecondary: '#C7C7CC',
  textMuted: '#8E8E93',
  textDim: '#636366',

  userBubbleBg: '#34D399',
  userBubbleBorder: '#34D399',
  userBubbleText: '#04170D',
  botBubbleBg: '#1C1C1E',
  botBubbleBorder: '#1C1C1E',

  online: '#30D158',
  offline: '#FF453A',
  tickActive: '#04170D',
  tickSent: 'rgba(4, 23, 13, 0.55)',
};

// Kept as the default export name so any lingering static import still resolves
// to a sensible palette — but every screen/component should use useTheme() instead.
export const Colors = LightColors;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const BorderRadius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 22,
  full: 9999,
};
