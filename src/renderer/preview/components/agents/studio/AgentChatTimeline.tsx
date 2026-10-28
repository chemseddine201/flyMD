import React, { useState } from 'react';
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
} from 'lucide-react';
import {
  AgentId,
  AgentProfile,
  AgentTaskIntent,
  AgentTaskRecord,
  ScannedMdFile,
} from '../../../../../shared/types';
import { AGENT_INTENT_PRESETS } from '../../../../../shared/constants';
import { markdownService } from '../../../services/MarkdownService';

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
  onSendChatTask: (promptText: string) => Promise<void>;
  onOpenReportInTab: (filePath?: string, markdownFallback?: string, titleFallback?: string) => void;
  onApplyToActiveTab: (markdownContent: string) => void;
  onRelayToNextAgent: (
    task: AgentTaskRecord,
    nextAgentId: AgentId,
    nextIntent: AgentTaskIntent
  ) => Promise<void>;
  onPasteExternalReply: (task: AgentTaskRecord) => Promise<void>;
  onCancelTask: (taskId: string) => void;
  submitting: boolean;
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
}) => {
  const [promptInput, setPromptInput] = useState('');
  const [thinkingOpen, setThinkingOpen] = useState(true);
  const [relayAgentId, setRelayAgentId] = useState<AgentId>('');
  const [relayIntent, setRelayIntent] = useState<AgentTaskIntent>('build');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const text = promptInput.trim();
    setPromptInput('');
    await onSendChatTask(text);
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
                  onSendChatTask('Refine and structure this Markdown specification with a clear step-by-step checklist.');
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
                  onSendChatTask('Execute the checklist steps in this Markdown plan and generate the implementation report.');
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
                  onSendChatTask('Audit this Markdown specification and implementation for edge cases, bugs, and security risks.');
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
                <p className="text-xs text-slate-200 leading-relaxed">
                  {selectedTask.customPrompt ||
                    AGENT_INTENT_PRESETS.find((p) => p.id === selectedTask.intent)
                      ?.description ||
                    `Process ${selectedTask.fileName} in ${selectedTask.intent} mode.`}
                </p>
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
                {/* Collapsible Thinking & Reasoning Accordion */}
                {selectedTask.thinkingTrace &&
                  selectedTask.thinkingTrace.length > 0 && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/80 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setThinkingOpen(!thinkingOpen)}
                        className="w-full flex items-center justify-between px-3 py-2 text-left text-[11px] font-semibold text-slate-300 hover:bg-slate-900/60 transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <Brain size={13} className="text-violet-400" />
                          <span>
                            Agent Reasoning &amp; Context Analysis (
                            {selectedTask.thinkingTrace.length} steps)
                          </span>
                        </span>
                        {thinkingOpen ? (
                          <ChevronDown size={13} className="text-slate-400" />
                        ) : (
                          <ChevronRight size={13} className="text-slate-400" />
                        )}
                      </button>
                      {thinkingOpen && (
                        <div className="px-3.5 pb-2.5 pt-1 border-t border-slate-800/70 space-y-1 text-[11px] text-slate-400 font-mono">
                          {selectedTask.thinkingTrace.map((trace, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <span className="text-violet-400 select-none">•</span>
                              <span>{trace}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                {/* Workspace Tool Action Pills */}
                {selectedTask.toolActions && selectedTask.toolActions.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {selectedTask.toolActions.map((tool) => (
                      <span
                        key={tool.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300"
                      >
                        {tool.status === 'running' ? (
                          <Loader2 size={11} className="text-sky-400 animate-spin" />
                        ) : (
                          <CheckCircle2 size={11} className="text-emerald-400" />
                        )}
                        <span className="font-medium">{tool.label}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Rendered Markdown Response */}
                {renderedReplyHtml ? (
                  <div
                    className="markdown-body prose prose-invert max-w-none text-xs leading-relaxed p-4 rounded-xl bg-slate-950/90 border border-slate-800/90"
                    dangerouslySetInnerHTML={{ __html: renderedReplyHtml }}
                  />
                ) : (
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
                        <Loader2 size={14} className="text-sky-400 animate-spin" />
                        <span>{taskAgent?.name || 'Agent'} is actively reasoning and evaluating...</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 font-bold">
                        {selectedTask.progressPercent ?? 55}%
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      Analyzing <span className="font-mono text-slate-200">`{selectedTask.fileName}`</span> and workspace context. Live updates are streaming below.
                    </p>

                    {/* Live streaming logs preview */}
                    {selectedTask.logs && selectedTask.logs.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-black/60 border border-slate-800/80 font-mono text-[10px] space-y-1 max-h-32 overflow-y-auto">
                        {selectedTask.logs.slice(-4).map((log, lIdx) => (
                          <div key={lIdx} className="text-slate-300 truncate flex items-center gap-1.5">
                            <span className="text-emerald-400 select-none">&gt;</span>
                            <span className="truncate">{log}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom Action & Relay Handoff Bar inside the Agent Reply */}
                <div className="pt-3 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() =>
                        onOpenReportInTab(
                          selectedTask.outputReportPath,
                          selectedTask.responseMarkdown,
                          `Report-${selectedTask.fileName}`
                        )
                      }
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-[11px] font-bold transition-colors"
                    >
                      <ExternalLink size={12} />
                      Open Report as Tab
                    </button>

                    {selectedTask.responseMarkdown && (
                      <button
                        type="button"
                        onClick={() =>
                          onApplyToActiveTab(selectedTask.responseMarkdown || '')
                        }
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-violet-300 text-[11px] font-bold transition-colors"
                      >
                        <Wand2 size={12} />
                        Apply to Active Tab
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onPasteExternalReply(selectedTask)}
                      title="If you copied a reply from an external browser or IDE, click to attach it here"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
                    >
                      <ClipboardPaste size={12} />
                      Paste Clipboard Reply
                    </button>
                  </div>

                  {/* Direct 1-Click Relay to Next Agent in Chat */}
                  <div className="flex items-center gap-1.5 bg-indigo-950/40 border border-indigo-500/30 rounded-xl px-2.5 py-1">
                    <span className="text-[10px] font-bold uppercase text-indigo-300">
                      Next Step:
                    </span>
                    <select
                      value={effectiveRelayAgent}
                      onChange={(e) => setRelayAgentId(e.target.value)}
                      className="bg-slate-900 text-white text-[11px] font-bold rounded px-1.5 py-0.5 border border-slate-700"
                    >
                      {visibleAgents.map((a) => (
                        <option key={a.id} value={a.id}>
                          @{a.shortName}
                        </option>
                      ))}
                    </select>
                    <select
                      value={relayIntent}
                      onChange={(e) =>
                        setRelayIntent(e.target.value as AgentTaskIntent)
                      }
                      className="bg-slate-900 text-sky-300 text-[11px] font-semibold rounded px-1.5 py-0.5 border border-slate-700"
                    >
                      {AGENT_INTENT_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        onRelayToNextAgent(
                          selectedTask,
                          effectiveRelayAgent,
                          relayIntent
                        )
                      }
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-slate-950 text-[11px] font-bold transition-colors"
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

      {/* Bottom Interactive Chat Composer Bar (Antigravity / Claude Code Style) */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-800/90 bg-slate-900/95 p-3.5 space-y-2.5"
      >
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
                onChange={(e) => onSelectAgent(e.target.value)}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
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
                value={selectedIntent}
                onChange={(e) =>
                  onSelectIntent(e.target.value as AgentTaskIntent)
                }
                className="bg-transparent text-sky-300 font-bold text-xs focus:outline-none cursor-pointer"
              >
                {AGENT_INTENT_PRESETS.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900">
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Attached Markdown Context File Selector */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs max-w-xs">
              <FileCheck2 size={12} className="text-emerald-400 shrink-0" />
              <select
                value={selectedSourceFile || activeFilePath}
                onChange={(e) => onSelectSourceFile(e.target.value)}
                className="bg-transparent text-slate-200 font-medium text-xs focus:outline-none truncate cursor-pointer"
              >
                <option value={activeFilePath} className="bg-slate-900">
                  Active Tab: {activeFileName}
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
            Runs directly inside FlyMD Studio • Auto-creates safety checkpoint
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            placeholder={`Message @${activeAgent?.shortName || 'Agent'} about ${activeFileName} (or press Enter to run ${selectedIntent.toUpperCase()} mode)...`}
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/20 transition-all shrink-0"
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            <span>Send to @{activeAgent?.shortName}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

