import React from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';

export interface DiscussionConfirmModalsProps {
  sessionToDelete: string | null;
  onCancelDeleteSession: () => void;
  onConfirmDeleteSession: () => void;
  showClearAllModal: boolean;
  totalDiscussionsCount: number;
  onCancelClearAll: () => void;
  onConfirmClearAll: () => void;
}

export const DiscussionConfirmModals: React.FC<DiscussionConfirmModalsProps> =
  React.memo(
    ({
      sessionToDelete,
      onCancelDeleteSession,
      onConfirmDeleteSession,
      showClearAllModal,
      totalDiscussionsCount,
      onCancelClearAll,
      onConfirmClearAll,
    }) => {
      return (
        <>
          {sessionToDelete && (
            <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
              <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
                <div className="flex items-center gap-2.5 text-rose-400 mb-2">
                  <Trash2 size={18} />
                  <h3 className="text-sm font-bold text-slate-100">
                    Delete Deliberation
                  </h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Are you sure you want to permanently delete session{' '}
                  <span className="font-mono text-slate-200">
                    {sessionToDelete}
                  </span>
                  ? Canonical transcript, decision ledger, and report versions
                  will be permanently removed.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onCancelDeleteSession}
                    className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onConfirmDeleteSession}
                    className="px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold transition-colors"
                  >
                    Delete Session
                  </button>
                </div>
              </div>
            </div>
          )}

          {showClearAllModal && (
            <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
              <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
                <div className="flex items-center gap-2.5 text-rose-400 mb-2">
                  <AlertTriangle size={18} />
                  <h3 className="text-sm font-bold text-slate-100">
                    Clear All Deliberations
                  </h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Are you sure you want to delete all{' '}
                  <span className="font-bold text-slate-200">
                    {totalDiscussionsCount}
                  </span>{' '}
                  historical deliberation sessions in this workspace? This action
                  is permanent and cannot be undone.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onCancelClearAll}
                    className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onConfirmClearAll}
                    className="px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      );
    }
  );

