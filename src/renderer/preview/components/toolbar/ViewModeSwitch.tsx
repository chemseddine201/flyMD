import React from 'react';
import { Columns2, Eye, Code2, PenLine, Bot } from 'lucide-react';
import { ViewMode } from '../../../../shared/constants';

interface ViewModeSwitchProps {
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
}

export const ViewModeSwitch: React.FC<ViewModeSwitchProps> = ({
  viewMode,
  onChangeViewMode,
}) => {
  return (
    <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
      <button
        type="button"
        onClick={() => onChangeViewMode('wysiwyg')}
        title="WYSIWYG Visual Editor (Live Rich-Text editing)"
        className={`p-1.5 rounded flex items-center justify-center transition ${
          viewMode === 'wysiwyg' ? 'bg-sky-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <PenLine className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onChangeViewMode('split')}
        title="Split View (Editor + Preview)"
        className={`p-1.5 rounded flex items-center justify-center transition ${
          viewMode === 'split' ? 'bg-sky-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Columns2 className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onChangeViewMode('preview')}
        title="Preview Only"
        className={`p-1.5 rounded flex items-center justify-center transition ${
          viewMode === 'preview' ? 'bg-sky-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Eye className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onChangeViewMode('editor')}
        title="Source Code Editor Only"
        className={`p-1.5 rounded flex items-center justify-center transition ${
          viewMode === 'editor' ? 'bg-sky-600 text-white font-medium shadow-sm' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Code2 className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onChangeViewMode('agents')}
        title="Multi-Agent Workspace Supervisor & Handoff Hub"
        className={`p-1.5 rounded flex items-center justify-center transition ${
          viewMode === 'agents'
            ? 'bg-indigo-600 text-white font-semibold shadow-sm'
            : 'text-indigo-300 hover:text-white hover:bg-indigo-500/20'
        }`}
      >
        <Bot className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
