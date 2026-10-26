import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Download, ChevronDown, FileCode, FileText, FileSpreadsheet, Globe, Sliders } from 'lucide-react';
import { useClickOutside } from '../../../shared/hooks/useClickOutside';
import { ExportFormatId } from '../../services/export';

interface ExportMenuButtonProps {
  onExport: (format: ExportFormatId) => void;
  onOpenExportDialog?: (format?: ExportFormatId) => void;
  isExporting?: boolean;
}

export const ExportMenuButton: React.FC<ExportMenuButtonProps> = ({
  onExport,
  onOpenExportDialog,
  isExporting = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 6,
        left: Math.max(8, rect.left),
      });
    }
  };

  const toggleOpen = () => {
    if (!isOpen) {
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isOpen]);

  useClickOutside([menuRef, buttonRef], () => setIsOpen(false), isOpen);

  const handleSelect = (format: ExportFormatId) => {
    setIsOpen(false);
    if (onOpenExportDialog) {
      onOpenExportDialog(format);
    } else {
      onExport(format);
    }
  };

  const handleOpenDialog = () => {
    setIsOpen(false);
    if (onOpenExportDialog) {
      onOpenExportDialog();
    } else {
      onExport('html');
    }
  };

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        title="Export document (HTML, PDF, Textify, LaTeX)"
        className={`p-1.5 rounded transition flex items-center gap-1 ${
          isOpen
            ? 'text-sky-300 bg-slate-800 border border-sky-500/40 shadow-sm'
            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
        }`}
      >
        <Download className="w-4 h-4" />
        <ChevronDown className="w-2.5 h-2.5 text-slate-500" />
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        ReactDOM.createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 99999,
            }}
            className="w-56 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl py-1.5 animate-in fade-in-50 zoom-in-95 duration-150 select-none text-slate-100"
          >
            <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase border-b border-slate-800/80 mb-1 flex items-center justify-between">
              <span>Export Document</span>
              <span className="text-[9px] text-sky-400 font-mono">4 Formats</span>
            </div>

            <button
              type="button"
              onClick={() => handleSelect('html')}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-left text-xs text-slate-300 hover:text-white hover:bg-slate-800/90 transition group"
            >
              <Globe className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
              <div className="flex-1 min-w-0">
                <span className="font-medium block text-xs">HTML Document</span>
                <span className="text-[10px] text-slate-500 font-mono">.html</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSelect('pdf')}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-left text-xs text-slate-300 hover:text-white hover:bg-slate-800/90 transition group"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform" />
              <div className="flex-1 min-w-0">
                <span className="font-medium block text-xs">PDF Document</span>
                <span className="text-[10px] text-slate-500 font-mono">.pdf (Print/Vector)</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSelect('txt')}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-left text-xs text-slate-300 hover:text-white hover:bg-slate-800/90 transition group"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <div className="flex-1 min-w-0">
                <span className="font-medium block text-xs">Textify</span>
                <span className="text-[10px] text-slate-500 font-mono">.txt (Clean plain text)</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleSelect('tex')}
              className="w-full px-3 py-1.5 flex items-center gap-2.5 text-left text-xs text-slate-300 hover:text-white hover:bg-slate-800/90 transition group"
            >
              <FileCode className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
              <div className="flex-1 min-w-0">
                <span className="font-medium block text-xs">LaTeX Source</span>
                <span className="text-[10px] text-slate-500 font-mono">.tex (Compilable)</span>
              </div>
            </button>

            <div className="border-t border-slate-800/80 my-1"></div>

            <button
              type="button"
              onClick={handleOpenDialog}
              className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-xs text-sky-400 hover:text-sky-300 hover:bg-sky-950/50 transition font-medium"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Configure & Export Dialog...</span>
            </button>
          </div>,
          document.body
        )}
    </div>
  );
};
