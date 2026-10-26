export const VIEW_MODES = ['split', 'preview', 'editor', 'wysiwyg'] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

export const THEMES = [
  'dark',
  'light',
  'tokyo-night',
  'catppuccin',
  'dracula',
  'sepia',
  'cyber',
  'high-contrast',
] as const;
export type AppTheme = (typeof THEMES)[number];

export const THEME_CLASSES: Record<AppTheme, string> = {
  dark: 'theme-dark bg-[#0d1117] text-[#e6edf3]',
  light: 'theme-light bg-[#ffffff] text-[#1f2328]',
  'tokyo-night': 'theme-tokyo-night bg-[#1a1b26] text-[#c0caf5]',
  catppuccin: 'theme-catppuccin bg-[#24273a] text-[#cad3f5]',
  dracula: 'theme-dracula bg-[#282a36] text-[#f8f8f2]',
  sepia: 'theme-sepia bg-[#fbf0d9] text-[#433422]',
  cyber: 'theme-cyber bg-[#090910] text-[#e0f8ff]',
  'high-contrast': 'theme-high-contrast bg-black text-white',
};

export const TIMINGS = {
  STORE_DEBOUNCE_MS: 300,
  AUTO_SAVE_DEBOUNCE_MS: 1000,
  SCROLL_SYNC_THROTTLE_MS: 16,
  TOAST_DURATION_MS: 2500,
  FILE_DROP_HIGHLIGHT_MS: 150,
} as const;
