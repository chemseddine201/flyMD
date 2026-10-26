import { LLMConfig } from './llm';
import { TextDirection } from '../utils/direction';

export type AppTheme =
  | 'dark'
  | 'light'
  | 'tokyo-night'
  | 'catppuccin'
  | 'dracula'
  | 'sepia'
  | 'cyber'
  | 'high-contrast';

export type PreviewWidthMode = 'standard' | 'wide' | 'full';

export interface AccessibilityConfig {
  highContrast: boolean;
  dyslexicFont: boolean;
  largePrint: boolean;
  reducedMotion: boolean;
  colorBlindSafe: boolean;
}

export interface AppSettings {
  theme: AppTheme;
  floatAlwaysOnTop: boolean;
  previewAlwaysOnTop: boolean;
  ollamaUrl: string;
  ollamaModel: string;
  llmConfig: LLMConfig;
  defaultView: 'split' | 'preview' | 'editor';
  autoSave: boolean;
  fontSize: number;
  syncScroll: boolean;
  textDirection?: TextDirection;
  previewWidthMode?: PreviewWidthMode;
  a11yConfig?: AccessibilityConfig;
}

export interface WindowState {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  isMaximized?: boolean;
}
