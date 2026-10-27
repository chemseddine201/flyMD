import { StateCreator } from 'zustand';
import {
  DiscussionConfig,
  DiscussionMetadata,
  DiscussionMessage,
  DiscussionStreamEvent,
} from '../../../../shared/types';

export interface DiscussionSlice {
  discussions: DiscussionMetadata[];
  activeSessionId: string | null;
  activeDiscussionMeta: DiscussionMetadata | null;
  activeTranscript: DiscussionMessage[];
  streamingChunks: Record<string, string>;
  activeReportMarkdown: string | null;
  activeReportVersion: number | null;
  isDiscussionRunning: boolean;
  discussionError: string | null;
  isStepMode: boolean;

  loadDiscussions: (workspacePath: string) => Promise<void>;
  selectDiscussion: (workspacePath: string, sessionId: string) => Promise<void>;
  startNewDiscussion: (config: DiscussionConfig) => Promise<void>;
  pauseCurrentDiscussion: () => Promise<void>;
  resumeCurrentDiscussion: (workspacePath: string) => Promise<void>;
  cancelCurrentDiscussion: () => Promise<void>;
  injectGuidance: (guidance: string) => Promise<void>;
  deleteDiscussion: (workspacePath: string, sessionId: string) => Promise<void>;
  clearAllDiscussions: (workspacePath: string) => Promise<void>;
  setStepMode: (workspacePath: string, sessionId: string, enabled: boolean) => Promise<void>;
  handleDiscussionEvent: (event: any) => void;
  loadReport: (workspacePath: string, sessionId: string, version?: number) => Promise<void>;
}

export const createDiscussionSlice: StateCreator<DiscussionSlice> = (set, get) => ({
  discussions: [],
  activeSessionId: null,
  activeDiscussionMeta: null,
  activeTranscript: [],
  streamingChunks: {},
  activeReportMarkdown: null,
  activeReportVersion: null,
  isDiscussionRunning: false,
  discussionError: null,
  isStepMode: false,

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
      set({ activeSessionId: sessionId, discussionError: null, streamingChunks: {} });
      const meta = await window.electronAPI.getDiscussionMetadata(workspacePath, sessionId);
      const transcript = await window.electronAPI.getDiscussionTranscript(workspacePath, sessionId);
      set({
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

    const workspace = (window as any)._flymd_last_workspace;
    const sessionId = payload.session_id || activeSessionId;

    switch (event.type) {
      case 'StatusChanged': {
        const newStatus = payload.new_status;
        set((state) => ({
          isDiscussionRunning: newStatus === 'running',
          streamingChunks: newStatus !== 'running' ? {} : state.streamingChunks,
          activeDiscussionMeta: state.activeDiscussionMeta
            ? { ...state.activeDiscussionMeta, status: newStatus }
            : null,
        }));

        if (workspace && sessionId && window.electronAPI) {
          window.electronAPI.getDiscussionMetadata(workspace, sessionId).then((meta) => {
            if (meta) {
              set({ activeDiscussionMeta: meta });
              if ((newStatus === 'awaiting_review' || newStatus === 'completed') && meta.latestReportVersion > 0) {
                get().loadReport(workspace, sessionId, meta.latestReportVersion);
              }
            }
          }).catch(console.error);
          window.electronAPI.getDiscussionTranscript(workspace, sessionId).then((transcript) => {
            if (transcript) set({ activeTranscript: transcript });
          }).catch(console.error);
          window.electronAPI.listDiscussions(workspace).then((list) => {
            if (list) set({ discussions: list });
          }).catch(console.error);
        }
        break;
      }
      case 'TurnStarted': {
        const key = `r${payload.round}-${payload.agent_id}`;
        // Reset chunk for newly started turn
        set((state) => {
          const next = { ...state.streamingChunks };
          delete next[key];
          return { streamingChunks: next };
        });
        break;
      }
      case 'TurnPausedForHuman': {
        set((state) => ({
          isDiscussionRunning: false,
          streamingChunks: {},
          activeDiscussionMeta: state.activeDiscussionMeta
            ? { ...state.activeDiscussionMeta, status: 'paused' }
            : null,
        }));
        if (workspace && sessionId && window.electronAPI) {
          window.electronAPI.getDiscussionTranscript(workspace, sessionId).then((transcript) => {
            if (transcript) set({ activeTranscript: transcript });
          }).catch(console.error);
          window.electronAPI.getDiscussionMetadata(workspace, sessionId).then((meta) => {
            if (meta) set({ activeDiscussionMeta: meta });
          }).catch(console.error);
        }
        break;
      }
      case 'GuidanceInjected': {
        if (workspace && sessionId && window.electronAPI) {
          window.electronAPI.getDiscussionTranscript(workspace, sessionId).then((transcript) => {
            if (transcript) set({ activeTranscript: transcript });
          }).catch(console.error);
        }
        break;
      }
      case 'TurnChunk': {
        const key = `r${payload.round}-${payload.agent_id}`;
        set((state) => ({
          streamingChunks: {
            ...state.streamingChunks,
            [key]: (state.streamingChunks[key] || '') + payload.chunk,
          },
        }));
        break;
      }
      case 'TurnCompleted': {
        const key = `r${payload.round}-${payload.agent_id}`;
        // Clear completed turn from streaming chunks so it does not persist on screen as an active box!
        set((state) => {
          const nextChunks = { ...state.streamingChunks };
          delete nextChunks[key];
          return { streamingChunks: nextChunks };
        });

        // Immediately refresh official transcript & metadata from durable backend
        if (workspace && sessionId && window.electronAPI) {
          window.electronAPI.getDiscussionTranscript(workspace, sessionId).then((transcript) => {
            if (transcript) set({ activeTranscript: transcript });
          }).catch(console.error);
          window.electronAPI.getDiscussionMetadata(workspace, sessionId).then((meta) => {
            if (meta) set({ activeDiscussionMeta: meta });
          }).catch(console.error);
          window.electronAPI.listDiscussions(workspace).then((list) => {
            if (list) set({ discussions: list });
          }).catch(console.error);
        }
        break;
      }
      case 'RoundCompleted': {
        if (workspace && sessionId && window.electronAPI) {
          window.electronAPI.getDiscussionMetadata(workspace, sessionId).then((meta) => {
            if (meta) set({ activeDiscussionMeta: meta });
          }).catch(console.error);
          window.electronAPI.getDiscussionTranscript(workspace, sessionId).then((transcript) => {
            if (transcript) set({ activeTranscript: transcript });
          }).catch(console.error);
          window.electronAPI.listDiscussions(workspace).then((list) => {
            if (list) set({ discussions: list });
          }).catch(console.error);
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

