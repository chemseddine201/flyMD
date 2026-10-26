import React from 'react';
import {
  FilePlus,
  FolderOpen,
  FolderTree,
  PanelLeft,
  Save,
  SaveAll,
  Copy,
  Check,
} from 'lucide-react';
import { useCopyToClipboard } from '../../../shared/hooks/useCopyToClipboard';
import { ExportMenuButton } from './ExportMenuButton';
import { ExportFormatId } from '../../services/export';

interface FileActionsGroupProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  onNew: () => void;
  onOpen: () => void;
  onOpenFolder?: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExport: (format: ExportFormatId) => void;
  onOpenExportDialog?: (format?: ExportFormatId) => void;
  onQuickCopy: () => void;
}

export const FileActionsGroup: React.FC<FileActionsGroupProps> = ({
  onToggleSidebar,
  isSidebarOpen,
  onNew,
  onOpen,
  onOpenFolder,
  onSave,
  onSaveAs,
  onExport,
  onOpenExportDialog,
  onQuickCopy,
}) => {
  const { copied, copy } = useCopyToClipboard();

  const handleCopyClick = () => {
    onQuickCopy();
    void copy('copied');
  };

  return (
    <div className="flex items-center gap-1 pr-2 border-r border-slate-800">
      {onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          title={isSidebarOpen ? 'Hide Project Explorer (Ctrl+B)' : 'Show Project Explorer (Ctrl+B)'}
          className={`p-1.5 rounded transition ${
            isSidebarOpen
              ? 'text-sky-400 bg-sky-950/60 border border-sky-500/30'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
          }`}
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      )}
      <button
        onClick={onNew}
        title="New File (Ctrl+N)"
        className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
      >
        <FilePlus className="w-4 h-4" />
      </button>
      <button
        onClick={onOpen}
        title="Open Markdown File (Ctrl+O)"
        className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
      >
        <FolderOpen className="w-4 h-4" />
      </button>
      {onOpenFolder && (
        <button
          onClick={onOpenFolder}
          title="Open & Supervise Project Folder (Ctrl+Shift+O)"
          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition"
        >
          <FolderTree className="w-4 h-4" />
        </button>
      )}
      <button
        onClick={onSave}
        title="Save Document (Ctrl+S)"
        className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded transition"
      >
        <Save className="w-4 h-4" />
      </button>
      <button
        onClick={onSaveAs}
        title="Save As... (Ctrl+Shift+S)"
        className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
      >
        <SaveAll className="w-4 h-4" />
      </button>

      {/* Multi-Format Export Dropdown (HTML, PDF, Textify, LaTeX) */}
      <ExportMenuButton onExport={onExport} onOpenExportDialog={onOpenExportDialog} />

      <button
        onClick={handleCopyClick}
        title={copied ? 'Copied Markdown to clipboard!' : 'Quick Copy Markdown content'}
        className={`p-1.5 rounded transition flex items-center gap-1 ${
          copied
            ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 shadow-sm'
            : 'text-slate-400 hover:text-sky-300 hover:bg-slate-800'
        }`}
      >
        {copied ? (
          <Check className="w-4 h-4 text-emerald-400 animate-in zoom-in-75 duration-150" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
        {copied && <span className="text-[10px] font-semibold text-emerald-400 pr-0.5">Copied!</span>}
      </button>
    </div>
  );
};
