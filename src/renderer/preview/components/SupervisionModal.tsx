import React, { useState, useEffect } from 'react';
import { FolderTree, Check, X, ShieldAlert, Sparkles, Folder, Layers } from 'lucide-react';
import { FolderSupervisionConfig, ScanDepthMode } from '../../../shared/types';

interface SupervisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderPath: string;
  folderName: string;
  initialConfig?: FolderSupervisionConfig | null;
  onConfirm: (config: FolderSupervisionConfig) => void;
}

export const SupervisionModal: React.FC<SupervisionModalProps> = ({
  isOpen,
  onClose,
  folderPath,
  folderName,
  initialConfig,
  onConfirm,
}) => {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [autoOpenNew, setAutoOpenNew] = useState<boolean>(true);
  const [scanMode, setScanMode] = useState<ScanDepthMode>(initialConfig?.scanMode || 'full-tree');

  useEffect(() => {
    if (initialConfig) {
      setEnabled(initialConfig.enabled);
      setAutoOpenNew(initialConfig.autoOpenNew);
      setScanMode(initialConfig.scanMode || 'full-tree');
    } else {
      setEnabled(true);
      setAutoOpenNew(true);
      setScanMode('full-tree');
    }
  }, [initialConfig, isOpen]);

  if (!isOpen) return null;

  const handleStartSupervision = () => {
    onConfirm({
      path: folderPath,
      name: folderName,
      enabled,
      autoOpenNew,
      scanMode,
    });
    onClose();
  };

  const handleOpenWithoutSupervision = () => {
    onConfirm({
      path: folderPath,
      name: folderName,
      enabled: false,
      autoOpenNew: false,
      scanMode,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-800/90 border-b border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Folder Scanning & Supervision</h2>
              <p className="text-[11px] text-slate-400 truncate max-w-[280px] font-mono">
                {folderName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Question 1: Scanning Scope Mode (Full Tree vs. Specified Folder Only) */}
          <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Scanning Scope:</span>
            </div>

            <div className="grid grid-cols-1 gap-2 pt-1">
              <label
                onClick={() => setScanMode('full-tree')}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition ${
                  scanMode === 'full-tree'
                    ? 'bg-sky-500/15 border-sky-500/50 text-slate-100'
                    : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <input
                  type="radio"
                  name="scan-mode"
                  checked={scanMode === 'full-tree'}
                  onChange={() => setScanMode('full-tree')}
                  className="mt-0.5 accent-sky-500"
                />
                <div>
                  <span className="font-semibold block text-slate-200">
                    🌳 Full Folders Tree (Recursive)
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5 leading-snug">
                    Scan and collect all Markdown files across this folder and all nested subdirectories.
                  </span>
                </div>
              </label>

              <label
                onClick={() => setScanMode('shallow')}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition ${
                  scanMode === 'shallow'
                    ? 'bg-sky-500/15 border-sky-500/50 text-slate-100'
                    : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <input
                  type="radio"
                  name="scan-mode"
                  checked={scanMode === 'shallow'}
                  onChange={() => setScanMode('shallow')}
                  className="mt-0.5 accent-sky-500"
                />
                <div>
                  <span className="font-semibold block text-slate-200">
                    📁 Only Specified Folder (Root Level)
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5 leading-snug">
                    Scan only Markdown files directly in this folder, skipping all subfolders.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Question 2: Live Supervision Toggle & Behavior */}
          <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-sky-500 rounded"
              />
              <div>
                <span className="font-semibold text-slate-100 block">
                  Enable Live Folder Supervision
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Watches for newly generated or modified Markdown files in real-time.
                </span>
              </div>
            </label>

            {/* Sub-options for when supervision is enabled */}
            {enabled && (
              <div className="pl-7 pt-2 border-t border-slate-800/80 space-y-2.5">
                <p className="text-[11px] font-semibold text-sky-400">
                  When new Markdown files are generated:
                </p>

                <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                  <input
                    type="radio"
                    name="new-file-behavior"
                    checked={autoOpenNew}
                    onChange={() => setAutoOpenNew(true)}
                    className="accent-sky-500"
                  />
                  <span>Auto-open newest files in a new tab</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                  <input
                    type="radio"
                    name="new-file-behavior"
                    checked={!autoOpenNew}
                    onChange={() => setAutoOpenNew(false)}
                    className="accent-sky-500"
                  />
                  <span>Show green dot (🟢) on newest files without auto-opening</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800/60 border-t border-slate-800">
          <button
            onClick={handleOpenWithoutSupervision}
            className="text-[11px] text-slate-400 hover:text-slate-200 underline transition"
          >
            Open without supervision
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-slate-400 hover:text-slate-200 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleStartSupervision}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow-sm shadow-sky-600/30 transition"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply & Open Folder</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
