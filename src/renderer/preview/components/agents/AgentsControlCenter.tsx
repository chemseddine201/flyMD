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
import { DiscussionStudio } from './studio/DiscussionStudio';
import { ProjectTreeNavigator } from './projects/ProjectTreeNavigator';
import { ProjectObservabilityHUD } from './projects/ProjectObservabilityHUD';
import { ProjectSynthesisReportViewer } from './projects/ProjectSynthesisReportViewer';

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
  const [lifecycleStage, setLifecycleStage] = useState<'debate' | 'report' | 'pipeline'>('pipeline');
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

  // Track automated multi-step repeater runs
  const [runningPipelineId, setRunningPipelineId] = useState<string | null>(null);
  const [runningPipelineStepIdx, setRunningPipelineStepIdx] = useState<number>(-1);
  const isPipelineCancelledRef = useRef<boolean>(false);

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

  const [waitingForStepApproval, setWaitingForStepApproval] = useState<{
    completedStepIdx: number;
    nextStepIdx: number;
    nextAgentName: string;
    nextIntent: string;
    completedTaskId: string;
    filesCreatedCount: number;
  } | null>(null);

  const proceedNextStepResolverRef = useRef<(() => void) | null>(null);

  const handleProceedNextWorkflowStep = () => {
    if (proceedNextStepResolverRef.current) {
      const resolve = proceedNextStepResolverRef.current;
      proceedNextStepResolverRef.current = null;
      resolve();
    }
  };

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
    propFolderPath ||
    folderPath ||
    propSupervisionConfig?.path ||
    supervisionConfig?.path ||
    (propActiveTab?.filePath ? propActiveTab.filePath.replace(/[\\/][^\\/]+$/, '') : '') ||
    (activeTab?.filePath ? activeTab.filePath.replace(/[\\/][^\\/]+$/, '') : '') ||
    (typeof window !== 'undefined' ? (window as any)._flymd_last_workspace : '') ||
    '.';

  const selectedTask =
    agentTasks.find((t) => t.id === selectedTaskId) || agentTasks[0] || null;

  useEffect(() => {
    if (resolvedWorkspace) {
      loadProjects(resolvedWorkspace);
    }
  }, [resolvedWorkspace, loadProjects]);

  const [assignedReportDoc, setAssignedReportDoc] = useState<{
    pipelineId: string;
    pipelineName: string;
    reportMarkdown: string;
    assignedAt: string;
  } | null>(null);

  const [completedPipelineSummary, setCompletedPipelineSummary] = useState<{
    pipelineName: string;
    stepsCount: number;
    filesCreated: number;
    lastTaskOutput?: string;
  } | null>(null);

  const handleLaunchDedicatedPipeline = async (
    preset: AgentPipelinePreset,
    reportMarkdown: string
  ) => {
    setPipelines((prev) => [preset, ...prev.filter((p) => p.id !== preset.id)]);
    persistPipelines([preset, ...pipelines.filter((p) => p.id !== preset.id)]);
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

  // Helper to reliably await a task reaching a terminal state (completed, cancelled, failed) without premature timeout
  const waitForTaskFinished = (taskId: string): Promise<AgentTaskRecord | null> => {
    return new Promise((resolve) => {
      const checkTerminal = () => {
        const tasks = usePreviewStore.getState().agentTasks;
        const found = tasks.find((t) => t.id === taskId);
        if (
          found &&
          (found.status === 'completed' ||
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

  const handleRunPipelineInStudio = async (pipeline: AgentPipelinePreset) => {
    if (!pipeline.steps.length || runningPipelineId) return;

    setRunningPipelineId(pipeline.id);
    isPipelineCancelledRef.current = false;

    try {
      let previousTask: AgentTaskRecord | null = null;

      for (let idx = 0; idx < pipeline.steps.length; idx++) {
        if (isPipelineCancelledRef.current) break;

        const currentStep = pipeline.steps[idx];
        const nextStep = pipeline.steps[idx + 1];

        setRunningPipelineStepIdx(idx);
        setSelectedAgentId(currentStep.agentId);
        setSelectedIntent(currentStep.intent);

        const promptText = `Pipeline [${pipeline.name}] — Step ${idx + 1}/${
          pipeline.steps.length
        } (${currentStep.label})${
          previousTask ? ` relayed from @${previousTask.targetAgentId}` : ''
        }`;

        const dispatchedTask = await handleSendInAppChatTask(promptText, {
          agentId: currentStep.agentId,
          intent: currentStep.intent,
          filePath: previousTask?.outputReportPath || previousTask?.filePath,
          fileName: previousTask?.fileName,
          markdownContent:
            previousTask?.responseMarkdown || activeTab?.content || '',
          sourceAgentId: previousTask?.targetAgentId,
          pipelineId: pipeline.id,
          nextAgentInChain: nextStep?.agentId,
          nextIntentInChain: nextStep?.intent,
        });

        if (!dispatchedTask?.id) {
          console.error(`Pipeline step ${idx + 1} failed to dispatch.`);
          break;
        }

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

        // Reliably await task completion before executing the next step (no premature timeout)
        const completed = await waitForTaskFinished(dispatchedTask.id);
        if (
          !completed ||
          completed.status !== 'completed' ||
          isPipelineCancelledRef.current
        ) {
          break;
        }

        previousTask = completed;

        // If there is a next step and Manual mode is active, pause and request user approval
        if (idx + 1 < pipeline.steps.length && workflowExecutionMode === 'manual') {
          const nextAgent = agentProfiles.find((a) => a.id === nextStep?.agentId);
          const touchedFiles = (completed.toolActions || []).filter(
            (a) => a.kind === 'write' || a.label.toLowerCase().includes('file')
          ).length;

          setWaitingForStepApproval({
            completedStepIdx: idx,
            nextStepIdx: idx + 1,
            nextAgentName: nextAgent?.name || nextStep?.agentId || 'Agent',
            nextIntent: nextStep?.intent || 'next step',
            completedTaskId: completed.id,
            filesCreatedCount: touchedFiles,
          });

          await new Promise<void>((resolve) => {
            proceedNextStepResolverRef.current = resolve;
          });

          setWaitingForStepApproval(null);
          if (isPipelineCancelledRef.current) break;
        }
      }

      if (!isPipelineCancelledRef.current && pipeline.steps.length > 0 && previousTask) {
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
      setRunningPipelineId(null);
      setRunningPipelineStepIdx(-1);
      setWaitingForStepApproval(null);
      proceedNextStepResolverRef.current = null;
      try {
        localStorage.removeItem('flymd:active-pipeline-run');
      } catch {}
    }
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
    isPipelineCancelledRef.current = true;
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
          <ProjectTreeNavigator workspacePath={resolvedWorkspace} />
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
                onSendChatTask={async (text, attachedImages) => {
                  let promptToSend = text;
                  if (attachedImages && attachedImages.length > 0) {
                    const imagesMarkdown = attachedImages
                      .map((img) => `![${img.name}](${img.dataUrl})`)
                      .join('\n\n');
                    promptToSend = promptToSend
                      ? `${promptToSend}\n\n### Attached Reference Images:\n${imagesMarkdown}`
                      : `### Attached Reference Images:\n${imagesMarkdown}`;
                  }
                  await handleSendInAppChatTask(promptToSend);
                }}
                onOpenReportInTab={handleOpenReportInTab}
                onApplyToActiveTab={handleApplyToActiveTab}
                onRelayToNextAgent={handleRelayToNextAgent}
                onPasteExternalReply={handlePasteExternalReply}
                onCancelTask={handleCancelTask}
                submitting={submitting}
              />
            </div>

            {/* Right Pane: Live Progress, Antigravity Files Deck & Activity/Terminal Inspector */}
            <AgentProgressInspector
              selectedTask={selectedTask}
              checkpoints={agentCheckpoints}
              restoringCheckpointId={restoringCheckpointId}
              onRestoreCheckpoint={handleRestoreCheckpoint}
              onClearTaskLogs={handleClearTaskLogs}
              onDeleteTask={handleDeleteTask}
              onCancelTask={handleCancelTask}
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
    </div>
  );
};
