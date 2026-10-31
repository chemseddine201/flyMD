export type BuiltinAgentId =
  | 'antigravity'
  | 'claude-code'
  | 'opencode'
  | 'zcode'
  | 'cursor'
  | 'codex';

export type AgentId = BuiltinAgentId | string;

export type AgentAuthStatus =
  | 'connected'
  | 'web-connected'
  | 'api-key-ready'
  | 'needs-login'
  | 'not-installed';

export type AgentIntegrationTier =
  | 'web-session'
  | 'cli-pty'
  | 'mcp-bridge'
  | 'ide-workflow'
  | 'deep-link';

export type AgentTaskIntent =
  | 'build'
  | 'review'
  | 'fix-bugs'
  | 'refine-plan'
  | 'write-tests'
  | 'explain'
  | 'custom';

export type CustomActionEpistemicPolicy =
  | 'collaborative'
  | 'independent-audit';

export type CustomActionIconKey =
  | 'file-text'
  | 'shield'
  | 'sparkles'
  | 'book-open'
  | 'terminal'
  | 'check-circle';

export interface CustomPipelineAction {
  id: string;
  name: string;
  shortLabel: string;
  description: string;
  promptTemplate: string;
  outputFileHint?: string;
  epistemicPolicy: CustomActionEpistemicPolicy;
  iconKey: CustomActionIconKey;
  createdAt: number;
  updatedAt: number;
}

export type AgentTaskStatus =
  | 'queued'
  | 'awaiting-confirmation'
  | 'running'
  | 'completed'
  | 'incomplete'
  | 'failed'
  | 'cancelled'
  | 'undone';

export type AgentProgressStage =
  | 'snapshot'
  | 'context'
  | 'reasoning'
  | 'executing'
  | 'completed';

export interface AgentToolAction {
  id: string;
  kind: 'read' | 'write' | 'checkpoint' | 'workflow' | 'cli' | 'verify';
  label: string;
  targetPath?: string;
  status: 'running' | 'done' | 'error';
  timestamp: number;
  command?: string;
  output?: string;
  durationMs?: number;
}

export interface AgentProfile {
  id: AgentId;
  name: string;
  shortName: string;
  vendor: string;
  description: string;
  accentColor: string;
  badgeBg: string;
  badgeText: string;
  binaryNames: string[];
  detectedBinaryPath?: string;
  installed: boolean;
  authStatus: AgentAuthStatus;
  tier: AgentIntegrationTier;
  loginCommand?: string;
  webUrl?: string;
  envKeyName?: string;
  hasApiKey: boolean;
  webAuthConnected?: boolean;
  connectedAccountLabel?: string;
  artifactWatchPaths: string[];
  enabled: boolean;
  isCustom?: boolean;
}

export interface AgentCredentialConfig {
  apiKey?: string;
  customBinaryPath?: string;
  customArgs?: string;
  connectedAccountLabel?: string;
  oauthVerified?: boolean;
  webSessionVerified?: boolean;
  preferredMode?: 'web' | 'cli' | 'ide';
  isCustomAgent?: boolean;
  customName?: string;
  customVendor?: string;
  customDescription?: string;
  customAccentColor?: string;
  customWebUrl?: string;
  customLoginCommand?: string;
  disabled?: boolean;
}

export type AgentCredentialsMap = Record<string, AgentCredentialConfig>;

export interface ChecklistItem {
  index: number;
  text: string;
  checked: boolean;
  lineNumber: number;
}

export type PipelineStepExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'incomplete'
  | 'failed';

export interface AgentTaskRequest {
  targetAgentId: AgentId;
  sourceAgentId?: AgentId;
  filePath: string;
  fileName: string;
  markdownContent: string;
  selectedExcerpt?: string;
  selectedChecklistItems?: string[];
  intent: AgentTaskIntent;
  customPrompt?: string;
  workspacePath: string;
  createSafetyCheckpoint: boolean;
  safeParallelMode: boolean;
  attachSharedMemory: boolean;
  executionMode?: 'in-app' | 'web' | 'auto' | 'cli';
  pipelineId?: string;
  nextAgentInChain?: AgentId;
  nextIntentInChain?: AgentTaskIntent;
  epistemicPolicy?: CustomActionEpistemicPolicy | string;
  customActionLabel?: string;
  stepNote?: string;
}


export interface VerificationCheck {
  name: string;
  passed: boolean;
  details: string;
}

export interface VerificationReport {
  passed: boolean;
  checkedFiles: string[];
  gaps: string[];
  checks: VerificationCheck[];
  summary: string;
}

export interface AgentTaskRecord {
  id: string;
  targetAgentId: AgentId;
  sourceAgentId?: AgentId;
  filePath: string;
  fileName: string;
  intent: AgentTaskIntent;
  customPrompt?: string;
  workspacePath: string;
  worktreePath?: string;
  checkpointId?: string;
  handoffFilePath?: string;
  outputReportPath?: string;
  status: AgentTaskStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  logs: string[];
  checklistTotal: number;
  checklistCompleted: number;
  error?: string;
  pipelineId?: string;
  nextAgentInChain?: AgentId;
  nextIntentInChain?: AgentTaskIntent;
  responseMarkdown?: string;
  thinkingTrace?: string[];
  progressStage?: AgentProgressStage;
  progressPercent?: number;
  toolActions?: AgentToolAction[];
  customActionId?: string;
  stepNote?: string;
  verificationReport?: VerificationReport;
  outcomeReason?: string;
  attemptCount?: number;
}

export interface AgentCheckpoint {
  id: string;
  taskId: string;
  agentId: AgentId;
  workspacePath: string;
  createdAt: number;
  label: string;
  gitRef?: string;
  backupDir?: string;
  restored: boolean;
}

export interface AgentStreamEvent {
  taskId: string;
  agentId: AgentId;
  line: string;
  timestamp: number;
}

export interface AgentPipelineStep {
  stepId?: string;
  agentId: AgentId;
  intent: AgentTaskIntent;
  customActionId?: string;
  stepNote?: string;
  label: string;
  requireConfirmation: boolean;
  status?: PipelineStepExecutionStatus;
  completedTaskId?: string;
  completedAt?: number;
}

export interface AgentPipelinePreset {
  id: string;
  name: string;
  description: string;
  steps: AgentPipelineStep[];
}
