import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  usePreviewStore,
  selectActiveTab,
  selectVisibleAgentProfiles,
  selectAgentsById,
  selectTasksById,
  selectCheckpointsById,
} from '../../../store';
import {
  AGENT_INTENT_PRESETS,
  BUILTIN_AGENT_PIPELINES,
} from '../../../../../shared/constants';
import {
  AgentId,
  AgentPipelinePreset,
  AgentPipelineStep,
  AgentTaskIntent,
  AgentTaskRecord,
  AgentEffortLevel,
} from '../../../../../shared/types';
import {
  isPipelineCancelledRef,
  proceedNextStepResolverRef,
  proceedNextWorkflowStep,
  cancelActivePipelineExecution,
  composeEpistemicStepPayload,
} from '../../../services/pipelineExecutionService';
import { PendingRecoveryPromptData } from '../modals/PipelineRecoveryModal';
import { CompletedPipelineSummary } from './PipelineStatusBanners';
import { useStudioWorkspaceActions } from './useStudioWorkspaceActions';
import { usePipelineRunnerAndRecovery } from './usePipelineRunnerAndRecovery';

export interface UseAgentStudioControllerProps {
  folderPath?: string;
  activeTab?: { id: string; filePath?: string; title?: string };
  supervisionConfig?: any;
}

export function useAgentStudioController({
  folderPath: propFolderPath,
  activeTab: propActiveTab,
  supervisionConfig: propSupervisionConfig,
}: UseAgentStudioControllerProps) {
  const agentProfiles = usePreviewStore((s) => s.agentProfiles);
  const visibleAgents = usePreviewStore(selectVisibleAgentProfiles);
  const agentsById = usePreviewStore(selectAgentsById);
  const agentTasks = usePreviewStore((s) => s.agentTasks);
  const tasksById = usePreviewStore(selectTasksById);
  const agentCheckpoints = usePreviewStore((s) => s.agentCheckpoints);
  const checkpointsById = usePreviewStore(selectCheckpointsById);

  const setAgentProfiles = usePreviewStore((s) => s.setAgentProfiles);
  const setAgentTasks = usePreviewStore((s) => s.setAgentTasks);
  const setAgentCheckpoints = usePreviewStore((s) => s.setAgentCheckpoints);
  const setShowAgentAccountsModal = usePreviewStore((s) => s.setShowAgentAccountsModal);
  const setShowCouncilModal = usePreviewStore((s) => s.setShowCouncilModal);
  const openDispatchModal = usePreviewStore((s) => s.openDispatchModal);
  const activeTab = usePreviewStore(selectActiveTab);

  const pipelines = usePreviewStore((s) => s.pipelines);
  const setPipelines = usePreviewStore((s) => s.setPipelines);
  const runningPipelineId = usePreviewStore((s) => s.runningPipelineId);
  const setRunningPipelineId = usePreviewStore((s) => s.setRunningPipelineId);
  const runningPipelineStepIdx = usePreviewStore((s) => s.runningPipelineStepIdx);
  const setRunningPipelineStepIdx = usePreviewStore((s) => s.setRunningPipelineStepIdx);
  const waitingForStepApproval = usePreviewStore((s) => s.waitingForStepApproval);
  const setWaitingForStepApproval = usePreviewStore((s) => s.setWaitingForStepApproval);
  const assignedReportDoc = usePreviewStore((s) => s.assignedReportDoc);
  const setAssignedReportDoc = usePreviewStore((s) => s.setAssignedReportDoc);
  const lifecycleStage = usePreviewStore((s) => s.agentLifecycleStage);
  const setLifecycleStage = usePreviewStore((s) => s.setAgentLifecycleStage);

  const activeProject = usePreviewStore((s) => s.activeProject);
  const loadProjects = usePreviewStore((s) => s.loadProjects);
  const rollupProject = usePreviewStore((s) => s.rollupProject);
  const activeReportMarkdown = usePreviewStore((s) => s.activeReportMarkdown);
  const appendProjectMemory = usePreviewStore((s) => s.appendProjectMemory);
  const injectGuidance = usePreviewStore((s) => s.injectGuidance);

  const [selectedAgentId, setSelectedAgentId] = useState<AgentId>(
    () => visibleAgents[0]?.id || 'antigravity'
  );
  const [selectedIntent, setSelectedIntent] = useState<AgentTaskIntent>('refine-plan');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [restoringCheckpointId, setRestoringCheckpointId] = useState<string | null>(null);
  const [completedPipelineSummary, setCompletedPipelineSummary] =
    useState<CompletedPipelineSummary | null>(null);
  const [pendingRecoveryPrompt, setPendingRecoveryPrompt] =
    useState<PendingRecoveryPromptData | null>(null);

  const workspace = useStudioWorkspaceActions({
    propFolderPath,
    propActiveTab,
    propSupervisionConfig,
    activeTab,
    setSelectedTaskId,
    setCompletedPipelineSummary,
    setPendingRecoveryPrompt,
  });

  const { resolvedWorkspace, resolveCurrentSourceDocument, resolveCustomAction } =
    workspace;

  const [workflowExecutionMode, setWorkflowExecutionMode] = useState<'auto' | 'manual'>(
    () => {
      try {
        return (
          (localStorage.getItem('flymd:workflow-execution-mode') as
            | 'auto'
            | 'manual') || 'auto'
        );
      } catch {
        return 'auto';
      }
    }
  );

  const handleSetWorkflowExecutionMode = useCallback((mode: 'auto' | 'manual') => {
    setWorkflowExecutionMode(mode);
    try {
      localStorage.setItem('flymd:workflow-execution-mode', mode);
    } catch {}
  }, []);

  // O(1) Selected Task Lookup via memoized `tasksById` Map
  const selectedTask = useMemo(() => {
    if (selectedTaskId) {
      return tasksById.get(selectedTaskId) || agentTasks[0] || null;
    }
    return agentTasks[0] || null;
  }, [selectedTaskId, tasksById, agentTasks]);

  // Live Reconciliation across remounts
  useEffect(() => {
    const primary = pipelines[0];
    if (!primary || runningPipelineId) return;

    const runningTaskForPipeline = agentTasks.find(
      (t) => t.status === 'running' && t.pipelineId === primary.id
    );

    if (runningTaskForPipeline) {
      let matchIdx = primary.steps.findIndex(
        (s) => s.completedTaskId === runningTaskForPipeline.id
      );
      if (matchIdx === -1) {
        matchIdx = primary.steps.findIndex(
          (s) =>
            s.status === 'running' ||
            (s.intent === runningTaskForPipeline.intent && s.status !== 'completed')
        );
      }
      setRunningPipelineId(primary.id);
      if (matchIdx !== -1) {
        setRunningPipelineStepIdx(matchIdx);
      }
    }
  }, [
    agentTasks,
    pipelines,
    runningPipelineId,
    setRunningPipelineId,
    setRunningPipelineStepIdx,
  ]);

  const visibleAgentIdSet = useMemo(
    () => new Set(visibleAgents.map((a) => a.id)),
    [visibleAgents]
  );

  useEffect(() => {
    if (visibleAgents.length > 0 && !visibleAgentIdSet.has(selectedAgentId)) {
      setSelectedAgentId(visibleAgents[0].id);
    }
  }, [visibleAgents, visibleAgentIdSet, selectedAgentId]);

  useEffect(() => {
    if (resolvedWorkspace) {
      loadProjects(resolvedWorkspace);
    }
  }, [resolvedWorkspace, loadProjects]);

  const cancelActivePipelineRun = useCallback(async (targetPipelineId?: string) => {
    await cancelActivePipelineExecution(targetPipelineId, () =>
      setPendingRecoveryPrompt(null)
    );
  }, []);

  const handleLaunchDedicatedPipeline = useCallback(
    async (preset: AgentPipelinePreset, reportMarkdown: string) => {
      setPipelines((prev) => [preset, ...prev.filter((p) => p.id !== preset.id)]);
      setAssignedReportDoc({
        pipelineId: preset.id,
        pipelineName: preset.name,
        reportMarkdown,
        assignedAt: new Date().toLocaleTimeString(),
      });

      if (resolvedWorkspace && activeProject) {
        await appendProjectMemory(
          resolvedWorkspace,
          activeProject.id,
          'operator',
          'decision',
          `Assigned Dedicated Pipeline: ${preset.name} (${preset.steps.length} steps)`,
          `Pipeline created from synthesis report with ${preset.steps.length} execution tasks.`,
          ['pipeline', 'provision', 'contract']
        );
      }
      setLifecycleStage('pipeline');
    },
    [
      setPipelines,
      setAssignedReportDoc,
      resolvedWorkspace,
      activeProject,
      appendProjectMemory,
      setLifecycleStage,
    ]
  );

  const handleSendBackToDebate = useCallback(
    async (feedback: string, reportMarkdown: string) => {
      if (resolvedWorkspace && activeProject) {
        await appendProjectMemory(
          resolvedWorkspace,
          activeProject.id,
          'operator',
          'decision',
          `Operator Steering & Re-deliberation Directive`,
          `Feedback: ${feedback}\n\nReport Context:\n${reportMarkdown}`,
          ['steering', 'recycle', 'feedback']
        );
      }
      try {
        await injectGuidance(
          `[OPERATOR RE-DELIBERATION GUIDANCE]: ${feedback}\n\nPlease re-evaluate previous assumptions and consensus points in light of this guidance.`
        );
      } catch {}
      setLifecycleStage('debate');
    },
    [resolvedWorkspace, activeProject, appendProjectMemory, injectGuidance, setLifecycleStage]
  );

  const handleAuditDeliverablesInDebate = useCallback(async () => {
    if (resolvedWorkspace && activeProject) {
      await appendProjectMemory(
        resolvedWorkspace,
        activeProject.id,
        'pipeline',
        'deliverable',
        `Completed Pipeline Execution Deliverables: ${
          completedPipelineSummary?.pipelineName || 'Tasks'
        }`,
        completedPipelineSummary?.lastTaskOutput ||
          'Deliverables generated by pipeline execution.',
        ['evidence', 'deliverables', 'audit']
      );
    }
    try {
      await injectGuidance(
        `[EMPIRICAL DELIVERABLES AUDIT]: Pipeline execution has completed deliverables for "${
          completedPipelineSummary?.pipelineName || activeProject?.name
        }". All models: audit generated files and verify invariants against original requirements.`
      );
    } catch {}
    setLifecycleStage('debate');
  }, [
    resolvedWorkspace,
    activeProject,
    completedPipelineSummary,
    appendProjectMemory,
    injectGuidance,
    setLifecycleStage,
  ]);

  const handleRollupToMaster = useCallback(async () => {
    if (!resolvedWorkspace || !activeProject) return;
    const summary = `### [Project: ${activeProject.name}] — Completed\n- **Status**: Verified by evidence\n- **Scope**: ${
      activeProject.scope_paths.join(', ') || 'Entire Workspace'
    }\n- **Timestamp**: ${new Date().toISOString()}\n`;
    await rollupProject(resolvedWorkspace, activeProject.id, summary);
  }, [resolvedWorkspace, activeProject, rollupProject]);

  const effectiveReportMarkdown = useMemo(() => {
    if (activeReportMarkdown && activeReportMarkdown.trim().length > 0) {
      return activeReportMarkdown;
    }
    const projName = activeProject?.name || 'General Project Task';
    const projDesc =
      activeProject?.description ||
      'Structured execution plan, objectives, and deliverables.';
    return `# Synthesis Report & Execution Contract: ${projName}

- **Project Node**: \`${activeProject?.id || 'root'}\`
- **Scope Paths**: ${
      activeProject?.scope_paths?.length
        ? activeProject.scope_paths.join(', ')
        : 'Entire Workspace'
    }
- **Epistemic Classification**: \`[Agent Consensus]\`

---

## 1. Executive Summary & Objectives
${projDesc}

## 2. Actionable Implementation Checklist
- [ ] Review specifications, domain objectives, and requirements
- [ ] Implement core content, deliverables, or target components
- [ ] Cross-validate deliverables against constraints and criteria
- [ ] Audit final outputs, settle deliverables, and mark milestone complete

## 3. Epistemic Acceptance Criteria
- Clear alignment with core project goals
- Rigorous verification of constraints and deliverables
- Evidence before done: all artifacts and deliverables settled cleanly
`;
  }, [activeReportMarkdown, activeProject]);

  const handleUpdatePipelineStep = useCallback(
    (pipelineId: string, stepIdx: number, updates: Partial<AgentPipelineStep>) => {
      const isOnlyNoteUpdate =
        Object.keys(updates).length === 1 && 'stepNote' in updates;
      if (runningPipelineId === pipelineId && !isOnlyNoteUpdate) {
        cancelActivePipelineRun(pipelineId);
      }
      setPipelines((prev) =>
        prev.map((p) => {
          if (p.id !== pipelineId) return p;
          const steps = p.steps.map((s, idx) =>
            idx === stepIdx ? { ...s, ...updates } : s
          );
          return { ...p, steps };
        })
      );
    },
    [runningPipelineId, cancelActivePipelineRun, setPipelines]
  );

  const handleAddPipelineStep = useCallback(
    (pipelineId: string) => {
      if (runningPipelineId === pipelineId) {
        cancelActivePipelineRun(pipelineId);
      }
      const defaultAgent = visibleAgents[0]?.id || 'antigravity';
      setPipelines((prev) =>
        prev.map((p) => {
          if (p.id !== pipelineId) return p;
          const nextIntent: AgentTaskIntent =
            p.steps.length === 0
              ? 'refine-plan'
              : p.steps.length === 1
              ? 'build'
              : p.steps.length === 2
              ? 'review'
              : 'fix-bugs';
          const presetLabel =
            AGENT_INTENT_PRESETS.find((ip) => ip.id === nextIntent)?.title ||
            nextIntent;
          const newStep: AgentPipelineStep = {
            stepId: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            agentId: defaultAgent,
            intent: nextIntent,
            label: `${p.steps.length + 1}. ${presetLabel}`,
            requireConfirmation: false,
            status: 'pending',
          };
          return { ...p, steps: [...p.steps, newStep] };
        })
      );
    },
    [runningPipelineId, cancelActivePipelineRun, visibleAgents, setPipelines]
  );

  const handleClearStepDoneStatus = useCallback(
    (pipelineId: string) => {
      setPipelines((prev) =>
        prev.map((p) => {
          if (p.id !== pipelineId) return p;
          const steps = p.steps.map((s) => ({
            ...s,
            status: 'pending' as const,
            completedTaskId: undefined,
            completedAt: undefined,
          }));
          return { ...p, steps };
        })
      );
    },
    [setPipelines]
  );

  const handleRemovePipelineStep = useCallback(
    (pipelineId: string, stepIdx: number) => {
      if (runningPipelineId === pipelineId) {
        cancelActivePipelineRun(pipelineId);
      }
      setPipelines((prev) =>
        prev.map((p) => {
          if (p.id !== pipelineId || p.steps.length <= 1) return p;
          return { ...p, steps: p.steps.filter((_, idx) => idx !== stepIdx) };
        })
      );
    },
    [runningPipelineId, cancelActivePipelineRun, setPipelines]
  );

  const handleResetPipelines = useCallback(() => {
    if (runningPipelineId) {
      cancelActivePipelineRun(runningPipelineId);
    }
    const fallbackAgent = visibleAgents[0]?.id || 'antigravity';
    const secondAgent = visibleAgents[1]?.id || fallbackAgent;
    const reset = BUILTIN_AGENT_PIPELINES.map((p) => ({
      ...p,
      steps: p.steps.map((s, idx) => ({
        ...s,
        agentId: visibleAgentIdSet.has(s.agentId)
          ? s.agentId
          : idx % 2 === 0
          ? fallbackAgent
          : secondAgent,
      })),
    }));
    setPipelines(reset);
    try {
      localStorage.removeItem('flymd:custom-pipelines');
    } catch {}
  }, [
    runningPipelineId,
    cancelActivePipelineRun,
    visibleAgents,
    visibleAgentIdSet,
    setPipelines,
  ]);

  const handleRefreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const [profiles, tasks, checkpoints] = await Promise.all([
        window.electronAPI.discoverAgents(),
        window.electronAPI.getAgentTasks(),
        window.electronAPI.getAgentCheckpoints(),
      ]);
      setAgentProfiles(profiles);
      setAgentTasks(tasks);
      setAgentCheckpoints(checkpoints);
    } catch (err) {
      console.error('Failed to refresh agent studio state:', err);
    } finally {
      setRefreshing(false);
    }
  }, [setAgentProfiles, setAgentTasks, setAgentCheckpoints]);

  const handleRestoreCheckpoint = useCallback(
    async (checkpointId: string) => {
      setRestoringCheckpointId(checkpointId);
      try {
        await window.electronAPI.restoreAgentCheckpoint(checkpointId);
        const [tasks, checkpoints] = await Promise.all([
          window.electronAPI.getAgentTasks(),
          window.electronAPI.getAgentCheckpoints(),
        ]);
        setAgentTasks(tasks);
        setAgentCheckpoints(checkpoints);
      } catch (err) {
        console.error('Failed to restore checkpoint:', err);
      } finally {
        setRestoringCheckpointId(null);
      }
    },
    [setAgentTasks, setAgentCheckpoints]
  );

  const handleSendInAppChatTask = useCallback(
    async (
      promptText: string,
      overrides?: {
        agentId?: AgentId;
        intent?: AgentTaskIntent;
        filePath?: string;
        fileName?: string;
        markdownContent?: string;
        sourceAgentId?: AgentId;
        pipelineId?: string;
        nextAgentInChain?: AgentId;
        nextIntentInChain?: AgentTaskIntent;
        epistemicPolicy?: 'collaborative' | 'independent-audit';
        customActionLabel?: string;
        stepNote?: string;
        attemptCount?: number;
        resumeSessionId?: string;
        resumeFromBreakpoint?: boolean;
        previousFailedTaskId?: string;
        effortLevel?: AgentEffortLevel;
        thinkingEnabled?: boolean;
        modelId?: string;
        tokenSaver?: 'off' | 'standard' | 'strict';
      }
    ): Promise<AgentTaskRecord | null> => {
      setSubmitting(true);
      try {
        const doc = await resolveCurrentSourceDocument(overrides?.filePath);
        const record = await window.electronAPI.dispatchAgentTask({
          targetAgentId: overrides?.agentId || selectedAgentId,
          sourceAgentId: overrides?.sourceAgentId,
          filePath: overrides?.filePath ?? doc.filePath,
          fileName: overrides?.fileName ?? doc.fileName,
          markdownContent: overrides?.markdownContent ?? doc.markdownContent,
          intent: overrides?.intent || selectedIntent,
          customPrompt: promptText.trim() || undefined,
          workspacePath: resolvedWorkspace,
          createSafetyCheckpoint: true,
          safeParallelMode: false,
          attachSharedMemory: true,
          executionMode: 'in-app',
          pipelineId: overrides?.pipelineId,
          nextAgentInChain: overrides?.nextAgentInChain,
          nextIntentInChain: overrides?.nextIntentInChain,
          epistemicPolicy: overrides?.epistemicPolicy,
          customActionLabel: overrides?.customActionLabel,
          stepNote: overrides?.stepNote,
          attemptCount: overrides?.attemptCount,
          resumeSessionId: overrides?.resumeSessionId,
          resumeFromBreakpoint: overrides?.resumeFromBreakpoint,
          previousFailedTaskId: overrides?.previousFailedTaskId,
          effortLevel: overrides?.effortLevel ?? 'medium',
          thinkingEnabled: overrides?.thinkingEnabled ?? true,
          modelId: overrides?.modelId,
          tokenSaver:
            overrides?.tokenSaver ??
            (usePreviewStore.getState().settings?.tokenSaver || 'standard'),
        });

        const [tasks, checkpoints] = await Promise.all([
          window.electronAPI.getAgentTasks(),
          window.electronAPI.getAgentCheckpoints(),
        ]);
        setAgentTasks(tasks);
        setAgentCheckpoints(checkpoints);
        if (record?.id) setSelectedTaskId(record.id);
        return record || null;
      } catch (err) {
        console.error('Failed to run in-app agent task:', err);
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [
      resolveCurrentSourceDocument,
      selectedAgentId,
      selectedIntent,
      resolvedWorkspace,
      setAgentTasks,
      setAgentCheckpoints,
    ]
  );

  const pipelineRunner = usePipelineRunnerAndRecovery({
    resolvedWorkspace,
    activeTab,
    assignedReportDoc,
    workflowExecutionMode,
    agentTasks,
    tasksById,
    selectedTask,
    setSelectedAgentId,
    setSelectedIntent,
    setSelectedTaskId,
    setCompletedPipelineSummary,
    pendingRecoveryPrompt,
    setPendingRecoveryPrompt,
    resolveCustomAction,
    handleRestoreCheckpoint,
    handleSendInAppChatTask,
  });

  const handleRelayToNextAgent = useCallback(
    async (
      task: AgentTaskRecord,
      nextAgentId: AgentId,
      nextIntent: AgentTaskIntent,
      customActionId?: string,
      effortLevel?: AgentEffortLevel,
      thinkingEnabled?: boolean
    ) => {
      setSelectedAgentId(nextAgentId);
      setSelectedIntent(nextIntent);
      const customAct = resolveCustomAction(customActionId);

      const originalContract =
        assignedReportDoc?.reportMarkdown || activeTab?.content || '';
      const relayPayload = composeEpistemicStepPayload(
        originalContract,
        task.responseMarkdown,
        nextIntent,
        false,
        task.targetAgentId,
        task.intent as AgentTaskIntent | undefined
      );

      let prompt = `Relayed from @${task.targetAgentId} (${task.intent}) → Continue with ${
        customAct?.name.toUpperCase() || nextIntent.toUpperCase()
      }`;
      if (customAct?.promptTemplate) {
        prompt = `${prompt}\n\n[Action Directive]: ${customAct.promptTemplate}`;
      }

      await handleSendInAppChatTask(prompt, {
        agentId: nextAgentId,
        intent: nextIntent,
        filePath: task.outputReportPath || task.filePath,
        fileName: task.fileName,
        markdownContent: relayPayload,
        sourceAgentId: task.targetAgentId,
        epistemicPolicy: customAct?.epistemicPolicy,
        customActionLabel: customAct?.name,
        effortLevel: effortLevel || 'medium',
        thinkingEnabled: thinkingEnabled ?? true,
      });
    },
    [resolveCustomAction, assignedReportDoc, activeTab, handleSendInAppChatTask]
  );

  const handlePasteExternalReply = useCallback(
    async (task: AgentTaskRecord) => {
      if (
        task.status === 'running' ||
        (runningPipelineId && !waitingForStepApproval)
      ) {
        alert(
          'Cannot paste external reply while an agent or workflow is actively running.'
        );
        return;
      }
      try {
        const text = await navigator.clipboard.readText();
        if (!text || !text.trim()) {
          alert(
            'Your clipboard is empty. Copy the Markdown response first, then click Paste Clipboard Reply.'
          );
          return;
        }
        if (window.electronAPI.completeWebTaskWithReply) {
          await window.electronAPI.completeWebTaskWithReply(task.id, text);
        }
        const tasks = await window.electronAPI.getAgentTasks();
        setAgentTasks(tasks);
      } catch (err) {
        console.error('Failed to paste reply:', err);
      }
    },
    [runningPipelineId, waitingForStepApproval, setAgentTasks]
  );

  const handleCancelTask = useCallback(
    async (taskId: string) => {
      isPipelineCancelledRef.current = true;
      setRunningPipelineId(null);
      setRunningPipelineStepIdx(-1);
      if (proceedNextStepResolverRef.current) {
        proceedNextStepResolverRef.current();
      }
      setWaitingForStepApproval(null);
      try {
        await window.electronAPI.cancelAgentTask(taskId);
        const tasks = await window.electronAPI.getAgentTasks();
        setAgentTasks(tasks);
      } catch (err) {
        console.error('Failed to cancel task:', err);
      }
    },
    [
      setRunningPipelineId,
      setRunningPipelineStepIdx,
      setWaitingForStepApproval,
      setAgentTasks,
    ]
  );

  const handleClearFinished = useCallback(async () => {
    if (runningPipelineId) return;
    try {
      const remaining = await window.electronAPI.clearAgentTasks();
      setAgentTasks(remaining);
    } catch (err) {
      console.error('Failed to clear finished tasks:', err);
    }
  }, [runningPipelineId, setAgentTasks]);

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      if (runningPipelineId) return;
      try {
        if (window.electronAPI.deleteAgentTask) {
          const remaining = await window.electronAPI.deleteAgentTask(taskId);
          setAgentTasks(remaining);
        } else {
          setAgentTasks(agentTasks.filter((t) => t.id !== taskId));
        }
        if (selectedTaskId === taskId) setSelectedTaskId(null);
      } catch (err) {
        console.error('Failed to delete task:', err);
      }
    },
    [runningPipelineId, setAgentTasks, agentTasks, selectedTaskId]
  );

  const handleClearTaskLogs = useCallback(
    async (taskId: string) => {
      if (runningPipelineId) return;
      try {
        if (window.electronAPI.clearAgentTaskLogs) {
          await window.electronAPI.clearAgentTaskLogs(taskId);
        }
        const tasks = await window.electronAPI.getAgentTasks();
        setAgentTasks(tasks);
      } catch (err) {
        console.error('Failed to clear task logs:', err);
      }
    },
    [runningPipelineId, setAgentTasks]
  );

  return {
    agentProfiles,
    visibleAgents,
    agentsById,
    agentTasks,
    tasksById,
    agentCheckpoints,
    checkpointsById,
    activeTab,
    activeProject,
    pipelines,
    runningPipelineId,
    runningPipelineStepIdx,
    waitingForStepApproval,
    assignedReportDoc,
    lifecycleStage,
    setLifecycleStage,
    setShowAgentAccountsModal,
    setShowCouncilModal,
    openDispatchModal,
    ...workspace,
    ...pipelineRunner,
    selectedAgentId,
    setSelectedAgentId,
    selectedIntent,
    setSelectedIntent,
    selectedTask,
    setSelectedTaskId,
    refreshing,
    submitting,
    restoringCheckpointId,
    workflowExecutionMode,
    handleSetWorkflowExecutionMode,
    handleProceedNextWorkflowStep: proceedNextWorkflowStep,
    completedPipelineSummary,
    effectiveReportMarkdown,
    handleLaunchDedicatedPipeline,
    handleSendBackToDebate,
    handleAuditDeliverablesInDebate,
    handleRollupToMaster,
    handleUpdatePipelineStep,
    handleAddPipelineStep,
    handleClearStepDoneStatus,
    handleRemovePipelineStep,
    handleResetPipelines,
    cancelActivePipelineRun,
    handleRefreshAll,
    handleSendInAppChatTask,
    handleRelayToNextAgent,
    handlePasteExternalReply,
    handleRestoreCheckpoint,
    handleCancelTask,
    handleClearFinished,
    handleDeleteTask,
    handleClearTaskLogs,
  };
}
