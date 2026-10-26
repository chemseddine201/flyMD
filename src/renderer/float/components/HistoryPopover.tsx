import React from 'react';
import { HistoryItem } from '../../../shared/types';
import { FileText, Clock, Trash2, X, FolderOpen } from 'lucide-react';

interface HistoryPopoverProps {
  history: HistoryItem[];
  isOpen: boolean;
  onSelectFile: (path: string) => void;
  onRemoveItem: (id: string, e: React.MouseEvent) => void;
  onClearHistory: () => void;
  onClose: () => void;
}

export const HistoryPopover: React.FC<HistoryPopoverProps> = ({
  history,
  isOpen,
  onSelectFile,
  onRemoveItem,
  onClearHistory,
  onClose,
}) => {
  if (!isOpen) return null;

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute bottom-[185px] left-1/2 -translate-x-1/2 w-[340px] max-h-[320px] flex flex-col
                 bg-slate-900/95 backdrop-blur-2xl border border-sky-500/40 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)]
                 text-slate-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-800/90 border-b border-slate-700/70 select-none shrink-0">
        <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
          <Clock className="w-3.5 h-3.5" />
          <span>Recent Files ({history.length})</span>
        </div>
        <div className="flex items-center gap-1.5">
          {history.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClearHistory();
              }}
              title="Clear all history"
              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-700/60 rounded transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Close"
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 rounded transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="overflow-y-auto max-h-[250px] divide-y divide-slate-800/60 p-1.5 space-y-0.5">
        {history.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
            <FolderOpen className="w-8 h-8 text-slate-600 stroke-[1.5]" />
            <span>No Markdown files opened yet</span>
          </div>
        ) : (
          history.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectFile(item.path)}
              className="group/item flex items-center justify-between p-2 hover:bg-sky-500/15 rounded-lg cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <FileText className="w-4 h-4 text-sky-400 group-hover/item:text-sky-300 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-100 truncate group-hover/item:text-sky-300">
                    {item.name}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate opacity-80" title={item.path}>
                    {item.path}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <span className="text-[10px] text-slate-400 font-mono">
                  {formatTime(item.lastOpened)}
                </span>
                <button
                  onClick={(e) => onRemoveItem(item.id, e)}
                  title="Remove from history"
                  className="opacity-0 group-hover/item:opacity-100 p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Subtle Downward Pointer Notch */}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-slate-900 border-r border-b border-sky-500/40 pointer-events-none" />
    </div>
  );
};
