import React from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Accessibility,
} from 'lucide-react';
import { PreviewWidthMode } from '../../../../shared/types';

interface PreviewControlsPillProps {
  fontSize: number;
  onIncreaseFont: () => void;
  onDecreaseFont: () => void;
  onResetFont: () => void;
  widthMode: PreviewWidthMode;
  onChangeWidthMode: (mode: PreviewWidthMode) => void;
  onOpenAccessibility: () => void;
  isHighContrast?: boolean;
}

export const PreviewControlsPill: React.FC<PreviewControlsPillProps> = ({
  fontSize,
  onIncreaseFont,
  onDecreaseFont,
  onResetFont,
  widthMode,
  onChangeWidthMode,
  onOpenAccessibility,
  isHighContrast = false,
}) => {
  const getNextWidthMode = (): PreviewWidthMode => {
    if (widthMode === 'standard') return 'wide';
    if (widthMode === 'wide') return 'full';
    return 'standard';
  };

  const getWidthModeLabel = () => {
    switch (widthMode) {
      case 'full':
        return 'Full Width (100%)';
      case 'wide':
        return 'Wide Layout (1280px)';
      case 'standard':
      default:
        return 'Standard Layout (896px)';
    }
  };

  return (
    <div className="sticky top-3 right-4 z-20 float-right select-none ml-4 mb-2">
      <div
        className={`flex items-center gap-1 p-1 rounded-xl shadow-xl backdrop-blur-md transition-all duration-200 border ${
          isHighContrast
            ? 'bg-black border-2 border-yellow-400 text-yellow-400'
            : 'bg-slate-900/85 hover:bg-slate-900 border-slate-700/80 text-slate-300 hover:text-white shadow-black/50'
        }`}
      >
        {/* Decrease Font Size */}
        <button
          type="button"
          onClick={onDecreaseFont}
          disabled={fontSize <= 11}
          title="Decrease Font Size (Ctrl + -)"
          className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition text-slate-300 hover:text-sky-300 cursor-pointer"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        {/* Live Font Size Indicator & Reset Button */}
        <button
          type="button"
          onClick={onResetFont}
          title="Click to reset font size to default (15px)"
          className="px-2 py-0.5 rounded-md hover:bg-slate-800 font-mono text-[11px] font-semibold text-sky-400 hover:text-sky-300 transition flex items-center gap-1 cursor-pointer"
        >
          <span>{fontSize}px</span>
          {fontSize !== 15 && (
            <RotateCcw className="w-2.5 h-2.5 text-slate-400 hover:text-white" />
          )}
        </button>

        {/* Increase Font Size */}
        <button
          type="button"
          onClick={onIncreaseFont}
          disabled={fontSize >= 32}
          title="Increase Font Size (Ctrl + +)"
          className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition text-slate-300 hover:text-sky-300 cursor-pointer"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <div className="h-3.5 w-px bg-slate-700/80 mx-0.5" />

        {/* Width Mode Switcher */}
        <button
          type="button"
          onClick={() => onChangeWidthMode(getNextWidthMode())}
          title={`Reading Width: ${getWidthModeLabel()}. Click to cycle.`}
          className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-800 text-[11px] font-medium text-slate-300 hover:text-white transition cursor-pointer"
        >
          {widthMode === 'full' ? (
            <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : widthMode === 'wide' ? (
            <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
          ) : (
            <Minimize2 className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span className="capitalize hidden sm:inline text-[10px] font-mono">
            {widthMode}
          </span>
        </button>

        <div className="h-3.5 w-px bg-slate-700/80 mx-0.5" />

        {/* Accessibility Suite Shortcut */}
        <button
          type="button"
          onClick={onOpenAccessibility}
          title="Open Visual Accessibility Suite (High Contrast, Dyslexia Font, Large Print)"
          className="p-1.5 rounded-lg hover:bg-slate-800 text-amber-400 hover:text-amber-300 transition cursor-pointer"
        >
          <Accessibility className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

