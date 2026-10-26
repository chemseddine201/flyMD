import { StateCreator } from 'zustand';
import {
  AgentProfile,
  AgentTaskRecord,
  AgentCheckpoint,
  AgentId,
} from '../../../../shared/types';
import { BUILTIN_AGENTS } from '../../../../shared/constants';

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

export interface AgentsSlice {
  agentProfiles: AgentProfile[];
  agentTasks: AgentTaskRecord[];
  agentCheckpoints: AgentCheckpoint[];
  showAgentAccountsModal: boolean;
  showCouncilModal: boolean;
  dispatchDraft: AgentDispatchDraft | null;

  setAgentProfiles: (profiles: AgentProfile[]) => void;
  setAgentTasks: (tasks: AgentTaskRecord[]) => void;
  setAgentCheckpoints: (checkpoints: AgentCheckpoint[]) => void;
  setShowAgentAccountsModal: (show: boolean) => void;
  setShowCouncilModal: (show: boolean) => void;
  openDispatchModal: (draft: Omit<AgentDispatchDraft, 'isOpen'>) => void;
  closeDispatchModal: () => void;
}

export const createAgentsSlice: StateCreator<AgentsSlice, [], [], AgentsSlice> = (set) => ({
  agentProfiles: BUILTIN_AGENTS,
  agentTasks: [],
  agentCheckpoints: [],
  showAgentAccountsModal: false,
  showCouncilModal: false,
  dispatchDraft: null,

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
});

