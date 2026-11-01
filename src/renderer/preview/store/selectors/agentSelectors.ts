import { PreviewStoreState } from '../usePreviewStore';
import {
  AgentProfile,
  AgentTaskRecord,
  AgentCheckpoint,
  DiscussionParticipant,
} from '../../../../shared/types';

/**
 * Single-entry reference-equality memoizer so derived arrays/Maps remain
 * referentially stable for Zustand v5 `useSyncExternalStore` subscriptions.
 */
function memoizeByRef<TIn, TOut>(compute: (input: TIn) => TOut): (input: TIn) => TOut {
  let hasCache = false;
  let lastInput: TIn;
  let lastOutput: TOut;
  return (input: TIn): TOut => {
    if (hasCache && Object.is(input, lastInput)) {
      return lastOutput;
    }
    lastInput = input;
    lastOutput = compute(input);
    hasCache = true;
    return lastOutput;
  };
}

const computeVisibleAgentProfiles = memoizeByRef((profiles: AgentProfile[]): AgentProfile[] => {
  const enabled = profiles.filter((a) => a.enabled);
  return enabled.length > 0 ? enabled : profiles;
});

const computeEnabledAgentProfiles = memoizeByRef((profiles: AgentProfile[]): AgentProfile[] => {
  return profiles.filter((p) => p.installed && p.enabled !== false);
});

const computeAgentsById = memoizeByRef((profiles: AgentProfile[]): Map<string, AgentProfile> => {
  const map = new Map<string, AgentProfile>();
  for (const profile of profiles) {
    map.set(profile.id, profile);
  }
  return map;
});

const computeTasksById = memoizeByRef((tasks: AgentTaskRecord[]): Map<string, AgentTaskRecord> => {
  const map = new Map<string, AgentTaskRecord>();
  for (const task of tasks) {
    map.set(task.id, task);
  }
  return map;
});

const computeCheckpointsById = memoizeByRef(
  (checkpoints: AgentCheckpoint[]): Map<string, AgentCheckpoint> => {
    const map = new Map<string, AgentCheckpoint>();
    for (const cp of checkpoints) {
      map.set(cp.id, cp);
    }
    return map;
  }
);

/**
 * Returns visible agent profiles (`enabled` profiles when non-empty, otherwise all profiles).
 * Referentially stable across renders when `state.agentProfiles` has not changed.
 */
export const selectVisibleAgentProfiles = (state: PreviewStoreState): AgentProfile[] =>
  computeVisibleAgentProfiles(state.agentProfiles);

/**
 * Returns all agent profiles that are installed and not disabled.
 */
export const selectEnabledAgentProfiles = (state: PreviewStoreState): AgentProfile[] =>
  computeEnabledAgentProfiles(state.agentProfiles);

/**
 * Returns a referentially memoized O(1) lookup map of agent profiles indexed by agent id.
 */
export const selectAgentsById = (state: PreviewStoreState): Map<string, AgentProfile> =>
  computeAgentsById(state.agentProfiles);

/**
 * Returns a referentially memoized O(1) lookup map of agent tasks indexed by task id.
 */
export const selectTasksById = (state: PreviewStoreState): Map<string, AgentTaskRecord> =>
  computeTasksById(state.agentTasks);

/**
 * Returns a referentially memoized O(1) lookup map of agent checkpoints indexed by checkpoint id.
 */
export const selectCheckpointsById = (state: PreviewStoreState): Map<string, AgentCheckpoint> =>
  computeCheckpointsById(state.agentCheckpoints);

/**
 * Returns the currently running agent task, or latest recorded task.
 */
export const selectActiveAgentTask = (state: PreviewStoreState): AgentTaskRecord | undefined => {
  return state.agentTasks.find((t) => t.status === 'running') || state.agentTasks[0];
};

/**
 * Returns a referentially memoized O(1) lookup map of discussion participants indexed by agentId.
 */
export const selectParticipantsById = memoizeByRef(
  (participants: DiscussionParticipant[]): Map<string, DiscussionParticipant> => {
    const map = new Map<string, DiscussionParticipant>();
    for (const p of participants) {
      map.set(p.agentId, p);
    }
    return map;
  }
);
