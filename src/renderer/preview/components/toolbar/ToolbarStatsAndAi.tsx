import React from 'react';
import { Languages, Sun, Moon, Sparkles, Coffee, Settings, ListTree, Accessibility } from 'lucide-react';
import { AppSettings } from '../../../../shared/types';
import { TextDirection } from '../../../../shared/utils';
import { DirectionToggle } from './DirectionToggle';

interface ToolbarStatsAndAiProps {
  wordCount: number;
  readingTimeMin: number;
  ollamaModel: string;
  onOpenTranslate: () => void;
  onOpenSettings: () => void;
  onOpenAccessibility?: () => void;
  currentTheme: AppSettings['theme'];
  onToggleTheme: () => void;
  direction?: TextDirection;
  content?: string;
  onToggleDirection?: () => void;
  isOutlineOpen?: boolean;
  onToggleOutline?: () => void;
}

export const ToolbarStatsAndAi: React.FC<ToolbarStatsAndAiProps> = ({
  wordCount,
  readingTimeMin,
  ollamaModel,
  onOpenTranslate,
  onOpenSettings,
  onOpenAccessibility,
  currentTheme,
  onToggleTheme,
  direction,
  content,
  onToggleDirection,
  isOutlineOpen,
  onToggleOutline,
}) => {
  const getThemeIcon = () => {
    switch (currentTheme) {
      case 'light':
        return <Sun className="w-3.5 h-3.5 text-amber-500" />;
      case 'tokyo-night':
        return <Moon className="w-3.5 h-3.5 text-indigo-400" />;
      case 'catppuccin':
        return <Sparkles className="w-3.5 h-3.5 text-rose-300" />;
      case 'dracula':
        return <Sparkles className="w-3.5 h-3.5 text-purple-400" />;
      case 'cyber':
        return <Sparkles className="w-3.5 h-3.5 text-cyan-400" />;
      case 'sepia':
        return <Coffee className="w-3.5 h-3.5 text-amber-600" />;
      case 'high-contrast':
        return <Sun className="w-3.5 h-3.5 text-yellow-400" />;
      case 'dark':
      default:
        return <Moon className="w-3.5 h-3.5 text-sky-400" />;
    }
  };

  return (
    <div className="flex items-center gap-2 shrink-0">
      {onToggleDirection && (
        <DirectionToggle
          direction={direction}
          content={content}
          onToggle={onToggleDirection}
        />
      )}

      <button
        type="button"
        onClick={onOpenTranslate}
        title={`AI Translate with local Ollama / custom LLM (${ollamaModel || 'AI Model'}) (Ctrl+T)`}
        className="p-1.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500
                   text-white font-medium rounded-lg shadow-sm shadow-sky-600/30 transition duration-150 group"
      >
        <Languages className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
      </button>

      <div className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] text-slate-400 bg-slate-950/60 rounded border border-slate-800/60">
        <span>{wordCount} <span className="hidden sm:inline">words</span><span className="sm:hidden">w</span></span>
        <span>•</span>
        <span>~{readingTimeMin}m <span className="hidden sm:inline">read</span></span>
      </div>

      <button
        onClick={onToggleTheme}
        title={`Current Theme: ${currentTheme}. Click to cycle.`}
        className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
      >
        {getThemeIcon()}
      </button>

      {onOpenAccessibility && (
        <button
          onClick={onOpenAccessibility}
          title="Visual Accessibility Suite (High Contrast, Dyslexia Font, Large Print)"
          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition"
        >
          <Accessibility className="w-3.5 h-3.5" />
        </button>
      )}

      <button
        onClick={onOpenSettings}
        title="FlyMD Settings"
        className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
      >
        <Settings className="w-3.5 h-3.5" />
      </button>

      {onToggleOutline && (
        <button
          onClick={onToggleOutline}
          title={isOutlineOpen ? 'Hide Document Outline' : 'Show Document Outline'}
          className={`p-1.5 rounded transition flex items-center gap-1 ${
            isOutlineOpen
              ? 'text-sky-400 bg-sky-950/60 border border-sky-500/30'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
          }`}
        >
          <ListTree className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
