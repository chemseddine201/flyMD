import React from 'react';
import {
  Accessibility,
  X,
  Eye,
  Type,
  Maximize2,
  Sparkles,
  Check,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { AccessibilityConfig } from '../../../../shared/types';
import { DEFAULT_A11Y_CONFIG } from '../../../../shared/constants';

interface AccessibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AccessibilityConfig;
  onUpdateConfig: (patch: Partial<AccessibilityConfig>) => void;
}

export const AccessibilityModal: React.FC<AccessibilityModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
}) => {
  if (!isOpen) return null;

  const handleToggle = (key: keyof AccessibilityConfig) => {
    onUpdateConfig({ [key]: !config[key] });
  };

  const handleReset = () => {
    onUpdateConfig(DEFAULT_A11Y_CONFIG);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm select-none animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-14 px-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Accessibility className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span>Visual Accessibility Suite</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-300 font-mono border border-amber-500/20">
                  WCAG Friendly
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Enhance visual clarity, reading comfort, and system accessibility
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options List */}
        <div className="p-5 space-y-3.5 max-h-[70vh] overflow-y-auto text-xs">
          {/* High Contrast Mode */}
          <div
            onClick={() => handleToggle('highContrast')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
              config.highContrast
                ? 'bg-amber-950/30 border-amber-500/60 shadow-sm'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-amber-400 shrink-0 mt-0.5">
              <Eye className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 text-xs">
                  High Contrast Mode (WCAG AAA)
                </span>
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center ${
                    config.highContrast
                      ? 'bg-amber-500 border-amber-400 text-slate-950'
                      : 'border-slate-700 bg-slate-900'
                  }`}
                >
                  {config.highContrast && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Applies maximum luminance contrast (pure black background, pure white text, yellow focus rings, and high-contrast 2px borders).
              </p>
            </div>
          </div>

          {/* Dyslexia-Friendly Typography */}
          <div
            onClick={() => handleToggle('dyslexicFont')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
              config.dyslexicFont
                ? 'bg-sky-950/30 border-sky-500/60 shadow-sm'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-sky-400 shrink-0 mt-0.5">
              <Type className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 text-xs">
                  Dyslexia-Friendly Typography
                </span>
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center ${
                    config.dyslexicFont
                      ? 'bg-sky-500 border-sky-400 text-slate-950'
                      : 'border-slate-700 bg-slate-900'
                  }`}
                >
                  {config.dyslexicFont && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Uses distinct letterforms with generous character spacing (0.05em) and relaxed line height (1.85) to reduce reading crowding and reversal.
              </p>
            </div>
          </div>

          {/* Large Print Mode */}
          <div
            onClick={() => handleToggle('largePrint')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
              config.largePrint
                ? 'bg-emerald-950/30 border-emerald-500/60 shadow-sm'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 shrink-0 mt-0.5">
              <Maximize2 className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 text-xs">
                  Large Print / Low Vision Mode
                </span>
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center ${
                    config.largePrint
                      ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                      : 'border-slate-700 bg-slate-900'
                  }`}
                >
                  {config.largePrint && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Increases default text size to 19px with proportionally magnified headings and comfortable paragraph padding.
              </p>
            </div>
          </div>

          {/* Reduced Motion */}
          <div
            onClick={() => handleToggle('reducedMotion')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
              config.reducedMotion
                ? 'bg-purple-950/30 border-purple-500/60 shadow-sm'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-purple-400 shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 text-xs">
                  Reduced Motion
                </span>
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center ${
                    config.reducedMotion
                      ? 'bg-purple-500 border-purple-400 text-slate-950'
                      : 'border-slate-700 bg-slate-900'
                  }`}
                >
                  {config.reducedMotion && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Disables animated pings, bounces, and transitions for users sensitive to motion, flashing, or vestibular disorders.
              </p>
            </div>
          </div>

          {/* Color-Blind Safe Badges */}
          <div
            onClick={() => handleToggle('colorBlindSafe')}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
              config.colorBlindSafe
                ? 'bg-indigo-950/30 border-indigo-500/60 shadow-sm'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-indigo-400 shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 text-xs">
                  Color-Blind Safe Badges & Indicators
                </span>
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center ${
                    config.colorBlindSafe
                      ? 'bg-indigo-500 border-indigo-400 text-slate-950'
                      : 'border-slate-700 bg-slate-900'
                  }`}
                >
                  {config.colorBlindSafe && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Ensures status badges and new supervised files display explicit text and shape symbols rather than relying solely on color shades.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-14 px-5 border-t border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Defaults</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs shadow-sm shadow-sky-600/30 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

