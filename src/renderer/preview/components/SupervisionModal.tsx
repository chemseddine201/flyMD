import React, { useState, useEffect } from 'react';
import {
  FolderTree,
  Check,
  X,
  ShieldAlert,
  Sparkles,
  Folder,
  Layers,
  FileCode,
  Plus,
  Globe,
  FileText,
  Asterisk,
} from 'lucide-react';
import { FolderSupervisionConfig, ScanDepthMode } from '../../../shared/types';
import { usePreviewStore } from '../store';

interface SupervisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderPath: string;
  folderName: string;
  initialConfig?: FolderSupervisionConfig | null;
  onConfirm: (config: FolderSupervisionConfig) => void;
}

const COMMON_PRESETS = [
  { label: 'Markdown', ext: '.md', icon: '📝' },
  { label: 'Text', ext: '.txt', icon: '📄' },
  { label: 'HTML', ext: '.html', icon: '🌐' },
  { label: 'CSS', ext: '.css', icon: '🎨' },
  { label: 'JavaScript', ext: '.js', icon: '⚡' },
  { label: 'TypeScript', ext: '.ts', icon: '🔷' },
  { label: 'JSON', ext: '.json', icon: '📦' },
  { label: 'Python', ext: '.py', icon: '🐍' },
  { label: 'Rust', ext: '.rs', icon: '🦀' },
];

export const SupervisionModal: React.FC<SupervisionModalProps> = ({
  isOpen,
  onClose,
  folderPath,
  folderName,
  initialConfig,
  onConfirm,
}) => {
  const defaultAllowedExtensions = usePreviewStore((s) => s.settings.defaultAllowedExtensions) || ['.md', '.markdown'];

  const [enabled, setEnabled] = useState<boolean>(true);
  const [autoOpenNew, setAutoOpenNew] = useState<boolean>(true);
  const [scanMode, setScanMode] = useState<ScanDepthMode>(initialConfig?.scanMode || 'full-tree');
  const [allowedExtensions, setAllowedExtensions] = useState<string[]>(() => {
    return initialConfig?.allowedExtensions && initialConfig.allowedExtensions.length > 0
      ? initialConfig.allowedExtensions
      : defaultAllowedExtensions;
  });
  const [customExtInput, setCustomExtInput] = useState<string>('');

  useEffect(() => {
    if (initialConfig) {
      setEnabled(initialConfig.enabled);
      setAutoOpenNew(initialConfig.autoOpenNew);
      setScanMode(initialConfig.scanMode || 'full-tree');
      setAllowedExtensions(
        initialConfig.allowedExtensions && initialConfig.allowedExtensions.length > 0
          ? initialConfig.allowedExtensions
          : defaultAllowedExtensions
      );
    } else {
      setEnabled(true);
      setAutoOpenNew(true);
      setScanMode('full-tree');
      setAllowedExtensions(defaultAllowedExtensions);
    }
  }, [initialConfig, isOpen, defaultAllowedExtensions]);

  if (!isOpen) return null;

  const isAllFiles = allowedExtensions.includes('*.*') || allowedExtensions.includes('*');

  const normalizeExt = (raw: string): string => {
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed) return '';
    if (trimmed === '*' || trimmed === '*.*') return '*.*';
    return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
  };

  const handleAddExtension = (extToAdd?: string) => {
    const target = extToAdd || customExtInput;
    const clean = normalizeExt(target);
    if (!clean) return;

    if (clean === '*.*') {
      setAllowedExtensions(['*.*']);
      setCustomExtInput('');
      return;
    }

    // Filter out wildcard if adding a specific extension
    const withoutWildcard = allowedExtensions.filter((e) => e !== '*' && e !== '*.*');
    if (!withoutWildcard.includes(clean)) {
      setAllowedExtensions([...withoutWildcard, clean]);
    }
    setCustomExtInput('');
  };

  const handleRemoveExtension = (extToRemove: string) => {
    const updated = allowedExtensions.filter((e) => e !== extToRemove);
    // If empty, fall back to default .md
    if (updated.length === 0) {
      setAllowedExtensions(['.md', '.markdown']);
    } else {
      setAllowedExtensions(updated);
    }
  };

  const handleTogglePreset = (ext: string) => {
    const clean = normalizeExt(ext);
    if (isAllFiles) {
      setAllowedExtensions(['.md', '.markdown', clean]);
      return;
    }
    if (allowedExtensions.includes(clean)) {
      handleRemoveExtension(clean);
    } else {
      handleAddExtension(clean);
    }
  };

  const handleSetMarkdownOnly = () => {
    setAllowedExtensions(['.md', '.markdown']);
  };

  const handleSetWebDev = () => {
    setAllowedExtensions(['.md', '.markdown', '.html', '.css', '.js', '.ts', '.json']);
  };

  const handleToggleAllFiles = () => {
    if (isAllFiles) {
      setAllowedExtensions(['.md', '.markdown']);
    } else {
      setAllowedExtensions(['*.*']);
    }
  };

  const handleStartSupervision = () => {
    onConfirm({
      path: folderPath,
      name: folderName,
      enabled,
      autoOpenNew,
      scanMode,
      allowedExtensions,
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
      allowedExtensions,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-800/90 border-b border-slate-700/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Folder Scanning &amp; Supervision</h2>
              <p className="text-[11px] text-slate-400 truncate max-w-[340px] font-mono">
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
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {/* Question 1: Scanning Scope Mode (Full Tree vs. Specified Folder Only) */}
          <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Scanning Scope:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
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
                    🌳 Full Tree (Recursive)
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5 leading-snug">
                    Scan across all nested folders.
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
                    📁 Root Level Only
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5 leading-snug">
                    Scan direct files only, skipping subfolders.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Question 2: Supervised File Types & Extension Picker */}
          <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                <span>Supervised File Types &amp; Extensions:</span>
              </div>
              <span className="text-[10px] text-slate-500">Default: .md only</span>
            </div>

            {/* Quick Template Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={handleSetMarkdownOnly}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition ${
                  !isAllFiles &&
                  allowedExtensions.length <= 2 &&
                  allowedExtensions.every((e) => e === '.md' || e === '.markdown')
                    ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                    : 'bg-slate-900 border-slate-700/70 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                📝 Markdown Only (Default)
              </button>

              <button
                type="button"
                onClick={handleSetWebDev}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition ${
                  !isAllFiles &&
                  allowedExtensions.includes('.html') &&
                  allowedExtensions.includes('.js')
                    ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                    : 'bg-slate-900 border-slate-700/70 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                🌐 Web Dev (.html, .css, .js, .ts)
              </button>

              <button
                type="button"
                onClick={handleToggleAllFiles}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition flex items-center gap-1 ${
                  isAllFiles
                    ? 'bg-amber-600/30 border-amber-500 text-amber-200'
                    : 'bg-slate-900 border-slate-700/70 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                <Asterisk className="w-3 h-3 text-amber-400" />
                <span>All Files (*.*)</span>
              </button>
            </div>

            {/* Active Extension Chips */}
            <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800/80">
              <div className="text-[10px] text-slate-400 mb-1.5 flex items-center justify-between">
                <span>Active Extensions ({isAllFiles ? 'All Files' : allowedExtensions.length}):</span>
                {isAllFiles && (
                  <span className="text-amber-400 font-medium">All non-hidden files supervised</span>
                )}
              </div>

              {isAllFiles ? (
                <div className="flex items-center gap-2 py-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[11px] font-semibold">
                    *.* (Any file extension)
                  </span>
                  <button
                    type="button"
                    onClick={handleSetMarkdownOnly}
                    className="text-[11px] text-slate-400 hover:text-slate-200 underline"
                  >
                    Reset to Markdown only
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 min-h-[30px] items-center">
                  {allowedExtensions.map((ext) => (
                    <span
                      key={ext}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-mono text-[11px]"
                    >
                      <span>{ext}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExtension(ext)}
                        title={`Remove ${ext}`}
                        className="hover:text-rose-400 text-slate-400 p-0.5 rounded transition"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Click Preset Pills */}
            {!isAllFiles && (
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-400 block">Click to quickly add/remove:</span>
                <div className="flex flex-wrap gap-1">
                  {COMMON_PRESETS.map((p) => {
                    const isSelected = allowedExtensions.includes(p.ext);
                    return (
                      <button
                        key={p.ext}
                        type="button"
                        onClick={() => handleTogglePreset(p.ext)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono transition flex items-center gap-1 border ${
                          isSelected
                            ? 'bg-indigo-600/30 border-indigo-500/60 text-indigo-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <span>{p.icon}</span>
                        <span>{p.ext}</span>
                        {isSelected && <Check className="w-2.5 h-2.5 text-indigo-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Custom Extension Input */}
            {!isAllFiles && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddExtension();
                }}
                className="flex items-center gap-2 pt-1"
              >
                <input
                  type="text"
                  placeholder="Custom extension (e.g. py, tsx, yaml, sql, cpp...)"
                  value={customExtInput}
                  onChange={(e) => setCustomExtInput(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 font-mono placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!customExtInput.trim()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg font-medium text-xs flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </form>
            )}
          </div>

          {/* Question 3: Live Supervision Toggle & Behavior */}
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
                  Watches for newly generated or modified files matching allowed extensions in real-time.
                </span>
              </div>
            </label>

            {/* Sub-options for when supervision is enabled */}
            {enabled && (
              <div className="pl-7 pt-2 border-t border-slate-800/80 space-y-2.5">
                <p className="text-[11px] font-semibold text-sky-400">
                  When new matching files are generated:
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
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800/60 border-t border-slate-800 shrink-0">
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
              <span>Apply &amp; Open Folder</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
