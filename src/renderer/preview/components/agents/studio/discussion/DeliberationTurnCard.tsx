import React, { useMemo } from 'react';
import {
  Sparkles,
  Brain,
  CheckCircle2,
  User,
  Bot,
  Zap,
  Target,
  ChevronDown,
  ChevronRight,
  Check,
  Copy,
  Quote,
} from 'lucide-react';
import { DiscussionMessage } from '../../../../../../shared/types';
import { usePreviewStore, PreviewStoreState } from '../../../../store';
import { markdownService } from '../../../../services/MarkdownService';
import { cleanDiscussionMarkdown } from '../../../../services/deliberationPresetRepository';
import {
  calculateThinkingSteps,
  getMessageSnippet,
  getRoleBadgeStyle,
} from '../../../../utils/discussionTextUtils';

export interface LiveStreamingTurnCardProps {
  roundNumber: number;
  currentRound?: number;
  isRunning: boolean;
}

export const LiveStreamingTurnCard: React.FC<LiveStreamingTurnCardProps> = React.memo(
  ({ roundNumber, currentRound, isRunning }) => {
    const streamingChunks = usePreviewStore(
      (s: PreviewStoreState) => s.streamingChunks
    );
    const streamingThinking = usePreviewStore(
      (s: PreviewStoreState) => s.streamingThinking
    );

    const entries = Object.entries(streamingChunks);
    if (entries.length === 0 || roundNumber !== currentRound || !isRunning) {
      return null;
    }
    const activeStreamingEntry = entries[entries.length - 1];
    const agentId = activeStreamingEntry[0];
    const chunkText = String(activeStreamingEntry[1]);
    const thinkingText = streamingThinking[agentId];

    return (
      <div className="rounded-xl border border-sky-500/50 bg-sky-950/20 p-4 space-y-3 shadow-lg animate-fadeIn">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs font-bold text-sky-400">
            <Sparkles size={14} className="animate-spin text-sky-400" />
            <span>Deliberating: {agentId}...</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold animate-pulse">
            LIVE IN PROGRESS
          </span>
        </div>

        {thinkingText && (
          <div className="rounded-xl border border-indigo-500/40 bg-indigo-950/30 p-3 space-y-1.5 animate-fadeIn">
            <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
              <div className="flex items-center gap-2">
                <Brain size={14} className="text-indigo-400 animate-pulse" />
                <span>Streaming Analytical Reasoning...</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 animate-pulse font-mono">
                REASONING
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950/90 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto border border-indigo-500/20 whitespace-pre-wrap leading-relaxed">
              {thinkingText}
              <span className="inline-block w-2 h-3.5 bg-indigo-400 ml-1 animate-pulse" />
            </div>
          </div>
        )}

        <div className="text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
          {chunkText}
          <span className="inline-block w-2 h-3.5 bg-sky-400 ml-1 animate-pulse" />
        </div>
      </div>
    );
  }
);

export interface DeliberationTurnCardProps {
  msg: DiscussionMessage;
  isTurnExpanded: boolean;
  isThinkingExpanded: boolean;
  isCopied: boolean;
  turnZoom: number;
  onToggleTurn: (turnId: string) => void;
  onToggleThinking: (turnId: string) => void;
  onProbeAgent: (agentId: string) => void;
  onCopyTurn: (turnId: string, content: string) => void;
  onQuotePoint: (agentName: string, snippet: string) => void;
}

export const DeliberationTurnCard: React.FC<DeliberationTurnCardProps> = React.memo(
  ({
    msg,
    isTurnExpanded,
    isThinkingExpanded,
    isCopied,
    turnZoom,
    onToggleTurn,
    onToggleThinking,
    onProbeAgent,
    onCopyTurn,
    onQuotePoint,
  }) => {
    const isHuman =
      msg.messageKind === 'user_intervention' ||
      msg.authorAgentId === 'human-user';

    const snippet = useMemo(() => getMessageSnippet(msg.content), [msg.content]);

    const thinkingStepsCount = useMemo(
      () => calculateThinkingSteps(msg.thinkingContent),
      [msg.thinkingContent]
    );

    const renderedMarkdownHtml = useMemo(() => {
      if (!isTurnExpanded) return '';
      return markdownService.render(cleanDiscussionMarkdown(msg.content));
    }, [isTurnExpanded, msg.content]);

    return (
      <div
        className={`rounded-xl border transition-all ${
          isHuman
            ? 'bg-teal-950/20 border-teal-500/40 shadow-sm'
            : isTurnExpanded
            ? 'bg-slate-900/80 border-slate-700/80 shadow-md'
            : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
        }`}
      >
        {/* Action Turn Header */}
        <div
          onClick={() => onToggleTurn(msg.id)}
          className="p-3 cursor-pointer flex items-center justify-between gap-3 select-none"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="shrink-0 text-emerald-400">
              <CheckCircle2 size={15} />
            </div>

            <div
              className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-inner"
              style={{
                backgroundColor: isHuman ? '#0d9488' : '#1e293b',
                color: isHuman ? '#fff' : '#38bdf8',
                border: `2px solid ${isHuman ? '#14b8a6' : '#38bdf8'}`,
              }}
            >
              {isHuman ? <User size={12} /> : <Bot size={12} />}
            </div>

            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className="text-xs font-bold text-slate-100 truncate">
                {isHuman
                  ? 'Human Facilitator (You)'
                  : msg.authorDisplayName || msg.authorAgentId}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase tracking-wider ${getRoleBadgeStyle(
                  msg.authorRole
                )}`}
              >
                {msg.authorRole || 'Agent'}
              </span>

              {msg.actionName && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 font-medium flex items-center gap-1">
                  <Zap size={10} className="text-sky-400" />
                  <span>{msg.actionName}</span>
                </span>
              )}

              {msg.messageKind === 'targeted_action' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/25 text-purple-200 border border-purple-500/40 font-bold flex items-center gap-1">
                  <Target size={10} className="text-purple-300" />
                  <span>TARGETED PROBE</span>
                </span>
              )}

              {msg.simulated ? (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono hidden sm:inline-block"
                  title="Adaptive Domain Reasoner with CoT Simulation"
                >
                  simulated
                </span>
              ) : msg.modelId ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono hidden sm:inline-block">
                  {msg.modelId}
                </span>
              ) : msg.authorProvider ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 font-mono hidden sm:inline-block">
                  {msg.authorProvider}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-400">
            {msg.tokenUsage && (
              <span
                className="font-mono text-slate-500 hidden sm:inline"
                title={`Prompt: ${msg.tokenUsage.promptTokens.toLocaleString()} | Completion: ${msg.tokenUsage.completionTokens.toLocaleString()}${
                  msg.tokenUsage.reasoningTokens
                    ? ` | Reasoning: ${msg.tokenUsage.reasoningTokens.toLocaleString()}`
                    : ''
                }`}
              >
                {msg.tokenUsage.totalTokens.toLocaleString()} tokens
                {Boolean(
                  msg.tokenUsage.reasoningTokens &&
                    msg.tokenUsage.reasoningTokens > 0
                ) && (
                  <span className="text-indigo-400 ml-1 text-[10px]">
                    (🧠 {msg.tokenUsage.reasoningTokens?.toLocaleString()})
                  </span>
                )}
              </span>
            )}
            <button type="button" className="text-slate-400 hover:text-slate-200">
              {isTurnExpanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </button>
          </div>
        </div>

        {/* Folded Snippet */}
        {!isTurnExpanded && (
          <div
            onClick={() => onToggleTurn(msg.id)}
            className="px-3 pb-3 text-xs text-slate-400 line-clamp-1 pl-11 cursor-pointer hover:text-slate-300 flex items-center gap-2"
          >
            {msg.thinkingContent && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono flex items-center gap-1 shrink-0">
                <Brain size={10} />
                <span>CoT</span>
              </span>
            )}
            <span className="truncate">{snippet}</span>
          </div>
        )}

        {/* Expanded Full Markdown Body */}
        {isTurnExpanded && (
          <div className="px-4 pb-4 pt-1 border-t border-slate-800/60 pl-11 space-y-3">
            {msg.thinkingContent && (
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 overflow-hidden text-xs my-1 shadow-sm">
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleThinking(msg.id);
                  }}
                  className="px-3 py-2 bg-indigo-950/40 hover:bg-indigo-950/60 flex items-center justify-between text-indigo-300 font-semibold cursor-pointer border-b border-indigo-500/20 select-none transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Brain size={14} className="text-indigo-400 shrink-0" />
                    <span className="font-mono text-xs">
                      Analytical Chain of Thought &amp; Invariants
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                      {thinkingStepsCount} steps
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-indigo-400 text-[11px]">
                    <span>{isThinkingExpanded ? 'Hide' : 'Show Thinking'}</span>
                    {isThinkingExpanded ? (
                      <ChevronDown size={13} />
                    ) : (
                      <ChevronRight size={13} />
                    )}
                  </div>
                </div>
                {isThinkingExpanded && (
                  <div className="p-3.5 bg-slate-950/95 font-mono text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap border-l-2 border-indigo-500 max-h-80 overflow-y-auto">
                    {msg.thinkingContent}
                  </div>
                )}
              </div>
            )}

            <div
              className="markdown-body text-slate-200 leading-relaxed max-w-none transition-all"
              style={{
                fontSize: `${(13 * turnZoom) / 100}px`,
                lineHeight: 1.65,
              }}
              dangerouslySetInnerHTML={{ __html: renderedMarkdownHtml }}
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/40 text-[11px]">
              {!isHuman && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onProbeAgent(msg.authorAgentId);
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 transition-colors"
                  title="Direct a targeted inquiry specifically to this agent"
                >
                  <Target size={11} className="text-purple-400" />
                  <span>Probe Agent</span>
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyTurn(msg.id, msg.content);
                }}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                {isCopied ? (
                  <Check size={11} className="text-emerald-400" />
                ) : (
                  <Copy size={11} />
                )}
                <span>{isCopied ? 'Copied' : 'Copy Turn'}</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuotePoint(
                    msg.authorDisplayName || msg.authorAgentId,
                    snippet
                  );
                }}
                className="flex items-center gap-1 px-2 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 transition-colors"
                title="Quote this agent's point into your guidance input"
              >
                <Quote size={11} />
                <span>Quote Point</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
);

