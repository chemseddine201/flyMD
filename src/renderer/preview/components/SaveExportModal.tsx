import React, { useState, useEffect, useRef } from 'react';
import {
  Save,
  Download,
  X,
  FileText,
  Globe,
  FileSpreadsheet,
  FileCode,
  Check,
  FolderInput,
} from 'lucide-react';
import { ExportFormatId } from '../services/export';

export interface SaveExportModalProps {
  isOpen: boolean;
  mode: 'save-as' | 'export';
  initialFileName?: string;
  initialExportFormat?: ExportFormatId;
  onClose: () => void;
  onConfirmSaveAs: (fileNameWithExt: string) => void;
  onConfirmExport: (fileNameWithExt: string, format: ExportFormatId) => void;
}

const SAVE_AS_EXTENSIONS = [
  { ext: '.md', label: 'Markdown', desc: 'Standard GFM Markdown document' },
  { ext: '.markdown', label: 'Extended Markdown', desc: 'Common alternate extension' },
  { ext: '.txt', label: 'Plain Text', desc: 'Simple unformatted text file' },
];

const EXPORT_FORMATS: Array<{
  id: ExportFormatId;
  ext: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
}> = [
  {
    id: 'html',
    ext: '.html',
    label: 'HTML Document',
    desc: 'Self-contained webpage with embedded CSS, KaTeX math & syntax highlight',
    icon: <Globe className="w-4 h-4 text-sky-400" />,
    color: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  },
  {
    id: 'pdf',
    ext: '.pdf',
    label: 'PDF Document',
    desc: 'Print-ready vector PDF with pagination and document styling',
    icon: <FileSpreadsheet className="w-4 h-4 text-rose-400" />,
    color: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  },
  {
    id: 'txt',
    ext: '.txt',
    label: 'Textify Plain Text',
    desc: 'Clean plaintext with markdown symbols stripped and tables converted',
    icon: <FileText className="w-4 h-4 text-emerald-400" />,
    color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  },
  {
    id: 'tex',
    ext: '.tex',
    label: 'LaTeX Source',
    desc: 'Full compilable LaTeX document with sectioning, verbatim and amsmath',
    icon: <FileCode className="w-4 h-4 text-purple-400" />,
    color: 'border-purple-500/40 bg-purple-500/10 text-purple-300',
  },
];

export const SaveExportModal: React.FC<SaveExportModalProps> = ({
  isOpen,
  mode,
  initialFileName = 'Untitled',
  initialExportFormat = 'html',
  onClose,
  onConfirmSaveAs,
  onConfirmExport,
}) => {
  const [baseName, setBaseName] = useState<string>('');
  const [saveExt, setSaveExt] = useState<string>('.md');
  const [exportFormat, setExportFormat] = useState<ExportFormatId>(initialExportFormat);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Strip any existing extensions (.md, .markdown, .txt, .html, .pdf, .tex)
      const cleanName = initialFileName.replace(/\.(md|markdown|mdown|mkd|txt|html|pdf|tex)$/i, '');
      setBaseName(cleanName || 'Document');
      if (initialExportFormat) {
        setExportFormat(initialExportFormat);
      }
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, initialFileName, initialExportFormat]);

  if (!isOpen) return null;

  const currentExt = mode === 'save-as'
    ? saveExt
    : EXPORT_FORMATS.find((f) => f.id === exportFormat)?.ext || '.html';

  const fullFileName = `${baseName.trim() || 'Untitled'}${currentExt}`;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalName = fullFileName;
    if (mode === 'save-as') {
      onConfirmSaveAs(finalName);
    } else {
      onConfirmExport(finalName, exportFormat);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none"
    >
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-800/90 border-b border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl ${
                mode === 'save-as'
                  ? 'bg-sky-500/20 text-sky-400'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {mode === 'save-as' ? (
                <Save className="w-5 h-5" />
              ) : (
                <Download className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">
                {mode === 'save-as' ? 'Save Document As' : 'Export Document'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {mode === 'save-as'
                  ? 'Specify file name and extension to save to disk'
                  : 'Choose export format and file name'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Filename Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <FolderInput className="w-3.5 h-3.5 text-sky-400" />
              <span>File Name:</span>
            </label>
            <div className="flex items-center rounded-xl bg-slate-950 border border-slate-700 focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500/50 overflow-hidden px-3 py-2 transition">
              <input
                ref={inputRef}
                type="text"
                value={baseName}
                onChange={(e) => setBaseName(e.target.value.replace(/[/\\?%*:|"<>]/g, ''))}
                placeholder="Enter file name"
                className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-xs focus:outline-none"
              />
              <span className="text-xs font-mono font-semibold text-sky-400 pl-2 shrink-0">
                {currentExt}
              </span>
            </div>
          </div>

          {/* Extension / Format Selection */}
          {mode === 'save-as' ? (
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-300 block">
                Save Format Extension:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {SAVE_AS_EXTENSIONS.map((item) => (
                  <button
                    key={item.ext}
                    type="button"
                    onClick={() => setSaveExt(item.ext)}
                    className={`flex flex-col text-left p-2.5 rounded-xl border transition ${
                      saveExt === item.ext
                        ? 'border-sky-500 bg-sky-500/15 text-white shadow-sm'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-mono font-bold text-xs text-sky-300">
                        {item.ext}
                      </span>
                      {saveExt === item.ext && (
                        <Check className="w-3.5 h-3.5 text-sky-400" />
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-slate-200 mt-0.5">
                      {item.label}
                    </span>
                    <span className="text-[9px] text-slate-500 mt-0.5 leading-tight">
                      {item.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-300 block">
                Select Export Format:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {EXPORT_FORMATS.map((item) => {
                  const isSelected = exportFormat === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setExportFormat(item.id)}
                      className={`flex flex-col text-left p-3 rounded-xl border transition ${
                        isSelected
                          ? `${item.color} shadow-sm`
                          : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          {item.icon}
                          <span className="font-semibold text-xs text-slate-200">
                            {item.label}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {item.ext}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1.5 leading-tight">
                        {item.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live Preview Box */}
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Target File:</span>
            <span className="text-xs font-mono font-semibold text-sky-300 truncate max-w-[320px]">
              {fullFileName}
            </span>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-5 py-2 rounded-xl font-semibold text-white shadow-lg flex items-center gap-1.5 transition ${
                mode === 'save-as'
                  ? 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
              }`}
            >
              {mode === 'save-as' ? (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save File</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Document</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

