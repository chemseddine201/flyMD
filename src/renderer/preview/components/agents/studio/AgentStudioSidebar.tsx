import React, { useState, useRef } from 'react';
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
  Zap,
  Hand,
  Compass,
  Hammer,
  Eye,
  Bug,
  FlaskConical,
  BookOpen,
  Wrench,
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  StickyNote,
  Sliders,
  Lock,
} from 'lucide-react';
import {
  AgentId,
  AgentPipelinePreset,
  AgentPipelineStep,
  AgentProfile,
  AgentTaskIntent,
  AgentTaskRecord,
  CustomPipelineAction,
} from '../../../../../shared/types';
import {
  AGENT_INTENT_PRESETS,
  BUILTIN_AGENT_PIPELINES,
  STARTER_CUSTOM_PIPELINE_ACTIONS,
} from '../../../../../shared/constants';
import { renderCustomActionIcon } from './CustomPipelineActionsModal';
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
    updates: Partial<AgentPipelineStep>
  ) => void;
  onAddPipelineStep: (pipelineId: string) => void;
  onRemovePipelineStep: (pipelineId: string, stepIdx: number) => void;
  onResetPipelines: () => void;
  onRunPipelineInStudio: (pipeline: AgentPipelinePreset) => void;
  onCancelPipeline?: () => void;
  runningPipelineId?: string | null;
  runningPipelineStepIdx?: number;
  workflowExecutionMode?: 'auto' | 'manual';
  onSetWorkflowExecutionMode?: (mode: 'auto' | 'manual') => void;
  waitingForStepApproval?: {
    completedStepIdx: number;
    nextStepIdx: number;
    nextAgentName: string;
    nextIntent: string;
    completedTaskId: string;
    filesCreatedCount: number;
  } | null;
  onProceedNextWorkflowStep?: () => void;
  onDropFileOnAgent: (
    agentId: AgentId,
    customFile?: { filePath: string; fileName: string; sourceAgent?: string }
  ) => void;
  onOpenExternalBrowser: (agentId: AgentId) => void;
  customActions?: CustomPipelineAction[];
  onOpenCustomActionsModal?: () => void;
  onClearStepDoneStatus?: (pipelineId: string) => void;
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

const INTENT_ICONS: Record<AgentTaskIntent, React.ReactNode> = {
  'refine-plan': <Compass size={12} className="text-sky-400 shrink-0" />,
  build: <Hammer size={12} className="text-amber-400 shrink-0" />,
  review: <Eye size={12} className="text-purple-400 shrink-0" />,
  'fix-bugs': <Bug size={12} className="text-rose-400 shrink-0" />,
  'write-tests': <FlaskConical size={12} className="text-emerald-400 shrink-0" />,
  explain: <BookOpen size={12} className="text-blue-400 shrink-0" />,
  custom: <Wrench size={12} className="text-slate-400 shrink-0" />,
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
  onCancelPipeline,
  runningPipelineId,
  runningPipelineStepIdx = -1,
  workflowExecutionMode = 'auto',
  onSetWorkflowExecutionMode,
  waitingForStepApproval,
  onProceedNextWorkflowStep,
  onDropFileOnAgent,
  onOpenExternalBrowser,
  customActions = [],
  onOpenCustomActionsModal,
  onClearStepDoneStatus,
}) => {
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [contextMenuTarget, setContextMenuTarget] =
    useState<SidebarContextMenuTarget | null>(null);

  const [activeStepNoteIdx, setActiveStepNoteIdx] = useState<number | null>(null);
  const [stepNoteDraft, setStepNoteDraft] = useState<string>('');
  const [showResetMenu, setShowResetMenu] = useState<boolean>(false);

  const availableCustomActions =
    customActions && customActions.length > 0
      ? customActions
      : STARTER_CUSTOM_PIPELINE_ACTIONS;

  // Resizable width container state (persisted)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('flymd:agents-sidebar-width') || '320', 10);
    } catch {
      return 320;
    }
  });

  const isResizingRef = useRef(false);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(260, Math.min(520, startWidth + delta));
      setSidebarWidth(newWidth);
      try {
        localStorage.setItem('flymd:agents-sidebar-width', String(newWidth));
      } catch {}
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Pipeline in-progress modification reset confirmation
  const [resetConfirmAction, setResetConfirmAction] = useState<(() => void) | null>(null);

  const confirmOrExecuteModification = (action: () => void) => {
    if (runningPipelineId) {
      setResetConfirmAction(() => action);
    } else {
      action();
    }
  };

  const primaryPipeline = pipelines[0] || BUILTIN_AGENT_PIPELINES[0];
  const isEditingLocked = !!runningPipelineId && workflowExecutionMode === 'auto';

  return (
    <aside
      style={{ width: `${sidebarWidth}px` }}
      className="relative shrink-0 h-full border-r border-slate-800/90 bg-slate-900/75 flex flex-col overflow-hidden select-none"
    >
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
            className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 font-medium px-2 py-0.5 rounded-md hover:bg-slate-800 transition-colors"
          >
            <Plus size={10} /> Connect / Enable
          </button>
        </div>

        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
          {visibleAgents.map((agent) => {
            const isSelected = selectedAgentId === agent.id;
            const isDragOver = dragOverId === agent.id;

            return (
              <div
                key={agent.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                  setDragOverId(agent.id);
                }}
                onDragLeave={() => setDragOverId(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverId(null);
                  try {
                    const rawJson = e.dataTransfer.getData('application/json');
                    if (rawJson) {
                      const data = JSON.parse(rawJson);
                      if (data.filePath && data.fileName) {
                        onDropFileOnAgent(agent.id, data);
                      }
                    }
                  } catch (err) {
                    console.error('Failed to parse dropped file JSON:', err);
                  }
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs transition-all ${
                  isDragOver
                    ? 'border-indigo-400 bg-indigo-950/80 scale-[1.02] shadow-md ring-2 ring-indigo-500/50'
                    : isSelected
                    ? 'border-sky-500/50 bg-slate-800/95 text-white shadow-sm'
                    : 'border-slate-800/80 bg-slate-950/50 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectAgent(agent.id)}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: agent.accentColor }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-200 truncate flex items-center gap-1.5">
                      <span>{agent.name}</span>
                      {(agent.authStatus === 'connected' || agent.authStatus === 'web-connected' || agent.authStatus === 'api-key-ready') && (
                        <span className="text-[9px] px-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-mono">
                          ready
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0 ml-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenExternalBrowser(agent.id);
                    }}
                    title={`Open ${agent.name} External CLI Dashboard / Web Browser`}
                    className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-sky-300 transition-colors"
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
              Workflow ({primaryPipeline.steps.length})
            </span>
            <div className="flex items-center gap-1">
              {/* Execution Mode Toggle: Icons Only */}
              {onSetWorkflowExecutionMode && (
                <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-md p-0.5">
                  <button
                    type="button"
                    disabled={isEditingLocked}
                    onClick={() => onSetWorkflowExecutionMode('auto')}
                    className={`p-1 rounded transition-colors ${
                      workflowExecutionMode === 'auto'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="⚡ Auto Mode: Automatically advances to next step when an agent finishes"
                  >
                    <Zap size={11} className={workflowExecutionMode === 'auto' ? 'text-amber-300' : ''} />
                  </button>
                  <button
                    type="button"
                    disabled={isEditingLocked}
                    onClick={() => onSetWorkflowExecutionMode('manual')}
                    className={`p-1 rounded transition-colors ${
                      workflowExecutionMode === 'manual'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="✋ Manual Mode: Pauses after each step with an approval card to review before continuing"
                  >
                    <Hand size={11} className={workflowExecutionMode === 'manual' ? 'text-indigo-200' : ''} />
                  </button>
                </div>
              )}

              {/* Manage Custom Actions Library: Sparkles Icon */}
              {onOpenCustomActionsModal && (
                <button
                  type="button"
                  onClick={onOpenCustomActionsModal}
                  title="Manage Custom Pipeline Actions (Report, Security Audit, etc.)"
                  className="p-1 rounded text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors"
                >
                  <Sparkles size={11} className="text-indigo-400" />
                </button>
              )}

              {/* Add Step: Icon Only */}
              <button
                type="button"
                disabled={isEditingLocked}
                onClick={() =>
                  confirmOrExecuteModification(() => onAddPipelineStep(primaryPipeline.id))
                }
                title="Add Step to Workflow"
                className="p-1 rounded bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Plus size={11} />
              </button>

              {/* Reset: Icon Only with 2-option Menu */}
              <div className="relative">
                <button
                  type="button"
                  disabled={isEditingLocked}
                  onClick={() => {
                    const hasDone = primaryPipeline.steps.some(
                      (s) => s.status === 'completed'
                    );
                    if (hasDone) {
                      setShowResetMenu((prev) => !prev);
                    } else {
                      confirmOrExecuteModification(onResetPipelines);
                    }
                  }}
                  title="Reset Workflow Steps"
                  className="p-1 rounded text-slate-400 hover:text-sky-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <RotateCcw size={11} />
                </button>
                {showResetMenu && (
                  <div className="absolute top-7 right-0 z-50 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl p-2 w-60 space-y-1 text-xs animate-in fade-in select-none">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-1">
                      Reset Workflow
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClearStepDoneStatus?.(primaryPipeline.id);
                        setShowResetMenu(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-800 text-sky-300 transition-colors"
                    >
                      <div className="font-bold text-xs">Clear Done Status</div>
                      <div className="text-[10px] text-slate-400 leading-tight">
                        Keep steps, re-run from Step 1
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        confirmOrExecuteModification(onResetPipelines);
                        setShowResetMenu(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-rose-950/40 text-rose-300 transition-colors"
                    >
                      <div className="font-bold text-xs">Restore Default Template</div>
                      <div className="text-[10px] text-slate-400 leading-tight">
                        Reset to Plan → Build → Review
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowResetMenu(false)}
                      className="w-full text-center py-1 text-[10px] text-slate-500 hover:text-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Workflow Steps List */}
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
            {primaryPipeline.steps.map((step, idx) => {
              const effectiveAgentId = visibleAgents.some((a) => a.id === step.agentId)
                ? step.agentId
                : visibleAgents[0]?.id || step.agentId;
              const stepAgent =
                visibleAgents.find((a) => a.id === effectiveAgentId) ||
                allAgents.find((a) => a.id === effectiveAgentId);

              const isStepCompleted = step.status === 'completed';
              const isStepIncomplete = step.status === 'incomplete';
              const isStepFailed = step.status === 'failed';
              const isRunningThisStep =
                !!runningPipelineId && runningPipelineStepIdx === idx;
              const isFinishedThisStep =
                isStepCompleted ||
                (!!runningPipelineId &&
                  runningPipelineStepIdx !== undefined &&
                  runningPipelineStepIdx > idx);
              const isWaitingThisStep =
                !!waitingForStepApproval &&
                waitingForStepApproval.nextStepIdx === idx;
              const isUpcomingStep =
                !!runningPipelineId &&
                runningPipelineStepIdx !== undefined &&
                runningPipelineStepIdx < idx &&
                !isWaitingThisStep;

              // Completed steps are locked so their configuration cannot be damaged
              const isStepDisabled =
                isEditingLocked ||
                isStepCompleted ||
                (!!runningPipelineId && isRunningThisStep);

              const stepCustomAction = step.customActionId
                ? availableCustomActions.find((a) => a.id === step.customActionId)
                : null;

              const stepActionIcon = stepCustomAction
                ? renderCustomActionIcon(
                    stepCustomAction.iconKey || 'file-text',
                    'text-indigo-400 shrink-0 w-3 h-3'
                  )
                : INTENT_ICONS[step.intent] || (
                    <Wrench size={12} className="text-indigo-400 shrink-0" />
                  );

              return (
                <div key={`${primaryPipeline.id}-${step.stepId || idx}`}>
                  <div
                    onClick={() => {
                      if ((isStepCompleted || isStepIncomplete || isStepFailed) && step.completedTaskId) {
                        onSelectTask(step.completedTaskId);
                      }
                    }}
                    title={
                      isStepIncomplete
                        ? 'Step incomplete: verification gaps detected. Click to view report.'
                        : isStepFailed
                        ? 'Step failed. Click to view logs.'
                        : isStepCompleted && step.completedTaskId
                        ? 'Step completed! Click to view deliverable and logs in studio'
                        : undefined
                    }
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs transition-all duration-200 ${
                      isRunningThisStep
                        ? 'bg-sky-950/90 border-2 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.45)] animate-pulse'
                        : isWaitingThisStep
                        ? 'bg-amber-950/70 border border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                        : isStepIncomplete
                        ? 'bg-amber-950/60 border border-amber-500/80 text-amber-200 shadow-xs cursor-pointer hover:border-amber-400'
                        : isStepFailed
                        ? 'bg-rose-950/60 border border-rose-500/80 text-rose-200 shadow-xs cursor-pointer hover:border-rose-400'
                        : isFinishedThisStep
                        ? 'bg-emerald-950/60 border border-emerald-500/60 text-emerald-200 shadow-xs cursor-pointer hover:border-emerald-400/90'
                        : isUpcomingStep
                        ? 'bg-slate-950/40 border border-slate-800/60 opacity-55 text-slate-500'
                        : 'bg-slate-950/90 border border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <span className="text-[10px] font-extrabold shrink-0 w-4 flex items-center justify-center">
                      {isStepIncomplete ? (
                        <AlertTriangle
                          size={13}
                          className="text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                        />
                      ) : isStepFailed ? (
                        <AlertCircle size={13} className="text-rose-400" />
                      ) : isFinishedThisStep ? (
                        <CheckCircle2
                          size={13}
                          className="text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                        />
                      ) : isRunningThisStep ? (
                        <Loader2 size={13} className="animate-spin text-sky-400" />
                      ) : isWaitingThisStep ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                      ) : (
                        <span
                          className={
                            runningPipelineId
                              ? 'text-slate-600 font-mono'
                              : 'text-indigo-400 font-mono font-bold'
                          }
                        >
                          {idx + 1}.
                        </span>
                      )}
                    </span>

                    {/* Step Action/Intent Dropdown with Custom Actions */}
                    <div className="flex items-center gap-1 shrink-0 bg-slate-900/90 border border-slate-700 rounded px-1.5 py-0.5">
                      {stepActionIcon}
                      <select
                        value={
                          step.customActionId
                            ? `custom:${step.customActionId}`
                            : step.intent
                        }
                        disabled={isStepDisabled}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '__manage_custom__') {
                            onOpenCustomActionsModal?.();
                            return;
                          }
                          if (val.startsWith('custom:')) {
                            const caId = val.replace('custom:', '');
                            const ca = availableCustomActions.find(
                              (a) => a.id === caId
                            );
                            confirmOrExecuteModification(() => {
                              onUpdatePipelineStep(primaryPipeline.id, idx, {
                                intent: 'custom',
                                customActionId: caId,
                                label: `${idx + 1}. ${ca?.name || 'Custom Action'}`,
                              });
                            });
                          } else {
                            const newIntent = val as AgentTaskIntent;
                            confirmOrExecuteModification(() => {
                              onUpdatePipelineStep(primaryPipeline.id, idx, {
                                intent: newIntent,
                                customActionId: undefined,
                                label: `${idx + 1}. ${
                                  INTENT_SHORT_LABELS[newIntent] || newIntent
                                }`,
                              });
                            });
                          }
                        }}
                        title={
                          isStepCompleted
                            ? 'Completed step (locked)'
                            : 'Step Action Intent'
                        }
                        className="bg-transparent text-indigo-300 font-bold text-[10px] focus:outline-none cursor-pointer disabled:cursor-not-allowed"
                      >
                        {AGENT_INTENT_PRESETS.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {INTENT_SHORT_LABELS[preset.id] || preset.title}
                          </option>
                        ))}
                        {availableCustomActions.length > 0 && (
                          <optgroup
                            label="Custom Actions"
                            className="bg-slate-900 text-indigo-300 font-semibold"
                          >
                            {availableCustomActions.map((ca) => (
                              <option
                                key={ca.id}
                                value={`custom:${ca.id}`}
                                className="bg-slate-900 text-slate-100"
                              >
                                ✨ {ca.shortLabel || ca.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {onOpenCustomActionsModal && (
                          <option
                            value="__manage_custom__"
                            className="bg-slate-900 text-sky-400 font-bold"
                          >
                            + Manage Custom...
                          </option>
                        )}
                      </select>
                    </div>

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
                        disabled={isStepDisabled}
                        onChange={(e) => {
                          const newAgentId = e.target.value;
                          confirmOrExecuteModification(() => {
                            onUpdatePipelineStep(primaryPipeline.id, idx, {
                              agentId: newAgentId,
                            });
                          });
                        }}
                        title={
                          isStepCompleted
                            ? 'Completed step (locked)'
                            : 'Select Enabled Agent for this step'
                        }
                        className="w-full bg-slate-900/90 text-white font-semibold text-[11px] rounded px-1 py-0.5 border border-slate-700 focus:outline-none focus:border-indigo-400 cursor-pointer disabled:cursor-not-allowed truncate"
                      >
                        {visibleAgents.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Status Badges */}
                    {isStepIncomplete && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/50 shrink-0">
                        INCOMPLETE
                      </span>
                    )}
                    {isStepFailed && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/50 shrink-0">
                        FAILED
                      </span>
                    )}
                    {!isStepIncomplete && !isStepFailed && isFinishedThisStep && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                        DONE
                      </span>
                    )}
                    {isRunningThisStep && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-sky-500 text-slate-950 shadow-xs animate-pulse shrink-0">
                        RUNNING
                      </span>
                    )}
                    {isWaitingThisStep && (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                        PAUSED
                      </span>
                    )}

                    {/* Step Note Button (Only for pending steps) */}
                    {!isStepCompleted && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activeStepNoteIdx === idx) {
                            setActiveStepNoteIdx(null);
                          } else {
                            setActiveStepNoteIdx(idx);
                            setStepNoteDraft(step.stepNote || '');
                          }
                        }}
                        title={
                          step.stepNote
                            ? `Step Note: "${step.stepNote.slice(0, 40)}..." (Click to edit)`
                            : 'Attach error trace / step directive'
                        }
                        className={`p-1 rounded transition-colors relative shrink-0 ${
                          step.stepNote
                            ? 'text-amber-400 bg-amber-950/60 border border-amber-500/40 hover:bg-amber-900/50'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <StickyNote size={11} />
                        {step.stepNote && (
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
                        )}
                      </button>
                    )}

                    {/* Remove Step Button (Only for pending steps) */}
                    {!isStepCompleted && primaryPipeline.steps.length > 1 && (
                      <button
                        type="button"
                        disabled={isStepDisabled}
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmOrExecuteModification(() =>
                            onRemovePipelineStep(primaryPipeline.id, idx)
                          );
                        }}
                        title="Remove this step"
                        className="p-0.5 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>

                  {/* Inline Step Note Editor Popover */}
                  {activeStepNoteIdx === idx && (
                    <div className="p-2 bg-slate-900/95 border border-amber-500/50 rounded-lg text-xs space-y-1.5 mt-1 animate-fadeIn">
                      <div className="flex items-center justify-between text-[10px] text-amber-300 font-bold">
                        <span className="flex items-center gap-1">
                          <StickyNote size={10} /> Step {idx + 1} Directive / Error Log:
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveStepNoteIdx(null)}
                          className="text-slate-500 hover:text-slate-300"
                        >
                          <X size={10} />
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={stepNoteDraft}
                        onChange={(e) => setStepNoteDraft(e.target.value)}
                        placeholder="e.g. TypeError: canvas_appHeader.getContext is not a function in app.js:29..."
                        className="w-full p-1.5 rounded bg-slate-950 border border-slate-700 text-slate-100 text-[11px] placeholder-slate-600 focus:outline-none focus:border-amber-400 font-mono"
                      />
                      <div className="flex justify-end gap-1.5">
                        {step.stepNote && (
                          <button
                            type="button"
                            onClick={() => {
                              onUpdatePipelineStep(primaryPipeline.id, idx, {
                                stepNote: undefined,
                              });
                              setActiveStepNoteIdx(null);
                            }}
                            className="px-2 py-0.5 text-[10px] text-rose-400 hover:bg-rose-950/40 rounded"
                          >
                            Clear
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            onUpdatePipelineStep(primaryPipeline.id, idx, {
                              stepNote: stepNoteDraft.trim() || undefined,
                            });
                            setActiveStepNoteIdx(null);
                          }}
                          className="px-2.5 py-0.5 text-[10px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded shadow-xs cursor-pointer"
                        >
                          Save Directive
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Manual Mode Step Approval Action Card */}
          {waitingForStepApproval && onProceedNextWorkflowStep && (
            <div className="mt-2.5 p-2.5 rounded-xl border border-amber-500/50 bg-amber-950/40 text-amber-200 space-y-1.5 shadow-md animate-fadeIn">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 size={12} />
                  Step {waitingForStepApproval.completedStepIdx + 1} Complete
                </span>
                {waitingForStepApproval.filesCreatedCount > 0 && (
                  <span className="text-[9px] text-amber-300 font-mono">
                    {waitingForStepApproval.filesCreatedCount} file
                    {waitingForStepApproval.filesCreatedCount > 1 ? 's' : ''} generated
                  </span>
                )}
              </div>
              <div className="text-[10px] text-zinc-300 leading-tight">
                Ready for{' '}
                <span className="font-semibold text-white">
                  @{waitingForStepApproval.nextAgentName}
                </span>{' '}
                ({waitingForStepApproval.nextIntent.toUpperCase()})
              </div>
              <button
                type="button"
                onClick={onProceedNextWorkflowStep}
                className="w-full mt-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow transition-colors cursor-pointer"
              >
                <span>Proceed to Step {waitingForStepApproval.nextStepIdx + 1} &gt;</span>
              </button>
            </div>
          )}

          {/* Smart Incremental Workflow Run Button */}
          {(() => {
            const completedCount = primaryPipeline.steps.filter(
              (s) => s.status === 'completed'
            ).length;
            const allDone =
              primaryPipeline.steps.length > 0 &&
              completedCount === primaryPipeline.steps.length;
            const firstPendingIdx = primaryPipeline.steps.findIndex(
              (s) => s.status !== 'completed'
            );
            const pendingCount = primaryPipeline.steps.length - completedCount;

            return (
              <div className="mt-2.5 space-y-1.5">
                <button
                  type="button"
                  disabled={!!runningPipelineId}
                  onClick={() => onRunPipelineInStudio(primaryPipeline)}
                  className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl font-bold text-xs shadow-md transition-all ${
                    runningPipelineId
                      ? 'bg-indigo-600/60 text-indigo-200 cursor-not-allowed border border-indigo-400/30'
                      : allDone
                      ? 'bg-slate-800 text-emerald-300 border border-emerald-500/40 cursor-default'
                      : completedCount > 0
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 cursor-pointer'
                      : 'bg-indigo-500 hover:bg-indigo-400 text-slate-950 shadow-indigo-500/15 cursor-pointer'
                  }`}
                >
                  {runningPipelineId ? (
                    <>
                      <Loader2 size={12} className="animate-spin text-indigo-300" />
                      <span>
                        Running Step {(runningPipelineStepIdx ?? 0) + 1} of{' '}
                        {primaryPipeline.steps.length}...
                      </span>
                    </>
                  ) : allDone ? (
                    <>
                      <CheckCircle2 size={13} className="text-emerald-400" />
                      <span>All {primaryPipeline.steps.length} Steps Finished</span>
                    </>
                  ) : completedCount > 0 ? (
                    <>
                      <Play size={12} fill="currentColor" />
                      <span>
                        {pendingCount === 1
                          ? `Run Step ${firstPendingIdx + 1} (${
                              primaryPipeline.steps[firstPendingIdx]?.label ||
                              'New Step'
                            })`
                          : `Continue Workflow (${pendingCount} Steps from Step ${
                              firstPendingIdx + 1
                            })`}
                      </span>
                    </>
                  ) : (
                    <>
                      <Play size={12} fill="currentColor" />
                      <span>Run {primaryPipeline.steps.length}-Step Workflow</span>
                    </>
                  )}
                </button>

                {/* Prominent "+ Extend Workflow" Button when all finished */}
                {allDone && !runningPipelineId && (
                  <button
                    type="button"
                    onClick={() => onAddPipelineStep(primaryPipeline.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold text-xs shadow-md shadow-indigo-500/20 transition-all cursor-pointer animate-fadeIn"
                  >
                    <Plus size={13} />
                    <span>+ Extend Workflow with Next Step</span>
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Section 3: Conversation & Task Sessions History */}
      <div className="flex-1 flex flex-col min-h-0 p-3.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Session Threads ({agentTasks.length})
          </span>
          {agentTasks.some((t) => t.status !== 'running') && (
            <button
              type="button"
              disabled={!!runningPipelineId}
              onClick={onClearFinished}
              className={`text-[10px] flex items-center gap-1 transition-colors ${
                runningPipelineId
                  ? 'text-slate-600 cursor-not-allowed opacity-40'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
              title={
                runningPipelineId
                  ? 'Cannot clear sessions while pipeline is running'
                  : 'Clear all completed/finished tasks'
              }
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
                    if (runningPipelineId) return; // Prevent thread context menu deletion during pipeline run
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

                      {task.status !== 'running' && !runningPipelineId && (
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

      {/* Resizable Divider Handle on Right Border */}
      <div
        onMouseDown={handleResizeMouseDown}
        title="Drag left/right to resize Sidebar"
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-500/60 z-30 transition-colors"
      />

      <SidebarItemContextMenu
        target={contextMenuTarget}
        onClose={() => setContextMenuTarget(null)}
      />

      {/* Confirmation Modal when Modifying Pipeline In Progress */}
      {resetConfirmAction && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-amber-500/60 rounded-xl p-4 text-slate-100 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs mb-2">
              <ShieldAlert size={16} />
              <span>Workflow in Progress</span>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Modifying the workflow steps while in progress will cancel the active pipeline run and reset progress back to Step 1.
              Do you want to proceed?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetConfirmAction(null)}
                className="px-3 py-1.5 text-xs rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Keep Running
              </button>
              <button
                type="button"
                onClick={() => {
                  onCancelPipeline?.();
                  resetConfirmAction();
                  setResetConfirmAction(null);
                }}
                className="px-3.5 py-1.5 text-xs rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-sm transition-colors"
              >
                Reset from Zero &amp; Modify
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
