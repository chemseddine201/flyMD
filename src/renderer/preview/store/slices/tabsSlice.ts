import { StateCreator } from 'zustand';
import { TabItem, FileOpenResult } from '../../../../shared/types';
import { DEFAULT_WELCOME_MD } from '../../../../shared/constants';
import { generateTranslatedFileName, TextDirection, detectTextDirection } from '../../../../shared/utils';
import {
  AddTabOptions,
  createEmptyTab,
  reduceAddOrSelectTab,
  reduceCloseTab,
  reduceCloseOtherTabs,
  reduceCloseAllTabs,
  reduceCloseTabsToRight,
  reduceUpdateTabContent,
  reduceMarkTabSaved,
} from '../model/tabReducers';
import { scheduleBadgeClear, cancelBadgeClear } from '../utils/badgeTimers';
import { PreviewStoreState } from '../usePreviewStore';

export interface TabsSlice {
  tabs: TabItem[];
  activeTabId: string;
  addTab: (incoming?: Partial<TabItem>, options?: AddTabOptions) => void;
  openFileInTab: (file: FileOpenResult & { isNew?: boolean }, options?: AddTabOptions) => void;
  closeTab: (id: string) => void;
  closeOtherTabs: (keepId: string) => void;
  closeAllTabs: () => void;
  closeTabsToRight: (fromId: string) => void;
  setActiveTabId: (id: string) => void;
  clearTabNewBadge: (id: string) => void;
  clearTabNewBadgeByPath: (filePath: string) => void;
  updateActiveContent: (newContent: string) => void;
  markActiveSaved: (newPath?: string, newName?: string) => void;
  openTranslationAsNewTab: (translatedContent: string, targetLangName: string) => void;
  setTabDirection: (id: string, direction: TextDirection) => void;
  toggleActiveDirection: () => void;
}

const initialWelcomeTab: TabItem = {
  id: 'tab_welcome',
  filePath: '',
  fileName: 'Welcome.md',
  content: DEFAULT_WELCOME_MD,
  savedContent: DEFAULT_WELCOME_MD,
  isDirty: false,
  direction: 'auto',
};

export const createTabsSlice: StateCreator<PreviewStoreState, [], [], TabsSlice> = (set, get) => ({
  tabs: [initialWelcomeTab],
  activeTabId: initialWelcomeTab.id,

  addTab: (incoming, options = { activate: true }) => {
    const blank = createEmptyTab(
      incoming?.fileName || `Untitled-${get().tabs.length + 1}.md`,
      incoming?.content
    );
    const { tabs, activeTabId } = reduceAddOrSelectTab(
      get().tabs,
      { ...blank, direction: 'auto', ...incoming },
      get().activeTabId,
      options
    );
    set({ tabs, activeTabId });
  },

  openFileInTab: (file, options = { activate: true }) => {
    const { tabs, activeTabId } = reduceAddOrSelectTab(
      get().tabs,
      {
        filePath: file.path,
        fileName: file.name,
        content: file.content,
        savedContent: file.content,
        isDirty: false,
        isNew: file.isNew,
        lastModified: file.lastModified,
        direction: 'auto',
      },
      get().activeTabId,
      options
    );
    set({ tabs, activeTabId });
  },

  closeTab: (id) => {
    cancelBadgeClear(`tab_${id}`);
    const { tabs, activeTabId } = reduceCloseTab(get().tabs, id, get().activeTabId);
    set({ tabs, activeTabId });
  },

  closeOtherTabs: (keepId) => {
    const { tabs, activeTabId } = reduceCloseOtherTabs(get().tabs, keepId);
    set({ tabs, activeTabId });
  },

  closeAllTabs: () => {
    const { tabs, activeTabId } = reduceCloseAllTabs();
    set({ tabs, activeTabId });
  },

  closeTabsToRight: (fromId) => {
    const { tabs, activeTabId } = reduceCloseTabsToRight(get().tabs, fromId, get().activeTabId);
    set({ tabs, activeTabId });
  },

  setActiveTabId: (id) => {
    const tab = get().tabs.find((t) => t.id === id);
    set({ activeTabId: id });
    if (tab && tab.isNew) {
      const filePath = tab.filePath;
      scheduleBadgeClear(`tab_${id}`, () => {
        get().clearTabNewBadge(id);
        if (filePath) {
          get().clearFileNewBadge(filePath);
        }
      });
      if (filePath) {
        scheduleBadgeClear(`file_${filePath.toLowerCase()}`, () => {
          get().clearFileNewBadge(filePath);
          get().clearTabNewBadgeByPath(filePath);
        });
      }
    }
  },

  clearTabNewBadge: (id) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, isNew: false } : t)),
    }));
  },

  clearTabNewBadgeByPath: (filePath) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.filePath && t.filePath.toLowerCase() === filePath.toLowerCase()
          ? { ...t, isNew: false }
          : t
      ),
    }));
  },

  updateActiveContent: (newContent) => {
    const { tabs, activeTabId } = get();
    const updated = reduceUpdateTabContent(tabs, activeTabId, newContent);
    set({ tabs: updated });
  },

  markActiveSaved: (newPath, newName) => {
    const { tabs, activeTabId } = get();
    const updated = reduceMarkTabSaved(tabs, activeTabId, newPath, newName);
    set({ tabs: updated });
  },

  openTranslationAsNewTab: (translatedContent, targetLangName) => {
    const { tabs, activeTabId } = get();
    const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
    const newName = generateTranslatedFileName(activeTab.fileName, targetLangName);

    const isTargetRtl =
      /arabic|العربية|hebrew|persian|farsi|urdu/i.test(targetLangName) ||
      detectTextDirection(translatedContent) === 'rtl';

    const newTab: TabItem = {
      id: `tab_trans_${Date.now()}`,
      filePath: '',
      fileName: newName,
      content: translatedContent,
      savedContent: '',
      isDirty: true,
      isNew: true,
      direction: isTargetRtl ? 'rtl' : 'auto',
    };

    const curIdx = tabs.findIndex((t) => t.id === activeTabId);
    const updatedTabs = [...tabs];
    updatedTabs.splice(curIdx + 1, 0, newTab);

    set({ tabs: updatedTabs, activeTabId });
  },

  setTabDirection: (id, direction) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, direction } : t)),
    }));
  },

  toggleActiveDirection: () => {
    const { tabs, activeTabId } = get();
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (!activeTab) return;

    const current = activeTab.direction || 'auto';
    const next: TextDirection =
      current === 'auto' ? 'rtl' : current === 'rtl' ? 'ltr' : 'auto';

    set({
      tabs: tabs.map((t) => (t.id === activeTabId ? { ...t, direction: next } : t)),
    });
  },
});
