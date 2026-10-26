import React, { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { resolveDirection, TextDirection } from '../../../shared/utils';
import { AppTheme } from '../../../shared/types';

interface MarkdownEditorProps {
  value: string;
  onChange: (val: string) => void;
  fontSize?: number;
  theme?: AppTheme;
  direction?: TextDirection;
  editorRef?: React.MutableRefObject<any>;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  fontSize = 14,
  theme = 'dark',
  direction = 'auto',
  editorRef,
}) => {
  const resolvedDir = useMemo(
    () => resolveDirection(direction, value),
    [direction, value]
  );

  const extensions = useMemo(() => {
    return [
      markdown(),
      EditorView.contentAttributes.of({ dir: resolvedDir }),
    ];
  }, [resolvedDir]);

  return (
    <div
      dir={resolvedDir}
      className={`h-full w-full flex flex-col bg-slate-950 overflow-hidden ${
        resolvedDir === 'rtl' ? 'direction-rtl' : 'direction-ltr'
      }`}
    >
      <CodeMirror
        value={value}
        height="100%"
        className={`h-full ${resolvedDir === 'rtl' ? 'text-right' : 'text-left'}`}
        theme={theme === 'light' ? 'light' : oneDark}
        extensions={extensions}
        onChange={onChange}
        onCreateEditor={(view) => {
          if (editorRef) {
            editorRef.current = view;
          }
        }}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightSpecialChars: true,
          history: true,
          foldGutter: true,
          drawSelection: true,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          syntaxHighlighting: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: true,
          crosshairCursor: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          closeBracketsKeymap: true,
          defaultKeymap: true,
          searchKeymap: true,
          historyKeymap: true,
          foldKeymap: true,
          completionKeymap: true,
          lintKeymap: true,
        }}
        style={{
          fontSize: `${fontSize}px`,
        }}
      />
    </div>
  );
};
