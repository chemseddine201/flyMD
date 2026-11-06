import { StateCreator } from 'zustand';
import {
  DiscussionConfig,
  DiscussionMetadata,
  DiscussionMessage,
  DiscussionStreamEvent,
  AvailableProviderInfo,
  SkillDescriptor,
} from '../../../../shared/types';

export interface DiscussionSlice {
  discussions: DiscussionMetadata[];
  activeSessionId: string | null;
  activeDiscussionMeta: DiscussionMetadata | null;
  activeTranscript: DiscussionMessage[];
  streamingChunks: Record<string, string>;
  streamingThinking: Record<string, string>;
  availableProviders: AvailableProviderInfo[];
  activeReportMarkdown: string | null;
  activeReportVersion: number | null;
  isDiscussionRunning: boolean;
  discussionError: string | null;
  isStepMode: boolean;
  customSkillsDir: string | null;
  includeDefaultSkills: boolean;
  availableSkills: SkillDescriptor[];
  activeDiscussionConfig: DiscussionConfig | null;

  setCustomSkillsDir: (dir: string | null) => void;
  setIncludeDefaultSkills: (inc: boolean) => void;
  scanCustomSkills: (dirPath: string) => Promise<SkillDescriptor[]>;
  loadAvailableSkills: (
    workspacePath: string,
    customSkillsDir?: string | null,
    includeDefaultSkills?: boolean
  ) => Promise<SkillDescriptor[]>;

  loadDiscussions: (workspacePath: string) => Promise<void>;
  selectDiscussion: (workspacePath: string, sessionId: string) => Promise<void>;
  loadDiscussionConfig: (workspacePath: string, sessionId: string) => Promise<DiscussionConfig | null>;
  updateDiscussionConfig: (workspacePath: string, sessionId: string, config: DiscussionConfig) => Promise<DiscussionMetadata | null>;
  loadAvailableProviders: () => Promise<void>;
  startNewDiscussion: (config: DiscussionConfig) => Promise<void>;
  pauseCurrentDiscussion: () => Promise<void>;
  resumeCurrentDiscussion: (workspacePath: string) => Promise<void>;
  cancelCurrentDiscussion: () => Promise<void>;
  injectGuidance: (guidance: string) => Promise<void>;
  dispatchTargetedAction: (agentId: string, actionName?: string, actionQuery?: string) => Promise<DiscussionMessage | null>;
  deleteDiscussion: (workspacePath: string, sessionId: string) => Promise<void>;
  clearAllDiscussions: (workspacePath: string) => Promise<void>;
  setStepMode: (workspacePath: string, sessionId: string, enabled: boolean) => Promise<void>;
  handleDiscussionEvent: (event: any) => void;
  loadReport: (workspacePath: string, sessionId: string, version?: number) => Promise<void>;
}

let activeSyncSequence = 0;

async function syncDiscussionFromBackend(
  set: any,
  get: any,
  workspace: string,
  sessionId: string,
  triggerStatus?: string
) {
  const currentSeq = ++activeSyncSequence;
  if (!window.electronAPI) return;

  try {
    const meta = await window.electronAPI.getDiscussionMetadata(workspace, sessionId);
    if (currentSeq !== activeSyncSequence) return; // Ignore outdated responses

    const transcript = await window.electronAPI.getDiscussionTranscript(workspace, sessionId);
    if (currentSeq !== activeSyncSequence) return; // Ignore outdated responses

    const list = await window.electronAPI.listDiscussions(workspace);
    if (currentSeq !== activeSyncSequence) return; // Ignore outdated responses

    const effectiveStatus = triggerStatus || meta?.status;
    const isRunning = effectiveStatus === 'running';

    set((state: any) => ({
      activeDiscussionMeta: meta || state.activeDiscussionMeta,
      activeTranscript: transcript || state.activeTranscript,
      discussions: list || state.discussions,
      isDiscussionRunning: isRunning,
      streamingChunks: !isRunning ? {} : state.streamingChunks,
      streamingThinking: !isRunning ? {} : state.streamingThinking,
    }));

    if (
      meta &&
      (effectiveStatus === 'awaiting_review' || effectiveStatus === 'completed') &&
      meta.latestReportVersion > 0
    ) {
      get().loadReport(workspace, sessionId, meta.latestReportVersion);
    }
  } catch (err) {
    console.warn('[DiscussionSlice] Failed to sync discussion state:', err);
  }
}

export const createDiscussionSlice: StateCreator<DiscussionSlice> = (set, get) => ({
  discussions: [],
  activeSessionId: null,
  activeDiscussionMeta: null,
  activeTranscript: [],
  streamingChunks: {},
  streamingThinking: {},
  availableProviders: [],
  activeReportMarkdown: null,
  activeReportVersion: null,
  isDiscussionRunning: false,
  discussionError: null,
  isStepMode: false,
  customSkillsDir: null,
  includeDefaultSkills: true,
  availableSkills: [],
  activeDiscussionConfig: null,

  setCustomSkillsDir: (dir: string | null) => set({ customSkillsDir: dir }),
  setIncludeDefaultSkills: (inc: boolean) => set({ includeDefaultSkills: inc }),

  scanCustomSkills: async (dirPath: string) => {
    if (!window.electronAPI?.scanCustomSkillsDir) return [];
    try {
      const skills = await window.electronAPI.scanCustomSkillsDir(dirPath);
      return skills || [];
    } catch (e: any) {
      console.warn('[DiscussionSlice] Failed to scan custom skills dir:', e);
      return [];
    }
  },

  loadAvailableSkills: async (
    workspacePath: string,
    customSkillsDir?: string | null,
    includeDefaultSkills?: boolean
  ) => {
    if (!window.electronAPI?.getAvailableSkills) return [];
    try {
      const skills = await window.electronAPI.getAvailableSkills(
        workspacePath,
        customSkillsDir !== undefined ? customSkillsDir : get().customSkillsDir,
        includeDefaultSkills !== undefined
          ? includeDefaultSkills
          : get().includeDefaultSkills
      );
      set({ availableSkills: skills || [] });
      return skills || [];
    } catch (e: any) {
      console.warn('[DiscussionSlice] Failed to load available skills:', e);
      return [];
    }
  },

  loadDiscussions: async (workspacePath: string) => {
    if (!window.electronAPI?.listDiscussions) return;
    try {
      (window as any)._flymd_last_workspace = workspacePath;
      const list = await window.electronAPI.listDiscussions(workspacePath);
      set({ discussions: list || [] });
    } catch (e: any) {
      console.error('[DiscussionSlice] Failed to load discussions:', e);
    }
  },

  selectDiscussion: async (workspacePath: string, sessionId: string) => {
    if (!window.electronAPI) return;
    try {
      (window as any)._flymd_last_workspace = workspacePath;
      const { activeSessionId } = get();
      const isSwitchingSession = activeSessionId !== sessionId;
      if (isSwitchingSession) {
        set({
          activeSessionId: sessionId,
          discussionError: null,
          streamingChunks: {},
          streamingThinking: {},
        });
      }
      const meta = await window.electronAPI.getDiscussionMetadata(workspacePath, sessionId);
      const transcript = await window.electronAPI.getDiscussionTranscript(workspacePath, sessionId);
      set({
        activeSessionId: sessionId,
        activeDiscussionMeta: meta,
        activeTranscript: transcript || [],
        isDiscussionRunning: meta?.status === 'running',
        isStepMode: (meta as any)?.stepMode ?? false,
      });
      // Load latest report if completed or awaiting review
      if (meta?.latestReportVersion && meta.latestReportVersion > 0) {
        get().loadReport(workspacePath, sessionId, meta.latestReportVersion);
      } else {
        set({ activeReportMarkdown: null, activeReportVersion: null });
      }
    } catch (e: any) {
      set({ discussionError: String(e) });
    }
  },

  loadAvailableProviders: async () => {
    if (!window.electronAPI?.getAvailableProviders) return;
    try {
      const list = await window.electronAPI.getAvailableProviders();
      set({ availableProviders: list || [] });
    } catch (e: any) {
      console.error('[DiscussionSlice] Failed to load available providers:', e);
    }
  },

  loadDiscussionConfig: async (workspacePath: string, sessionId: string) => {
    if (!window.electronAPI?.getDiscussionConfig) return null;
    try {
      const cfg = await window.electronAPI.getDiscussionConfig(workspacePath, sessionId);
      set({ activeDiscussionConfig: cfg });
      return cfg;
    } catch (e: any) {
      console.error('[DiscussionSlice] Failed to load discussion config:', e);
      return null;
    }
  },

  updateDiscussionConfig: async (workspacePath: string, sessionId: string, config: DiscussionConfig) => {
    if (!window.electronAPI?.updateDiscussionConfig) return null;
    try {
      const meta = await window.electronAPI.updateDiscussionConfig(workspacePath, sessionId, config);
      set({ activeDiscussionMeta: meta, activeDiscussionConfig: config, discussionError: null });
      return meta;
    } catch (e: any) {
      set({ discussionError: String(e) });
      throw e;
    }
  },

  startNewDiscussion: async (config: DiscussionConfig) => {
    if (!window.electronAPI?.startDiscussion) return;
    try {
      (window as any)._flymd_last_workspace = config.workspacePath;
      set({
        activeSessionId: config.sessionId,
        isDiscussionRunning: true,
        discussionError: null,
        activeTranscript: [],
        streamingChunks: {},
        streamingThinking: {},
        activeReportMarkdown: null,
        isStepMode: !!config.stepMode,
      });
      const meta = await window.electronAPI.startDiscussion(config);
      set({ activeDiscussionMeta: meta });
      get().loadDiscussions(config.workspacePath);
    } catch (e: any) {
      set({ discussionError: String(e), isDiscussionRunning: false });
    }
  },

  pauseCurrentDiscussion: async () => {
    const { activeSessionId } = get();
    if (!activeSessionId || !window.electronAPI?.pauseDiscussion) return;
    try {
      set({ isDiscussionRunning: false });
      const meta = await window.electronAPI.pauseDiscussion(activeSessionId);
      set({ activeDiscussionMeta: meta, isDiscussionRunning: false });
    } catch (e: any) {
      set({ discussionError: String(e) });
    }
  },

  resumeCurrentDiscussion: async (workspacePath: string) => {
    const { activeSessionId } = get();
    if (!activeSessionId || !window.electronAPI?.resumeDiscussion) return;
    try {
      (window as any)._flymd_last_workspace = workspacePath;
      set({ isDiscussionRunning: true, discussionError: null });
      const meta = await window.electronAPI.resumeDiscussion(activeSessionId, workspacePath);
      set({ activeDiscussionMeta: meta });
    } catch (e: any) {
      set({ discussionError: String(e), isDiscussionRunning: false });
    }
  },

  cancelCurrentDiscussion: async () => {
    const { activeSessionId } = get();
    if (!activeSessionId || !window.electronAPI?.cancelDiscussion) return;
    try {
      set({ isDiscussionRunning: false });
      const meta = await window.electronAPI.cancelDiscussion(activeSessionId);
      set({ activeDiscussionMeta: meta, isDiscussionRunning: false });
    } catch (e: any) {
      set({ discussionError: String(e) });
    }
  },

  injectGuidance: async (guidance: string) => {
    const { activeSessionId } = get();
    if (!activeSessionId || !window.electronAPI?.injectDiscussionGuidance) return;
    try {
      set({ isDiscussionRunning: true, discussionError: null });
      const meta = await window.electronAPI.injectDiscussionGuidance(activeSessionId, guidance);
      set({ activeDiscussionMeta: meta });
    } catch (e: any) {
      set({ discussionError: String(e), isDiscussionRunning: false });
    }
  },

  dispatchTargetedAction: async (agentId: string, actionName?: string, actionQuery?: string) => {
    const { activeSessionId } = get();
    if (!activeSessionId || !window.electronAPI?.dispatchTargetedAction) return null;
    try {
      set({ isDiscussionRunning: true, discussionError: null });
      const msg = await window.electronAPI.dispatchTargetedAction(
        activeSessionId,
        agentId,
        actionName || undefined,
        actionQuery || ''
      );
      const workspace = (window as any)._flymd_last_workspace;
      if (workspace && window.electronAPI) {
        const transcript = await window.electronAPI.getDiscussionTranscript(workspace, activeSessionId);
        if (transcript) set({ activeTranscript: transcript });
        const meta = await window.electronAPI.getDiscussionMetadata(workspace, activeSessionId);
        if (meta) set({ activeDiscussionMeta: meta });
      }
      set({ isDiscussionRunning: false });
      return msg;
    } catch (e: any) {
      console.error('[DiscussionSlice] Failed to dispatch targeted action:', e);
      set({ discussionError: String(e), isDiscussionRunning: false });
      return null;
    }
  },

  deleteDiscussion: async (workspacePath: string, sessionId: string) => {
    if (!window.electronAPI?.deleteDiscussion) return;
    try {
      await window.electronAPI.deleteDiscussion(workspacePath, sessionId);
      set((state) => {
        const nextDiscussions = state.discussions.filter((d) => d.sessionId !== sessionId);
        const isCurrent = state.activeSessionId === sessionId;
        return {
          discussions: nextDiscussions,
          activeSessionId: isCurrent ? null : state.activeSessionId,
          activeDiscussionMeta: isCurrent ? null : state.activeDiscussionMeta,
          activeTranscript: isCurrent ? [] : state.activeTranscript,
          streamingChunks: isCurrent ? {} : state.streamingChunks,
          activeReportMarkdown: isCurrent ? null : state.activeReportMarkdown,
          activeReportVersion: isCurrent ? null : state.activeReportVersion,
          isDiscussionRunning: isCurrent ? false : state.isDiscussionRunning,
        };
      });
    } catch (e: any) {
      console.error('[DiscussionSlice] Failed to delete discussion:', e);
      set({ discussionError: String(e) });
    }
  },

  clearAllDiscussions: async (workspacePath: string) => {
    if (!window.electronAPI?.clearAllDiscussions) return;
    try {
      await window.electronAPI.clearAllDiscussions(workspacePath);
      set({
        discussions: [],
        activeSessionId: null,
        activeDiscussionMeta: null,
        activeTranscript: [],
        streamingChunks: {},
        activeReportMarkdown: null,
        activeReportVersion: null,
        isDiscussionRunning: false,
        discussionError: null,
      });
    } catch (e: any) {
      console.error('[DiscussionSlice] Failed to clear all discussions:', e);
      set({ discussionError: String(e) });
    }
  },

  setStepMode: async (workspacePath: string, sessionId: string, enabled: boolean) => {
    set({ isStepMode: enabled });
    if (window.electronAPI?.setDiscussionStepMode) {
      try {
        await window.electronAPI.setDiscussionStepMode(workspacePath, sessionId, enabled);
      } catch (e: any) {
        console.warn('[DiscussionSlice] Failed to persist step mode:', e);
      }
    }
  },

  handleDiscussionEvent: (event: any) => {
    if (!event || !event.type) return;
    const { activeSessionId } = get();
    const payload = event.payload || {};

    if (payload.session_id && activeSessionId && payload.session_id !== activeSessionId) {
      return;
    }

    const workspace =
      (window as any)._flymd_last_workspace ||
      (get() as any).folderPath ||
      '.';
    const sessionId = payload.session_id || activeSessionId;

    switch (event.type) {
      case 'StatusChanged': {
        const newStatus = payload.new_status;
        set((state) => ({
          isDiscussionRunning: newStatus === 'running',
          streamingChunks: newStatus !== 'running' ? {} : state.streamingChunks,
          streamingThinking: newStatus !== 'running' ? {} : state.streamingThinking,
          activeDiscussionMeta: state.activeDiscussionMeta
            ? { ...state.activeDiscussionMeta, status: newStatus }
            : null,
        }));

        if (workspace && sessionId && window.electronAPI) {
          syncDiscussionFromBackend(set, get, workspace, sessionId, newStatus);
        }
        break;
      }
      case 'TurnStarted': {
        const key = `r${payload.round}-${payload.agent_id}`;
        // Reset chunks and thinking for newly started turn
        set((state) => {
          const next = { ...state.streamingChunks };
          delete next[key];
          const nextThinking = { ...state.streamingThinking };
          delete nextThinking[key];
          return { streamingChunks: next, streamingThinking: nextThinking };
        });
        break;
      }
      case 'TurnPausedForHuman': {
        set((state) => ({
          isDiscussionRunning: false,
          streamingChunks: {},
          streamingThinking: {},
          activeDiscussionMeta: state.activeDiscussionMeta
            ? { ...state.activeDiscussionMeta, status: 'paused' }
            : null,
        }));
        if (workspace && sessionId && window.electronAPI) {
          syncDiscussionFromBackend(set, get, workspace, sessionId, 'paused');
        }
        break;
      }
      case 'RoundBarrierPaused': {
        set((state) => ({
          isDiscussionRunning: false,
          streamingChunks: {},
          streamingThinking: {},
          activeDiscussionMeta: state.activeDiscussionMeta
            ? { ...state.activeDiscussionMeta, status: 'paused' }
            : null,
        }));
        if (workspace && sessionId && window.electronAPI) {
          syncDiscussionFromBackend(set, get, workspace, sessionId, 'paused');
        }
        break;
      }
      case 'ConfigUpdated': {
        if (workspace && sessionId && window.electronAPI) {
          syncDiscussionFromBackend(set, get, workspace, sessionId);
          get().loadDiscussionConfig(workspace, sessionId);
        }
        break;
      }
      case 'QuotaLimitReached': {
        const total = payload.total_tokens ?? payload.totalTokens;
        const cap = payload.token_budget_cap ?? payload.tokenBudgetCap ?? payload.cap;
        set((state) => ({
          isDiscussionRunning: false,
          streamingChunks: {},
          streamingThinking: {},
          discussionError: `Token quota budget reached (${total?.toLocaleString()} / ${cap?.toLocaleString()} tokens). Paused at safe turn boundary.`,
          activeDiscussionMeta: state.activeDiscussionMeta
            ? { ...state.activeDiscussionMeta, status: 'paused' }
            : null,
        }));
        if (workspace && sessionId && window.electronAPI) {
          syncDiscussionFromBackend(set, get, workspace, sessionId, 'paused');
        }
        break;
      }
      case 'ConvergenceReached': {
        set((state) => ({
          streamingChunks: {},
          streamingThinking: {},
          activeDiscussionMeta: state.activeDiscussionMeta
            ? {
                ...state.activeDiscussionMeta,
                convergedAtRound: payload.converged_round,
                convergenceReason: payload.reason,
              }
            : null,
        }));
        if (workspace && sessionId && window.electronAPI) {
          syncDiscussionFromBackend(set, get, workspace, sessionId);
        }
        break;
      }
      case 'GuidanceInjected': {
        if (workspace && sessionId && window.electronAPI) {
          syncDiscussionFromBackend(set, get, workspace, sessionId);
        }
        break;
      }
      case 'TurnThinkingChunk': {
        const key = `r${payload.round}-${payload.agent_id}`;
        set((state) => ({
          streamingThinking: {
            ...state.streamingThinking,
            [key]: (state.streamingThinking[key] || '') + (payload.chunk || ''),
          },
        }));
        break;
      }
      case 'TurnChunk': {
        const key = `r${payload.round}-${payload.agent_id}`;
        set((state) => ({
          streamingChunks: {
            ...state.streamingChunks,
            [key]: (state.streamingChunks[key] || '') + (payload.chunk || ''),
          },
        }));
        break;
      }
      case 'TurnCompleted': {
        const key = `r${payload.round}-${payload.agent_id}`;
        // Clear completed turn from streaming chunks and thinking
        set((state) => {
          const nextChunks = { ...state.streamingChunks };
          delete nextChunks[key];
          const nextThinking = { ...state.streamingThinking };
          delete nextThinking[key];
          return { streamingChunks: nextChunks, streamingThinking: nextThinking };
        });

        if (payload?.usage && (get() as any).recordTokenUsage) {
          (get() as any).recordTokenUsage({
            promptTokens: payload.usage.prompt_tokens ?? payload.usage.promptTokens,
            completionTokens: payload.usage.completion_tokens ?? payload.usage.completionTokens,
            reasoningTokens: payload.usage.reasoning_tokens ?? payload.usage.reasoningTokens,
            totalTokens: payload.usage.total_tokens ?? payload.usage.totalTokens,
          });
        }

        // Sequence-guarded sync from backend
        if (workspace && sessionId && window.electronAPI) {
          syncDiscussionFromBackend(set, get, workspace, sessionId);
        }
        break;
      }
      case 'RoundCompleted': {
        if (workspace && sessionId && window.electronAPI) {
          syncDiscussionFromBackend(set, get, workspace, sessionId);
        }
        break;
      }
    }
  },

  loadReport: async (workspacePath: string, sessionId: string, version?: number) => {
    if (!window.electronAPI?.getDiscussionReport) return;
    try {
      const reportMd = await window.electronAPI.getDiscussionReport(workspacePath, sessionId, version);
      set({
        activeReportMarkdown: reportMd,
        activeReportVersion: version || null,
      });
    } catch (e: any) {
      console.warn('[DiscussionSlice] Failed to load report:', e);
    }
  },
});

