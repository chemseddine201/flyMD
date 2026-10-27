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

export interface DiscussionTokenUsage {
  promptTokens: number;
  completionTokens: number;
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
}

export type DiscussionMessageKind =
  | 'initial_analysis'
  | 'peer_critique'
  | 'rebuttal_revision'
  | 'synthesis_report'
  | 'user_intervention';

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
}

export interface DiscussionMetadata {
  schemaVersion: number;
  sessionId: string;
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
}

export interface DiscussionStreamEvent {
  sessionId: string;
  roundNumber: number;
  agentId: string;
  chunk: string;
  timestamp: number;
}

