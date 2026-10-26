import React from 'react';
import { Pin, PinOff } from 'lucide-react';

interface PinBadgeProps {
  isPinned: boolean;
  onToggle: () => void;
  className?: string;
}

export const PinBadge: React.FC<PinBadgeProps> = ({ isPinned, onToggle, className = '' }) => {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      title={
        isPinned
          ? 'Always on Top (Active) — Click to send to normal background'
          : 'Pin Always on Top — Click to stay visible above all windows'
      }
      className={`group relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 z-30 shadow-lg cursor-pointer ${
        isPinned
          ? 'bg-gradient-to-tr from-sky-500 to-blue-600 text-white ring-2 ring-sky-300/60 shadow-sky-500/50 scale-105 hover:scale-110'
          : 'bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-sky-300 border border-slate-700/80 shadow-black/40 hover:scale-105'
      } ${className}`}
    >
      {isPinned ? (
        <Pin className="w-4 h-4 fill-white drop-shadow-sm transition-transform group-hover:rotate-12" />
      ) : (
        <PinOff className="w-4 h-4 transition-transform group-hover:-rotate-12" />
      )}
    </button>
  );
};
