import { create } from 'zustand';
import { TabsSlice, createTabsSlice } from './slices/tabsSlice';
import { WorkspaceSlice, createWorkspaceSlice } from './slices/workspaceSlice';
import { UiSlice, createUiSlice } from './slices/uiSlice';
import { SettingsSlice, createSettingsSlice } from './slices/settingsSlice';
import { AgentsSlice, createAgentsSlice } from './slices/agentsSlice';
import { TabItem } from '../../../shared/types';

export type PreviewStoreState = TabsSlice &
  WorkspaceSlice &
  UiSlice &
  SettingsSlice &
  AgentsSlice;

export const usePreviewStore = create<PreviewStoreState>()((...a) => ({
  ...createTabsSlice(...a),
  ...createWorkspaceSlice(...a),
  ...createUiSlice(...a),
  ...createSettingsSlice(...a),
  ...createAgentsSlice(...a),
}));

export const selectActiveTab = (state: PreviewStoreState): TabItem | undefined => {
  return state.tabs.find((t) => t.id === state.activeTabId) || state.tabs[0];
};

export const selectHasDirtyTabs = (state: PreviewStoreState): boolean => {
  return state.tabs.some((t) => t.isDirty);
};

