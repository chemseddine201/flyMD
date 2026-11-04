import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePreviewStore, PreviewStoreState } from '../../../../store';
import {
  DiscussionConfig,
  DiscussionMetadata,
  DiscussionMessage,
  AgentEffortLevel,
  DiscussionAttachedFile,
} from '../../../../../../shared/types';
import { PRESET_TEMPLATES } from '../../../../services/deliberationPresetRepository';
import { ROUND_METADATA_BY_NUMBER } from '../../../../utils/discussionTextUtils';
import { slugifySemanticTitle } from '../../../../utils/smartNaming';
import { DiscussionStageViewTab } from './DiscussionTopToolbar';
import { ParticipantAgentOption } from './CouncilInterventionBar';
import { DiscussionRoundGroup } from './DiscussionTimelineView';
import {
  useNewDeliberationDraft,
  formatAttachedFilesForDeliberation,
} from './useNewDeliberationDraft';
import {
  processFilesForAttachment,
  MAX_DISCUSSION_ATTACHMENTS,
} from './discussionAttachmentUtils';

export interface UseDiscussionStudioControllerParams {
  resolvedWorkspace: string;
  onNavigateToReport?: () => void;
}

export function useDiscussionStudioController({
  resolvedWorkspace,
  onNavigateToReport,
}: UseDiscussionStudioControllerParams) {
  const discussions = usePreviewStore((s: PreviewStoreState) => s.discussions);
  const activeSessionId = usePreviewStore(
    (s: PreviewStoreState) => s.activeSessionId
  );
  const activeMeta = usePreviewStore(
    (s: PreviewStoreState) => s.activeDiscussionMeta
  );
  const activeTranscript = usePreviewStore(
    (s: PreviewStoreState) => s.activeTranscript
  );
  const availableProviders = usePreviewStore(
    (s: PreviewStoreState) => s.availableProviders
  );
  const activeReportMarkdown = usePreviewStore(
    (s: PreviewStoreState) => s.activeReportMarkdown
  );
  const activeReportVersion = usePreviewStore(
    (s: PreviewStoreState) => s.activeReportVersion
  );
  const isRunning = usePreviewStore(
    (s: PreviewStoreState) => s.isDiscussionRunning
  );
  const isStepMode = usePreviewStore((s: PreviewStoreState) => s.isStepMode);
  const discussionError = usePreviewStore(
    (s: PreviewStoreState) => s.discussionError
  );

  const loadDiscussions = usePreviewStore(
    (s: PreviewStoreState) => s.loadDiscussions
  );
  const selectDiscussion = usePreviewStore(
    (s: PreviewStoreState) => s.selectDiscussion
  );
  const loadAvailableProviders = usePreviewStore(
    (s: PreviewStoreState) => s.loadAvailableProviders
  );
  const startNewDiscussion = usePreviewStore(
    (s: PreviewStoreState) => s.startNewDiscussion
  );
  const pauseCurrentDiscussion = usePreviewStore(
    (s: PreviewStoreState) => s.pauseCurrentDiscussion
  );
  const resumeCurrentDiscussion = usePreviewStore(
    (s: PreviewStoreState) => s.resumeCurrentDiscussion
  );
  const cancelCurrentDiscussion = usePreviewStore(
    (s: PreviewStoreState) => s.cancelCurrentDiscussion
  );
  const injectGuidance = usePreviewStore(
    (s: PreviewStoreState) => s.injectGuidance
  );
  const dispatchTargetedAction = usePreviewStore(
    (s: PreviewStoreState) => s.dispatchTargetedAction
  );
  const deleteDiscussion = usePreviewStore(
    (s: PreviewStoreState) => s.deleteDiscussion
  );
  const clearAllDiscussions = usePreviewStore(
    (s: PreviewStoreState) => s.clearAllDiscussions
  );
  const setStepMode = usePreviewStore((s: PreviewStoreState) => s.setStepMode);
  const loadReport = usePreviewStore((s: PreviewStoreState) => s.loadReport);
  const loadDiscussionConfig = usePreviewStore(
    (s: PreviewStoreState) => s.loadDiscussionConfig
  );
  const updateDiscussionConfig = usePreviewStore(
    (s: PreviewStoreState) => s.updateDiscussionConfig
  );
  const handleDiscussionEvent = usePreviewStore(
    (s: PreviewStoreState) => s.handleDiscussionEvent
  );
  const openFileInTab = usePreviewStore(
    (s: PreviewStoreState) => s.openFileInTab
  );
  const setViewMode = usePreviewStore((s: PreviewStoreState) => s.setViewMode);

  const draft = useNewDeliberationDraft({
    resolvedWorkspace,
    availableProviders,
    startNewDiscussion,
  });

  const [activeTab, setActiveTab] =
    useState<DiscussionStageViewTab>('timeline');
  const [searchTerm, setSearchTerm] = useState('');
  const [timelineFilter, setTimelineFilter] = useState<string>('all');

  const [expandedRounds, setExpandedRounds] = useState<Record<number, boolean>>(
    { 1: true, 2: true, 3: true }
  );
  const [expandedTurns, setExpandedTurns] = useState<Record<string, boolean>>(
    {}
  );
  const [expandedThinking, setExpandedThinking] = useState<
    Record<string, boolean>
  >({});

  const [showTargetedDispatch, setShowTargetedDispatch] =
    useState<boolean>(false);
  const [targetedAgentId, setTargetedAgentId] = useState<string>('');
  const [targetedActionName, setTargetedActionName] =
    useState<string>('Targeted Inquiry');
  const [targetedActionQuery, setTargetedActionQuery] = useState<string>('');
  const [targetedEffortLevel, setTargetedEffortLevel] =
    useState<AgentEffortLevel>('medium');
  const [targetedThinkingEnabled, setTargetedThinkingEnabled] =
    useState<boolean>(true);
  const [isDispatchingTargeted, setIsDispatchingTargeted] =
    useState<boolean>(false);

  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [guidanceInput, setGuidanceInput] = useState('');
  const [interventionFiles, setInterventionFiles] = useState<DiscussionAttachedFile[]>([]);
  const [interventionClampedNotice, setInterventionClampedNotice] = useState<boolean>(false);

  const handleAddInterventionFiles = useCallback(async (files: FileList | File[]) => {
    setInterventionClampedNotice(false);
    const { added, clamped } = await processFilesForAttachment(files, interventionFiles.length, MAX_DISCUSSION_ATTACHMENTS);
    if (clamped) {
      setInterventionClampedNotice(true);
    }
    if (added.length > 0) {
      setInterventionFiles((prev) => [...prev, ...added].slice(0, MAX_DISCUSSION_ATTACHMENTS));
    }
  }, [interventionFiles.length]);

  const handleRemoveInterventionFile = useCallback((fileId: string) => {
    setInterventionFiles((prev) => prev.filter((f) => f.id !== fileId));
    setInterventionClampedNotice(false);
  }, []);

  const handleClearInterventionFiles = useCallback(() => {
    setInterventionFiles([]);
    setInterventionClampedNotice(false);
  }, []);
  const [copiedReport, setCopiedReport] = useState(false);
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);
  const [tabFocusNotification, setTabFocusNotification] = useState<
    string | null
  >(null);

  const [inspectingSessionId, setInspectingSessionId] = useState<string | null>(null);
  const [inspectingConfig, setInspectingConfig] = useState<DiscussionConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(false);

  const handleInspectSession = useCallback(
    async (sessionId: string) => {
      setInspectingSessionId(sessionId);
      setIsLoadingConfig(true);
      try {
        let cfg = await loadDiscussionConfig(resolvedWorkspace, sessionId);
        if (!cfg) {
          const meta = discussions.find((d) => d.sessionId === sessionId) || (activeSessionId === sessionId ? activeMeta : null);
          if (meta) {
            const rawMeta = meta as any;
            cfg = {
              schemaVersion: 1,
              sessionId: meta.sessionId,
              workspacePath: resolvedWorkspace,
              topic: meta.topic || 'Deliberation Session',
              userIdea: '',
              turnTimeoutSecs: 120,
              participants: Array.isArray(rawMeta.participants)
                ? rawMeta.participants.map((p: any) => ({
                    agentId: p.agentId || 'architect',
                    providerId: p.providerId || p.agentId || 'antigravity',
                    modelId: p.modelId || 'gemini-4-argon',
                    displayName: p.displayName || p.agentId || 'Agent',
                    role: p.role || 'architect',
                    effortLevel: p.effortLevel || 'medium',
                    thinkingEnabled: p.thinkingEnabled ?? true,
                  }))
                : [],
              maxRounds: rawMeta.maxRounds || 4,
              stepMode: false,
              roundSchedule: rawMeta.roundSchedule || [],
            };
          }
        }
        setInspectingConfig(cfg);
      } catch (err) {
        console.warn('[useDiscussionStudioController] Failed to load discussion config:', err);
      } finally {
        setIsLoadingConfig(false);
      }
    },
    [loadDiscussionConfig, resolvedWorkspace, discussions, activeSessionId, activeMeta]
  );

  const handleSaveDiscussionConfig = useCallback(
    async (newConfig: DiscussionConfig) => {
      if (!inspectingSessionId) return;
      await updateDiscussionConfig(resolvedWorkspace, inspectingSessionId, newConfig);
      // Reload updated config directly from disk to reflect persistent state
      const reloaded = await loadDiscussionConfig(resolvedWorkspace, inspectingSessionId);
      if (reloaded) {
        setInspectingConfig(reloaded);
      } else {
        setInspectingConfig(newConfig);
      }
    },
    [inspectingSessionId, updateDiscussionConfig, loadDiscussionConfig, resolvedWorkspace]
  );

  const handleCloseInspector = useCallback(() => {
    setInspectingSessionId(null);
    setInspectingConfig(null);
  }, []);

  const [turnZoom, setTurnZoom] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('flymd:discussion-zoom');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 80 && val <= 180) return val;
      }
    } catch {}
    return 100;
  });

  const handleUpdateZoom = useCallback((newZoom: number) => {
    const clamped = Math.max(80, Math.min(180, newZoom));
    setTurnZoom(clamped);
    try {
      localStorage.setItem('flymd:discussion-zoom', clamped.toString());
    } catch {}
  }, []);

  useEffect(() => {
    if (resolvedWorkspace) loadDiscussions(resolvedWorkspace);
  }, [resolvedWorkspace, loadDiscussions]);

  useEffect(() => {
    loadAvailableProviders();
  }, [loadAvailableProviders]);

  useEffect(() => {
    if (!window.electronAPI?.onDiscussionEvent) return;
    const unsub = window.electronAPI.onDiscussionEvent((event: any) => {
      handleDiscussionEvent(event);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [handleDiscussionEvent]);

  // Reconciliation Heartbeat Guard (2.5s)
  useEffect(() => {
    if (!isRunning || !activeSessionId || !resolvedWorkspace) return;
    const timer = setInterval(async () => {
      try {
        if (!window.electronAPI?.getDiscussionMetadata) return;
        const meta = await window.electronAPI.getDiscussionMetadata(
          resolvedWorkspace,
          activeSessionId
        );
        if (meta && meta.status !== 'running') {
          await selectDiscussion(resolvedWorkspace, activeSessionId);
        }
      } catch (err) {
        console.warn('[DiscussionStudio] Heartbeat check failed:', err);
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [isRunning, activeSessionId, resolvedWorkspace, selectDiscussion]);

  useEffect(() => {
    if (
      activeMeta?.latestReportVersion &&
      activeMeta.latestReportVersion > 0 &&
      !activeReportMarkdown &&
      resolvedWorkspace &&
      activeSessionId
    ) {
      loadReport(
        resolvedWorkspace,
        activeSessionId,
        activeMeta.latestReportVersion
      );
    }
  }, [
    activeMeta?.latestReportVersion,
    activeReportMarkdown,
    resolvedWorkspace,
    activeSessionId,
    loadReport,
  ]);

  useEffect(() => {
    if (activeTranscript.length > 0) {
      const lastMsg = activeTranscript[activeTranscript.length - 1];
      setExpandedTurns((prev) => ({ ...prev, [lastMsg.id]: true }));
    }
  }, [activeTranscript.length]);

  const filteredDiscussions = useMemo(() => {
    if (!searchTerm.trim()) return discussions;
    const term = searchTerm.toLowerCase();
    return discussions.filter(
      (d: DiscussionMetadata) =>
        d.sessionId.toLowerCase().includes(term) ||
        (d as any).topic?.toLowerCase().includes(term)
    );
  }, [discussions, searchTerm]);

  const roundGroups = useMemo<DiscussionRoundGroup[]>(() => {
    const ledgerByRound = new Map(
      (activeMeta?.roundLedger || []).map((r) => [r.roundNumber, r])
    );
    const maxLedgerRound = (activeMeta?.roundLedger || []).reduce(
      (acc, r) => Math.max(acc, r.roundNumber),
      0
    );
    const totalRounds = Math.max(
      3,
      activeMeta?.currentRound || 1,
      maxLedgerRound
    );
    const msgsByRound = new Map<number, DiscussionMessage[]>();
    const tokensByRound = new Map<number, number>();
    const filterNorm = timelineFilter.toLowerCase();

    for (const m of activeTranscript) {
      const r = m.roundNumber;
      tokensByRound.set(
        r,
        (tokensByRound.get(r) || 0) + (m.tokenUsage?.totalTokens || 0)
      );

      if (timelineFilter !== 'all') {
        const isHuman =
          m.messageKind === 'user_intervention' ||
          m.authorAgentId === 'human-user';
        if (timelineFilter === 'human') {
          if (!isHuman) continue;
        } else if (!(m.authorRole || '').toLowerCase().includes(filterNorm)) {
          continue;
        }
      }

      let list = msgsByRound.get(r);
      if (!list) {
        list = [];
        msgsByRound.set(r, list);
      }
      list.push(m);
    }

    const currentRound = activeMeta?.currentRound || 1;
    const isSessionDone =
      activeMeta?.status === 'awaiting_review' ||
      activeMeta?.status === 'completed';

    const groups: DiscussionRoundGroup[] = [];
    for (let r = 1; r <= totalRounds; r++) {
      const ledger = ledgerByRound.get(r);
      const meta = ROUND_METADATA_BY_NUMBER.get(r) || {
        round: r,
        title: `Phase ${r}: Advanced Deliberation`,
        desc: 'Continued multi-agent cross-examination and refinement.',
      };

      const isIgnored = ledger?.status === 'ignored_consensus';

      groups.push({
        round: r,
        title: ledger?.title || meta.title,
        desc: ledger?.reason || meta.desc,
        messages: msgsByRound.get(r) || [],
        totalTokens: tokensByRound.get(r) || 0,
        isCurrent: currentRound === r && !isIgnored,
        isDone: (!isIgnored && currentRound > r) || (isSessionDone && !isIgnored),
        isIgnored,
        convergedFromRound: ledger?.convergedFromRound,
      });
    }
    return groups;
  }, [
    activeTranscript,
    activeMeta?.currentRound,
    activeMeta?.status,
    activeMeta?.roundLedger,
    timelineFilter,
  ]);

  const handleToggleExpandAll = useCallback(
    (expand: boolean) => {
      const roundMap: Record<number, boolean> = {};
      for (let r = 1; r <= Math.max(3, activeMeta?.currentRound || 1); r++) {
        roundMap[r] = expand;
      }
      setExpandedRounds(roundMap);

      const turnMap: Record<string, boolean> = {};
      for (const m of activeTranscript) {
        turnMap[m.id] = expand;
      }
      setExpandedTurns(turnMap);
    },
    [activeMeta?.currentRound, activeTranscript]
  );

  const toggleRound = useCallback((round: number) => {
    setExpandedRounds((prev) => ({ ...prev, [round]: !prev[round] }));
  }, []);

  const toggleTurn = useCallback((turnId: string) => {
    setExpandedTurns((prev) => ({ ...prev, [turnId]: !prev[turnId] }));
  }, []);

  const toggleThinking = useCallback((turnId: string) => {
    setExpandedThinking((prev) => ({ ...prev, [turnId]: !prev[turnId] }));
  }, []);

  const participantAgents = useMemo<ParticipantAgentOption[]>(() => {
    const map = new Map<string, ParticipantAgentOption>();
    for (const msg of activeTranscript) {
      if (msg.authorAgentId && msg.authorAgentId !== 'human-user') {
        if (!map.has(msg.authorAgentId)) {
          const configured = draft.customParticipantsById.get(
            msg.authorAgentId
          );
          map.set(msg.authorAgentId, {
            id: msg.authorAgentId,
            name: msg.authorDisplayName || msg.authorAgentId,
            role: msg.authorRole,
            color: configured?.avatarColor,
            providerId: msg.authorProvider || configured?.providerId,
          });
        }
      }
    }
    if (map.size === 0) {
      PRESET_TEMPLATES.architecture.participants.forEach((p) => {
        map.set(p.agentId, {
          id: p.agentId,
          name: p.displayName,
          role: p.role,
          color: p.avatarColor,
          providerId: p.providerId,
        });
      });
    }
    return Array.from(map.values());
  }, [activeTranscript, draft.customParticipantsById]);

  useEffect(() => {
    if (!targetedAgentId && participantAgents.length > 0) {
      setTargetedAgentId(participantAgents[0].id);
    }
  }, [targetedAgentId, participantAgents]);

  const handleDispatchTargetedQuery = useCallback(async () => {
    const rawQuery = targetedActionQuery.trim();
    if ((!rawQuery && interventionFiles.length === 0) || !targetedAgentId) return;
    setIsDispatchingTargeted(true);
    try {
      const filesContext = formatAttachedFilesForDeliberation(interventionFiles, 'index_and_start');
      const effectiveQuery = rawQuery || 'Analyze and deliberate on the following attached files:';
      const fullQuery = filesContext ? `${effectiveQuery}${filesContext}` : effectiveQuery;
      await dispatchTargetedAction(
        targetedAgentId,
        targetedActionName || 'Targeted Inquiry',
        fullQuery
      );
      setTargetedActionQuery('');
      setInterventionFiles([]);
      setInterventionClampedNotice(false);
      setShowTargetedDispatch(false);
    } finally {
      setIsDispatchingTargeted(false);
    }
  }, [
    targetedActionQuery,
    targetedAgentId,
    dispatchTargetedAction,
    targetedActionName,
    interventionFiles,
  ]);

  const handleProbeAgent = useCallback((agentId: string) => {
    setTargetedAgentId(agentId);
    setShowTargetedDispatch(true);
  }, []);

  const handleCopyTurn = useCallback((turnId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedTurnId(turnId);
    setTimeout(() => setCopiedTurnId(null), 2000);
  }, []);

  const handleQuoteInGuidance = useCallback(
    (agentName: string, snippet: string) => {
      const quote = `> @${agentName}: "${snippet.slice(
        0,
        100
      )}..."\nRegarding this point: `;
      setGuidanceInput((prev) => (prev ? `${prev}\n\n${quote}` : quote));
    },
    []
  );

  const handleConfirmDeleteSession = useCallback(async () => {
    if (!sessionToDelete || !resolvedWorkspace) return;
    await deleteDiscussion(resolvedWorkspace, sessionToDelete);
    setSessionToDelete(null);
  }, [sessionToDelete, resolvedWorkspace, deleteDiscussion]);

  const handleConfirmClearAll = useCallback(async () => {
    if (!resolvedWorkspace) return;
    await clearAllDiscussions(resolvedWorkspace);
    setShowClearAllModal(false);
  }, [resolvedWorkspace, clearAllDiscussions]);

  const handleCopyReport = useCallback(() => {
    if (!activeReportMarkdown) return;
    navigator.clipboard.writeText(activeReportMarkdown);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  }, [activeReportMarkdown]);

  const handleOpenReportInTab = useCallback(() => {
    if (!activeSessionId || !resolvedWorkspace) return;
    const version =
      activeReportVersion || activeMeta?.latestReportVersion || 1;
    const topicSlug = activeMeta?.topic ? slugifySemanticTitle(activeMeta.topic, 35) : '';
    const docName = topicSlug
      ? `${topicSlug}_ConsensusReport-v${version}.md`
      : `ConsensusReport-v${version}_${activeSessionId}.md`;
    const reportPath = `${resolvedWorkspace}/.flymd/discussions/${activeSessionId}/reports/${docName}`;

    openFileInTab(
      {
        path: reportPath,
        name: docName,
        content: activeReportMarkdown || '# Report Generating...',
      },
      { activate: true }
    );
    setViewMode('preview');
    setTabFocusNotification(`Focused report preview tab: ${docName}`);
    setTimeout(() => setTabFocusNotification(null), 4000);
  }, [
    activeSessionId,
    resolvedWorkspace,
    activeReportVersion,
    activeMeta?.latestReportVersion,
    activeMeta?.topic,
    openFileInTab,
    activeReportMarkdown,
    setViewMode,
  ]);

  const handleGoToReport = useCallback(() => {
    if (onNavigateToReport) {
      onNavigateToReport();
    } else {
      setActiveTab('report');
      if (!activeReportMarkdown && activeSessionId) {
        loadReport(
          resolvedWorkspace,
          activeSessionId,
          activeMeta?.latestReportVersion || 1
        );
      }
    }
  }, [
    onNavigateToReport,
    activeReportMarkdown,
    activeSessionId,
    loadReport,
    resolvedWorkspace,
    activeMeta?.latestReportVersion,
  ]);

  const handleSelectStageTab = useCallback(
    (tab: DiscussionStageViewTab) => {
      setActiveTab(tab);
      if (
        tab === 'report' &&
        activeSessionId &&
        ((activeMeta?.latestReportVersion || 0) > 0 ||
          activeMeta?.status === 'awaiting_review') &&
        !activeReportMarkdown
      ) {
        loadReport(
          resolvedWorkspace,
          activeSessionId,
          activeMeta?.latestReportVersion || 1
        );
      }
    },
    [
      activeSessionId,
      activeMeta?.latestReportVersion,
      activeMeta?.status,
      activeReportMarkdown,
      loadReport,
      resolvedWorkspace,
    ]
  );

  const handleSendGuidance = useCallback(async () => {
    const rawText = guidanceInput.trim();
    if (!rawText && interventionFiles.length === 0) return;
    const filesContext = formatAttachedFilesForDeliberation(interventionFiles, 'index_and_start');
    const effectiveText = rawText || 'Deliberate on and integrate these attached reference files:';
    const textToSend = filesContext ? `${effectiveText}${filesContext}` : effectiveText;
    setGuidanceInput('');
    setInterventionFiles([]);
    setInterventionClampedNotice(false);
    await injectGuidance(textToSend);
  }, [guidanceInput, interventionFiles, injectGuidance]);

  const handleToggleStepMode = useCallback(async () => {
    if (!activeSessionId || !resolvedWorkspace) return;
    await setStepMode(resolvedWorkspace, activeSessionId, !isStepMode);
  }, [activeSessionId, resolvedWorkspace, setStepMode, isStepMode]);

  return {
    discussions,
    activeSessionId,
    activeMeta,
    activeTranscript,
    availableProviders,
    activeReportMarkdown,
    activeReportVersion,
    isRunning,
    isStepMode,
    discussionError,
    selectDiscussion,
    pauseCurrentDiscussion,
    resumeCurrentDiscussion,
    cancelCurrentDiscussion,
    loadReport,
    draft,
    activeTab,
    handleSelectStageTab,
    searchTerm,
    setSearchTerm,
    filteredDiscussions,
    timelineFilter,
    setTimelineFilter,
    roundGroups,
    expandedRounds,
    expandedTurns,
    expandedThinking,
    handleToggleExpandAll,
    toggleRound,
    toggleTurn,
    toggleThinking,
    showTargetedDispatch,
    setShowTargetedDispatch,
    participantAgents,
    targetedAgentId,
    setTargetedAgentId,
    targetedActionName,
    setTargetedActionName,
    targetedActionQuery,
    setTargetedActionQuery,
    targetedEffortLevel,
    setTargetedEffortLevel,
    targetedThinkingEnabled,
    setTargetedThinkingEnabled,
    isDispatchingTargeted,
    handleDispatchTargetedQuery,
    handleProbeAgent,
    sessionToDelete,
    setSessionToDelete,
    handleConfirmDeleteSession,
    showClearAllModal,
    setShowClearAllModal,
    handleConfirmClearAll,
    guidanceInput,
    setGuidanceInput,
    handleSendGuidance,
    interventionFiles,
    handleAddInterventionFiles,
    handleRemoveInterventionFile,
    handleClearInterventionFiles,
    interventionClampedNotice,
    copiedReport,
    handleCopyReport,
    copiedTurnId,
    handleCopyTurn,
    handleQuoteInGuidance,
    tabFocusNotification,
    setTabFocusNotification,
    inspectingSessionId,
    inspectingConfig,
    isLoadingConfig,
    handleInspectSession,
    handleSaveDiscussionConfig,
    handleCloseInspector,
    turnZoom,
    handleUpdateZoom,
    handleOpenReportInTab,
    handleGoToReport,
    handleToggleStepMode,
  };
}
