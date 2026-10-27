import React, { useEffect, useMemo, useState } from 'react';
import {
  MessageSquare,
  Plus,
  Play,
  Pause,
  XCircle,
  RotateCw,
  Send,
  FileText,
  ShieldAlert,
  CheckCircle,
  HelpCircle,
  Copy,
  ExternalLink,
  Flame,
  Award,
  Layers,
  Sparkles,
  Search,
  Filter,
  Check,
  ChevronRight,
  Info,
} from 'lucide-react';
import { usePreviewStore, PreviewStoreState } from '../../../store';
import {
  DiscussionConfig,
  DiscussionParticipant,
  DiscussionStatus,
  AgentRoleType,
  DiscussionMetadata,
  DiscussionMessage,
} from '../../../../../shared/types';
import { markdownService } from '../../../services/MarkdownService';

interface DiscussionStudioProps {
  resolvedWorkspace: string;
}

export const DiscussionStudio: React.FC<DiscussionStudioProps> = ({
  resolvedWorkspace,
}) => {
  const discussions = usePreviewStore((s: PreviewStoreState) => s.discussions);
  const activeSessionId = usePreviewStore((s: PreviewStoreState) => s.activeSessionId);
  const activeMeta = usePreviewStore((s: PreviewStoreState) => s.activeDiscussionMeta);
  const activeTranscript = usePreviewStore((s: PreviewStoreState) => s.activeTranscript);
  const streamingChunks = usePreviewStore((s: PreviewStoreState) => s.streamingChunks);
  const activeReportMarkdown = usePreviewStore((s: PreviewStoreState) => s.activeReportMarkdown);
  const activeReportVersion = usePreviewStore((s: PreviewStoreState) => s.activeReportVersion);
  const isRunning = usePreviewStore((s: PreviewStoreState) => s.isDiscussionRunning);
  const discussionError = usePreviewStore((s: PreviewStoreState) => s.discussionError);

  const loadDiscussions = usePreviewStore((s: PreviewStoreState) => s.loadDiscussions);
  const selectDiscussion = usePreviewStore((s: PreviewStoreState) => s.selectDiscussion);
  const startNewDiscussion = usePreviewStore((s: PreviewStoreState) => s.startNewDiscussion);
  const pauseCurrentDiscussion = usePreviewStore((s: PreviewStoreState) => s.pauseCurrentDiscussion);
  const resumeCurrentDiscussion = usePreviewStore((s: PreviewStoreState) => s.resumeCurrentDiscussion);
  const cancelCurrentDiscussion = usePreviewStore((s: PreviewStoreState) => s.cancelCurrentDiscussion);
  const injectGuidance = usePreviewStore((s: PreviewStoreState) => s.injectGuidance);
  const loadReport = usePreviewStore((s: PreviewStoreState) => s.loadReport);
  const handleDiscussionEvent = usePreviewStore((s: PreviewStoreState) => s.handleDiscussionEvent);
  const openFileInTab = usePreviewStore((s: PreviewStoreState) => s.openFileInTab);

  // Active view tab in stage: 'timeline' | 'report' | 'disputes'
  const [activeTab, setActiveTab] = useState<'timeline' | 'report' | 'disputes'>('timeline');

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showNewModal, setShowNewModal] = useState(false);
  const [showGuidanceModal, setShowGuidanceModal] = useState(false);
  const [guidanceInput, setGuidanceInput] = useState('');
  const [copiedReport, setCopiedReport] = useState(false);

  // New discussion form state
  const [newTopic, setNewTopic] = useState('Modular Multi-Agent Architecture for FlyMD');
  const [newIdea, setNewIdea] = useState(
    'Design an isolated, multi-turn multi-agent discussion system. Verify concurrency control, strict read-only process isolation, deterministic barrier synchronization, and prevent premature consensus.'
  );
  const [maxRounds, setMaxRounds] = useState(3);
  const [presetType, setPresetType] = useState<'architecture' | 'security' | 'full'>('architecture');

  // Load discussions on mount & subscribe to real-time events
  useEffect(() => {
    if (resolvedWorkspace) {
      loadDiscussions(resolvedWorkspace);
    }
  }, [resolvedWorkspace, loadDiscussions]);

  useEffect(() => {
    if (!window.electronAPI?.onDiscussionEvent) return;
    const unsub = window.electronAPI.onDiscussionEvent((event: any) => {
      handleDiscussionEvent(event);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [handleDiscussionEvent]);

  // Filtered session list
  const filteredDiscussions = useMemo(() => {
    if (!searchTerm.trim()) return discussions;
    const term = searchTerm.toLowerCase();
    return discussions.filter(
      (d: DiscussionMetadata) =>
        d.sessionId.toLowerCase().includes(term) ||
        (d as any).topic?.toLowerCase().includes(term)
    );
  }, [discussions, searchTerm]);

  // Handle preset selection
  const buildPresetParticipants = (type: 'architecture' | 'security' | 'full'): DiscussionParticipant[] => {
    switch (type) {
      case 'security':
        return [
          {
            agentId: 'agent-architect',
            providerId: 'claude-code',
            modelId: 'claude-3-7-sonnet',
            displayName: 'Lead Architect',
            role: 'architect' as AgentRoleType,
            roleDescription: 'System decomposition, interface contracts, and module boundaries.',
            avatarColor: '#38bdf8',
            assignedSkillUris: [],
            contextBudgetTokens: 32000,
          },
          {
            agentId: 'agent-auditor',
            providerId: 'gemini-antigravity',
            modelId: 'gemini-2.5-pro',
            displayName: 'Security Auditor',
            role: 'auditor' as AgentRoleType,
            roleDescription: 'Verify process sandbox permissions, token leaks, and filesystem denylists.',
            avatarColor: '#f59e0b',
            assignedSkillUris: [],
            contextBudgetTokens: 32000,
          },
          {
            agentId: 'agent-critic',
            providerId: 'mock',
            modelId: 'critic-v1',
            displayName: 'Critical Adversary',
            role: 'critic' as AgentRoleType,
            roleDescription: 'Challenge assumptions, find single points of failure, and stress concurrency.',
            avatarColor: '#ef4444',
            assignedSkillUris: [],
            contextBudgetTokens: 16000,
          },
        ];
      case 'full':
        return [
          {
            agentId: 'claude-architect',
            providerId: 'claude-code',
            modelId: 'claude-3-7-sonnet',
            displayName: 'Claude Architect',
            role: 'architect' as AgentRoleType,
            roleDescription: 'Decomposition and state machine resilience.',
            avatarColor: '#38bdf8',
            assignedSkillUris: [],
            contextBudgetTokens: 32000,
          },
          {
            agentId: 'gemini-planner',
            providerId: 'gemini-antigravity',
            modelId: 'gemini-2.5-flash',
            displayName: 'Antigravity Planner',
            role: 'critic' as AgentRoleType,
            roleDescription: 'Critique and edge-case enumeration.',
            avatarColor: '#818cf8',
            assignedSkillUris: [],
            contextBudgetTokens: 32000,
          },
          {
            agentId: 'offline-implementer',
            providerId: 'mock',
            modelId: 'mock-rust-expert',
            displayName: 'Rust Core Engineer',
            role: 'implementer' as AgentRoleType,
            roleDescription: 'Strict type contracts, atomic file writes, and Windows process-tree termination.',
            avatarColor: '#10b981',
            assignedSkillUris: [],
            contextBudgetTokens: 16000,
          },
        ];
      default:
        return [
          {
            agentId: 'agent-architect',
            providerId: 'mock',
            modelId: 'architect-v1',
            displayName: 'Architect Persona',
            role: 'architect' as AgentRoleType,
            roleDescription: 'Focus on high-level system decomposition and persistence invariants.',
            avatarColor: '#38bdf8',
            assignedSkillUris: [],
            contextBudgetTokens: 16000,
          },
          {
            agentId: 'agent-critic',
            providerId: 'mock',
            modelId: 'critic-v1',
            displayName: 'Critic Persona',
            role: 'critic' as AgentRoleType,
            roleDescription: 'Challenge assumptions and active trade-offs.',
            avatarColor: '#ef4444',
            assignedSkillUris: [],
            contextBudgetTokens: 16000,
          },
          {
            agentId: 'agent-implementer',
            providerId: 'mock',
            modelId: 'implementer-v1',
            displayName: 'Implementer Persona',
            role: 'implementer' as AgentRoleType,
            roleDescription: 'Verify implementation details and crash-recovery guarantees.',
            avatarColor: '#10b981',
            assignedSkillUris: [],
            contextBudgetTokens: 16000,
          },
        ];
    }
  };

  const handleLaunchNewDiscussion = async () => {
    if (!resolvedWorkspace || !newTopic.trim() || !newIdea.trim()) return;
    const sessionId = `disc-${Date.now()}`;
    const participants = buildPresetParticipants(presetType);

    const config: DiscussionConfig = {
      schemaVersion: 1,
      sessionId,
      topic: newTopic.trim(),
      userIdea: newIdea.trim(),
      workspacePath: resolvedWorkspace,
      maxRounds: Number(maxRounds) || 3,
      turnTimeoutSecs: 120,
      participants,
      activeSkillUris: [],
    };

    setShowNewModal(false);
    await startNewDiscussion(config);
  };

  const handleCopyReport = () => {
    if (!activeReportMarkdown) return;
    navigator.clipboard.writeText(activeReportMarkdown);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const handleOpenReportInTab = () => {
    if (!activeSessionId || !resolvedWorkspace) return;
    const reportPath = `${resolvedWorkspace}/.flymd/discussions/${activeSessionId}/reports/final-report-v${activeReportVersion || 1}.md`;
    openFileInTab({
      path: reportPath,
      name: `Final Report v${activeReportVersion || 1}.md`,
      content: activeReportMarkdown || '',
    });
  };

  const getStatusBadge = (status?: DiscussionStatus) => {
    switch (status) {
      case 'running':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            RUNNING
          </span>
        );
      case 'awaiting_review':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
            <Award size={10} />
            AWAITING REVIEW
          </span>
        );
      case 'completed':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle size={10} />
            COMPLETED
          </span>
        );
      case 'paused':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30 flex items-center gap-1">
            <Pause size={10} />
            PAUSED
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
            <XCircle size={10} />
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400">
            {status || 'IDLE'}
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex min-h-0 bg-slate-950 text-slate-200">
      {/* 1. Left Session Explorer Sidebar */}
      <div className="w-72 border-r border-slate-800/80 bg-slate-900/50 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-sky-400" />
            <h2 className="text-xs font-bold tracking-wide text-slate-200 uppercase">
              Deliberations
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-colors"
            title="Start New Multi-Agent Deliberation"
          >
            <Plus size={13} />
            <span>New Debate</span>
          </button>
        </div>

        {/* Search */}
        <div className="p-2 border-b border-slate-800/60">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search discussions..."
              className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Discussions List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
          {filteredDiscussions.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs">
              <Layers size={24} className="mx-auto mb-2 text-slate-600 opacity-60" />
              <p>No deliberations found.</p>
              <button
                type="button"
                onClick={() => setShowNewModal(true)}
                className="mt-3 text-sky-400 hover:underline text-[11px] font-semibold"
              >
                Launch your first debate &rarr;
              </button>
            </div>
          ) : (
            filteredDiscussions.map((d: DiscussionMetadata) => {
              const isSelected = d.sessionId === activeSessionId;
              return (
                <div
                  key={d.sessionId}
                  onClick={() => selectDiscussion(resolvedWorkspace, d.sessionId)}
                  className={`p-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-sky-500/10 border-l-2 border-sky-400'
                      : 'hover:bg-slate-800/40 border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-mono text-slate-400 truncate max-w-[130px]">
                      {d.sessionId}
                    </span>
                    {getStatusBadge(d.status)}
                  </div>
                  <div className="text-xs font-semibold text-slate-200 line-clamp-1 mb-1">
                    {(d as any).topic || 'Multi-Agent Deliberation'}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>Round {d.currentRound}</span>
                    <span>{d.totalMessages} turns</span>
                    {d.latestReportVersion > 0 && (
                      <span className="text-emerald-400 font-semibold">Report v{d.latestReportVersion}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Main Deliberation Stage */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-950">
        {activeMeta ? (
          <>
            {/* Stage Header */}
            <header className="p-4 border-b border-slate-800/80 bg-slate-900/30 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-sm font-bold text-slate-100 truncate">
                    {(activeMeta as any).topic || activeMeta.sessionId}
                  </h1>
                  {getStatusBadge(activeMeta.status)}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-3">
                  <span>Round {activeMeta.currentRound} Deliberation</span>
                  <span>&bull;</span>
                  <span>{activeMeta.totalMessages} Messages</span>
                  <span>&bull;</span>
                  <span>{activeMeta.totalTokens} Tokens</span>
                  {activeMeta.activeDisagreementsCount > 0 && (
                    <>
                      <span>&bull;</span>
                      <span className="text-amber-400 font-semibold">
                        {activeMeta.activeDisagreementsCount} Active Disputes
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-2">
                {isRunning ? (
                  <button
                    type="button"
                    onClick={pauseCurrentDiscussion}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-colors"
                  >
                    <Pause size={12} />
                    <span>Pause</span>
                  </button>
                ) : activeMeta.status === 'paused' || activeMeta.status === 'interrupted' ? (
                  <button
                    type="button"
                    onClick={() => resumeCurrentDiscussion(resolvedWorkspace)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-colors"
                  >
                    <Play size={12} />
                    <span>Resume</span>
                  </button>
                ) : null}

                {isRunning && (
                  <button
                    type="button"
                    onClick={cancelCurrentDiscussion}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-colors"
                  >
                    <XCircle size={12} />
                    <span>Cancel</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowGuidanceModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-bold transition-colors"
                  title="Inject Human Steer / Direction"
                >
                  <Send size={12} />
                  <span>Steer Discussion</span>
                </button>
              </div>
            </header>

            {/* Stage View Tabs */}
            <div className="px-4 border-b border-slate-800 flex items-center gap-4 bg-slate-900/10">
              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'timeline'
                    ? 'border-sky-400 text-sky-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <MessageSquare size={13} />
                <span>Live Deliberation Stream</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('report');
                  if (activeMeta.latestReportVersion > 0 && !activeReportMarkdown) {
                    loadReport(resolvedWorkspace, activeSessionId!, activeMeta.latestReportVersion);
                  }
                }}
                className={`py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'report'
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText size={13} />
                <span>
                  Final 12-Section Report {activeMeta.latestReportVersion > 0 ? `(v${activeMeta.latestReportVersion})` : ''}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('disputes')}
                className={`py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'disputes'
                    ? 'border-amber-400 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldAlert size={13} />
                <span>Disagreements &amp; Decisions ({activeMeta.activeDisagreementsCount})</span>
              </button>
            </div>

            {/* Error Banner */}
            {discussionError && (
              <div className="px-4 py-2.5 bg-rose-500/15 border-b border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <ShieldAlert size={14} className="shrink-0" />
                <span className="flex-1 font-mono">{discussionError}</span>
              </div>
            )}

            {/* View Tab Body */}
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {activeTab === 'timeline' && (
                <div className="max-w-4xl mx-auto space-y-4">
                  {/* Round Stepper Indicator */}
                  <div className="grid grid-cols-3 gap-2 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                    <div className="text-center p-2 rounded bg-slate-800/40">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Round 1</div>
                      <div className="text-xs font-semibold text-sky-400 mt-0.5">Initial Analysis</div>
                    </div>
                    <div className="text-center p-2 rounded bg-slate-800/40">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Round 2</div>
                      <div className="text-xs font-semibold text-amber-400 mt-0.5">Cross-Critique</div>
                    </div>
                    <div className="text-center p-2 rounded bg-slate-800/40">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Round 3+</div>
                      <div className="text-xs font-semibold text-emerald-400 mt-0.5">Rebuttal &amp; Synthesis</div>
                    </div>
                  </div>

                  {/* Transcript Items */}
                  {activeTranscript.map((msg: DiscussionMessage, idx: number) => (
                    <div
                      key={msg.id || idx}
                      className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 space-y-2 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                msg.authorRole === 'Architect'
                                  ? '#38bdf8'
                                  : msg.authorRole === 'Critic'
                                  ? '#ef4444'
                                  : '#10b981',
                            }}
                          />
                          <span className="text-xs font-bold text-slate-200">
                            {msg.authorAgentId}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                            {msg.authorRole}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Round {msg.roundNumber}
                          </span>
                        </div>
                        {msg.tokenUsage && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            {msg.tokenUsage.totalTokens} tokens
                          </span>
                        )}
                      </div>

                      {/* Content with Markdown Rendering */}
                      <div
                        className="text-xs text-slate-300 leading-relaxed prose prose-invert max-w-none prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-800"
                        dangerouslySetInnerHTML={{
                          __html: markdownService.render(msg.content),
                        }}
                      />
                    </div>
                  ))}

                  {/* Active Streaming Chunks */}
                  {Object.entries(streamingChunks).map(([key, chunk]) => (
                    <div
                      key={key}
                      className="p-4 rounded-xl bg-sky-950/20 border border-sky-500/30 space-y-2 animate-pulse"
                    >
                      <div className="flex items-center gap-2 text-sky-400 text-xs font-bold">
                        <Sparkles size={13} className="animate-spin" />
                        <span>Streaming turn: {key}</span>
                      </div>
                      <div className="text-xs text-slate-300 font-mono whitespace-pre-wrap">
                        {String(chunk)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'report' && (
                <div className="max-w-4xl mx-auto space-y-4">
                  {/* Report Control Toolbar */}
                  <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-2">
                      <FileText size={15} className="text-emerald-400" />
                      <span className="text-xs font-bold text-slate-200">
                        Evidence-Graded Report (Version {activeReportVersion || 1})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyReport}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                      >
                        {copiedReport ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        <span>{copiedReport ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenReportInTab}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition-colors"
                      >
                        <ExternalLink size={12} />
                        <span>Open in Tab</span>
                      </button>
                    </div>
                  </div>

                  {/* Rendered 12-Section Markdown Report */}
                  {activeReportMarkdown ? (
                    <div
                      className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-200 leading-relaxed prose prose-invert max-w-none prose-headings:text-slate-100 prose-table:border prose-table:border-slate-800"
                      dangerouslySetInnerHTML={{
                        __html: markdownService.render(activeReportMarkdown),
                      }}
                    />
                  ) : (
                    <div className="p-12 text-center text-slate-500 text-xs">
                      <Info size={24} className="mx-auto mb-2 text-slate-600" />
                      <p>Report generation completes automatically when all deliberation rounds conclude.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'disputes' && (
                <div className="max-w-4xl mx-auto space-y-4">
                  <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30">
                    <h3 className="text-xs font-bold text-amber-300 flex items-center gap-2 mb-2">
                      <ShieldAlert size={14} />
                      <span>Preserved Disagreements (No Forced Consensus)</span>
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      FlyMD preserves genuine technical disagreements intact rather than coercing models into superficial harmony. These topics represent vital architectural trade-offs requiring user direction.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <MessageSquare size={36} className="text-slate-700 mb-3" />
            <h3 className="text-sm font-bold text-slate-300 mb-1">
              Multi-Agent Discussion Studio
            </h3>
            <p className="text-xs text-slate-500 max-w-md mb-4">
              Coordinate multi-agent architectural debates with strict read-only process isolation, barrier synchronization, and epistemic evidence-grading.
            </p>
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-colors"
            >
              <Plus size={14} />
              <span>Launch New Deliberation</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. New Deliberation Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-sky-400" />
                <h3 className="text-sm font-bold text-slate-100">
                  Configure Multi-Agent Deliberation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                &times;
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Discussion Topic</label>
                <input
                  type="text"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Proposal &amp; Constraints</label>
                <textarea
                  rows={4}
                  value={newIdea}
                  onChange={(e) => setNewIdea(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Rounds Limit</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={maxRounds}
                    onChange={(e) => setMaxRounds(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Debate Preset</label>
                  <select
                    value={presetType}
                    onChange={(e) => setPresetType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="architecture">Architect + Critic + Implementer</option>
                    <option value="security">Security &amp; Sandbox Audit</option>
                    <option value="full">Multi-CLI Cross Deliberation</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 flex justify-end gap-2 bg-slate-900/60">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLaunchNewDiscussion}
                className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-colors"
              >
                Start Deliberation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Steer Guidance Modal */}
      {showGuidanceModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send size={15} className="text-sky-400" />
                <h3 className="text-xs font-bold text-slate-100">Steer Discussion (Inject Human Guidance)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuidanceModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                &times;
              </button>
            </div>
            <div className="p-4">
              <textarea
                rows={4}
                value={guidanceInput}
                onChange={(e) => setGuidanceInput(e.target.value)}
                placeholder="Enter technical constraints, clarifications, or settle active trade-offs..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="p-3 border-t border-slate-800 flex justify-end gap-2 bg-slate-900/40">
              <button
                type="button"
                onClick={() => setShowGuidanceModal(false)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (guidanceInput.trim()) {
                    await injectGuidance(guidanceInput.trim());
                    setGuidanceInput('');
                    setShowGuidanceModal(false);
                  }
                }}
                className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold"
              >
                Inject &amp; Dispatch Round
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
