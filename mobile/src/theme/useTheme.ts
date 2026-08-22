import { useColorScheme } from 'react-native';
import { LightColors, DarkColors, ThemeColors } from './colors';

// Follows the device's system appearance, same as native Apple apps — no manual
// toggle needed. Falls back to light when the OS reports no preference.
export function useTheme(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? DarkColors : LightColors;
}
