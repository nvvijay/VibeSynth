export interface Theme {
  isDark: boolean;
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  border: string;
  text: string;
  textMuted: string;
  textHeading: string;
  canvasBg: string;
  canvasDot: string;
  cardBg: string;
  inputBg: string;
  inputBorder: string;
  accent: string;
}

export const lightTheme: Theme = {
  isDark: false,
  bg: '#FFF5EE',
  bgSecondary: '#FFF8F0',
  bgTertiary: '#FEFAF6',
  border: '#F0E6DD',
  text: '#6B5B7B',
  textMuted: '#A89AAF',
  textHeading: '#7A6B8A',
  canvasBg: '#FFF9F5',
  canvasDot: '#f0e6df',
  cardBg: '#FFF8F0',
  inputBg: '#FFF8F0',
  inputBorder: '#E0D5CC',
  accent: '#C4A8E0',
};

export const darkTheme: Theme = {
  isDark: true,
  bg: '#1a1a2e',
  bgSecondary: '#1e1e34',
  bgTertiary: '#22223a',
  border: '#2e2e4a',
  text: '#c4b8d4',
  textMuted: '#8878a0',
  textHeading: '#d4c4e8',
  canvasBg: '#16162a',
  canvasDot: '#2a2a44',
  cardBg: '#22223a',
  inputBg: '#1e1e34',
  inputBorder: '#3a3a5a',
  accent: '#C4A8E0',
};

// Dark mode overrides for category colors used in nodes/palette
export const darkCategoryColors: Record<string, { bg: string; header: string; text: string; port: string }> = {
  source:    { bg: '#2a1f1f', header: '#8B4A42', text: '#FFB5A7', port: '#FF9A8B' },
  effect:    { bg: '#2a2818', header: '#8A7A3A', text: '#F5E6A3', port: '#F0D86E' },
  modulator: { bg: '#221e2e', header: '#5A4A6E', text: '#D4C4E8', port: '#C4A8E0' },
  utility:   { bg: '#1a2a22', header: '#3A6A52', text: '#B5EAD7', port: '#8DD4B8' },
};

export const darkPaletteCategoryColors: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  source:    { bg: '#2a1f1f', border: '#8B4A42', text: '#FFB5A7', accent: '#FF9A8B' },
  effect:    { bg: '#2a2818', border: '#8A7A3A', text: '#F5E6A3', accent: '#F0D86E' },
  modulator: { bg: '#221e2e', border: '#5A4A6E', text: '#D4C4E8', accent: '#C4A8E0' },
  utility:   { bg: '#1a2a22', border: '#3A6A52', text: '#B5EAD7', accent: '#8DD4B8' },
};
