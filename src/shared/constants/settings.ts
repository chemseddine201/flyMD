import { AppSettings, AccessibilityConfig } from '../types';

export const DEFAULT_WINDOW_BOUNDS = {
  float: {
    width: 200,
    height: 200,
  },
  preview: {
    width: 1100,
    height: 750,
  },
  historyHub: {
    width: 360,
    height: 480,
  },
} as const;

export const DEFAULT_A11Y_CONFIG: AccessibilityConfig = {
  highContrast: false,
  dyslexicFont: false,
  largePrint: false,
  reducedMotion: false,
  colorBlindSafe: false,
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  floatAlwaysOnTop: true,
  previewAlwaysOnTop: false,
  ollamaUrl: 'http://127.0.0.1:11434',
  ollamaModel: 'qwen2.5:3b',
  llmConfig: {
    provider: 'ollama',
    endpointUrl: 'http://127.0.0.1:11434',
    apiKey: '',
    model: 'qwen2.5:3b',
  },
  defaultView: 'split',
  autoSave: false,
  fontSize: 15,
  syncScroll: true,
  textDirection: 'auto',
  previewWidthMode: 'wide',
  a11yConfig: DEFAULT_A11Y_CONFIG,
  defaultAllowedExtensions: ['.md', '.markdown'],
};
