import React from 'react';
import {
  Bot,
  Zap,
  Footprints,
  Pause,
  FastForward,
  Play,
  XCircle,
  FileText,
  ExternalLink,
  MessageSquare,
  ShieldAlert,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { DiscussionMetadata } from '../../../../../../shared/types';
import { renderDiscussionStatusBadge } from '../../../../utils/discussionTextUtils';
import { TokenQuotaHUD } from '../../common/TokenQuotaHUD';

export type DiscussionStageViewTab = 'timeline' | 'report' | 'disputes';

export interface DiscussionTopToolbarProps {
  activeSessionId: string;
  activeMeta: DiscussionMetadata;
  transcriptCount: number;
  isRunning: boolean;
  isStepMode: boolean;
  discussionError: string | null;
  activeTab: DiscussionStageViewTab;
  onSelectTab: (tab: DiscussionStageViewTab) => void;
  timelineFilter: string;
  onChangeTimelineFilter: (filter: string) => void;
  onToggleExpandAll: (expand: boolean) => void;
  turnZoom: number;
  onUpdateZoom: (zoom: number) => void;
  onToggleStepMode: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onGoToReport: () => void;
  onOpenReportInTab: () => void;
}

export const DiscussionTopToolbar: React.FC<DiscussionTopToolbarProps> = React.memo(
  ({
    activeSessionId,
    activeMeta,
    transcriptCount,
    isRunning,
    isStepMode,
    discussionError,
    activeTab,
    onSelectTab,
    timelineFilter,
    onChangeTimelineFilter,
    onToggleExpandAll,
    turnZoom,
    onUpdateZoom,
    onToggleStepMode,
    onPause,
    onResume,
    onCancel,
    onGoToReport,
    onOpenReportInTab,
  }) => {
    const errorMessage =
      discussionError ||
      (activeMeta.status === 'failed' ? activeMeta.errorMessage : null);

    return (
      <>
        <header className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex items-center justify-between gap-4 transition-colors duration-150">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 shrink-0">
              <Bot size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {(activeMeta as any).topic || activeSessionId}
                </h1>
                {renderDiscussionStatusBadge(activeMeta.status)}
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                <span>Round {activeMeta.currentRound}</span>
                <span>&bull;</span>
                <span>{activeMeta.totalMessages} turns</span>
                <span>&bull;</span>
                <span className="font-mono">
                  {activeMeta.totalTokens.toLocaleString()} tokens
                </span>
                {activeMeta.decisionsCount > 0 && (
                  <>
                    <span>&bull;</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      {activeMeta.decisionsCount} decisions agreed
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <TokenQuotaHUD />

            <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => {
                  if (isStepMode) onToggleStepMode();
                }}
                className={`p-1.5 rounded transition-all ${
                  !isStepMode
                    ? 'bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/40 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Auto Deliberation Mode (Continuous rounds without pausing)"
              >
                <Zap size={14} className={!isStepMode ? 'text-sky-400' : ''} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isStepMode) onToggleStepMode();
                }}
                className={`p-1.5 rounded transition-all ${
                  isStepMode
                    ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="Step-by-Step Mode (Pauses at each turn barrier for human steering)"
              >
                <Footprints size={14} className={isStepMode ? 'text-amber-600 dark:text-amber-400' : ''} />
              </button>
            </div>

            {isRunning ? (
              <button
                type="button"
                onClick={onPause}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-semibold transition-colors"
              >
                <Pause size={12} />
                <span>Pause</span>
              </button>
            ) : (
              <>
                {activeMeta.status === 'paused' && (
                  <button
                    type="button"
                    onClick={onResume}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-colors shadow-sm"
                    title="Execute the next agent's turn"
                  >
                    <FastForward size={13} />
                    <span>Next Turn</span>
                  </button>
                )}
                {activeMeta.status !== 'completed' &&
                  activeMeta.status !== 'awaiting_review' && (
                    <button
                      type="button"
                      onClick={onResume}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        activeMeta.status === 'failed'
                          ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-500/40 shadow-sm'
                          : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                      }`}
                      title={
                        activeMeta.status === 'failed'
                          ? 'Retry failed turn and resume deliberation'
                          : 'Resume deliberation'
                      }
                    >
                      <Play size={12} />
                      <span>
                        {activeMeta.status === 'failed'
                          ? 'Retry & Resume'
                          : 'Resume'}
                      </span>
                    </button>
                  )}
              </>
            )}

            {isRunning && (
              <button
                type="button"
                onClick={onCancel}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-500/40 text-xs font-semibold transition-colors"
              >
                <XCircle size={12} />
                <span>Cancel</span>
              </button>
            )}

            {(activeMeta.status === 'completed' ||
              activeMeta.status === 'awaiting_review' ||
              activeMeta.currentRound >= 3) && (
              <button
                type="button"
                onClick={onGoToReport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-sm"
                title="Deliberation settled. Review full synthesis report."
              >
                <FileText size={13} />
                <span>Go to Report &rarr;</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenReportInTab}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
              title="Open Deliberation Report in Editor Tab"
            >
              <ExternalLink size={14} className="text-emerald-500 dark:text-emerald-400" />
            </button>
          </div>
        </header>

        <div className="px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/30">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onSelectTab('timeline')}
              className={`py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'timeline'
                  ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <MessageSquare size={13} />
              <span>Deliberation Actions ({transcriptCount})</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('report')}
              className={`py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'report'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FileText size={13} />
              <span>
                12-Section Evidence Report{' '}
                {activeMeta.latestReportVersion > 0
                  ? `(v${activeMeta.latestReportVersion})`
                  : ''}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onSelectTab('disputes')}
              className={`py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'disputes'
                  ? 'border-amber-500 text-amber-700 dark:text-amber-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <ShieldAlert size={13} />
              <span>
                Disagreements &amp; Decisions ({activeMeta.activeDisagreementsCount})
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 py-1.5 flex-wrap">
            {activeTab === 'timeline' && (
              <>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800 text-[11px]">
                  <SlidersHorizontal size={11} className="text-slate-500 dark:text-slate-400" />
                  <select
                    value={timelineFilter}
                    onChange={(e) => onChangeTimelineFilter(e.target.value)}
                    className="bg-transparent border-0 text-slate-800 dark:text-slate-300 focus:outline-none cursor-pointer py-0.5 text-[11px]"
                  >
                    <option value="all">All Participants</option>
                    <option value="architect">Architects</option>
                    <option value="critic">Critics</option>
                    <option value="auditor">Auditors</option>
                    <option value="implementer">Implementers</option>
                    <option value="human">Human Guidance</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleExpandAll(true)}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 text-[11px] flex items-center gap-1"
                  title="Expand all turns"
                >
                  <Maximize2 size={11} />
                  <span>Expand</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleExpandAll(false)}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 text-[11px] flex items-center gap-1"
                  title="Collapse all turns"
                >
                  <Minimize2 size={11} />
                  <span>Collapse</span>
                </button>
              </>
            )}

            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-950 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 ml-auto">
              <button
                type="button"
                onClick={() => onUpdateZoom(turnZoom - 10)}
                disabled={turnZoom <= 80}
                className="px-1.5 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 font-bold transition-colors"
                title="Decrease discussion preview text size (A-)"
              >
                A-
              </button>
              <span className="font-mono text-[10px] px-1 text-slate-500 dark:text-slate-400 select-none">
                {turnZoom}%
              </span>
              <button
                type="button"
                onClick={() => onUpdateZoom(turnZoom + 10)}
                disabled={turnZoom >= 180}
                className="px-1.5 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 font-bold transition-colors"
                title="Increase discussion preview text size (A+)"
              >
                A+
              </button>
              {turnZoom !== 100 && (
                <button
                  type="button"
                  onClick={() => onUpdateZoom(100)}
                  className="text-[9px] text-slate-500 hover:text-sky-400 ml-1 underline transition-colors"
                  title="Reset text size to 100%"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="px-4 py-3 bg-rose-50 dark:bg-rose-500/15 border-b border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldAlert size={15} className="shrink-0 text-rose-600 dark:text-rose-400" />
              <span className="font-mono text-[11px] font-semibold leading-relaxed break-words">
                {errorMessage}
              </span>
            </div>
          </div>
        )}
      </>
    );
  }
);

