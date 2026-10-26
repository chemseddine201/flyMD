import React, { useState, useRef } from 'react';
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Quote,
  Code,
  CheckSquare,
  Sigma,
  Table,
  MoreHorizontal,
} from 'lucide-react';
import { useClickOutside } from '../../../shared/hooks/useClickOutside';

interface MarkdownFormattingGroupProps {
  onFormat: (prefix: string, suffix?: string, defaultPlaceholder?: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const MarkdownFormattingGroup: React.FC<MarkdownFormattingGroupProps> = ({
  onFormat,
  onUndo,
  onRedo,
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  useClickOutside(menuContainerRef, () => setShowMoreMenu(false), showMoreMenu);

  const handleSelectFormat = (prefix: string, suffix = '', defaultPlaceholder = '') => {
    onFormat(prefix, suffix, defaultPlaceholder);
    setShowMoreMenu(false);
  };

  return (
    <div className="relative flex items-center gap-0.5 pl-2 border-l border-slate-800">
      {/* Undo / Redo */}
      {onUndo && (
        <button
          onClick={onUndo}
          title="Undo (Ctrl+Z)"
          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
      )}
      {onRedo && (
        <button
          onClick={onRedo}
          title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>
      )}

      {(onUndo || onRedo) && <div className="h-3.5 w-px bg-slate-800 mx-1" />}

      {/* Primary formatting buttons (Always visible) */}
      <button
        onClick={() => onFormat('**', '**', 'bold text')}
        title="Bold (**text**)"
        className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
      >
        <Bold className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => onFormat('*', '*', 'italic text')}
        title="Italic (*text*)"
        className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
      >
        <Italic className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => onFormat('`', '`', 'code')}
        title="Inline Code (`code`)"
        className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
      >
        <Code className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => onFormat('# ', '', 'Heading 1')}
        title="Heading 1 (# Heading)"
        className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
      >
        <Heading1 className="w-3.5 h-3.5" />
      </button>

      {/* Secondary buttons - Direct on wide screens (>= 1200px) */}
      <button
        onClick={() => onFormat('## ', '', 'Heading 2')}
        title="Heading 2 (## Heading)"
        className="hidden xl:inline-flex p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
      >
        <Heading2 className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => onFormat('~~', '~~', 'strikethrough')}
        title="Strikethrough (~~text~~)"
        className="hidden xl:inline-flex p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
      >
        <Strikethrough className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => onFormat('> ', '', 'Quote')}
        title="Blockquote (> quote)"
        className="hidden xl:inline-flex p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
      >
        <Quote className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => onFormat('- [ ] ', '', 'Task item')}
        title="Task Checklist (- [ ] item)"
        className="hidden xl:inline-flex p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
      >
        <CheckSquare className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => onFormat('$$\n', '\n$$', 'E = mc^2')}
        title="KaTeX Math Block ($$ math $$)"
        className="hidden xl:inline-flex p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
      >
        <Sigma className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() =>
          onFormat(
            '| Header 1 | Header 2 |\n| :--- | :--- |\n| Data 1 | Data 2 |\n',
            '',
            ''
          )
        }
        title="Insert Markdown Table"
        className="hidden xl:inline-flex p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition"
      >
        <Table className="w-3.5 h-3.5" />
      </button>

      {/* Overflow Dropdown Trigger (...) */}
      <div ref={menuContainerRef} className="relative inline-flex items-center">
        <button
          onClick={() => setShowMoreMenu((prev) => !prev)}
          title="More Markdown formatting tools"
          className={`p-1.5 rounded transition flex items-center justify-center ${
            showMoreMenu
              ? 'text-sky-400 bg-slate-800'
              : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
          }`}
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>

        {/* Dropdown Menu Popover */}
        {showMoreMenu && (
          <div
            className="absolute top-full left-0 mt-1.5 w-52 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-xl
                       shadow-[0_12px_32px_rgba(0,0,0,0.6)] py-1.5 z-50 text-slate-200 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/80 mb-1">
              Formatting Tools
            </div>

            <button
              onClick={() => handleSelectFormat('## ', '', 'Heading 2')}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-800/90 text-left text-xs transition group"
            >
              <Heading2 className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
              <div className="flex-1 flex items-center justify-between">
                <span>Heading 2</span>
                <span className="text-[10px] text-slate-500 font-mono">## H2</span>
              </div>
            </button>

            <button
              onClick={() => handleSelectFormat('### ', '', 'Heading 3')}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-800/90 text-left text-xs transition group"
            >
              <Heading2 className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
              <div className="flex-1 flex items-center justify-between">
                <span>Heading 3</span>
                <span className="text-[10px] text-slate-500 font-mono">### H3</span>
              </div>
            </button>

            <button
              onClick={() => handleSelectFormat('~~', '~~', 'strikethrough')}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-800/90 text-left text-xs transition group"
            >
              <Strikethrough className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
              <div className="flex-1 flex items-center justify-between">
                <span>Strikethrough</span>
                <span className="text-[10px] text-slate-500 font-mono">~~text~~</span>
              </div>
            </button>

            <button
              onClick={() => handleSelectFormat('> ', '', 'Quote')}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-800/90 text-left text-xs transition group"
            >
              <Quote className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
              <div className="flex-1 flex items-center justify-between">
                <span>Blockquote</span>
                <span className="text-[10px] text-slate-500 font-mono">&gt; quote</span>
              </div>
            </button>

            <button
              onClick={() => handleSelectFormat('```\n', '\n```', 'code here')}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-800/90 text-left text-xs transition group"
            >
              <Code className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <div className="flex-1 flex items-center justify-between">
                <span>Code Block</span>
                <span className="text-[10px] text-slate-500 font-mono">```code```</span>
              </div>
            </button>

            <button
              onClick={() => handleSelectFormat('- [ ] ', '', 'Task item')}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-800/90 text-left text-xs transition group"
            >
              <CheckSquare className="w-3.5 h-3.5 text-teal-400 group-hover:scale-110 transition-transform" />
              <div className="flex-1 flex items-center justify-between">
                <span>Task Checklist</span>
                <span className="text-[10px] text-slate-500 font-mono">- [ ]</span>
              </div>
            </button>

            <button
              onClick={() => handleSelectFormat('$$\n', '\n$$', 'E = mc^2')}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-800/90 text-left text-xs transition group"
            >
              <Sigma className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform" />
              <div className="flex-1 flex items-center justify-between">
                <span>KaTeX Math</span>
                <span className="text-[10px] text-slate-500 font-mono">$$...$$</span>
              </div>
            </button>

            <button
              onClick={() =>
                handleSelectFormat(
                  '| Header 1 | Header 2 |\n| :--- | :--- |\n| Data 1 | Data 2 |\n',
                  '',
                  ''
                )
              }
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-800/90 text-left text-xs transition group"
            >
              <Table className="w-3.5 h-3.5 text-violet-400 group-hover:scale-110 transition-transform" />
              <div className="flex-1 flex items-center justify-between">
                <span>Insert Table</span>
                <span className="text-[10px] text-slate-500 font-mono">| table |</span>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
