import React, { useState, useRef, useEffect } from 'react';
import {
  Zap,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Check,
  ChevronDown,
  Brain,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { usePreviewStore } from '../../../store';

function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}k`;
  }
  return count.toLocaleString();
}

const BUDGET_PRESETS = [
  { label: 'Unlimited', value: 0 },
  { label: '25k', value: 25_000 },
  { label: '50k', value: 50_000 },
  { label: '100k', value: 100_000 },
  { label: '250k', value: 250_000 },
];

export const TokenQuotaHUD: React.FC = React.memo(() => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const tokenQuotaConfig = usePreviewStore((s) => s.tokenQuotaConfig);
  const sessionMetrics = usePreviewStore((s) => s.sessionTokenMetrics);
  const cumulativeMetrics = usePreviewStore((s) => s.cumulativeTokenMetrics);
  const setTokenQuotaConfig = usePreviewStore((s) => s.setTokenQuotaConfig);
  const resetSessionMetrics = usePreviewStore((s) => s.resetSessionTokenMetrics);
  const resetCumulativeMetrics = usePreviewStore(
    (s) => s.resetCumulativeTokenMetrics
  );
  const getQuotaStatus = usePreviewStore((s) => s.getQuotaStatus);

  const { percent, isSoftWarning, isBreached } = getQuotaStatus();

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const isUnlimited =
    !tokenQuotaConfig.enabled || tokenQuotaConfig.budgetCap <= 0;

  // Status badge styling
  let badgeBorder = 'border-slate-800';
  let badgeBg = 'bg-slate-900/90 hover:bg-slate-800/90';
  let badgeText = 'text-slate-300';
  let iconColor = 'text-sky-400';

  if (!isUnlimited) {
    if (isBreached) {
      badgeBorder = 'border-rose-500/60';
      badgeBg = 'bg-rose-950/50 hover:bg-rose-900/60';
      badgeText = 'text-rose-200';
      iconColor = 'text-rose-400';
    } else if (isSoftWarning) {
      badgeBorder = 'border-amber-500/50';
      badgeBg = 'bg-amber-950/40 hover:bg-amber-900/50';
      badgeText = 'text-amber-200';
      iconColor = 'text-amber-400';
    } else {
      badgeBorder = 'border-sky-500/30';
      badgeBg = 'bg-sky-950/30 hover:bg-sky-900/40';
      badgeText = 'text-sky-200';
      iconColor = 'text-sky-400';
    }
  }

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* HUD Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`px-2.5 py-1 rounded-lg border ${badgeBorder} ${badgeBg} ${badgeText} flex items-center gap-1.5 text-xs font-semibold transition-all shadow-sm select-none cursor-pointer`}
        title="Token Usage Telemetry & Quota Governance"
      >
        <Zap size={13} className={`${iconColor} shrink-0`} />
        <span>
          {formatTokens(sessionMetrics.totalTokens)}
          <span className="text-[10px] text-slate-400 ml-0.5">
            / {isUnlimited ? '∞' : formatTokens(tokenQuotaConfig.budgetCap)}
          </span>
        </span>
        {!isUnlimited && (
          <span
            className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
              isBreached
                ? 'bg-rose-500/30 text-rose-300'
                : isSoftWarning
                ? 'bg-amber-500/30 text-amber-300'
                : 'bg-sky-500/20 text-sky-300'
            }`}
          >
            {percent}%
          </span>
        )}
        <ChevronDown size={11} className="text-slate-400 ml-0.5" />
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-3.5 z-50 text-xs space-y-3.5 animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5">
              <Zap size={14} className="text-sky-400" />
              <span className="font-bold text-white text-xs">
                Token Usage &amp; Quota
              </span>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <span className="text-[10px] text-slate-400">Guard</span>
              <input
                type="checkbox"
                checked={tokenQuotaConfig.enabled}
                onChange={(e) =>
                  setTokenQuotaConfig({ enabled: e.target.checked })
                }
                className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-sky-500 focus:ring-0 cursor-pointer"
              />
            </label>
          </div>

          {/* Session Token Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-medium text-slate-200">Session Usage</span>
              <button
                type="button"
                onClick={resetSessionMetrics}
                className="text-[10px] text-slate-400 hover:text-sky-400 flex items-center gap-1 transition-colors"
                title="Reset session token counters"
              >
                <RotateCcw size={10} />
                <span>Reset</span>
              </button>
            </div>

            {/* Progress Bar */}
            {!isUnlimited && (
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    isBreached
                      ? 'bg-rose-500'
                      : isSoftWarning
                      ? 'bg-amber-400'
                      : 'bg-sky-400'
                  }`}
                  style={{ width: `${Math.min(100, percent)}%` }}
                />
              </div>
            )}

            {/* Prompt vs Completion vs Reasoning */}
            <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
              <div className="p-1.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <div className="text-[10px] text-slate-400">Prompt</div>
                <div className="font-mono text-white font-bold text-[11px] mt-0.5">
                  {formatTokens(sessionMetrics.promptTokens)}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <div className="text-[10px] text-slate-400">Completion</div>
                <div className="font-mono text-emerald-400 font-bold text-[11px] mt-0.5">
                  {formatTokens(sessionMetrics.completionTokens)}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <div className="text-[10px] text-indigo-300 flex items-center justify-center gap-0.5">
                  <Brain size={10} />
                  <span>Reasoning</span>
                </div>
                <div className="font-mono text-indigo-300 font-bold text-[11px] mt-0.5">
                  {formatTokens(sessionMetrics.reasoningTokens)}
                </div>
              </div>
            </div>
          </div>

          {/* Budget Presets */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-300 block">
              Session Budget Limit Cap
            </label>
            <div className="flex flex-wrap gap-1">
              {BUDGET_PRESETS.map((preset) => {
                const isSelected = tokenQuotaConfig.budgetCap === preset.value;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      setTokenQuotaConfig({
                        budgetCap: preset.value,
                        enabled: true,
                      })
                    }
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                      isSelected
                        ? 'bg-sky-500 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Policy Setting: Pause at Boundary */}
          <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-[10px] space-y-1">
            <div className="flex items-center gap-1.5 text-slate-200 font-medium">
              <ShieldAlert size={12} className="text-amber-400" />
              <span>Boundary Governance Policy</span>
            </div>
            <div className="flex items-center gap-2 pt-1 text-slate-400">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="breachAction"
                  checked={tokenQuotaConfig.breachAction === 'pause_at_boundary'}
                  onChange={() =>
                    setTokenQuotaConfig({ breachAction: 'pause_at_boundary' })
                  }
                  className="w-3 h-3 text-sky-500 bg-slate-900 border-slate-700"
                />
                <span>Pause at step/turn boundary (Safe)</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="breachAction"
                  checked={tokenQuotaConfig.breachAction === 'warn_only'}
                  onChange={() =>
                    setTokenQuotaConfig({ breachAction: 'warn_only' })
                  }
                  className="w-3 h-3 text-sky-500 bg-slate-900 border-slate-700"
                />
                <span>Warn only</span>
              </label>
            </div>
          </div>

          {/* Cumulative Ledger Stats */}
          <div className="pt-1 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
            <span>
              Workspace Total:{' '}
              <strong className="text-slate-200">
                {formatTokens(cumulativeMetrics.totalTokens)}
              </strong>
            </span>
            <button
              type="button"
              onClick={resetCumulativeMetrics}
              className="text-slate-500 hover:text-slate-300"
              title="Reset cumulative workspace token count"
            >
              Clear Ledger
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
