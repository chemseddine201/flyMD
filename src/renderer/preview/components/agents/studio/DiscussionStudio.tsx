import React, { useEffect, useMemo, useState } from 'react';
import {
  MessageSquare,
  Settings,
  Edit3,
  CopyPlus,
  RotateCcw,
  Footprints,
  ToggleLeft,
  ToggleRight,
  Plus,
  Play,
  Pause,
  XCircle,
  RotateCw,
  Send,
  FileText,
  ShieldAlert,
  CheckCircle2,
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
  ChevronDown,
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
  Clock,
  Quote,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  Brain,
  Target,
  Compass,
} from 'lucide-react';
import { usePreviewStore, PreviewStoreState } from '../../../store';
import {
  DiscussionConfig,
  DiscussionParticipant,
  DiscussionStatus,
  AgentRoleType,
  DiscussionMetadata,
  DiscussionMessage,
  AgentCustomAction,
  AvailableProviderInfo,
  AgentEffortLevel,
} from '../../../../../shared/types';
import { markdownService } from '../../../services/MarkdownService';

interface DiscussionStudioProps {
  resolvedWorkspace: string;
  onNavigateToReport?: () => void;
}

import {
  DeliberationPreset,
  PresetKey,
  cleanDiscussionMarkdown,
  DEFAULT_PRESET_TEMPLATES,
  STORAGE_KEY_PRESETS,
  loadSavedPresets,
  savePresetsToStorage,
  PRESET_TEMPLATES,
} from '../../../services/deliberationPresetRepository';
import { NewDeliberationModal } from './discussion/NewDeliberationModal';
import { DiscussionSessionSidebar } from './discussion/DiscussionSessionSidebar';

export type { DeliberationPreset, PresetKey };
export { cleanDiscussionMarkdown, DEFAULT_PRESET_TEMPLATES, STORAGE_KEY_PRESETS, loadSavedPresets };

const COLOR_PALETTE = ['#38bdf8', '#818cf8', '#ef4444', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#a855f7'];

export interface ActionCatalogItem {
  id: string;
  name: string;
  description: string;
  promptDirective: string;
}

export const ACTION_CATALOG: ActionCatalogItem[] = [
  {
    id: 'standard',
    name: 'Standard Role Deliberation',
    description: 'Autonomous discourse aligned with role assignment',
    promptDirective: '',
  },
  {
    id: 'arch-decomp',
    name: 'Architectural Invariant Decomposition',
    description: 'Strict modular boundary & crash-safety analysis',
    promptDirective: 'Decompose the architecture into strict layers. Specify data-flow invariants, crash-recovery boundaries, and single points of failure.',
  },
  {
    id: 'security-audit',
    name: 'Zero-Trust Security & Sandbox Audit',
    description: 'Privilege isolation, path traversal & token leaks',
    promptDirective: 'Audit against zero-trust requirements. Scrutinize filesystem read boundaries, unauthorized process elevation, and prompt injection avenues.',
  },
  {
    id: 'concurrency-stress',
    name: 'Concurrency & Deadlock Stress Test',
    description: 'Race conditions, file locks & zombie process hazards',
    promptDirective: 'Stress test concurrent access scenarios. Identify race conditions, file lock contention, async cancellation hazards, and zombie process risks.',
  },
  {
    id: 'chaos-adversary',
    name: 'Chaos Engineering & Failure Injection',
    description: 'Cascade drops, power loss, corrupted logs & timeouts',
    promptDirective: 'Simulate critical system failure: unexpected process termination, sudden power loss during writes, corrupted JSONL lines, and network timeout cascading.',
  },
  {
    id: 'custom',
    name: 'Custom Prompt Directive...',
    description: 'Define your own specialized inquiry or probe for this agent',
    promptDirective: '',
  },
];

export const calculateThinkingSteps = (thinking?: string): number => {
  if (!thinking) return 0;
  const stepMatches = thinking.match(/(?:step\s*\d+|invariant|\d+\.|\bfirst\b|\bsecond\b|\bfinally\b)/gi);
  return Math.max(1, stepMatches ? stepMatches.length : Math.ceil(thinking.length / 250));
};

const ROUND_METADATA = [
  { round: 1, title: 'Phase 1: Independent Position Papers', desc: 'Each agent presents isolated analysis grounded in role evidence.' },
  { round: 2, title: 'Phase 2: Peer Cross-Examination & Critiques', desc: 'Models critique opposing claims, expose edge cases, and challenge assumptions.' },
  { round: 3, title: 'Phase 3: Rebuttal & Consensus Synthesis', desc: 'Agents revise stances, document concessions, and record unresolved trade-offs.' },
];

const LiveStreamingTurnCard: React.FC<{
  roundNumber: number;
  currentRound?: number;
  isRunning: boolean;
}> = React.memo(({ roundNumber, currentRound, isRunning }) => {
  const streamingChunks = usePreviewStore((s: PreviewStoreState) => s.streamingChunks);
  const streamingThinking = usePreviewStore((s: PreviewStoreState) => s.streamingThinking);

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
});

export const DiscussionStudio: React.FC<DiscussionStudioProps> = ({
  resolvedWorkspace,
  onNavigateToReport,
}) => {
  const discussions = usePreviewStore((s: PreviewStoreState) => s.discussions);
  const activeSessionId = usePreviewStore((s: PreviewStoreState) => s.activeSessionId);
  const activeMeta = usePreviewStore((s: PreviewStoreState) => s.activeDiscussionMeta);
  const activeTranscript = usePreviewStore((s: PreviewStoreState) => s.activeTranscript);
  const availableProviders = usePreviewStore((s: PreviewStoreState) => s.availableProviders);
  const activeReportMarkdown = usePreviewStore((s: PreviewStoreState) => s.activeReportMarkdown);
  const activeReportVersion = usePreviewStore((s: PreviewStoreState) => s.activeReportVersion);
  const isRunning = usePreviewStore((s: PreviewStoreState) => s.isDiscussionRunning);
  const isStepMode = usePreviewStore((s: PreviewStoreState) => s.isStepMode);
  const discussionError = usePreviewStore((s: PreviewStoreState) => s.discussionError);

  const loadDiscussions = usePreviewStore((s: PreviewStoreState) => s.loadDiscussions);
  const selectDiscussion = usePreviewStore((s: PreviewStoreState) => s.selectDiscussion);
  const loadAvailableProviders = usePreviewStore((s: PreviewStoreState) => s.loadAvailableProviders);
  const startNewDiscussion = usePreviewStore((s: PreviewStoreState) => s.startNewDiscussion);
  const pauseCurrentDiscussion = usePreviewStore((s: PreviewStoreState) => s.pauseCurrentDiscussion);
  const resumeCurrentDiscussion = usePreviewStore((s: PreviewStoreState) => s.resumeCurrentDiscussion);
  const cancelCurrentDiscussion = usePreviewStore((s: PreviewStoreState) => s.cancelCurrentDiscussion);
  const injectGuidance = usePreviewStore((s: PreviewStoreState) => s.injectGuidance);
  const dispatchTargetedAction = usePreviewStore((s: PreviewStoreState) => s.dispatchTargetedAction);
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
  const [timelineFilter, setTimelineFilter] = useState<string>('all');

  // Accordion state: which rounds and turns are expanded
  const [expandedRounds, setExpandedRounds] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
  });
  const [expandedTurns, setExpandedTurns] = useState<Record<string, boolean>>({});
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});

  // Targeted agent probe drawer & dispatcher state
  const [showTargetedDispatch, setShowTargetedDispatch] = useState<boolean>(false);
  const [targetedAgentId, setTargetedAgentId] = useState<string>('');
  const [targetedActionName, setTargetedActionName] = useState<string>('Targeted Inquiry');
  const [targetedActionQuery, setTargetedActionQuery] = useState<string>('');
  const [targetedEffortLevel, setTargetedEffortLevel] = useState<AgentEffortLevel>('medium');
  const [targetedThinkingEnabled, setTargetedThinkingEnabled] = useState<boolean>(true);
  const [isDispatchingTargeted, setIsDispatchingTargeted] = useState<boolean>(false);

  // Modals & confirmation dialogs
  const [showNewModal, setShowNewModal] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [guidanceInput, setGuidanceInput] = useState('');
  const [copiedReport, setCopiedReport] = useState(false);
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);
  const [tabFocusNotification, setTabFocusNotification] = useState<string | null>(null);

  // New discussion configuration state
  // Presets & Custom Actions Management State
  const [presets, setPresets] = useState<DeliberationPreset[]>(loadSavedPresets);
  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    const first = loadSavedPresets().find((p) => p.enabled);
    return first ? first.id : 'architecture';
  });
  const [editingPreset, setEditingPreset] = useState<DeliberationPreset | null>(null);
  const [isCreatingNewPreset, setIsCreatingNewPreset] = useState(false);

  // New discussion configuration state (Empty initial values with placeholders)
  const [newTopic, setNewTopic] = useState('');
  const [newIdea, setNewIdea] = useState('');
  const [maxRounds, setMaxRounds] = useState(3);
  const [maxRoundsInput, setMaxRoundsInput] = useState<string>('3');
  const [turnTimeoutSecs, setTurnTimeoutSecs] = useState(120);
  const [turnTimeoutInput, setTurnTimeoutInput] = useState<string>('120');
  const [newDebateMode, setNewDebateMode] = useState<'preset' | 'actions' | 'custom'>('preset');
  const [presetEngine, setPresetEngine] = useState<string>('mock');
  const [presetEffortLevel, setPresetEffortLevel] = useState<AgentEffortLevel>('medium');
  const [presetThinkingEnabled, setPresetThinkingEnabled] = useState<boolean>(true);
  const [enableStepModeInNew, setEnableStepModeInNew] = useState(false);
  const [customParticipants, setCustomParticipants] = useState<DiscussionParticipant[]>(
    () => (loadSavedPresets().find((p) => p.id === 'architecture') || loadSavedPresets()[0]).participants
  );

  // Discussion preview text zoom level (80% - 180%, default 100%)
  const [turnZoom, setTurnZoom] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('flymd:discussion-zoom');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 80 && val <= 180) return val;
      }
    } catch {}
    return 100;
  });

  const handleUpdateZoom = (newZoom: number) => {
    const clamped = Math.max(80, Math.min(180, newZoom));
    setTurnZoom(clamped);
    try {
      localStorage.setItem('flymd:discussion-zoom', clamped.toString());
    } catch {}
  };

  // Load discussions on mount & subscribe to real-time events
  useEffect(() => {
    if (resolvedWorkspace) {
      loadDiscussions(resolvedWorkspace);
    }
  }, [resolvedWorkspace, loadDiscussions]);

  // Load available LLM providers on mount
  useEffect(() => {
    loadAvailableProviders();
  }, [loadAvailableProviders]);

  useEffect(() => {
    if (!window.electronAPI?.onDiscussionEvent) return;
    const unsub = window.electronAPI.onDiscussionEvent((event: any) => {
      handleDiscussionEvent(event);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [handleDiscussionEvent]);

  // Reconciliation Heartbeat Guard:
  // If isRunning is true, verify every 2.5s with backend metadata to guard against dropped IPC push events
  useEffect(() => {
    if (!isRunning || !activeSessionId || !resolvedWorkspace) return;

    const timer = setInterval(async () => {
      try {
        if (!window.electronAPI?.getDiscussionMetadata) return;
        const meta = await window.electronAPI.getDiscussionMetadata(resolvedWorkspace, activeSessionId);
        if (meta && meta.status !== 'running') {
          console.log(`[DiscussionStudio] Heartbeat reconciled settled discussion '${activeSessionId}' (status: ${meta.status})`);
          await selectDiscussion(resolvedWorkspace, activeSessionId);
        }
      } catch (err) {
        console.warn('[DiscussionStudio] Heartbeat check failed:', err);
      }
    }, 2500);

    return () => clearInterval(timer);
  }, [isRunning, activeSessionId, resolvedWorkspace, selectDiscussion]);

  // When active session changes or finishes, auto-load report if available
  useEffect(() => {
    if (activeMeta?.latestReportVersion && activeMeta.latestReportVersion > 0 && !activeReportMarkdown && resolvedWorkspace && activeSessionId) {
      loadReport(resolvedWorkspace, activeSessionId, activeMeta.latestReportVersion);
    }
  }, [activeMeta?.latestReportVersion, activeReportMarkdown, resolvedWorkspace, activeSessionId, loadReport]);

  // Expand latest messages by default
  useEffect(() => {
    if (activeTranscript.length > 0) {
      const lastMsg = activeTranscript[activeTranscript.length - 1];
      setExpandedTurns((prev) => ({ ...prev, [lastMsg.id]: true }));
    }
  }, [activeTranscript.length]);

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

  // Group active transcript into rounds in single-pass O(M)
  const roundGroups = useMemo(() => {
    const totalRounds = Math.max(3, activeMeta?.currentRound || 1);
    const msgsByRound = new Map<number, DiscussionMessage[]>();
    const tokensByRound = new Map<number, number>();

    for (const m of activeTranscript) {
      const r = m.roundNumber;
      let list = msgsByRound.get(r);
      if (!list) {
        list = [];
        msgsByRound.set(r, list);
      }
      list.push(m);
      tokensByRound.set(r, (tokensByRound.get(r) || 0) + (m.tokenUsage?.totalTokens || 0));
    }

    const groups: {
      round: number;
      title: string;
      desc: string;
      messages: DiscussionMessage[];
      totalTokens: number;
      isCurrent: boolean;
      isDone: boolean;
    }[] = [];

    const currentRound = activeMeta?.currentRound || 1;
    const isSessionDone =
      activeMeta?.status === 'awaiting_review' || activeMeta?.status === 'completed';

    for (let r = 1; r <= totalRounds; r++) {
      const meta = ROUND_METADATA.find((m) => m.round === r) || {
        round: r,
        title: `Phase ${r}: Advanced Deliberation`,
        desc: 'Continued multi-agent cross-examination and refinement.',
      };

      const msgs = msgsByRound.get(r) || [];
      const roundTokens = tokensByRound.get(r) || 0;
      const isCurrent = currentRound === r;
      const isDone = currentRound > r || isSessionDone;

      groups.push({
        round: r,
        title: meta.title,
        desc: meta.desc,
        messages: msgs,
        totalTokens: roundTokens,
        isCurrent,
        isDone,
      });
    }

    return groups;
  }, [activeTranscript, activeMeta?.currentRound, activeMeta?.status]);

  // Filter messages by role if selected
  const applyTimelineFilter = (messages: DiscussionMessage[]) => {
    if (timelineFilter === 'all') return messages;
    return messages.filter((m) => {
      const role = (m.authorRole || '').toLowerCase();
      if (timelineFilter === 'human') return m.messageKind === 'user_intervention' || m.authorAgentId === 'human-user';
      return role.includes(timelineFilter.toLowerCase());
    });
  };

  // Generate 1-line clean snippet for folded turns
  const getMessageSnippet = (content: string) => {
    if (!content) return 'Deliberation completed.';
    const clean = content
      .replace(/^#+\s+/gm, '')
      .replace(/\*\*/g, '')
      .replace(/```[\s\S]*?```/g, '[Code]')
      .replace(/\n+/g, ' ')
      .trim();
    return clean.length > 150 ? `${clean.slice(0, 147)}...` : clean;
  };

  // Expand / collapse all rounds and turns
  const handleToggleExpandAll = (expand: boolean) => {
    const roundMap: Record<number, boolean> = {};
    for (let r = 1; r <= Math.max(3, activeMeta?.currentRound || 1); r++) {
      roundMap[r] = expand;
    }
    setExpandedRounds(roundMap);

    const turnMap: Record<string, boolean> = {};
    activeTranscript.forEach((m) => {
      turnMap[m.id] = expand;
    });
    setExpandedTurns(turnMap);
  };

  const toggleRound = (round: number) => {
    setExpandedRounds((prev) => ({ ...prev, [round]: !prev[round] }));
  };

  const toggleTurn = (turnId: string) => {
    setExpandedTurns((prev) => ({ ...prev, [turnId]: !prev[turnId] }));
  };

  const toggleThinking = (turnId: string) => {
    setExpandedThinking((prev) => ({ ...prev, [turnId]: !prev[turnId] }));
  };

  // Extract distinct agents participating in current session for targeted dispatch
  const participantAgents = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role: string; color?: string }>();
    for (const msg of activeTranscript) {
      if (msg.authorAgentId && msg.authorAgentId !== 'human-user') {
        if (!map.has(msg.authorAgentId)) {
          map.set(msg.authorAgentId, {
            id: msg.authorAgentId,
            name: msg.authorDisplayName || msg.authorAgentId,
            role: msg.authorRole,
          });
        }
      }
    }
    if (map.size === 0) {
      PRESET_TEMPLATES.architecture.participants.forEach((p) => {
        map.set(p.agentId, { id: p.agentId, name: p.displayName, role: p.role, color: p.avatarColor });
      });
    }
    return Array.from(map.values());
  }, [activeTranscript]);

  useEffect(() => {
    if (!targetedAgentId && participantAgents.length > 0) {
      setTargetedAgentId(participantAgents[0].id);
    }
  }, [targetedAgentId, participantAgents]);

  const handleDispatchTargetedQuery = async () => {
    if (!targetedActionQuery.trim() || !targetedAgentId) return;
    setIsDispatchingTargeted(true);
    try {
      await dispatchTargetedAction(targetedAgentId, targetedActionName || 'Targeted Inquiry', targetedActionQuery.trim());
      setTargetedActionQuery('');
      setShowTargetedDispatch(false);
    } finally {
      setIsDispatchingTargeted(false);
    }
  };

  // Copy turn markdown
  const handleCopyTurn = (turnId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedTurnId(turnId);
    setTimeout(() => setCopiedTurnId(null), 2000);
  };

  // Quote agent into guidance box
  const handleQuoteInGuidance = (agentName: string, snippet: string) => {
    const quote = `> @${agentName}: "${snippet.slice(0, 100)}..."\nRegarding this point: `;
    setGuidanceInput((prev) => (prev ? `${prev}\n\n${quote}` : quote));
  };

  // Save presets helper
  const savePresets = (updated: DeliberationPreset[]) => {
    setPresets(updated);
    savePresetsToStorage(updated);
  };

  // Handle Preset selection change in New Modal
  const handleSelectPreset = (key: string) => {
    setSelectedPreset(key);
    const found = presets.find((p) => p.id === key);
    if (found) {
      setCustomParticipants(found.participants);
    }
  };

  // Toggle preset enabled/disabled
  const handleTogglePresetEnabled = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = presets.map((p) => {
      if (p.id === id) {
        return { ...p, enabled: !p.enabled };
      }
      return p;
    });
    savePresets(updated);
    if (selectedPreset === id) {
      const fallback = updated.find((p) => p.enabled) || updated[0];
      if (fallback) {
        setSelectedPreset(fallback.id);
        setCustomParticipants(fallback.participants);
      }
    }
  };

  // Start editing a preset
  const handleStartEditPreset = (preset: DeliberationPreset, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsCreatingNewPreset(false);
    setEditingPreset(JSON.parse(JSON.stringify(preset)));
    setNewDebateMode('actions');
  };

  // Start creating a custom preset
  const handleStartCreatePreset = () => {
    const newId = `preset-${Date.now()}`;
    const newPreset: DeliberationPreset = {
      id: newId,
      name: 'Custom Domain Action Deliberation',
      description: 'Domain-specific deliberation team with custom roles and inquiry directives.',
      enabled: true,
      isBuiltIn: false,
      participants: [
        {
          agentId: `agent-lead-${Date.now()}`,
          providerId: 'mock',
          modelId: 'custom-expert-v1',
          displayName: 'Domain Architect',
          role: 'architect',
          roleDescription: 'Primary domain specialist proposing architecture and requirements.',
          avatarColor: '#38bdf8',
          assignedSkillUris: [],
          contextBudgetTokens: 32000,
          customAction: {
            id: `action-${Date.now()}-1`,
            name: 'Domain Invariant Decomposition',
            description: 'Decompose core domain logic',
            promptDirective: 'Decompose the domain model, invariants, and edge cases for this topic.',
          },
        },
        {
          agentId: `agent-critic-${Date.now()}`,
          providerId: 'mock',
          modelId: 'custom-critic-v1',
          displayName: 'Adversarial Critic',
          role: 'critic',
          roleDescription: 'Challenge assumptions, find single points of failure, and expose bottlenecks.',
          avatarColor: '#ef4444',
          assignedSkillUris: [],
          contextBudgetTokens: 32000,
          customAction: {
            id: `action-${Date.now()}-2`,
            name: 'Adversarial Challenge',
            description: 'Stress test failure modes',
            promptDirective: 'Challenge all unstated assumptions, bottlenecks, and error recovery strategies.',
          },
        },
      ],
    };
    setIsCreatingNewPreset(true);
    setEditingPreset(newPreset);
    setNewDebateMode('actions');
  };

  // Save the preset being edited
  const handleSaveEditingPreset = () => {
    if (!editingPreset) return;
    const exists = presets.some((p) => p.id === editingPreset.id);
    let updated: DeliberationPreset[];
    if (exists) {
      updated = presets.map((p) => (p.id === editingPreset.id ? editingPreset : p));
    } else {
      updated = [...presets, editingPreset];
    }
    savePresets(updated);
    setSelectedPreset(editingPreset.id);
    setCustomParticipants(editingPreset.participants);
    setEditingPreset(null);
    setIsCreatingNewPreset(false);
  };

  // Delete preset
  const handleDeletePreset = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (presets.length <= 1) return;
    const updated = presets.filter((p) => p.id !== id);
    savePresets(updated);
    if (selectedPreset === id) {
      const fallback = updated.find((p) => p.enabled) || updated[0];
      if (fallback) {
        setSelectedPreset(fallback.id);
        setCustomParticipants(fallback.participants);
      }
    }
  };

  // Duplicate preset
  const handleDuplicatePreset = (preset: DeliberationPreset, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const cloned: DeliberationPreset = {
      ...JSON.parse(JSON.stringify(preset)),
      id: `preset-${Date.now()}`,
      name: `${preset.name} (Custom Copy)`,
      isBuiltIn: false,
      enabled: true,
    };
    const updated = [...presets, cloned];
    savePresets(updated);
  };

  // Reset presets to defaults
  const handleResetPresetsToDefaults = () => {
    savePresets(DEFAULT_PRESET_TEMPLATES);
    setSelectedPreset('architecture');
    setCustomParticipants(DEFAULT_PRESET_TEMPLATES[0].participants);
    setEditingPreset(null);
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
      thinkingEnabled: true,
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
    if (!resolvedWorkspace) return;
    const sessionId = `disc-${Date.now()}`;
    const topicToUse = newTopic.trim() || 'Multi-Agent Deliberation';
    const ideaToUse = newIdea.trim() || `In-depth multi-perspective evaluation and decision analysis for: ${topicToUse}`;

    const currentPreset = presets.find((p) => p.id === selectedPreset) || presets[0] || DEFAULT_PRESET_TEMPLATES[0];
    let participants = newDebateMode === 'preset'
      ? currentPreset.participants
      : customParticipants;

    if (newDebateMode === 'preset') {
      let targetProvider = presetEngine;
      if (presetEngine === 'auto') {
        const best = availableProviders.find((ap) => ap.available && ap.id !== 'mock');
        targetProvider = best ? best.id : 'mock';
      }

      const matched = availableProviders.find((ap) => ap.id === targetProvider);
      participants = participants.map((p) => {
        if (targetProvider === 'mock') {
          return {
            ...p,
            providerId: 'mock',
            modelId: p.modelId || 'adaptive-domain-simulator',
            thinkingEnabled: presetThinkingEnabled,
            effortLevel: presetEffortLevel,
          };
        }
        return {
          ...p,
          providerId: targetProvider,
          modelId: matched?.model || p.modelId,
          thinkingEnabled: presetThinkingEnabled,
          effortLevel: presetEffortLevel,
        };
      });
    }

    // Guard against empty custom agent role fields to prevent simulation stalls
    const sanitizedParticipants = participants.map((p, idx) => ({
      ...p,
      displayName: p.displayName?.trim() || `Specialist Agent ${idx + 1}`,
      role: p.role || 'critic',
      roleDescription:
        p.roleDescription?.trim() ||
        'Provide specialized domain analysis, critical perspectives, and actionable recommendations.',
      customQuery:
        p.customQuery?.trim() ||
        'Analyze the topic for strategic soundness, feasibility, evidence quality, and potential risks.',
      contextBudgetTokens: p.contextBudgetTokens || 16000,
      effortLevel: p.effortLevel || presetEffortLevel || 'medium',
      thinkingEnabled: p.thinkingEnabled ?? presetThinkingEnabled ?? true,
    }));

    const config: DiscussionConfig = {
      schemaVersion: 1,
      sessionId,
      topic: topicToUse,
      userIdea: ideaToUse,
      workspacePath: resolvedWorkspace,
      maxRounds: Math.min(10, Math.max(1, parseInt(maxRoundsInput, 10) || maxRounds || 3)),
      turnTimeoutSecs: Math.min(600, Math.max(15, parseInt(turnTimeoutInput, 10) || turnTimeoutSecs || 120)),
      participants: sanitizedParticipants,
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
    <div className="flex-1 h-full w-full min-h-0 flex overflow-hidden bg-slate-950 text-slate-200 font-sans">
      {/* 1. Left Session Explorer Sidebar */}
      <DiscussionSessionSidebar
        discussions={discussions}
        activeSessionId={activeSessionId}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filteredDiscussions={filteredDiscussions}
        onSelectSession={(sessionId) => selectDiscussion(resolvedWorkspace, sessionId)}
        onOpenNewModal={() => setShowNewModal(true)}
        onOpenClearAllModal={() => setShowClearAllModal(true)}
        onDeleteSession={(sessionId) => setSessionToDelete(sessionId)}
        getStatusBadge={getStatusBadge}
      />

      {/* 2. Main Stage Deliberation Canvas */}
      <div className="flex-1 h-full flex flex-col min-w-0 min-h-0 overflow-hidden bg-slate-950">
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
                    <span>{activeMeta.totalMessages} turns</span>
                    <span>&bull;</span>
                    <span className="font-mono">{activeMeta.totalTokens.toLocaleString()} tokens</span>
                    {activeMeta.decisionsCount > 0 && (
                      <>
                        <span>&bull;</span>
                        <span className="text-emerald-400 font-semibold">{activeMeta.decisionsCount} decisions agreed</span>
                      </>
                    )}
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
                    className={`p-1.5 rounded transition-all ${
                      !isStepMode
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Auto Deliberation Mode (Continuous rounds without pausing)"
                  >
                    <Zap size={14} className={!isStepMode ? 'text-sky-400' : ''} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isStepMode) handleToggleStepMode();
                    }}
                    className={`p-1.5 rounded transition-all ${
                      isStepMode
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Step-by-Step Mode (Pauses at each turn barrier for human steering)"
                  >
                    <Footprints size={14} className={isStepMode ? 'text-amber-400' : ''} />
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

                {/* Go to Report Button when Settled or Completed */}
                {(activeMeta.status === 'completed' ||
                  activeMeta.status === 'awaiting_review' ||
                  activeMeta.currentRound >= 3) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigateToReport) {
                        onNavigateToReport();
                      } else {
                        setActiveTab('report');
                        if (!activeReportMarkdown) {
                          loadReport(
                            resolvedWorkspace,
                            activeSessionId,
                            activeMeta.latestReportVersion || 1
                          );
                        }
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-sm"
                    title="Deliberation settled. Review full synthesis report."
                  >
                    <FileText size={13} />
                    <span>Go to Report &rarr;</span>
                  </button>
                )}

                {/* Open in Tab Quick Button */}
                <button
                  type="button"
                  onClick={handleOpenReportInTab}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                  title="Open Deliberation Report in Editor Tab"
                >
                  <ExternalLink size={14} className="text-emerald-400" />
                </button>
              </div>
            </header>

            {/* Stage View Tabs */}
            <div className="px-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/30">
              <div className="flex items-center gap-4">
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
                  <span>Deliberation Actions ({activeTranscript.length})</span>
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

              {/* Action Toolbar: Expand All / Collapse All, Role Filter & Font Zoom */}
              <div className="flex items-center gap-2 py-1.5 flex-wrap">
                {activeTab === 'timeline' && (
                  <>
                    <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800 text-[11px]">
                      <SlidersHorizontal size={11} className="text-slate-400" />
                      <select
                        value={timelineFilter}
                        onChange={(e) => setTimelineFilter(e.target.value)}
                        className="bg-transparent border-0 text-slate-300 focus:outline-none cursor-pointer py-0.5 text-[11px]"
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
                      onClick={() => handleToggleExpandAll(true)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[11px] flex items-center gap-1"
                      title="Expand all turns"
                    >
                      <Maximize2 size={11} />
                      <span>Expand</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleExpandAll(false)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[11px] flex items-center gap-1"
                      title="Collapse all turns"
                    >
                      <Minimize2 size={11} />
                      <span>Collapse</span>
                    </button>
                  </>
                )}

                {/* Text Size Scale Controls (A- / A+) */}
                <div className="flex items-center gap-0.5 bg-slate-950 px-1.5 py-0.5 rounded-md border border-slate-800 text-[11px] text-slate-300 ml-auto">
                  <button
                    type="button"
                    onClick={() => handleUpdateZoom(turnZoom - 10)}
                    disabled={turnZoom <= 80}
                    className="px-1.5 py-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-40 font-bold transition-colors"
                    title="Decrease discussion preview text size (A-)"
                  >
                    A-
                  </button>
                  <span className="font-mono text-[10px] px-1 text-slate-400 select-none">
                    {turnZoom}%
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUpdateZoom(turnZoom + 10)}
                    disabled={turnZoom >= 180}
                    className="px-1.5 py-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-40 font-bold transition-colors"
                    title="Increase discussion preview text size (A+)"
                  >
                    A+
                  </button>
                  {turnZoom !== 100 && (
                    <button
                      type="button"
                      onClick={() => handleUpdateZoom(100)}
                      className="text-[9px] text-slate-500 hover:text-sky-400 ml-1 underline transition-colors"
                      title="Reset text size to 100%"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Error Banner */}
            {(discussionError || (activeMeta?.status === 'failed' ? activeMeta?.errorMessage : null)) && (
              <div className="px-4 py-3 bg-rose-500/15 border-b border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3 shadow-inner">
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldAlert size={15} className="shrink-0 text-rose-400" />
                  <span className="font-mono text-[11px] leading-relaxed break-words">
                    {discussionError || activeMeta?.errorMessage}
                  </span>
                </div>
              </div>
            )}

            {/* View Tab Body */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* TAB 1: Antigravity-Style Grouped Actions Timeline */}
              {activeTab === 'timeline' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-4xl mx-auto w-full">
                  {/* Empty state for fresh session */}
                  {activeTranscript.length === 0 && !isRunning && (
                    <div className="p-8 text-center text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800/60">
                      <Bot size={32} className="mx-auto mb-2 text-sky-400 opacity-60 animate-bounce" />
                      <h4 className="text-sm font-semibold text-slate-300">Agents are ready to deliberate</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                        Deterministic barrier synchronization ensures all agents analyze the problem before evaluating counter-proposals. Click Resume or Next Turn to begin.
                      </p>
                    </div>
                  )}

                  {/* Grouped Round Accordions (Antigravity VS Code Style) */}
                  {roundGroups.map((group) => {
                    const isExpanded = expandedRounds[group.round] ?? true;
                    const roundMessages = applyTimelineFilter(group.messages);
                    const isRoundStreaming = group.round === activeMeta?.currentRound && isRunning;

                    if (roundMessages.length === 0 && !isRoundStreaming && group.round > (activeMeta?.currentRound || 1)) {
                      return null; // Don't show empty future rounds
                    }

                    return (
                      <div
                        key={group.round}
                        className="rounded-2xl border border-slate-800/90 bg-slate-900/40 overflow-hidden shadow-sm transition-all"
                      >
                        {/* Round Accordion Header */}
                        <div
                          onClick={() => toggleRound(group.round)}
                          className="px-4 py-3 bg-slate-900/90 hover:bg-slate-900 cursor-pointer flex items-center justify-between border-b border-slate-800/80 select-none transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className="text-slate-400 hover:text-slate-200 transition-transform"
                            >
                              {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </button>

                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  group.isDone
                                    ? 'bg-emerald-400'
                                    : group.isCurrent && isRunning
                                    ? 'bg-amber-400 animate-ping'
                                    : 'bg-slate-600'
                                }`}
                              />
                              <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                                <span>{group.title}</span>
                              </h3>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 text-[11px] text-slate-400">
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                              {roundMessages.length} {roundMessages.length === 1 ? 'turn' : 'turns'}
                            </span>
                            {group.totalTokens > 0 && (
                              <span className="font-mono text-slate-500">
                                {group.totalTokens.toLocaleString()} tokens
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Round Body (Collapsible Action Items) */}
                        {isExpanded && (
                          <div className="p-3.5 space-y-3 bg-slate-950/40">
                            {roundMessages.length === 0 && !isRoundStreaming ? (
                              <div className="p-4 text-center text-slate-600 text-xs italic">
                                Waiting for phase deliberation to dispatch...
                              </div>
                            ) : (
                              roundMessages.map((msg: DiscussionMessage) => {
                                const isHuman = msg.messageKind === 'user_intervention' || msg.authorAgentId === 'human-user';
                                const isTurnExpanded = expandedTurns[msg.id] ?? false;
                                const snippet = getMessageSnippet(msg.content);

                                return (
                                  <div
                                    key={msg.id}
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
                                      onClick={() => toggleTurn(msg.id)}
                                      className="p-3 cursor-pointer flex items-center justify-between gap-3 select-none"
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        {/* Status Icon */}
                                        <div className="shrink-0 text-emerald-400">
                                          <CheckCircle2 size={15} />
                                        </div>

                                        {/* Avatar */}
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

                                        {/* Name & Role */}
                                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                          <span className="text-xs font-bold text-slate-100 truncate">
                                            {isHuman ? 'Human Facilitator (You)' : (msg.authorDisplayName || msg.authorAgentId)}
                                          </span>
                                          <span
                                            className={`text-[10px] px-2 py-0.5 rounded-full border font-medium uppercase tracking-wider ${getRoleBadgeStyle(
                                              msg.authorRole
                                            )}`}
                                          >
                                            {msg.authorRole || 'Agent'}
                                          </span>

                                          {/* Custom Action Name Badge */}
                                          {msg.actionName && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 font-medium flex items-center gap-1">
                                              <Zap size={10} className="text-sky-400" />
                                              <span>{msg.actionName}</span>
                                            </span>
                                          )}

                                          {/* Targeted Action Badge */}
                                          {msg.messageKind === 'targeted_action' && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/25 text-purple-200 border border-purple-500/40 font-bold flex items-center gap-1">
                                              <Target size={10} className="text-purple-300" />
                                              <span>TARGETED PROBE</span>
                                            </span>
                                          )}

                                          {/* Provider / Model Badge */}
                                          {msg.simulated ? (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono hidden sm:inline-block" title="Adaptive Domain Reasoner with CoT Simulation">
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

                                      {/* Right Metrics & Expand Chevron */}
                                      <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-400">
                                        {msg.tokenUsage && (
                                          <span className="font-mono text-slate-500 hidden sm:inline">
                                            {msg.tokenUsage.totalTokens.toLocaleString()} tokens
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          className="text-slate-400 hover:text-slate-200"
                                        >
                                          {isTurnExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </button>
                                      </div>
                                    </div>

                                    {/* Folded Snippet (Clean 1-line overview) */}
                                    {!isTurnExpanded && (
                                      <div
                                        onClick={() => toggleTurn(msg.id)}
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
                                        {/* Antigravity-Style Collapsible Thinking Block */}
                                        {msg.thinkingContent && (
                                          <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 overflow-hidden text-xs my-1 shadow-sm">
                                            <div
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleThinking(msg.id);
                                              }}
                                              className="px-3 py-2 bg-indigo-950/40 hover:bg-indigo-950/60 flex items-center justify-between text-indigo-300 font-semibold cursor-pointer border-b border-indigo-500/20 select-none transition-colors"
                                            >
                                              <div className="flex items-center gap-2">
                                                <Brain size={14} className="text-indigo-400 shrink-0" />
                                                <span className="font-mono text-xs">Analytical Chain of Thought &amp; Invariants</span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                                                  {calculateThinkingSteps(msg.thinkingContent)} steps
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-1.5 text-indigo-400 text-[11px]">
                                                <span>{expandedThinking[msg.id] ? 'Hide' : 'Show Thinking'}</span>
                                                {expandedThinking[msg.id] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                              </div>
                                            </div>
                                            {expandedThinking[msg.id] && (
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
                                          dangerouslySetInnerHTML={{
                                            __html: markdownService.render(
                                              cleanDiscussionMarkdown(msg.content)
                                            ),
                                          }}
                                        />

                                        {/* Action Bar inside Expanded Turn */}
                                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/40 text-[11px]">
                                          {!isHuman && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setTargetedAgentId(msg.authorAgentId);
                                                setShowTargetedDispatch(true);
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
                                              handleCopyTurn(msg.id, msg.content);
                                            }}
                                            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                                          >
                                            {copiedTurnId === msg.id ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                            <span>{copiedTurnId === msg.id ? 'Copied' : 'Copy Turn'}</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleQuoteInGuidance(msg.authorDisplayName || msg.authorAgentId, snippet);
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
                              })
                            )}

                            {/* Active Streaming Turn Card (Rendered neatly under the current round!) */}
                            <LiveStreamingTurnCard
                              roundNumber={group.round}
                              currentRound={activeMeta?.currentRound}
                              isRunning={isRunning}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Paused for Human Turn / Review Banner */}
                  {activeMeta.status === 'paused' && (
                    <div className="p-4 rounded-xl bg-amber-950/25 border border-amber-500/40 flex items-center justify-between gap-3 shadow-md">
                      <div className="flex items-center gap-2.5">
                        <Pause size={16} className="text-amber-400 shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-amber-200">
                            Deliberation Paused for Human Review
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            You can review the proposals above, inject guidance below, or direct a targeted inquiry to any agent.
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowTargetedDispatch((prev) => !prev)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/40 text-purple-200 border border-purple-500/40 text-xs font-semibold transition-all shrink-0"
                        >
                          <Target size={13} className="text-purple-400" />
                          <span>Target Agent</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => resumeCurrentDiscussion(resolvedWorkspace)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-sm shrink-0"
                        >
                          <FastForward size={13} />
                          <span>Continue Next Turn</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Concluded / Settled Deliberation Action Card */}
                  {(activeMeta.status === 'completed' ||
                    activeMeta.status === 'awaiting_review' ||
                    (activeMeta.currentRound >= 3 && !isRunning)) && (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-sky-950/30 to-indigo-950/40 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg animate-fadeIn">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                          <CheckCircle size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
                            <span>Deliberation Concluded &amp; Evidence Graded</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                              Consensus Settled
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 max-w-xl leading-relaxed">
                            Council debate has reached consensus across {activeMeta.currentRound || 1} round(s).
                            The structured synthesis report and actionable checklist are ready for review and pipeline assignment.
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (onNavigateToReport) {
                              onNavigateToReport();
                            } else {
                              setActiveTab('report');
                              if (!activeReportMarkdown) {
                                loadReport(
                                  resolvedWorkspace,
                                  activeSessionId,
                                  activeMeta.latestReportVersion || 1
                                );
                              }
                            }
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 text-xs font-bold transition-all shadow-md hover:scale-[1.02]"
                        >
                          <FileText size={14} />
                          <span>Review &amp; Open Synthesis Report &rarr;</span>
                        </button>
                      </div>
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
                    <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-2xl">
                      <div
                        className="markdown-body text-slate-200 leading-relaxed transition-all"
                        style={{
                          fontSize: `${(14 * turnZoom) / 100}px`,
                          lineHeight: 1.65,
                        }}
                        dangerouslySetInnerHTML={{
                          __html: markdownService.render(
                            cleanDiscussionMarkdown(activeReportMarkdown)
                          ),
                        }}
                      />
                    </div>
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

              {/* Persistent Human-in-the-Loop Steering & Targeted Probe Bar (Pinned at bottom of timeline) */}
              {activeTab === 'timeline' && (
                <div className="shrink-0 border-t border-slate-800 bg-slate-900/95 backdrop-blur-sm">
                  {/* Expandable Targeted Probe Drawer */}
                  {showTargetedDispatch && (
                    <div className="p-3 bg-purple-950/20 border-b border-purple-500/30 animate-fadeIn">
                      <div className="max-w-4xl mx-auto space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                          <div className="flex items-center gap-1.5">
                            <Target size={14} className="text-purple-400" />
                            <span>Targeted Agent Inquiry &amp; Custom Action Dispatch</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowTargetedDispatch(false)}
                            className="text-slate-400 hover:text-slate-200 text-sm font-semibold"
                          >
                            &times;
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-purple-500/30 text-xs">
                            <span className="text-purple-400 font-semibold text-[11px]">Target Agent:</span>
                            <select
                              value={targetedAgentId}
                              onChange={(e) => setTargetedAgentId(e.target.value)}
                              className="bg-transparent border-0 text-slate-200 focus:outline-none cursor-pointer text-xs"
                            >
                              {participantAgents.map((ag) => (
                                <option key={ag.id} value={ag.id} className="bg-slate-900 text-slate-200">
                                  @{ag.name} ({ag.role})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-purple-500/30 text-xs">
                            <span className="text-purple-400 font-semibold text-[11px]">Action Directive:</span>
                            <select
                              value={targetedActionName}
                              onChange={(e) => setTargetedActionName(e.target.value)}
                              className="bg-transparent border-0 text-slate-200 focus:outline-none cursor-pointer text-xs"
                            >
                              <option value="Targeted Inquiry" className="bg-slate-900 text-slate-200">Targeted Inquiry</option>
                              <option value="Edge Case Stress Test" className="bg-slate-900 text-slate-200">Edge Case Stress Test</option>
                              <option value="Invariant Verification" className="bg-slate-900 text-slate-200">Constraint Verification</option>
                              <option value="Risk & Feasibility Probe" className="bg-slate-900 text-slate-200">Risk &amp; Feasibility Probe</option>
                              <option value="Alternative Solution Inquiry" className="bg-slate-900 text-slate-200">Alternative Solution Inquiry</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-purple-500/30 text-xs">
                            <span className="text-purple-400 font-semibold text-[11px]">Effort:</span>
                            <select
                              value={targetedEffortLevel}
                              onChange={(e) => setTargetedEffortLevel(e.target.value as AgentEffortLevel)}
                              className="bg-transparent border-0 text-sky-300 font-bold focus:outline-none cursor-pointer text-xs"
                            >
                              <option value="low" className="bg-slate-900">Low Effort</option>
                              <option value="medium" className="bg-slate-900">Med Effort</option>
                              <option value="high" className="bg-slate-900">High Effort</option>
                              <option value="xhigh" className="bg-slate-900">X-High Effort</option>
                              <option value="max" className="bg-slate-900">Max Effort</option>
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => setTargetedThinkingEnabled((prev) => !prev)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-bold transition cursor-pointer ${
                              targetedThinkingEnabled
                                ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                                : 'bg-slate-950 border-purple-500/30 text-slate-400 line-through'
                            }`}
                            title={targetedThinkingEnabled ? 'Thinking: ON' : 'Thinking: OFF'}
                          >
                            <Brain size={12} className={targetedThinkingEnabled ? 'text-indigo-400' : 'text-slate-500'} />
                            <span>{targetedThinkingEnabled ? 'Thinking ON' : 'Thinking OFF'}</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={targetedActionQuery}
                            onChange={(e) => setTargetedActionQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleDispatchTargetedQuery();
                              }
                            }}
                            placeholder={`Specify inquiry or probe for ${targetedAgentId}... (e.g. 'What are the main risks, dependencies, or trade-offs?')`}
                            className="flex-1 bg-slate-950 border border-purple-500/40 rounded-lg px-3.5 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-400 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={handleDispatchTargetedQuery}
                            disabled={!targetedActionQuery.trim() || isDispatchingTargeted}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-sm shrink-0"
                          >
                            {isDispatchingTargeted ? (
                              <>
                                <RotateCw size={12} className="animate-spin" />
                                <span>Probing...</span>
                              </>
                            ) : (
                              <>
                                <Zap size={12} />
                                <span>Dispatch Probe</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Standard Steer Bar + Quick Probe Toggle */}
                  <div className="p-3">
                    <div className="max-w-4xl mx-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowTargetedDispatch((prev) => !prev)}
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-bold transition-all shrink-0 ${
                          showTargetedDispatch
                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                            : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                        title="Dispatch a targeted custom inquiry to an individual agent"
                      >
                        <Target size={13} className="text-purple-400" />
                        <span className="hidden sm:inline">Target Agent</span>
                      </button>

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
                        placeholder="Intervene or steer council... (e.g. 'Prioritize feasibility', 'Explore alternative angles', press Enter)"
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
              Coordinate multi-agent deliberations and structured debates across any domain with strict process isolation, deterministic synchronization, human-in-the-loop steering, and evidence grading.
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
      <NewDeliberationModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        onLaunch={handleLaunchNewDiscussion}
        newTopic={newTopic}
        setNewTopic={setNewTopic}
        newIdea={newIdea}
        setNewIdea={setNewIdea}
        maxRoundsInput={maxRoundsInput}
        setMaxRoundsInput={setMaxRoundsInput}
        setMaxRounds={setMaxRounds}
        turnTimeoutInput={turnTimeoutInput}
        setTurnTimeoutInput={setTurnTimeoutInput}
        setTurnTimeoutSecs={setTurnTimeoutSecs}
        newDebateMode={newDebateMode}
        setNewDebateMode={setNewDebateMode}
        enableStepModeInNew={enableStepModeInNew}
        setEnableStepModeInNew={setEnableStepModeInNew}
        presets={presets}
        selectedPreset={selectedPreset}
        onSelectPreset={handleSelectPreset}
        onTogglePresetEnabled={handleTogglePresetEnabled}
        onDeletePreset={handleDeletePreset}
        onDuplicatePreset={handleDuplicatePreset}
        onResetPresetsToDefaults={handleResetPresetsToDefaults}
        editingPreset={editingPreset}
        setEditingPreset={setEditingPreset}
        isCreatingNewPreset={isCreatingNewPreset}
        onStartCreatePreset={handleStartCreatePreset}
        onStartEditPreset={handleStartEditPreset}
        onSaveEditingPreset={handleSaveEditingPreset}
        customParticipants={customParticipants}
        onUpdateParticipant={handleUpdateParticipant}
        onAddParticipant={handleAddParticipant}
        onRemoveParticipant={handleRemoveParticipant}
        availableProviders={availableProviders}
        presetEngine={presetEngine}
        setPresetEngine={setPresetEngine}
        presetEffortLevel={presetEffortLevel}
        setPresetEffortLevel={setPresetEffortLevel}
        presetThinkingEnabled={presetThinkingEnabled}
        setPresetThinkingEnabled={setPresetThinkingEnabled}
      />

      {/* 4. Single Session Deletion Confirmation Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
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
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
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
