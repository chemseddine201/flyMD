import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CustomPipelineAction,
  ScannedMdFile,
  TabItem,
} from '../../../../../shared/types';
import { STARTER_CUSTOM_PIPELINE_ACTIONS } from '../../../../../shared/constants';
import { usePreviewStore } from '../../../store';
import { globalPipelineRuntime } from '../../../services/pipelineExecutionService';
import { composeSmartDeliverableName } from '../../../utils/smartNaming';
import { CompletedPipelineSummary } from './PipelineStatusBanners';
import { PendingRecoveryPromptData } from '../modals/PipelineRecoveryModal';

export interface StudioWorkspacePropsInput {
  propFolderPath?: string;
  propActiveTab?: { id: string; filePath?: string; title?: string };
  propSupervisionConfig?: any;
  activeTab?: TabItem;
  setSelectedTaskId: (id: string | null) => void;
  setCompletedPipelineSummary: (val: CompletedPipelineSummary | null) => void;
  setPendingRecoveryPrompt: (val: PendingRecoveryPromptData | null) => void;
}

export function useStudioWorkspaceActions({
  propFolderPath,
  propActiveTab,
  propSupervisionConfig,
  activeTab,
  setSelectedTaskId,
  setCompletedPipelineSummary,
  setPendingRecoveryPrompt,
}: StudioWorkspacePropsInput) {
  const folderPath = usePreviewStore((s) => s.folderPath);
  const supervisionConfig = usePreviewStore((s) => s.supervisionConfig);
  const folderFiles = usePreviewStore((s) => s.folderFiles);
  const setFolderFiles = usePreviewStore((s) => s.setFolderFiles);
  const openFileInTab = usePreviewStore((s) => s.openFileInTab);
  const closeTab = usePreviewStore((s) => s.closeTab);
  const addTab = usePreviewStore((s) => s.addTab);
  const updateActiveContent = usePreviewStore((s) => s.updateActiveContent);
  const setViewMode = usePreviewStore((s) => s.setViewMode);
  const clearAllDiscussions = usePreviewStore((s) => s.clearAllDiscussions);
  const setAgentTasks = usePreviewStore((s) => s.setAgentTasks);
  const setPipelines = usePreviewStore((s) => s.setPipelines);
  const setRunningPipelineId = usePreviewStore((s) => s.setRunningPipelineId);
  const setRunningPipelineStepIdx = usePreviewStore((s) => s.setRunningPipelineStepIdx);
  const setWaitingForStepApproval = usePreviewStore((s) => s.setWaitingForStepApproval);
  const setAssignedReportDoc = usePreviewStore((s) => s.setAssignedReportDoc);
  const setLifecycleStage = usePreviewStore((s) => s.setAgentLifecycleStage);
  const activeProject = usePreviewStore((s) => s.activeProject);

  const [selectedSourceFile, setSelectedSourceFile] = useState<string>('');
  const [workspaceFocusMode, setWorkspaceFocusMode] = useState<'workspace' | 'file'>('workspace');
  const [focusFilePath, setFocusFilePath] = useState<string>('');
  const [showProjectTree, setShowProjectTree] = useState<boolean>(true);
  const [showObservabilityHUD, setShowObservabilityHUD] = useState<boolean>(false);

  // Clear Workspace Cache Modal State
  const [showClearCacheModal, setShowClearCacheModal] = useState(false);
  const [clearTempCache, setClearTempCache] = useState(true);
  const [clearMemoryLedger, setClearMemoryLedger] = useState(true);
  const [clearCompletedSessions, setClearCompletedSessions] = useState(true);
  const [clearDebatesAndCouncil, setClearDebatesAndCouncil] = useState(true);
  const [clearPipelineAndReports, setClearPipelineAndReports] = useState(true);
  const [closeRelatedOpenedFiles, setCloseRelatedOpenedFiles] = useState(true);
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheNotification, setCacheNotification] = useState<string | null>(null);

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

  // O(1) Custom Action Lookup Map (merges starter defaults with user overrides)
  const customActionsById = useMemo(() => {
    const map = new Map<string, CustomPipelineAction>();
    for (const starter of STARTER_CUSTOM_PIPELINE_ACTIONS) {
      map.set(starter.id, starter);
    }
    for (const act of customActions) {
      map.set(act.id, act);
    }
    return map;
  }, [customActions]);

  const resolveCustomAction = useCallback(
    (actionId?: string): CustomPipelineAction | null => {
      if (!actionId) return null;
      return customActionsById.get(actionId) || null;
    },
    [customActionsById]
  );

  const handleSaveCustomAction = useCallback((action: CustomPipelineAction) => {
    setCustomActions((prev) => {
      const existingIdx = prev.findIndex((a) => a.id === action.id);
      const updated =
        existingIdx >= 0
          ? prev.map((a, idx) => (idx === existingIdx ? action : a))
          : [...prev, action];
      try {
        localStorage.setItem('flymd:custom-pipeline-actions', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const handleDeleteCustomAction = useCallback((actionId: string) => {
    setCustomActions((prev) => {
      const filtered = prev.filter((a) => a.id !== actionId);
      try {
        localStorage.setItem('flymd:custom-pipeline-actions', JSON.stringify(filtered));
      } catch {}
      return filtered;
    });
  }, []);

  const [cwdWorkspace, setCwdWorkspace] = useState<string>('');
  useEffect(() => {
    if (!folderPath && !propFolderPath && window.electronAPI?.getCurrentWorkingDirectory) {
      window.electronAPI
        .getCurrentWorkingDirectory()
        .then((cwd) => {
          if (cwd && cwd !== '.') {
            setCwdWorkspace(cwd);
          }
        })
        .catch(() => {});
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
  const handleInspectorResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
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
    },
    [inspectorWidth]
  );

  const cleanWorkspaceFiles = useMemo(() => {
    return folderFiles.filter(
      (f) =>
        !f.path.includes('/.') &&
        !f.path.includes('\\.') &&
        !f.name.startsWith('.') &&
        !f.name.startsWith('report-task-')
    );
  }, [folderFiles]);

  const cleanWorkspaceFilesByPath = useMemo(() => {
    const map = new Map<string, ScannedMdFile>();
    for (const f of cleanWorkspaceFiles) {
      map.set(f.path, f);
    }
    return map;
  }, [cleanWorkspaceFiles]);

  const resolveCurrentSourceDocument = useCallback(
    async (overridePath?: string) => {
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
              fileName: res.name || targetPath.split(/[\\/]/).pop() || 'Document.md',
              markdownContent: res.content,
            };
          }
        } catch {}
      }
      return {
        filePath: activeTab?.filePath || '',
        fileName:
          activeTab?.fileName ||
          composeSmartDeliverableName({
            projectName: activeProject?.name,
            fallbackName: 'Workspace-Specification.md',
          }),
        markdownContent:
          activeTab?.content ||
          '# Project Specification\n\n- [ ] Define core architecture\n- [ ] Implement feature modules\n- [ ] Verify and test\n',
      };
    },
    [
      workspaceFocusMode,
      resolvedWorkspace,
      activeTab,
      folderFiles,
      focusFilePath,
      selectedSourceFile,
      activeProject,
    ]
  );

  const handleOpenReportInTab = useCallback(
    async (filePath?: string, markdownFallback?: string, titleFallback?: string) => {
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
        const smartFallbackName =
          titleFallback ||
          composeSmartDeliverableName({
            projectName: activeProject?.name,
            topicOrPrompt: markdownFallback.slice(0, 150),
            intentOrKind: 'report',
            fallbackName: 'Agent-Report.md',
          });
        openFileInTab(
          {
            path:
              filePath ||
              `${smartFallbackName.replace(/\.md$/, '')}-${Date.now()}.md`,
            name: smartFallbackName,
            content: markdownFallback,
            lastModified: Date.now(),
          },
          { activate: true }
        );
        setViewMode('preview');
      }
    },
    [openFileInTab, setViewMode, activeProject]
  );

  const handleApplyToActiveTab = useCallback(
    (markdownContent: string) => {
      if (!markdownContent.trim()) return;
      if (activeTab) {
        updateActiveContent(markdownContent);
        setViewMode('split');
      } else {
        const smartDocName = composeSmartDeliverableName({
          projectName: activeProject?.name,
          topicOrPrompt: markdownContent.slice(0, 150),
          intentOrKind: 'plan',
          fallbackName: 'Refined-Plan.md',
        });
        openFileInTab(
          {
            path: `applied-plan-${Date.now()}.md`,
            name: smartDocName,
            content: markdownContent,
            lastModified: Date.now(),
          },
          { activate: true }
        );
        setViewMode('preview');
      }
    },
    [activeTab, updateActiveContent, setViewMode, openFileInTab, activeProject]
  );

  const handleOpenSharedMemory = useCallback(async () => {
    if (!resolvedWorkspace) return;
    const sep = resolvedWorkspace.includes('\\') ? '\\' : '/';
    const memoryPath = `${resolvedWorkspace}${sep}.flymd${sep}MEMORY.md`;
    await handleOpenReportInTab(
      memoryPath,
      '# FlyMD Shared Agent Memory Ledger\n\n> Auto-maintained context ledger across agents.\n',
      'MEMORY.md'
    );
  }, [resolvedWorkspace, handleOpenReportInTab]);

  const handleDeleteWorkspaceFile = useCallback(
    async (filePath: string) => {
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
    },
    [folderFiles, setFolderFiles, selectedSourceFile]
  );

  const requestOpenClearCacheModal = useCallback(() => {
    setClearTempCache(true);
    setClearMemoryLedger(true);
    setClearCompletedSessions(true);
    setClearDebatesAndCouncil(true);
    setClearPipelineAndReports(true);
    setCloseRelatedOpenedFiles(true);
    setShowClearCacheModal(true);
  }, []);

  const handleExecuteClearCache = useCallback(async () => {
    if (!resolvedWorkspace) return;
    setClearingCache(true);
    const clearedSummary: string[] = [];
    try {
      if (clearTempCache || clearMemoryLedger) {
        if (window.electronAPI.clearWorkspaceCache) {
          const result = await window.electronAPI.clearWorkspaceCache(
            resolvedWorkspace,
            clearMemoryLedger,
            clearTempCache
          );
          if (result) clearedSummary.push(result);
        }
      }

      if (clearCompletedSessions) {
        const remaining = await window.electronAPI.clearAgentTasks();
        setAgentTasks(remaining);
        setSelectedTaskId(null);
        clearedSummary.push('task sessions');
      }

      if (clearDebatesAndCouncil) {
        await clearAllDiscussions(resolvedWorkspace);
        clearedSummary.push('debate sessions');
      }

      if (clearPipelineAndReports) {
        setPipelines((prev) =>
          prev.map((p) => ({
            ...p,
            steps: p.steps.map((s) => ({
              ...s,
              status: undefined,
              completedTaskId: undefined,
              errorDiagnostic: undefined,
              completedAt: undefined,
            })),
          }))
        );
        setRunningPipelineId(null);
        setRunningPipelineStepIdx(-1);
        setWaitingForStepApproval(null);
        globalPipelineRuntime.cancelled = true;
        globalPipelineRuntime.proceedResolver = null;
        globalPipelineRuntime.recoveryResolver = null;
        try {
          localStorage.removeItem('flymd:active-pipeline-run');
        } catch {}
        setCompletedPipelineSummary(null);
        setAssignedReportDoc(null);
        setPendingRecoveryPrompt(null);
        setLifecycleStage('debate');
        clearedSummary.push('pipeline & report UI');
      }

      if (closeRelatedOpenedFiles) {
        const currentTabs = usePreviewStore.getState().tabs;
        const normalizedWs = resolvedWorkspace.toLowerCase().replace(/\\/g, '/');
        const tabsToClose = currentTabs.filter((t) => {
          if (!t.filePath) return false;
          const normalizedPath = t.filePath.toLowerCase().replace(/\\/g, '/');
          const isUnderFlymd =
            normalizedPath.includes('/.flymd/') ||
            normalizedPath.includes('\\.flymd\\') ||
            normalizedPath.endsWith('/.flymd') ||
            normalizedPath.endsWith('\\.flymd');
          const isUnderWorkspaceFlymd = normalizedPath.startsWith(
            `${normalizedWs}/.flymd/`
          );
          const isGeneratedReport =
            t.fileName.toLowerCase().includes('flymd-pipeline-deliverables-report') ||
            t.fileName.toLowerCase().startsWith('report-task-') ||
            t.fileName.toLowerCase() === 'memory.md';
          return isUnderFlymd || isUnderWorkspaceFlymd || isGeneratedReport;
        });

        for (const tab of tabsToClose) {
          closeTab(tab.id);
        }

        const remainingTabs = usePreviewStore.getState().tabs;
        if (remainingTabs.length === 0) {
          addTab({
            fileName: 'Welcome.md',
            content: '# FlyMD\n\nWorkspace memory and caches cleared.\n',
          });
        }
        if (tabsToClose.length > 0) {
          clearedSummary.push(`${tabsToClose.length} related open tab(s)`);
        }
      }

      setCacheNotification(
        clearedSummary.length > 0
          ? `Cleared: ${clearedSummary.join(', ')}.`
          : 'Workspace memory and cache cleared successfully.'
      );
      setTimeout(() => setCacheNotification(null), 4000);
      setShowClearCacheModal(false);
    } catch (err: any) {
      console.error('Failed to clear workspace cache:', err);
      setCacheNotification(`Error: ${err?.message || err}`);
      setTimeout(() => setCacheNotification(null), 4000);
    } finally {
      setClearingCache(false);
    }
  }, [
    resolvedWorkspace,
    clearTempCache,
    clearMemoryLedger,
    clearCompletedSessions,
    clearDebatesAndCouncil,
    clearPipelineAndReports,
    closeRelatedOpenedFiles,
    setAgentTasks,
    setSelectedTaskId,
    clearAllDiscussions,
    setPipelines,
    setRunningPipelineId,
    setRunningPipelineStepIdx,
    setWaitingForStepApproval,
    setCompletedPipelineSummary,
    setAssignedReportDoc,
    setPendingRecoveryPrompt,
    setLifecycleStage,
    closeTab,
    addTab,
  ]);

  return {
    resolvedWorkspace,
    selectedSourceFile,
    setSelectedSourceFile,
    workspaceFocusMode,
    setWorkspaceFocusMode,
    focusFilePath,
    setFocusFilePath,
    showProjectTree,
    setShowProjectTree,
    showObservabilityHUD,
    setShowObservabilityHUD,
    cleanWorkspaceFiles,
    cleanWorkspaceFilesByPath,
    resolveCurrentSourceDocument,
    customActions,
    showCustomActionsModal,
    setShowCustomActionsModal,
    resolveCustomAction,
    handleSaveCustomAction,
    handleDeleteCustomAction,
    inspectorWidth,
    setInspectorWidth,
    handleInspectorResizeMouseDown,
    handleOpenReportInTab,
    handleApplyToActiveTab,
    handleOpenSharedMemory,
    handleDeleteWorkspaceFile,
    showClearCacheModal,
    setShowClearCacheModal,
    requestOpenClearCacheModal,
    clearTempCache,
    setClearTempCache,
    clearMemoryLedger,
    setClearMemoryLedger,
    clearCompletedSessions,
    setClearCompletedSessions,
    clearDebatesAndCouncil,
    setClearDebatesAndCouncil,
    clearPipelineAndReports,
    setClearPipelineAndReports,
    closeRelatedOpenedFiles,
    setCloseRelatedOpenedFiles,
    clearingCache,
    cacheNotification,
    handleExecuteClearCache,
  };
}

