import React from 'react';
import {
  FileText,
  Check,
  Copy,
  ExternalLink,
  Info,
  ShieldAlert,
  CheckCircle,
  Flame,
} from 'lucide-react';
import { DiscussionMetadata } from '../../../../../../shared/types';
import { CollapsibleReportRoundsView } from './CollapsibleReportRoundsView';

export interface DiscussionReportViewProps {
  activeReportMarkdown: string | null;
  activeReportVersion: number | null;
  latestReportVersion: number;
  turnZoom: number;
  copiedReport: boolean;
  onCopyReport: () => void;
  onOpenReportInTab: () => void;
  onReloadReport: () => void;
}

export const DiscussionReportView: React.FC<DiscussionReportViewProps> = React.memo(
  ({
    activeReportMarkdown,
    activeReportVersion,
    latestReportVersion,
    turnZoom,
    copiedReport,
    onCopyReport,
    onOpenReportInTab,
    onReloadReport,
  }) => {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 w-full max-w-7xl 2xl:max-w-[1536px] mx-auto">
        <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2.5">
            <FileText size={16} className="text-emerald-500 dark:text-emerald-400" />
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Evidence-Graded Consensus Report (v
                {activeReportVersion || latestReportVersion || 1})
              </span>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Evaluated with 6-level epistemic evidence grading &amp; secret
                scrubbing
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCopyReport}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
            >
              {copiedReport ? (
                <Check size={12} className="text-emerald-500 dark:text-emerald-400" />
              ) : (
                <Copy size={12} />
              )}
              <span>{copiedReport ? 'Copied' : 'Copy Report'}</span>
            </button>
            <button
              type="button"
              onClick={onOpenReportInTab}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-sm"
              title="Open report in preview tab and focus preview"
            >
              <ExternalLink size={13} />
              <span>Open in Tab &amp; Focus Preview</span>
            </button>
          </div>
        </div>

        {activeReportMarkdown ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 shadow-sm">
            <CollapsibleReportRoundsView
              reportMarkdown={activeReportMarkdown}
              turnZoom={turnZoom}
            />
          </div>
        ) : (
          <div className="p-16 text-center text-slate-500 text-xs bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-200 dark:border-slate-800/60">
            <Info size={28} className="mx-auto mb-2 text-slate-400 dark:text-slate-600" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              Report synthesis is in progress
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              The 12-section evidence-graded final report is automatically
              generated at the conclusion of all debate rounds.
            </p>
            {latestReportVersion > 0 && (
              <button
                type="button"
                onClick={onReloadReport}
                className="mt-4 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sky-600 dark:text-sky-400 text-xs font-semibold"
              >
                Reload Report v{latestReportVersion}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }
);

export const DiscussionDisputesView: React.FC<{ activeMeta: DiscussionMetadata }> =
  React.memo(({ activeMeta }) => (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 w-full max-w-7xl 2xl:max-w-[1536px] mx-auto">
      <div className="p-4 rounded-xl bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/30">
        <h3 className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-2 mb-1.5">
          <ShieldAlert size={14} />
          <span>Preserved Disagreements (No Coerced Consensus)</span>
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          FlyMD preserves genuine technical disagreements intact rather than
          coercing models into superficial harmony. These topics represent vital
          architectural trade-offs requiring user direction.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
            <CheckCircle size={13} className="text-emerald-500 dark:text-emerald-400" />
            <span>Agreed Decisions ({activeMeta.decisionsCount})</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Synthesized points of architectural consensus are grounded with
            citations in Section 5 of the Final Report.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
            <Flame size={13} className="text-rose-500 dark:text-rose-400" />
            <span>Active Divergences ({activeMeta.activeDisagreementsCount})</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Unresolved trade-offs and alternative perspectives are documented
            with complete rationale in Section 6.
          </p>
        </div>
      </div>
    </div>
  ));

