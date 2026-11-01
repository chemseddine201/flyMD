import { DiscussionParticipant } from '../../../shared/types';

export interface DeliberationPreset {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  isBuiltIn?: boolean;
  participants: DiscussionParticipant[];
}

export type PresetKey = string;

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

export const savePresetsToStorage = (updated: DeliberationPreset[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save presets to localStorage', e);
  }
};

export const PRESET_TEMPLATES: Record<
  string,
  { name: string; description: string; participants: DiscussionParticipant[] }
> = DEFAULT_PRESET_TEMPLATES.reduce((acc, p) => {
  acc[p.id] = { name: p.name, description: p.description, participants: p.participants };
  return acc;
}, {} as Record<string, { name: string; description: string; participants: DiscussionParticipant[] }>);
