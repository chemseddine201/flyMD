import React from 'react';
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Pause,
  Target,
  FastForward,
  CheckCircle,
  FileText,
  AlertTriangle,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import {
  DiscussionMetadata,
  DiscussionMessage,
} from '../../../../../../shared/types';
import {
  DeliberationTurnCard,
  LiveStreamingTurnCard,
} from './DeliberationTurnCard';

export interface DiscussionRoundGroup {
  round: number;
  title: string;
  desc: string;
  messages: DiscussionMessage[];
  totalTokens: number;
  isCurrent: boolean;
  isDone: boolean;
  isIgnored?: boolean;
  convergedFromRound?: number;
}

export interface DiscussionTimelineViewProps {
  activeMeta: DiscussionMetadata;
  transcriptCount: number;
  isRunning: boolean;
  roundGroups: DiscussionRoundGroup[];
  expandedRounds: Record<number, boolean>;
  expandedTurns: Record<string, boolean>;
  expandedThinking: Record<string, boolean>;
  copiedTurnId: string | null;
  turnZoom: number;
  onToggleRound: (round: number) => void;
  onToggleTurn: (turnId: string) => void;
  onToggleThinking: (turnId: string) => void;
  onProbeAgent: (agentId: string) => void;
  onCopyTurn: (turnId: string, content: string) => void;
  onQuotePoint: (agentName: string, snippet: string) => void;
  onToggleTargetedDispatch: () => void;
  onResume: () => void;
  onGoToReport: () => void;
  onOpenConfig?: () => void;
}

export const DiscussionTimelineView: React.FC<DiscussionTimelineViewProps> =
  React.memo(
    ({
      activeMeta,
      transcriptCount,
      isRunning,
      roundGroups,
      expandedRounds,
      expandedTurns,
      expandedThinking,
      copiedTurnId,
      turnZoom,
      onToggleRound,
      onToggleTurn,
      onToggleThinking,
      onProbeAgent,
      onCopyTurn,
      onQuotePoint,
      onToggleTargetedDispatch,
      onResume,
      onGoToReport,
      onOpenConfig,
    }) => {
      return (
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 space-y-4 w-full max-w-none mx-auto">
          {transcriptCount === 0 && !isRunning && (
            <div className="p-8 text-center text-slate-500 bg-slate-100 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-800/60 transition-colors">
              <Bot
                size={32}
                className="mx-auto mb-2 text-sky-500 dark:text-sky-400 opacity-60 animate-bounce"
              />
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-300">
                Agents are ready to deliberate
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-500 mt-1 max-w-md mx-auto">
                Deterministic barrier synchronization ensures all agents analyze
                the problem before evaluating counter-proposals. Click Resume or
                Next Turn to begin.
              </p>
            </div>
          )}

          {roundGroups.map((group) => {
            if (group.isIgnored) {
              const refRound =
                group.convergedFromRound ||
                activeMeta.convergedAtRound ||
                Math.max(1, group.round - 1);
              return (
                <div
                  key={group.round}
                  aria-disabled="true"
                  className="rounded-2xl border border-amber-500/25 bg-amber-500/5 dark:bg-slate-900/30 px-4 py-3 flex flex-wrap items-center justify-between gap-2 opacity-75 select-none cursor-not-allowed"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500/70" />
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Round {group.round} — Duplicated / Ignored (Same as Round{' '}
                      {refRound} Debate Round)
                    </h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase">
                    Ignored • 0 Queries
                  </span>
                </div>
              );
            }

            const isExpanded = expandedRounds[group.round] ?? true;
            const roundMessages = group.messages;
            const isRoundStreaming =
              group.round === activeMeta.currentRound && isRunning;

            if (
              roundMessages.length === 0 &&
              !isRoundStreaming &&
              group.round > (activeMeta.currentRound || 1)
            ) {
              return null;
            }

            return (
              <div
                key={group.round}
                className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 overflow-hidden shadow-xs transition-all"
              >
                <div
                  onClick={() => onToggleRound(group.round)}
                  className="px-4 md:px-5 py-3 bg-slate-50/90 dark:bg-slate-900/90 hover:bg-slate-100/90 dark:hover:bg-slate-900 cursor-pointer flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/70 select-none transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-transform"
                    >
                      {isExpanded ? (
                        <ChevronDown size={15} />
                      ) : (
                        <ChevronRight size={15} />
                      )}
                    </button>

                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          group.isDone
                            ? 'bg-emerald-500 dark:bg-emerald-400'
                            : group.isCurrent && isRunning
                            ? 'bg-amber-400 animate-ping'
                            : 'bg-slate-400 dark:bg-slate-600'
                        }`}
                      />
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>{group.title}</span>
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                      {roundMessages.length}{' '}
                      {roundMessages.length === 1 ? 'turn' : 'turns'}
                    </span>
                    {group.totalTokens > 0 && (
                      <span className="font-mono text-slate-400 dark:text-slate-500">
                        {group.totalTokens.toLocaleString()} tokens
                      </span>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-3.5 md:p-4 space-y-3 bg-slate-50/40 dark:bg-slate-950/30">
                    {roundMessages.length === 0 && !isRoundStreaming ? (
                      <div className="p-5 text-center text-slate-500 dark:text-slate-400 text-xs rounded-xl bg-slate-100/50 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800 italic">
                        Waiting for phase deliberation to dispatch...
                      </div>
                    ) : (
                      roundMessages.map((msg) => (
                        <DeliberationTurnCard
                          key={msg.id}
                          msg={msg}
                          isTurnExpanded={expandedTurns[msg.id] ?? false}
                          isThinkingExpanded={expandedThinking[msg.id] ?? false}
                          isCopied={copiedTurnId === msg.id}
                          turnZoom={turnZoom}
                          onToggleTurn={onToggleTurn}
                          onToggleThinking={onToggleThinking}
                          onProbeAgent={onProbeAgent}
                          onCopyTurn={onCopyTurn}
                          onQuotePoint={onQuotePoint}
                        />
                      ))
                    )}

                    <LiveStreamingTurnCard
                      roundNumber={group.round}
                      currentRound={activeMeta.currentRound}
                      isRunning={isRunning}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {activeMeta.status === 'failed' && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-gradient-to-r dark:from-rose-950/40 dark:via-red-950/30 dark:to-amber-950/20 border border-rose-300 dark:border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg animate-fadeIn">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 shrink-0 mt-0.5">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <div className="text-xs font-bold text-rose-800 dark:text-rose-200 flex items-center gap-2">
                    <span>Agent Deliberation Turn Failed</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/40 font-mono">
                      Round {activeMeta.currentRound}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-700 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    {activeMeta.errorMessage || 'An unexpected error or timeout interrupted turn execution.'}
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">
                    Completed turns and ledger digests are safely preserved. You can change the active model/effort or click Resume to retry.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {onOpenConfig && (
                  <button
                    type="button"
                    onClick={onOpenConfig}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-semibold transition-all shadow-xs shrink-0"
                    title="Change selected model or effort for this round"
                  >
                    <Sliders size={13} className="text-sky-600 dark:text-sky-400" />
                    <span>Change Model / Config</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onResume}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md shrink-0"
                  title="Retry failed turn and resume deliberation"
                >
                  <RotateCcw size={13} />
                  <span>Resume &amp; Retry Turn</span>
                </button>
              </div>
            </div>
          )}

          {activeMeta.status === 'paused' && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/25 border border-amber-300 dark:border-amber-500/40 flex items-center justify-between gap-3 shadow-md animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <Pause size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                    <span>Deliberation Paused for Human Review</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/40 font-mono">
                      Round {activeMeta.currentRound}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-700 dark:text-slate-400 mt-0.5">
                    Review proposals, inject guidance below, direct targeted inquiries, or adjust upcoming round configuration before continuing.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onOpenConfig && (
                  <button
                    type="button"
                    onClick={onOpenConfig}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-semibold transition-all shrink-0"
                  >
                    <Sliders size={13} className="text-sky-600 dark:text-sky-400" />
                    <span>Config</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onToggleTargetedDispatch}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/15 hover:bg-purple-600/25 dark:bg-purple-600/30 dark:hover:bg-purple-600/40 text-purple-800 dark:text-purple-200 border border-purple-500/40 text-xs font-semibold transition-all shrink-0"
                >
                  <Target size={13} className="text-purple-600 dark:text-purple-400" />
                  <span>Target Agent</span>
                </button>
                <button
                  type="button"
                  onClick={onResume}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-sm shrink-0"
                >
                  <FastForward size={13} />
                  <span>Resume Deliberation</span>
                </button>
              </div>
            </div>
          )}

          {(activeMeta.status === 'completed' ||
            activeMeta.status === 'awaiting_review' ||
            (activeMeta.currentRound >= 3 && !isRunning)) && (
            <div className="p-4 rounded-xl bg-emerald-50/90 dark:bg-gradient-to-r dark:from-emerald-950/40 dark:via-sky-950/30 dark:to-indigo-950/40 border border-emerald-300 dark:border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg animate-fadeIn">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                  <CheckCircle size={18} />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Deliberation Concluded &amp; Evidence Graded</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 font-mono">
                      Consensus Settled
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-700 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
                    Council debate has reached consensus across{' '}
                    {activeMeta.currentRound || 1} round(s). The structured
                    synthesis report and actionable checklist are ready for
                    review and pipeline assignment.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onGoToReport}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-700 hover:to-sky-700 text-white text-xs font-bold transition-all shadow-md hover:scale-[1.02]"
                >
                  <FileText size={14} />
                  <span>Review &amp; Open Synthesis Report &rarr;</span>
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }
  );
