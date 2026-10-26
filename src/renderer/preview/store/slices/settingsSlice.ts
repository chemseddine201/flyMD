import { StateCreator } from 'zustand';
import { AppSettings } from '../../../../shared/types';
import { DEFAULT_SETTINGS } from '../../../../shared/constants';
import { PreviewStoreState } from '../usePreviewStore';

export interface SettingsSlice {
  settings: AppSettings;
  isPinned: boolean;

  setSettings: (settings: AppSettings) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  setIsPinned: (isPinned: boolean) => void;
}

export const createSettingsSlice: StateCreator<PreviewStoreState, [], [], SettingsSlice> = (set) => ({
  settings: DEFAULT_SETTINGS,
  isPinned: false,

  setSettings: (settings) => set({ settings }),
  updateSettings: (patch) =>
    set((state) => ({
      settings: { ...state.settings, ...patch },
    })),
  setIsPinned: (isPinned) => set({ isPinned }),
});

