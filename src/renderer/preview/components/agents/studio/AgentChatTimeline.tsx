import React, { useState, useRef } from 'react';
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
} from 'lucide-react';
import {
  AgentId,
  AgentProfile,
  AgentTaskIntent,
  AgentTaskRecord,
  ScannedMdFile,
  CustomPipelineAction,
} from '../../../../../shared/types';
import {
  AGENT_INTENT_PRESETS,
  STARTER_CUSTOM_PIPELINE_ACTIONS,
} from '../../../../../shared/constants';
import { markdownService } from '../../../services/MarkdownService';
import { ActionLogTimeline } from './ActionLogTimeline';

export interface ChatImageAttachment {
  id: string;
  name: string;
  size: number;
  dataUrl: string;
}

interface AgentChatTimelineProps {
  visibleAgents: AgentProfile[];
  allAgents: AgentProfile[];
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
    customActionId?: string
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
    customActionId?: string
  ) => Promise<void>;
  onPasteExternalReply: (task: AgentTaskRecord) => Promise<void>;
  onCancelTask: (taskId: string) => void;
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
  submitting,
  runningPipelineId,
  workflowExecutionMode = 'auto',
  waitingForStepApproval,
  customActions = [],
  onOpenCustomActionsModal,
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [attachedImages, setAttachedImages] = useState<ChatImageAttachment[]>([]);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [thinkingOpen, setThinkingOpen] = useState(true);
  const [relayAgentId, setRelayAgentId] = useState<AgentId>('');
  const [relayIntent, setRelayIntent] = useState<AgentTaskIntent>('build');
  const [selectedCustomActionId, setSelectedCustomActionId] = useState<string>('');
  const [relayCustomActionId, setRelayCustomActionId] = useState<string>('');

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeAgent =
    allAgents.find((a) => a.id === selectedAgentId) || visibleAgents[0];

  const taskAgent = selectedTask
    ? allAgents.find((a) => a.id === selectedTask.targetAgentId)
    : activeAgent;

  const effectiveRelayAgent =
    relayAgentId ||
    selectedTask?.nextAgentInChain ||
    visibleAgents.find((a) => a.id !== selectedTask?.targetAgentId)?.id ||
    'claude-code';

  const addImageFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          setAttachedImages((prev) => [
            ...prev,
            {
              id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              name: file.name || `Pasted-Image-${Date.now()}`,
              size: file.size,
              dataUrl,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      const imageFiles = Array.from(e.clipboardData.files).filter((f) =>
        f.type.startsWith('image/')
      );
      if (imageFiles.length > 0) {
        e.preventDefault();
        addImageFiles(imageFiles);
        return;
      }
    }
    if (e.clipboardData.items) {
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter((item) => item.type.startsWith('image/'));
      if (imageItems.length > 0) {
        e.preventDefault();
        const files = imageItems
          .map((item) => item.getAsFile())
          .filter(Boolean) as File[];
        if (files.length > 0) {
          addImageFiles(files);
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Both Enter and Shift+Enter create a new line!
    // Never send data on Enter.
    if (e.key === 'Enter') {
      e.stopPropagation();
    }
  };

  const handleManualSend = async () => {
    if (isComposerDisabled) return;
    const text = promptInput.trim();
    if (!text && attachedImages.length === 0) return;

    const imagesToSend = [...attachedImages];
    const customActId = selectedCustomActionId;
    setPromptInput('');
    setAttachedImages([]);
    await onSendChatTask(text, imagesToSend, customActId || undefined);
  };

  const renderedReplyHtml = React.useMemo(() => {
    if (!selectedTask?.responseMarkdown) return '';
    try {
      return markdownService.render(selectedTask.responseMarkdown);
    } catch {
      return selectedTask.responseMarkdown;
    }
  }, [selectedTask?.responseMarkdown]);

  return (
    <div className="flex-1 h-full flex flex-col bg-slate-950 overflow-hidden">
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
                onClick={() => {
                  onSelectIntent('refine-plan');
                  onSendChatTask(
                    'Refine and structure this Markdown specification with a clear step-by-step checklist.'
                  );
                }}
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
                onClick={() => {
                  onSelectIntent('build');
                  onSendChatTask(
                    'Execute the checklist steps in this Markdown plan and generate the implementation report.'
                  );
                }}
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
                onClick={() => {
                  onSelectIntent('review');
                  onSendChatTask(
                    'Audit this Markdown specification and implementation for edge cases, bugs, and security risks.'
                  );
                }}
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
                </div>

                <div className="flex items-center gap-2">
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

                    <button
                      type="button"
                      disabled={isRelayDisabled}
                      onClick={() =>
                        onRelayToNextAgent(
                          selectedTask,
                          effectiveRelayAgent as AgentId,
                          relayIntent,
                          relayCustomActionId || undefined
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

      {/* Bottom Interactive Chat Composer Bar (Accepts Images, 3-Line Height, Enter -> Newline, Manual Send Only) */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            addImageFiles(e.dataTransfer.files);
          }
        }}
        className={`border-t border-slate-800/90 bg-slate-900/95 p-3.5 space-y-2.5 transition-colors ${
          isDragOver ? 'bg-sky-950/40 ring-2 ring-sky-500/50' : ''
        }`}
      >
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

        {/* Composer Controls: Target Agent, Mode, Scope Selector */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* @Agent Selector Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-700 text-xs">
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: activeAgent?.accentColor || '#38bdf8',
                }}
              />
              <span className="text-[10px] font-bold text-slate-400">Agent:</span>
              <select
                value={selectedAgentId}
                disabled={isComposerDisabled}
                onChange={(e) => onSelectAgent(e.target.value)}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer disabled:cursor-not-allowed"
              >
                {visibleAgents.map((a) => (
                  <option key={a.id} value={a.id} className="bg-slate-900">
                    @{a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Mode / Intent Selector Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-700 text-xs">
              <Sparkles size={11} className="text-sky-400" />
              <span className="text-[10px] font-bold text-slate-400">Mode:</span>
              <select
                value={selectedCustomActionId ? `custom:${selectedCustomActionId}` : selectedIntent}
                disabled={isComposerDisabled}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__manage_custom__') {
                    onOpenCustomActionsModal?.();
                    return;
                  }
                  if (val.startsWith('custom:')) {
                    const cId = val.replace('custom:', '');
                    onSelectIntent('custom');
                    setSelectedCustomActionId(cId);
                  } else {
                    onSelectIntent(val as AgentTaskIntent);
                    setSelectedCustomActionId('');
                  }
                }}
                className="bg-transparent text-sky-300 font-bold text-xs focus:outline-none cursor-pointer disabled:cursor-not-allowed"
              >
                {AGENT_INTENT_PRESETS.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900">
                    {p.title}
                  </option>
                ))}
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
                {onOpenCustomActionsModal && (
                  <option value="__manage_custom__" className="bg-slate-900 text-sky-400 font-bold">
                    + Manage Custom Actions...
                  </option>
                )}
              </select>
            </div>

            {/* Attached Markdown Context File Selector */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs max-w-xs">
              <FileCheck2 size={12} className="text-emerald-400 shrink-0" />
              <select
                value={selectedSourceFile || activeFilePath}
                disabled={isComposerDisabled}
                onChange={(e) => onSelectSourceFile(e.target.value)}
                className="bg-transparent text-slate-200 font-medium text-xs focus:outline-none truncate cursor-pointer disabled:cursor-not-allowed"
              >
                <option value={activeFilePath} className="bg-slate-900">
                  Target: {activeFileName}
                </option>
                {watchedFiles
                  .filter((f) => f.path !== activeFilePath)
                  .slice(0, 25)
                  .map((f) => (
                    <option key={f.path} value={f.path} className="bg-slate-900">
                      {f.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <span className="text-[10px] text-slate-400 hidden sm:inline">
            Paste images (Ctrl+V) or drag &amp; drop • Click Send button to dispatch
          </span>
        </div>

        {/* Attached Images Preview Strip */}
        {attachedImages.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
            {attachedImages.map((img) => (
              <div
                key={img.id}
                className="relative group shrink-0 rounded-xl border border-slate-700 bg-slate-950 p-1.5 flex items-center gap-2 shadow-sm"
              >
                <img
                  src={img.dataUrl}
                  alt={img.name}
                  className="w-12 h-12 object-cover rounded-lg border border-slate-800"
                />
                <div className="text-[10px] pr-2 max-w-[130px]">
                  <div className="font-semibold text-slate-200 truncate">{img.name}</div>
                  <div className="text-slate-500 font-mono">
                    {(img.size / 1024).toFixed(1)} KB
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setAttachedImages((prev) =>
                      prev.filter((i) => i.id !== img.id)
                    )
                  }
                  title="Remove image"
                  className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-transform hover:scale-110"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Multi-Line Textarea (3 rows default height) */}
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            rows={3}
            disabled={isComposerDisabled}
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              isPipelineActive && !isPausedForApproval
                ? 'Workflow running — manual input locked until pipeline completes or pauses...'
                : `Message @${activeAgent?.shortName || 'Agent'} about ${activeFileName}...\n(Enter or Shift+Enter creates a new line. Click Send button to dispatch)`
            }
            className="w-full min-h-[76px] p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 leading-relaxed font-sans resize-y disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {/* Action Row: Attach Image Picker & Manual Send Button */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                disabled={isComposerDisabled}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addImageFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                disabled={isComposerDisabled}
                onClick={() => fileInputRef.current?.click()}
                title="Attach images (or paste screenshot with Ctrl+V, or drag & drop)"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ImageIcon size={13} className="text-sky-400" />
                <span>Attach Image</span>
                {attachedImages.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-bold">
                    {attachedImages.length}
                  </span>
                )}
              </button>

              <span className="text-[11px] text-slate-500 hidden md:inline">
                Enter creates a new line
              </span>
            </div>

            <button
              type="button"
              onClick={handleManualSend}
              disabled={
                isComposerDisabled ||
                (!promptInput.trim() && attachedImages.length === 0)
              }
              title={
                isPipelineActive && !isPausedForApproval
                  ? 'Workflow running — manual dispatch locked'
                  : `Send to @${activeAgent?.shortName || 'Agent'}`
              }
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/20 transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              <span>Send to @{activeAgent?.shortName || 'Agent'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
