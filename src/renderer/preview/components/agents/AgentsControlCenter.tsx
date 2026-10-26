import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  KeyRound,
  Users,
  RefreshCw,
  BrainCircuit,
  SlidersHorizontal,
  Trash2,
  AlertTriangle,
  Check,
  Loader2,
  X,
} from 'lucide-react';
import { usePreviewStore, selectActiveTab } from '../../store';
import {
  AGENT_INTENT_PRESETS,
  BUILTIN_AGENT_PIPELINES,
} from '../../../../shared/constants';
import {
  AgentId,
  AgentPipelinePreset,
  AgentPipelineStep,
  AgentTaskIntent,
  AgentTaskRecord,
} from '../../../../shared/types';
import { AgentStudioSidebar } from './studio/AgentStudioSidebar';
import { AgentChatTimeline } from './studio/AgentChatTimeline';
import { AgentProgressInspector } from './studio/AgentProgressInspector';

export const AgentsControlCenter: React.FC = () => {
  const agentProfiles = usePreviewStore((s) => s.agentProfiles);
  const setAgentProfiles = usePreviewStore((s) => s.setAgentProfiles);
  const agentTasks = usePreviewStore((s) => s.agentTasks);
  const setAgentTasks = usePreviewStore((s) => s.setAgentTasks);
  const agentCheckpoints = usePreviewStore((s) => s.agentCheckpoints);
  const setAgentCheckpoints = usePreviewStore((s) => s.setAgentCheckpoints);
  const setShowAgentAccountsModal = usePreviewStore(
    (s) => s.setShowAgentAccountsModal
  );
  const setShowCouncilModal = usePreviewStore((s) => s.setShowCouncilModal);
  const openDispatchModal = usePreviewStore((s) => s.openDispatchModal);
  const activeTab = usePreviewStore(selectActiveTab);
  const openFileInTab = usePreviewStore((s) => s.openFileInTab);
  const updateActiveContent = usePreviewStore((s) => s.updateActiveContent);
  const setViewMode = usePreviewStore((s) => s.setViewMode);
  const folderPath = usePreviewStore((s) => s.folderPath);
  const supervisionConfig = usePreviewStore((s) => s.supervisionConfig);
  const folderFiles = usePreviewStore((s) => s.folderFiles);
  const setFolderFiles = usePreviewStore((s) => s.setFolderFiles);

  // Only show agents enabled by the user in all studio selectors
  const enabledProfiles = agentProfiles.filter((a) => a.enabled);
  const visibleAgents =
    enabledProfiles.length > 0 ? enabledProfiles : agentProfiles;

  const [selectedAgentId, setSelectedAgentId] = useState<AgentId>(
    () => visibleAgents[0]?.id || 'antigravity'
  );
  const [selectedIntent, setSelectedIntent] =
    useState<AgentTaskIntent>('refine-plan');
  const [selectedSourceFile, setSelectedSourceFile] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [restoringCheckpointId, setRestoringCheckpointId] = useState<
    string | null
  >(null);
  const [showClearCacheModal, setShowClearCacheModal] = useState(false);
  const [clearMemoryLedger, setClearMemoryLedger] = useState(true);
  const [clearCompletedSessions, setClearCompletedSessions] = useState(true);
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheNotification, setCacheNotification] = useState<string | null>(null);

  // Track automated multi-step repeater runs
  const activePipelineRunRef = useRef<{
    pipelineId: string;
    pipelineName: string;
    steps: AgentPipelineStep[];
    currentStepIndex: number;
    currentTaskId: string;
  } | null>(null);

  // Ensure selectedAgentId stays within enabled visibleAgents
  useEffect(() => {
    if (
      visibleAgents.length > 0 &&
      !visibleAgents.some((a) => a.id === selectedAgentId)
    ) {
      setSelectedAgentId(visibleAgents[0].id);
    }
  }, [visibleAgents, selectedAgentId]);

  const [pipelines, setPipelines] = useState<AgentPipelinePreset[]>(() => {
    try {
      const saved = localStorage.getItem('flymd:custom-pipelines');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return BUILTIN_AGENT_PIPELINES;
  });

  const resolvedWorkspace =
    folderPath ||
    supervisionConfig?.path ||
    (activeTab?.filePath ? activeTab.filePath.replace(/[\\/][^\\/]+$/, '') : '');

  const selectedTask =
    agentTasks.find((t) => t.id === selectedTaskId) || agentTasks[0] || null;

  const persistPipelines = (next: AgentPipelinePreset[]) => {
    try {
      localStorage.setItem('flymd:custom-pipelines', JSON.stringify(next));
    } catch {}
  };

  const handleUpdatePipelineStep = (
    pipelineId: string,
    stepIdx: number,
    updates: { agentId?: AgentId; intent?: AgentTaskIntent; label?: string }
  ) => {
    setPipelines((prev) => {
      const next = prev.map((p) => {
        if (p.id !== pipelineId) return p;
        const steps = p.steps.map((s, idx) =>
          idx === stepIdx ? { ...s, ...updates } : s
        );
        return { ...p, steps };
      });
      persistPipelines(next);
      return next;
    });
  };

  const handleAddPipelineStep = (pipelineId: string) => {
    const defaultAgent = visibleAgents[0]?.id || 'antigravity';
    setPipelines((prev) => {
      const next = prev.map((p) => {
        if (p.id !== pipelineId) return p;
        const nextIntent: AgentTaskIntent =
          p.steps.length === 0
            ? 'refine-plan'
            : p.steps.length === 1
            ? 'build'
            : 'review';
        const presetLabel =
          AGENT_INTENT_PRESETS.find((ip) => ip.id === nextIntent)?.title ||
          nextIntent;
        return {
          ...p,
          steps: [
            ...p.steps,
            {
              agentId: defaultAgent,
              intent: nextIntent,
              label: presetLabel,
              requireConfirmation: false,
            },
          ],
        };
      });
      persistPipelines(next);
      return next;
    });
  };

  const handleRemovePipelineStep = (pipelineId: string, stepIdx: number) => {
    setPipelines((prev) => {
      const next = prev.map((p) => {
        if (p.id !== pipelineId) return p;
        if (p.steps.length <= 1) return p;
        const steps = p.steps.filter((_, idx) => idx !== stepIdx);
        return { ...p, steps };
      });
      persistPipelines(next);
      return next;
    });
  };

  const handleResetPipelines = () => {
    const fallbackAgent = visibleAgents[0]?.id || 'antigravity';
    const secondAgent = visibleAgents[1]?.id || fallbackAgent;
    const reset = BUILTIN_AGENT_PIPELINES.map((p) => ({
      ...p,
      steps: p.steps.map((s, idx) => ({
        ...s,
        agentId: visibleAgents.some((va) => va.id === s.agentId)
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
  };

  const handleRefreshAll = async () => {
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
  };

  const resolveCurrentSourceDocument = async (overridePath?: string) => {
    // If activeTab is an unsaved Welcome tab and the user has a real .md file in the workspace (e.g. Untitled-1.md), prefer that file
    const userWorkspaceFiles = folderFiles.filter(
      (f) => !f.path.includes('.flymd') && !f.name.startsWith('report-task-')
    );
    const fallbackWorkspaceFile =
      !activeTab?.filePath && userWorkspaceFiles.length > 0
        ? userWorkspaceFiles[0].path
        : '';

    const targetPath =
      overridePath ||
      selectedSourceFile ||
      activeTab?.filePath ||
      fallbackWorkspaceFile ||
      '';

    if (targetPath && targetPath !== activeTab?.filePath) {
      try {
        const res = await window.electronAPI.readFile(targetPath);
        if (res && typeof res.content === 'string') {
          return {
            filePath: res.path || targetPath,
            fileName:
              res.name || targetPath.split(/[\\/]/).pop() || 'Document.md',
            markdownContent: res.content,
          };
        }
      } catch {}
    }
    return {
      filePath: activeTab?.filePath || '',
      fileName: activeTab?.fileName || 'Workspace-Specification.md',
      markdownContent:
        activeTab?.content ||
        '# Project Specification\n\n- [ ] Define core architecture\n- [ ] Implement feature modules\n- [ ] Verify and test\n',
    };
  };

  const handleSendInAppChatTask = async (
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
      });

      const [tasks, checkpoints] = await Promise.all([
        window.electronAPI.getAgentTasks(),
        window.electronAPI.getAgentCheckpoints(),
      ]);
      setAgentTasks(tasks);
      setAgentCheckpoints(checkpoints);
      if (record?.id) {
        setSelectedTaskId(record.id);
      }
      return record || null;
    } catch (err) {
      console.error('Failed to run in-app agent task:', err);
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunPipelineInStudio = async (pipeline: AgentPipelinePreset) => {
    if (!pipeline.steps.length) return;
    const first = pipeline.steps[0];
    const second = pipeline.steps[1];
    setSelectedAgentId(first.agentId);
    setSelectedIntent(first.intent);
    const created = await handleSendInAppChatTask(
      `Pipeline [${pipeline.name}] — Step 1/${pipeline.steps.length} (${first.label})`,
      {
        agentId: first.agentId,
        intent: first.intent,
        pipelineId: pipeline.id,
        nextAgentInChain: second?.agentId,
        nextIntentInChain: second?.intent,
      }
    );
    if (created?.id && pipeline.steps.length > 1) {
      activePipelineRunRef.current = {
        pipelineId: pipeline.id,
        pipelineName: pipeline.name,
        steps: [...pipeline.steps],
        currentStepIndex: 0,
        currentTaskId: created.id,
      };
    } else {
      activePipelineRunRef.current = null;
    }
  };

  // Automatically advance multi-step repeater pipelines when each step finishes
  useEffect(() => {
    const runState = activePipelineRunRef.current;
    if (!runState) return;
    const finishedTask = agentTasks.find(
      (t) => t.id === runState.currentTaskId && t.status === 'completed'
    );
    if (!finishedTask) return;

    const nextIdx = runState.currentStepIndex + 1;
    const nextStep = runState.steps[nextIdx];
    const followingStep = runState.steps[nextIdx + 1];

    if (!nextStep) {
      activePipelineRunRef.current = null;
      return;
    }

    // Prevent duplicate triggers while dispatching next step
    activePipelineRunRef.current = null;

    void (async () => {
      setSelectedAgentId(nextStep.agentId);
      setSelectedIntent(nextStep.intent);
      const nextTask = await handleSendInAppChatTask(
        `Pipeline [${runState.pipelineName}] — Step ${nextIdx + 1}/${
          runState.steps.length
        } (${nextStep.label}) relayed from @${finishedTask.targetAgentId}`,
        {
          agentId: nextStep.agentId,
          intent: nextStep.intent,
          filePath: finishedTask.outputReportPath || finishedTask.filePath,
          fileName: finishedTask.fileName,
          markdownContent:
            finishedTask.responseMarkdown || activeTab?.content || '',
          sourceAgentId: finishedTask.targetAgentId,
          pipelineId: runState.pipelineId,
          nextAgentInChain: followingStep?.agentId,
          nextIntentInChain: followingStep?.intent,
        }
      );
      if (nextTask?.id && nextIdx + 1 < runState.steps.length) {
        activePipelineRunRef.current = {
          ...runState,
          currentStepIndex: nextIdx,
          currentTaskId: nextTask.id,
        };
      }
    })();
  }, [agentTasks]);

  const handleRelayToNextAgent = async (
    task: AgentTaskRecord,
    nextAgentId: AgentId,
    nextIntent: AgentTaskIntent
  ) => {
    setSelectedAgentId(nextAgentId);
    setSelectedIntent(nextIntent);
    await handleSendInAppChatTask(
      `Relayed from @${task.targetAgentId} (${task.intent}) → Continue with ${nextIntent.toUpperCase()}`,
      {
        agentId: nextAgentId,
        intent: nextIntent,
        filePath: task.outputReportPath || task.filePath,
        fileName: task.fileName,
        markdownContent: task.responseMarkdown || activeTab?.content || '',
        sourceAgentId: task.targetAgentId,
      }
    );
  };

  const handleOpenReportInTab = async (
    filePath?: string,
    markdownFallback?: string,
    titleFallback?: string
  ) => {
    if (filePath) {
      try {
        const res = await window.electronAPI.readFile(filePath);
        if (res && typeof res.content === 'string') {
          openFileInTab(
            {
              path: res.path || filePath,
              name: res.name || filePath.split(/[\\/]/).pop() || 'Report.md',
              content: res.content,
              lastModified: res.lastModified,
            },
            { activate: true }
          );
          setViewMode('preview');
          return;
        }
      } catch {}
    }

    if (markdownFallback) {
      openFileInTab(
        {
          path: filePath || `agent-report-${Date.now()}.md`,
          name: titleFallback || 'Agent-Report.md',
          content: markdownFallback,
          lastModified: Date.now(),
        },
        { activate: true }
      );
      setViewMode('preview');
    }
  };

  const handleApplyToActiveTab = (markdownContent: string) => {
    if (!markdownContent.trim()) return;
    if (activeTab) {
      updateActiveContent(markdownContent);
      setViewMode('split');
    } else {
      openFileInTab(
        {
          path: `applied-plan-${Date.now()}.md`,
          name: 'Refined-Plan.md',
          content: markdownContent,
          lastModified: Date.now(),
        },
        { activate: true }
      );
      setViewMode('preview');
    }
  };

  const handlePasteExternalReply = async (task: AgentTaskRecord) => {
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
  };

  const handleRestoreCheckpoint = async (checkpointId: string) => {
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
  };

  const handleCancelTask = async (taskId: string) => {
    try {
      await window.electronAPI.cancelAgentTask(taskId);
      const tasks = await window.electronAPI.getAgentTasks();
      setAgentTasks(tasks);
    } catch (err) {
      console.error('Failed to cancel task:', err);
    }
  };

  const handleClearFinished = async () => {
    try {
      const remaining = await window.electronAPI.clearAgentTasks();
      setAgentTasks(remaining);
    } catch (err) {
      console.error('Failed to clear finished tasks:', err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      if (window.electronAPI.deleteAgentTask) {
        const remaining = await window.electronAPI.deleteAgentTask(taskId);
        setAgentTasks(remaining);
      } else {
        setAgentTasks(agentTasks.filter((t) => t.id !== taskId));
      }
      if (selectedTaskId === taskId) {
        setSelectedTaskId(null);
      }
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const handleClearTaskLogs = async (taskId: string) => {
    try {
      if (window.electronAPI.clearAgentTaskLogs) {
        await window.electronAPI.clearAgentTaskLogs(taskId);
      }
      const tasks = await window.electronAPI.getAgentTasks();
      setAgentTasks(tasks);
    } catch (err) {
      console.error('Failed to clear task logs:', err);
    }
  };

  const handleDeleteWorkspaceFile = async (filePath: string) => {
    try {
      if (window.electronAPI.deleteFilePath) {
        await window.electronAPI.deleteFilePath(filePath);
      }
      setFolderFiles(folderFiles.filter((f) => f.path !== filePath));
      if (selectedSourceFile === filePath) {
        setSelectedSourceFile('');
      }
    } catch (err) {
      console.error('Failed to delete workspace file:', err);
    }
  };

  const cleanWorkspaceFiles = useMemo(() => {
    return folderFiles.filter(
      (f) =>
        !f.path.includes('/.') &&
        !f.path.includes('\\.') &&
        !f.name.startsWith('.') &&
        !f.name.startsWith('report-task-')
    );
  }, [folderFiles]);

  const handleExecuteClearCache = async () => {
    if (!resolvedWorkspace) return;
    setClearingCache(true);
    try {
      if (window.electronAPI.clearWorkspaceCache) {
        const result = await window.electronAPI.clearWorkspaceCache(
          resolvedWorkspace,
          clearMemoryLedger
        );
        if (clearCompletedSessions) {
          const remaining = await window.electronAPI.clearAgentTasks();
          setAgentTasks(remaining);
        }
        setCacheNotification(result || 'Workspace cache cleared successfully.');
        setTimeout(() => setCacheNotification(null), 4000);
      }
      setShowClearCacheModal(false);
    } catch (err: any) {
      console.error('Failed to clear workspace cache:', err);
      setCacheNotification(`Error: ${err?.message || err}`);
      setTimeout(() => setCacheNotification(null), 4000);
    } finally {
      setClearingCache(false);
    }
  };

  const handleOpenSharedMemory = async () => {
    if (!resolvedWorkspace) return;
    const sep = resolvedWorkspace.includes('\\') ? '\\' : '/';
    const memoryPath = `${resolvedWorkspace}${sep}.flymd${sep}MEMORY.md`;
    await handleOpenReportInTab(
      memoryPath,
      '# FlyMD Shared Agent Memory Ledger\n\n> Auto-maintained context ledger across agents.\n',
      'MEMORY.md'
    );
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Compact Studio Top Header Bar */}
      <header className="h-12 shrink-0 px-4 border-b border-slate-800/90 bg-slate-900/95 flex items-center justify-between gap-3 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
            <Bot size={16} />
          </div>
          <h1 className="text-xs sm:text-sm font-extrabold text-white truncate">
            Agent Studio — Live Chat, Progress &amp; Multi-Agent Relay
          </h1>
          <span className="hidden md:inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            In-App Native Studio
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() =>
              openDispatchModal({
                targetAgentId: selectedAgentId,
                sourceFilePath: activeTab?.filePath || '',
                sourceFileName: activeTab?.fileName || 'Specification.md',
                markdownContent: activeTab?.content || '',
              })
            }
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-semibold transition-colors"
            title="Open Advanced Task Options (Checklist filter, Parallel Worktree, etc.)"
          >
            <SlidersHorizontal size={12} className="text-sky-400" />
            <span className="hidden sm:inline">Advanced Options</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCouncilModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-bold transition-colors"
          >
            <Users size={12} />
            <span className="hidden sm:inline">Council Broadcast</span>
          </button>

          {resolvedWorkspace && (
            <button
              type="button"
              onClick={handleOpenSharedMemory}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-semibold transition-colors"
              title="Open .flymd/MEMORY.md"
            >
              <BrainCircuit size={12} className="text-amber-400" />
              <span className="hidden lg:inline">Shared Memory</span>
            </button>
          )}

          {resolvedWorkspace && (
            <button
              type="button"
              onClick={() => setShowClearCacheModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[11px] font-semibold transition-colors"
              title="Clean temporary handoffs, agent reports, checkpoints, and optionally reset memory ledger"
            >
              <Trash2 size={12} className="text-rose-400" />
              <span className="hidden lg:inline">Clear Memory &amp; Cache</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAgentAccountsModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-[11px] font-bold transition-colors"
          >
            <KeyRound size={12} />
            <span>Custom Agents &amp; Logins</span>
          </button>

          <button
            type="button"
            onClick={handleRefreshAll}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
            title="Refresh Agents & Sessions"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Main 3-Pane Studio Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Sidebar: Agents, Custom Workflow Steps Repeater & Sessions */}
        <AgentStudioSidebar
          visibleAgents={visibleAgents}
          allAgents={agentProfiles}
          selectedAgentId={selectedAgentId}
          onSelectAgent={(id) => setSelectedAgentId(id)}
          agentTasks={agentTasks}
          selectedTaskId={selectedTask?.id || null}
          onSelectTask={(id) => setSelectedTaskId(id)}
          onDeleteTask={handleDeleteTask}
          onClearFinished={handleClearFinished}
          onOpenAccountsModal={() => setShowAgentAccountsModal(true)}
          pipelines={pipelines}
          onUpdatePipelineStep={handleUpdatePipelineStep}
          onAddPipelineStep={handleAddPipelineStep}
          onRemovePipelineStep={handleRemovePipelineStep}
          onResetPipelines={handleResetPipelines}
          onRunPipelineInStudio={handleRunPipelineInStudio}
          onDropFileOnAgent={async (agentId, customFile) => {
            setSelectedAgentId(agentId);
            await handleSendInAppChatTask('', {
              agentId,
              filePath: customFile?.filePath,
              fileName: customFile?.fileName,
              sourceAgentId: customFile?.sourceAgent,
            });
          }}
          onOpenExternalBrowser={async (agentId) => {
            await window.electronAPI.launchAgentWebAuth(agentId);
          }}
        />

        {/* Center Pane: Interactive Multi-Agent Chat & Streaming Timeline */}
        <AgentChatTimeline
          visibleAgents={visibleAgents}
          allAgents={agentProfiles}
          selectedAgentId={selectedAgentId}
          onSelectAgent={(id) => setSelectedAgentId(id)}
          selectedIntent={selectedIntent}
          onSelectIntent={(intent) => setSelectedIntent(intent)}
          selectedTask={selectedTask}
          activeFileName={
            activeTab?.filePath
              ? activeTab.fileName
              : cleanWorkspaceFiles[0]?.name ||
                activeTab?.fileName ||
                'Workspace-Specification.md'
          }
          activeFilePath={
            activeTab?.filePath ||
            cleanWorkspaceFiles[0]?.path ||
            ''
          }
          watchedFiles={cleanWorkspaceFiles}
          selectedSourceFile={selectedSourceFile}
          onSelectSourceFile={(path) => setSelectedSourceFile(path)}
          onSendChatTask={async (text) => {
            await handleSendInAppChatTask(text);
          }}
          onOpenReportInTab={handleOpenReportInTab}
          onApplyToActiveTab={handleApplyToActiveTab}
          onRelayToNextAgent={handleRelayToNextAgent}
          onPasteExternalReply={handlePasteExternalReply}
          onCancelTask={handleCancelTask}
          submitting={submitting}
        />

        {/* Right Pane: Live Progress, Antigravity Files Deck & Activity/Terminal Inspector */}
        <AgentProgressInspector
          selectedTask={selectedTask}
          checkpoints={agentCheckpoints}
          restoringCheckpointId={restoringCheckpointId}
          onRestoreCheckpoint={handleRestoreCheckpoint}
          onClearTaskLogs={handleClearTaskLogs}
          activeMarkdownContent={activeTab?.content || ''}
          watchedFiles={cleanWorkspaceFiles}
          onRunSingleChecklistItem={(itemText) =>
            handleSendInAppChatTask(`Execute checklist step: "${itemText}"`, {
              intent: 'build',
            })
          }
          onOpenFileInEditor={(path) => handleOpenReportInTab(path)}
          onSelectWatchedFileForDispatch={(file) => {
            setSelectedSourceFile(file.path);
            handleSendInAppChatTask(`Analyze and process ${file.name}`, {
              filePath: file.path,
              fileName: file.name,
              sourceAgentId: file.sourceAgent,
            });
          }}
          onDeleteWorkspaceFile={handleDeleteWorkspaceFile}
        />
      </div>

      {/* Floating Cache Operation Feedback Banner */}
      {cacheNotification && (
        <div className="absolute top-14 right-4 z-40 bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 text-xs px-3.5 py-2 rounded-xl shadow-xl flex items-center gap-2 animate-fade-in">
          <Check size={14} className="text-emerald-400 shrink-0" />
          <span>{cacheNotification}</span>
        </div>
      )}

      {/* Clear Memory & Cache Confirmation Modal */}
      {showClearCacheModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in select-none">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                <Trash2 size={15} />
                <span>Clear Workspace Memory &amp; Cache</span>
              </div>
              <button
                type="button"
                onClick={() => !clearingCache && setShowClearCacheModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs">
              <p className="text-slate-300 leading-relaxed">
                Clean temporary workspace agent data for{' '}
                <strong className="text-white font-mono break-all">
                  {resolvedWorkspace}
                </strong>
                :
              </p>

              <div className="space-y-2 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <div className="text-[11px] text-slate-300 font-medium flex items-center gap-2">
                  <Check size={12} className="text-emerald-400 shrink-0" />
                  <span>
                    Temporary agent handoff packages (
                    <code className="text-slate-400">.flymd/handoffs</code>)
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 font-medium flex items-center gap-2">
                  <Check size={12} className="text-emerald-400 shrink-0" />
                  <span>
                    Temporary agent execution reports (
                    <code className="text-slate-400">.flymd/reports</code>)
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 font-medium flex items-center gap-2">
                  <Check size={12} className="text-emerald-400 shrink-0" />
                  <span>
                    Safety checkpoint backups (
                    <code className="text-slate-400">.flymd/checkpoints</code>)
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/50 hover:bg-slate-800/80 cursor-pointer border border-slate-700/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={clearMemoryLedger}
                    onChange={(e) => setClearMemoryLedger(e.target.checked)}
                    className="rounded border-slate-600 text-rose-500 focus:ring-0 focus:ring-offset-0 bg-slate-900"
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-200 text-[11px]">
                      Reset Shared Agent Memory Ledger
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Re-initializes{' '}
                      <code className="text-amber-300">.flymd/MEMORY.md</code> to
                      a clean slate.
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/50 hover:bg-slate-800/80 cursor-pointer border border-slate-700/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={clearCompletedSessions}
                    onChange={(e) =>
                      setClearCompletedSessions(e.target.checked)
                    }
                    className="rounded border-slate-600 text-rose-500 focus:ring-0 focus:ring-offset-0 bg-slate-900"
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-200 text-[11px]">
                      Clear Finished Task Sessions
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Removes completed agent sessions and execution logs from memory.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-800 bg-slate-950/60">
              <button
                type="button"
                disabled={clearingCache}
                onClick={() => setShowClearCacheModal(false)}
                className="px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearingCache}
                onClick={handleExecuteClearCache}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-lg shadow-rose-950/50"
              >
                {clearingCache ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Clearing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={13} />
                    <span>Clear Cache &amp; Memory</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
