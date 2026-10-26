import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  Undo2,
  Redo2,
  Scissors,
  Copy,
  ClipboardPaste,
  CheckSquare,
  Save,
  SaveAll,
  Download,
  Languages,
  ListTree,
} from 'lucide-react';
import { useClickOutside } from '../../shared/hooks/useClickOutside';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface AppContextMenuProps {
  isOpen: boolean;
  position: ContextMenuPosition;
  onClose: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onSelectAll?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onExport?: () => void;
  onTranslate?: () => void;
  onToggleOutline?: () => void;
}

export const AppContextMenu: React.FC<AppContextMenuProps> = ({
  isOpen,
  position,
  onClose,
  onUndo,
  onRedo,
  onCut,
  onCopy,
  onPaste,
  onSelectAll,
  onSave,
  onSaveAs,
  onExport,
  onTranslate,
  onToggleOutline,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuRef, onClose, isOpen);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  // Prevent menu from overflowing window bounds
  const menuWidth = 210;
  const menuHeight = 310;
  const left = Math.min(position.x, window.innerWidth - menuWidth - 10);
  const top = Math.min(position.y, window.innerHeight - menuHeight - 10);

  const handleAction = (action?: () => void) => {
    onClose();
    if (action) action();
  };

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: `${Math.max(8, left)}px`,
        top: `${Math.max(8, top)}px`,
        zIndex: 99999,
      }}
      className="w-52 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl py-1.5 text-xs select-none animate-in fade-in-50 zoom-in-95 duration-100 text-slate-200"
    >
      {/* Undo / Redo */}
      <button
        type="button"
        onClick={() => handleAction(onUndo)}
        className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-slate-800 transition"
      >
        <div className="flex items-center gap-2">
          <Undo2 className="w-3.5 h-3.5 text-slate-400" />
          <span>Undo</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">Ctrl+Z</span>
      </button>

      <button
        type="button"
        onClick={() => handleAction(onRedo)}
        className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-slate-800 transition"
      >
        <div className="flex items-center gap-2">
          <Redo2 className="w-3.5 h-3.5 text-slate-400" />
          <span>Redo</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">Ctrl+Y</span>
      </button>

      <div className="border-t border-slate-800 my-1" />

      {/* Clipboard */}
      <button
        type="button"
        onClick={() => handleAction(onCut)}
        className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-slate-800 transition"
      >
        <div className="flex items-center gap-2">
          <Scissors className="w-3.5 h-3.5 text-slate-400" />
          <span>Cut</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">Ctrl+X</span>
      </button>

      <button
        type="button"
        onClick={() => handleAction(onCopy)}
        className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-slate-800 transition"
      >
        <div className="flex items-center gap-2">
          <Copy className="w-3.5 h-3.5 text-slate-400" />
          <span>Copy</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">Ctrl+C</span>
      </button>

      <button
        type="button"
        onClick={() => handleAction(onPaste)}
        className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-slate-800 transition"
      >
        <div className="flex items-center gap-2">
          <ClipboardPaste className="w-3.5 h-3.5 text-slate-400" />
          <span>Paste</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">Ctrl+V</span>
      </button>

      <button
        type="button"
        onClick={() => handleAction(onSelectAll)}
        className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-slate-800 transition"
      >
        <div className="flex items-center gap-2">
          <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
          <span>Select All</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">Ctrl+A</span>
      </button>

      <div className="border-t border-slate-800 my-1" />

      {/* File Operations */}
      <button
        type="button"
        onClick={() => handleAction(onSave)}
        className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-slate-800 transition"
      >
        <div className="flex items-center gap-2">
          <Save className="w-3.5 h-3.5 text-sky-400" />
          <span>Save Document</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">Ctrl+S</span>
      </button>

      <button
        type="button"
        onClick={() => handleAction(onSaveAs)}
        className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-slate-800 transition"
      >
        <div className="flex items-center gap-2">
          <SaveAll className="w-3.5 h-3.5 text-slate-400" />
          <span>Save As Dialog...</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">Ctrl+Shift+S</span>
      </button>

      <button
        type="button"
        onClick={() => handleAction(onExport)}
        className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-slate-800 transition"
      >
        <div className="flex items-center gap-2">
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span>Export Document...</span>
        </div>
      </button>

      <div className="border-t border-slate-800 my-1" />

      <button
        type="button"
        onClick={() => handleAction(onTranslate)}
        className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-slate-800 transition"
      >
        <div className="flex items-center gap-2">
          <Languages className="w-3.5 h-3.5 text-indigo-400" />
          <span>AI Translate</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">Ctrl+T</span>
      </button>

      {onToggleOutline && (
        <button
          type="button"
          onClick={() => handleAction(onToggleOutline)}
          className="w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-slate-800 transition"
        >
          <div className="flex items-center gap-2">
            <ListTree className="w-3.5 h-3.5 text-sky-400" />
            <span>Document Outline</span>
          </div>
        </button>
      )}
    </div>,
    document.body
  );
};

