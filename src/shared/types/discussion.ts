import type { AgentEffortLevel } from './agents';

export type DiscussionStatus =
  | 'created'
  | 'running'
  | 'paused'
  | 'awaiting_review'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted';

export type AgentRoleType =
  | 'architect'
  | 'critic'
  | 'auditor'
  | 'implementer'
  | 'researcher'
  | string;

export interface AgentCustomAction {
  id: string;
  name: string;
  description: string;
  promptDirective: string;
}

export interface AvailableProviderInfo {
  id: string;
  name: string;
  providerType?: string;
  available: boolean;
  model: string;
  supportsThinking: boolean;
  supportsEffort?: boolean;
  description: string;
  authStatus?: string;
  subscriptionTier?: string;
  accountLabel?: string;
  vendor?: string;
  accentColor?: string;
  isCustom?: boolean;
}

export interface DiscussionTokenUsage {
  promptTokens: number;
  completionTokens: number;
  reasoningTokens?: number;
  totalTokens: number;
}

export interface DiscussionParticipant {
  agentId: string;
  providerId: string;
  modelId: string;
  displayName: string;
  role: AgentRoleType;
  roleDescription?: string;
  avatarColor?: string;
  assignedSkillUris?: string[];
  contextBudgetTokens?: number;
  customAction?: AgentCustomAction;
  customQuery?: string;
  thinkingEnabled?: boolean;
  effortLevel?: AgentEffortLevel;
}

export type DiscussionMessageKind =
  | 'initial_analysis'
  | 'peer_critique'
  | 'rebuttal_revision'
  | 'synthesis_report'
  | 'user_intervention'
  | 'targeted_action'
  | 'skipped_consensus';

export type RoundExecutionStatus =
  | 'executed'
  | 'converged_early'
  | 'ignored_consensus';

export interface RoundExecutionRecord {
  roundNumber: number;
  title: string;
  status: RoundExecutionStatus;
  convergedFromRound?: number;
  reason?: string;
  skippedAgentNames: string[];
}

export type DebateRepeaterMode = 'off' | 'cycle' | 'per_round' | 'per_agent';

export interface CustomRoleDefinition {
  id: string;
  roleKey: string;
  name: string;
  experienceProfile: string;
  defaultDirective: string;
  assignedSkillUris: string[];
  avatarColor: string;
  isBuiltIn?: boolean;
}

export interface DiscussionRoundSlot {
  slotId: string;
  participant: DiscussionParticipant;
  roundDirective?: string;
}

export interface DiscussionRoundPlan {
  roundNumber: number;
  title: string;
  objective?: string;
  slots: DiscussionRoundSlot[];
}

export interface DiscussionMessage {
  id: string;
  sessionId: string;
  roundNumber: number;
  turnIndex: number;
  authorAgentId: string;
  authorRole: string;
  authorProvider: string;
  messageKind: DiscussionMessageKind;
  targetPeerIds?: string[];
  content: string;
  timestamp: number;
  tokenUsage?: DiscussionTokenUsage;
  durationMs?: number;
  truncated?: boolean;
  thinkingContent?: string;
  actionName?: string;
  modelId?: string;
  simulated?: boolean;
  authorDisplayName?: string;
}

export type DisagreementStatus =
  | 'unresolved_divergence'
  | 'resolved_consensus'
  | 'deferred_to_user';

export interface DisagreementItem {
  id: string;
  topic: string;
  agentStances: Record<string, string>;
  status: DisagreementStatus;
  resolutionNotes?: string;
  roundFirstObserved: number;
  roundLastUpdated: number;
}

export interface DecisionItem {
  id: string;
  topic: string;
  decision: string;
  rationale: string;
  agreedByAgents: string[];
  agreedRound: number;
  evidenceCitations?: string[];
}

export type SkillLifecycleState =
  | 'discovered'
  | 'enabled'
  | { natively_loaded: 'verified' | 'unknown' }
  | 'injected'
  | 'actually_used';

export interface SkillDescriptor {
  uri: string;
  name: string;
  description: string;
  version: string;
  author: string;
  compatibility: string[];
  tags: string[];
  replaces: string[];
  markdownBody: string;
  sourcePath: string;
  state: SkillLifecycleState | string;
}

export interface DiscussionConfig {
  schemaVersion: number;
  sessionId: string;
  topic: string;
  userIdea: string;
  workspacePath: string;
  maxRounds: number;
  turnTimeoutSecs: number;
  participants: DiscussionParticipant[];
  activeSkillUris?: string[];
  stepMode?: boolean;
  customSkillsDir?: string | null;
  includeDefaultSkills?: boolean;
  tokenBudgetCap?: number | null;
  selectedEngines?: string[];
  repeaterMode?: DebateRepeaterMode;
  roundSchedule?: DiscussionRoundPlan[];
  pauseAtRoundBoundary?: boolean;
}

export interface DiscussionMetadata {
  schemaVersion: number;
  sessionId: string;
  topic?: string;
  status: DiscussionStatus;
  currentRound: number;
  createdAt: number;
  startedAt?: number;
  updatedAt: number;
  completedAt?: number;
  totalMessages: number;
  totalTokens: number;
  errorMessage?: string;
  activeDisagreementsCount: number;
  decisionsCount: number;
  latestReportVersion: number;
  convergedAtRound?: number;
  convergenceReason?: string;
  roundLedger?: RoundExecutionRecord[];
}

export interface DiscussionStreamEvent {
  sessionId: string;
  roundNumber: number;
  agentId: string;
  chunk: string;
  timestamp: number;
}

