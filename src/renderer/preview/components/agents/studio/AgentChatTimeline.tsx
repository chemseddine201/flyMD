import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  FileText,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Terminal,
  ExternalLink,
  ArrowRight,
  ClipboardPaste,
  StopCircle,
  Brain,
  FileCheck2,
  Wand2,
  Image as ImageIcon,
  X,
  Paperclip,
  AlertTriangle,
  AlertCircle,
  RotateCcw,
  Play,
  Zap,
} from 'lucide-react';
import {
  AgentId,
  AgentProfile,
  AgentTaskIntent,
  AgentTaskRecord,
  ScannedMdFile,
  CustomPipelineAction,
  AgentEffortLevel,
} from '../../../../../shared/types';
import {
  AGENT_INTENT_PRESETS,
  STARTER_CUSTOM_PIPELINE_ACTIONS,
} from '../../../../../shared/constants';
import { markdownService } from '../../../services/MarkdownService';
import { ActionLogTimeline } from './ActionLogTimeline';
import {
  AgentChatComposer,
  AgentChatComposerHandle,
  ChatImageAttachment,
} from './AgentChatComposer';

export type { ChatImageAttachment };

interface AgentChatTimelineProps {
  visibleAgents: AgentProfile[];
  allAgents: AgentProfile[];
  agentsById?: Map<string, AgentProfile>;
  selectedAgentId: AgentId;
  onSelectAgent: (id: AgentId) => void;
  selectedIntent: AgentTaskIntent;
  onSelectIntent: (intent: AgentTaskIntent) => void;
  selectedTask: AgentTaskRecord | null;
  activeFileName: string;
  activeFilePath: string;
  watchedFiles: ScannedMdFile[];
  selectedSourceFile: string;
  onSelectSourceFile: (path: string) => void;
  onSendChatTask: (
    promptText: string,
    attachedImages?: ChatImageAttachment[],
    customActionId?: string,
    effortLevel?: AgentEffortLevel,
    thinkingEnabled?: boolean,
    modelId?: string
  ) => Promise<void>;
  onOpenReportInTab: (
    filePath?: string,
    markdownFallback?: string,
    titleFallback?: string
  ) => void;
  onApplyToActiveTab: (markdownContent: string) => void;
  onRelayToNextAgent: (
    task: AgentTaskRecord,
    nextAgentId: AgentId,
    nextIntent: AgentTaskIntent,
    customActionId?: string,
    effortLevel?: AgentEffortLevel,
    thinkingEnabled?: boolean
  ) => Promise<void>;
  onPasteExternalReply: (task: AgentTaskRecord) => Promise<void>;
  onCancelTask: (taskId: string) => void;
  onRecoverTask?: (
    task: AgentTaskRecord,
    mode: 'continue_from_breakpoint' | 'revert_and_retry' | 'ask'
  ) => void;
  submitting: boolean;
  runningPipelineId?: string | null;
  workflowExecutionMode?: 'auto' | 'manual';
  waitingForStepApproval?: any;
  customActions?: CustomPipelineAction[];
  onOpenCustomActionsModal?: () => void;
}

export const AgentChatTimeline: React.FC<AgentChatTimelineProps> = ({
  visibleAgents,
  allAgents,
  agentsById,
  selectedAgentId,
  onSelectAgent,
  selectedIntent,
  onSelectIntent,
  selectedTask,
  activeFileName,
  activeFilePath,
  watchedFiles,
  selectedSourceFile,
  onSelectSourceFile,
  onSendChatTask,
  onOpenReportInTab,
  onApplyToActiveTab,
  onRelayToNextAgent,
  onPasteExternalReply,
  onCancelTask,
  onRecoverTask,
  submitting,
  runningPipelineId,
  workflowExecutionMode = 'auto',
  waitingForStepApproval,
  customActions = [],
  onOpenCustomActionsModal,
}) => {
  const [thinkingOpen, setThinkingOpen] = useState(true);
  const [relayAgentId, setRelayAgentId] = useState<AgentId>('');
  const [relayIntent, setRelayIntent] = useState<AgentTaskIntent>('build');
  const [relayCustomActionId, setRelayCustomActionId] = useState<string>('');
  const [relayEffort, setRelayEffort] = useState<AgentEffortLevel>('medium');
  const [relayThinking, setRelayThinking] = useState<boolean>(true);
  const [isTimelineDragOver, setIsTimelineDragOver] = useState<boolean>(false);
  const composerRef = useRef<AgentChatComposerHandle>(null);

  const availableCustomActions =
    customActions.length > 0 ? customActions : STARTER_CUSTOM_PIPELINE_ACTIONS;

  // Execution action guards:
  // When task is actively streaming/submitting OR an automated pipeline is in progress without pause,
  // manual conflicting actions are disabled to prevent state corruption.
  const isTaskRunning = selectedTask?.status === 'running' || submitting;
  const isPipelineActive = !!runningPipelineId;
  const isPausedForApproval = !!waitingForStepApproval;

  const isPasteExternalDisabled =
    !selectedTask || isTaskRunning || (isPipelineActive && !isPausedForApproval);

  const isRelayDisabled =
    !selectedTask || isTaskRunning || (isPipelineActive && !isPausedForApproval);

  const isComposerDisabled =
    submitting || (isPipelineActive && !isPausedForApproval);

  const activeAgent =
    agentsById?.get(selectedAgentId) ||
    allAgents.find((a) => a.id === selectedAgentId) ||
    visibleAgents[0];

  const taskAgent = selectedTask
    ? agentsById?.get(selectedTask.targetAgentId) ||
      allAgents.find((a) => a.id === selectedTask.targetAgentId)
    : activeAgent;

  const effectiveRelayAgent =
    relayAgentId ||
    selectedTask?.nextAgentInChain ||
    visibleAgents.find((a) => a.id !== selectedTask?.targetAgentId)?.id ||
    'claude-code';

  // Throttle Markdown-to-HTML rendering to ~100ms intervals while actively streaming (`status === 'running'`),
  // while rendering immediately on task switch or terminal task state.
  const [renderedReplyHtml, setRenderedReplyHtml] = useState<string>('');
  const lastRenderedTaskIdRef = useRef<string | undefined>(undefined);
  const lastRenderTimeRef = useRef<number>(0);

  useEffect(() => {
    const md = selectedTask?.responseMarkdown;
    if (!md) {
      setRenderedReplyHtml('');
      lastRenderedTaskIdRef.current = selectedTask?.id;
      return;
    }

    const renderNow = () => {
      lastRenderedTaskIdRef.current = selectedTask?.id;
      lastRenderTimeRef.current = Date.now();
      try {
        setRenderedReplyHtml(markdownService.render(md));
      } catch {
        setRenderedReplyHtml(md);
      }
    };

    const isTaskSwitch = lastRenderedTaskIdRef.current !== selectedTask?.id;
    const isRunning = selectedTask?.status === 'running';
    const elapsed = Date.now() - lastRenderTimeRef.current;

    if (isTaskSwitch || !isRunning || elapsed >= 100) {
      renderNow();
      return;
    }

    const timer = setTimeout(renderNow, 100 - elapsed);
    return () => clearTimeout(timer);
  }, [selectedTask?.id, selectedTask?.status, selectedTask?.responseMarkdown]);

  const dispatchQuickStartPrompt = (intent: AgentTaskIntent, promptText: string) => {
    const { effortLevel, thinkingEnabled } =
      composerRef.current?.getEffortAndThinking() ?? {
        effortLevel: 'medium' as AgentEffortLevel,
        thinkingEnabled: true,
      };
    onSelectIntent(intent);
    onSendChatTask(promptText, undefined, undefined, effortLevel, thinkingEnabled);
  };

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes('Files')) {
          e.preventDefault();
          setIsTimelineDragOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) {
          setIsTimelineDragOver(false);
        }
      }}
      onDrop={(e) => {
        setIsTimelineDragOver(false);
        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
          e.preventDefault();
          composerRef.current?.appendImageFiles(e.dataTransfer.files);
        }
      }}
      className={`flex-1 h-full flex flex-col bg-slate-950 overflow-hidden transition-colors ${
        isTimelineDragOver ? 'ring-2 ring-inset ring-sky-500/60 bg-sky-950/15' : ''
      }`}
    >
      {/* Studio Chat Messages Stream */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {!selectedTask ? (
          /* Empty State: Quick Start Studio Welcome */
          <div className="max-w-2xl mx-auto my-8 rounded-2xl border border-slate-800/90 bg-slate-900/60 p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 mx-auto">
              <Bot size={26} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">
                In-App Multi-Agent Chat &amp; Live Progress Studio
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-lg mx-auto leading-relaxed">
                Assign Markdown specifications, watch live reasoning &amp; step progress, and chain tasks between{' '}
                <strong className="text-slate-200">
                  Antigravity, Claude Code, OpenCode, Cursor, Codex, ZCode
                </strong>{' '}
                or your own Custom Agents — all directly inside FlyMD.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left pt-2">
              <button
                type="button"
                onClick={() =>
                  dispatchQuickStartPrompt(
                    'refine-plan',
                    'Refine and structure this Markdown specification with a clear step-by-step checklist.'
                  )
                }
                className="p-3 rounded-xl border border-slate-800 bg-slate-950/80 hover:border-sky-500/50 transition-all group"
              >
                <div className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                  <Sparkles size={13} /> 1. Refine Plan
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Ask <strong>{activeAgent?.shortName}</strong> to expand `{activeFileName}` into a structured plan.
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  dispatchQuickStartPrompt(
                    'build',
                    'Execute the checklist steps in this Markdown plan and generate the implementation report.'
                  )
                }
                className="p-3 rounded-xl border border-slate-800 bg-slate-950/80 hover:border-emerald-500/50 transition-all group"
              >
                <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Terminal size={13} /> 2. Build &amp; Execute
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Run <strong>{activeAgent?.shortName}</strong> on `{activeFileName}` with a safety restore point.
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  dispatchQuickStartPrompt(
                    'review',
                    'Audit this Markdown specification and implementation for edge cases, bugs, and security risks.'
                  )
                }
                className="p-3 rounded-xl border border-slate-800 bg-slate-950/80 hover:border-amber-500/50 transition-all group"
              >
                <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <ShieldCheck size={13} /> 3. Review &amp; Audit
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Have <strong>{activeAgent?.shortName}</strong> verify quality and produce an audit table.
                </p>
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Turn 1: User Dispatched Task Bubble */}
            <div className="flex justify-end">
              <div className="max-w-2xl rounded-2xl rounded-tr-sm border border-sky-500/30 bg-sky-950/30 px-4 py-3 text-xs text-slate-100 space-y-2 shadow-md">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                    <span>You → @{taskAgent?.name || selectedTask.targetAgentId}</span>
                    <span className="px-1.5 py-0.2 rounded bg-sky-500/20 border border-sky-500/30 text-sky-200">
                      {selectedTask.intent.toUpperCase()}
                    </span>
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <FileText size={11} className="text-sky-400" />
                    {selectedTask.fileName}
                  </span>
                </div>
                <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap select-text">
                  {selectedTask.customPrompt ? (
                    <div
                      className="prose prose-invert text-xs max-w-none prose-img:max-h-72 prose-img:rounded-xl prose-img:border prose-img:border-slate-800/80 prose-img:my-2"
                      dangerouslySetInnerHTML={{
                        __html: markdownService.render(selectedTask.customPrompt),
                      }}
                    />
                  ) : (
                    AGENT_INTENT_PRESETS.find((p) => p.id === selectedTask.intent)
                      ?.description ||
                    `Process ${selectedTask.fileName} in ${selectedTask.intent} mode.`
                  )}
                </div>
              </div>
            </div>

            {/* Turn 2: Agent Response Bubble (Thinking + Tool Calls + Live Rendered Markdown + Relay Bar) */}
            <div className="rounded-2xl border border-slate-800/95 bg-slate-900/90 shadow-xl overflow-hidden">
              {/* Agent Message Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/90 bg-slate-900">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{
                      backgroundColor: taskAgent?.accentColor || '#38bdf8',
                    }}
                  />
                  <span className="text-xs font-extrabold text-white">
                    {taskAgent?.name || selectedTask.targetAgentId}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    ({taskAgent?.vendor || 'AI Agent'})
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase bg-slate-950 text-sky-300 border border-slate-800">
                    Effort: {selectedTask.effortLevel || 'medium'}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase flex items-center gap-1 border ${
                      selectedTask.thinkingEnabled === false
                        ? 'bg-slate-950 text-slate-400 border-slate-800 line-through'
                        : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                    }`}
                  >
                    <Brain size={10} />
                    <span>{selectedTask.thinkingEnabled === false ? 'Thinking Off' : 'Thinking On'}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {selectedTask.tokenUsage && (
                    <span
                      className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800 hidden sm:inline-flex items-center gap-1"
                      title={`Prompt: ${selectedTask.tokenUsage.promptTokens.toLocaleString()} | Completion: ${selectedTask.tokenUsage.completionTokens.toLocaleString()} | Reasoning: ${selectedTask.tokenUsage.reasoningTokens.toLocaleString()}`}
                    >
                      <Zap size={10} className="text-sky-400" />
                      <span>{selectedTask.tokenUsage.totalTokens.toLocaleString()} tok</span>
                      {selectedTask.tokenUsage.reasoningTokens > 0 && (
                        <span className="text-indigo-400">
                          (🧠 {selectedTask.tokenUsage.reasoningTokens.toLocaleString()})
                        </span>
                      )}
                    </span>
                  )}
                  {selectedTask.status === 'running' ? (
                    <>
                      <span className="text-[11px] font-bold text-sky-300 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30">
                        <Loader2 size={11} className="animate-spin" />
                        Streaming ({selectedTask.progressPercent ?? 45}%)
                      </span>
                      <button
                        type="button"
                        onClick={() => onCancelTask(selectedTask.id)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] font-bold"
                      >
                        <StopCircle size={11} /> Stop
                      </button>
                    </>
                  ) : selectedTask.status === 'incomplete' ||
                    selectedTask.status === 'failed' ? (
                    <>
                      <span
                        className={`text-[10px] font-bold uppercase flex items-center gap-1 px-2.5 py-0.5 rounded-full border ${
                          selectedTask.status === 'incomplete'
                            ? 'text-amber-300 bg-amber-500/15 border-amber-500/40'
                            : 'text-rose-300 bg-rose-500/15 border-rose-500/40'
                        }`}
                      >
                        {selectedTask.status === 'incomplete' ? (
                          <AlertTriangle size={11} />
                        ) : (
                          <AlertCircle size={11} />
                        )}
                        {selectedTask.status}
                      </span>
                      {onRecoverTask && (
                        <button
                          type="button"
                          onClick={() => onRecoverTask(selectedTask, 'ask')}
                          className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-extrabold shadow-xs transition-colors cursor-pointer"
                          title="Resume task from last breakpoint or revert modified files and retry"
                        >
                          <RotateCcw size={10} />
                          <span>Resume / Retry</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px] font-bold uppercase text-emerald-300 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                      <CheckCircle2 size={11} />
                      {selectedTask.status}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Antigravity-Style Action & Activity Logs Timeline */}
                <ActionLogTimeline
                  task={selectedTask}
                  onOpenFile={(fp) => onOpenReportInTab(fp)}
                />

                {/* Inline Error Diagnostic & Breakpoint Recovery Card */}
                {(selectedTask.status === 'incomplete' ||
                  selectedTask.status === 'failed') && (
                  <div
                    className={`rounded-xl border p-3.5 space-y-2.5 text-xs ${
                      selectedTask.status === 'incomplete'
                        ? 'bg-amber-950/30 border-amber-500/50 text-amber-100'
                        : 'bg-rose-950/30 border-rose-500/50 text-rose-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 font-bold text-white">
                        {selectedTask.status === 'incomplete' ? (
                          <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                        ) : (
                          <AlertCircle size={15} className="text-rose-400 shrink-0" />
                        )}
                        <span>
                          {selectedTask.errorDiagnostic?.title ||
                            (selectedTask.status === 'incomplete'
                              ? 'Task Interrupted Before Completion'
                              : 'Task Execution Failed')}
                        </span>
                      </div>
                      {selectedTask.errorDiagnostic?.category && (
                        <span className="px-2 py-0.5 rounded bg-slate-950/90 border border-slate-700 text-[10px] font-mono uppercase text-amber-300 shrink-0">
                          {selectedTask.errorDiagnostic.category}
                        </span>
                      )}
                    </div>

                    <div className="rounded-lg bg-slate-950/90 border border-slate-800 p-2.5 font-mono text-[11px] text-rose-200 leading-relaxed select-text">
                      {selectedTask.errorDiagnostic?.exceptionMessage ||
                        selectedTask.error ||
                        selectedTask.outcomeReason ||
                        'Execution stalled or encountered an unexpected exception.'}
                    </div>

                    {selectedTask.errorDiagnostic?.lastKnownActivity && (
                      <div className="text-[11px] text-slate-300 flex items-center gap-1.5">
                        <span className="font-bold text-sky-300">
                          Last Breakpoint:
                        </span>
                        <span className="font-mono text-slate-200 truncate">
                          {selectedTask.errorDiagnostic.lastKnownActivity}
                        </span>
                      </div>
                    )}

                    {onRecoverTask && (
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            onRecoverTask(
                              selectedTask,
                              'continue_from_breakpoint'
                            )
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer"
                        >
                          <Play size={11} fill="currentColor" />
                          <span>
                            Continue from Last Breakpoint (Keep Modified Files)
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onRecoverTask(selectedTask, 'revert_and_retry')
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-bold text-xs transition-colors cursor-pointer"
                        >
                          <RotateCcw size={11} />
                          <span>Revert Modified Files &amp; Retry</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRecoverTask(selectedTask, 'ask')}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Recovery Options...
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Rendered Markdown Output Document */}
                {selectedTask.responseMarkdown ? (
                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                        <FileCheck2 size={13} className="text-emerald-400" />
                        Agent Markdown Deliverable
                      </span>
                      {selectedTask.outputReportPath && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenReportInTab(selectedTask.outputReportPath)
                          }
                          className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 underline"
                        >
                          <span>Open in Tab</span>
                          <ExternalLink size={11} />
                        </button>
                      )}
                    </div>

                    <div
                      className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs leading-relaxed overflow-x-auto max-h-[500px] select-text prose prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: renderedReplyHtml }}
                    />
                  </div>
                ) : selectedTask.status === 'running' ? (
                  <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                    <Loader2 size={24} className="text-sky-400 animate-spin" />
                    <span>Agent is generating live markdown deliverable...</span>
                  </div>
                ) : (
                  <div className="py-4 text-xs text-slate-400 italic">
                    Task completed. View logs or generated report in tabs.
                  </div>
                )}

                {/* Bottom Agent Action Bar: Quick Apply & Direct Relay */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80 flex-wrap">
                  <div className="flex items-center gap-2">
                    {selectedTask.responseMarkdown && (
                      <button
                        type="button"
                        onClick={() =>
                          onApplyToActiveTab(selectedTask.responseMarkdown || '')
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all"
                      >
                        <Wand2 size={12} />
                        <span>Apply to Active Tab</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isPasteExternalDisabled}
                      onClick={() => onPasteExternalReply(selectedTask)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium transition-all"
                      title={
                        isTaskRunning
                          ? 'Agent is actively generating — paste is locked'
                          : isPipelineActive && !isPausedForApproval
                          ? 'Automated pipeline in progress — pause or cancel to paste output'
                          : 'Paste external CLI/Web response into this task'
                      }
                    >
                      <ClipboardPaste size={12} />
                      <span className="hidden sm:inline">Paste External Output</span>
                    </button>
                  </div>

                  {/* Immediate Agent-to-Agent Handoff Relay Dropdown */}
                  <div
                    className={`flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border text-xs transition-colors ${
                      isRelayDisabled
                        ? 'border-slate-800/60 opacity-60'
                        : 'border-slate-800'
                    }`}
                  >
                    <span className="text-[10px] font-bold text-slate-400 pl-1">
                      Relay to:
                    </span>
                    <select
                      value={effectiveRelayAgent}
                      disabled={isRelayDisabled}
                      onChange={(e) =>
                        setRelayAgentId(e.target.value as AgentId)
                      }
                      className="bg-transparent text-sky-300 font-bold text-xs focus:outline-none cursor-pointer disabled:cursor-not-allowed"
                    >
                      {visibleAgents
                        .filter((a) => a.id !== selectedTask.targetAgentId)
                        .map((a) => (
                          <option key={a.id} value={a.id} className="bg-slate-900">
                            @{a.name}
                          </option>
                        ))}
                    </select>

                    <select
                      value={relayCustomActionId ? `custom:${relayCustomActionId}` : relayIntent}
                      disabled={isRelayDisabled}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.startsWith('custom:')) {
                          setRelayIntent('custom');
                          setRelayCustomActionId(val.replace('custom:', ''));
                        } else {
                          setRelayIntent(val as AgentTaskIntent);
                          setRelayCustomActionId('');
                        }
                      }}
                      className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer disabled:cursor-not-allowed"
                    >
                      <option value="review" className="bg-slate-900">
                        Review
                      </option>
                      <option value="build" className="bg-slate-900">
                        Build
                      </option>
                      <option value="fix-bugs" className="bg-slate-900">
                        Fix Bugs
                      </option>
                      <option value="refine-plan" className="bg-slate-900">
                        Plan
                      </option>
                      <option value="write-tests" className="bg-slate-900">
                        Tests
                      </option>
                      <option value="explain" className="bg-slate-900">
                        Explain
                      </option>
                      {availableCustomActions.length > 0 && (
                        <optgroup
                          label="Custom Actions"
                          className="bg-slate-900 text-indigo-300 font-semibold"
                        >
                          {availableCustomActions.map((ca) => (
                            <option
                              key={ca.id}
                              value={`custom:${ca.id}`}
                              className="bg-slate-900 text-slate-100"
                            >
                              ✨ {ca.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>

                    {/* Relay Effort Level Pill */}
                    <select
                      value={relayEffort}
                      disabled={isRelayDisabled}
                      onChange={(e) =>
                        setRelayEffort(e.target.value as AgentEffortLevel)
                      }
                      className="bg-transparent text-sky-300 font-bold text-[11px] focus:outline-none cursor-pointer disabled:cursor-not-allowed border-l border-slate-800 pl-1.5"
                      title="Effort level for relayed task (tokens/reasoning depth)"
                    >
                      <option value="low" className="bg-slate-900">
                        Low Effort
                      </option>
                      <option value="medium" className="bg-slate-900">
                        Med Effort (Default)
                      </option>
                      <option value="high" className="bg-slate-900">
                        High Effort
                      </option>
                      <option value="xhigh" className="bg-slate-900">
                        X-High Effort
                      </option>
                      <option value="max" className="bg-slate-900">
                        Max Effort
                      </option>
                    </select>

                    {/* Relay Thinking Mode Toggle */}
                    <button
                      type="button"
                      disabled={isRelayDisabled}
                      onClick={() => setRelayThinking((prev) => !prev)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition cursor-pointer disabled:cursor-not-allowed ${
                        relayThinking
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 line-through'
                      }`}
                      title={
                        relayThinking
                          ? 'Thinking Mode: ON (Extended reasoning enabled)'
                          : 'Thinking Mode: OFF (Fast direct output, saves tokens)'
                      }
                    >
                      <Brain size={10} />
                      <span>{relayThinking ? 'CoT' : 'No CoT'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isRelayDisabled}
                      onClick={() =>
                        onRelayToNextAgent(
                          selectedTask,
                          effectiveRelayAgent as AgentId,
                          relayIntent,
                          relayCustomActionId || undefined,
                          relayEffort,
                          relayThinking
                        )
                      }
                      title={
                        isTaskRunning
                          ? 'Task is currently running — cannot relay'
                          : isPipelineActive && !isPausedForApproval
                          ? 'Workflow in progress — pause (Manual mode) or cancel workflow to branch/relay'
                          : isPipelineActive && isPausedForApproval
                          ? 'Branch relay from paused step'
                          : 'Relay deliverable to next agent'
                      }
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <span>Relay</span>
                      <ArrowRight size={11} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Interactive Chat Composer Bar */}
      <div className="border-t border-slate-800/90 bg-slate-900/95 p-3.5 space-y-2.5">
        {/* Workflow Active Execution / Approval Guard Notification Banner */}
        {isPipelineActive && !isPausedForApproval && (
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-indigo-950/70 border border-indigo-500/50 text-indigo-200 text-xs shadow-inner">
            <div className="flex items-center gap-2">
              <Loader2 size={13} className="animate-spin text-sky-400 shrink-0" />
              <span className="font-semibold text-white">Workflow In Progress:</span>
              <span className="text-slate-300 text-[11px]">
                Composer and manual dispatch are locked until workflow steps pause or complete.
              </span>
            </div>
          </div>
        )}

        {isPausedForApproval && (
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-amber-950/70 border border-amber-500/60 text-amber-200 text-xs shadow-inner">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <span className="font-semibold text-white">Workflow Paused (Manual Mode):</span>
              <span className="text-zinc-200 text-[11px]">
                You can send steering instructions to @{activeAgent?.name || 'Agent'} or proceed with the workflow in the sidebar.
              </span>
            </div>
          </div>
        )}

        {/* Isolated Keystroke Input Composer */}
        <AgentChatComposer
          ref={composerRef}
          visibleAgents={visibleAgents}
          allAgents={allAgents}
          agentsById={agentsById}
          selectedAgentId={selectedAgentId}
          onSelectAgent={onSelectAgent}
          selectedIntent={selectedIntent}
          onSelectIntent={onSelectIntent}
          activeFileName={activeFileName}
          activeFilePath={activeFilePath}
          watchedFiles={watchedFiles}
          selectedSourceFile={selectedSourceFile}
          onSelectSourceFile={onSelectSourceFile}
          isComposerDisabled={isComposerDisabled}
          isPipelineActive={isPipelineActive}
          isPausedForApproval={isPausedForApproval}
          submitting={submitting}
          customActions={customActions}
          onOpenCustomActionsModal={onOpenCustomActionsModal}
          onSendChatTask={onSendChatTask}
        />
      </div>
    </div>
  );
};
