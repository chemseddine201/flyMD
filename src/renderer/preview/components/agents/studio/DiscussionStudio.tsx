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
} from '../../../../../shared/types';
import { markdownService } from '../../../services/MarkdownService';

interface DiscussionStudioProps {
  resolvedWorkspace: string;
  onNavigateToReport?: () => void;
}

export interface DeliberationPreset {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  isBuiltIn?: boolean;
  participants: DiscussionParticipant[];
}

export type PresetKey = string;

export function cleanDiscussionMarkdown(content: string): string {
  if (!content) return '';
  const lines = content.split('\n');
  let inCodeFence = false;
  const cleaned: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      inCodeFence = !inCodeFence;
      cleaned.push(line);
      continue;
    }
    if (inCodeFence) {
      cleaned.push(line);
    } else {
      // If line has 4 or more leading spaces outside a code block, strip the indent
      // so CommonMark does not misinterpret body paragraphs and lists as indented <pre><code> blocks
      if (/^\s{4,}/.test(line)) {
        cleaned.push(line.replace(/^\s{4,}/, ''));
      } else {
        cleaned.push(line);
      }
    }
  }
  return cleaned.join('\n');
}

export const DEFAULT_PRESET_TEMPLATES: DeliberationPreset[] = [
  {
    id: 'strategy',
    name: 'Strategic Planning & Decision Analysis',
    description: 'Multi-perspective strategic deliberation, risk assessment, and roadmap prioritization.',
    enabled: true,
    isBuiltIn: true,
    participants: [
      {
        agentId: 'agent-strategist',
        providerId: 'mock',
        modelId: 'strategist-v1',
        displayName: 'Strategy & Vision Lead',
        role: 'architect',
        roleDescription: 'Synthesize strategic vision, core value propositions, and long-term milestones.',
        avatarColor: '#38bdf8',
        assignedSkillUris: [],
        contextBudgetTokens: 32000,
        customAction: {
          id: 'strategic-decomp',
          name: 'Strategic Value & Milestone Analysis',
          description: 'Value proposition, roadmap milestones & key success metrics',
          promptDirective: 'Decompose the strategic vision into concrete phases, core value drivers, and critical measurable milestones.',
        },
      },
      {
        agentId: 'agent-risk-critic',
        providerId: 'mock',
        modelId: 'critic-v1',
        displayName: 'Risk & Adversarial Analyst',
        role: 'critic',
        roleDescription: 'Stress-test assumptions, identify blind spots, market hurdles, and resource bottlenecks.',
        avatarColor: '#ef4444',
        assignedSkillUris: [],
        contextBudgetTokens: 32000,
        customAction: {
          id: 'risk-adversary',
          name: 'Stress Testing & Blind Spot Identification',
          description: 'Unintended consequences, competitor response & failure modes',
          promptDirective: 'Challenge core assumptions vigorously. Highlight critical blind spots, external dependencies, and potential points of failure.',
        },
      },
      {
        agentId: 'agent-operations',
        providerId: 'mock',
        modelId: 'implementer-v1',
        displayName: 'Operations & Execution Lead',
        role: 'implementer',
        roleDescription: 'Evaluate operational feasibility, resource pacing, and actionable implementation steps.',
        avatarColor: '#10b981',
        assignedSkillUris: [],
        contextBudgetTokens: 16000,
        customAction: {
          id: 'ops-feasibility',
          name: 'Tactical Execution & Feasibility Audit',
          description: 'Implementation roadmap, resource pacing & deliverables',
          promptDirective: 'Assess practical execution steps, required resources, delivery sequencing, and immediate first actions.',
        },
      },
    ],
  },
  {
    id: 'research',
    name: 'Deep Research & Investigation',
    description: 'Epistemic inquiry, source validation, counter-evidence, and systematic synthesis.',
    enabled: true,
    isBuiltIn: true,
    participants: [
      {
        agentId: 'agent-researcher',
        providerId: 'mock',
        modelId: 'researcher-v1',
        displayName: 'Lead Researcher',
        role: 'architect',
        roleDescription: 'Formulate hypotheses, structure lines of inquiry, and synthesize exploratory findings.',
        avatarColor: '#818cf8',
        assignedSkillUris: [],
        contextBudgetTokens: 32000,
        customAction: {
          id: 'research-inquiry',
          name: 'Hypothesis Formulation & Discovery',
          description: 'Formulate core questions and investigative pathways',
          promptDirective: 'Map the investigative landscape, establish foundational hypotheses, and outline key questions requiring deep answers.',
        },
      },
      {
        agentId: 'agent-methodology-critic',
        providerId: 'mock',
        modelId: 'auditor-v1',
        displayName: 'Methodology & Fact Critic',
        role: 'critic',
        roleDescription: 'Audit claims against empirical facts, detect biases, and verify consistency.',
        avatarColor: '#f59e0b',
        assignedSkillUris: [],
        contextBudgetTokens: 32000,
        customAction: {
          id: 'fact-verification',
          name: 'Epistemic Fact & Bias Audit',
          description: 'Challenge unverified assertions and highlight confirmation biases',
          promptDirective: 'Rigorously scrutinize claims for empirical backing. Point out unsubstantiated claims, logical fallacies, and potential biases.',
        },
      },
      {
        agentId: 'agent-synthesizer',
        providerId: 'mock',
        modelId: 'implementer-v1',
        displayName: 'Evidence Coordinator',
        role: 'implementer',
        roleDescription: 'Correlate findings into clear actionable conclusions and evidence-backed summaries.',
        avatarColor: '#06b6d4',
        assignedSkillUris: [],
        contextBudgetTokens: 16000,
      },
    ],
  },
  {
    id: 'editorial',
    name: 'Content Strategy & Editorial Council',
    description: 'Idea generation, narrative structuring, audience resonance, and editorial polish.',
    enabled: true,
    isBuiltIn: true,
    participants: [
      {
        agentId: 'agent-editor',
        providerId: 'mock',
        modelId: 'editor-v1',
        displayName: 'Editorial Director',
        role: 'architect',
        roleDescription: 'Establish overarching narrative arc, message hierarchy, and thematic cohesion.',
        avatarColor: '#ec4899',
        assignedSkillUris: [],
        contextBudgetTokens: 32000,
      },
      {
        agentId: 'agent-voice-critic',
        providerId: 'mock',
        modelId: 'critic-v1',
        displayName: 'Audience & Voice Critic',
        role: 'critic',
        roleDescription: 'Critique readability, emotional resonance, cognitive load, and potential audience objections.',
        avatarColor: '#f43f5e',
        assignedSkillUris: [],
        contextBudgetTokens: 32000,
      },
      {
        agentId: 'agent-draftsman',
        providerId: 'mock',
        modelId: 'writer-v1',
        displayName: 'Creative Draftsman',
        role: 'implementer',
        roleDescription: 'Craft concrete outlines, compelling phrasing, and polished final deliverables.',
        avatarColor: '#10b981',
        assignedSkillUris: [],
        contextBudgetTokens: 16000,
      },
    ],
  },
  {
    id: 'multidisciplinary',
    name: 'Multidisciplinary Evaluation & Governance',
    description: 'Holistic evaluation across subject expertise, ethics, compliance, and user impact.',
    enabled: true,
    isBuiltIn: true,
    participants: [
      {
        agentId: 'agent-subject-expert',
        providerId: 'mock',
        modelId: 'expert-v1',
        displayName: 'Domain Subject Specialist',
        role: 'architect',
        roleDescription: 'Provide authoritative domain insights, industry standards, and best practices.',
        avatarColor: '#3b82f6',
        assignedSkillUris: [],
        contextBudgetTokens: 32000,
      },
      {
        agentId: 'agent-ethics-auditor',
        providerId: 'mock',
        modelId: 'auditor-v1',
        displayName: 'Ethics & Compliance Auditor',
        role: 'auditor',
        roleDescription: 'Audit ethical implications, unintended side effects, and regulatory compliance.',
        avatarColor: '#eab308',
        assignedSkillUris: [],
        contextBudgetTokens: 32000,
      },
      {
        agentId: 'agent-feasibility',
        providerId: 'mock',
        modelId: 'critic-v1',
        displayName: 'Pragmatic Assessor',
        role: 'critic',
        roleDescription: 'Evaluate real-world constraints, adoption hurdles, and practical resource requirements.',
        avatarColor: '#6366f1',
        assignedSkillUris: [],
        contextBudgetTokens: 16000,
      },
    ],
  },
  {
    id: 'architecture',
    name: 'System Architecture & Technical Design',
    description: 'System decomposition, invariant verification, API contracts, and failure recovery.',
    enabled: true,
    isBuiltIn: true,
    participants: [
      {
        agentId: 'agent-architect',
        providerId: 'mock',
        modelId: 'architect-v1',
        displayName: 'Lead Systems Architect',
        role: 'architect',
        roleDescription: 'Focus on system decomposition, interface contracts, and architectural invariants.',
        avatarColor: '#38bdf8',
        assignedSkillUris: [],
        contextBudgetTokens: 32000,
      },
      {
        agentId: 'agent-critic',
        providerId: 'mock',
        modelId: 'critic-v1',
        displayName: 'Adversarial Reliability Tester',
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
        displayName: 'Core Implementation Engineer',
        role: 'implementer',
        roleDescription: 'Verify execution feasibility, atomic persistence guarantees, and lifecycle boundaries.',
        avatarColor: '#10b981',
        assignedSkillUris: [],
        contextBudgetTokens: 16000,
      },
    ],
  },
];

export const STORAGE_KEY_PRESETS = 'flymd_deliberation_presets_v3';

export const loadSavedPresets = (): DeliberationPreset[] => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_PRESETS) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load presets from localStorage', e);
  }
  return DEFAULT_PRESET_TEMPLATES;
};

const PRESET_TEMPLATES: Record<string, { name: string; description: string; participants: DiscussionParticipant[] }> = DEFAULT_PRESET_TEMPLATES.reduce(
  (acc, p) => {
    acc[p.id] = { name: p.name, description: p.description, participants: p.participants };
    return acc;
  },
  {} as Record<string, { name: string; description: string; participants: DiscussionParticipant[] }>
);

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

export const DiscussionStudio: React.FC<DiscussionStudioProps> = ({
  resolvedWorkspace,
  onNavigateToReport,
}) => {
  const discussions = usePreviewStore((s: PreviewStoreState) => s.discussions);
  const activeSessionId = usePreviewStore((s: PreviewStoreState) => s.activeSessionId);
  const activeMeta = usePreviewStore((s: PreviewStoreState) => s.activeDiscussionMeta);
  const activeTranscript = usePreviewStore((s: PreviewStoreState) => s.activeTranscript);
  const streamingChunks = usePreviewStore((s: PreviewStoreState) => s.streamingChunks);
  const streamingThinking = usePreviewStore((s: PreviewStoreState) => s.streamingThinking);
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

  // Group active transcript into rounds like Antigravity for VS Code
  const roundGroups = useMemo(() => {
    const totalRounds = Math.max(3, activeMeta?.currentRound || 1);
    const groups: {
      round: number;
      title: string;
      desc: string;
      messages: DiscussionMessage[];
      totalTokens: number;
      isCurrent: boolean;
      isDone: boolean;
    }[] = [];

    for (let r = 1; r <= totalRounds; r++) {
      const meta = ROUND_METADATA.find((m) => m.round === r) || {
        round: r,
        title: `Phase ${r}: Advanced Deliberation`,
        desc: 'Continued multi-agent cross-examination and refinement.',
      };

      const msgs = activeTranscript.filter((m) => m.roundNumber === r);
      const roundTokens = msgs.reduce((acc, m) => acc + (m.tokenUsage?.totalTokens || 0), 0);
      const isCurrent = (activeMeta?.currentRound || 1) === r;
      const isDone = (activeMeta?.currentRound || 1) > r || activeMeta?.status === 'awaiting_review' || activeMeta?.status === 'completed';

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
  const savePresetsToStorage = (updated: DeliberationPreset[]) => {
    setPresets(updated);
    try {
      localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save presets to localStorage', e);
    }
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
    savePresetsToStorage(updated);
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
    savePresetsToStorage(updated);
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
    savePresetsToStorage(updated);
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
    savePresetsToStorage(updated);
  };

  // Reset presets to defaults
  const handleResetPresetsToDefaults = () => {
    savePresetsToStorage(DEFAULT_PRESET_TEMPLATES);
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
            thinkingEnabled: true,
          };
        }
        return {
          ...p,
          providerId: targetProvider,
          modelId: matched?.model || p.modelId,
          thinkingEnabled: true,
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

  // Find single currently active streaming chunk if any
  const activeStreamingEntry = useMemo(() => {
    const entries = Object.entries(streamingChunks);
    if (entries.length === 0) return null;
    return entries[entries.length - 1]; // Only the latest active turn!
  }, [streamingChunks]);

  return (
    <div className="flex-1 h-full w-full min-h-0 flex overflow-hidden bg-slate-950 text-slate-200 font-sans">
      {/* 1. Left Session Explorer Sidebar */}
      <div className="w-80 h-full border-r border-slate-800/80 bg-slate-900/40 flex flex-col shrink-0 min-h-0 overflow-hidden">
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
              className="p-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 transition-all shadow-sm"
              title="Configure and launch new deliberation"
            >
              <Plus size={14} />
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
                  {activeTranscript.length === 0 && !activeStreamingEntry && (
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
                    const isRoundStreaming = activeStreamingEntry && group.round === activeMeta?.currentRound && isRunning;

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
                            {isRoundStreaming && activeStreamingEntry && (
                              <div className="rounded-xl border border-sky-500/50 bg-sky-950/20 p-4 space-y-3 shadow-lg animate-fadeIn">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2.5 text-xs font-bold text-sky-400">
                                    <Sparkles size={14} className="animate-spin text-sky-400" />
                                    <span>Deliberating: {activeStreamingEntry[0]}...</span>
                                  </div>
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold animate-pulse">
                                    LIVE IN PROGRESS
                                  </span>
                                </div>

                                {/* Live Reasoning Block if streaming thinking exists */}
                                {streamingThinking[activeStreamingEntry[0]] && (
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
                                      {streamingThinking[activeStreamingEntry[0]]}
                                      <span className="inline-block w-2 h-3.5 bg-indigo-400 ml-1 animate-pulse" />
                                    </div>
                                  </div>
                                )}

                                <div className="text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto p-2.5 rounded-lg bg-slate-950/80 border border-slate-800">
                                  {String(activeStreamingEntry[1])}
                                  <span className="inline-block w-2 h-3.5 bg-sky-400 ml-1 animate-pulse" />
                                </div>
                              </div>
                            )}
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
      {showNewModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="w-full max-w-4xl lg:max-w-5xl bg-slate-900 border border-slate-800/90 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden transition-all duration-200">
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
                  placeholder="e.g. Market Expansion Strategy, Scientific Methodology Review, Product Architecture, Novel Plot Outline..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Proposal, Objectives &amp; Constraints</label>
                <textarea
                  rows={3}
                  value={newIdea}
                  onChange={(e) => setNewIdea(e.target.value)}
                  placeholder="Describe the core proposition, context, challenges, constraints, or specific angles to evaluate..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 leading-relaxed transition-colors"
                />
              </div>

              {/* Mode Selection Tab: Preset vs Custom Actions vs Custom Team */}
              <div className="border border-slate-800 rounded-xl p-3.5 bg-slate-950/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Sliders size={13} className="text-sky-400" />
                    <span>Agent Team &amp; Action Presets</span>
                  </div>
                  <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setNewDebateMode('preset')}
                      className={`px-3 py-1 rounded text-[11px] font-semibold transition-all ${
                        newDebateMode === 'preset'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Presets (${presets.filter((p) => p.enabled).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewDebateMode('actions');
                        setEditingPreset(null);
                      }}
                      className={`px-3 py-1 rounded text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
                        newDebateMode === 'actions'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Settings size={11} />
                      <span>Custom Actions &amp; Roles</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewDebateMode('custom')}
                      className={`px-3 py-1 rounded text-[11px] font-semibold transition-all ${
                        newDebateMode === 'custom'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Custom Team (${customParticipants.length})
                    </button>
                  </div>
                </div>

                {/* Connected Engines Indicator */}
                {availableProviders.some((ap) => ap.available) && (
                  <div className="mb-3 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={12} className="text-emerald-400" />
                      <span>
                        <strong>Detected AI Engines:</strong>{' '}
                        {availableProviders
                          .filter((ap) => ap.available)
                          .map((ap) => `${ap.name} (${ap.model})`)
                          .join(', ')}
                      </span>
                    </div>
                  </div>
                )}

                {newDebateMode === 'preset' ? (
                  <div className="space-y-3">
                    {/* Preset Engine Switcher */}
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0">
                          <Cpu size={15} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-100 flex items-center gap-2 truncate">
                            <span>Preset AI Engine</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20 font-medium hidden sm:inline">
                              Shared across all agents
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                            Frontier agent or fast built-in reasoning engine
                          </div>
                        </div>
                      </div>
                      <select
                        value={presetEngine}
                        onChange={(e) => setPresetEngine(e.target.value)}
                        className="w-full sm:w-auto min-w-0 sm:max-w-[420px] shrink-0 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-sky-500 font-medium truncate shadow-inner cursor-pointer"
                      >
                        <option value="mock">⚡ Built-in Adaptive Domain Simulator (Fast)</option>
                        {availableProviders
                          .filter((ap) => ap.id !== 'mock')
                          .map((p) => (
                            <option key={p.id} value={p.id} disabled={!p.available}>
                              {p.name} {p.available ? `(${p.model})` : '(Not Detected)'}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {presets
                        .filter((p) => p.enabled)
                        .map((preset) => {
                          const isSelected = selectedPreset === preset.id;
                          return (
                            <div
                              key={preset.id}
                              onClick={() => handleSelectPreset(preset.id)}
                              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-sky-500/15 border-sky-500/50 text-slate-100 shadow-sm'
                                  : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900 text-slate-300'
                              }`}
                            >
                              <div className="font-bold text-xs flex items-center justify-between">
                                <span className="truncate">{preset.name}</span>
                                {isSelected && <Check size={13} className="text-sky-400 shrink-0" />}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                                {preset.description}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-2 flex items-center justify-between">
                                <span>{preset.participants.length} participating agents</span>
                                <span className="text-indigo-400 flex items-center gap-1">
                                  <Brain size={10} />
                                  <span>Thinking On</span>
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setNewDebateMode('actions');
                          setEditingPreset(null);
                        }}
                        className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium"
                      >
                        <Settings size={12} />
                        <span>Manage, customize roles &amp; queries, or add new action presets &rarr;</span>
                      </button>
                    </div>
                  </div>
                ) : newDebateMode === 'actions' ? (
                  <div className="space-y-3">
                    {editingPreset ? (
                      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                          <div className="flex items-center gap-2">
                            <Edit3 size={15} className="text-amber-400" />
                            <h4 className="text-xs font-bold text-slate-100">
                              {isCreatingNewPreset ? 'Create New Action Preset' : `Edit Preset: ${editingPreset.name}`}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingPreset(null)}
                              className="px-3 py-1 rounded text-slate-400 hover:text-slate-200 text-xs font-semibold"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveEditingPreset}
                              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-sm"
                            >
                              Save Preset
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-300 font-semibold mb-1 text-[11px]">Preset Name</label>
                            <input
                              type="text"
                              value={editingPreset.name}
                              onChange={(e) => setEditingPreset({ ...editingPreset, name: e.target.value })}
                              placeholder="e.g. Market Strategy & Execution Risk, System Architecture, Policy Review..."
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-300 font-semibold mb-1 text-[11px]">Description</label>
                            <input
                              type="text"
                              value={editingPreset.description}
                              onChange={(e) => setEditingPreset({ ...editingPreset, description: e.target.value })}
                              placeholder="Short description of this deliberation focus"
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                            />
                          </div>
                        </div>

                        {/* Participating Agent Roles in this Preset */}
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                              <Bot size={13} className="text-sky-400" />
                              Agent Roles &amp; Custom Queries ({editingPreset.participants.length})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const nextIdx = editingPreset.participants.length + 1;
                                const color = COLOR_PALETTE[(nextIdx - 1) % COLOR_PALETTE.length];
                                const newAgent: DiscussionParticipant = {
                                  agentId: `agent-custom-${Date.now()}`,
                                  providerId: 'mock',
                                  modelId: 'custom-expert-v1',
                                  displayName: `Specialist ${nextIdx}`,
                                  role: 'custom',
                                  roleDescription: 'Custom inquiry focus and domain analysis.',
                                  avatarColor: color,
                                  assignedSkillUris: [],
                                  contextBudgetTokens: 16000,
                                  thinkingEnabled: true,
                                  customAction: {
                                    id: `action-${Date.now()}`,
                                    name: 'Specialized Inquiry',
                                    description: 'Custom domain inquiry',
                                    promptDirective: 'Evaluate specific failure modes and validation criteria.',
                                  },
                                };
                                setEditingPreset({
                                  ...editingPreset,
                                  participants: [...editingPreset.participants, newAgent],
                                });
                              }}
                              className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
                            >
                              <Plus size={12} /> Add Agent Role
                            </button>
                          </div>

                          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                            {editingPreset.participants.map((p, pIdx) => (
                              <div
                                key={p.agentId || pIdx}
                                className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2 text-xs"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-1">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full shrink-0"
                                      style={{ backgroundColor: p.avatarColor || '#38bdf8' }}
                                    />
                                    <input
                                      type="text"
                                      value={p.displayName}
                                      onChange={(e) => {
                                        const copy = [...editingPreset.participants];
                                        copy[pIdx] = { ...copy[pIdx], displayName: e.target.value };
                                        setEditingPreset({ ...editingPreset, participants: copy });
                                      }}
                                      placeholder="Agent Display Name"
                                      className="w-44 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-100 font-bold focus:outline-none focus:border-sky-500"
                                    />
                                    <select
                                      value={p.role}
                                      onChange={(e) => {
                                        const copy = [...editingPreset.participants];
                                        copy[pIdx] = { ...copy[pIdx], role: e.target.value as any };
                                        setEditingPreset({ ...editingPreset, participants: copy });
                                      }}
                                      className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300 font-medium focus:outline-none focus:border-sky-500 cursor-pointer"
                                    >
                                      <option value="architect">Architect</option>
                                      <option value="critic">Critic / Adversary</option>
                                      <option value="implementer">Implementer</option>
                                      <option value="auditor">Auditor</option>
                                      <option value="user">User Proxy</option>
                                      <option value="custom">Custom Specialist</option>
                                    </select>
                                  </div>
                                  {editingPreset.participants.length > 2 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const copy = editingPreset.participants.filter((_, idx) => idx !== pIdx);
                                        setEditingPreset({ ...editingPreset, participants: copy });
                                      }}
                                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                                      title="Remove agent role"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>

                                <div>
                                  <input
                                    type="text"
                                    value={p.roleDescription || ''}
                                    onChange={(e) => {
                                      const copy = [...editingPreset.participants];
                                      copy[pIdx] = { ...copy[pIdx], roleDescription: e.target.value };
                                      setEditingPreset({ ...editingPreset, participants: copy });
                                    }}
                                    placeholder="Role description (e.g. Focus on market risks, feasibility, or quality standards)"
                                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-sky-500 text-[11px]"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[10px] text-amber-400 font-semibold mb-1">
                                    Custom Prompt Directive / Invariant Query for this Agent:
                                  </label>
                                  <textarea
                                    rows={2}
                                    value={p.customAction?.promptDirective || ''}
                                    onChange={(e) => {
                                      const copy = [...editingPreset.participants];
                                      copy[pIdx] = {
                                        ...copy[pIdx],
                                        customAction: {
                                          id: copy[pIdx].customAction?.id || `action-${Date.now()}`,
                                          name: copy[pIdx].displayName,
                                          description: copy[pIdx].roleDescription || '',
                                          promptDirective: e.target.value,
                                        },
                                      };
                                      setEditingPreset({ ...editingPreset, participants: copy });
                                    }}
                                    placeholder="e.g. Evaluate core assumptions, analyze edge cases, and scrutinize deliverables against key objectives."
                                    className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 text-xs focus:outline-none focus:border-amber-500/70 leading-relaxed font-mono"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-800">
                          <div>
                            <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                              <Settings size={14} className="text-amber-400" />
                              Deliberation Action Presets &amp; Role Library
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Enable, disable, customize, or define specialized multi-agent inquiry roles.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleResetPresetsToDefaults}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                              title="Restore default deliberation presets"
                            >
                              <RotateCcw size={11} />
                              <span>Restore Defaults</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleStartCreatePreset}
                              className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1 transition-all shadow-sm"
                            >
                              <Plus size={13} />
                              <span>+ Add Custom Action Preset</span>
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                          {presets.map((preset) => (
                            <div
                              key={preset.id}
                              className={`p-3 rounded-xl border transition-all ${
                                preset.enabled
                                  ? 'bg-slate-900/90 border-slate-800'
                                  : 'bg-slate-950/60 border-slate-800/60 opacity-60'
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="min-w-0 flex items-start gap-2.5">
                                  <button
                                    type="button"
                                    onClick={(e) => handleTogglePresetEnabled(preset.id, e)}
                                    className={`p-1 rounded transition-colors mt-0.5 ${
                                      preset.enabled
                                        ? 'text-emerald-400 hover:text-emerald-300'
                                        : 'text-slate-600 hover:text-slate-400'
                                    }`}
                                    title={preset.enabled ? 'Click to disable preset' : 'Click to enable preset'}
                                  >
                                    {preset.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                  </button>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-xs text-slate-100">{preset.name}</span>
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                        {preset.participants.length} agents
                                      </span>
                                      {preset.isBuiltIn && (
                                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                          Built-in
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-0.5">{preset.description}</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                  <button
                                    type="button"
                                    onClick={(e) => handleStartEditPreset(preset, e)}
                                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                                    title="Edit roles and custom queries"
                                  >
                                    <Edit3 size={11} className="text-amber-400" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDuplicatePreset(preset, e)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                                    title="Duplicate preset"
                                  >
                                    <CopyPlus size={12} />
                                  </button>
                                  {presets.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={(e) => handleDeletePreset(preset.id, e)}
                                      className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
                                      title="Delete preset"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Custom Team Editor with Custom Actions & Query Builders */
                  <div className="space-y-3">
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {customParticipants.map((p, idx) => {
                        const selectedActionId = p.customAction?.id || 'standard';
                        return (
                          <div
                            key={p.agentId || idx}
                            className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs"
                          >
                            {/* Row 1: Identity, Role, Provider, Model */}
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={p.avatarColor || '#38bdf8'}
                                onChange={(e) => handleUpdateParticipant(idx, { avatarColor: e.target.value })}
                                className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent shrink-0"
                                title="Avatar color"
                              />
                              <input
                                type="text"
                                value={p.displayName}
                                onChange={(e) => handleUpdateParticipant(idx, { displayName: e.target.value })}
                                placeholder="Agent Name"
                                className="w-28 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                              />
                              <select
                                value={p.role}
                                onChange={(e) => handleUpdateParticipant(idx, { role: e.target.value as any })}
                                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs"
                              >
                                <option value="architect">Architect</option>
                                <option value="critic">Critic</option>
                                <option value="auditor">Auditor</option>
                                <option value="implementer">Implementer</option>
                                <option value="researcher">Researcher</option>
                                <option value="security-specialist">Security Specialist</option>
                              </select>
                              <select
                                value={p.providerId}
                                onChange={(e) => {
                                  const provId = e.target.value;
                                  const matched = availableProviders.find((ap) => ap.id === provId);
                                  handleUpdateParticipant(idx, {
                                    providerId: provId,
                                    modelId: matched?.model || p.modelId,
                                  });
                                }}
                                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs"
                              >
                                <option value="mock">Local Reasoner (Simulated)</option>
                                {availableProviders.map((ap) => (
                                  <option key={ap.id} value={ap.id}>
                                    {ap.name} {ap.available ? '✓ Ready' : '(Not configured)'}
                                  </option>
                                ))}
                                {!availableProviders.some((ap) => ap.id === 'ollama') && (
                                  <option value="ollama">Ollama</option>
                                )}
                                {!availableProviders.some((ap) => ap.id === 'claude-code') && (
                                  <option value="claude-code">Claude Code CLI</option>
                                )}
                                {!availableProviders.some((ap) => ap.id === 'gemini-antigravity') && (
                                  <option value="gemini-antigravity">Gemini CLI</option>
                                )}
                                {!availableProviders.some((ap) => ap.id === 'deepseek') && (
                                  <option value="deepseek">DeepSeek</option>
                                )}
                                {!availableProviders.some((ap) => ap.id === 'http-llm') && (
                                  <option value="http-llm">OpenAI / HTTP</option>
                                )}
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
                                className="p-1 text-slate-500 hover:text-rose-400 disabled:opacity-20 shrink-0"
                                title="Remove agent"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>

                            {/* Row 2: Custom Action Directive & Thinking Mode */}
                            <div className="flex items-center gap-2 pt-1.5 border-t border-slate-800/60">
                              <span className="text-[11px] font-semibold text-sky-400 shrink-0">Custom Action:</span>
                              <select
                                value={selectedActionId}
                                onChange={(e) => {
                                  const actId = e.target.value;
                                  const found = ACTION_CATALOG.find((ac) => ac.id === actId);
                                  if (found && found.id !== 'standard') {
                                    handleUpdateParticipant(idx, {
                                      customAction: {
                                        id: found.id,
                                        name: found.name,
                                        description: found.description,
                                        promptDirective: found.promptDirective,
                                      },
                                    });
                                  } else {
                                    handleUpdateParticipant(idx, { customAction: undefined });
                                  }
                                }}
                                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs flex-1"
                              >
                                {ACTION_CATALOG.map((ac) => (
                                  <option key={ac.id} value={ac.id}>
                                    {ac.name} — {ac.description}
                                  </option>
                                ))}
                              </select>

                              <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer shrink-0">
                                <input
                                  type="checkbox"
                                  checked={p.thinkingEnabled ?? true}
                                  onChange={(e) => handleUpdateParticipant(idx, { thinkingEnabled: e.target.checked })}
                                  className="rounded bg-slate-950 border-slate-800 text-indigo-500 focus:ring-0"
                                />
                                <span className="flex items-center gap-1 text-indigo-300 font-medium">
                                  <Brain size={12} className="text-indigo-400" />
                                  <span>Thinking</span>
                                </span>
                              </label>
                            </div>

                            {/* Row 3: Optional Freeform Query Directive for this Agent */}
                            <div className="pt-0.5">
                              <input
                                type="text"
                                value={p.customQuery || ''}
                                onChange={(e) => handleUpdateParticipant(idx, { customQuery: e.target.value })}
                                placeholder="Specific inquiry or directive for this agent (e.g. 'Focus on SQLite journal crash recovery')..."
                                className="w-full bg-slate-950 border border-slate-800/80 rounded px-2.5 py-1 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-sky-500"
                              />
                            </div>
                          </div>
                        );
                      })}
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold text-xs">Deliberation Rounds</label>
                    <span className="text-[10px] text-slate-500">1 - 10</span>
                  </div>
                  <input
                    type="number"
                    value={maxRoundsInput}
                    onChange={(e) => {
                      setMaxRoundsInput(e.target.value);
                      const parsed = parseInt(e.target.value, 10);
                      if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
                        setMaxRounds(parsed);
                      }
                    }}
                    onBlur={() => {
                      const parsed = parseInt(maxRoundsInput, 10);
                      if (isNaN(parsed) || parsed < 1) {
                        setMaxRoundsInput('1');
                        setMaxRounds(1);
                      } else if (parsed > 10) {
                        setMaxRoundsInput('10');
                        setMaxRounds(10);
                      } else {
                        setMaxRoundsInput(String(parsed));
                        setMaxRounds(parsed);
                      }
                    }}
                    placeholder="3"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold text-xs">Turn Timeout (s)</label>
                    <span className="text-[10px] text-slate-500">15s - 600s</span>
                  </div>
                  <input
                    type="number"
                    value={turnTimeoutInput}
                    onChange={(e) => {
                      setTurnTimeoutInput(e.target.value);
                      const parsed = parseInt(e.target.value, 10);
                      if (!isNaN(parsed) && parsed >= 15 && parsed <= 600) {
                        setTurnTimeoutSecs(parsed);
                      }
                    }}
                    onBlur={() => {
                      const parsed = parseInt(turnTimeoutInput, 10);
                      if (isNaN(parsed) || parsed < 15) {
                        setTurnTimeoutInput('15');
                        setTurnTimeoutSecs(15);
                      } else if (parsed > 600) {
                        setTurnTimeoutInput('600');
                        setTurnTimeoutSecs(600);
                      } else {
                        setTurnTimeoutInput(String(parsed));
                        setTurnTimeoutSecs(parsed);
                      }
                    }}
                    placeholder="120"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                  />
                  {Number(turnTimeoutInput) < 15 && turnTimeoutInput !== '' && (
                    <div className="text-[10px] text-amber-400 mt-1">
                      * Min 15s (will adjust on blur)
                    </div>
                  )}
                  {Number(turnTimeoutInput) > 600 && (
                    <div className="text-[10px] text-amber-400 mt-1">
                      * Max 600s (will adjust on blur)
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1 text-xs">Initial Execution</label>
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="stepModeCheck"
                      checked={enableStepModeInNew}
                      onChange={(e) => setEnableStepModeInNew(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-800 text-sky-500 focus:ring-0 cursor-pointer w-4 h-4"
                    />
                    <label htmlFor="stepModeCheck" className="text-slate-300 text-xs cursor-pointer select-none">
                      Step-by-Step Mode (Pause after each turn)
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
