import React from 'react';
import { FileText, FolderOpen, Plus } from 'lucide-react';
import { AppLogo } from './AppLogo';

interface EmptyWorkspaceViewProps {
  onOpenFile?: () => void;
  onOpenFolder?: () => void;
  onNewFile?: () => void;
}

export const EmptyWorkspaceView: React.FC<EmptyWorkspaceViewProps> = ({
  onOpenFile,
  onOpenFolder,
  onNewFile,
}) => {
  return (
    <div className="flex-1 w-full h-full flex flex-col items-center justify-center p-8 bg-slate-950/70 select-none overflow-y-auto">
      <div className="max-w-2xl w-full flex flex-col items-center text-center space-y-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center space-y-3">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-2xl blur-lg opacity-40 group-hover:opacity-75 transition duration-500" />
            <div className="relative w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700/80 flex items-center justify-center shadow-xl">
              <AppLogo size={36} className="drop-shadow-[0_0_12px_rgba(56,189,248,0.6)]" />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center justify-center gap-2">
              <span>FlyMD Studio</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium">
                v2.0
              </span>
            </h1>
            <p className="text-xs text-slate-400 max-w-md">
              Fast, cross-platform Markdown workspace with live folder supervision, KaTeX, Mermaid & split preview.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
          <button
            type="button"
            onClick={onOpenFile}
            className="group relative flex flex-col items-start p-4 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-sky-500/50 shadow-lg hover:shadow-sky-500/10 transition-all duration-200 text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform mb-3">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex items-center justify-between w-full mb-1">
              <span className="font-semibold text-sm text-slate-200 group-hover:text-white transition">
                Open File
              </span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono">
                Ctrl+O
              </kbd>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Open an existing Markdown document from your drive.
            </p>
          </button>

          <button
            type="button"
            onClick={onOpenFolder}
            className="group relative flex flex-col items-start p-4 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/50 shadow-lg hover:shadow-amber-500/10 transition-all duration-200 text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform mb-3">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div className="flex items-center justify-between w-full mb-1">
              <span className="font-semibold text-sm text-slate-200 group-hover:text-white transition">
                Open Folder
              </span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono">
                Ctrl+Shift+O
              </kbd>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Supervise a workspace directory with live folder watching.
            </p>
          </button>

          <button
            type="button"
            onClick={onNewFile}
            className="group relative flex flex-col items-start p-4 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-emerald-500/50 shadow-lg hover:shadow-emerald-500/10 transition-all duration-200 text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform mb-3">
              <Plus className="w-5 h-5" />
            </div>
            <div className="flex items-center justify-between w-full mb-1">
              <span className="font-semibold text-sm text-slate-200 group-hover:text-white transition">
                New File
              </span>
              <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 font-mono">
                Ctrl+N
              </kbd>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Start writing notes or documentation in a blank canvas.
            </p>
          </button>
        </div>

        <div className="w-full pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400">
                Ctrl+B
              </kbd>
              <span>Toggle Sidebar</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400">
                Ctrl+S
              </kbd>
              <span>Save</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400">
                Ctrl+W
              </kbd>
              <span>Close Tab</span>
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Drag & drop files or folders anywhere to open
          </span>
        </div>
      </div>
    </div>
  );
};
