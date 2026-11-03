import React from 'react';
import { Trash2, X, Loader2 } from 'lucide-react';

export interface ClearWorkspaceCacheModalProps {
  isOpen: boolean;
  onClose: () => void;
  resolvedWorkspace: string;
  clearingCache: boolean;
  onExecuteClearCache: () => Promise<void>;
  clearTempCache: boolean;
  setClearTempCache: (val: boolean) => void;
  clearMemoryLedger: boolean;
  setClearMemoryLedger: (val: boolean) => void;
  clearCompletedSessions: boolean;
  setClearCompletedSessions: (val: boolean) => void;
  clearDebatesAndCouncil: boolean;
  setClearDebatesAndCouncil: (val: boolean) => void;
  clearPipelineAndReports: boolean;
  setClearPipelineAndReports: (val: boolean) => void;
  closeRelatedOpenedFiles: boolean;
  setCloseRelatedOpenedFiles: (val: boolean) => void;
}

export const ClearWorkspaceCacheModal: React.FC<ClearWorkspaceCacheModalProps> = ({
  isOpen,
  onClose,
  resolvedWorkspace,
  clearingCache,
  onExecuteClearCache,
  clearTempCache,
  setClearTempCache,
  clearMemoryLedger,
  setClearMemoryLedger,
  clearCompletedSessions,
  setClearCompletedSessions,
  clearDebatesAndCouncil,
  setClearDebatesAndCouncil,
  clearPipelineAndReports,
  setClearPipelineAndReports,
  closeRelatedOpenedFiles,
  setCloseRelatedOpenedFiles,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fade-in select-none">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden transition-colors duration-150">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-xs">
            <Trash2 size={15} />
            <span>Clear Workspace Memory &amp; Cache</span>
          </div>
          <button
            type="button"
            onClick={() => !clearingCache && onClose()}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-4 space-y-3 text-xs max-h-[75vh] overflow-y-auto bg-white dark:bg-slate-900">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Select items to clean and reset for workspace{' '}
            <strong className="text-slate-900 dark:text-white font-mono break-all">
              {resolvedWorkspace}
            </strong>
            :
          </p>

          <div className="space-y-2 pt-0.5">
            {/* 1. Temp Cache */}
            <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer border border-slate-200 dark:border-slate-700/60 transition-colors">
              <input
                type="checkbox"
                checked={clearTempCache}
                onChange={(e) => setClearTempCache(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-rose-500 focus:ring-0 focus:ring-offset-0 bg-white dark:bg-slate-900"
              />
              <div className="min-w-0">
                <div className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                  Purge Temporary Cache &amp; Checkpoints
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Deletes <code className="text-slate-700 dark:text-slate-300">.flymd/handoffs</code>, <code className="text-slate-700 dark:text-slate-300">.flymd/reports</code>, <code className="text-slate-700 dark:text-slate-300">.flymd/checkpoints</code>, and cognitive cache.
                </div>
              </div>
            </label>

            {/* 2. Memory Ledger */}
            <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer border border-slate-200 dark:border-slate-700/60 transition-colors">
              <input
                type="checkbox"
                checked={clearMemoryLedger}
                onChange={(e) => setClearMemoryLedger(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-rose-500 focus:ring-0 focus:ring-offset-0 bg-white dark:bg-slate-900"
              />
              <div className="min-w-0">
                <div className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                  Reset Shared Agent Memory Ledger
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Re-initializes <code className="text-amber-600 dark:text-amber-300">.flymd/MEMORY.md</code> to a clean slate.
                </div>
              </div>
            </label>

            {/* 3. Task Sessions */}
            <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer border border-slate-200 dark:border-slate-700/60 transition-colors">
              <input
                type="checkbox"
                checked={clearCompletedSessions}
                onChange={(e) =>
                  setClearCompletedSessions(e.target.checked)
                }
                className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-rose-500 focus:ring-0 focus:ring-offset-0 bg-white dark:bg-slate-900"
              />
              <div className="min-w-0">
                <div className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                  Clear Finished Task Sessions &amp; Logs
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Removes completed agent session records, execution history, and logs from memory.
                </div>
              </div>
            </label>

            {/* 4. Debates & Council */}
            <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer border border-slate-200 dark:border-slate-700/60 transition-colors">
              <input
                type="checkbox"
                checked={clearDebatesAndCouncil}
                onChange={(e) =>
                  setClearDebatesAndCouncil(e.target.checked)
                }
                className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-rose-500 focus:ring-0 focus:ring-offset-0 bg-white dark:bg-slate-900"
              />
              <div className="min-w-0">
                <div className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                  Clear All Debates &amp; Deliberation Memory
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Stops active deliberations, purges <code className="text-purple-600 dark:text-purple-300">.flymd/discussions</code> transcripts, and resets Council UI.
                </div>
              </div>
            </label>

            {/* 5. Pipeline & Reports UI */}
            <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer border border-slate-200 dark:border-slate-700/60 transition-colors">
              <input
                type="checkbox"
                checked={clearPipelineAndReports}
                onChange={(e) =>
                  setClearPipelineAndReports(e.target.checked)
                }
                className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-rose-500 focus:ring-0 focus:ring-offset-0 bg-white dark:bg-slate-900"
              />
              <div className="min-w-0">
                <div className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                  Reset Pipeline State &amp; Deliverables Reports
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Resets workflow steps to Idle, cancels running pipeline runs, and resets active report viewers.
                </div>
              </div>
            </label>

            {/* 6. Close Related Opened Files */}
            <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer border border-slate-200 dark:border-slate-700/60 transition-colors">
              <input
                type="checkbox"
                checked={closeRelatedOpenedFiles}
                onChange={(e) =>
                  setCloseRelatedOpenedFiles(e.target.checked)
                }
                className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-rose-500 focus:ring-0 focus:ring-offset-0 bg-white dark:bg-slate-900"
              />
              <div className="min-w-0">
                <div className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                  Close Related Opened Files &amp; Reports in Editor
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Closes editor tabs pointing to <code className="text-sky-600 dark:text-sky-300">.flymd</code> memory, generated reports, and handoffs.
                </div>
              </div>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60">
          <button
            type="button"
            disabled={clearingCache}
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={clearingCache}
            onClick={onExecuteClearCache}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-lg shadow-rose-950/50"
          >
            {clearingCache ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Clearing...</span>
              </>
            ) : (
              <>
                <Trash2 size={13} />
                <span>Clear Cache &amp; Memory</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

