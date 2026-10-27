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
  Trash2,
  FastForward,
  Cpu,
  User,
  Bot,
  Zap,
  Sliders,
  AlertTriangle,
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

type PresetKey = 'architecture' | 'security' | 'multi_cli' | 'performance';

const PRESET_TEMPLATES: Record<PresetKey, { name: string; description: string; participants: DiscussionParticipant[] }> = {
  architecture: {
    name: 'System Architecture & Reliability',
    description: 'System decomposition, invariant verification, and failure recovery.',
    participants: [
      {
        agentId: 'agent-architect',
        providerId: 'mock',
        modelId: 'architect-v1',
        displayName: 'Lead Architect',
        role: 'architect',
        roleDescription: 'Focus on system decomposition, API contracts, and architectural invariants.',
        avatarColor: '#38bdf8',
        assignedSkillUris: [],
        contextBudgetTokens: 32000,
      },
      {
        agentId: 'agent-critic',
        providerId: 'mock',
        modelId: 'critic-v1',
        displayName: 'Critical Adversary',
        role: 'critic',
        roleDescription: 'Challenge assumptions, highlight single points of failure, and stress edge cases.',
        avatarColor: '#ef4444',
        assignedSkillUris: [],
        contextBudgetTokens: 32000,
      },
      {
        agentId: 'agent-implementer',
        providerId: 'mock',
        modelId: 'implementer-v1',
        displayName: 'Core Implementer',
        role: 'implementer',
        roleDescription: 'Verify implementation feasibility, crash-safety guarantees, and disk storage atomicity.',
        avatarColor: '#10b981',
        assignedSkillUris: [],
        contextBudgetTokens: 16000,
      },
    ],
  },
  security: {
    name: 'Security & Sandbox Audit',
    description: 'Enforce process isolation, permission boundaries, and token leak prevention.',
    participants: [
      {
        agentId: 'agent-architect',
        providerId: 'mock',
        modelId: 'architect-v1',
        displayName: 'Lead Architect',
        role: 'architect',
        roleDescription: 'Define security boundaries, data flow boundaries, and access control models.',
        avatarColor: '#38bdf8',
        assignedSkillUris: [],
        contextBudgetTokens: 32000,
      },
      {
        agentId: 'agent-auditor',
        providerId: 'mock',
        modelId: 'auditor-v1',
        displayName: 'Security Auditor',
        role: 'auditor',
        roleDescription: 'Audit process-tree isolation, denylist checks, token redaction, and path traversal vulnerabilities.',
        avatarColor: '#f59e0b',
        assignedSkillUris: [],
        contextBudgetTokens: 32000,
      },
      {
        agentId: 'agent-critic',
        providerId: 'mock',
        modelId: 'adversary-v1',
        displayName: 'Adversarial Tester',
        role: 'critic',
        roleDescription: 'Simulate privilege escalations, unsafe process arguments, and environment bypasses.',
        avatarColor: '#ef4444',
        assignedSkillUris: [],
        contextBudgetTokens: 16000,
      },
    ],
  },
  multi_cli: {
    name: 'Multi-CLI Cross Deliberation',
    description: 'Multi-provider debate across Claude Code CLI, Gemini Antigravity, and Local Core.',
    participants: [
      {
        agentId: 'claude-architect',
        providerId: 'claude-code',
        modelId: 'claude-3-7-sonnet',
        displayName: 'Claude Architect',
        role: 'architect',
        roleDescription: 'Deep system synthesis and cross-module structural coordination.',
        avatarColor: '#38bdf8',
        assignedSkillUris: [],
        contextBudgetTokens: 32000,
      },
      {
        agentId: 'gemini-planner',
        providerId: 'gemini-antigravity',
        modelId: 'gemini-2.5-pro',
        displayName: 'Antigravity Gemini',
        role: 'critic',
        roleDescription: 'Edge-case enumeration, performance bottleneck detection, and peer critique.',
        avatarColor: '#818cf8',
        assignedSkillUris: [],
        contextBudgetTokens: 32000,
      },
      {
        agentId: 'rust-implementer',
        providerId: 'mock',
        modelId: 'rust-expert-v1',
        displayName: 'Rust Core Engineer',
        role: 'implementer',
        roleDescription: 'Validate Rust memory safety, atomic file persistence, and subprocess lifecycle.',
        avatarColor: '#10b981',
        assignedSkillUris: [],
        contextBudgetTokens: 16000,
      },
    ],
  },
  performance: {
    name: 'Performance & Refactoring',
    description: 'Low-latency architecture, memory budgets, and algorithmic efficiency.',
    participants: [
      {
        agentId: 'perf-architect',
        providerId: 'mock',
        modelId: 'perf-v1',
        displayName: 'Systems Architect',
        role: 'architect',
        roleDescription: 'Focus on minimal latency, throughput optimization, and modular decoupled pipelines.',
        avatarColor: '#06b6d4',
        assignedSkillUris: [],
        contextBudgetTokens: 32000,
      },
      {
        agentId: 'benchmark-critic',
        providerId: 'mock',
        modelId: 'bench-v1',
        displayName: 'Benchmark Critic',
        role: 'critic',
        roleDescription: 'Identify O(N^2) bottlenecks, excessive memory copies, and unnecessary blocking I/O.',
        avatarColor: '#ec4899',
        assignedSkillUris: [],
        contextBudgetTokens: 32000,
      },
      {
        agentId: 'lowlevel-implementer',
        providerId: 'mock',
        modelId: 'lowlevel-v1',
        displayName: 'Low-Level Implementer',
        role: 'implementer',
        roleDescription: 'Propose zero-allocation designs, asynchronous streaming, and compact memory layout.',
        avatarColor: '#10b981',
        assignedSkillUris: [],
        contextBudgetTokens: 16000,
      },
    ],
  },
};

const COLOR_PALETTE = ['#38bdf8', '#818cf8', '#ef4444', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#a855f7'];

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
  const isStepMode = usePreviewStore((s: PreviewStoreState) => s.isStepMode);
  const discussionError = usePreviewStore((s: PreviewStoreState) => s.discussionError);

  const loadDiscussions = usePreviewStore((s: PreviewStoreState) => s.loadDiscussions);
  const selectDiscussion = usePreviewStore((s: PreviewStoreState) => s.selectDiscussion);
  const startNewDiscussion = usePreviewStore((s: PreviewStoreState) => s.startNewDiscussion);
  const pauseCurrentDiscussion = usePreviewStore((s: PreviewStoreState) => s.pauseCurrentDiscussion);
  const resumeCurrentDiscussion = usePreviewStore((s: PreviewStoreState) => s.resumeCurrentDiscussion);
  const cancelCurrentDiscussion = usePreviewStore((s: PreviewStoreState) => s.cancelCurrentDiscussion);
  const injectGuidance = usePreviewStore((s: PreviewStoreState) => s.injectGuidance);
  const deleteDiscussion = usePreviewStore((s: PreviewStoreState) => s.deleteDiscussion);
  const clearAllDiscussions = usePreviewStore((s: PreviewStoreState) => s.clearAllDiscussions);
  const setStepMode = usePreviewStore((s: PreviewStoreState) => s.setStepMode);
  const loadReport = usePreviewStore((s: PreviewStoreState) => s.loadReport);
  const handleDiscussionEvent = usePreviewStore((s: PreviewStoreState) => s.handleDiscussionEvent);
  const openFileInTab = usePreviewStore((s: PreviewStoreState) => s.openFileInTab);
  const setViewMode = usePreviewStore((s: PreviewStoreState) => s.setViewMode);

  // Active view tab: 'timeline' | 'report' | 'disputes'
  const [activeTab, setActiveTab] = useState<'timeline' | 'report' | 'disputes'>('timeline');

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Modals & confirmation dialogs
  const [showNewModal, setShowNewModal] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [guidanceInput, setGuidanceInput] = useState('');
  const [copiedReport, setCopiedReport] = useState(false);
  const [tabFocusNotification, setTabFocusNotification] = useState<string | null>(null);

  // New discussion configuration state
  const [newTopic, setNewTopic] = useState('Modular Multi-Agent Architecture for FlyMD');
  const [newIdea, setNewIdea] = useState(
    'Design an isolated, multi-turn multi-agent discussion system with strict read-only process isolation, deterministic barrier synchronization, decision logging, and epistemic evidence-grading.'
  );
  const [maxRounds, setMaxRounds] = useState(3);
  const [turnTimeoutSecs, setTurnTimeoutSecs] = useState(120);
  const [newDebateMode, setNewDebateMode] = useState<'preset' | 'custom'>('preset');
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('architecture');
  const [enableStepModeInNew, setEnableStepModeInNew] = useState(false);
  const [customParticipants, setCustomParticipants] = useState<DiscussionParticipant[]>(
    () => PRESET_TEMPLATES.architecture.participants
  );

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

  // When active session changes or finishes, auto-load report if available
  useEffect(() => {
    if (activeMeta?.latestReportVersion && activeMeta.latestReportVersion > 0 && !activeReportMarkdown && resolvedWorkspace && activeSessionId) {
      loadReport(resolvedWorkspace, activeSessionId, activeMeta.latestReportVersion);
    }
  }, [activeMeta?.latestReportVersion, activeReportMarkdown, resolvedWorkspace, activeSessionId, loadReport]);

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

  // Handle Preset selection change in New Modal
  const handleSelectPreset = (key: PresetKey) => {
    setSelectedPreset(key);
    setCustomParticipants(PRESET_TEMPLATES[key].participants);
  };

  // Add custom participant
  const handleAddParticipant = () => {
    const nextIdx = customParticipants.length + 1;
    const color = COLOR_PALETTE[(nextIdx - 1) % COLOR_PALETTE.length];
    const newAgent: DiscussionParticipant = {
      agentId: `agent-custom-${Date.now()}`,
      providerId: 'mock',
      modelId: 'custom-expert-v1',
      displayName: `Expert Agent ${nextIdx}`,
      role: 'critic',
      roleDescription: 'Provide specialized domain analysis and technical critique.',
      avatarColor: color,
      assignedSkillUris: [],
      contextBudgetTokens: 16000,
    };
    setCustomParticipants([...customParticipants, newAgent]);
  };

  // Update custom participant field
  const handleUpdateParticipant = (index: number, updates: Partial<DiscussionParticipant>) => {
    setCustomParticipants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  // Remove custom participant
  const handleRemoveParticipant = (index: number) => {
    if (customParticipants.length <= 2) return;
    setCustomParticipants((prev) => prev.filter((_, i) => i !== index));
  };

  // Launch new discussion
  const handleLaunchNewDiscussion = async () => {
    if (!resolvedWorkspace || !newTopic.trim() || !newIdea.trim()) return;
    const sessionId = `disc-${Date.now()}`;
    const participants = newDebateMode === 'preset'
      ? PRESET_TEMPLATES[selectedPreset].participants
      : customParticipants;

    const config: DiscussionConfig = {
      schemaVersion: 1,
      sessionId,
      topic: newTopic.trim(),
      userIdea: newIdea.trim(),
      workspacePath: resolvedWorkspace,
      maxRounds: Number(maxRounds) || 3,
      turnTimeoutSecs: Number(turnTimeoutSecs) || 120,
      participants,
      activeSkillUris: [],
      stepMode: enableStepModeInNew,
    };

    setShowNewModal(false);
    await startNewDiscussion(config);
  };

  // Delete session handler
  const handleConfirmDeleteSession = async () => {
    if (!sessionToDelete || !resolvedWorkspace) return;
    await deleteDiscussion(resolvedWorkspace, sessionToDelete);
    setSessionToDelete(null);
  };

  // Clear all sessions handler
  const handleConfirmClearAll = async () => {
    if (!resolvedWorkspace) return;
    await clearAllDiscussions(resolvedWorkspace);
    setShowClearAllModal(false);
  };

  // Copy report
  const handleCopyReport = () => {
    if (!activeReportMarkdown) return;
    navigator.clipboard.writeText(activeReportMarkdown);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  // Focus Preview Tab on "Open in Tab"
  const handleOpenReportInTab = () => {
    if (!activeSessionId || !resolvedWorkspace) return;
    const version = activeReportVersion || activeMeta?.latestReportVersion || 1;
    const reportPath = `${resolvedWorkspace}/.flymd/discussions/${activeSessionId}/reports/final-report-v${version}.md`;
    const docName = `Discussion Report (v${version}) - ${activeSessionId}.md`;

    // 1. Open tab
    openFileInTab(
      {
        path: reportPath,
        name: docName,
        content: activeReportMarkdown || '# Report Generating...',
      },
      { activate: true }
    );

    // 2. Transition viewMode to 'preview' so user immediately sees the opened report preview!
    setViewMode('preview');

    // 3. Temporary alert
    setTabFocusNotification(`Focused report preview tab: ${docName}`);
    setTimeout(() => setTabFocusNotification(null), 4000);
  };

  // Send human guidance
  const handleSendGuidance = async () => {
    if (!guidanceInput.trim()) return;
    const text = guidanceInput.trim();
    setGuidanceInput('');
    await injectGuidance(text);
  };

  // Toggle step mode live
  const handleToggleStepMode = async () => {
    if (!activeSessionId || !resolvedWorkspace) return;
    const nextVal = !isStepMode;
    await setStepMode(resolvedWorkspace, activeSessionId, nextVal);
  };

  // Status badge helper
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
      case 'interrupted':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30 flex items-center gap-1">
            <AlertTriangle size={10} />
            INTERRUPTED
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

  // Role color pill helper
  const getRoleBadgeStyle = (role: string) => {
    const r = role.toLowerCase();
    if (r.includes('architect')) return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
    if (r.includes('critic') || r.includes('adversar')) return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    if (r.includes('audit')) return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    if (r.includes('implement')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (r.includes('user') || r.includes('human')) return 'bg-teal-500/25 text-teal-200 border-teal-500/40';
    return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
  };

  return (
    <div className="flex-1 flex min-h-0 bg-slate-950 text-slate-200 font-sans">
      {/* 1. Left Session Explorer Sidebar */}
      <div className="w-80 border-r border-slate-800/80 bg-slate-900/40 flex flex-col shrink-0">
        {/* Sidebar Header */}
        <div className="p-3 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-sky-400" />
            <h2 className="text-xs font-bold tracking-wide text-slate-200 uppercase">
              Deliberations ({discussions.length})
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            {discussions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearAllModal(true)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
                title="Clear all deliberations"
              >
                <Trash2 size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-all shadow-sm"
              title="Configure and launch new debate"
            >
              <Plus size={13} />
              <span>New</span>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="p-2 border-b border-slate-800/60">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter sessions..."
              className="w-full bg-slate-950/80 border border-slate-800 rounded pl-8 pr-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>
        </div>

        {/* Discussions List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
          {filteredDiscussions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              <Layers size={28} className="mx-auto mb-2 text-slate-600 opacity-60" />
              <p className="font-medium text-slate-400">No deliberations found</p>
              <p className="text-[11px] text-slate-600 mt-1">Start a structured debate with multiple AI models.</p>
              <button
                type="button"
                onClick={() => setShowNewModal(true)}
                className="mt-4 px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-semibold transition-colors"
              >
                + Launch Deliberation
              </button>
            </div>
          ) : (
            filteredDiscussions.map((d: DiscussionMetadata) => {
              const isSelected = d.sessionId === activeSessionId;
              return (
                <div
                  key={d.sessionId}
                  onClick={() => selectDiscussion(resolvedWorkspace, d.sessionId)}
                  className={`p-3 cursor-pointer transition-all group relative ${
                    isSelected
                      ? 'bg-sky-500/10 border-l-2 border-sky-400'
                      : 'hover:bg-slate-800/40 border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-mono text-slate-400 truncate max-w-[130px]" title={d.sessionId}>
                      {d.sessionId}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {getStatusBadge(d.status)}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSessionToDelete(d.sessionId);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-opacity"
                        title="Delete session"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="text-xs font-semibold text-slate-200 line-clamp-1 mb-1">
                    {(d as any).topic || 'Multi-Agent Deliberation'}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>Round {d.currentRound}</span>
                    <span>{d.totalMessages} msgs • {d.totalTokens.toLocaleString()} tokens</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Main Stage Deliberation Canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-950">
        {tabFocusNotification && (
          <div className="px-4 py-2 bg-emerald-500/20 border-b border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-emerald-400 shrink-0" />
              <span>{tabFocusNotification}</span>
            </div>
            <button
              type="button"
              onClick={() => setTabFocusNotification(null)}
              className="text-emerald-400 hover:text-emerald-200"
            >
              &times;
            </button>
          </div>
        )}

        {activeSessionId && activeMeta ? (
          <>
            {/* Stage Header & Human-in-the-Loop Controls */}
            <header className="p-3.5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0">
                  <Bot size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-sm font-bold text-slate-100 truncate">
                      {(activeMeta as any).topic || activeSessionId}
                    </h1>
                    {getStatusBadge(activeMeta.status)}
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>Round {activeMeta.currentRound}</span>
                    <span>&bull;</span>
                    <span>{activeMeta.totalMessages} messages</span>
                    <span>&bull;</span>
                    <span className="font-mono">{activeMeta.totalTokens.toLocaleString()} tokens</span>
                  </div>
                </div>
              </div>

              {/* Mode Toggle & Deliberation Controls */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Deliberation Mode Switcher */}
                <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      if (isStepMode) handleToggleStepMode();
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                      !isStepMode
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Auto-deliberation: Continuous rounds without pausing between agent turns"
                  >
                    <Zap size={11} className={!isStepMode ? 'text-sky-400' : ''} />
                    <span>Auto</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isStepMode) handleToggleStepMode();
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                      isStepMode
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Human-in-the-loop: Pause after each agent turn so you can review and intervene"
                  >
                    <User size={11} className={isStepMode ? 'text-amber-400' : ''} />
                    <span>Step-by-Step</span>
                  </button>
                </div>

                {/* Turn & Run Controls */}
                {isRunning ? (
                  <button
                    type="button"
                    onClick={pauseCurrentDiscussion}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
                  >
                    <Pause size={12} />
                    <span>Pause</span>
                  </button>
                ) : (
                  <>
                    {/* If paused, show Next Turn and Resume buttons */}
                    {activeMeta.status === 'paused' && (
                      <button
                        type="button"
                        onClick={() => resumeCurrentDiscussion(resolvedWorkspace)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-colors shadow-sm"
                        title="Execute the next agent's turn"
                      >
                        <FastForward size={13} />
                        <span>Next Turn</span>
                      </button>
                    )}
                    {activeMeta.status !== 'completed' && activeMeta.status !== 'awaiting_review' && (
                      <button
                        type="button"
                        onClick={() => resumeCurrentDiscussion(resolvedWorkspace)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition-colors"
                      >
                        <Play size={12} />
                        <span>Resume</span>
                      </button>
                    )}
                  </>
                )}

                {isRunning && (
                  <button
                    type="button"
                    onClick={cancelCurrentDiscussion}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-colors"
                  >
                    <XCircle size={12} />
                    <span>Cancel</span>
                  </button>
                )}

                {/* Open in Tab Quick Button */}
                <button
                  type="button"
                  onClick={handleOpenReportInTab}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
                  title="Open report in preview tab and focus preview"
                >
                  <ExternalLink size={12} className="text-emerald-400" />
                  <span>Open in Tab</span>
                </button>
              </div>
            </header>

            {/* Stage View Tabs */}
            <div className="px-4 border-b border-slate-800 flex items-center gap-4 bg-slate-900/30">
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
                <span>Live Deliberation Stream ({activeTranscript.length})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('report');
                  if ((activeMeta.latestReportVersion > 0 || activeMeta.status === 'awaiting_review') && !activeReportMarkdown) {
                    loadReport(resolvedWorkspace, activeSessionId, activeMeta.latestReportVersion || 1);
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
                  12-Section Evidence Report {activeMeta.latestReportVersion > 0 ? `(v${activeMeta.latestReportVersion})` : ''}
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
              <div className="px-4 py-2 bg-rose-500/15 border-b border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={14} className="shrink-0" />
                  <span className="font-mono">{discussionError}</span>
                </div>
              </div>
            )}

            {/* View Tab Body */}
            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
              {/* TAB 1: Live Deliberation Timeline */}
              {activeTab === 'timeline' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-4xl mx-auto w-full">
                  {/* Round Progress Tracker */}
                  <div className="grid grid-cols-3 gap-2 p-3 bg-slate-900/60 rounded-xl border border-slate-800 shadow-sm">
                    <div className={`text-center p-2 rounded-lg border ${activeMeta.currentRound >= 1 ? 'bg-sky-500/10 border-sky-500/30 text-sky-300' : 'bg-slate-800/40 border-slate-800 text-slate-500'}`}>
                      <div className="text-[10px] font-bold uppercase tracking-wider">Round 1</div>
                      <div className="text-xs font-semibold mt-0.5">Initial Analysis</div>
                    </div>
                    <div className={`text-center p-2 rounded-lg border ${activeMeta.currentRound >= 2 ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-slate-800/40 border-slate-800 text-slate-500'}`}>
                      <div className="text-[10px] font-bold uppercase tracking-wider">Round 2</div>
                      <div className="text-xs font-semibold mt-0.5">Peer Critique</div>
                    </div>
                    <div className={`text-center p-2 rounded-lg border ${activeMeta.currentRound >= 3 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-slate-800/40 border-slate-800 text-slate-500'}`}>
                      <div className="text-[10px] font-bold uppercase tracking-wider">Round 3+</div>
                      <div className="text-xs font-semibold mt-0.5">Rebuttal &amp; Synthesis</div>
                    </div>
                  </div>

                  {/* Empty state for fresh session */}
                  {activeTranscript.length === 0 && Object.keys(streamingChunks).length === 0 && (
                    <div className="p-8 text-center text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800/60">
                      <Bot size={32} className="mx-auto mb-2 text-sky-400 opacity-60 animate-bounce" />
                      <h4 className="text-sm font-semibold text-slate-300">Agents are preparing deliberation</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                        Deterministic barrier synchronization ensures all agents analyze the problem before evaluating counter-proposals.
                      </p>
                    </div>
                  )}

                  {/* Transcript Items */}
                  {activeTranscript.map((msg: DiscussionMessage, idx: number) => {
                    const isHuman = msg.messageKind === 'user_intervention' || msg.authorAgentId === 'human-user';

                    return (
                      <div
                        key={msg.id || idx}
                        className={`p-4 rounded-xl border transition-all ${
                          isHuman
                            ? 'bg-teal-950/20 border-teal-500/40 shadow-sm'
                            : 'bg-slate-900/70 border-slate-800 shadow-sm'
                        }`}
                      >
                        {/* Message Card Header */}
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/60">
                          <div className="flex items-center gap-2.5">
                            {/* Avatar */}
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-inner"
                              style={{
                                backgroundColor: isHuman ? '#0d9488' : '#1e293b',
                                color: isHuman ? '#fff' : '#38bdf8',
                                border: `2px solid ${isHuman ? '#14b8a6' : '#38bdf8'}`,
                              }}
                            >
                              {isHuman ? <User size={13} /> : <Bot size={13} />}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-100">
                                  {isHuman ? 'Human Facilitator (You)' : msg.authorAgentId}
                                </span>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${getRoleBadgeStyle(
                                    msg.authorRole
                                  )}`}
                                >
                                  {msg.authorRole || 'Agent'}
                                </span>
                                {msg.authorProvider && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                                    {msg.authorProvider}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span className="px-1.5 py-0.5 rounded bg-slate-800/80 font-mono">
                              Round {msg.roundNumber} &bull; Turn {msg.turnIndex || 1}
                            </span>
                            {msg.tokenUsage && (
                              <span className="font-mono text-slate-500">
                                {msg.tokenUsage.totalTokens.toLocaleString()} tokens
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Markdown Content */}
                        <div
                          className="text-xs text-slate-300 leading-relaxed prose prose-invert max-w-none prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-800 prose-headings:text-slate-100 prose-a:text-sky-400"
                          dangerouslySetInnerHTML={{
                            __html: markdownService.render(msg.content),
                          }}
                        />
                      </div>
                    );
                  })}

                  {/* Streaming Chunk Indicator */}
                  {Object.entries(streamingChunks).map(([key, chunk]) => (
                    <div
                      key={key}
                      className="p-4 rounded-xl bg-sky-950/25 border border-sky-500/40 space-y-2 animate-pulse"
                    >
                      <div className="flex items-center gap-2 text-sky-400 text-xs font-bold">
                        <Sparkles size={14} className="animate-spin" />
                        <span>Deliberating: {key}...</span>
                      </div>
                      <div className="text-xs text-slate-300 font-mono whitespace-pre-wrap">
                        {String(chunk)}
                      </div>
                    </div>
                  ))}

                  {/* Paused for Human Turn / Review Banner */}
                  {activeMeta.status === 'paused' && (
                    <div className="p-4 rounded-xl bg-amber-950/25 border border-amber-500/40 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <Pause size={16} className="text-amber-400 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-amber-200">
                            Deliberation Paused for Human Review
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            You can inject guidance below or continue to hear from the next agent.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => resumeCurrentDiscussion(resolvedWorkspace)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-sm shrink-0"
                      >
                        <FastForward size={13} />
                        <span>Continue Next Turn</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Final 12-Section Evidence Report View */}
              {activeTab === 'report' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-4xl mx-auto w-full">
                  {/* Top Control Bar */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-900 rounded-xl border border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <FileText size={16} className="text-emerald-400" />
                      <div>
                        <span className="text-xs font-bold text-slate-100">
                          Evidence-Graded Consensus Report (v{activeReportVersion || activeMeta.latestReportVersion || 1})
                        </span>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Evaluated with 6-level epistemic evidence grading &amp; secret scrubbing
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyReport}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                      >
                        {copiedReport ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        <span>{copiedReport ? 'Copied' : 'Copy Report'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenReportInTab}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-sm"
                        title="Open report in preview tab and focus preview"
                      >
                        <ExternalLink size={13} />
                        <span>Open in Tab &amp; Focus Preview</span>
                      </button>
                    </div>
                  </div>

                  {/* Rendered 12-Section Markdown Report */}
                  {activeReportMarkdown ? (
                    <div
                      className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-200 leading-relaxed prose prose-invert max-w-none prose-headings:text-slate-100 prose-table:border prose-table:border-slate-800 prose-th:bg-slate-800/40 prose-td:border prose-td:border-slate-800"
                      dangerouslySetInnerHTML={{
                        __html: markdownService.render(activeReportMarkdown),
                      }}
                    />
                  ) : (
                    <div className="p-16 text-center text-slate-500 text-xs bg-slate-900/30 rounded-2xl border border-slate-800/60">
                      <Info size={28} className="mx-auto mb-2 text-slate-600" />
                      <p className="font-semibold text-slate-300">Report synthesis is in progress</p>
                      <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                        The 12-section evidence-graded final report is automatically generated at the conclusion of all debate rounds.
                      </p>
                      {activeMeta.latestReportVersion > 0 && (
                        <button
                          type="button"
                          onClick={() => loadReport(resolvedWorkspace, activeSessionId, activeMeta.latestReportVersion)}
                          className="mt-4 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold"
                        >
                          Reload Report v{activeMeta.latestReportVersion}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Disagreements & Decisions */}
              {activeTab === 'disputes' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-4xl mx-auto w-full">
                  <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30">
                    <h3 className="text-xs font-bold text-amber-300 flex items-center gap-2 mb-1.5">
                      <ShieldAlert size={14} />
                      <span>Preserved Disagreements (No Coerced Consensus)</span>
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      FlyMD preserves genuine technical disagreements intact rather than coercing models into superficial harmony. These topics represent vital architectural trade-offs requiring user direction.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                      <div className="text-xs font-bold text-slate-200 mb-2 flex items-center gap-1.5">
                        <CheckCircle size={13} className="text-emerald-400" />
                        <span>Agreed Decisions ({activeMeta.decisionsCount})</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Synthesized points of architectural consensus are grounded with citations in Section 5 of the Final Report.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                      <div className="text-xs font-bold text-slate-200 mb-2 flex items-center gap-1.5">
                        <Flame size={13} className="text-rose-400" />
                        <span>Active Divergences ({activeMeta.activeDisagreementsCount})</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Unresolved trade-offs and alternative perspectives are documented with complete rationale in Section 6.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Persistent Human-in-the-Loop Guidance Input Bar (Pinned at bottom of timeline) */}
              {activeTab === 'timeline' && (
                <div className="p-3 border-t border-slate-800 bg-slate-900/80 backdrop-blur-sm">
                  <div className="max-w-4xl mx-auto flex items-center gap-2">
                    <input
                      type="text"
                      value={guidanceInput}
                      onChange={(e) => setGuidanceInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
                          e.preventDefault();
                          handleSendGuidance();
                        }
                      }}
                      placeholder="Intervene or steer discussion... (e.g. 'Prioritize SQLite over Postgres', press Enter)"
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={handleSendGuidance}
                      disabled={!guidanceInput.trim()}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:hover:bg-sky-500 text-slate-950 text-xs font-bold transition-all shadow-sm shrink-0"
                    >
                      <Send size={12} />
                      <span>Steer</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty Workspace Welcome View */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
            <MessageSquare size={40} className="text-slate-700 mb-3" />
            <h3 className="text-base font-bold text-slate-300 mb-1">
              Multi-Agent Discussion Studio
            </h3>
            <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
              Coordinate multi-agent architectural debates with strict read-only process isolation, deterministic barrier synchronization, human-in-the-loop steering, and epistemic evidence-grading.
            </p>
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-sky-500/20"
            >
              <Plus size={14} />
              <span>Launch New Deliberation</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. New Deliberation Modal (Custom Team & Presets) */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
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
                className="text-slate-400 hover:text-slate-200 text-base"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Discussion Topic</label>
                <input
                  type="text"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="e.g. SQLite Persistence vs Embedded RocksDB"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Technical Proposal &amp; Constraints</label>
                <textarea
                  rows={3}
                  value={newIdea}
                  onChange={(e) => setNewIdea(e.target.value)}
                  placeholder="Describe the architectural design, trade-offs, and critical constraints..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 leading-relaxed transition-colors"
                />
              </div>

              {/* Mode Selection Tab: Preset vs Custom Team */}
              <div className="border border-slate-800 rounded-xl p-3 bg-slate-950/60">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Sliders size={13} className="text-sky-400" />
                    <span>Agent Team Configuration</span>
                  </div>
                  <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setNewDebateMode('preset')}
                      className={`px-3 py-1 rounded text-[11px] font-semibold transition-all ${
                        newDebateMode === 'preset'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Presets
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewDebateMode('custom')}
                      className={`px-3 py-1 rounded text-[11px] font-semibold transition-all ${
                        newDebateMode === 'custom'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Custom Team ({customParticipants.length})
                    </button>
                  </div>
                </div>

                {newDebateMode === 'preset' ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    {(Object.keys(PRESET_TEMPLATES) as PresetKey[]).map((key) => {
                      const preset = PRESET_TEMPLATES[key];
                      const isSelected = selectedPreset === key;
                      return (
                        <div
                          key={key}
                          onClick={() => handleSelectPreset(key)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-sky-500/15 border-sky-500/50 text-slate-100 shadow-sm'
                              : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900 text-slate-300'
                          }`}
                        >
                          <div className="font-bold text-xs flex items-center justify-between">
                            <span>{preset.name}</span>
                            {isSelected && <Check size={13} className="text-sky-400" />}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                            {preset.description}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-2">
                            {preset.participants.length} participating agents
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Custom Team Editor */
                  <div className="space-y-3">
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {customParticipants.map((p, idx) => (
                        <div
                          key={p.agentId || idx}
                          className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center gap-2 text-xs"
                        >
                          <input
                            type="color"
                            value={p.avatarColor || '#38bdf8'}
                            onChange={(e) => handleUpdateParticipant(idx, { avatarColor: e.target.value })}
                            className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent"
                            title="Avatar color"
                          />
                          <input
                            type="text"
                            value={p.displayName}
                            onChange={(e) => handleUpdateParticipant(idx, { displayName: e.target.value })}
                            placeholder="Agent Name"
                            className="w-32 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                          />
                          <select
                            value={p.role}
                            onChange={(e) => handleUpdateParticipant(idx, { role: e.target.value as any })}
                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                          >
                            <option value="architect">Architect</option>
                            <option value="critic">Critic</option>
                            <option value="auditor">Auditor</option>
                            <option value="implementer">Implementer</option>
                            <option value="researcher">Researcher</option>
                          </select>
                          <select
                            value={p.providerId}
                            onChange={(e) => handleUpdateParticipant(idx, { providerId: e.target.value })}
                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                          >
                            <option value="mock">Local Mock</option>
                            <option value="claude-code">Claude Code CLI</option>
                            <option value="gemini-antigravity">Gemini CLI</option>
                            <option value="ollama">Ollama</option>
                            <option value="http-llm">OpenAI / HTTP</option>
                            <option value="deepseek">DeepSeek</option>
                          </select>
                          <input
                            type="text"
                            value={p.modelId}
                            onChange={(e) => handleUpdateParticipant(idx, { modelId: e.target.value })}
                            placeholder="Model ID"
                            className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-[11px]"
                          />
                          <button
                            type="button"
                            disabled={customParticipants.length <= 2}
                            onClick={() => handleRemoveParticipant(idx)}
                            className="p-1 text-slate-500 hover:text-rose-400 disabled:opacity-20"
                            title="Remove agent"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleAddParticipant}
                      className="w-full py-1.5 rounded-lg border border-dashed border-slate-700 hover:border-sky-500 text-slate-400 hover:text-sky-400 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus size={13} />
                      <span>Add Participating Agent</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Rounds, Timeout, and Execution Mode */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Deliberation Rounds</label>
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
                  <label className="block text-slate-300 font-semibold mb-1">Turn Timeout (s)</label>
                  <input
                    type="number"
                    min={15}
                    max={600}
                    value={turnTimeoutSecs}
                    onChange={(e) => setTurnTimeoutSecs(Math.max(15, Number(e.target.value)))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Initial Mode</label>
                  <div className="flex items-center gap-2 pt-1.5">
                    <input
                      type="checkbox"
                      id="stepModeCheck"
                      checked={enableStepModeInNew}
                      onChange={(e) => setEnableStepModeInNew(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-800 text-sky-500 focus:ring-0"
                    />
                    <label htmlFor="stepModeCheck" className="text-slate-300 text-xs cursor-pointer">
                      Step-by-Step Mode
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
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
                className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-colors shadow-sm"
              >
                Launch Deliberation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Single Session Deletion Confirmation Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5">
            <div className="flex items-center gap-2.5 text-rose-400 mb-2">
              <Trash2 size={18} />
              <h3 className="text-sm font-bold text-slate-100">Delete Deliberation</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Are you sure you want to permanently delete session <span className="font-mono text-slate-200">{sessionToDelete}</span>? Canonical transcript, decision ledger, and report versions will be permanently removed.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSession}
                className="px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold transition-colors"
              >
                Delete Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Clear All Sessions Confirmation Modal */}
      {showClearAllModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5">
            <div className="flex items-center gap-2.5 text-rose-400 mb-2">
              <AlertTriangle size={18} />
              <h3 className="text-sm font-bold text-slate-100">Clear All Deliberations</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Are you sure you want to delete all <span className="font-bold text-slate-200">{discussions.length}</span> historical deliberation sessions in this workspace? This action is permanent and cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowClearAllModal(false)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                className="px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
