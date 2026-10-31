import { StateCreator } from 'zustand';
import {
  AgentProfile,
  AgentTaskRecord,
  AgentCheckpoint,
  AgentId,
  AgentPipelinePreset,
} from '../../../../shared/types';
import {
  BUILTIN_AGENTS,
  BUILTIN_AGENT_PIPELINES,
} from '../../../../shared/constants';

export interface AgentDispatchDraft {
  isOpen: boolean;
  targetAgentId: AgentId;
  sourceFilePath: string;
  sourceFileName: string;
  markdownContent: string;
  selectedExcerpt?: string;
  selectedChecklistItems?: string[];
  sourceAgentId?: string;
  pipelineId?: string;
  nextAgentInChain?: AgentId;
}

export interface WaitingStepApprovalState {
  completedStepIdx: number;
  nextStepIdx: number;
  nextAgentName: string;
  nextIntent: string;
  completedTaskId: string;
  filesCreatedCount: number;
}

export interface AssignedReportDocState {
  pipelineId: string;
  pipelineName: string;
  reportMarkdown: string;
  assignedAt: string;
}

function loadInitialPipelines(): AgentPipelinePreset[] {
  try {
    const saved = localStorage.getItem('flymd:custom-pipelines');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return BUILTIN_AGENT_PIPELINES;
}

function persistPipelinesToStorage(pipelines: AgentPipelinePreset[]) {
  try {
    localStorage.setItem('flymd:custom-pipelines', JSON.stringify(pipelines));
  } catch {}
}

export interface AgentsSlice {
  agentProfiles: AgentProfile[];
  agentTasks: AgentTaskRecord[];
  agentCheckpoints: AgentCheckpoint[];
  showAgentAccountsModal: boolean;
  showCouncilModal: boolean;
  dispatchDraft: AgentDispatchDraft | null;

  // Persistent Workflow & Pipeline Execution State (survives viewMode/tab switches)
  pipelines: AgentPipelinePreset[];
  runningPipelineId: string | null;
  runningPipelineStepIdx: number;
  waitingForStepApproval: WaitingStepApprovalState | null;
  assignedReportDoc: AssignedReportDocState | null;
  agentLifecycleStage: 'debate' | 'report' | 'pipeline';

  setAgentProfiles: (profiles: AgentProfile[]) => void;
  setAgentTasks: (tasks: AgentTaskRecord[]) => void;
  setAgentCheckpoints: (checkpoints: AgentCheckpoint[]) => void;
  setShowAgentAccountsModal: (show: boolean) => void;
  setShowCouncilModal: (show: boolean) => void;
  openDispatchModal: (draft: Omit<AgentDispatchDraft, 'isOpen'>) => void;
  closeDispatchModal: () => void;

  setPipelines: (
    updater:
      | AgentPipelinePreset[]
      | ((prev: AgentPipelinePreset[]) => AgentPipelinePreset[])
  ) => void;
  setRunningPipelineId: (id: string | null) => void;
  setRunningPipelineStepIdx: (idx: number) => void;
  setWaitingForStepApproval: (val: WaitingStepApprovalState | null) => void;
  setAssignedReportDoc: (doc: AssignedReportDocState | null) => void;
  setAgentLifecycleStage: (stage: 'debate' | 'report' | 'pipeline') => void;
}

export const createAgentsSlice: StateCreator<AgentsSlice, [], [], AgentsSlice> = (
  set,
  get
) => ({
  agentProfiles: BUILTIN_AGENTS,
  agentTasks: [],
  agentCheckpoints: [],
  showAgentAccountsModal: false,
  showCouncilModal: false,
  dispatchDraft: null,

  pipelines: loadInitialPipelines(),
  runningPipelineId: null,
  runningPipelineStepIdx: -1,
  waitingForStepApproval: null,
  assignedReportDoc: null,
  agentLifecycleStage: 'pipeline',

  setAgentProfiles: (profiles) => set({ agentProfiles: profiles }),
  setAgentTasks: (tasks) => set({ agentTasks: tasks }),
  setAgentCheckpoints: (checkpoints) => set({ agentCheckpoints: checkpoints }),
  setShowAgentAccountsModal: (show) => set({ showAgentAccountsModal: show }),
  setShowCouncilModal: (show) => set({ showCouncilModal: show }),
  openDispatchModal: (draft) =>
    set({
      dispatchDraft: {
        ...draft,
        isOpen: true,
      },
    }),
  closeDispatchModal: () => set({ dispatchDraft: null }),

  setPipelines: (updater) => {
    const prev = get().pipelines;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    persistPipelinesToStorage(next);
    set({ pipelines: next });
  },
  setRunningPipelineId: (id) => set({ runningPipelineId: id }),
  setRunningPipelineStepIdx: (idx) => set({ runningPipelineStepIdx: idx }),
  setWaitingForStepApproval: (val) => set({ waitingForStepApproval: val }),
  setAssignedReportDoc: (doc) => set({ assignedReportDoc: doc }),
  setAgentLifecycleStage: (stage) => set({ agentLifecycleStage: stage }),
});
