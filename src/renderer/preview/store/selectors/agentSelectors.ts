import { PreviewStoreState } from '../usePreviewStore';
import {
  AgentProfile,
  AgentTaskRecord,
  AgentCheckpoint,
  DiscussionParticipant,
} from '../../../../shared/types';

/**
 * Returns all agent profiles that are installed and not disabled.
 */
export const selectEnabledAgentProfiles = (state: PreviewStoreState): AgentProfile[] => {
  return state.agentProfiles.filter((p) => p.installed && p.enabled !== false);
};

/**
 * Creates an O(1) lookup map of agent profiles indexed by agent id.
 */
export const selectAgentsById = (state: PreviewStoreState): Map<string, AgentProfile> => {
  const map = new Map<string, AgentProfile>();
  for (const profile of state.agentProfiles) {
    map.set(profile.id, profile);
  }
  return map;
};

/**
 * Creates an O(1) lookup map of agent tasks indexed by task id.
 */
export const selectTasksById = (state: PreviewStoreState): Map<string, AgentTaskRecord> => {
  const map = new Map<string, AgentTaskRecord>();
  for (const task of state.agentTasks) {
    map.set(task.id, task);
  }
  return map;
};

/**
 * Creates an O(1) lookup map of agent checkpoints indexed by checkpoint id.
 */
export const selectCheckpointsById = (state: PreviewStoreState): Map<string, AgentCheckpoint> => {
  const map = new Map<string, AgentCheckpoint>();
  for (const cp of state.agentCheckpoints) {
    map.set(cp.id, cp);
  }
  return map;
};

/**
 * Returns the currently running agent task, or latest recorded task.
 */
export const selectActiveAgentTask = (state: PreviewStoreState): AgentTaskRecord | undefined => {
  return state.agentTasks.find((t) => t.status === 'running') || state.agentTasks[0];
};

/**
 * Creates an O(1) lookup map of discussion participants indexed by agentId.
 */
export const selectParticipantsById = (
  participants: DiscussionParticipant[]
): Map<string, DiscussionParticipant> => {
  const map = new Map<string, DiscussionParticipant>();
  for (const p of participants) {
    map.set(p.agentId, p);
  }
  return map;
};
