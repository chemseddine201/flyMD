import React, { useState, useEffect, useMemo } from 'react';
import {
  extractMarkdownHeadings,
  buildMarkdownHeadingTree,
  MarkdownHeadingItem,
  MarkdownHeadingTreeNode,
} from '../../utils/markdownOutline';
import {
  ListTree,
  Pin,
  PinOff,
  ChevronRight,
  ChevronDown,
  Hash,
  X,
} from 'lucide-react';
import { ViewMode } from '../../../../shared/constants';

interface DocumentOutlinePanelProps {
  content: string;
  viewMode?: ViewMode;
  isLeftSidebarOpen?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onClose?: () => void;
  previewContainerRef: React.RefObject<HTMLDivElement | null>;
  editorRef?: React.MutableRefObject<any>;
}

export const DocumentOutlinePanel: React.FC<DocumentOutlinePanelProps> = ({
  content,
  viewMode,
  isPinned = false,
  onTogglePin,
  onClose,
  previewContainerRef,
  editorRef,
}) => {
  const [activeHeadingIdx, setActiveHeadingIdx] = useState<number>(0);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const headings = useMemo(() => extractMarkdownHeadings(content), [content]);
  const headingTree = useMemo(() => buildMarkdownHeadingTree(headings), [headings]);

  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container || headings.length === 0) return;

    const handleScroll = () => {
      const domHeadings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
      if (domHeadings.length === 0) return;

      const containerTop = container.getBoundingClientRect().top;
      let currentIdx = 0;

      domHeadings.forEach((el, idx) => {
        const rect = el.getBoundingClientRect();
        if (rect.top - containerTop <= 80) {
          currentIdx = idx;
        }
      });

      setActiveHeadingIdx(currentIdx);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [previewContainerRef, headings]);

  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleJumpToHeading = (heading: MarkdownHeadingItem) => {
    const container = previewContainerRef.current;
    if (container) {
      const domHeadings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const targetDom = Array.from(domHeadings).find(
        (el) =>
          el.id === heading.id ||
          el.textContent?.trim().toLowerCase() === heading.text.trim().toLowerCase()
      );

      if (targetDom) {
        targetDom.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    if (editorRef?.current) {
      try {
        const cm = editorRef.current;
        const line = cm.state.doc.line(heading.line);
        cm.dispatch({
          selection: { anchor: line.from },
          scrollIntoView: true,
        });
        cm.focus();
      } catch (err) {
        console.warn('Could not scroll editor to heading line:', err);
      }
    }
  };

  const renderHeadingNode = (node: MarkdownHeadingTreeNode, depth = 0) => {
    const isCollapsed = collapsedIds.has(node.id);
    const hasChildren = node.children.length > 0;
    const isActive = headings[activeHeadingIdx]?.id === node.id;

    const levelBadgeColor: Record<number, string> = {
      1: 'text-sky-400 bg-sky-950/70 border-sky-500/30',
      2: 'text-indigo-400 bg-indigo-950/70 border-indigo-500/30',
      3: 'text-emerald-400 bg-emerald-950/70 border-emerald-500/30',
      4: 'text-amber-400 bg-amber-950/70 border-amber-500/30',
      5: 'text-purple-400 bg-purple-950/70 border-purple-500/30',
      6: 'text-rose-400 bg-rose-950/70 border-rose-500/30',
    };

    return (
      <div key={node.id} className="flex flex-col">
        <div
          onClick={() => handleJumpToHeading(node)}
          style={{ paddingLeft: `${Math.max(4, depth * 14 + 4)}px` }}
          className={`group flex items-center gap-1.5 py-1 pr-2 rounded-lg cursor-pointer transition text-xs ${
            isActive
              ? 'bg-sky-500/20 text-sky-200 font-semibold border-l-2 border-sky-400'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => toggleCollapse(node.id, e)}
              className="p-0.5 text-slate-500 hover:text-slate-200 rounded transition"
            >
              {isCollapsed ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          ) : (
            <span className="w-4 h-4 flex items-center justify-center shrink-0">
              <Hash className="w-2.5 h-2.5 text-slate-600" />
            </span>
          )}

          <span
            className={`text-[9px] font-mono px-1 py-0.2 rounded border shrink-0 ${
              levelBadgeColor[node.level] || 'text-slate-400 bg-slate-800 border-slate-700'
            }`}
          >
            H{node.level}
          </span>

          <span className="truncate flex-1 text-[11px] font-medium leading-tight">
            {node.text}
          </span>
        </div>

        {hasChildren && !isCollapsed && (
          <div className="flex flex-col">
            {node.children.map((child) => renderHeadingNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full w-64 border-l border-slate-800 shrink-0 bg-slate-900/95 flex flex-col z-20 select-none overflow-hidden">
      {/* Header */}
      <div className="h-9 px-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
          <ListTree className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-xs">Document Outline</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400">
            {headings.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Pin / Unpin Action */}
          {onTogglePin && (
            <button
              type="button"
              onClick={onTogglePin}
              title={
                isPinned
                  ? 'Unpin outline'
                  : 'Pin outline open permanently'
              }
              className={`p-1 rounded transition ${
                isPinned
                  ? 'text-sky-400 bg-sky-950/80 border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`}
            >
              {isPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Close button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close outline panel"
              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Subtitle / Tip */}
      <div className="px-3 py-1 bg-slate-950/40 border-b border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
        <span>{headings.length} headings detected</span>
        <span>Click to jump</span>
      </div>

      {/* Headings Tree Body */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {headingTree.length === 0 ? (
          <div className="py-12 px-4 text-center text-slate-500 text-[11px]">
            No Markdown headings (<code className="text-slate-400"># H1</code> - <code className="text-slate-400">### H3</code>) found in this document.
          </div>
        ) : (
          headingTree.map((node) => renderHeadingNode(node, 0))
        )}
      </div>
    </div>
  );
};
