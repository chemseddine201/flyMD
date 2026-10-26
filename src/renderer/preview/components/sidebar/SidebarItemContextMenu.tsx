import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import {
  FolderOpen,
  Trash2,
  FileText,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useClickOutside } from '../../../shared/hooks/useClickOutside';

export interface SidebarContextMenuTarget {
  x: number;
  y: number;
  title: string;
  subtitle?: string;
  filePath?: string;
  onOpen?: () => void;
  onDeleteConfirm: () => Promise<void> | void;
  deleteLabel?: string;
}

interface SidebarItemContextMenuProps {
  target: SidebarContextMenuTarget | null;
  onClose: () => void;
}

export const SidebarItemContextMenu: React.FC<SidebarItemContextMenuProps> = ({
  target,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setConfirmingDelete(false);
    setDeleting(false);
  }, [target]);

  useClickOutside(
    menuRef,
    () => {
      if (!confirmingDelete) onClose();
    },
    Boolean(target) && !confirmingDelete
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (target) {
      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
    }
  }, [target, onClose]);

  if (!target || typeof document === 'undefined') return null;

  const handleRevealInDirectory = async () => {
    const pathToReveal = target.filePath;
    onClose();
    if (pathToReveal && window.electronAPI?.revealInExplorer) {
      try {
        await window.electronAPI.revealInExplorer(pathToReveal);
      } catch (err) {
        console.error('Failed to open file in directory:', err);
      }
    }
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await target.onDeleteConfirm();
    } catch (err) {
      console.error('Failed to delete item:', err);
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
      onClose();
    }
  };

  if (confirmingDelete) {
    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in select-none">
        <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/60">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
              <AlertTriangle size={15} />
              <span>Confirm Deletion</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X size={14} />
            </button>
          </div>

          <div className="p-4 space-y-2 text-xs">
            <p className="text-slate-200 font-semibold">
              Are you sure you want to delete{' '}
              <span className="text-sky-300 font-bold">&ldquo;{target.title}&rdquo;</span>?
            </p>
            {target.subtitle && (
              <p className="text-[11px] text-slate-400 break-all font-mono bg-slate-950 p-2 rounded-lg border border-slate-800">
                {target.subtitle}
              </p>
            )}
            <p className="text-[11px] text-amber-300/90">
              This action cannot be undone.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-800 bg-slate-950/60">
            <button
              type="button"
              disabled={deleting}
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleConfirmDelete}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 text-xs font-bold shadow-lg shadow-rose-500/20 transition-all"
            >
              <Trash2 size={12} />
              <span>{deleting ? 'Deleting...' : 'Confirm Delete'}</span>
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  const menuWidth = 220;
  const menuHeight = 140;
  const left = Math.min(target.x, window.innerWidth - menuWidth - 10);
  const top = Math.min(target.y, window.innerHeight - menuHeight - 10);

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: `${Math.max(8, left)}px`,
        top: `${Math.max(8, top)}px`,
        zIndex: 99999,
      }}
      className="w-56 bg-slate-900/95 backdrop-blur-md border border-slate-700/90 rounded-xl shadow-2xl py-1.5 text-xs select-none text-slate-200"
    >
      <div className="px-3 py-1 border-b border-slate-800/80 mb-1 truncate text-[10px] font-bold text-slate-400">
        {target.title}
      </div>

      {target.onOpen && (
        <button
          type="button"
          onClick={() => {
            const fn = target.onOpen;
            onClose();
            if (fn) fn();
          }}
          className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-slate-800 transition-colors"
        >
          <FileText size={13} className="text-sky-400 shrink-0" />
          <span>Open in FlyMD</span>
        </button>
      )}

      {target.filePath && (
        <button
          type="button"
          onClick={handleRevealInDirectory}
          className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-slate-800 transition-colors"
        >
          <FolderOpen size={13} className="text-amber-400 shrink-0" />
          <span>Open File in Directory</span>
        </button>
      )}

      <div className="border-t border-slate-800/80 my-1" />

      <button
        type="button"
        onClick={() => setConfirmingDelete(true)}
        className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-rose-300 hover:bg-rose-500/15 transition-colors font-semibold"
      >
        <Trash2 size={13} className="text-rose-400 shrink-0" />
        <span>{target.deleteLabel || 'Delete...'}</span>
      </button>
    </div>,
    document.body
  );
};

