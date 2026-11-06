import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface UnsavedChangesModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirmDiscard: () => void;
  onCancelKeepEditing: () => void;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = React.memo(
  ({
    isOpen,
    title = 'Unsaved Changes',
    message = 'You have modified settings or draft data that has not been saved. If you close this modal now, your modifications will be lost.',
    confirmLabel = 'Discard & Close',
    cancelLabel = 'Keep Editing',
    onConfirmDiscard,
    onCancelKeepEditing,
  }) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-[100] bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 transition-colors">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
            <div className="flex items-center gap-2.5 text-amber-500 dark:text-amber-400">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle size={18} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {title}
              </h3>
            </div>
            <button
              type="button"
              onClick={onCancelKeepEditing}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-5">
            {message}
          </p>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onCancelKeepEditing}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirmDiscard}
              className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-colors shadow-sm"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }
);
