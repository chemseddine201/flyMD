import { TabItem } from '../../../../shared/types';
import { createId } from '../../../../shared/utils';

export function createEmptyTab(title = 'Untitled.md', content = '# Untitled Document\n\nStart typing markdown here...\n'): TabItem {
  return {
    id: createId('tab'),
    filePath: '',
    fileName: title,
    content,
    savedContent: '',
    isDirty: false,
    isNew: false,
  };
}

export interface AddTabOptions {
  activate?: boolean;
}

export function reduceAddOrSelectTab(
  tabs: TabItem[],
  incoming: Omit<TabItem, 'id'> & { id?: string },
  currentActiveId: string,
  options: AddTabOptions = { activate: true }
): { tabs: TabItem[]; activeTabId: string } {
  const shouldActivate = options.activate !== false;

  if (incoming.filePath) {
    const existingIndex = tabs.findIndex(
      (t) => t.filePath && t.filePath.toLowerCase() === incoming.filePath.toLowerCase()
    );
    if (existingIndex !== -1) {
      const updatedTabs = tabs.map((t, idx) => {
        if (idx === existingIndex) {
          return {
            ...t,
            content: t.isDirty ? t.content : incoming.content,
            savedContent: incoming.savedContent || incoming.content,
            lastModified: incoming.lastModified || t.lastModified,
            isNew: incoming.isNew !== undefined ? incoming.isNew : t.isNew,
          };
        }
        return t;
      });
      return {
        tabs: updatedTabs,
        activeTabId: shouldActivate ? tabs[existingIndex].id : currentActiveId,
      };
    }
  }

  const newTab: TabItem = {
    ...incoming,
    id: incoming.id || createId('tab'),
    isNew: incoming.isNew ?? false,
  };

  if (
    shouldActivate &&
    tabs.length === 1 &&
    !tabs[0].filePath &&
    !tabs[0].isDirty &&
    tabs[0].content === tabs[0].savedContent
  ) {
    return {
      tabs: [newTab],
      activeTabId: newTab.id,
    };
  }

  const newActiveId = (shouldActivate || tabs.length === 0) ? newTab.id : currentActiveId;

  return {
    tabs: [...tabs, newTab],
    activeTabId: newActiveId,
  };
}

export function reduceCloseTab(
  tabs: TabItem[],
  closeId: string,
  currentActiveId: string
): { tabs: TabItem[]; activeTabId: string } {
  const index = tabs.findIndex((t) => t.id === closeId);
  if (index === -1) {
    return { tabs, activeTabId: currentActiveId };
  }

  const newTabs = tabs.filter((t) => t.id !== closeId);
  if (newTabs.length === 0) {
    return { tabs: [], activeTabId: '' };
  }

  let newActiveId = currentActiveId;
  if (currentActiveId === closeId) {
    const nextTab = newTabs[Math.min(index, newTabs.length - 1)];
    newActiveId = nextTab.id;
  }

  return { tabs: newTabs, activeTabId: newActiveId };
}

export function reduceCloseOtherTabs(
  tabs: TabItem[],
  keepId: string
): { tabs: TabItem[]; activeTabId: string } {
  const kept = tabs.filter((t) => t.id === keepId);
  return {
    tabs: kept,
    activeTabId: kept.length > 0 ? kept[0].id : '',
  };
}

export function reduceCloseAllTabs(): { tabs: TabItem[]; activeTabId: string } {
  return {
    tabs: [],
    activeTabId: '',
  };
}

export function reduceCloseTabsToRight(
  tabs: TabItem[],
  fromId: string,
  currentActiveId: string
): { tabs: TabItem[]; activeTabId: string } {
  const index = tabs.findIndex((t) => t.id === fromId);
  if (index === -1) return { tabs, activeTabId: currentActiveId };

  const newTabs = tabs.slice(0, index + 1);
  const stillHasActive = newTabs.some((t) => t.id === currentActiveId);
  return {
    tabs: newTabs,
    activeTabId: stillHasActive ? currentActiveId : fromId,
  };
}

export function reduceUpdateTabContent(tabs: TabItem[], id: string, newContent: string): TabItem[] {
  return tabs.map((t) => {
    if (t.id !== id) return t;
    const isDirty = t.savedContent !== newContent;
    return {
      ...t,
      content: newContent,
      isDirty,
    };
  });
}

export function reduceMarkTabSaved(
  tabs: TabItem[],
  id: string,
  newPath?: string,
  newName?: string
): TabItem[] {
  return tabs.map((t) => {
    if (t.id !== id) return t;
    return {
      ...t,
      filePath: newPath || t.filePath,
      fileName: newName || (newPath ? newPath.split(/[\\/]/).pop() || t.fileName : t.fileName),
      savedContent: t.content,
      isDirty: false,
      isNew: false,
      lastModified: Date.now(),
    };
  });
}
