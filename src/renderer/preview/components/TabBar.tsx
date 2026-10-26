import React, { useRef, useEffect, useState } from 'react';
import { TabItem } from '../../../shared/types';
import {
  FileText,
  Plus,
  X,
  Circle,
  ChevronLeft,
  ChevronRight,
  Minimize2,
  ArrowRightToLine,
  Trash2,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';

interface TabBarProps {
  tabs: TabItem[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string, e?: React.MouseEvent) => void;
  onCloseOthers?: (keepId: string) => void;
  onCloseAll?: () => void;
  onCloseTabsToRight?: (fromId: string) => void;
  onNewTab: () => void;
  colorBlindSafe?: boolean;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onCloseOthers,
  onCloseAll,
  onCloseTabsToRight,
  onNewTab,
  colorBlindSafe = false,
}) => {
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    tab: TabItem | null;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    tab: null,
  });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    action: 'others' | 'all';
    targetTabId: string;
    count: number;
    hasDirty: boolean;
    dontAskAgain: boolean;
  }>({
    isOpen: false,
    action: 'all',
    targetTabId: '',
    count: 0,
    hasDirty: false,
    dontAskAgain: false,
  });

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!tabsContainerRef.current) return;
    const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
    if (delta !== 0) {
      tabsContainerRef.current.scrollLeft += delta;
      e.stopPropagation();
    }
  };

  useEffect(() => {
    if (tabsContainerRef.current) {
      const activeEl = tabsContainerRef.current.querySelector<HTMLElement>('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [activeTabId]);

  useEffect(() => {
    if (!contextMenu.isOpen) return;
    const handleOutsideClick = () => {
      setContextMenu((prev) => ({ ...prev, isOpen: false }));
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [contextMenu.isOpen]);

  const handleScrollLeft = () => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  const handleTabContextMenu = (tab: TabItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      tab,
    });
  };

  const triggerCloseOthers = (tabId: string) => {
    const others = tabs.filter((t) => t.id !== tabId);
    if (others.length === 0) return;

    const skip = localStorage.getItem('flymd_skip_close_tab_confirm') === 'true';
    if (skip) {
      onCloseOthers?.(tabId);
      return;
    }

    setConfirmModal({
      isOpen: true,
      action: 'others',
      targetTabId: tabId,
      count: others.length,
      hasDirty: others.some((t) => t.isDirty),
      dontAskAgain: false,
    });
  };

  const triggerCloseAll = () => {
    if (tabs.length === 0) return;

    const skip = localStorage.getItem('flymd_skip_close_tab_confirm') === 'true';
    if (skip) {
      onCloseAll?.();
      return;
    }

    setConfirmModal({
      isOpen: true,
      action: 'all',
      targetTabId: '',
      count: tabs.length,
      hasDirty: tabs.some((t) => t.isDirty),
      dontAskAgain: false,
    });
  };

  const handleConfirmCloseModal = () => {
    if (confirmModal.dontAskAgain) {
      localStorage.setItem('flymd_skip_close_tab_confirm', 'true');
    }
    if (confirmModal.action === 'others') {
      onCloseOthers?.(confirmModal.targetTabId);
    } else {
      onCloseAll?.();
    }
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <div className="h-11 w-full flex items-center bg-slate-950/90 border-b border-slate-800 text-xs select-none shrink-0 px-2 gap-1.5 relative">
      {tabs.length > 5 && (
        <button
          onClick={handleScrollLeft}
          title="Scroll tabs left"
          className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 rounded transition shrink-0"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      )}

      <div
        ref={tabsContainerRef}
        onWheel={handleWheel}
        className="flex items-center gap-1.5 flex-1 overflow-x-auto py-1 scroll-smooth"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#334155 #0f172a',
        }}
      >
        {tabs.length === 0 ? (
          <span className="text-[11px] text-slate-500 italic px-2">
            No files open — create a new file or open from drive
          </span>
        ) : (
          tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                data-active={isActive ? 'true' : 'false'}
                onClick={() => onSelectTab(tab.id)}
                onContextMenu={(e) => handleTabContextMenu(tab, e)}
                onMouseDown={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    onCloseTab(tab.id, e);
                  }
                }}
                title={tab.filePath || 'Untitled (Right-click for options)'}
                className={`group relative flex items-center gap-2.5 h-[34px] px-3.5 rounded-lg max-w-[220px] min-w-[120px] cursor-pointer transition-all duration-150 border shrink-0 ${
                  isActive
                    ? 'bg-slate-800/95 text-slate-100 border-sky-500/50 shadow-md shadow-sky-950/40'
                    : 'bg-slate-900/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 border-slate-800/90'
                }`}
              >
                <div className="relative shrink-0">
                  <FileText className={`w-3.5 h-3.5 ${isActive ? 'text-sky-400' : 'text-slate-500'}`} />
                  {tab.isNew && (
                    <span
                      title="New file (click to clear in 5s)"
                      className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse ring-2 ring-slate-900 shadow-sm shadow-emerald-400"
                    />
                  )}
                </div>

                <span className="truncate flex-1 font-medium text-xs tracking-wide">
                  {tab.fileName || 'Untitled.md'}
                </span>

                {tab.isNew && colorBlindSafe && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0 uppercase tracking-wider">
                    NEW
                  </span>
                )}

                {tab.isDirty && (
                  <span title="Unsaved changes" className="shrink-0 text-amber-400">
                    <Circle className="w-2 h-2 fill-current" />
                  </span>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id, e);
                  }}
                  title="Close tab (Ctrl+W)"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-700/70 transition shrink-0 ml-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {tabs.length > 5 && (
        <button
          onClick={handleScrollRight}
          title="Scroll tabs right"
          className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 rounded transition shrink-0"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}

      <button
        onClick={onNewTab}
        title="New Tab (Ctrl+N)"
        className="p-1.5 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition shrink-0 ml-1 border border-slate-800/80 hover:border-sky-500/30"
      >
        <Plus className="w-4 h-4" />
      </button>

      {contextMenu.isOpen && contextMenu.tab && (
        <div
          style={{
            position: 'fixed',
            left: Math.min(contextMenu.x, window.innerWidth - 180),
            top: Math.min(contextMenu.y, window.innerHeight - 170),
            zIndex: 100,
          }}
          className="w-48 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl p-1 text-slate-200 text-xs flex flex-col gap-0.5 animate-in fade-in duration-100"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              if (contextMenu.tab) onCloseTab(contextMenu.tab.id);
              setContextMenu((prev) => ({ ...prev, isOpen: false }));
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition text-left"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
            <span className="flex-1">Close</span>
            <kbd className="text-[9px] text-slate-500 font-mono">Ctrl+W</kbd>
          </button>

          <button
            type="button"
            onClick={() => {
              const targetId = contextMenu.tab?.id;
              setContextMenu((prev) => ({ ...prev, isOpen: false }));
              if (targetId) triggerCloseOthers(targetId);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition text-left"
          >
            <Minimize2 className="w-3.5 h-3.5 text-sky-400" />
            <span className="flex-1">Close Others</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const targetId = contextMenu.tab?.id;
              setContextMenu((prev) => ({ ...prev, isOpen: false }));
              if (targetId) onCloseTabsToRight?.(targetId);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition text-left"
          >
            <ArrowRightToLine className="w-3.5 h-3.5 text-slate-400" />
            <span className="flex-1">Close to the Right</span>
          </button>

          <div className="h-px bg-slate-800 my-0.5" />

          <button
            type="button"
            onClick={() => {
              setContextMenu((prev) => ({ ...prev, isOpen: false }));
              triggerCloseAll();
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 hover:text-rose-300 text-rose-400 transition text-left"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="flex-1 font-medium">Close All</span>
          </button>
        </div>
      )}

      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-5 text-slate-100 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-slate-100">
                  {confirmModal.action === 'all' ? 'Close All Tabs?' : 'Close Other Tabs?'}
                </h3>
                <p className="text-xs text-slate-400">
                  {confirmModal.action === 'all'
                    ? `Are you sure you want to close all ${confirmModal.count} tab${confirmModal.count > 1 ? 's' : ''}?`
                    : `Are you sure you want to close ${confirmModal.count} other tab${confirmModal.count > 1 ? 's' : ''}?`}
                </p>
              </div>
            </div>

            {confirmModal.hasDirty && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>One or more tabs have unsaved edits which will be discarded.</span>
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmModal.dontAskAgain}
                onChange={(e) =>
                  setConfirmModal((prev) => ({ ...prev, dontAskAgain: e.target.checked }))
                }
                className="rounded border-slate-700 bg-slate-800 text-sky-500 focus:ring-0 focus:ring-offset-0 w-4 h-4"
              />
              <span>Do not ask me again</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-3.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCloseModal}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition text-xs font-semibold shadow-md shadow-rose-600/30"
              >
                {confirmModal.action === 'all' ? 'Close All' : 'Close Others'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
