import React from 'react';
import { EyeOff } from 'lucide-react';
import { PinBadge } from './PinBadge';

interface HubControlsBarProps {
  isPinned: boolean;
  onTogglePin: () => void;
  onHideToTray: () => void;
}

export const HubControlsBar: React.FC<HubControlsBarProps> = ({
  isPinned,
  onTogglePin,
  onHideToTray,
}) => {
  return (
    <div className="flex items-center justify-between w-[140px] px-1 mb-2 z-30 min-h-[28px]">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onHideToTray();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        title="Hide to system tray (Click tray icon to restore)"
        className="opacity-0 group-hover/hub:opacity-100 pointer-events-none group-hover/hub:pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 hover:border-slate-600 text-[10px] font-medium transition-all duration-200 shadow-md cursor-pointer hover:shadow-sky-500/20"
      >
        <EyeOff className="w-3.5 h-3.5 text-slate-400 group-hover/hub:text-sky-400 transition-colors" />
        <span className="tracking-wide text-[10px]">Tray</span>
      </button>

      <PinBadge isPinned={isPinned} onToggle={onTogglePin} />
    </div>
  );
};
