import React, { useState } from 'react';
import {
  Bot,
  Users,
  KeyRound,
  Activity,
  Loader2,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { usePreviewStore, selectActiveTab } from '../../store';
import { AgentId } from '../../../../shared/types';

export const AgentDock: React.FC = () => {
  const agentProfiles = usePreviewStore((s) => s.agentProfiles);
  const agentTasks = usePreviewStore((s) => s.agentTasks);
  const agentCheckpoints = usePreviewStore((s) => s.agentCheckpoints);
  const setAgentTasks = usePreviewStore((s) => s.setAgentTasks);
  const setAgentCheckpoints = usePreviewStore((s) => s.setAgentCheckpoints);
  const openDispatchModal = usePreviewStore((s) => s.openDispatchModal);
  const setShowAgentAccountsModal = usePreviewStore((s) => s.setShowAgentAccountsModal);
  const setShowCouncilModal = usePreviewStore((s) => s.setShowCouncilModal);
  const viewMode = usePreviewStore((s) => s.viewMode);
  const setViewMode = usePreviewStore((s) => s.setViewMode);
  const activeTab = usePreviewStore(selectActiveTab);

  const [dragOverAgentId, setDragOverAgentId] = useState<AgentId | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const runningTasks = agentTasks.filter((t) => t.status === 'running');
  const latestUnrestoredCheckpoint = agentCheckpoints.find((c) => !c.restored);

  const handleAssignToAgent = async (
    agentId: AgentId,
    droppedData?: {
      filePath?: string;
      fileName?: string;
      markdownContent?: string;
      sourceAgent?: string;
      selectedExcerpt?: string;
    }
  ) => {
    let filePath = droppedData?.filePath || activeTab?.filePath || '';
    let fileName =
      droppedData?.fileName || activeTab?.fileName || 'Untitled-Task.md';
    let markdownContent =
      droppedData?.markdownContent ?? activeTab?.content ?? '';

    if (filePath && !markdownContent) {
      try {
        const res = await window.electronAPI.readFile(filePath);
        if (res && typeof res.content === 'string') {
          markdownContent = res.content;
          fileName = res.name || fileName;
        }
      } catch (err) {
        console.error('Failed to read dropped file for agent handoff:', err);
      }
    }

    openDispatchModal({
      targetAgentId: agentId,
      sourceFilePath: filePath,
      sourceFileName: fileName,
      markdownContent,
      selectedExcerpt: droppedData?.selectedExcerpt,
      sourceAgentId: droppedData?.sourceAgent,
    });
  };

  const handleDropOnAgent = async (
    e: React.DragEvent<HTMLButtonElement>,
    agentId: AgentId
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverAgentId(null);

    const flymdPayload = e.dataTransfer.getData('application/flymd-file');
    if (flymdPayload) {
      try {
        const parsed = JSON.parse(flymdPayload);
        await handleAssignToAgent(agentId, {
          filePath: parsed.filePath,
          fileName: parsed.fileName,
          markdownContent: parsed.markdownContent,
          sourceAgent: parsed.sourceAgent,
        });
        return;
      } catch (err) {
        console.error('Invalid flymd drag payload:', err);
      }
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0] as File & { path?: string };
      const filePath = file.path || file.name;
      const text = await file.text().catch(() => '');
      await handleAssignToAgent(agentId, {
        filePath,
        fileName: file.name,
        markdownContent: text,
      });
      return;
    }

    const plainText = e.dataTransfer.getData('text/plain');
    if (plainText && plainText.trim()) {
      await handleAssignToAgent(agentId, {
        filePath: activeTab?.filePath || '',
        fileName: activeTab?.fileName || 'Selected-Excerpt.md',
        markdownContent: activeTab?.content || plainText,
        selectedExcerpt: plainText,
      });
    }
  };

  const handleQuickUndo = async () => {
    if (!latestUnrestoredCheckpoint) return;
    setRestoringId(latestUnrestoredCheckpoint.id);
    try {
      await window.electronAPI.restoreAgentCheckpoint(
        latestUnrestoredCheckpoint.id
      );
      const [tasks, checkpoints] = await Promise.all([
        window.electronAPI.getAgentTasks(),
        window.electronAPI.getAgentCheckpoints(),
      ]);
      setAgentTasks(tasks);
      setAgentCheckpoints(checkpoints);
    } catch (err) {
      console.error('Failed to restore checkpoint:', err);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="shrink-0 border-t border-slate-800/90 bg-slate-950/95 px-3 py-1.5 flex items-center justify-between gap-2 select-none z-20">
      {/* Left Label */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() =>
            setViewMode(viewMode === 'agents' ? 'preview' : 'agents')
          }
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
            viewMode === 'agents'
              ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
              : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
          }`}
          title="Open Multi-Agent Supervisor Control Center"
        >
          <Bot size={14} className="text-sky-400" />
          <span className="hidden sm:inline">Agents Dock</span>
          {runningTasks.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-sky-500 text-slate-950 text-[10px] font-extrabold animate-pulse">
              {runningTasks.length}
            </span>
          )}
        </button>
        <span className="text-[10px] text-slate-500 hidden xl:inline">
          Drag any .md file or click an agent to hand off:
        </span>
      </div>

      {/* Center: 6 Agent Drop Targets */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {agentProfiles.map((agent) => {
          const isRunning = runningTasks.some(
            (t) => t.targetAgentId === agent.id
          );
          const isDragOver = dragOverAgentId === agent.id;
          const isReady =
            agent.authStatus === 'connected' ||
            agent.authStatus === 'api-key-ready' ||
            agent.installed;

          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => handleAssignToAgent(agent.id)}
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
              onDrop={(e) => handleDropOnAgent(e, agent.id)}
              title={`Click or Drop Markdown file to assign to ${agent.name} (${agent.vendor})`}
              className={`group relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all shrink-0 ${
                isDragOver
                  ? 'scale-105 bg-sky-500/25 border-sky-400 text-white shadow-lg shadow-sky-500/20'
                  : isRunning
                  ? 'bg-slate-900 border-sky-500/60 text-white'
                  : 'bg-slate-900/80 border-slate-800/90 text-slate-300 hover:text-white hover:border-slate-700 hover:bg-slate-800/80'
              }`}
            >
              {/* Status or Running Dot */}
              {isRunning ? (
                <Loader2
                  size={12}
                  className="animate-spin shrink-0"
                  style={{ color: agent.accentColor }}
                />
              ) : (
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: agent.accentColor,
                    opacity: isReady ? 1 : 0.45,
                  }}
                />
              )}

              <span>{agent.shortName}</span>

              {isDragOver && (
                <span className="text-[10px] font-bold text-sky-300 ml-1">
                  Drop File!
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Right Actions: Undo Time-Machine, Council Broadcast, Accounts */}
      <div className="flex items-center gap-1.5 shrink-0">
        {latestUnrestoredCheckpoint && (
          <button
            type="button"
            disabled={restoringId === latestUnrestoredCheckpoint.id}
            onClick={handleQuickUndo}
            title={`Safety Time-Machine: Undo changes from "${latestUnrestoredCheckpoint.label}"`}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[11px] font-semibold transition-colors"
          >
            <RotateCcw size={12} />
            <span className="hidden md:inline">
              {restoringId ? 'Restoring...' : 'Undo Agent Changes'}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowCouncilModal(true)}
          title="Council of Agents: Broadcast current file to multiple agents simultaneously"
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-semibold transition-colors"
        >
          <Users size={12} />
          <span className="hidden md:inline">Council</span>
        </button>

        <button
          type="button"
          onClick={() => setShowAgentAccountsModal(true)}
          title="Connect Agent Accounts & API Keys"
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[11px] font-medium transition-colors"
        >
          <KeyRound size={12} className="text-sky-400" />
          <span className="hidden lg:inline">Accounts</span>
        </button>

        <button
          type="button"
          onClick={() =>
            setViewMode(viewMode === 'agents' ? 'preview' : 'agents')
          }
          title="Toggle Full Multi-Agent Supervisor Dashboard"
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-[11px] font-semibold transition-colors"
        >
          <Activity size={12} />
          <span className="hidden lg:inline">Supervisor</span>
        </button>
      </div>
    </div>
  );
};
