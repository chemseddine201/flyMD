import React from 'react';
import { Bot } from 'lucide-react';
import { AppSettings } from '../../../shared/types';
import { ViewMode } from '../../../shared/constants';
import { TextDirection } from '../../../shared/utils';
import { FileActionsGroup } from './toolbar/FileActionsGroup';
import { ViewModeSwitch } from './toolbar/ViewModeSwitch';
import { MarkdownFormattingGroup } from './toolbar/MarkdownFormattingGroup';
import { ToolbarStatsAndAi } from './toolbar/ToolbarStatsAndAi';
import { ExportFormatId } from '../services/export';

interface ToolbarProps {
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  onNew: () => void;
  onOpen: () => void;
  onOpenFolder?: () => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  onSave: () => void;
  onSaveAs: () => void;
  onExport: (format: ExportFormatId) => void;
  onOpenExportDialog?: (format?: ExportFormatId) => void;
  onQuickCopy: () => void;
  onFormat: (prefix: string, suffix?: string, defaultPlaceholder?: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onOpenTranslate: () => void;
  onOpenSettings: () => void;
  onOpenAccessibility?: () => void;
  currentTheme: AppSettings['theme'];
  onToggleTheme: () => void;
  wordCount: number;
  readingTimeMin: number;
  ollamaModel: string;
  direction?: TextDirection;
  content?: string;
  onToggleDirection?: () => void;
  isOutlineOpen?: boolean;
  onToggleOutline?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  viewMode,
  onChangeViewMode,
  onNew,
  onOpen,
  onOpenFolder,
  onToggleSidebar,
  isSidebarOpen = false,
  onSave,
  onSaveAs,
  onExport,
  onOpenExportDialog,
  onQuickCopy,
  onFormat,
  onUndo,
  onRedo,
  onOpenTranslate,
  onOpenSettings,
  onOpenAccessibility,
  currentTheme,
  onToggleTheme,
  wordCount,
  readingTimeMin,
  ollamaModel,
  direction = 'auto',
  content = '',
  onToggleDirection,
  isOutlineOpen = false,
  onToggleOutline,
}) => {
  return (
    <div className="w-full flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 px-3 py-1.5 min-h-[40px] bg-slate-900 border-b border-slate-800 text-xs shrink-0 select-none relative z-40 transition-all duration-150">
      {/* Left: Document Operations, Dedicated File View Types & Formatting */}
      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        <FileActionsGroup
          onToggleSidebar={onToggleSidebar}
          isSidebarOpen={isSidebarOpen}
          onNew={onNew}
          onOpen={onOpen}
          onOpenFolder={onOpenFolder}
          onSave={onSave}
          onSaveAs={onSaveAs}
          onExport={onExport}
          onOpenExportDialog={onOpenExportDialog}
          onQuickCopy={onQuickCopy}
        />

        <div className="h-4 w-px bg-slate-800 mx-0.5" />

        {/* ViewModeSwitch now strictly contains the 4 document view types */}
        <ViewModeSwitch
          viewMode={viewMode}
          onChangeViewMode={onChangeViewMode}
        />

        {viewMode !== 'preview' && viewMode !== 'agents' && (
          <>
            <div className="h-4 w-px bg-slate-800 mx-0.5" />
            <MarkdownFormattingGroup
              onFormat={onFormat}
              onUndo={onUndo}
              onRedo={onRedo}
            />
          </>
        )}
      </div>

      {/* Right: Standalone General Workspace Controller & Document Stats */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Dedicated Agents Studio General Controller Button */}
        <button
          type="button"
          onClick={() => onChangeViewMode(viewMode === 'agents' ? 'wysiwyg' : 'agents')}
          title="General Workspace Controller: Multi-Agent Studio & Discussion Hub"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all shadow-sm ${
            viewMode === 'agents'
              ? 'bg-indigo-600 border-indigo-400 text-white shadow-indigo-600/30 ring-1 ring-indigo-400/50'
              : 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300 hover:bg-indigo-900/60 hover:text-white hover:border-indigo-400'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Agents Studio</span>
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 font-mono">
            Hub
          </span>
        </button>

        <ToolbarStatsAndAi
          onOpenTranslate={onOpenTranslate}
          onOpenSettings={onOpenSettings}
          onOpenAccessibility={onOpenAccessibility}
          currentTheme={currentTheme}
          onToggleTheme={onToggleTheme}
          wordCount={wordCount}
          readingTimeMin={readingTimeMin}
          ollamaModel={ollamaModel}
          direction={direction}
          content={content}
          onToggleDirection={onToggleDirection}
          isOutlineOpen={isOutlineOpen}
          onToggleOutline={onToggleOutline}
        />
      </div>
    </div>
  );
};
