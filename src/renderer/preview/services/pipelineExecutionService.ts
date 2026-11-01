import { AgentTaskIntent, AgentTaskRecord, AgentId, AgentEffortLevel } from '../../../shared/types';
import { usePreviewStore } from '../store';

export interface RecoveryModalDecision {
  action: 'continue_from_breakpoint' | 'revert_and_retry' | 'pause';
  overrideAgentId?: AgentId;
  overrideEffortLevel?: AgentEffortLevel;
  overrideThinkingEnabled?: boolean;
  extraDirective?: string;
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

    const initial = usePreviewStore.getState().agentTasks.find((t) => t.id === taskId);
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

    // 1. Reactive memory subscription on store mutation
    const unsubscribe = usePreviewStore.subscribe((state) => {
      if (resolved) return;
      if (isCancelledRef.current) {
        cleanup();
        resolve(null);
        return;
      }
      const found = state.agentTasks.find((t) => t.id === taskId);
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
          const found = tasks.find((t) => t.id === taskId);
          if (isTerminal(found)) {
            cleanup();
            resolve(found!);
          }
        }
      } catch {}
    }, 3000);
  });
}

