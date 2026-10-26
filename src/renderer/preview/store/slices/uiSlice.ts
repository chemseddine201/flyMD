import { StateCreator } from 'zustand';
import { ViewMode } from '../../../../shared/constants';
import { PreviewStoreState } from '../usePreviewStore';

export interface UiSlice {
  viewMode: ViewMode;
  showOllamaModal: boolean;
  showSettings: boolean;
  isSearching: boolean;
  sidebarCollapsed: boolean;
  outlinePinned: boolean;
  outlineOpen: boolean;
  statusMessage: string;

  setViewMode: (viewMode: ViewMode) => void;
  setShowOllamaModal: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setIsSearching: (searching: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setOutlinePinned: (pinned: boolean) => void;
  toggleOutlinePinned: () => void;
  setOutlineOpen: (open: boolean) => void;
  toggleOutlineOpen: () => void;
  setStatusMessage: (msg: string) => void;
}

export const createUiSlice: StateCreator<PreviewStoreState, [], [], UiSlice> = (set) => ({
  viewMode: 'split',
  showOllamaModal: false,
  showSettings: false,
  isSearching: false,
  sidebarCollapsed: false,
  outlinePinned: false,
  outlineOpen: false,
  statusMessage: '',

  setViewMode: (viewMode) => set({ viewMode }),
  setShowOllamaModal: (showOllamaModal) => set({ showOllamaModal }),
  setShowSettings: (showSettings) => set({ showSettings }),
  setIsSearching: (isSearching) => set({ isSearching }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setOutlinePinned: (outlinePinned) => set({ outlinePinned }),
  toggleOutlinePinned: () =>
    set((state) => ({
      outlinePinned: !state.outlinePinned,
      outlineOpen: !state.outlinePinned ? true : state.outlineOpen,
    })),
  setOutlineOpen: (outlineOpen) => set({ outlineOpen }),
  toggleOutlineOpen: () => set((state) => ({ outlineOpen: !state.outlineOpen })),
  setStatusMessage: (statusMessage) => {
    set({ statusMessage });
    if (statusMessage) {
      setTimeout(() => {
        set((current) => (current.statusMessage === statusMessage ? { statusMessage: '' } : {}));
      }, 3000);
    }
  },
});
