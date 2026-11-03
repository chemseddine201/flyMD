import {
  AgentTaskIntent,
  AgentTaskRecord,
  AgentId,
  AgentEffortLevel,
  AgentPipelinePreset,
  AgentPipelineStep,
  CustomPipelineAction,
} from '../../../shared/types';
import { usePreviewStore } from '../store';
import { selectTasksById } from '../store/selectors/agentSelectors';
import { composeSmartDeliverableName } from '../utils/smartNaming';

export interface RecoveryModalDecision {
  action: 'continue_from_breakpoint' | 'revert_and_retry' | 'pause';
  overrideAgentId?: AgentId;
  overrideModelId?: string;
  overrideEffortLevel?: AgentEffortLevel;
  overrideThinkingEnabled?: boolean;
  extraDirective?: string;
}

/**
 * Module-level pipeline runtime controller so `viewMode` / tab switches never
 * orphan an active pipeline execution loop.
 */
export const globalPipelineRuntime: {
  cancelled: boolean;
  proceedResolver: (() => void) | null;
  recoveryResolver: ((decision: RecoveryModalDecision) => void) | null;
} = {
  cancelled: false,
  proceedResolver: null,
  recoveryResolver: null,
};

export const isPipelineCancelledRef = {
  get current() {
    return globalPipelineRuntime.cancelled;
  },
  set current(val: boolean) {
    globalPipelineRuntime.cancelled = val;
  },
};

export const proceedNextStepResolverRef = {
  get current() {
    return globalPipelineRuntime.proceedResolver;
  },
  set current(val: (() => void) | null) {
    globalPipelineRuntime.proceedResolver = val;
  },
};

export function proceedNextWorkflowStep(): void {
  if (proceedNextStepResolverRef.current) {
    const resolve = proceedNextStepResolverRef.current;
    proceedNextStepResolverRef.current = null;
    resolve();
  }
}

export async function cancelActivePipelineExecution(
  targetPipelineId?: string,
  onClearRecoveryPrompt?: () => void
): Promise<void> {
  const storeState = usePreviewStore.getState();
  const activePipeId = targetPipelineId || storeState.runningPipelineId;
  isPipelineCancelledRef.current = true;
  storeState.setRunningPipelineId(null);
  storeState.setRunningPipelineStepIdx(-1);
  storeState.setWaitingForStepApproval(null);
  onClearRecoveryPrompt?.();

  if (proceedNextStepResolverRef.current) {
    const r = proceedNextStepResolverRef.current;
    proceedNextStepResolverRef.current = null;
    r();
  }
  if (globalPipelineRuntime.recoveryResolver) {
    const rr = globalPipelineRuntime.recoveryResolver;
    globalPipelineRuntime.recoveryResolver = null;
    rr({ action: 'pause' });
  }
  if (activePipeId) {
    storeState.setPipelines((prev) =>
      prev.map((p) =>
        p.id !== activePipeId
          ? p
          : {
              ...p,
              steps: p.steps.map((s) =>
                s.status === 'running' ? { ...s, status: 'pending' as const } : s
              ),
            }
      )
    );
    const runningTasks = storeState.agentTasks.filter(
      (t) => t.status === 'running' && t.pipelineId === activePipeId
    );
    for (const rt of runningTasks) {
      try {
        await window.electronAPI.cancelAgentTask(rt.id);
      } catch {}
    }
    if (runningTasks.length > 0) {
      try {
        const updated = await window.electronAPI.getAgentTasks();
        storeState.setAgentTasks(updated);
      } catch {}
    }
  }
}

export interface BuildPipelineStepPromptParams {
  pipeline: AgentPipelinePreset;
  stepIdx: number;
  currentStep: AgentPipelineStep;
  previousTask: AgentTaskRecord | null;
  assignedPipelineName?: string | null;
  customAction?: CustomPipelineAction | null;
  priorTask?: AgentTaskRecord | null;
  recoveryMode?: 'continue_from_breakpoint' | 'revert_and_retry';
  extraDirective?: string;
}

export function buildPipelineStepPrompt(params: BuildPipelineStepPromptParams): {
  promptText: string;
  combinedStepNote: string;
} {
  const {
    pipeline,
    stepIdx,
    currentStep,
    previousTask,
    assignedPipelineName,
    customAction,
    priorTask,
    recoveryMode,
    extraDirective,
  } = params;

  const stepContextTag = assignedPipelineName
    ? ` | Contract: "${assignedPipelineName}"`
    : '';

  let promptText = `Pipeline [${pipeline.name}] — Step ${stepIdx + 1}/${
    pipeline.steps.length
  } (${currentStep.label})${
    previousTask ? ` relayed from @${previousTask.targetAgentId}` : ''
  }${stepContextTag}`;

  if (customAction?.promptTemplate) {
    promptText = `${promptText}\n\n[Action Directive]: ${customAction.promptTemplate}`;
  }

  if (
    priorTask?.verificationReport &&
    !priorTask.verificationReport.passed &&
    priorTask.verificationReport.gaps.length > 0
  ) {
    const gapLines = priorTask.verificationReport.gaps
      .map((g) => `- ${g}`)
      .join('\n');
    promptText = `[REQUIRED FIXES FROM PREVIOUS VERIFICATION]:\nThe previous run left the deliverable incomplete with the following missing items/stubs:\n${gapLines}\nYou MUST create and write real, working code for these files in the workspace.\n\n${promptText}`;
  }

  if (recoveryMode === 'continue_from_breakpoint') {
    promptText = `[BREAKPOINT CONTINUATION MODE]: Continue from the last breakpoint where the previous run stopped. Keep all valid files already written in the workspace, complete any unfinished or missing files, and verify all deliverables.\n\n${promptText}`;
  } else if (recoveryMode === 'revert_and_retry') {
    promptText = `[CLEAN RETRY AFTER CHECKPOINT ROLLBACK]: Modified files from the interrupted run were reverted to the pre-task safety checkpoint. Execute this step cleanly and write each deliverable file incrementally.\n\n${promptText}`;
  }

  const combinedStepNote = [currentStep.stepNote, extraDirective]
    .filter(Boolean)
    .join('\n');

  if (combinedStepNote) {
    promptText = `[STEP ${stepIdx + 1} DIRECTIVE / ERROR REPORT]:\n${combinedStepNote}\n\n${promptText}`;
  }

  return { promptText, combinedStepNote };
}

export function buildStandaloneRecoveryPrompt(
  failedTask: AgentTaskRecord,
  mode: 'continue_from_breakpoint' | 'revert_and_retry',
  extraDirective?: string
): string {
  const basePrompt =
    failedTask.customPrompt ||
    `Execute ${failedTask.intent} on ${failedTask.fileName}`;
  const recoveryPrefix =
    mode === 'continue_from_breakpoint'
      ? `[BREAKPOINT CONTINUATION MODE]: Continue from the last breakpoint where the previous task stopped. Keep all valid files already written in the workspace, complete any unfinished or missing files, and verify all deliverables.`
      : `[CLEAN RETRY AFTER CHECKPOINT ROLLBACK]: Modified files from the interrupted run were reverted to the pre-task safety checkpoint. Execute this task cleanly and write each deliverable file incrementally.`;

  return [
    recoveryPrefix,
    extraDirective ? `[RECOVERY DIRECTIVE]: ${extraDirective}` : '',
    basePrompt,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export async function resolveUpstreamPlanFromDisk(
  previousTask: AgentTaskRecord | null,
  resolvedWorkspace: string,
  initialDocName: string,
  isFirstStep: boolean,
  namingContext?: {
    projectName?: string | null;
    promptText?: string | null;
    intent?: string;
  }
): Promise<{
  upstreamPlanMarkdown: string | undefined;
  resolvedPlanFilePath: string | undefined;
  resolvedPlanFileName: string;
}> {
  let upstreamPlanMarkdown = previousTask?.responseMarkdown;
  let resolvedPlanFilePath = previousTask?.filePath;
  let resolvedPlanFileName = previousTask?.fileName || initialDocName;

  if (!isFirstStep && previousTask && resolvedWorkspace) {
    const sep = resolvedWorkspace.includes('\\') ? '\\' : '/';
    const checkedMdFile =
      previousTask.verificationReport?.checkedFiles?.find((f) =>
        f.toLowerCase().endsWith('.md')
      );
    const smartCandidateName = composeSmartDeliverableName({
      projectName: namingContext?.projectName,
      topicOrPrompt: namingContext?.promptText || previousTask.customPrompt,
      intentOrKind: namingContext?.intent || 'plan',
      fallbackName: 'IMPLEMENTATION_PLAN.md',
    });
    const candidateMdNames = [
      checkedMdFile,
      previousTask.fileName?.toLowerCase().endsWith('.md')
        ? previousTask.fileName
        : undefined,
      smartCandidateName,
      initialDocName,
      'IMPLEMENTATION_PLAN.md',
    ].filter(Boolean) as string[];

    for (const mdName of candidateMdNames) {
      const candidatePath =
        mdName.includes('/') || mdName.includes('\\')
          ? mdName
          : `${resolvedWorkspace}${sep}${mdName}`;
      try {
        const diskRes = await window.electronAPI.readFile(candidatePath);
        if (
          diskRes &&
          typeof diskRes.content === 'string' &&
          diskRes.content.trim().length >= 150
        ) {
          upstreamPlanMarkdown = diskRes.content;
          resolvedPlanFilePath = diskRes.path || candidatePath;
          resolvedPlanFileName =
            diskRes.name || mdName.split(/[\\/]/).pop() || initialDocName;
          break;
        }
      } catch {}
    }
  }

  return {
    upstreamPlanMarkdown,
    resolvedPlanFilePath,
    resolvedPlanFileName,
  };
}

/**
 * Epistemic Handoff Composer: combines original contract with upstream output according to epistemic mode.
 * - In blind audit/adversarial verification (`review` / `fix-bugs`), withholds subjective upstream prose to avoid confirmation bias.
 * - In plan -> build, passes full implementation plan without loss.
 * - In collaborative steps, passes compact high-signal delta.
 */
export function composeEpistemicStepPayload(
  originalContract: string,
  upstreamOutput: string | undefined,
  targetIntent: AgentTaskIntent,
  isFirstStep: boolean,
  upstreamAgentId?: string,
  upstreamIntent?: AgentTaskIntent
): string {
  const cleanContract = (originalContract || '').trim();
  const cleanUpstream = (upstreamOutput || '').trim();

  if (isFirstStep || !cleanUpstream) {
    return cleanContract || cleanUpstream;
  }

  // Blind Audit / Ground-Truth Rebuild: withhold upstream subjective prose summary
  if (targetIntent === 'review' || targetIntent === 'fix-bugs') {
    return cleanContract || cleanUpstream;
  }

  // Plan -> Build Handoff: pass the complete implementation plan without truncation
  if (upstreamIntent === 'refine-plan' || targetIntent === 'build') {
    if (!cleanContract || cleanUpstream.length >= cleanContract.length * 0.7) {
      return cleanUpstream;
    }
    return `${cleanUpstream}\n\n---\n\n## Original Reference Contract\n${cleanContract}`;
  }

  // Collaborative Inheritance (`write-tests`, `explain`, etc.):
  const highSignalLines = cleanUpstream
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.startsWith('- [ ]') ||
        l.startsWith('* [ ]') ||
        l.startsWith('@') ||
        l.startsWith('- @') ||
        l.startsWith('### ') ||
        l.includes('Invariant') ||
        l.includes('Contract') ||
        l.includes('<independent_resume>')
    )
    .slice(0, 40);

  const compactDelta =
    highSignalLines.length >= 3
      ? highSignalLines.join('\n')
      : cleanUpstream.slice(0, 3200);

  if (!cleanContract) {
    return compactDelta;
  }

  return `${cleanContract}\n\n---\n\n## Upstream Compact Delta (from @${
    upstreamAgentId || 'previous-agent'
  })\n${compactDelta}`;
}

/**
 * Reliably awaits task reaching a terminal state (completed, incomplete, cancelled, failed)
 * using a reactive memory subscription on the Zustand store, backed by a low-frequency 3s watchdog.
 */
export function waitForTaskFinished(
  taskId: string,
  isCancelledRef: { current: boolean }
): Promise<AgentTaskRecord | null> {
  return new Promise((resolve) => {
    const isTerminal = (t?: AgentTaskRecord | null) =>
      t &&
      (t.status === 'completed' ||
        t.status === 'incomplete' ||
        t.status === 'cancelled' ||
        t.status === 'failed');

    const initial = selectTasksById(usePreviewStore.getState()).get(taskId);
    if (isTerminal(initial)) {
      resolve(initial!);
      return;
    }

    let resolved = false;
    let fallbackTimer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      resolved = true;
      unsubscribe();
      if (fallbackTimer) clearInterval(fallbackTimer);
    };

    // 1. Reactive memory subscription on store mutation (O(1) lookup via memoized Map)
    const unsubscribe = usePreviewStore.subscribe((state) => {
      if (resolved) return;
      if (isCancelledRef.current) {
        cleanup();
        resolve(null);
        return;
      }
      const found = selectTasksById(state).get(taskId);
      if (isTerminal(found)) {
        cleanup();
        resolve(found!);
      }
    });

    // 2. Low-frequency safety watchdog (every 3000ms instead of 750ms)
    fallbackTimer = setInterval(async () => {
      if (resolved || isCancelledRef.current) {
        cleanup();
        resolve(null);
        return;
      }
      try {
        const tasks = await window.electronAPI.getAgentTasks?.();
        if (tasks && Array.isArray(tasks)) {
          usePreviewStore.getState().setAgentTasks(tasks);
          const found = selectTasksById(usePreviewStore.getState()).get(taskId);
          if (isTerminal(found)) {
            cleanup();
            resolve(found!);
          }
        }
      } catch {}
    }, 3000);
  });
}
