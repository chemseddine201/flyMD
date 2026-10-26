import React from 'react';
import { Minus, Square, Copy, X, Pin, PinOff, Circle } from 'lucide-react';
import { AppLogo } from './AppLogo';

interface TitleBarProps {
  fileName: string;
  filePath: string;
  isDirty: boolean;
  isPinned: boolean;
  onTogglePin: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  fileName,
  filePath,
  isDirty,
  isPinned,
  onTogglePin,
  onMinimize,
  onMaximize,
  onClose,
}) => {
  return (
    <div
      style={{ WebkitAppRegion: 'drag' } as any}
      className="h-9 w-full flex items-center justify-between px-3 bg-slate-950/90 border-b border-slate-800
                 text-slate-300 select-none z-50 text-xs shrink-0"
    >
      {/* Left: App Logo & Current File */}
      <div className="flex items-center gap-2 min-w-0" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <AppLogo size={22} className="shrink-0 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]" />
        <span className="font-bold text-sky-400 text-xs tracking-wider">FlyMD</span>
        <span className="text-slate-600 font-mono">|</span>
        <span className="font-semibold text-slate-100 truncate">
          {fileName || 'Untitled.md'}
        </span>
        {isDirty && (
          <span title="Unsaved changes" className="flex items-center text-amber-400">
            <Circle className="w-2 h-2 fill-current" />
          </span>
        )}
        {filePath && (
          <span className="text-[10px] text-slate-500 truncate max-w-sm hidden sm:inline" title={filePath}>
            — {filePath}
          </span>
        )}
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
        {/* Pin on Top */}
        <button
          onClick={onTogglePin}
          title={isPinned ? 'Always on Top (Active) — Click to unpin' : 'Pin Always on Top'}
          className={`flex items-center gap-1 px-2 py-1 rounded transition text-[11px] font-medium ${
            isPinned
              ? 'text-sky-300 bg-sky-500/25 border border-sky-400/50 shadow-sm shadow-sky-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-sky-400 text-sky-400' : ''}`} />
          <span className="text-[10px] hidden sm:inline">{isPinned ? 'Pinned' : 'Pin'}</span>
        </button>

        {/* Minimize */}
        <button
          onClick={onMinimize}
          title="Minimize"
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Maximize */}
        <button
          onClick={onMaximize}
          title="Maximize / Restore"
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
        >
          <Square className="w-3.5 h-3.5" />
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          title="Close"
          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 rounded transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
