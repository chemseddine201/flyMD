import React from 'react';
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

        <ViewModeSwitch
          viewMode={viewMode}
          onChangeViewMode={onChangeViewMode}
        />

        {viewMode !== 'preview' && (
          <MarkdownFormattingGroup
            onFormat={onFormat}
            onUndo={onUndo}
            onRedo={onRedo}
          />
        )}
      </div>

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
  );
};
