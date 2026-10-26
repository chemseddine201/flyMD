import React, { useState, useRef } from 'react';
import { HistoryItem } from '../../../shared/types';
import { HistoryPopover } from './HistoryPopover';
import { HubControlsBar } from './HubControlsBar';
import { Clock, FileText, FolderTree, ArrowDownToLine } from 'lucide-react';
import { useWindowDrag } from '../../shared/hooks/useWindowDrag';
import { useClickOutside } from '../../shared/hooks/useClickOutside';
import { useFileDrop } from '../../shared/hooks/useFileDrop';

interface CircleHubProps {
  history: HistoryItem[];
  isPinned: boolean;
  onTogglePin: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onSelectHistoryFile: (path: string) => void;
  onRemoveHistoryItem: (id: string, e: React.MouseEvent) => void;
  onClearHistory: () => void;
  onFileDrop: (filePath: string) => void;
  onHideToTray: () => void;
  hasNewFilesDot?: boolean;
  runningAgentsCount?: number;
}

export const CircleHub: React.FC<CircleHubProps> = ({
  history,
  isPinned,
  onTogglePin,
  onOpenFile,
  onOpenFolder,
  onSelectHistoryFile,
  onRemoveHistoryItem,
  onClearHistory,
  onFileDrop,
  onHideToTray,
  hasNewFilesDot = false,
  runningAgentsCount = 0,
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const hubContainerRef = useRef<HTMLDivElement>(null);

  const { isDragging, handleMouseDown } = useWindowDrag();

  useClickOutside(hubContainerRef, () => setShowHistory(false), showHistory);

  const { isDragOver, dropZoneProps } = useFileDrop({ onFileDrop });

  return (
    <div
      ref={hubContainerRef}
      onMouseDown={handleMouseDown}
      className={`relative flex flex-col items-center justify-center p-3 select-none group/hub ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      {...dropZoneProps}
    >
      <HistoryPopover
        history={history}
        isOpen={showHistory}
        onSelectFile={(path) => {
          setShowHistory(false);
          onSelectHistoryFile(path);
        }}
        onRemoveItem={onRemoveHistoryItem}
        onClearHistory={onClearHistory}
        onClose={() => setShowHistory(false)}
      />

      <HubControlsBar
        isPinned={isPinned}
        onTogglePin={onTogglePin}
        onHideToTray={onHideToTray}
      />

      <div
        className={`relative w-[140px] h-[140px] rounded-full transition-all duration-300
                    flex flex-col overflow-hidden shadow-2xl border-2 ${
                      isDragging
                        ? 'cursor-grabbing scale-[1.02] ring-2 ring-sky-400 shadow-sky-500/50'
                        : 'cursor-grab glass-circle hover:shadow-sky-500/30'
                    } ${
                      isDragOver
                        ? 'ring-4 ring-sky-400 scale-105 bg-sky-950/95 border-sky-400 shadow-sky-500/60'
                        : ''
                    }`}
        title="Click items to open, or hold click & drag to move"
      >
        {isDragOver && (
          <div className="absolute inset-0 z-40 rounded-full flex flex-col items-center justify-center
                          bg-sky-600/95 text-white animate-pulse pointer-events-none shadow-inner">
            <ArrowDownToLine className="w-8 h-8 mb-1 animate-bounce" />
            <span className="text-[11px] font-bold tracking-wider uppercase text-center px-2">
              Drop Markdown Here
            </span>
          </div>
        )}

        <div
          onClick={(e) => {
            e.stopPropagation();
            setShowHistory((prev) => !prev);
          }}
          className={`relative w-full h-1/2 flex flex-col items-center justify-center pt-3.5
                     transition duration-150 border-b border-sky-400/25 group/history ${
                       isDragging ? 'cursor-grabbing' : 'cursor-grab hover:cursor-pointer'
                     } ${
                       showHistory
                         ? 'bg-sky-500/35 text-sky-200'
                         : 'bg-gradient-to-b from-sky-500/15 to-transparent hover:from-sky-500/30 text-slate-100'
                     }`}
          title="Click to toggle recent files, or hold click & drag to move"
        >
          <div className="relative">
            <Clock className="w-4 h-4 text-sky-400 group-hover/history:scale-110 transition-transform mb-0.5" />
            {hasNewFilesDot && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </div>
          <span className="text-[9px] text-sky-400/80 font-mono">
            {runningAgentsCount > 0
              ? `${runningAgentsCount} agent active`
              : history.length > 0
              ? `${history.length} recent`
              : 'Empty'}
          </span>
        </div>

        <div className="relative w-full h-1/2 flex items-center">
          <div
            onClick={onOpenFile}
            className={`w-1/2 h-full flex flex-col items-center justify-center pb-2.5 pt-1.5
                       bg-gradient-to-tr from-emerald-500/15 to-transparent hover:from-emerald-500/35
                       transition duration-150 border-r border-sky-400/20 group/file ${
                         isDragging ? 'cursor-grabbing' : 'cursor-grab hover:cursor-pointer'
                       }`}
            title="Click to open Markdown file, or hold click & drag to move"
          >
            <FileText className="w-4 h-4 text-emerald-400 group-hover/file:scale-110 transition-transform mb-1" />
          </div>

          <div
            onClick={onOpenFolder}
            className={`w-1/2 h-full flex flex-col items-center justify-center pb-2.5 pt-1.5
                       bg-gradient-to-tl from-amber-500/15 to-transparent hover:from-amber-500/35
                       transition duration-150 group/folder ${
                         isDragging ? 'cursor-grabbing' : 'cursor-grab hover:cursor-pointer'
                       }`}
            title="Click to supervise folder, or hold click & drag to move"
          >
            <FolderTree className="w-4 h-4 text-amber-400 group-hover/folder:scale-110 transition-transform mb-1" />
          </div>
        </div>
      </div>
    </div>
  );
};
