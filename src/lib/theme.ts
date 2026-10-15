import { useColorScheme } from 'react-native';

const light = {
  bg: '#E9EDF2', card: '#FFFFFF', ink: '#18202E', muted: '#5D6778', line: '#D3D9E2',
  accent: '#FFCF33', accentInk: '#2A2100', blue: '#2F5BD3', good: '#1E8A55', bad: '#C2383A',
  goodSoft: '#DCF1E5', badSoft: '#F8DEDE', fire: '#F06A1D', dark: false,
};
const dark: typeof light = {
  bg: '#10141C', card: '#1A202B', ink: '#E8ECF2', muted: '#9AA4B4', line: '#2C3443',
  accent: '#F2C230', accentInk: '#231B00', blue: '#7C9DFF', good: '#4CC38A', bad: '#FF7A7C',
  goodSoft: '#173A2A', badSoft: '#45222A', fire: '#FF8A3D', dark: true,
};
export type Theme = typeof light;
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
