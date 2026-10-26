import React, { useState } from 'react';
import {
  Bot,
  KeyRound,
  Users,
  RefreshCw,
  Send,
  RotateCcw,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  GitBranch,
  BrainCircuit,
  Trash2,
  Terminal,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Workflow,
  StopCircle,
  Globe,
  Plus,
  ClipboardPaste,
} from 'lucide-react';
import { usePreviewStore, selectActiveTab } from '../../store';
import {
  BUILTIN_AGENT_PIPELINES,
  AGENT_INTENT_PRESETS,
} from '../../../../shared/constants';
import { AgentId, AgentPipelinePreset, AgentTaskRecord } from '../../../../shared/types';

export const AgentsControlCenter: React.FC = () => {
  const agentProfiles = usePreviewStore((s) => s.agentProfiles);
  const setAgentProfiles = usePreviewStore((s) => s.setAgentProfiles);
  const agentTasks = usePreviewStore((s) => s.agentTasks);
  const setAgentTasks = usePreviewStore((s) => s.setAgentTasks);
  const agentCheckpoints = usePreviewStore((s) => s.agentCheckpoints);
  const setAgentCheckpoints = usePreviewStore((s) => s.setAgentCheckpoints);
  const setShowAgentAccountsModal = usePreviewStore((s) => s.setShowAgentAccountsModal);
  const setShowCouncilModal = usePreviewStore((s) => s.setShowCouncilModal);
  const openDispatchModal = usePreviewStore((s) => s.openDispatchModal);
  const activeTab = usePreviewStore(selectActiveTab);
  const openFileInTab = usePreviewStore((s) => s.openFileInTab);
  const setViewMode = usePreviewStore((s) => s.setViewMode);
  const folderPath = usePreviewStore((s) => s.folderPath);
  const supervisionConfig = usePreviewStore((s) => s.supervisionConfig);
  const folderFiles = usePreviewStore((s) => s.folderFiles);

  const [dragOverAgentId, setDragOverAgentId] = useState<AgentId | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [restoringCheckpointId, setRestoringCheckpointId] = useState<string | null>(null);
  const [pastingTaskId, setPastingTaskId] = useState<string | null>(null);
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

  const enabledProfiles = agentProfiles.filter((a) => a.enabled);
  const visibleAgents = enabledProfiles.length > 0 ? enabledProfiles : agentProfiles;

  const resolvedWorkspace =
    folderPath ||
    supervisionConfig?.path ||
    (activeTab?.filePath ? activeTab.filePath.replace(/[\\/][^\\/]+$/, '') : '');

  const allWatchedFiles = folderFiles;

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
      console.error('Failed to refresh agent supervisor state:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAssignFileToAgent = async (
    agentId: AgentId,
    customFile?: {
      filePath: string;
      fileName: string;
      markdownContent?: string;
      sourceAgent?: string;
      pipelineId?: string;
      nextAgentInChain?: AgentId;
    }
  ) => {
    let filePath = customFile?.filePath || activeTab?.filePath || '';
    let fileName =
      customFile?.fileName || activeTab?.fileName || 'Workspace-Plan.md';
    let markdownContent =
      customFile?.markdownContent ?? activeTab?.content ?? '';

    if (filePath && !markdownContent) {
      try {
        const res = await window.electronAPI.readFile(filePath);
        if (res && typeof res.content === 'string') {
          markdownContent = res.content;
          fileName = res.name || fileName;
        }
      } catch (err) {
        console.error('Failed to load file for dispatch:', err);
      }
    }

    openDispatchModal({
      targetAgentId: agentId,
      sourceFilePath: filePath,
      sourceFileName: fileName,
      markdownContent,
      sourceAgentId: customFile?.sourceAgent,
      pipelineId: customFile?.pipelineId,
      nextAgentInChain: customFile?.nextAgentInChain,
    });
  };

  const handleStartPipeline = (pipeline: AgentPipelinePreset) => {
    if (!pipeline.steps.length) return;
    const firstStep = pipeline.steps[0];
    const secondStep = pipeline.steps[1];
    handleAssignFileToAgent(firstStep.agentId, {
      filePath: activeTab?.filePath || '',
      fileName: activeTab?.fileName || 'Pipeline-Specification.md',
      markdownContent: activeTab?.content || '',
      pipelineId: pipeline.id,
      nextAgentInChain: secondStep?.agentId,
    });
  };

  const handleOpenFileInEditor = async (filePath?: string) => {
    if (!filePath) return;
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
      }
    } catch (err) {
      console.error('Failed to open agent report file:', err);
    }
  };

  const handlePasteReplyFromClipboard = async (task: AgentTaskRecord) => {
    setPastingTaskId(task.id);
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        alert(
          'Your clipboard is currently empty. Copy the reply from your browser agent first, then click "Paste Reply (.md)".'
        );
        return;
      }
      if (window.electronAPI.completeWebTaskWithReply) {
        await window.electronAPI.completeWebTaskWithReply(task.id, text);
      }
      const tasks = await window.electronAPI.getAgentTasks();
      setAgentTasks(tasks);
      const updated = tasks.find((t) => t.id === task.id);
      if (updated?.outputReportPath) {
        await handleOpenFileInEditor(updated.outputReportPath);
      }
    } catch (err) {
      console.error('Failed to paste reply from clipboard:', err);
    } finally {
      setPastingTaskId(null);
    }
  };

  const handleOpenSharedMemory = async () => {
    if (!resolvedWorkspace) return;
    const sep = resolvedWorkspace.includes('\\') ? '\\' : '/';
    const memoryPath = `${resolvedWorkspace}${sep}.flymd${sep}MEMORY.md`;
    await handleOpenFileInEditor(memoryPath);
  };

  const handleRestoreCheckpoint = async (checkpointId?: string) => {
    if (!checkpointId) return;
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
      console.error('Failed to clear completed tasks:', err);
    }
  };

  const handleRelayTaskToAnotherAgent = (task: AgentTaskRecord) => {
    const nextFallback =
      task.nextAgentInChain ||
      visibleAgents.find((a) => a.id !== task.targetAgentId)?.id ||
      'claude-code';
    handleAssignFileToAgent(nextFallback, {
      filePath: task.outputReportPath || task.filePath,
      fileName: task.fileName,
      sourceAgent: task.targetAgentId,
    });
  };

  const selectedTask =
    agentTasks.find((t) => t.id === selectedTaskId) || agentTasks[0] || null;

  return (
    <div className="flex-1 h-full overflow-y-auto bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Top Supervisor Header Banner */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/60 p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
            <Bot size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg font-extrabold text-white tracking-tight">
                AI Agents Workspace Supervisor & Handoff Hub
              </h1>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {visibleAgents.length} Active Agents • Custom Agents Supported
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              <strong>Simple 3-Step Workflow:</strong>{' '}
              <span className="text-sky-300 font-semibold">1.</span> Drag any{' '}
              <code className="text-white">.md</code> file onto an agent card (or click{' '}
              <strong className="text-white">Send File</strong>) •{' '}
              <span className="text-emerald-300 font-semibold">2.</span> FlyMD opens your{' '}
              <strong className="text-white">System Default Browser</strong> with the task copied to your clipboard (just press <code className="text-white">Ctrl+V</code>) •{' '}
              <span className="text-violet-300 font-semibold">3.</span> Click{' '}
              <strong className="text-white">Paste Reply (.md)</strong> or let CLI agents write directly to your folder!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowAgentAccountsModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold shadow-lg shadow-sky-500/15 transition-all"
          >
            <KeyRound size={14} />
            Manage Logins & Custom Agents
          </button>

          <button
            type="button"
            onClick={() => setShowCouncilModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all"
          >
            <Users size={14} />
            Council Broadcast
          </button>

          {resolvedWorkspace && (
            <button
              type="button"
              onClick={handleOpenSharedMemory}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-all"
              title="Open .flymd/MEMORY.md Shared Cross-Agent Memory Ledger"
            >
              <BrainCircuit size={14} className="text-amber-400" />
              Shared Memory
            </button>
          )}

          <button
            type="button"
            onClick={handleRefreshAll}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
            title="Refresh Agents & Tasks"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Section 1: Agent Drag & Drop Command Grid */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Sparkles size={14} className="text-sky-400" />
            1. Your AI Agents & Custom Agents — Drag Any .md File Onto an Agent or Click &ldquo;Send File&rdquo;
          </h2>
          {activeTab && (
            <span className="text-xs text-slate-400">
              Active Document:{' '}
              <strong className="text-sky-300">{activeTab.fileName}</strong>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {visibleAgents.map((agent) => {
            const activeAgentTasks = agentTasks.filter(
              (t) => t.targetAgentId === agent.id && t.status === 'running'
            );
            const isDragOver = dragOverAgentId === agent.id;
            const isConnected =
              agent.authStatus === 'connected' ||
              agent.authStatus === 'web-connected' ||
              agent.authStatus === 'api-key-ready' ||
              agent.webAuthConnected;

            return (
              <div
                key={agent.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                  if (dragOverAgentId !== agent.id) {
                    setDragOverAgentId(agent.id);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverAgentId === agent.id) {
                    setDragOverAgentId(null);
                  }
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  setDragOverAgentId(null);
                  const payload = e.dataTransfer.getData('application/flymd-file');
                  if (payload) {
                    try {
                      const parsed = JSON.parse(payload);
                      await handleAssignFileToAgent(agent.id, parsed);
                      return;
                    } catch (err) {
                      console.error(err);
                    }
                  }
                  await handleAssignFileToAgent(agent.id);
                }}
                className={`rounded-2xl border p-4 transition-all flex flex-col justify-between ${
                  isDragOver
                    ? 'bg-sky-500/15 border-sky-400 scale-[1.01] shadow-xl shadow-sky-500/10'
                    : 'bg-slate-900/90 border-slate-800/90 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: agent.accentColor }}
                      />
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-1.5 flex-wrap">
                          {agent.name}
                          {agent.isCustom && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-violet-500/25 text-violet-300 border border-violet-500/40">
                              Custom
                            </span>
                          )}
                          <span className="text-[10px] font-normal text-slate-400">
                            ({agent.vendor})
                          </span>
                        </h3>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                        isConnected
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : agent.installed
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                      }`}
                    >
                      {agent.authStatus === 'web-connected' || agent.webAuthConnected
                        ? 'Browser Ready'
                        : isConnected
                        ? 'Connected'
                        : agent.installed
                        ? 'CLI Installed'
                        : 'Free Web Ready'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                    {agent.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-400 truncate">
                    {activeAgentTasks.length > 0 ? (
                      <span className="text-sky-400 font-semibold flex items-center gap-1">
                        <Loader2 size={12} className="animate-spin" />
                        Working on {activeAgentTasks[0].fileName}
                      </span>
                    ) : (
                      <span className="truncate">
                        {agent.webUrl}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        await window.electronAPI.launchAgentWebAuth(agent.id);
                        const updated = await window.electronAPI.discoverAgents();
                        setAgentProfiles(updated);
                      }}
                      title={`Open ${agent.name} in your System Default Browser (${agent.webUrl})`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[11px] font-semibold text-emerald-300 transition-colors"
                    >
                      <Globe size={11} />
                      Open Browser
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAssignFileToAgent(agent.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-[11px] font-bold transition-colors"
                    >
                      <Send size={11} />
                      Send File
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add Custom Agent Card */}
          <button
            type="button"
            onClick={() => setShowAgentAccountsModal(true)}
            className="rounded-2xl border border-dashed border-violet-500/40 bg-violet-950/15 hover:bg-violet-950/30 hover:border-violet-400 p-4 transition-all flex flex-col items-center justify-center text-center gap-2 min-h-[148px] group"
          >
            <div className="w-10 h-10 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-300 group-hover:scale-110 transition-transform">
              <Plus size={20} />
            </div>
            <div className="text-xs font-bold text-violet-200">
              + Add Your Own Custom Agent
            </div>
            <p className="text-[11px] text-slate-400 max-w-xs">
              Add DeepSeek, Perplexity, Bolt.new, Windsurf, Aider, or any custom Web URL / CLI tool — or hide predefined agents.
            </p>
          </button>
        </div>
      </div>

      {/* Section 2: 1-Click Multi-Agent Relay Pipelines */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Workflow size={14} className="text-indigo-400" />
            2. 1-Click Relay Pipelines — Click Any Dropdown Below to Change Who Does Plan, Build & Review
          </h2>
          <button
            type="button"
            onClick={() => {
              setPipelines(BUILTIN_AGENT_PIPELINES);
              try {
                localStorage.removeItem('flymd:custom-pipelines');
              } catch {}
            }}
            className="text-[11px] text-slate-400 hover:text-sky-300 transition-colors"
          >
            Reset Default Pipeline Agents
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {pipelines.map((pipeline) => (
            <div
              key={pipeline.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">
                    {pipeline.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleStartPipeline(pipeline)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-slate-950 text-xs font-bold transition-colors"
                  >
                    <Send size={12} />
                    Start Relay
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Choose which agent handles each step below, then click <strong>Start Relay</strong>:
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-800/80">
                {pipeline.steps.map((step, idx) => {
                  const agent = agentProfiles.find((a) => a.id === step.agentId);
                  return (
                    <React.Fragment key={`${pipeline.id}-${idx}`}>
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 hover:border-indigo-400/60 text-xs transition-colors">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: agent?.accentColor || '#38bdf8',
                          }}
                        />
                        <span className="text-[10px] font-bold uppercase text-indigo-300">
                          {step.label}:
                        </span>
                        <select
                          value={step.agentId}
                          onChange={(e) =>
                            handleUpdatePipelineStepAgent(
                              pipeline.id,
                              idx,
                              e.target.value
                            )
                          }
                          title={`Change agent for ${step.label}`}
                          className="bg-slate-900 text-white font-bold text-xs rounded px-1.5 py-0.5 border border-slate-700 focus:outline-none focus:border-sky-400 cursor-pointer"
                        >
                          {agentProfiles.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {idx < pipeline.steps.length - 1 && (
                        <ArrowRight size={13} className="text-slate-500" />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Live Task Queue, Streaming Console & Safety Time-Machine */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 7 Cols: Dispatched Tasks & Checkpoints */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/90 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Terminal size={14} className="text-emerald-400" />
              3. Active & Recent Agent Tasks ({agentTasks.length})
            </h2>
            {agentTasks.length > 0 && (
              <button
                type="button"
                onClick={handleClearFinished}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-300 transition-colors"
              >
                <Trash2 size={12} /> Clear Finished
              </button>
            )}
          </div>

          {agentTasks.length === 0 ? (
            <div className="flex-1 py-10 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
              No tasks dispatched yet. Drag any Markdown file onto an agent above or click &ldquo;Send File&rdquo; to start!
            </div>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {agentTasks.map((task) => {
                const agent = agentProfiles.find(
                  (a) => a.id === task.targetAgentId
                );
                const intentMeta = AGENT_INTENT_PRESETS.find(
                  (i) => i.id === task.intent
                );
                const checkpoint = agentCheckpoints.find(
                  (c) => c.id === task.checkpointId
                );
                const isSelected = selectedTask?.id === task.id;

                return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800/90 border-sky-500/50'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: agent?.accentColor || '#38bdf8',
                          }}
                        />
                        <span className="text-xs font-bold text-white">
                          {agent?.name || task.targetAgentId}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-sky-300 font-medium">
                          {intentMeta?.title || task.intent}
                        </span>
                        <span className="text-xs text-slate-300 font-semibold flex items-center gap-1">
                          <FileText size={12} className="text-slate-400" />
                          {task.fileName}
                        </span>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${
                          task.status === 'running'
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                            : task.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : task.status === 'undone'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {task.status === 'running' && (
                          <Loader2 size={10} className="animate-spin" />
                        )}
                        {task.status === 'completed' && (
                          <CheckCircle2 size={10} />
                        )}
                        {task.status === 'failed' && <XCircle size={10} />}
                        {task.status}
                      </span>
                    </div>

                    {/* Checklist Progress & Worktree Badges */}
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                      {task.checklistTotal > 0 && (
                        <span>
                          Checklist: {task.checklistCompleted}/
                          {task.checklistTotal} steps
                        </span>
                      )}
                      {task.worktreePath && (
                        <span className="flex items-center gap-1 text-violet-300">
                          <GitBranch size={11} /> Isolated Sandbox
                        </span>
                      )}
                      {checkpoint && !checkpoint.restored && (
                        <span className="flex items-center gap-1 text-emerald-300">
                          <ShieldCheck size={11} /> Restore Point Protected
                        </span>
                      )}
                    </div>

                    {/* Action Buttons Row */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          disabled={pastingTaskId === task.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePasteReplyFromClipboard(task);
                          }}
                          title="Copy the reply from your browser agent, then click here to save it as a .md file and open it in FlyMD"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold transition-colors"
                        >
                          <ClipboardPaste size={11} />
                          {pastingTaskId === task.id
                            ? 'Saving .md...'
                            : 'Paste Reply (.md)'}
                        </button>

                        {task.outputReportPath && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenFileInEditor(task.outputReportPath);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-[11px] font-semibold transition-colors"
                          >
                            <ExternalLink size={11} />
                            Open Output Report
                          </button>
                        )}

                        {task.handoffFilePath && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenFileInEditor(task.handoffFilePath);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
                          >
                            <FileText size={11} />
                            Handoff Packet
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRelayTaskToAnotherAgent(task);
                          }}
                          title="Quota reached or want a second opinion? Hand off this task to another agent with 1 click."
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-[11px] font-semibold transition-colors"
                        >
                          <ArrowRight size={11} />
                          Relay to Next Agent
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {task.status === 'running' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelTask(task.id);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-semibold"
                          >
                            <StopCircle size={11} />
                            Stop
                          </button>
                        )}

                        {checkpoint && !checkpoint.restored && (
                          <button
                            type="button"
                            disabled={restoringCheckpointId === checkpoint.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestoreCheckpoint(checkpoint.id);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-semibold transition-colors"
                          >
                            <RotateCcw size={11} />
                            {restoringCheckpointId === checkpoint.id
                              ? 'Restoring...'
                              : 'Undo Changes'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 5 Cols: Live Agent Streaming Console & Supervised Artifacts */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Live Console Output */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Terminal size={13} className="text-sky-400" />
                Live Agent Execution Log
              </h3>
              {selectedTask && (
                <span className="text-[11px] text-slate-400">
                  {selectedTask.fileName}
                </span>
              )}
            </div>

            <div className="flex-1 min-h-[160px] max-h-56 overflow-y-auto rounded-xl bg-slate-950 border border-slate-800/90 p-3 font-mono text-[11px] text-slate-300 space-y-1">
              {selectedTask ? (
                selectedTask.logs.map((line, i) => (
                  <div key={i} className="leading-relaxed break-words">
                    {line}
                  </div>
                ))
              ) : (
                <div className="text-slate-500 italic">
                  Select any task on the left to inspect its real-time agent stream and handoff instructions.
                </div>
              )}
            </div>
          </div>

          {/* Supervised Workspace Markdown Artifacts */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5 flex items-center justify-between">
              <span>Supervised Workspace Markdown Files</span>
              <span className="text-[11px] text-sky-400 font-normal">
                Drag onto any agent
              </span>
            </h3>
            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
              {allWatchedFiles.slice(0, 20).map((file) => (
                <div
                  key={file.path}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      'application/flymd-file',
                      JSON.stringify({
                        filePath: file.path,
                        fileName: file.name,
                        sourceAgent: file.sourceAgent,
                      })
                    );
                  }}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 text-xs cursor-grab active:cursor-grabbing"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={13} className="text-sky-400 shrink-0" />
                    <span className="truncate text-slate-200 font-medium">
                      {file.name}
                    </span>
                    {file.sourceAgent && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                        {file.sourceAgent}
                      </span>
                    )}
                    {typeof file.checklistTotal === 'number' &&
                      file.checklistTotal > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 shrink-0">
                          {file.checklistDone || 0}/{file.checklistTotal} tasks
                        </span>
                      )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleAssignFileToAgent(
                        visibleAgents[0]?.id || 'claude-code',
                        {
                          filePath: file.path,
                          fileName: file.name,
                          sourceAgent: file.sourceAgent,
                        }
                      )
                    }
                    className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold shrink-0 ml-2"
                  >
                    Send →
                  </button>
                </div>
              ))}
              {allWatchedFiles.length === 0 && (
                <div className="text-xs text-slate-500 py-4 text-center">
                  Open a project folder or enable Supervision to see all agent Markdown files here.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
