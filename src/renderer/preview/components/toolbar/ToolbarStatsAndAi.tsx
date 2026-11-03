import React from 'react';
import {
  Languages,
  Sun,
  SunMedium,
  Moon,
  MoonStar,
  Sparkles,
  Flame,
  Coffee,
  Zap,
  Eye,
  Settings,
  ListTree,
  Accessibility,
  Monitor,
} from 'lucide-react';
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
      case 'system':
        return <Monitor className="w-3.5 h-3.5 text-sky-500" />;
      case 'light':
        return <Sun className="w-3.5 h-3.5 text-amber-500" />;
      case 'clean-white':
        return <SunMedium className="w-3.5 h-3.5 text-emerald-500" />;
      case 'tokyo-night':
        return <MoonStar className="w-3.5 h-3.5 text-indigo-400" />;
      case 'catppuccin':
        return <Sparkles className="w-3.5 h-3.5 text-rose-400" />;
      case 'dracula':
        return <Flame className="w-3.5 h-3.5 text-purple-400" />;
      case 'cyber':
        return <Zap className="w-3.5 h-3.5 text-cyan-400" />;
      case 'sepia':
        return <Coffee className="w-3.5 h-3.5 text-amber-600" />;
      case 'high-contrast':
        return <Eye className="w-3.5 h-3.5 text-amber-600 dark:text-yellow-400" />;
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
                   text-white font-medium rounded-lg shadow-xs shadow-sky-600/30 transition duration-150 group"
      >
        <Languages className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
      </button>

      <div className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-950/60 rounded border border-slate-300 dark:border-slate-800/60 font-medium">
        <span>{wordCount} <span className="hidden sm:inline">words</span><span className="sm:hidden">w</span></span>
        <span>•</span>
        <span>~{readingTimeMin}m <span className="hidden sm:inline">read</span></span>
      </div>

      <button
        onClick={onToggleTheme}
        title={`Current Theme: ${currentTheme}. Click to cycle.`}
        className="p-1.5 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition"
      >
        {getThemeIcon()}
      </button>

      {onOpenAccessibility && (
        <button
          onClick={onOpenAccessibility}
          title="Visual Accessibility Suite (High Contrast, Dyslexia Font, Large Print)"
          className="p-1.5 text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition"
        >
          <Accessibility className="w-3.5 h-3.5" />
        </button>
      )}

      <button
        onClick={onOpenSettings}
        title="FlyMD Settings"
        className="p-1.5 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition"
      >
        <Settings className="w-3.5 h-3.5" />
      </button>

      {onToggleOutline && (
        <button
          onClick={onToggleOutline}
          title={isOutlineOpen ? 'Hide Document Outline' : 'Show Document Outline'}
          className={`p-1.5 rounded transition flex items-center gap-1 ${
            isOutlineOpen
              ? 'text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-500/30'
              : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          <ListTree className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
