import React, { useEffect, useRef, useState, useMemo } from 'react';
import { markdownService } from '../services/MarkdownService';
import { resolveDirection, TextDirection } from '../../../shared/utils';
import { AppTheme, PreviewWidthMode, AccessibilityConfig } from '../../../shared/types';
import { DEFAULT_A11Y_CONFIG } from '../../../shared/constants';
import { DiagramPreviewModal } from './diagram/DiagramPreviewModal';
import { PreviewControlsPill } from './toolbar/PreviewControlsPill';
import { AccessibilityModal } from './accessibility/AccessibilityModal';
import 'highlight.js/styles/github-dark.css';
import 'katex/dist/katex.min.css';
import '../../styles/markdown.css';

interface MarkdownViewerProps {
  content: string;
  theme?: AppTheme;
  direction?: TextDirection;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  fontSize?: number;
  widthMode?: PreviewWidthMode;
  onIncreaseFont?: () => void;
  onDecreaseFont?: () => void;
  onResetFont?: () => void;
  onChangeWidthMode?: (mode: PreviewWidthMode) => void;
  a11yConfig?: AccessibilityConfig;
  onUpdateA11yConfig?: (patch: Partial<AccessibilityConfig>) => void;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  content,
  theme = 'dark',
  direction = 'auto',
  containerRef,
  fontSize = 15,
  widthMode = 'wide',
  onIncreaseFont,
  onDecreaseFont,
  onResetFont,
  onChangeWidthMode,
  a11yConfig = DEFAULT_A11Y_CONFIG,
  onUpdateA11yConfig,
}) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [selectedDiagram, setSelectedDiagram] = useState<{ svg: string; title?: string } | null>(null);
  const [isA11yModalOpen, setIsA11yModalOpen] = useState<boolean>(false);

  const resolvedDir = useMemo(
    () => resolveDirection(direction, content),
    [direction, content]
  );

  useEffect(() => {
    const cleanHtml = markdownService.render(content);
    setRenderedHtml(cleanHtml);
  }, [content]);

  useEffect(() => {
    if (!viewerRef.current) return;

    const mermaidCodes = viewerRef.current.querySelectorAll('pre code.language-mermaid');
    if (mermaidCodes.length > 0) {
      import('mermaid').then(({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          theme: theme === 'light' ? 'default' : 'dark',
          securityLevel: 'loose',
        });
        mermaidCodes.forEach(async (codeElement, idx) => {
          const codeText = codeElement.textContent || '';
          const preElement = codeElement.parentElement;
          if (!preElement) return;

          const diagramId = `mermaid-chart-${Date.now()}-${idx}`;
          try {
            const { svg } = await mermaid.render(diagramId, codeText);
            const container = document.createElement('div');
            container.className = 'mermaid-container my-5 flex flex-col items-center justify-center p-3 rounded-xl border border-slate-800/80 hover:border-sky-500/50 hover:bg-slate-800/30 transition-all cursor-pointer group relative';
            container.title = 'Click flowchart to open interactive preview with zoom & export';
            container.innerHTML = svg;

            const zoomPill = document.createElement('div');
            zoomPill.className = 'absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/95 border border-slate-700/80 text-sky-400 text-xs font-medium shadow-xl pointer-events-none select-none';
            zoomPill.innerHTML = `
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="11" y1="8" x2="11" y2="14"/>
                <line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
              <span>Click to Zoom</span>
            `;
            container.appendChild(zoomPill);

            container.onclick = (e) => {
              e.stopPropagation();
              setSelectedDiagram({
                svg,
                title: 'Flowchart & Diagram Preview',
              });
            };

            preElement.replaceWith(container);
          } catch (err) {
            console.warn('Mermaid rendering failed for block:', err);
          }
        });
      });
    }

    const codeBlocks = viewerRef.current.querySelectorAll('pre');
    codeBlocks.forEach((pre) => {
      if (pre.querySelector('code.language-mermaid')) return;
      if (pre.querySelector('.code-toolbar')) return;

      const codeEl = pre.querySelector('code');
      const langMatch = codeEl?.className.match(/language-([a-zA-Z0-9_-]+)/);
      const lang = langMatch ? langMatch[1] : '';

      const toolbar = document.createElement('div');
      toolbar.className = 'code-toolbar absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10 select-none';

      if (lang && lang !== 'plaintext') {
        const langBadge = document.createElement('span');
        langBadge.className = 'text-[10px] font-mono uppercase text-slate-400 font-semibold px-1.5 py-0.5 rounded bg-slate-900/80 border border-slate-700/80 shadow-sm';
        langBadge.textContent = lang;
        toolbar.appendChild(langBadge);
      }

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.title = 'Copy code snippet';
      copyBtn.className = 'copy-code-btn flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition border border-slate-700/80 shadow-sm cursor-pointer';
      copyBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
        </svg>
        <span>Copy</span>
      `;

      copyBtn.onclick = (e) => {
        e.stopPropagation();
        const rawCode = codeEl?.innerText || pre.innerText || '';
        navigator.clipboard.writeText(rawCode);
        copyBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span class="text-sky-400 font-medium">Copied!</span>
        `;
        setTimeout(() => {
          copyBtn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
            <span>Copy</span>
          `;
        }, 2000);
      };

      toolbar.appendChild(copyBtn);
      pre.style.position = 'relative';
      pre.appendChild(toolbar);
    });
  }, [renderedHtml, theme]);

  const getThemeClass = () => {
    switch (theme) {
      case 'light':
        return 'bg-white text-slate-900';
      case 'tokyo-night':
        return 'bg-[#1a1b26] text-[#c0caf5]';
      case 'catppuccin':
        return 'bg-[#24273a] text-[#cad3f5]';
      case 'dracula':
        return 'bg-[#282a36] text-[#f8f8f2]';
      case 'sepia':
        return 'bg-[#fbf0d9] text-[#433422]';
      case 'cyber':
        return 'bg-[#090910] text-[#e0f8ff]';
      case 'high-contrast':
        return 'bg-black text-white';
      case 'dark':
      default:
        return 'bg-[#0d1117] text-[#e6edf3]';
    }
  };

  const getWidthClass = () => {
    switch (widthMode) {
      case 'full':
        return 'w-full max-w-none px-4 md:px-10';
      case 'standard':
        return 'max-w-4xl mx-auto';
      case 'wide':
      default:
        return 'max-w-7xl mx-auto';
    }
  };

  return (
    <>
      <div
        ref={containerRef as any}
        data-theme={theme}
        data-a11y-high-contrast={a11yConfig?.highContrast ? 'true' : 'false'}
        data-a11y-dyslexic={a11yConfig?.dyslexicFont ? 'true' : 'false'}
        data-a11y-large-print={a11yConfig?.largePrint ? 'true' : 'false'}
        data-a11y-reduced-motion={a11yConfig?.reducedMotion ? 'true' : 'false'}
        className={`h-full w-full overflow-y-auto p-4 md:p-8 select-text relative transition-colors duration-150 ${getThemeClass()}`}
        style={{
          backgroundColor: 'var(--bg-canvas)',
          color: 'var(--text-primary)',
        }}
      >
        <PreviewControlsPill
          fontSize={fontSize}
          onIncreaseFont={onIncreaseFont || (() => {})}
          onDecreaseFont={onDecreaseFont || (() => {})}
          onResetFont={onResetFont || (() => {})}
          widthMode={widthMode}
          onChangeWidthMode={onChangeWidthMode || (() => {})}
          onOpenAccessibility={() => setIsA11yModalOpen(true)}
          isHighContrast={a11yConfig?.highContrast}
        />

        <div
          ref={viewerRef}
          dir={resolvedDir}
          style={{ fontSize: `${fontSize}px` }}
          className={`markdown-body ${getWidthClass()} transition-all duration-150`}
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      </div>

      <DiagramPreviewModal
        isOpen={Boolean(selectedDiagram)}
        onClose={() => setSelectedDiagram(null)}
        svgContent={selectedDiagram?.svg || ''}
        title={selectedDiagram?.title}
        theme={theme === 'light' ? 'light' : 'dark'}
      />

      <AccessibilityModal
        isOpen={isA11yModalOpen}
        onClose={() => setIsA11yModalOpen(false)}
        config={a11yConfig}
        onUpdateConfig={onUpdateA11yConfig || (() => {})}
      />
    </>
  );
};
