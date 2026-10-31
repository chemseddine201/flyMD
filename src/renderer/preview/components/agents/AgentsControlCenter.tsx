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
  FolderGit2,
  FolderTree,
  Boxes,
  Brain,
  FileText,
  Rocket,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Play,
  Copy,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { usePreviewStore, selectActiveTab } from '../../store';
import {
  AGENT_INTENT_PRESETS,
  BUILTIN_AGENT_PIPELINES,
  STARTER_CUSTOM_PIPELINE_ACTIONS,
} from '../../../../shared/constants';
import {
  AgentId,
  AgentPipelinePreset,
  AgentPipelineStep,
  AgentTaskIntent,
  AgentTaskRecord,
  CustomPipelineAction,
  AgentEffortLevel,
} from '../../../../shared/types';
import { AgentStudioSidebar } from './studio/AgentStudioSidebar';
import { AgentChatTimeline } from './studio/AgentChatTimeline';
import { AgentProgressInspector } from './studio/AgentProgressInspector';
import { DiscussionStudio } from './studio/DiscussionStudio';
import { ProjectTreeNavigator } from './projects/ProjectTreeNavigator';
import { ProjectObservabilityHUD } from './projects/ProjectObservabilityHUD';
import { ProjectSynthesisReportViewer } from './projects/ProjectSynthesisReportViewer';
import { CustomPipelineActionsModal } from './studio/CustomPipelineActionsModal';

export interface RecoveryModalDecision {
  action: 'continue_from_breakpoint' | 'revert_and_retry' | 'pause';
  overrideAgentId?: AgentId;
  overrideEffortLevel?: AgentEffortLevel;
  overrideThinkingEnabled?: boolean;
  extraDirective?: string;
}

// Module-level pipeline runtime controller so viewMode / tab switches never orphan an active pipeline run
const globalPipelineRuntime: {
  cancelled: boolean;
  proceedResolver: (() => void) | null;
  recoveryResolver: ((decision: RecoveryModalDecision) => void) | null;
} = {
  cancelled: false,
  proceedResolver: null,
  recoveryResolver: null,
};

interface AgentsControlCenterProps {
  folderPath?: string;
  activeTab?: { id: string; filePath?: string; title?: string };
  supervisionConfig?: any;
}

export const AgentsControlCenter: React.FC<AgentsControlCenterProps> = ({
  folderPath: propFolderPath,
  activeTab: propActiveTab,
  supervisionConfig: propSupervisionConfig,
}) => {
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

  // Persistent Workflow & Pipeline Execution State from Global Store (survives viewMode switches)
  const pipelines = usePreviewStore((s) => s.pipelines);
  const setPipelines = usePreviewStore((s) => s.setPipelines);
  const runningPipelineId = usePreviewStore((s) => s.runningPipelineId);
  const setRunningPipelineId = usePreviewStore((s) => s.setRunningPipelineId);
  const runningPipelineStepIdx = usePreviewStore((s) => s.runningPipelineStepIdx);
  const setRunningPipelineStepIdx = usePreviewStore(
    (s) => s.setRunningPipelineStepIdx
  );
  const waitingForStepApproval = usePreviewStore((s) => s.waitingForStepApproval);
  const setWaitingForStepApproval = usePreviewStore(
    (s) => s.setWaitingForStepApproval
  );
  const assignedReportDoc = usePreviewStore((s) => s.assignedReportDoc);
  const setAssignedReportDoc = usePreviewStore((s) => s.setAssignedReportDoc);
  const lifecycleStage = usePreviewStore((s) => s.agentLifecycleStage);
  const setLifecycleStage = usePreviewStore((s) => s.setAgentLifecycleStage);

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
  const [showProjectTree, setShowProjectTree] = useState<boolean>(true);
  const [showObservabilityHUD, setShowObservabilityHUD] = useState<boolean>(false);
  const [workspaceFocusMode, setWorkspaceFocusMode] = useState<'workspace' | 'file'>('workspace');
  const [focusFilePath, setFocusFilePath] = useState<string>('');

  const projects = usePreviewStore((s) => s.projects);
  const selectedProjectId = usePreviewStore((s) => s.selectedProjectId);
  const activeProject = usePreviewStore((s) => s.activeProject);
  const loadProjects = usePreviewStore((s) => s.loadProjects);
  const rollupProject = usePreviewStore((s) => s.rollupProject);
  const activeReportMarkdown = usePreviewStore((s) => s.activeReportMarkdown);
  const appendProjectMemory = usePreviewStore((s) => s.appendProjectMemory);
  const injectGuidance = usePreviewStore((s) => s.injectGuidance);

  const isPipelineCancelledRef = {
    get current() {
      return globalPipelineRuntime.cancelled;
    },
    set current(val: boolean) {
      globalPipelineRuntime.cancelled = val;
    },
  };

  // Workflow Execution Mode: 'auto' (uninterrupted relay) vs. 'manual' (step approval required)
  const [workflowExecutionMode, setWorkflowExecutionMode] = useState<'auto' | 'manual'>(() => {
    try {
      return (localStorage.getItem('flymd:workflow-execution-mode') as 'auto' | 'manual') || 'auto';
    } catch {
      return 'auto';
    }
  });

  const handleSetWorkflowExecutionMode = (mode: 'auto' | 'manual') => {
    setWorkflowExecutionMode(mode);
    try {
      localStorage.setItem('flymd:workflow-execution-mode', mode);
    } catch {}
  };

  const proceedNextStepResolverRef = {
    get current() {
      return globalPipelineRuntime.proceedResolver;
    },
    set current(val: (() => void) | null) {
      globalPipelineRuntime.proceedResolver = val;
    },
  };

  const handleProceedNextWorkflowStep = () => {
    if (proceedNextStepResolverRef.current) {
      const resolve = proceedNextStepResolverRef.current;
      proceedNextStepResolverRef.current = null;
      resolve();
    }
  };

  // Live Reconciliation: Ensure `runningPipelineId`, `runningPipelineStepIdx`, and `step.status`
  // stay synchronized with live `agentTasks` across remounts or background updates.
  useEffect(() => {
    const primary = pipelines[0];
    if (!primary) return;

    const runningTaskForPipeline = agentTasks.find(
      (t) => t.status === 'running' && t.pipelineId === primary.id
    );

    if (runningTaskForPipeline && !runningPipelineId) {
      // Find matching step index by completedTaskId or intent
      let matchIdx = primary.steps.findIndex(
        (s) => s.completedTaskId === runningTaskForPipeline.id
      );
      if (matchIdx === -1) {
        matchIdx = primary.steps.findIndex(
          (s) =>
            s.status === 'running' ||
            (s.intent === runningTaskForPipeline.intent && s.status !== 'completed')
        );
      }
      setRunningPipelineId(primary.id);
      if (matchIdx !== -1) {
        setRunningPipelineStepIdx(matchIdx);
      }
    }
  }, [agentTasks, pipelines, runningPipelineId, setRunningPipelineId, setRunningPipelineStepIdx]);

  // Ensure selectedAgentId stays within enabled visibleAgents
  useEffect(() => {
    if (
      visibleAgents.length > 0 &&
      !visibleAgents.some((a) => a.id === selectedAgentId)
    ) {
      setSelectedAgentId(visibleAgents[0].id);
    }
  }, [visibleAgents, selectedAgentId]);

  // User-Defined Custom Pipeline Actions Library
  const [customActions, setCustomActions] = useState<CustomPipelineAction[]>(() => {
    try {
      const saved = localStorage.getItem('flymd:custom-pipeline-actions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return STARTER_CUSTOM_PIPELINE_ACTIONS;
  });

  const [showCustomActionsModal, setShowCustomActionsModal] = useState<boolean>(false);

  const handleSaveCustomAction = (action: CustomPipelineAction) => {
    setCustomActions((prev) => {
      const existingIdx = prev.findIndex((a) => a.id === action.id);
      let updated: CustomPipelineAction[];
      if (existingIdx >= 0) {
        updated = prev.map((a, idx) => (idx === existingIdx ? action : a));
      } else {
        updated = [...prev, action];
      }
      try {
        localStorage.setItem(
          'flymd:custom-pipeline-actions',
          JSON.stringify(updated)
        );
      } catch {}
      return updated;
    });
  };

  const handleDeleteCustomAction = (actionId: string) => {
    setCustomActions((prev) => {
      const filtered = prev.filter((a) => a.id !== actionId);
      try {
        localStorage.setItem(
          'flymd:custom-pipeline-actions',
          JSON.stringify(filtered)
        );
      } catch {}
      return filtered;
    });
  };

  const [cwdWorkspace, setCwdWorkspace] = useState<string>('');

  useEffect(() => {
    if (!folderPath && !propFolderPath && window.electronAPI?.getCurrentWorkingDirectory) {
      window.electronAPI.getCurrentWorkingDirectory().then((cwd) => {
        if (cwd && cwd !== '.') {
          setCwdWorkspace(cwd);
        }
      }).catch(() => {});
    }
  }, [folderPath, propFolderPath]);

  const resolvedWorkspace =
    propFolderPath ||
    folderPath ||
    propSupervisionConfig?.path ||
    supervisionConfig?.path ||
    (propActiveTab?.filePath ? propActiveTab.filePath.replace(/[\\/][^\\/]+$/, '') : '') ||
    (activeTab?.filePath ? activeTab.filePath.replace(/[\\/][^\\/]+$/, '') : '') ||
    cwdWorkspace ||
    (typeof window !== 'undefined' ? (window as any)._flymd_last_workspace : '') ||
    '.';

  // Live Progress Inspector resizable width (persisted)
  const [inspectorWidth, setInspectorWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('flymd:agents-inspector-width');
      return saved ? parseInt(saved, 10) : 340;
    } catch {
      return 340;
    }
  });

  const isInspectorResizingRef = useRef(false);

  const handleInspectorResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isInspectorResizingRef.current = true;
    const startX = e.clientX;
    const startWidth = inspectorWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isInspectorResizingRef.current) return;
      const delta = startX - moveEvent.clientX;
      const newWidth = Math.max(260, Math.min(750, startWidth + delta));
      setInspectorWidth(newWidth);
      try {
        localStorage.setItem('flymd:agents-inspector-width', String(newWidth));
      } catch {}
    };

    const handleMouseUp = () => {
      isInspectorResizingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const selectedTask =
    agentTasks.find((t) => t.id === selectedTaskId) || agentTasks[0] || null;

  useEffect(() => {
    if (resolvedWorkspace) {
      loadProjects(resolvedWorkspace);
    }
  }, [resolvedWorkspace, loadProjects]);

  const [completedPipelineSummary, setCompletedPipelineSummary] = useState<{
    pipelineName: string;
    stepsCount: number;
    filesCreated: number;
    lastTaskOutput?: string;
  } | null>(null);

  // Interactive Pipeline & Task Error Recovery Modal State
  const [pendingRecoveryPrompt, setPendingRecoveryPrompt] = useState<{
    failedTask: AgentTaskRecord;
    pipeline?: AgentPipelinePreset;
    stepIdx?: number;
    stepLabel?: string;
    isLivePipelinePause: boolean;
  } | null>(null);
  const [recoveryAgentId, setRecoveryAgentId] = useState<AgentId>('');
  const [recoveryEffortLevel, setRecoveryEffortLevel] = useState<AgentEffortLevel>('medium');
  const [recoveryThinkingEnabled, setRecoveryThinkingEnabled] = useState<boolean>(true);
  const [recoveryExtraDirective, setRecoveryExtraDirective] = useState<string>('');
  const [recoveryCopiedLog, setRecoveryCopiedLog] = useState<boolean>(false);
  const [recoveryShowStderr, setRecoveryShowStderr] = useState<boolean>(false);

  const cancelActivePipelineRun = async (targetPipelineId?: string) => {
    const storeState = usePreviewStore.getState();
    const activePipeId = targetPipelineId || storeState.runningPipelineId;
    isPipelineCancelledRef.current = true;
    storeState.setRunningPipelineId(null);
    storeState.setRunningPipelineStepIdx(-1);
    storeState.setWaitingForStepApproval(null);
    setPendingRecoveryPrompt(null);
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
  };

  const handleLaunchDedicatedPipeline = async (
    preset: AgentPipelinePreset,
    reportMarkdown: string
  ) => {
    setPipelines((prev) => [preset, ...prev.filter((p) => p.id !== preset.id)]);
    setAssignedReportDoc({
      pipelineId: preset.id,
      pipelineName: preset.name,
      reportMarkdown,
      assignedAt: new Date().toLocaleTimeString(),
    });

    if (resolvedWorkspace && activeProject) {
      await appendProjectMemory(
        resolvedWorkspace,
        activeProject.id,
        'operator',
        'decision',
        `Assigned Dedicated Pipeline: ${preset.name} (${preset.steps.length} steps)`,
        `Pipeline created from synthesis report with ${preset.steps.length} execution tasks.`,
        ['pipeline', 'provision', 'contract']
      );
    }
    setLifecycleStage('pipeline');
  };

  const handleSendBackToDebate = async (
    feedback: string,
    reportMarkdown: string
  ) => {
    if (resolvedWorkspace && activeProject) {
      await appendProjectMemory(
        resolvedWorkspace,
        activeProject.id,
        'operator',
        'decision',
        `Operator Steering & Re-deliberation Directive`,
        `Feedback: ${feedback}\n\nReport Context:\n${reportMarkdown}`,
        ['steering', 'recycle', 'feedback']
      );
    }
    try {
      await injectGuidance(
        `[OPERATOR RE-DELIBERATION GUIDANCE]: ${feedback}\n\nPlease re-evaluate previous assumptions and consensus points in light of this guidance.`
      );
    } catch {}
    setLifecycleStage('debate');
  };

  const handleAuditDeliverablesInDebate = async () => {
    if (resolvedWorkspace && activeProject) {
      await appendProjectMemory(
        resolvedWorkspace,
        activeProject.id,
        'pipeline',
        'deliverable',
        `Completed Pipeline Execution Deliverables: ${completedPipelineSummary?.pipelineName || 'Tasks'}`,
        completedPipelineSummary?.lastTaskOutput || 'Deliverables generated by pipeline execution.',
        ['evidence', 'deliverables', 'audit']
      );
    }
    try {
      await injectGuidance(
        `[EMPIRICAL DELIVERABLES AUDIT]: Pipeline execution has completed deliverables for "${completedPipelineSummary?.pipelineName || activeProject?.name}". All models: audit generated files and verify invariants against original requirements.`
      );
    } catch {}
    setLifecycleStage('debate');
  };

  const handleRollupToMaster = async () => {
    if (!resolvedWorkspace || !activeProject) return;
    const summary = `### [Project: ${activeProject.name}] — Completed\n- **Status**: Verified by evidence\n- **Scope**: ${activeProject.scope_paths.join(', ') || 'Entire Workspace'}\n- **Timestamp**: ${new Date().toISOString()}\n`;
    await rollupProject(resolvedWorkspace, activeProject.id, summary);
  };

  const effectiveReportMarkdown = useMemo(() => {
    if (activeReportMarkdown && activeReportMarkdown.trim().length > 0) {
      return activeReportMarkdown;
    }
    const projName = activeProject?.name || 'General Project Task';
    const projDesc =
      activeProject?.description ||
      'Structured execution plan, objectives, and deliverables.';
    return `# Synthesis Report & Execution Contract: ${projName}

- **Project Node**: \`${activeProject?.id || 'root'}\`
- **Scope Paths**: ${
      activeProject?.scope_paths?.length
        ? activeProject.scope_paths.join(', ')
        : 'Entire Workspace'
    }
- **Epistemic Classification**: \`[Agent Consensus]\`

---

## 1. Executive Summary & Objectives
${projDesc}

## 2. Actionable Implementation Checklist
- [ ] Review specifications, domain objectives, and requirements
- [ ] Implement core content, deliverables, or target components
- [ ] Cross-validate deliverables against constraints and criteria
- [ ] Audit final outputs, settle deliverables, and mark milestone complete

## 3. Epistemic Acceptance Criteria
- Clear alignment with core project goals
- Rigorous verification of constraints and deliverables
- Evidence before done: all artifacts and deliverables settled cleanly
`;
  }, [activeReportMarkdown, activeProject]);

  const handleUpdatePipelineStep = (
    pipelineId: string,
    stepIdx: number,
    updates: Partial<AgentPipelineStep>
  ) => {
    // Updating a step note on a pending step does not cancel the pipeline
    const isOnlyNoteUpdate =
      Object.keys(updates).length === 1 && 'stepNote' in updates;
    if (runningPipelineId === pipelineId && !isOnlyNoteUpdate) {
      cancelActivePipelineRun(pipelineId);
    }
    setPipelines((prev) =>
      prev.map((p) => {
        if (p.id !== pipelineId) return p;
        const steps = p.steps.map((s, idx) =>
          idx === stepIdx ? { ...s, ...updates } : s
        );
        return { ...p, steps };
      })
    );
  };

  const handleAddPipelineStep = (pipelineId: string) => {
    if (runningPipelineId === pipelineId) {
      cancelActivePipelineRun(pipelineId);
    }
    const defaultAgent = visibleAgents[0]?.id || 'antigravity';
    setPipelines((prev) =>
      prev.map((p) => {
        if (p.id !== pipelineId) return p;
        const nextIntent: AgentTaskIntent =
          p.steps.length === 0
            ? 'refine-plan'
            : p.steps.length === 1
            ? 'build'
            : p.steps.length === 2
            ? 'review'
            : 'fix-bugs';
        const presetLabel =
          AGENT_INTENT_PRESETS.find((ip) => ip.id === nextIntent)?.title ||
          nextIntent;
        const newStep: AgentPipelineStep = {
          stepId: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          agentId: defaultAgent,
          intent: nextIntent,
          label: `${p.steps.length + 1}. ${presetLabel}`,
          requireConfirmation: false,
          status: 'pending',
        };
        return {
          ...p,
          steps: [...p.steps, newStep],
        };
      })
    );
  };

  const handleClearStepDoneStatus = (pipelineId: string) => {
    setPipelines((prev) =>
      prev.map((p) => {
        if (p.id !== pipelineId) return p;
        const steps = p.steps.map((s) => ({
          ...s,
          status: 'pending' as const,
          completedTaskId: undefined,
          completedAt: undefined,
        }));
        return { ...p, steps };
      })
    );
  };

  const handleRemovePipelineStep = (pipelineId: string, stepIdx: number) => {
    if (runningPipelineId === pipelineId) {
      cancelActivePipelineRun(pipelineId);
    }
    setPipelines((prev) =>
      prev.map((p) => {
        if (p.id !== pipelineId) return p;
        if (p.steps.length <= 1) return p;
        const steps = p.steps.filter((_, idx) => idx !== stepIdx);
        return { ...p, steps };
      })
    );
  };

  const handleResetPipelines = () => {
    if (runningPipelineId) {
      cancelActivePipelineRun(runningPipelineId);
    }
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
    // Workspace-First Root Architecture: default to entire project workspace unless user pinned a specific file
    if (workspaceFocusMode === 'workspace' && !overridePath && resolvedWorkspace) {
      const wsName = resolvedWorkspace.split(/[\\/]/).pop() || 'Project-Workspace';
      return {
        filePath: resolvedWorkspace,
        fileName: `Entire Project (${wsName})`,
        markdownContent:
          activeTab?.content ||
          `# Project Workspace: ${wsName}\n\nManaging full multi-file codebase and system architecture.\n`,
      };
    }

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
      (workspaceFocusMode === 'file' && focusFilePath ? focusFilePath : '') ||
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
      epistemicPolicy?: 'collaborative' | 'independent-audit';
      customActionLabel?: string;
      stepNote?: string;
      attemptCount?: number;
      resumeSessionId?: string;
      resumeFromBreakpoint?: boolean;
      previousFailedTaskId?: string;
      effortLevel?: AgentEffortLevel;
      thinkingEnabled?: boolean;
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
        epistemicPolicy: overrides?.epistemicPolicy,
        customActionLabel: overrides?.customActionLabel,
        stepNote: overrides?.stepNote,
        attemptCount: overrides?.attemptCount,
        resumeSessionId: overrides?.resumeSessionId,
        resumeFromBreakpoint: overrides?.resumeFromBreakpoint,
        previousFailedTaskId: overrides?.previousFailedTaskId,
        effortLevel: overrides?.effortLevel ?? 'medium',
        thinkingEnabled: overrides?.thinkingEnabled ?? true,
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

  // Helper to reliably await a task reaching a terminal state (completed, cancelled, failed) without premature timeout
  const waitForTaskFinished = (taskId: string): Promise<AgentTaskRecord | null> => {
    return new Promise((resolve) => {
      const checkTerminal = () => {
        const tasks = usePreviewStore.getState().agentTasks;
        const found = tasks.find((t) => t.id === taskId);
        if (
          found &&
          (found.status === 'completed' ||
            found.status === 'incomplete' ||
            found.status === 'cancelled' ||
            found.status === 'failed')
        ) {
          return found;
        }
        return null;
      };

      const immediate = checkTerminal();
      if (immediate) {
        resolve(immediate);
        return;
      }

      const timer = setInterval(async () => {
        if (isPipelineCancelledRef.current) {
          clearInterval(timer);
          resolve(null);
          return;
        }
        try {
          const tasks = await window.electronAPI.getAgentTasks();
          usePreviewStore.getState().setAgentTasks(tasks);
          const found = tasks.find((t) => t.id === taskId);
          if (
            found &&
            (found.status === 'completed' ||
              found.status === 'incomplete' ||
              found.status === 'cancelled' ||
              found.status === 'failed')
          ) {
            clearInterval(timer);
            resolve(found);
          }
        } catch {
          // ignore transient poll error
        }
      }, 750);
    });
  };

  // Passes the full detailed Markdown implementation plan when transitioning from `refine-plan` to `build`,
  // and withholds subjective upstream prose on adversarial verification steps (`review` / `fix-bugs`) to prevent confirmation bias.
  const composeEpistemicStepPayload = (
    originalContract: string,
    upstreamOutput: string | undefined,
    targetIntent: AgentTaskIntent,
    isFirstStep: boolean,
    upstreamAgentId?: string,
    upstreamIntent?: AgentTaskIntent
  ): string => {
    const cleanContract = (originalContract || '').trim();
    const cleanUpstream = (upstreamOutput || '').trim();

    if (isFirstStep || !cleanUpstream) {
      return cleanContract || cleanUpstream;
    }

    // Blind Audit / Ground-Truth Rebuild: withhold upstream subjective prose summary so Critic/Reviewer
    // inspects raw disk files against the Immutable Original Contract and concludes its own résumé first.
    if (targetIntent === 'review' || targetIntent === 'fix-bugs') {
      return cleanContract || cleanUpstream;
    }

    // Plan -> Build Handoff: When upstream step was `refine-plan` or target step is `build`,
    // pass the FULL detailed Markdown implementation plan without truncation so the Builder
    // has every architectural specification, file breakdown, DOM ID, formula, and checklist item.
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
  };

  const handleRunPipelineInStudio = async (
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

    // Find the first step that is not yet completed (Incremental Extension)
    const firstPendingIdx =
      initialRecovery?.stepIdx !== undefined && initialRecovery.stepIdx >= 0
        ? initialRecovery.stepIdx
        : pipeline.steps.findIndex((s) => s.status !== 'completed');
    if (firstPendingIdx === -1) {
      // All steps already completed
      return;
    }

    store.setRunningPipelineId(pipeline.id);
    isPipelineCancelledRef.current = false;

    try {
      let previousTask: AgentTaskRecord | null = null;
      if (firstPendingIdx > 0) {
        const prevCompletedStep = pipeline.steps[firstPendingIdx - 1];
        if (prevCompletedStep?.completedTaskId) {
          const allCurrentTasks = usePreviewStore.getState().agentTasks;
          previousTask =
            allCurrentTasks.find(
              (t) => t.id === prevCompletedStep.completedTaskId
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
                overrideThinkingEnabled: initialRecovery.overrideThinkingEnabled,
                extraDirective: initialRecovery.extraDirective,
              }
            : null;

        let stepSucceeded = false;

        while (!isPipelineCancelledRef.current) {
          // If user requested "Revert Modified Files & Retry", restore the safety checkpoint first
          if (
            activeRecoveryForStep?.mode === 'revert_and_retry' &&
            activeRecoveryForStep.failedTask?.checkpointId
          ) {
            await handleRestoreCheckpoint(
              activeRecoveryForStep.failedTask.checkpointId
            );
          }

          // If user switched agent, effort level, or thinking mode in the recovery modal, persist on the step
          if (
            activeRecoveryForStep?.overrideAgentId ||
            activeRecoveryForStep?.overrideEffortLevel ||
            activeRecoveryForStep?.overrideThinkingEnabled !== undefined
          ) {
            const newAg = activeRecoveryForStep?.overrideAgentId;
            const newEffort = activeRecoveryForStep?.overrideEffortLevel;
            const newThinking = activeRecoveryForStep?.overrideThinkingEnabled;
            usePreviewStore.getState().setPipelines((prev) =>
              prev.map((p) => {
                if (p.id !== pipeline.id) return p;
                const steps = p.steps.map((s, sIdx) =>
                  sIdx === idx
                    ? {
                        ...s,
                        ...(newAg ? { agentId: newAg } : {}),
                        ...(newEffort ? { effortLevel: newEffort } : {}),
                        ...(newThinking !== undefined
                          ? { thinkingEnabled: newThinking }
                          : {}),
                      }
                    : s
                );
                return { ...p, steps };
              })
            );
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

          // Mark current step as running in global store (persisted immediately)
          usePreviewStore.getState().setPipelines((prev) =>
            prev.map((p) => {
              if (p.id !== pipeline.id) return p;
              const steps = p.steps.map((s, sIdx) =>
                sIdx === idx ? { ...s, status: 'running' as const } : s
              );
              return { ...p, steps };
            })
          );

          const isFirstStep = idx === 0;
          const currentAssignedReport =
            usePreviewStore.getState().assignedReportDoc || assignedReportDoc;
          const assignedReport =
            currentAssignedReport?.pipelineId === pipeline.id ||
            currentAssignedReport
              ? currentAssignedReport
              : null;

          const initialDocContent =
            assignedReport?.reportMarkdown || activeTab?.content || '';
          const initialDocName = assignedReport
            ? `${assignedReport.pipelineName.replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, '_')}_Contract.md`
            : activeTab?.fileName || 'IMPLEMENTATION_PLAN.md';

          const stepContextTag = assignedReport
            ? ` | Contract: "${assignedReport.pipelineName}"`
            : '';

          const customAct = currentStep.customActionId
            ? customActions.find((a) => a.id === currentStep.customActionId) ||
              STARTER_CUSTOM_PIPELINE_ACTIONS.find(
                (a) => a.id === currentStep.customActionId
              )
            : null;

          let promptText = `Pipeline [${pipeline.name}] — Step ${idx + 1}/${
            pipeline.steps.length
          } (${currentStep.label})${
            previousTask ? ` relayed from @${previousTask.targetAgentId}` : ''
          }${stepContextTag}`;

          if (customAct?.promptTemplate) {
            promptText = `${promptText}\n\n[Action Directive]: ${customAct.promptTemplate}`;
          }

          // Check if current step previously failed deliverable verification
          const priorTask =
            activeRecoveryForStep?.failedTask ||
            (currentStep.completedTaskId
              ? usePreviewStore
                  .getState()
                  .agentTasks.find((t) => t.id === currentStep.completedTaskId)
              : undefined);

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

          if (activeRecoveryForStep?.mode === 'continue_from_breakpoint') {
            promptText = `[BREAKPOINT CONTINUATION MODE]: Continue from the last breakpoint where the previous run stopped. Keep all valid files already written in the workspace, complete any unfinished or missing files, and verify all deliverables.\n\n${promptText}`;
          } else if (activeRecoveryForStep?.mode === 'revert_and_retry') {
            promptText = `[CLEAN RETRY AFTER CHECKPOINT ROLLBACK]: Modified files from the interrupted run were reverted to the pre-task safety checkpoint. Execute this step cleanly and write each deliverable file incrementally.\n\n${promptText}`;
          }

          const combinedStepNote = [
            currentStep.stepNote,
            activeRecoveryForStep?.extraDirective,
          ]
            .filter(Boolean)
            .join('\n');

          if (combinedStepNote) {
            promptText = `[STEP ${idx + 1} DIRECTIVE / ERROR REPORT]:\n${combinedStepNote}\n\n${promptText}`;
          }

          const effectivePolicy =
            customAct?.epistemicPolicy ||
            (currentStep.intent === 'review' ||
            currentStep.intent === 'fix-bugs'
              ? 'independent-audit'
              : 'collaborative');

          // If previous step was `refine-plan` (or created a `.md` plan file on disk), read the full `.md` implementation plan from disk
          let upstreamPlanMarkdown = previousTask?.responseMarkdown;
          let resolvedPlanFilePath = previousTask?.filePath;
          let resolvedPlanFileName = previousTask?.fileName || initialDocName;

          if (!isFirstStep && previousTask && resolvedWorkspace) {
            const sep = resolvedWorkspace.includes('\\') ? '\\' : '/';
            const checkedMdFile =
              previousTask.verificationReport?.checkedFiles?.find((f) =>
                f.toLowerCase().endsWith('.md')
              );
            const candidateMdNames = [
              checkedMdFile,
              previousTask.fileName?.toLowerCase().endsWith('.md')
                ? previousTask.fileName
                : undefined,
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
                    diskRes.name ||
                    mdName.split(/[\\/]/).pop() ||
                    initialDocName;
                  break;
                }
              } catch {}
            }
          }

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
            usePreviewStore.getState().setPipelines((prev) =>
              prev.map((p) => {
                if (p.id !== pipeline.id) return p;
                const steps = p.steps.map((s, sIdx) =>
                  sIdx === idx ? { ...s, status: 'failed' as const } : s
                );
                return { ...p, steps };
              })
            );
            break;
          }

          // Immediately bind `completedTaskId: dispatchedTask.id` while `status: 'running'`
          usePreviewStore.getState().setPipelines((prev) =>
            prev.map((p) => {
              if (p.id !== pipeline.id) return p;
              const steps = p.steps.map((s, sIdx) =>
                sIdx === idx
                  ? {
                      ...s,
                      status: 'running' as const,
                      completedTaskId: dispatchedTask.id,
                    }
                  : s
              );
              return { ...p, steps };
            })
          );

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

          // Reliably await task completion before executing the next step
          const completed = await waitForTaskFinished(dispatchedTask.id);
          if (isPipelineCancelledRef.current || !completed) {
            break;
          }

          if (completed.status === 'completed') {
            // Mark this step permanently completed in global store
            usePreviewStore.getState().setPipelines((prev) =>
              prev.map((p) => {
                if (p.id !== pipeline.id) return p;
                const steps = p.steps.map((s, sIdx) =>
                  sIdx === idx
                    ? {
                        ...s,
                        status: 'completed' as const,
                        completedTaskId: completed.id,
                        completedAt: Date.now(),
                      }
                    : s
                );
                return { ...p, steps };
              })
            );
            previousTask = completed;
            stepSucceeded = true;
            break;
          }

          // Task ended with 'incomplete' or 'failed' (or 'cancelled')
          const terminalStatus =
            completed.status === 'incomplete'
              ? 'incomplete'
              : completed.status === 'failed'
              ? 'failed'
              : 'pending';

          usePreviewStore.getState().setPipelines((prev) =>
            prev.map((p) => {
              if (p.id !== pipeline.id) return p;
              const steps = p.steps.map((s, sIdx) =>
                sIdx === idx
                  ? {
                      ...s,
                      status: terminalStatus as any,
                      completedTaskId: completed.id,
                    }
                  : s
              );
              return { ...p, steps };
            })
          );

          if (completed.status === 'cancelled') {
            break;
          }

          // Interactive Error Recovery Prompt: Ask the user whether to Continue from Last Breakpoint
          // (keeping modified files) OR Revert Modified Files & Retry Cleanly!
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

        if (!stepSucceeded || isPipelineCancelledRef.current) {
          break;
        }

        const latestPipelinesAfterStep = usePreviewStore.getState().pipelines;
        const livePipeAfter =
          latestPipelinesAfterStep.find((p) => p.id === pipeline.id) ||
          pipeline;
        const nextStepAfter =
          livePipeAfter.steps[idx + 1] || pipeline.steps[idx + 1];

        // If there is a next step and Manual mode is active, pause and request user approval
        if (
          idx + 1 < pipeline.steps.length &&
          workflowExecutionMode === 'manual' &&
          previousTask
        ) {
          const currentProfiles = usePreviewStore.getState().agentProfiles;
          const nextAgent = currentProfiles.find(
            (a) => a.id === nextStepAfter?.agentId
          );
          const touchedFiles = (previousTask.toolActions || []).filter(
            (a) => a.kind === 'write' || a.label.toLowerCase().includes('file')
          ).length;

          usePreviewStore.getState().setWaitingForStepApproval({
            completedStepIdx: idx,
            nextStepIdx: idx + 1,
            nextAgentName: nextAgent?.name || nextStepAfter?.agentId || 'Agent',
            nextIntent: nextStepAfter?.intent || 'next step',
            completedTaskId: previousTask.id,
            filesCreatedCount: touchedFiles,
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
            (a) => a.kind === 'write' || a.label.toLowerCase().includes('file')
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
  };

  // Executes standalone or pipeline task recovery (Continue from Last Breakpoint vs Revert Modified Files & Retry)
  const executeRecoveryDecision = async (
    failedTask: AgentTaskRecord,
    mode: 'continue_from_breakpoint' | 'revert_and_retry',
    pipeline?: AgentPipelinePreset,
    stepIdx?: number,
    overrideAgentId?: AgentId,
    extraDirective?: string,
    overrideEffortLevel?: AgentEffortLevel,
    overrideThinkingEnabled?: boolean
  ) => {
    // 1. If a live pipeline run is paused awaiting globalPipelineRuntime.recoveryResolver, resolve it directly!
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

    // 2. Check if this task belongs to a pipeline step
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

    // 3. Standalone task recovery (outside a pipeline)
    if (mode === 'revert_and_retry' && failedTask.checkpointId) {
      await handleRestoreCheckpoint(failedTask.checkpointId);
    }

    const targetAg = overrideAgentId || failedTask.targetAgentId;
    setSelectedAgentId(targetAg);
    setSelectedIntent(failedTask.intent);

    const basePrompt =
      failedTask.customPrompt ||
      `Execute ${failedTask.intent} on ${failedTask.fileName}`;
    const recoveryPrefix =
      mode === 'continue_from_breakpoint'
        ? `[BREAKPOINT CONTINUATION MODE]: Continue from the last breakpoint where the previous task stopped. Keep all valid files already written in the workspace, complete any unfinished or missing files, and verify all deliverables.`
        : `[CLEAN RETRY AFTER CHECKPOINT ROLLBACK]: Modified files from the interrupted run were reverted to the pre-task safety checkpoint. Execute this task cleanly and write each deliverable file incrementally.`;

    const fullPrompt = [
      recoveryPrefix,
      extraDirective ? `[RECOVERY DIRECTIVE]: ${extraDirective}` : '',
      basePrompt,
    ]
      .filter(Boolean)
      .join('\n\n');

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
  };

  const handleRecoverTask = async (
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
  };

  const handleRecoverPipelineStep = (
    pipeline: AgentPipelinePreset,
    stepIdx: number,
    linkedTask?: AgentTaskRecord
  ) => {
    const step = pipeline.steps[stepIdx];
    const targetTask =
      linkedTask ||
      (step?.completedTaskId
        ? agentTasks.find((t) => t.id === step.completedTaskId)
        : undefined) ||
      agentTasks.find(
        (t) =>
          (t.pipelineId === pipeline.id || t.intent === step?.intent) &&
          (t.status === 'incomplete' || t.status === 'failed')
      ) ||
      selectedTask;

    if (!targetTask) {
      // No prior task record found — simply run the pipeline from this step
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
  };

  const handleRelayToNextAgent = async (
    task: AgentTaskRecord,
    nextAgentId: AgentId,
    nextIntent: AgentTaskIntent,
    customActionId?: string,
    effortLevel?: AgentEffortLevel,
    thinkingEnabled?: boolean
  ) => {
    setSelectedAgentId(nextAgentId);
    setSelectedIntent(nextIntent);
    const customAct = customActionId
      ? customActions.find((a) => a.id === customActionId) ||
        STARTER_CUSTOM_PIPELINE_ACTIONS.find((a) => a.id === customActionId)
      : null;

    const originalContract =
      assignedReportDoc?.reportMarkdown || activeTab?.content || '';
    const relayPayload = composeEpistemicStepPayload(
      originalContract,
      task.responseMarkdown,
      nextIntent,
      false,
      task.targetAgentId,
      task.intent as AgentTaskIntent | undefined
    );

    let prompt = `Relayed from @${task.targetAgentId} (${task.intent}) → Continue with ${
      customAct?.name.toUpperCase() || nextIntent.toUpperCase()
    }`;
    if (customAct?.promptTemplate) {
      prompt = `${prompt}\n\n[Action Directive]: ${customAct.promptTemplate}`;
    }

    await handleSendInAppChatTask(prompt, {
      agentId: nextAgentId,
      intent: nextIntent,
      filePath: task.outputReportPath || task.filePath,
      fileName: task.fileName,
      markdownContent: relayPayload,
      sourceAgentId: task.targetAgentId,
      epistemicPolicy: customAct?.epistemicPolicy,
      customActionLabel: customAct?.name,
      effortLevel: effortLevel || 'medium',
      thinkingEnabled: thinkingEnabled ?? true,
    });
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
    if (task.status === 'running' || (runningPipelineId && !waitingForStepApproval)) {
      alert('Cannot paste external reply while an agent or workflow is actively running.');
      return;
    }
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
    isPipelineCancelledRef.current = true;
    setRunningPipelineId(null);
    setRunningPipelineStepIdx(-1);
    if (proceedNextStepResolverRef.current) {
      proceedNextStepResolverRef.current();
    }
    setWaitingForStepApproval(null);
    try {
      await window.electronAPI.cancelAgentTask(taskId);
      const tasks = await window.electronAPI.getAgentTasks();
      setAgentTasks(tasks);
    } catch (err) {
      console.error('Failed to cancel task:', err);
    }
  };

  const handleClearFinished = async () => {
    if (runningPipelineId) return;
    try {
      const remaining = await window.electronAPI.clearAgentTasks();
      setAgentTasks(remaining);
    } catch (err) {
      console.error('Failed to clear finished tasks:', err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (runningPipelineId) return;
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
    if (runningPipelineId) return;
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

          {/* Project Hierarchy Tree Toggle */}
          {resolvedWorkspace && (
            <button
              type="button"
              onClick={() => setShowProjectTree(!showProjectTree)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                showProjectTree
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
              title="Toggle Hierarchical Projects Tree Navigator"
            >
              <FolderTree size={13} className="text-indigo-400" />
              <span>Projects</span>
            </button>
          )}

          {/* Active Project Indicator */}
          {activeProject && (
            <div className="hidden xl:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-950/70 border border-indigo-700/60 text-indigo-300 text-[11px] max-w-[180px] truncate">
              <Boxes size={12} className="shrink-0 text-indigo-400" />
              <span className="truncate">{activeProject.name}</span>
            </div>
          )}

          {/* 3-Stage Linear Lifecycle Switcher */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 ml-1">
            <button
              type="button"
              onClick={() => setLifecycleStage('debate')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                lifecycleStage === 'debate'
                  ? 'bg-sky-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="1. Multi-Agent Deliberation & Architectural Debate"
            >
              <span>🗣️ 1. Debate</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            </button>
            <button
              type="button"
              onClick={() => setLifecycleStage('report')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                lifecycleStage === 'report'
                  ? 'bg-sky-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="2. Synthesis Report & Operator Checkpoint Gate"
            >
              <span>📋 2. Report</span>
            </button>
            <button
              type="button"
              onClick={() => setLifecycleStage('pipeline')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                lifecycleStage === 'pipeline'
                  ? 'bg-sky-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="3. Dedicated DAG Pipeline Execution & Process Isolation"
            >
              <span>🚀 3. Pipeline</span>
            </button>
          </div>

          {/* Workspace-First Target Scope Selector */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-xs ml-2">
            <FolderGit2 size={12} className="text-sky-400 shrink-0" />
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Scope:</span>
            <select
              value={workspaceFocusMode === 'workspace' ? '__root__' : focusFilePath || activeTab?.filePath || ''}
              onChange={(e) => {
                if (e.target.value === '__root__') {
                  setWorkspaceFocusMode('workspace');
                  setFocusFilePath('');
                } else {
                  setWorkspaceFocusMode('file');
                  setFocusFilePath(e.target.value);
                }
              }}
              className="bg-transparent text-slate-200 font-semibold text-[11px] focus:outline-none cursor-pointer border-0 py-0 max-w-[220px] truncate"
              title="Target Scope: Entire Project Workspace vs Specific Focused Document"
            >
              <option value="__root__">
                🌐 Entire Workspace ({resolvedWorkspace ? resolvedWorkspace.split(/[\\/]/).pop() : 'Root'})
              </option>
              {cleanWorkspaceFiles.map((wf) => (
                <option key={wf.path} value={wf.path}>
                  📄 {wf.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setShowCouncilModal(false);
              setShowAgentAccountsModal(false);
              openDispatchModal({
                targetAgentId: selectedAgentId,
                sourceFilePath: activeTab?.filePath || '',
                sourceFileName: activeTab?.fileName || 'Specification.md',
                markdownContent: activeTab?.content || '',
              });
            }}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
            title="Advanced Task Options (Checklist filter, Parallel Worktree, etc.)"
          >
            <SlidersHorizontal size={14} className="text-sky-400" />
          </button>

          <button
            type="button"
            onClick={() => {
              setShowAgentAccountsModal(false);
              setShowCouncilModal(true);
            }}
            className="p-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 transition-colors"
            title="Council Broadcast (Multi-Agent Sync)"
          >
            <Users size={14} />
          </button>

          {resolvedWorkspace && (
            <button
              type="button"
              onClick={() => setShowObservabilityHUD(!showObservabilityHUD)}
              className={`p-2 rounded-lg border transition-colors ${
                showObservabilityHUD
                  ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
              title="Dual-Layer Memory & Observability HUD (Master Memory, Scoped Ledger, Evidence Receipts)"
            >
              <Brain size={14} className="text-purple-400" />
            </button>
          )}

          {resolvedWorkspace && (
            <button
              type="button"
              onClick={handleOpenSharedMemory}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
              title="Open Shared Memory (.flymd/MEMORY.md)"
            >
              <BrainCircuit size={14} className="text-amber-400" />
            </button>
          )}

          {resolvedWorkspace && (
            <button
              type="button"
              onClick={() => {
                setShowCouncilModal(false);
                setShowAgentAccountsModal(false);
                setShowClearCacheModal(true);
              }}
              className="p-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 transition-colors"
              title="Clear Memory & Cache (Handoffs, checkpoints, memory ledger)"
            >
              <Trash2 size={14} className="text-rose-400" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setShowCouncilModal(false);
              setShowAgentAccountsModal(true);
            }}
            className="p-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 transition-colors shadow-sm"
            title="Custom Agents & Logins (API Keys & Profiles)"
          >
            <KeyRound size={14} />
          </button>

          <button
            type="button"
            onClick={handleRefreshAll}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
            title="Refresh Agents & Sessions"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Main Studio Workspace with Project Navigator & Observability HUD */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Far Left: Project Hierarchy Tree Navigator */}
        {showProjectTree && resolvedWorkspace && (
          <ProjectTreeNavigator
            workspacePath={resolvedWorkspace}
            onClose={() => setShowProjectTree(false)}
          />
        )}

        {/* Center: Active Lifecycle Stage */}
        {lifecycleStage === 'debate' ? (
          <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden">
            <DiscussionStudio
              resolvedWorkspace={resolvedWorkspace}
              onNavigateToReport={() => setLifecycleStage('report')}
            />
          </div>
        ) : lifecycleStage === 'report' ? (
          <div className="flex-1 h-full min-h-0 flex flex-col overflow-hidden p-2">
            <ProjectSynthesisReportViewer
              workspacePath={resolvedWorkspace}
              reportMarkdown={effectiveReportMarkdown}
              onLaunchDedicatedPipeline={handleLaunchDedicatedPipeline}
              onRollupToMaster={handleRollupToMaster}
              onSendBackToDebate={handleSendBackToDebate}
            />
          </div>
        ) : (
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
              onCancelPipeline={() => {
                cancelActivePipelineRun(runningPipelineId || pipelines[0]?.id);
              }}
              runningPipelineId={runningPipelineId}
              runningPipelineStepIdx={runningPipelineStepIdx}
              workflowExecutionMode={workflowExecutionMode}
              onSetWorkflowExecutionMode={handleSetWorkflowExecutionMode}
              waitingForStepApproval={waitingForStepApproval}
              onProceedNextWorkflowStep={handleProceedNextWorkflowStep}
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
              customActions={customActions}
              onOpenCustomActionsModal={() => setShowCustomActionsModal(true)}
              onClearStepDoneStatus={handleClearStepDoneStatus}
              onRecoverPipelineStep={handleRecoverPipelineStep}
            />

            {/* Center Pane: Interactive Multi-Agent Chat & Streaming Timeline */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {/* Assigned Report Document Context Banner */}
              {assignedReportDoc && (
                <div className="px-4 py-2 bg-sky-950/40 border-b border-sky-500/30 flex items-center justify-between text-xs text-sky-200">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-sky-400" />
                    <span>
                      <strong className="text-white">Active Contract:</strong> {assignedReportDoc.pipelineName} (Assigned at {assignedReportDoc.assignedAt})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setLifecycleStage('report')}
                      className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold underline"
                    >
                      View Report
                    </button>
                  </div>
                </div>
              )}

              {/* Completed Pipeline Audit Action Banner (Recycling Vector 2) */}
              {completedPipelineSummary && (
                <div className="px-4 py-2.5 bg-gradient-to-r from-purple-950/50 via-slate-900 to-indigo-950/50 border-b border-purple-500/40 flex items-center justify-between gap-3 text-xs text-slate-200 shadow-sm animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-100">
                        Pipeline Completed: {completedPipelineSummary.pipelineName}
                      </span>
                      <span className="text-[11px] text-slate-400 ml-2">
                        ({completedPipelineSummary.stepsCount} steps finished)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setLifecycleStage('report')}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                    >
                      📋 View Report
                    </button>
                    <button
                      type="button"
                      onClick={handleAuditDeliverablesInDebate}
                      className="px-3 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow transition-all flex items-center gap-1.5"
                    >
                      <RotateCcw size={12} />
                      <span>🔄 Audit Deliverables in Council</span>
                    </button>
                  </div>
                </div>
              )}

              <AgentChatTimeline
                visibleAgents={visibleAgents}
                allAgents={agentProfiles}
                selectedAgentId={selectedAgentId}
                onSelectAgent={(id) => setSelectedAgentId(id)}
                selectedIntent={selectedIntent}
                onSelectIntent={(intent) => setSelectedIntent(intent)}
                selectedTask={selectedTask}
                activeFileName={
                  workspaceFocusMode === 'workspace'
                    ? `Entire Project (${
                        resolvedWorkspace
                          ? resolvedWorkspace.split(/[\\/]/).pop()
                          : 'Root'
                      })`
                    : focusFilePath
                    ? cleanWorkspaceFiles.find((f) => f.path === focusFilePath)
                        ?.name ||
                      focusFilePath.split(/[\\/]/).pop() ||
                      'Focused File'
                    : activeTab?.fileName || 'Workspace Specification'
                }
                activeFilePath={
                  workspaceFocusMode === 'workspace'
                    ? resolvedWorkspace
                    : focusFilePath ||
                      activeTab?.filePath ||
                      cleanWorkspaceFiles[0]?.path ||
                      ''
                }
                watchedFiles={cleanWorkspaceFiles}
                selectedSourceFile={selectedSourceFile}
                onSelectSourceFile={(path) => setSelectedSourceFile(path)}
                onSendChatTask={async (
                  text,
                  attachedImages,
                  customActionId,
                  effortLevel,
                  thinkingEnabled
                ) => {
                  let promptToSend = text;
                  if (attachedImages && attachedImages.length > 0) {
                    const imagesMarkdown = attachedImages
                      .map((img) => `![${img.name}](${img.dataUrl})`)
                      .join('\n\n');
                    promptToSend = promptToSend
                      ? `${promptToSend}\n\n### Attached Reference Images:\n${imagesMarkdown}`
                      : `### Attached Reference Images:\n${imagesMarkdown}`;
                  }
                  const customAct = customActionId
                    ? customActions.find((a) => a.id === customActionId) ||
                      STARTER_CUSTOM_PIPELINE_ACTIONS.find(
                        (a) => a.id === customActionId
                      )
                    : null;
                  if (customAct?.promptTemplate) {
                    promptToSend = `${promptToSend}\n\n[Action Directive]: ${customAct.promptTemplate}`;
                  }
                  await handleSendInAppChatTask(promptToSend, {
                    epistemicPolicy: customAct?.epistemicPolicy,
                    customActionLabel: customAct?.name,
                    effortLevel,
                    thinkingEnabled,
                  });
                }}
                onOpenReportInTab={handleOpenReportInTab}
                onApplyToActiveTab={handleApplyToActiveTab}
                onRelayToNextAgent={(
                  task,
                  nextAgentId,
                  nextIntent,
                  customActionId,
                  effortLevel,
                  thinkingEnabled
                ) =>
                  handleRelayToNextAgent(
                    task,
                    nextAgentId,
                    nextIntent,
                    customActionId,
                    effortLevel,
                    thinkingEnabled
                  )
                }
                onPasteExternalReply={handlePasteExternalReply}
                onCancelTask={handleCancelTask}
                onRecoverTask={handleRecoverTask}
                submitting={submitting}
                runningPipelineId={runningPipelineId}
                workflowExecutionMode={workflowExecutionMode}
                waitingForStepApproval={waitingForStepApproval}
                customActions={customActions}
                onOpenCustomActionsModal={() => setShowCustomActionsModal(true)}
              />
            </div>

            {/* Splitter Drag Handle between Center Chat Pane and Live Progress Inspector */}
            <div
              onMouseDown={handleInspectorResizeMouseDown}
              onDoubleClick={() => {
                setInspectorWidth(340);
                try {
                  localStorage.setItem('flymd:agents-inspector-width', '340');
                } catch {}
              }}
              title="Drag to resize Live Progress Inspector (Double-click to reset to 340px)"
              className="w-1.5 h-full bg-slate-900/60 hover:bg-sky-500/80 active:bg-sky-500 cursor-col-resize z-20 transition-colors shrink-0 flex items-center justify-center group select-none"
            >
              <div className="w-0.5 h-8 bg-slate-700/80 group-hover:bg-sky-200 rounded transition-colors" />
            </div>

            {/* Right Pane: Live Progress, Antigravity Files Deck & Activity/Terminal Inspector */}
            <AgentProgressInspector
              width={inspectorWidth}
              isPipelineRunning={!!runningPipelineId}
              selectedTask={selectedTask}
              checkpoints={agentCheckpoints}
              restoringCheckpointId={restoringCheckpointId}
              onRestoreCheckpoint={handleRestoreCheckpoint}
              onClearTaskLogs={handleClearTaskLogs}
              onDeleteTask={handleDeleteTask}
              onCancelTask={handleCancelTask}
              onRecoverTask={handleRecoverTask}
              activeMarkdownContent={activeTab?.content || ''}
              watchedFiles={cleanWorkspaceFiles}
              onRunSingleChecklistItem={(itemText) =>
                handleSendInAppChatTask(
                  `Execute checklist step: "${itemText}"`,
                  {
                    intent: 'build',
                  }
                )
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
        )}

        {/* Far Right: Dual-Layer Memory & Observability HUD */}
        {showObservabilityHUD && resolvedWorkspace && (
          <ProjectObservabilityHUD
            workspacePath={resolvedWorkspace}
            onClose={() => setShowObservabilityHUD(false)}
          />
        )}
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
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in select-none">
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

      {/* Interactive Pipeline & Task Error Recovery Modal (Continue from Breakpoint vs Revert Modified Files & Retry) */}
      {pendingRecoveryPrompt && (() => {
        const ft = pendingRecoveryPrompt.failedTask;
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

        const handleDismissOrPause = () => {
          if (globalPipelineRuntime.recoveryResolver) {
            const resolve = globalPipelineRuntime.recoveryResolver;
            globalPipelineRuntime.recoveryResolver = null;
            setPendingRecoveryPrompt(null);
            resolve({ action: 'pause' });
          } else {
            setPendingRecoveryPrompt(null);
          }
        };

        const handleCopyModalErrorLog = async () => {
          const report = [
            `=== FlyMD Pipeline & Task Error Diagnostic ===`,
            `Task ID: ${ft.id}`,
            pendingRecoveryPrompt.pipeline
              ? `Pipeline: ${pendingRecoveryPrompt.pipeline.name} — Step ${(pendingRecoveryPrompt.stepIdx ?? 0) + 1} (${pendingRecoveryPrompt.stepLabel || ft.intent})`
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
            setRecoveryCopiedLog(true);
            setTimeout(() => setRecoveryCopiedLog(false), 2000);
          } catch {}
        };

        return (
          <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in select-none">
            <div className="w-full max-w-2xl rounded-2xl border border-amber-500/50 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/80">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                    <AlertTriangle size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold text-white truncate">
                      {pendingRecoveryPrompt.pipeline
                        ? `Pipeline Step ${(pendingRecoveryPrompt.stepIdx ?? 0) + 1} Interrupted — Resume or Revert & Retry`
                        : `Task Interrupted — Resume or Revert & Retry`}
                    </h3>
                    <p className="text-[11px] text-slate-400 truncate">
                      {diag?.title ||
                        `Choose whether to continue from the last breakpoint or revert modified files and retry cleanly.`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyModalErrorLog}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-bold transition-colors"
                    title="Copy clean exception & error diagnostic log"
                  >
                    {recoveryCopiedLog ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        <span className="text-emerald-300">Copied Log</span>
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
                    onClick={handleDismissOrPause}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Pause pipeline here and inspect workspace"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4 overflow-y-auto text-xs">
                {/* 1. Clean Exception & Error Diagnostic Block */}
                <div className="rounded-xl border border-rose-500/40 bg-rose-950/25 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                      <AlertCircle size={13} className="text-rose-400" />
                      Clean Exception &amp; Error Diagnostic
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-slate-950/90 border border-slate-700 text-[10px] font-mono font-bold uppercase text-amber-300">
                        {diag?.category || ft.status}
                      </span>
                      {diag?.exitCode !== undefined && diag?.exitCode !== null && (
                        <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-500/50 text-[10px] font-mono font-bold text-rose-300">
                          Exit Code: {diag.exitCode}
                        </span>
                      )}
                      {(ft.cliSessionId || diag?.cliSessionId) && (
                        <span className="px-2 py-0.5 rounded bg-sky-950 border border-sky-500/40 text-[10px] font-mono text-sky-300">
                          Session Ready
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-950/95 border border-slate-800 p-2.5 font-mono text-[11px] text-rose-200 leading-relaxed select-text">
                    {exceptionMsg}
                  </div>

                  {lastActivity && (
                    <div className="flex items-start gap-2 text-[11px] text-slate-300 bg-slate-950/70 border border-slate-800/80 rounded-lg px-2.5 py-1.5">
                      <Clock size={12} className="text-sky-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="font-bold text-sky-300">
                          Last Active Breakpoint:{' '}
                        </span>
                        <span className="font-mono text-slate-200 break-words">
                          {lastActivity}
                        </span>
                      </div>
                    </div>
                  )}

                  {stderrLines.length > 0 && (
                    <div className="rounded-lg border border-slate-800 bg-slate-950/90 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setRecoveryShowStderr((prev) => !prev)}
                        className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:text-white bg-slate-900/80 transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          {recoveryShowStderr ? (
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
                          {recoveryShowStderr ? 'Hide trace' : 'Show trace'}
                        </span>
                      </button>
                      {recoveryShowStderr && (
                        <div className="p-2.5 max-h-40 overflow-y-auto font-mono text-[10px] text-rose-300/90 space-y-1 select-text border-t border-slate-800">
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
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-emerald-400" />
                      Workspace Files Modified by Current Failed Task (
                      {modifiedFileNames.length})
                    </span>
                    {cp && !cp.restored ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold">
                        Safety Checkpoint Ready ({cp.id})
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        Workspace Snapshot Active
                      </span>
                    )}
                  </div>

                  {modifiedFileNames.length === 0 ? (
                    <div className="text-[11px] text-slate-400 italic">
                      No workspace code deliverables were written to disk before this task paused. Both options below are safe to run immediately.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {modifiedFileNames.map((fname) => (
                          <span
                            key={fname}
                            className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 font-mono text-[11px] text-sky-300"
                          >
                            {fname}
                          </span>
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        • Choose{' '}
                        <strong className="text-emerald-300">
                          Continue from Last Breakpoint
                        </strong>{' '}
                        to keep these {modifiedFileNames.length} file(s) and finish
                        the remaining implementation from where the agent stopped.
                        <br />• Choose{' '}
                        <strong className="text-amber-300">
                          Revert Modified Files &amp; Retry
                        </strong>{' '}
                        to roll back modified files and remove partial files using
                        the pre-task safety checkpoint before re-running cleanly.
                      </p>
                    </div>
                  )}
                </div>

                {/* 3. Optional Agent Switcher, Effort & Thinking Calibration & Recovery Note */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Target Agent:
                    </label>
                    <select
                      value={recoveryAgentId || ft.targetAgentId}
                      onChange={(e) =>
                        setRecoveryAgentId(e.target.value as AgentId)
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold text-xs focus:outline-none focus:border-sky-500 cursor-pointer"
                    >
                      {visibleAgents.map((ag) => (
                        <option key={ag.id} value={ag.id} className="bg-slate-900">
                          @{ag.name}{' '}
                          {ag.id === ft.targetAgentId ? '(Current)' : '(Switch)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Reasoning Effort:
                    </label>
                    <select
                      value={recoveryEffortLevel}
                      onChange={(e) =>
                        setRecoveryEffortLevel(e.target.value as AgentEffortLevel)
                      }
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sky-300 font-bold text-xs focus:outline-none focus:border-sky-500 cursor-pointer"
                      title="Adjust effort level (e.g. switch to Low/Medium to avoid timeouts)"
                    >
                      <option value="low" className="bg-slate-900">Low (Fast)</option>
                      <option value="medium" className="bg-slate-900">Medium (Default)</option>
                      <option value="high" className="bg-slate-900">High</option>
                      <option value="xhigh" className="bg-slate-900">X-High</option>
                      <option value="max" className="bg-slate-900">Max</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Thinking Mode:
                    </label>
                    <button
                      type="button"
                      onClick={() => setRecoveryThinkingEnabled((prev) => !prev)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        recoveryThinkingEnabled
                          ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300 shadow-xs'
                          : 'bg-slate-950 border-slate-700 text-slate-400 line-through'
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
                            ? 'text-indigo-400'
                            : 'text-slate-500'
                        }
                      />
                      <span>{recoveryThinkingEnabled ? 'Thinking ON' : 'Thinking OFF'}</span>
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Optional Directive / Hint:
                    </label>
                    <input
                      type="text"
                      value={recoveryExtraDirective}
                      onChange={(e) => setRecoveryExtraDirective(e.target.value)}
                      placeholder="e.g. Write incrementally..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer: Explicit User Decision Buttons */}
              <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleDismissOrPause}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Pause Pipeline &amp; Inspect
                </button>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() =>
                      executeRecoveryDecision(
                        ft,
                        'revert_and_retry',
                        pendingRecoveryPrompt.pipeline,
                        pendingRecoveryPrompt.stepIdx,
                        recoveryAgentId || ft.targetAgentId,
                        recoveryExtraDirective.trim() || undefined,
                        recoveryEffortLevel,
                        recoveryThinkingEnabled
                      )
                    }
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 font-bold text-xs transition-all cursor-pointer"
                    title="Restore pre-task safety checkpoint (reverting modified files and deleting newly created partial files) and retry cleanly"
                  >
                    <RotateCcw size={13} />
                    <span>Revert Modified Files &amp; Retry</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      executeRecoveryDecision(
                        ft,
                        'continue_from_breakpoint',
                        pendingRecoveryPrompt.pipeline,
                        pendingRecoveryPrompt.stepIdx,
                        recoveryAgentId || ft.targetAgentId,
                        recoveryExtraDirective.trim() || undefined,
                        recoveryEffortLevel,
                        recoveryThinkingEnabled
                      )
                    }
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
      })()}

      {/* User-Defined Custom Pipeline Actions Library Modal */}
      <CustomPipelineActionsModal
        isOpen={showCustomActionsModal}
        onClose={() => setShowCustomActionsModal(false)}
        customActions={customActions}
        onSaveAction={handleSaveCustomAction}
        onDeleteAction={handleDeleteCustomAction}
      />
    </div>
  );
};
