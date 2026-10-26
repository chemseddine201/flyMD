import { useEffect } from 'react';

export interface HotkeyHandlers {
  onSave?: () => void;
  onSaveAs?: () => void;
  onOpenFile?: () => void;
  onOpenFolder?: () => void;
  onNewTab?: () => void;
  onCloseTab?: () => void;
  onToggleSidebar?: () => void;
  onTranslate?: () => void;
  onSearch?: () => void;
  onToggleDirection?: () => void;
}

export function useHotkeys(handlers: HotkeyHandlers, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;

      const key = e.key.toLowerCase();

      if (key === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          handlers.onSaveAs?.();
        } else {
          handlers.onSave?.();
        }
      } else if (key === 'o') {
        e.preventDefault();
        if (e.shiftKey) {
          handlers.onOpenFolder?.();
        } else {
          handlers.onOpenFile?.();
        }
      } else if (key === 'n' && !e.shiftKey) {
        e.preventDefault();
        handlers.onNewTab?.();
      } else if (key === 'w' && !e.shiftKey) {
        e.preventDefault();
        handlers.onCloseTab?.();
      } else if (key === 'b' && !e.shiftKey) {
        e.preventDefault();
        handlers.onToggleSidebar?.();
      } else if (key === 't' && !e.shiftKey) {
        e.preventDefault();
        handlers.onTranslate?.();
      } else if (key === 'f' && !e.shiftKey) {
        e.preventDefault();
        handlers.onSearch?.();
      } else if (key === 'd' && e.shiftKey) {
        e.preventDefault();
        handlers.onToggleDirection?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handlers, enabled]);
}

