import React, { useState } from 'react';
import {
  Bot,
  KeyRound,
  Users,
  RefreshCw,
  BrainCircuit,
  SlidersHorizontal,
} from 'lucide-react';
import { usePreviewStore, selectActiveTab } from '../../store';
import { BUILTIN_AGENT_PIPELINES } from '../../../../shared/constants';
import {
  AgentId,
  AgentPipelinePreset,
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

  const handleUpdatePipelineStepAgent = (
    pipelineId: string,
    stepIdx: number,
    newAgentId: AgentId
  ) => {
    setPipelines((prev) => {
      const next = prev.map((p) => {
        if (p.id !== pipelineId) return p;
        const steps = p.steps.map((s, idx) =>
          idx === stepIdx ? { ...s, agentId: newAgentId } : s
        );
        return { ...p, steps };
      });
      try {
        localStorage.setItem('flymd:custom-pipelines', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleResetPipelines = () => {
    setPipelines(BUILTIN_AGENT_PIPELINES);
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
    const targetPath = overridePath || selectedSourceFile || activeTab?.filePath || '';
    if (targetPath && targetPath !== activeTab?.filePath) {
      try {
        const res = await window.electronAPI.readFile(targetPath);
        if (res && typeof res.content === 'string') {
          return {
            filePath: res.path || targetPath,
            fileName: res.name || targetPath.split(/[\\/]/).pop() || 'Document.md',
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
  ) => {
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
    } catch (err) {
      console.error('Failed to run in-app agent task:', err);
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
    await handleSendInAppChatTask(
      `Pipeline [${pipeline.name}] — Step 1 (${first.label})`,
      {
        agentId: first.agentId,
        intent: first.intent,
        pipelineId: pipeline.id,
        nextAgentInChain: second?.agentId,
        nextIntentInChain: second?.intent,
      }
    );
  };

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
        {/* Left Sidebar: Agents, Plan->Build->Review Builder & Sessions */}
        <AgentStudioSidebar
          visibleAgents={visibleAgents}
          allAgents={agentProfiles}
          selectedAgentId={selectedAgentId}
          onSelectAgent={(id) => setSelectedAgentId(id)}
          agentTasks={agentTasks}
          selectedTaskId={selectedTask?.id || null}
          onSelectTask={(id) => setSelectedTaskId(id)}
          onClearFinished={handleClearFinished}
          onOpenAccountsModal={() => setShowAgentAccountsModal(true)}
          pipelines={pipelines}
          onUpdatePipelineStep={handleUpdatePipelineStepAgent}
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
          activeFileName={activeTab?.fileName || 'Workspace-Specification.md'}
          activeFilePath={activeTab?.filePath || ''}
          watchedFiles={folderFiles}
          selectedSourceFile={selectedSourceFile}
          onSelectSourceFile={(path) => setSelectedSourceFile(path)}
          onSendChatTask={(text) => handleSendInAppChatTask(text)}
          onOpenReportInTab={handleOpenReportInTab}
          onApplyToActiveTab={handleApplyToActiveTab}
          onRelayToNextAgent={handleRelayToNextAgent}
          onPasteExternalReply={handlePasteExternalReply}
          onCancelTask={handleCancelTask}
          submitting={submitting}
        />

        {/* Right Pane: Live 5-Stage Progress View, Checklist & Execution Log */}
        <AgentProgressInspector
          selectedTask={selectedTask}
          checkpoints={agentCheckpoints}
          restoringCheckpointId={restoringCheckpointId}
          onRestoreCheckpoint={handleRestoreCheckpoint}
          activeMarkdownContent={activeTab?.content || ''}
          watchedFiles={folderFiles}
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
        />
      </div>
    </div>
  );
};
