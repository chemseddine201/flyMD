import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Image as ImageIcon,
  Copy,
  Check,
  Maximize2,
  Move,
} from 'lucide-react';
import { downloadSvg, downloadPng, copySvgToClipboard } from '../../utils/diagramExport';

interface DiagramPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  svgContent: string;
  title?: string;
  theme?: 'dark' | 'light' | 'cyber' | 'sepia';
}

export const DiagramPreviewModal: React.FC<DiagramPreviewModalProps> = ({
  isOpen,
  onClose,
  svgContent,
  title = 'Flowchart & Diagram Preview',
  theme = 'dark',
}) => {
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isExportingPng, setIsExportingPng] = useState<boolean>(false);

  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setIsDragging(false);
      setCopied(false);
    }
  }, [isOpen, svgContent]);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev * 1.25, 8));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev / 1.25, 0.2));
  };

  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    setScale((prev) => {
      const next = prev * zoomFactor;
      return Math.min(Math.max(next, 0.2), 8);
    });
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleResetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleDownloadSvg = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadSvg(svgContent, `flowchart-${timestamp}.svg`);
  };

  const handleDownloadPng = async () => {
    try {
      setIsExportingPng(true);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const bg = theme === 'light' ? '#ffffff' : '#0f172a';
      await downloadPng(svgContent, `flowchart-${timestamp}.png`, { scale: 3, backgroundColor: bg });
    } catch (err) {
      console.error('Failed to export PNG:', err);
    } finally {
      setIsExportingPng(false);
    }
  };

  const handleCopySvg = async () => {
    const success = await copySvgToClipboard(svgContent);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-slate-950/90 backdrop-blur-md select-none animate-in fade-in duration-150"
      onMouseUp={handleMouseUp}
    >
      <div className="h-12 w-full flex items-center justify-between px-4 bg-slate-900/90 border-b border-slate-800 text-slate-200 z-50 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Maximize2 className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-xs text-slate-100 truncate">
            {title}
          </span>
          <span className="text-[11px] text-slate-500 hidden sm:inline font-mono">
            (Scroll to zoom • Drag to pan)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/60 text-xs">
            <button
              type="button"
              onClick={handleZoomOut}
              title="Zoom Out (-)"
              className="p-1.5 hover:text-white hover:bg-slate-700 rounded transition"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              title="Reset Zoom (0)"
              className="px-2 py-0.5 text-[11px] font-mono hover:text-sky-300 transition"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              title="Zoom In (+)"
              className="p-1.5 hover:text-white hover:bg-slate-700 rounded transition"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              title="Fit to Window"
              className="p-1.5 hover:text-white hover:bg-slate-700 rounded transition text-slate-400"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          <button
            type="button"
            onClick={handleCopySvg}
            title="Copy SVG to Clipboard"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 text-xs transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadSvg}
            title="Download Vector SVG"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 text-xs transition"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>SVG</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={isExportingPng}
            title="Download High-Res PNG"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs shadow-sm shadow-sky-600/30 transition disabled:opacity-50"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>{isExportingPng ? 'Saving...' : 'PNG'}</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          <button
            type="button"
            onClick={onClose}
            title="Close Preview (Esc)"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        className={`flex-1 w-full h-full overflow-hidden relative flex items-center justify-center ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(148, 163, 184, 0.08) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.08s ease-out',
          }}
          className="pointer-events-none p-8 flex items-center justify-center max-w-none max-h-none"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>

      <div className="h-8 px-4 bg-slate-950/80 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Move className="w-3 h-3 text-slate-400" />
            <span>Drag canvas to pan</span>
          </span>
          <span>•</span>
          <span>Scroll mouse wheel to zoom in / out</span>
        </div>
        <div>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400">
            Esc
          </kbd>{' '}
          to exit
        </div>
      </div>
    </div>
  );
};

