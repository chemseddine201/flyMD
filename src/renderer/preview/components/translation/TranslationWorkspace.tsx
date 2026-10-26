import React from 'react';
import { SUPPORTED_LANGUAGES } from '../../../../shared/constants';
import {
  Play,
  Square,
  Copy,
  Check,
  PlusCircle,
  Replace,
  ArrowDownToLine,
  FileDown,
  Sparkles,
} from 'lucide-react';
import { useCopyToClipboard } from '../../../shared/hooks/useCopyToClipboard';

interface TranslationWorkspaceProps {
  sourceText: string;
  streamedText: string;
  isTranslating: boolean;
  targetLang: string;
  onChangeTargetLang: (lang: string) => void;
  customLangInput: string;
  onChangeCustomLangInput: (val: string) => void;
  scope: 'selection' | 'full';
  onChangeScope: (scope: 'selection' | 'full') => void;
  hasSelection: boolean;
  onStartTranslate: () => void;
  onAbortTranslate: () => void;
  onOpenAsNewTab: () => void;
  onReplaceContent: () => void;
  onInsertBelow: () => void;
  onSaveAsFile: () => void;
  activeModelName: string;
}

export const TranslationWorkspace: React.FC<TranslationWorkspaceProps> = ({
  sourceText,
  streamedText,
  isTranslating,
  targetLang,
  onChangeTargetLang,
  customLangInput,
  onChangeCustomLangInput,
  scope,
  onChangeScope,
  hasSelection,
  onStartTranslate,
  onAbortTranslate,
  onOpenAsNewTab,
  onReplaceContent,
  onInsertBelow,
  onSaveAsFile,
  activeModelName,
}) => {
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className="flex flex-col gap-3">
      {/* Target Language & Scope Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">Target Language:</span>
          <select
            value={targetLang}
            onChange={(e) => onChangeTargetLang(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-sky-500 font-medium text-xs"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.name}>
                {l.name}
              </option>
            ))}
            <option value="custom">Custom Language...</option>
          </select>

          {targetLang === 'custom' && (
            <input
              type="text"
              value={customLangInput}
              onChange={(e) => onChangeCustomLangInput(e.target.value)}
              placeholder="e.g. Esperanto, Latin"
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 text-xs w-36"
            />
          )}
        </div>

        {/* Scope selector */}
        {hasSelection && (
          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => onChangeScope('selection')}
              className={`px-2 py-0.5 rounded transition text-[11px] ${
                scope === 'selection' ? 'bg-sky-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Selection only
            </button>
            <button
              type="button"
              onClick={() => onChangeScope('full')}
              className={`px-2 py-0.5 rounded transition text-[11px] ${
                scope === 'full' ? 'bg-sky-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Full document
            </button>
          </div>
        )}

        {/* Start / Abort Action */}
        <div>
          {isTranslating ? (
            <button
              type="button"
              onClick={onAbortTranslate}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium flex items-center gap-1.5 shadow-sm transition"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Cancel</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onStartTranslate}
              className="px-3.5 py-1 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-sm shadow-sky-600/30 transition group"
            >
              <Play className="w-3.5 h-3.5 fill-current group-hover:scale-110 transition-transform" />
              <span>Translate with {activeModelName}</span>
            </button>
          )}
        </div>
      </div>

      {/* Split preview: Source vs Translated Result */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-80">
        {/* Source Text Preview */}
        <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
          <div className="h-7 px-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span>Original ({scope === 'selection' ? 'Selection' : 'Full Document'})</span>
            <span className="text-[10px] text-slate-500">{sourceText.length} chars</span>
          </div>
          <div className="p-3 overflow-y-auto flex-1 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap select-text">
            {sourceText || <span className="text-slate-600 italic">No content selected</span>}
          </div>
        </div>

        {/* Streamed Result Preview */}
        <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
          <div className="h-7 px-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] font-medium">
            <span className="text-sky-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-sky-400" />
              <span>Translated Markdown ({targetLang === 'custom' ? customLangInput || 'Custom' : targetLang})</span>
            </span>
            {isTranslating && (
              <span className="text-[10px] text-sky-400 animate-pulse font-semibold">Streaming...</span>
            )}
          </div>
          <div className="p-3 overflow-y-auto flex-1 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap select-text">
            {streamedText ? (
              streamedText
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600 italic text-center p-4">
                {isTranslating ? 'Receiving streamed AI translation...' : 'Translated markdown will appear here in real-time...'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions Toolbar on Translated Content */}
      {streamedText && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-900/90 rounded-xl border border-slate-800 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenAsNewTab}
              title="Open translated markdown in a new non-saved tab"
              className="px-2.5 py-1.5 text-white bg-sky-600 hover:bg-sky-500 rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition font-medium"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Open in New Tab</span>
            </button>

            <button
              type="button"
              onClick={onReplaceContent}
              title="Replace original content with translated markdown"
              className="px-2.5 py-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg text-xs flex items-center gap-1.5 transition"
            >
              <Replace className="w-3.5 h-3.5" />
              <span>Replace</span>
            </button>

            <button
              type="button"
              onClick={onInsertBelow}
              title="Insert translated markdown below the original content"
              className="px-2.5 py-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg text-xs flex items-center gap-1.5 transition"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              <span>Insert Below</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void copy(streamedText)}
              title="Copy translated text to clipboard"
              className="px-2.5 py-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg text-xs flex items-center gap-1.5 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={onSaveAsFile}
              title="Save translated markdown as a new file"
              className="px-2.5 py-1.5 text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition font-medium"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Save As...</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

