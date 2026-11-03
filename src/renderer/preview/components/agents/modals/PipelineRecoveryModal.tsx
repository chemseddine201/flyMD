import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Clock,
  ShieldCheck,
  Brain,
  RotateCcw,
  RefreshCw,
  Play,
  Copy,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Cpu,
} from 'lucide-react';
import {
  AgentTaskRecord,
  AgentPipelinePreset,
  AgentCheckpoint,
  AgentProfile,
  AgentId,
  AgentEffortLevel,
} from '../../../../../shared/types';
import {
  fetchAndCacheAgentModels,
  getAvailableModelsForAgent,
  normalizeModelForAgent,
} from '../../../../../shared/constants/models';

export interface PendingRecoveryPromptData {
  failedTask: AgentTaskRecord;
  pipeline?: AgentPipelinePreset;
  stepIdx?: number;
  stepLabel?: string;
  isLivePipelinePause?: boolean;
}

export interface PipelineRecoveryModalProps {
  promptData: PendingRecoveryPromptData | null;
  agentCheckpoints: AgentCheckpoint[];
  visibleAgents: AgentProfile[];
  recoveryAgentId: AgentId | null;
  setRecoveryAgentId: (id: AgentId) => void;
  recoveryModelId?: string;
  setRecoveryModelId?: (modelId: string) => void;
  recoveryEffortLevel: AgentEffortLevel;
  setRecoveryEffortLevel: (lvl: AgentEffortLevel) => void;
  recoveryThinkingEnabled: boolean;
  setRecoveryThinkingEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  recoveryExtraDirective: string;
  setRecoveryExtraDirective: (directive: string) => void;
  onDismissOrPause: () => void;
  onExecuteDecision: (mode: 'continue_from_breakpoint' | 'revert_and_retry') => void;
}

export const PipelineRecoveryModal: React.FC<PipelineRecoveryModalProps> = ({
  promptData,
  agentCheckpoints,
  visibleAgents,
  recoveryAgentId,
  setRecoveryAgentId,
  recoveryModelId,
  setRecoveryModelId,
  recoveryEffortLevel,
  setRecoveryEffortLevel,
  recoveryThinkingEnabled,
  setRecoveryThinkingEnabled,
  recoveryExtraDirective,
  setRecoveryExtraDirective,
  onDismissOrPause,
  onExecuteDecision,
}) => {
  const [showStderr, setShowStderr] = useState(false);
  const [copiedLog, setCopiedLog] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchRev, setFetchRev] = useState(0);

  const activeAgentId = recoveryAgentId || promptData?.failedTask?.targetAgentId || 'antigravity';

  const availableModels = useMemo(() => {
    return getAvailableModelsForAgent(activeAgentId);
  }, [activeAgentId, fetchRev]);

  const effectiveModelId = useMemo(() => {
    return normalizeModelForAgent(
      activeAgentId,
      recoveryModelId || promptData?.failedTask?.modelId
    );
  }, [activeAgentId, recoveryModelId, promptData?.failedTask?.modelId, fetchRev]);

  const activeModelEntry = useMemo(() => {
    return (
      availableModels.find((m) => m.id.toLowerCase() === effectiveModelId.toLowerCase()) ||
      availableModels[0]
    );
  }, [availableModels, effectiveModelId]);

  const supportedEfforts: AgentEffortLevel[] = useMemo(() => {
    if (activeModelEntry?.supportedEffortLevels && activeModelEntry.supportedEffortLevels.length > 0) {
      return activeModelEntry.supportedEffortLevels;
    }
    return ['low', 'medium', 'high'];
  }, [activeModelEntry]);

  useEffect(() => {
    if (setRecoveryModelId && effectiveModelId && recoveryModelId !== effectiveModelId) {
      setRecoveryModelId(effectiveModelId);
    }
  }, [effectiveModelId]);

  useEffect(() => {
    if (supportedEfforts.length > 0 && !supportedEfforts.includes(recoveryEffortLevel)) {
      const nextEff =
        activeModelEntry?.defaultEffortLevel &&
        supportedEfforts.includes(activeModelEntry.defaultEffortLevel)
          ? activeModelEntry.defaultEffortLevel
          : supportedEfforts[supportedEfforts.length - 1];
      setRecoveryEffortLevel(nextEff);
    }
  }, [supportedEfforts, recoveryEffortLevel, activeModelEntry]);

  const handleFetchSubscriptionModels = async () => {
    if (isFetchingModels) return;
    setIsFetchingModels(true);
    try {
      const list = await fetchAndCacheAgentModels(activeAgentId);
      setFetchRev((r) => r + 1);
      if (list.length > 0 && setRecoveryModelId) {
        const currentMatch = list.find(
          (m) => m.id.toLowerCase() === effectiveModelId.toLowerCase()
        );
        const chosen = currentMatch || list[0];
        if (chosen) {
          setRecoveryModelId(chosen.id);
          if (
            chosen.supportedEffortLevels &&
            chosen.supportedEffortLevels.length > 0 &&
            !chosen.supportedEffortLevels.includes(recoveryEffortLevel)
          ) {
            setRecoveryEffortLevel(
              chosen.defaultEffortLevel || chosen.supportedEffortLevels[0]
            );
          }
        }
      }
    } finally {
      setIsFetchingModels(false);
    }
  };

  if (!promptData) return null;

  const ft = promptData.failedTask;
  const diag = ft.errorDiagnostic;
  const cp = ft.checkpointId
    ? agentCheckpoints.find((c) => c.id === ft.checkpointId)
    : undefined;

  const fallbackStderr = (ft.logs || []).filter(
    (l) =>
      l.includes('[stderr]') ||
      l.includes('[Hang Watchdog]') ||
      l.includes('[Process Error]') ||
      l.includes('[CLI Error]') ||
      l.includes('[Verification Gate]') ||
      l.toLowerCase().includes('error') ||
      l.toLowerCase().includes('exception')
  );

  const stderrLines =
    diag?.stderrTrace && diag.stderrTrace.length > 0
      ? diag.stderrTrace
      : fallbackStderr;

  const exceptionMsg =
    diag?.exceptionMessage ||
    ft.error ||
    ft.outcomeReason ||
    fallbackStderr[fallbackStderr.length - 1] ||
    'Unexpected interruption or missing deliverables detected.';

  const lastActivity =
    diag?.lastKnownActivity ||
    (ft.toolActions && ft.toolActions.length > 0
      ? ft.toolActions[ft.toolActions.length - 1].label
      : ft.thinkingTrace && ft.thinkingTrace.length > 0
      ? ft.thinkingTrace[ft.thinkingTrace.length - 1]
      : undefined);

  const modFilesSet = new Set<string>();
  for (const mf of [
    ...(ft.modifiedFiles || []),
    ...(diag?.modifiedFiles || []),
    ...(ft.verificationReport?.checkedFiles || []),
  ]) {
    const clean = mf.trim().replace(/\\/g, '/').split('/').pop();
    if (clean && !clean.startsWith('.')) modFilesSet.add(clean);
  }
  for (const act of ft.toolActions || []) {
    if (act.targetPath) {
      const clean = act.targetPath
        .replace(/\\/g, '/')
        .split('/')
        .pop();
      if (clean && !clean.startsWith('.')) modFilesSet.add(clean);
    }
  }
  const modifiedFileNames = Array.from(modFilesSet);

  const handleCopyModalErrorLog = async () => {
    const report = [
      `=== FlyMD Pipeline & Task Error Diagnostic ===`,
      `Task ID: ${ft.id}`,
      promptData.pipeline
        ? `Pipeline: ${promptData.pipeline.name} — Step ${(promptData.stepIdx ?? 0) + 1} (${promptData.stepLabel || ft.intent})`
        : `Standalone Task: ${ft.fileName}`,
      `Agent: ${ft.targetAgentId} (${ft.intent})`,
      `Status: ${ft.status.toUpperCase()}`,
      `Category: ${diag?.category || 'execution_interrupted'}`,
      diag?.exitCode !== undefined ? `Exit Code: ${diag.exitCode}` : '',
      ft.cliSessionId || diag?.cliSessionId
        ? `CLI Session ID: ${ft.cliSessionId || diag?.cliSessionId}`
        : '',
      `Title: ${diag?.title || 'Task Execution Interrupted'}`,
      `Exception Message: ${exceptionMsg}`,
      lastActivity ? `Last Breakpoint: ${lastActivity}` : '',
      modifiedFileNames.length > 0
        ? `Modified Files (${modifiedFileNames.length}): ${modifiedFileNames.join(', ')}`
        : 'Modified Files: None',
      stderrLines.length > 0
        ? `\n--- Exception / Stderr Trace ---\n${stderrLines.join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(report);
      setCopiedLog(true);
      setTimeout(() => setCopiedLog(false), 2000);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fade-in select-none">
      <div className="w-full max-w-2xl rounded-2xl border border-amber-500/50 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                {promptData.pipeline
                  ? `Pipeline Step ${(promptData.stepIdx ?? 0) + 1} Interrupted — Resume or Revert & Retry`
                  : `Task Interrupted — Resume or Revert & Retry`}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {diag?.title ||
                  `Choose whether to continue from the last breakpoint or revert modified files and retry cleanly.`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyModalErrorLog}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold transition-colors"
              title="Copy clean exception & error diagnostic log"
            >
              {copiedLog ? (
                <>
                  <Check size={12} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-300">Copied Log</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy Error Log</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onDismissOrPause}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Pause pipeline here and inspect workspace"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs bg-white dark:bg-slate-900">
          {/* 1. Clean Exception & Error Diagnostic Block */}
          <div className="rounded-xl border border-rose-500/40 bg-rose-50/50 dark:bg-rose-950/25 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                <AlertCircle size={13} className="text-rose-600 dark:text-rose-400" />
                Clean Exception &amp; Error Diagnostic
              </span>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-950/90 border border-slate-200 dark:border-slate-700 text-[10px] font-mono font-bold uppercase text-amber-700 dark:text-amber-300">
                  {diag?.category || ft.status}
                </span>
                {diag?.exitCode !== undefined && diag?.exitCode !== null && (
                  <span className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 border border-rose-300 dark:border-rose-500/50 text-[10px] font-mono font-bold text-rose-700 dark:text-rose-300">
                    Exit Code: {diag.exitCode}
                  </span>
                )}
                {(ft.cliSessionId || diag?.cliSessionId) && (
                  <span className="px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950 border border-sky-300 dark:border-sky-500/40 text-[10px] font-mono text-sky-700 dark:text-sky-300">
                    Session Ready
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-lg bg-white dark:bg-slate-950/95 border border-rose-200 dark:border-slate-800 p-2.5 font-mono text-[11px] text-rose-700 dark:text-rose-200 leading-relaxed select-text">
              {exceptionMsg}
            </div>

            {lastActivity && (
              <div className="flex items-start gap-2 text-[11px] text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-lg px-2.5 py-1.5">
                <Clock size={12} className="text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="font-bold text-sky-700 dark:text-sky-300">
                    Last Active Breakpoint:{' '}
                  </span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 break-words">
                    {lastActivity}
                  </span>
                </div>
              </div>
            )}

            {stderrLines.length > 0 && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/90 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowStderr((prev) => !prev)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-900/80 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    {showStderr ? (
                      <ChevronDown size={12} />
                    ) : (
                      <ChevronRight size={12} />
                    )}
                    <span>
                      Exception &amp; Stderr Trace ({stderrLines.length}{' '}
                      lines)
                    </span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {showStderr ? 'Hide trace' : 'Show trace'}
                  </span>
                </button>
                {showStderr && (
                  <div className="p-2.5 max-h-40 overflow-y-auto font-mono text-[10px] text-rose-700 dark:text-rose-300/90 space-y-1 select-text border-t border-slate-200 dark:border-slate-800">
                    {stderrLines.map((line, i) => (
                      <div key={i} className="leading-relaxed break-words">
                        {line}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Modified Files & Safety Checkpoint Status */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400" />
                Workspace Files Modified by Current Failed Task (
                {modifiedFileNames.length})
              </span>
              {cp && !cp.restored ? (
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold">
                  Safety Checkpoint Ready ({cp.id})
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  Workspace Snapshot Active
                </span>
              )}
            </div>

            {modifiedFileNames.length === 0 ? (
              <div className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                No workspace code deliverables were written to disk before this task paused. Both options below are safe to run immediately.
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {modifiedFileNames.map((fname) => (
                    <span
                      key={fname}
                      className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-[11px] text-sky-700 dark:text-sky-300"
                    >
                      {fname}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  • Choose{' '}
                  <strong className="text-emerald-700 dark:text-emerald-300">
                    Continue from Last Breakpoint
                  </strong>{' '}
                  to keep these {modifiedFileNames.length} file(s) and finish
                  the remaining implementation from where the agent stopped.
                  <br />• Choose{' '}
                  <strong className="text-amber-700 dark:text-amber-300">
                    Revert Modified Files &amp; Retry
                  </strong>{' '}
                  to roll back modified files and remove partial files using
                  the pre-task safety checkpoint before re-running cleanly.
                </p>
              </div>
            )}
          </div>

          {/* 3. Optional Agent Switcher, Model Switcher + Fetch, Effort & Thinking Calibration & Recovery Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Target Agent:
              </label>
              <select
                value={recoveryAgentId || ft.targetAgentId}
                onChange={(e) => {
                  const nextAg = e.target.value as AgentId;
                  setRecoveryAgentId(nextAg);
                  if (setRecoveryModelId) {
                    setRecoveryModelId(normalizeModelForAgent(nextAg, effectiveModelId));
                  }
                }}
                className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-semibold text-xs focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                {visibleAgents.map((ag) => (
                  <option key={ag.id} value={ag.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    @{ag.name}{' '}
                    {ag.id === ft.targetAgentId ? '(Current)' : '(Switch)'}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 sm:col-span-2 lg:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Cpu size={11} className="text-sky-600 dark:text-sky-400" />
                  Target Model:
                </label>
                <button
                  type="button"
                  onClick={handleFetchSubscriptionModels}
                  disabled={isFetchingModels}
                  title="Fetch real available models from subscription CLI"
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-[10px] font-bold text-sky-700 dark:text-sky-300 transition-colors cursor-pointer"
                >
                  <RefreshCw size={10} className={isFetchingModels ? 'animate-spin' : ''} />
                  <span>{isFetchingModels ? 'Fetching...' : 'Fetch'}</span>
                </button>
              </div>
              <select
                value={effectiveModelId}
                onChange={(e) => {
                  const nextModel = e.target.value;
                  setRecoveryModelId?.(nextModel);
                  const found = availableModels.find((m) => m.id === nextModel);
                  if (
                    found?.supportedEffortLevels &&
                    found.supportedEffortLevels.length > 0 &&
                    !found.supportedEffortLevels.includes(recoveryEffortLevel)
                  ) {
                    setRecoveryEffortLevel(
                      found.defaultEffortLevel || found.supportedEffortLevels[0]
                    );
                  }
                }}
                className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-sky-500/50 text-slate-900 dark:text-white font-semibold text-xs focus:outline-none focus:border-sky-500 cursor-pointer"
                title="Select an available subscription model to retry with"
              >
                {availableModels.map((m) => (
                  <option
                    key={m.id}
                    value={m.id}
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    {m.displayName} ({m.id})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Reasoning Effort:
              </label>
              <select
                value={recoveryEffortLevel}
                onChange={(e) =>
                  setRecoveryEffortLevel(e.target.value as AgentEffortLevel)
                }
                className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sky-700 dark:text-sky-300 font-bold text-xs focus:outline-none focus:border-sky-500 cursor-pointer"
                title="Adjust effort level supported by the selected model"
              >
                {supportedEfforts.map((eff) => (
                  <option
                    key={eff}
                    value={eff}
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    {eff === 'low'
                      ? 'Low (Fast)'
                      : eff === 'medium'
                      ? 'Medium (Default)'
                      : eff === 'high'
                      ? 'High'
                      : eff === 'xhigh'
                      ? 'X-High'
                      : 'Max'}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Thinking Mode:
              </label>
              <button
                type="button"
                onClick={() => setRecoveryThinkingEnabled((prev) => !prev)}
                className={`w-full px-2.5 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  recoveryThinkingEnabled
                    ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-700 dark:text-indigo-300 shadow-xs'
                    : 'bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-500 line-through'
                }`}
                title={
                  recoveryThinkingEnabled
                    ? 'Thinking Mode: ON (Extended reasoning active)'
                    : 'Thinking Mode: OFF (Fast direct generation, no token burn)'
                }
              >
                <Brain
                  size={12}
                  className={
                    recoveryThinkingEnabled
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }
                />
                <span>{recoveryThinkingEnabled ? 'Thinking ON' : 'Thinking OFF'}</span>
              </button>
            </div>

            <div className="space-y-1 sm:col-span-2 lg:col-span-5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Optional Directive / Hint:
              </label>
              <input
                type="text"
                value={recoveryExtraDirective}
                onChange={(e) => setRecoveryExtraDirective(e.target.value)}
                placeholder="e.g. Write incrementally..."
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer: Explicit User Decision Buttons */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/90 flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={onDismissOrPause}
            className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Pause Pipeline &amp; Inspect
          </button>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => onExecuteDecision('revert_and_retry')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-800 dark:text-amber-200 font-bold text-xs transition-all cursor-pointer"
              title="Restore pre-task safety checkpoint (reverting modified files and deleting newly created partial files) and retry cleanly"
            >
              <RotateCcw size={13} />
              <span>Revert Modified Files &amp; Retry</span>
            </button>

            <button
              type="button"
              onClick={() => onExecuteDecision('continue_from_breakpoint')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
              title="Keep modified files on disk and resume execution from the last breakpoint"
            >
              <Play size={13} fill="currentColor" />
              <span>Continue from Last Breakpoint (Keep Files)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
