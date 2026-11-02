import { useCallback, useState } from 'react';
import {
  usePreviewStore,
  selectAgentsById,
  selectTasksById,
  AssignedReportDocState,
} from '../../../store';
import {
  AgentId,
  AgentPipelinePreset,
  AgentTaskIntent,
  AgentTaskRecord,
  AgentEffortLevel,
  CustomPipelineAction,
  TabItem,
} from '../../../../../shared/types';
import {
  RecoveryModalDecision,
  globalPipelineRuntime,
  isPipelineCancelledRef,
  proceedNextStepResolverRef,
  buildPipelineStepPrompt,
  buildStandaloneRecoveryPrompt,
  resolveUpstreamPlanFromDisk,
  composeEpistemicStepPayload,
  waitForTaskFinished,
} from '../../../services/pipelineExecutionService';
import { composeSmartDeliverableName } from '../../../utils/smartNaming';
import { PendingRecoveryPromptData } from '../modals/PipelineRecoveryModal';
import { CompletedPipelineSummary } from './PipelineStatusBanners';

function updatePipelineStepInStore(
  pipelineId: string,
  stepIdx: number,
  patch: Record<string, unknown>
): void {
  usePreviewStore.getState().setPipelines((prev) =>
    prev.map((p) => {
      if (p.id !== pipelineId) return p;
      const steps = p.steps.map((s, sIdx) =>
        sIdx === stepIdx ? { ...s, ...patch } : s
      );
      return { ...p, steps };
    })
  );
}

export interface DispatchChatTaskFn {
  (
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
    }
  ): Promise<AgentTaskRecord | null>;
}

export interface UsePipelineRunnerAndRecoveryParams {
  resolvedWorkspace: string;
  activeTab?: TabItem;
  assignedReportDoc: AssignedReportDocState | null;
  workflowExecutionMode: 'auto' | 'manual';
  agentTasks: AgentTaskRecord[];
  tasksById: Map<string, AgentTaskRecord>;
  selectedTask: AgentTaskRecord | null;
  setSelectedAgentId: (id: AgentId) => void;
  setSelectedIntent: (intent: AgentTaskIntent) => void;
  setSelectedTaskId: (id: string | null) => void;
  setCompletedPipelineSummary: (val: CompletedPipelineSummary | null) => void;
  pendingRecoveryPrompt: PendingRecoveryPromptData | null;
  setPendingRecoveryPrompt: (val: PendingRecoveryPromptData | null) => void;
  resolveCustomAction: (actionId?: string) => CustomPipelineAction | null;
  handleRestoreCheckpoint: (checkpointId: string) => Promise<void>;
  handleSendInAppChatTask: DispatchChatTaskFn;
}

export function usePipelineRunnerAndRecovery({
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
}: UsePipelineRunnerAndRecoveryParams) {
  const [recoveryAgentId, setRecoveryAgentId] = useState<AgentId>('');
  const [recoveryEffortLevel, setRecoveryEffortLevel] =
    useState<AgentEffortLevel>('medium');
  const [recoveryThinkingEnabled, setRecoveryThinkingEnabled] =
    useState<boolean>(true);
  const [recoveryExtraDirective, setRecoveryExtraDirective] =
    useState<string>('');

  const handleRunPipelineInStudio = useCallback(
    async (
      pipeline: AgentPipelinePreset,
      initialRecovery?: {
        stepIdx: number;
        mode: 'continue_from_breakpoint' | 'revert_and_retry';
        failedTask: AgentTaskRecord;
        overrideAgentId?: AgentId;
        overrideEffortLevel?: AgentEffortLevel;
        overrideThinkingEnabled?: boolean;
        extraDirective?: string;
      }
    ) => {
      const store = usePreviewStore.getState();
      if (!pipeline.steps.length || store.runningPipelineId) return;

      const firstPendingIdx =
        initialRecovery?.stepIdx !== undefined && initialRecovery.stepIdx >= 0
          ? initialRecovery.stepIdx
          : pipeline.steps.findIndex((s) => s.status !== 'completed');
      if (firstPendingIdx === -1) return;

      store.setRunningPipelineId(pipeline.id);
      isPipelineCancelledRef.current = false;

      try {
        let previousTask: AgentTaskRecord | null = null;
        if (firstPendingIdx > 0) {
          const prevCompletedStep = pipeline.steps[firstPendingIdx - 1];
          if (prevCompletedStep?.completedTaskId) {
            previousTask =
              selectTasksById(usePreviewStore.getState()).get(
                prevCompletedStep.completedTaskId
              ) || null;
          }
        }

        for (let idx = firstPendingIdx; idx < pipeline.steps.length; idx++) {
          if (isPipelineCancelledRef.current) break;

          let activeRecoveryForStep =
            initialRecovery && initialRecovery.stepIdx === idx
              ? {
                  mode: initialRecovery.mode,
                  failedTask: initialRecovery.failedTask,
                  overrideAgentId: initialRecovery.overrideAgentId,
                  overrideEffortLevel: initialRecovery.overrideEffortLevel,
                  overrideThinkingEnabled:
                    initialRecovery.overrideThinkingEnabled,
                  extraDirective: initialRecovery.extraDirective,
                }
              : null;

          let stepSucceeded = false;

          while (!isPipelineCancelledRef.current) {
            if (
              activeRecoveryForStep?.mode === 'revert_and_retry' &&
              activeRecoveryForStep.failedTask?.checkpointId
            ) {
              await handleRestoreCheckpoint(
                activeRecoveryForStep.failedTask.checkpointId
              );
            }

            if (
              activeRecoveryForStep?.overrideAgentId ||
              activeRecoveryForStep?.overrideEffortLevel ||
              activeRecoveryForStep?.overrideThinkingEnabled !== undefined
            ) {
              updatePipelineStepInStore(pipeline.id, idx, {
                ...(activeRecoveryForStep.overrideAgentId
                  ? { agentId: activeRecoveryForStep.overrideAgentId }
                  : {}),
                ...(activeRecoveryForStep.overrideEffortLevel
                  ? { effortLevel: activeRecoveryForStep.overrideEffortLevel }
                  : {}),
                ...(activeRecoveryForStep.overrideThinkingEnabled !== undefined
                  ? {
                      thinkingEnabled:
                        activeRecoveryForStep.overrideThinkingEnabled,
                    }
                  : {}),
              });
            }

            const latestPipelines = usePreviewStore.getState().pipelines;
            const livePipeline =
              latestPipelines.find((p) => p.id === pipeline.id) || pipeline;
            const currentStep = livePipeline.steps[idx] || pipeline.steps[idx];
            const nextStep =
              livePipeline.steps[idx + 1] || pipeline.steps[idx + 1];

            const effectiveStepAgentId =
              activeRecoveryForStep?.overrideAgentId || currentStep.agentId;

            usePreviewStore.getState().setRunningPipelineStepIdx(idx);
            setSelectedAgentId(effectiveStepAgentId);
            setSelectedIntent(currentStep.intent);
            updatePipelineStepInStore(pipeline.id, idx, { status: 'running' });

            const isFirstStep = idx === 0;
            const currentAssignedReport =
              usePreviewStore.getState().assignedReportDoc || assignedReportDoc;
            const assignedReport =
              currentAssignedReport?.pipelineId === pipeline.id ||
              currentAssignedReport
                ? currentAssignedReport
                : null;

            const activeProject = usePreviewStore.getState().activeProject;
            const initialDocContent =
              assignedReport?.reportMarkdown || activeTab?.content || '';
            const initialDocName = assignedReport
              ? composeSmartDeliverableName({
                  projectName: activeProject?.name,
                  topicOrPrompt: assignedReport.pipelineName,
                  intentOrKind: 'contract',
                  fallbackName: `${assignedReport.pipelineName.replace(
                    /[^a-zA-Z0-9_\-\u0600-\u06FF]/g,
                    '_'
                  )}_Contract.md`,
                })
              : activeTab?.fileName ||
                composeSmartDeliverableName({
                  projectName: activeProject?.name,
                  topicOrPrompt: pipeline.name,
                  intentOrKind: currentStep.intent || 'plan',
                  fallbackName: 'IMPLEMENTATION_PLAN.md',
                });

            const customAct = resolveCustomAction(currentStep.customActionId);
            const priorTask =
              activeRecoveryForStep?.failedTask ||
              (currentStep.completedTaskId
                ? selectTasksById(usePreviewStore.getState()).get(
                    currentStep.completedTaskId
                  )
                : undefined);

            const { promptText, combinedStepNote } = buildPipelineStepPrompt({
              pipeline,
              stepIdx: idx,
              currentStep,
              previousTask,
              assignedPipelineName: assignedReport?.pipelineName,
              customAction: customAct,
              priorTask,
              recoveryMode: activeRecoveryForStep?.mode,
              extraDirective: activeRecoveryForStep?.extraDirective,
            });

            const effectivePolicy =
              customAct?.epistemicPolicy ||
              (currentStep.intent === 'review' ||
              currentStep.intent === 'fix-bugs'
                ? 'independent-audit'
                : 'collaborative');

            const {
              upstreamPlanMarkdown,
              resolvedPlanFilePath,
              resolvedPlanFileName,
            } = await resolveUpstreamPlanFromDisk(
              previousTask,
              resolvedWorkspace,
              initialDocName,
              isFirstStep,
              {
                projectName: activeProject?.name,
                promptText,
                intent: currentStep.intent,
              }
            );

            const stepMarkdownContent = composeEpistemicStepPayload(
              initialDocContent,
              upstreamPlanMarkdown,
              currentStep.intent,
              isFirstStep,
              previousTask?.targetAgentId,
              previousTask?.intent as AgentTaskIntent | undefined
            );

            const isBreakpointResume =
              activeRecoveryForStep?.mode === 'continue_from_breakpoint';
            const nextAttemptCount = priorTask
              ? (priorTask.attemptCount || 0) + 1
              : 0;

            const dispatchedTask = await handleSendInAppChatTask(promptText, {
              agentId: effectiveStepAgentId,
              intent: currentStep.intent,
              modelId: currentStep.modelId,
              effortLevel:
                activeRecoveryForStep?.overrideEffortLevel ||
                currentStep.effortLevel ||
                'medium',
              thinkingEnabled:
                activeRecoveryForStep?.overrideThinkingEnabled ??
                currentStep.thinkingEnabled ??
                true,
              filePath: isFirstStep
                ? activeTab?.filePath || previousTask?.filePath
                : resolvedPlanFilePath ||
                  previousTask?.outputReportPath ||
                  activeTab?.filePath,
              fileName: isFirstStep ? initialDocName : resolvedPlanFileName,
              markdownContent: stepMarkdownContent,
              sourceAgentId: previousTask?.targetAgentId,
              pipelineId: pipeline.id,
              nextAgentInChain: nextStep?.agentId,
              nextIntentInChain: nextStep?.intent,
              epistemicPolicy: effectivePolicy,
              customActionLabel: customAct?.name,
              stepNote: combinedStepNote || undefined,
              attemptCount: nextAttemptCount,
              resumeFromBreakpoint: isBreakpointResume,
              previousFailedTaskId: priorTask?.id,
              resumeSessionId: isBreakpointResume
                ? priorTask?.cliSessionId ||
                  priorTask?.errorDiagnostic?.cliSessionId
                : undefined,
            });

            if (!dispatchedTask?.id) {
              console.error(`Pipeline step ${idx + 1} failed to dispatch.`);
              updatePipelineStepInStore(pipeline.id, idx, { status: 'failed' });
              break;
            }

            updatePipelineStepInStore(pipeline.id, idx, {
              status: 'running',
              completedTaskId: dispatchedTask.id,
            });

            try {
              localStorage.setItem(
                'flymd:active-pipeline-run',
                JSON.stringify({
                  pipelineId: pipeline.id,
                  pipelineName: pipeline.name,
                  stepIdx: idx,
                  totalSteps: pipeline.steps.length,
                  currentTaskId: dispatchedTask.id,
                })
              );
            } catch {}

            const completed = await waitForTaskFinished(
              dispatchedTask.id,
              isPipelineCancelledRef
            );
            if (isPipelineCancelledRef.current || !completed) break;

            if (completed.tokenUsage) {
              usePreviewStore.getState().recordTokenUsage(completed.tokenUsage);
            }

            if (completed.status === 'completed') {
              updatePipelineStepInStore(pipeline.id, idx, {
                status: 'completed',
                completedTaskId: completed.id,
                completedAt: Date.now(),
              });
              previousTask = completed;
              stepSucceeded = true;
              break;
            }

            const terminalStatus =
              completed.status === 'incomplete'
                ? 'incomplete'
                : completed.status === 'failed'
                ? 'failed'
                : 'pending';

            updatePipelineStepInStore(pipeline.id, idx, {
              status: terminalStatus,
              completedTaskId: completed.id,
            });

            if (completed.status === 'cancelled') break;

            setRecoveryAgentId(effectiveStepAgentId);
            setRecoveryEffortLevel(
              (completed.effortLevel as AgentEffortLevel) ||
                currentStep.effortLevel ||
                'medium'
            );
            setRecoveryThinkingEnabled(
              completed.thinkingEnabled ?? currentStep.thinkingEnabled ?? true
            );
            setRecoveryExtraDirective('');
            setPendingRecoveryPrompt({
              failedTask: completed,
              pipeline: livePipeline,
              stepIdx: idx,
              stepLabel: currentStep.label,
              isLivePipelinePause: true,
            });

            const userDecision = await new Promise<RecoveryModalDecision>(
              (resolve) => {
                globalPipelineRuntime.recoveryResolver = resolve;
              }
            );

            setPendingRecoveryPrompt(null);
            globalPipelineRuntime.recoveryResolver = null;

            if (
              isPipelineCancelledRef.current ||
              userDecision.action === 'pause'
            ) {
              break;
            }

            activeRecoveryForStep = {
              mode: userDecision.action,
              failedTask: completed,
              overrideAgentId: userDecision.overrideAgentId,
              overrideEffortLevel: userDecision.overrideEffortLevel,
              overrideThinkingEnabled: userDecision.overrideThinkingEnabled,
              extraDirective: userDecision.extraDirective,
            };
          }

          if (!stepSucceeded || isPipelineCancelledRef.current) break;

          const latestPipelinesAfterStep = usePreviewStore.getState().pipelines;
          const livePipeAfter =
            latestPipelinesAfterStep.find((p) => p.id === pipeline.id) ||
            pipeline;
          const nextStepAfter =
            livePipeAfter.steps[idx + 1] || pipeline.steps[idx + 1];

          const quotaStatus = usePreviewStore.getState().getQuotaStatus();
          const quotaCfg = usePreviewStore.getState().tokenQuotaConfig;
          const quotaBreached = quotaCfg.enabled && quotaStatus.isBreached;
          const shouldPauseForQuota =
            quotaBreached && quotaCfg.breachAction === 'pause_at_boundary';

          if (
            idx + 1 < pipeline.steps.length &&
            (workflowExecutionMode === 'manual' || shouldPauseForQuota) &&
            previousTask
          ) {
            const nextAgent = nextStepAfter?.agentId
              ? selectAgentsById(usePreviewStore.getState()).get(
                  nextStepAfter.agentId
                )
              : undefined;
            const touchedFiles = (previousTask.toolActions || []).filter(
              (a) =>
                a.kind === 'write' || a.label.toLowerCase().includes('file')
            ).length;

            usePreviewStore.getState().setWaitingForStepApproval({
              completedStepIdx: idx,
              nextStepIdx: idx + 1,
              nextAgentName: nextAgent?.name || nextStepAfter?.agentId || 'Agent',
              nextIntent: nextStepAfter?.intent || 'next step',
              completedTaskId: previousTask.id,
              filesCreatedCount: touchedFiles,
              quotaBreached,
            });

            await new Promise<void>((resolve) => {
              proceedNextStepResolverRef.current = resolve;
            });

            usePreviewStore.getState().setWaitingForStepApproval(null);
            if (isPipelineCancelledRef.current) break;
          }
        }

        const finalPipe =
          usePreviewStore
            .getState()
            .pipelines.find((p) => p.id === pipeline.id) || pipeline;
        const allCompleted =
          finalPipe.steps.length > 0 &&
          finalPipe.steps.every((s) => s.status === 'completed');

        if (!isPipelineCancelledRef.current && allCompleted && previousTask) {
          setCompletedPipelineSummary({
            pipelineName: pipeline.name,
            stepsCount: pipeline.steps.length,
            filesCreated: (previousTask.toolActions || []).filter(
              (a) =>
                a.kind === 'write' || a.label.toLowerCase().includes('file')
            ).length,
            lastTaskOutput: previousTask.responseMarkdown,
          });
        }
      } finally {
        usePreviewStore.getState().setRunningPipelineId(null);
        usePreviewStore.getState().setRunningPipelineStepIdx(-1);
        usePreviewStore.getState().setWaitingForStepApproval(null);
        proceedNextStepResolverRef.current = null;
        try {
          localStorage.removeItem('flymd:active-pipeline-run');
        } catch {}
      }
    },
    [
      handleRestoreCheckpoint,
      setSelectedAgentId,
      setSelectedIntent,
      assignedReportDoc,
      activeTab,
      resolveCustomAction,
      resolvedWorkspace,
      handleSendInAppChatTask,
      setPendingRecoveryPrompt,
      workflowExecutionMode,
      setCompletedPipelineSummary,
    ]
  );

  const executeRecoveryDecision = useCallback(
    async (
      failedTask: AgentTaskRecord,
      mode: 'continue_from_breakpoint' | 'revert_and_retry',
      pipeline?: AgentPipelinePreset,
      stepIdx?: number,
      overrideAgentId?: AgentId,
      extraDirective?: string,
      overrideEffortLevel?: AgentEffortLevel,
      overrideThinkingEnabled?: boolean
    ) => {
      if (globalPipelineRuntime.recoveryResolver) {
        const resolve = globalPipelineRuntime.recoveryResolver;
        globalPipelineRuntime.recoveryResolver = null;
        setPendingRecoveryPrompt(null);
        resolve({
          action: mode,
          overrideAgentId,
          overrideEffortLevel,
          overrideThinkingEnabled,
          extraDirective,
        });
        return;
      }

      setPendingRecoveryPrompt(null);

      const storePipelines = usePreviewStore.getState().pipelines;
      const matchedPipeline =
        pipeline ||
        storePipelines.find(
          (p) =>
            p.id === failedTask.pipelineId ||
            p.steps.some((s) => s.completedTaskId === failedTask.id)
        );
      let matchedStepIdx =
        stepIdx !== undefined && stepIdx >= 0
          ? stepIdx
          : matchedPipeline
          ? matchedPipeline.steps.findIndex(
              (s) => s.completedTaskId === failedTask.id
            )
          : -1;
      if (matchedPipeline && matchedStepIdx === -1) {
        matchedStepIdx = matchedPipeline.steps.findIndex(
          (s) =>
            (s.status === 'incomplete' || s.status === 'failed') &&
            s.intent === failedTask.intent
        );
      }

      if (matchedPipeline && matchedStepIdx >= 0) {
        await handleRunPipelineInStudio(matchedPipeline, {
          stepIdx: matchedStepIdx,
          mode,
          failedTask,
          overrideAgentId,
          overrideEffortLevel,
          overrideThinkingEnabled,
          extraDirective,
        });
        return;
      }

      if (mode === 'revert_and_retry' && failedTask.checkpointId) {
        await handleRestoreCheckpoint(failedTask.checkpointId);
      }

      const targetAg = overrideAgentId || failedTask.targetAgentId;
      setSelectedAgentId(targetAg);
      setSelectedIntent(failedTask.intent);

      const fullPrompt = buildStandaloneRecoveryPrompt(
        failedTask,
        mode,
        extraDirective
      );

      await handleSendInAppChatTask(fullPrompt, {
        agentId: targetAg,
        intent: failedTask.intent,
        filePath: failedTask.filePath,
        fileName: failedTask.fileName,
        attemptCount: (failedTask.attemptCount || 0) + 1,
        resumeFromBreakpoint: mode === 'continue_from_breakpoint',
        previousFailedTaskId: failedTask.id,
        effortLevel:
          overrideEffortLevel ||
          (failedTask.effortLevel as AgentEffortLevel) ||
          'medium',
        thinkingEnabled:
          overrideThinkingEnabled ?? failedTask.thinkingEnabled ?? true,
        resumeSessionId:
          mode === 'continue_from_breakpoint'
            ? failedTask.cliSessionId ||
              failedTask.errorDiagnostic?.cliSessionId
            : undefined,
      });
    },
    [
      setPendingRecoveryPrompt,
      handleRunPipelineInStudio,
      handleRestoreCheckpoint,
      setSelectedAgentId,
      setSelectedIntent,
      handleSendInAppChatTask,
    ]
  );

  const handleRecoverTask = useCallback(
    async (
      task: AgentTaskRecord,
      mode: 'continue_from_breakpoint' | 'revert_and_retry' | 'ask'
    ) => {
      setSelectedTaskId(task.id);
      const storePipelines = usePreviewStore.getState().pipelines;
      const matchedPipeline = storePipelines.find(
        (p) =>
          p.id === task.pipelineId ||
          p.steps.some((s) => s.completedTaskId === task.id)
      );
      const matchedStepIdx = matchedPipeline
        ? matchedPipeline.steps.findIndex((s) => s.completedTaskId === task.id)
        : -1;

      if (mode === 'ask') {
        setRecoveryAgentId(task.targetAgentId);
        setRecoveryEffortLevel((task.effortLevel as AgentEffortLevel) || 'medium');
        setRecoveryThinkingEnabled(task.thinkingEnabled ?? true);
        setRecoveryExtraDirective('');
        setPendingRecoveryPrompt({
          failedTask: task,
          pipeline: matchedPipeline,
          stepIdx: matchedStepIdx >= 0 ? matchedStepIdx : undefined,
          stepLabel:
            matchedStepIdx >= 0
              ? matchedPipeline?.steps[matchedStepIdx]?.label
              : undefined,
          isLivePipelinePause: Boolean(globalPipelineRuntime.recoveryResolver),
        });
        return;
      }

      await executeRecoveryDecision(
        task,
        mode,
        matchedPipeline,
        matchedStepIdx >= 0 ? matchedStepIdx : undefined,
        undefined,
        undefined,
        (task.effortLevel as AgentEffortLevel) || 'medium',
        task.thinkingEnabled ?? true
      );
    },
    [setSelectedTaskId, setPendingRecoveryPrompt, executeRecoveryDecision]
  );

  const handleRecoverPipelineStep = useCallback(
    (
      pipeline: AgentPipelinePreset,
      stepIdx: number,
      linkedTask?: AgentTaskRecord
    ) => {
      const step = pipeline.steps[stepIdx];
      const targetTask =
        linkedTask ||
        (step?.completedTaskId ? tasksById.get(step.completedTaskId) : undefined) ||
        agentTasks.find(
          (t) =>
            (t.pipelineId === pipeline.id || t.intent === step?.intent) &&
            (t.status === 'incomplete' || t.status === 'failed')
        ) ||
        selectedTask;

      if (!targetTask) {
        handleRunPipelineInStudio(pipeline);
        return;
      }

      setSelectedTaskId(targetTask.id);
      setRecoveryAgentId(step?.agentId || targetTask.targetAgentId);
      setRecoveryEffortLevel(
        (targetTask.effortLevel as AgentEffortLevel) ||
          step?.effortLevel ||
          'medium'
      );
      setRecoveryThinkingEnabled(
        targetTask.thinkingEnabled ?? step?.thinkingEnabled ?? true
      );
      setRecoveryExtraDirective(step?.stepNote || '');
      setPendingRecoveryPrompt({
        failedTask: targetTask,
        pipeline,
        stepIdx,
        stepLabel: step?.label || `Step ${stepIdx + 1}`,
        isLivePipelinePause: Boolean(globalPipelineRuntime.recoveryResolver),
      });
    },
    [
      tasksById,
      agentTasks,
      selectedTask,
      handleRunPipelineInStudio,
      setSelectedTaskId,
      setPendingRecoveryPrompt,
    ]
  );

  const dismissOrPauseRecoveryPrompt = useCallback(() => {
    if (globalPipelineRuntime.recoveryResolver) {
      const resolve = globalPipelineRuntime.recoveryResolver;
      globalPipelineRuntime.recoveryResolver = null;
      setPendingRecoveryPrompt(null);
      resolve({ action: 'pause' });
    } else {
      setPendingRecoveryPrompt(null);
    }
  }, [setPendingRecoveryPrompt]);

  return {
    pendingRecoveryPrompt,
    recoveryAgentId,
    setRecoveryAgentId,
    recoveryEffortLevel,
    setRecoveryEffortLevel,
    recoveryThinkingEnabled,
    setRecoveryThinkingEnabled,
    recoveryExtraDirective,
    setRecoveryExtraDirective,
    handleRunPipelineInStudio,
    executeRecoveryDecision,
    handleRecoverTask,
    handleRecoverPipelineStep,
    dismissOrPauseRecoveryPrompt,
  };
}
