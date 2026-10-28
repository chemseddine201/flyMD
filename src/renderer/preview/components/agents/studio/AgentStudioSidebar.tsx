import React, { useState } from 'react';
import {
  Bot,
  Plus,
  Workflow,
  Play,
  RotateCcw,
  FileText,
  CheckCircle2,
  Loader2,
  XCircle,
  Trash2,
  Globe,
  X,
} from 'lucide-react';
import {
  AgentId,
  AgentPipelinePreset,
  AgentProfile,
  AgentTaskIntent,
  AgentTaskRecord,
} from '../../../../../shared/types';
import {
  AGENT_INTENT_PRESETS,
  BUILTIN_AGENT_PIPELINES,
} from '../../../../../shared/constants';
import {
  SidebarContextMenuTarget,
  SidebarItemContextMenu,
} from '../../sidebar/SidebarItemContextMenu';

interface AgentStudioSidebarProps {
  visibleAgents: AgentProfile[];
  allAgents: AgentProfile[];
  selectedAgentId: AgentId;
  onSelectAgent: (id: AgentId) => void;
  agentTasks: AgentTaskRecord[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => Promise<void>;
  onClearFinished: () => void;
  onOpenAccountsModal: () => void;
  pipelines: AgentPipelinePreset[];
  onUpdatePipelineStep: (
    pipelineId: string,
    stepIdx: number,
    updates: { agentId?: AgentId; intent?: AgentTaskIntent; label?: string }
  ) => void;
  onAddPipelineStep: (pipelineId: string) => void;
  onRemovePipelineStep: (pipelineId: string, stepIdx: number) => void;
  onResetPipelines: () => void;
  onRunPipelineInStudio: (pipeline: AgentPipelinePreset) => void;
  onDropFileOnAgent: (
    agentId: AgentId,
    customFile?: { filePath: string; fileName: string; sourceAgent?: string }
  ) => void;
  onOpenExternalBrowser: (agentId: AgentId) => void;
}

const INTENT_SHORT_LABELS: Record<AgentTaskIntent, string> = {
  'refine-plan': 'Plan',
  build: 'Build',
  review: 'Review',
  'fix-bugs': 'Fix Bugs',
  'write-tests': 'Tests',
  explain: 'Explain',
  custom: 'Custom',
};

export const AgentStudioSidebar: React.FC<AgentStudioSidebarProps> = ({
  visibleAgents,
  allAgents,
  selectedAgentId,
  onSelectAgent,
  agentTasks,
  selectedTaskId,
  onSelectTask,
  onDeleteTask,
  onClearFinished,
  onOpenAccountsModal,
  pipelines,
  onUpdatePipelineStep,
  onAddPipelineStep,
  onRemovePipelineStep,
  onResetPipelines,
  onRunPipelineInStudio,
  onDropFileOnAgent,
  onOpenExternalBrowser,
}) => {
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [contextMenuTarget, setContextMenuTarget] =
    useState<SidebarContextMenuTarget | null>(null);

  const primaryPipeline = pipelines[0] || BUILTIN_AGENT_PIPELINES[0];

  return (
    <aside className="w-72 shrink-0 h-full border-r border-slate-800/90 bg-slate-900/75 flex flex-col overflow-hidden select-none">
      {/* Section 1: Enabled Agents Roster */}
      <div className="p-3.5 border-b border-slate-800/90">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Bot size={13} className="text-sky-400" />
            Enabled Agents ({visibleAgents.length})
          </span>
          <button
            type="button"
            onClick={onOpenAccountsModal}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-violet-300 text-[10px] font-bold transition-colors"
            title="Add Custom Agent or Toggle Enabled Agents"
          >
            <Plus size={11} />
            Manage / Custom
          </button>
        </div>

        <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
          {visibleAgents.map((agent) => {
            const isSelected = agent.id === selectedAgentId;
            const isRunning = agentTasks.some(
              (t) => t.targetAgentId === agent.id && t.status === 'running'
            );
            const isDrag = dragOverId === agent.id;

            return (
              <div
                key={agent.id}
                onClick={() => onSelectAgent(agent.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                  setDragOverId(agent.id);
                }}
                onDragLeave={() => setDragOverId(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverId(null);
                  const raw = e.dataTransfer.getData('application/flymd-file');
                  if (raw) {
                    try {
                      onDropFileOnAgent(agent.id, JSON.parse(raw));
                      return;
                    } catch {}
                  }
                  onDropFileOnAgent(agent.id);
                }}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl border cursor-pointer transition-all ${
                  isDrag
                    ? 'bg-sky-500/20 border-sky-400 scale-[1.01]'
                    : isSelected
                    ? 'bg-slate-800/95 border-sky-500/50 text-white shadow-sm'
                    : 'bg-slate-950/50 border-slate-800/70 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      isRunning ? 'animate-ping' : ''
                    }`}
                    style={{ backgroundColor: agent.accentColor }}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate flex items-center gap-1.5">
                      <span>{agent.name}</span>
                      {agent.isCustom && (
                        <span className="text-[9px] px-1 rounded bg-violet-500/25 text-violet-300 font-semibold">
                          Custom
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {agent.detectedBinaryPath
                        ? 'CLI Stream Ready'
                        : 'In-App Studio Ready'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isRunning && (
                    <Loader2 size={12} className="text-sky-400 animate-spin" />
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenExternalBrowser(agent.id);
                    }}
                    title={`Optional: Open ${agent.name} in system web browser`}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-emerald-300 transition-all"
                  >
                    <Globe size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Custom Workflow Repeater (Only Enabled Agents Shown) */}
      {primaryPipeline && (
        <div className="p-3.5 border-b border-slate-800/90 bg-indigo-950/15">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
              <Workflow size={13} className="text-indigo-400" />
              Workflow Steps ({primaryPipeline.steps.length})
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onAddPipelineStep(primaryPipeline.id)}
                title="Add another step to the workflow repeater"
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 text-[10px] font-bold transition-colors"
              >
                <Plus size={10} /> Add Step
              </button>
              <button
                type="button"
                onClick={onResetPipelines}
                title="Reset workflow steps"
                className="text-[10px] text-slate-400 hover:text-sky-300 flex items-center gap-0.5"
              >
                <RotateCcw size={10} />
              </button>
            </div>
          </div>

          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
            {primaryPipeline.steps.map((step, idx) => {
              const effectiveAgentId = visibleAgents.some(
                (a) => a.id === step.agentId
              )
                ? step.agentId
                : visibleAgents[0]?.id || step.agentId;
              const stepAgent =
                visibleAgents.find((a) => a.id === effectiveAgentId) ||
                allAgents.find((a) => a.id === effectiveAgentId);

              return (
                <div
                  key={`${primaryPipeline.id}-${idx}`}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-950/90 border border-slate-800 text-xs"
                >
                  <span className="text-[10px] font-extrabold text-indigo-400 shrink-0 w-4">
                    {idx + 1}.
                  </span>

                  {/* Step Action/Intent Dropdown */}
                  <select
                    value={step.intent}
                    onChange={(e) => {
                      const newIntent = e.target.value as AgentTaskIntent;
                      onUpdatePipelineStep(primaryPipeline.id, idx, {
                        intent: newIntent,
                        label: `${idx + 1}. ${INTENT_SHORT_LABELS[newIntent] || newIntent}`,
                      });
                    }}
                    title="Select Step Action (Plan, Build, Review, Fix Bugs, Tests, Explain)"
                    className="w-20 shrink-0 bg-slate-900 text-indigo-300 font-bold text-[10px] rounded px-1 py-0.5 border border-slate-700 focus:outline-none focus:border-indigo-400 cursor-pointer"
                  >
                    {AGENT_INTENT_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {INTENT_SHORT_LABELS[preset.id] || preset.title}
                      </option>
                    ))}
                  </select>

                  {/* Enabled Agent Dropdown */}
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: stepAgent?.accentColor || '#38bdf8',
                      }}
                    />
                    <select
                      value={effectiveAgentId}
                      onChange={(e) =>
                        onUpdatePipelineStep(primaryPipeline.id, idx, {
                          agentId: e.target.value,
                        })
                      }
                      title="Select Enabled Agent for this step"
                      className="w-full bg-slate-900 text-white font-semibold text-[11px] rounded px-1 py-0.5 border border-slate-700 focus:outline-none focus:border-indigo-400 cursor-pointer truncate"
                    >
                      {visibleAgents.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Remove Step Button */}
                  {primaryPipeline.steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        onRemovePipelineStep(primaryPipeline.id, idx)
                      }
                      title="Remove this step"
                      className="p-0.5 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 shrink-0"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => onRunPipelineInStudio(primaryPipeline)}
            className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold text-xs shadow-md shadow-indigo-500/15 transition-all"
          >
            <Play size={12} fill="currentColor" />
            Run {primaryPipeline.steps.length}-Step Workflow
          </button>
        </div>
      )}

      {/* Section 3: Conversation & Task Sessions History (Right-Click to Open in Dir or Confirm Delete) */}
      <div className="flex-1 flex flex-col min-h-0 p-3.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Session Threads ({agentTasks.length})
          </span>
          {agentTasks.some((t) => t.status !== 'running') && (
            <button
              type="button"
              onClick={onClearFinished}
              className="text-[10px] text-slate-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
              title="Clear all completed/finished tasks"
            >
              <Trash2 size={10} /> Clear All Done
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
          {agentTasks.length === 0 ? (
            <div className="text-[11px] text-slate-500 text-center py-8 px-2 border border-dashed border-slate-800 rounded-xl">
              Send a message or `.md` file in the chat studio to start your first agent session.
            </div>
          ) : (
            agentTasks.map((task) => {
              const agent = allAgents.find((a) => a.id === task.targetAgentId);
              const isSelected = task.id === selectedTaskId;
              const bestFilePath =
                task.outputReportPath ||
                task.filePath ||
                task.handoffFilePath ||
                task.workspacePath;

              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onSelectTask(task.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setContextMenuTarget({
                      x: e.clientX,
                      y: e.clientY,
                      title: `${agent?.shortName || task.targetAgentId} — ${task.fileName}`,
                      subtitle: bestFilePath,
                      filePath: bestFilePath,
                      onOpen: () => onSelectTask(task.id),
                      deleteLabel: 'Delete Session Thread...',
                      onDeleteConfirm: async () => {
                        await onDeleteTask(task.id);
                      },
                    });
                  }}
                  title="Left-click to view session • Right-click to Open in Directory or Delete"
                  className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-slate-800/95 border-sky-500/50 shadow-sm'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          backgroundColor: agent?.accentColor || '#38bdf8',
                        }}
                      />
                      <span className="text-xs font-bold text-white truncate">
                        {agent?.shortName || task.targetAgentId}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-sky-300 uppercase font-semibold">
                        {task.intent}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {task.status === 'running' ? (
                        <Loader2
                          size={12}
                          className="text-sky-400 animate-spin shrink-0"
                        />
                      ) : task.status === 'completed' ? (
                        <CheckCircle2
                          size={12}
                          className="text-emerald-400 shrink-0"
                        />
                      ) : (
                        <XCircle size={12} className="text-rose-400 shrink-0" />
                      )}

                      {task.status !== 'running' && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            await onDeleteTask(task.id);
                          }}
                          title="Delete this finished task session"
                          className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 opacity-60 hover:opacity-100 transition-all shrink-0"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="truncate flex items-center gap-1">
                      <FileText size={10} className="text-slate-500 shrink-0" />
                      {task.fileName}
                    </span>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {task.progressPercent ??
                        (task.status === 'completed' ? 100 : 20)}
                      %
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <SidebarItemContextMenu
        target={contextMenuTarget}
        onClose={() => setContextMenuTarget(null)}
      />
    </aside>
  );
};
