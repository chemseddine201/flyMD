import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { markdownService } from '../services/MarkdownService';
import { htmlToMarkdown } from '../utils/htmlToMarkdown';
import { resolveDirection, TextDirection } from '../../../shared/utils';
import { AppTheme } from '../../../shared/types';
import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css';
import '../../styles/markdown.css';

interface WysiwygEditorProps {
  value: string;
  onChange: (val: string) => void;
  theme?: AppTheme;
  direction?: TextDirection;
  fontSize?: number;
  editorRef?: React.MutableRefObject<any>;
}

export const WysiwygEditor: React.FC<WysiwygEditorProps> = ({
  value,
  onChange,
  theme = 'dark',
  direction = 'auto',
  fontSize = 15,
  editorRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isTypingRef = useRef<boolean>(false);
  const lastSerializedMdRef = useRef<string>(value);

  const resolvedDir = useMemo(
    () => resolveDirection(direction, value),
    [direction, value]
  );

  // Sync external Markdown value to DOM when not user typing
  useEffect(() => {
    if (isTypingRef.current) return;
    if (value === lastSerializedMdRef.current && containerRef.current?.innerHTML) return;

    if (containerRef.current) {
      const html = markdownService.render(value);
      containerRef.current.innerHTML = html;
      lastSerializedMdRef.current = value;
    }
  }, [value]);

  // Handle live DOM changes
  const handleInput = useCallback(() => {
    if (!containerRef.current) return;
    isTypingRef.current = true;

    const newMd = htmlToMarkdown(containerRef.current);
    lastSerializedMdRef.current = newMd;
    onChange(newMd);

    setTimeout(() => {
      isTypingRef.current = false;
    }, 100);
  }, [onChange]);

  // Handle task checklist clicks
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
        setTimeout(handleInput, 10);
      }
    },
    [handleInput]
  );

  // Keyboard shortcuts (Undo, Redo, Bold, Italic, Headings)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (e.key === 'z' || e.key === 'Z') {
        if (e.shiftKey) {
          e.preventDefault();
          document.execCommand('redo');
          handleInput();
        } else {
          e.preventDefault();
          document.execCommand('undo');
          handleInput();
        }
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        document.execCommand('redo');
        handleInput();
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        document.execCommand('bold');
        handleInput();
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        document.execCommand('italic');
        handleInput();
      }
    }
  };

  // Expose rich editing commands to toolbar via editorRef
  useEffect(() => {
    if (!editorRef) return;

    const editorApi = {
      isWysiwyg: true,
      focus: () => containerRef.current?.focus(),
      undo: () => {
        document.execCommand('undo');
        handleInput();
      },
      redo: () => {
        document.execCommand('redo');
        handleInput();
      },
      format: (prefix: string, suffix = '', defaultPlaceholder = '') => {
        containerRef.current?.focus();
        const selection = window.getSelection();

        if (prefix === '**') {
          document.execCommand('bold');
        } else if (prefix === '*') {
          document.execCommand('italic');
        } else if (prefix === '~~') {
          document.execCommand('strikeThrough');
        } else if (prefix === '# ') {
          document.execCommand('formatBlock', false, '<h1>');
        } else if (prefix === '## ') {
          document.execCommand('formatBlock', false, '<h2>');
        } else if (prefix === '> ') {
          document.execCommand('formatBlock', false, '<blockquote>');
        } else if (prefix.startsWith('- [ ]')) {
          document.execCommand('insertHTML', false, '<p><input type="checkbox" /> Task item</p>');
        } else if (prefix.startsWith('```')) {
          document.execCommand('insertHTML', false, '<pre><code>// Code here</code></pre>');
        } else if (prefix.startsWith('|')) {
          document.execCommand(
            'insertHTML',
            false,
            '<table><thead><tr><th>Header 1</th><th>Header 2</th></tr></thead><tbody><tr><td>Cell 1</td><td>Cell 2</td></tr></tbody></table>'
          );
        } else {
          document.execCommand('insertText', false, `${prefix}${defaultPlaceholder}${suffix}`);
        }
        handleInput();
      },
      // CodeMirror-compatible mock state for outline navigation / search
      state: {
        doc: {
          line: (lineNum: number) => ({
            from: 0,
            to: 0,
            number: lineNum,
          }),
        },
        selection: {
          main: { from: 0, to: 0 },
        },
        sliceDoc: () => '',
      },
      dispatch: () => {},
    };

    editorRef.current = editorApi;
  }, [editorRef, handleInput]);

  const getThemeClass = () => {
    switch (theme) {
      case 'light':
        return 'bg-white text-slate-800';
      case 'cyber':
        return 'bg-black text-emerald-300';
      case 'sepia':
        return 'bg-[#fbf0d9] text-[#433422]';
      case 'dark':
      default:
        return 'bg-slate-900 text-slate-100';
    }
  };

  return (
    <div
      dir={resolvedDir}
      className={`h-full w-full flex flex-col overflow-y-auto px-6 py-6 transition-colors duration-200 outline-none select-text ${getThemeClass()} ${
        resolvedDir === 'rtl' ? 'direction-rtl text-right' : 'direction-ltr text-left'
      }`}
      style={{ fontSize: `${fontSize}px` }}
    >
      <div className="max-w-4xl mx-auto w-full min-h-full pb-32">
        <div
          ref={containerRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          spellCheck
          className="markdown-body wysiwyg-content min-h-[400px] outline-none cursor-text leading-relaxed font-sans"
        />
      </div>
    </div>
  );
};

