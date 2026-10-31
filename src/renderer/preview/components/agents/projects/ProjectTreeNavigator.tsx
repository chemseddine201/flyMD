import React, { useState, useRef } from 'react';
import {
  FolderTree,
  FolderPlus,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Trash2,
  Plus,
  Layers,
  Sparkles,
  CheckCircle2,
  Play,
  FileText,
  Clock,
  Activity,
  Boxes,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  AlertTriangle,
} from 'lucide-react';
import { usePreviewStore } from '../../../store';
import {
  ProjectNode,
  ProjectTreeNode,
  ProjectStatus,
  CreateProjectRequest,
} from '../../../../../shared/types';

interface ProjectTreeNavigatorProps {
  workspacePath: string;
  onClose?: () => void;
  onWorkspaceChange?: (newWorkspace: string) => void;
}

function collectSubtreeNodes(node: ProjectTreeNode): ProjectTreeNode[] {
  const result: ProjectTreeNode[] = [node];
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      result.push(...collectSubtreeNodes(child));
    }
  }
  return result;
}

function resolveScopePath(workspace: string, rawPath: string): string {
  const trimmed = rawPath.trim();
  if (/^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('\\')) {
    return trimmed.replace(/\\/g, '/');
  }
  const cleanWs = workspace.replace(/\\/g, '/').replace(/\/+$/, '');
  const cleanRel = trimmed.replace(/\\/g, '/').replace(/^\/+/, '');
  return `${cleanWs}/${cleanRel}`;
}

export const ProjectTreeNavigator: React.FC<ProjectTreeNavigatorProps> = ({
  workspacePath,
  onClose,
  onWorkspaceChange,
}) => {
  const projectHierarchy = usePreviewStore((s) => s.projectHierarchy);
  const selectedProjectId = usePreviewStore((s) => s.selectedProjectId);
  const selectProject = usePreviewStore((s) => s.selectProject);
  const createProject = usePreviewStore((s) => s.createProject);
  const deleteProject = usePreviewStore((s) => s.deleteProject);
  const isProjectsLoading = usePreviewStore((s) => s.isProjectsLoading);
  const projectsError = usePreviewStore((s) => s.projectsError);
  const closeTab = usePreviewStore((s) => s.closeTab);
  const addTab = usePreviewStore((s) => s.addTab);
  const setPipelines = usePreviewStore((s) => s.setPipelines);
  const deleteDiscussion = usePreviewStore((s) => s.deleteDiscussion);

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalParentId, setModalParentId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectScope, setNewProjectScope] = useState('');
  const [modalWorkspacePath, setModalWorkspacePath] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Delete Project Confirmation Modal states (all default to true)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDeleteNode, setPendingDeleteNode] = useState<ProjectTreeNode | null>(null);
  const [deleteMemoryAndTree, setDeleteMemoryAndTree] = useState(true);
  const [deleteLinkedDebates, setDeleteLinkedDebates] = useState(true);
  const [resetLinkedPipelines, setResetLinkedPipelines] = useState(true);
  const [closeRelatedTabs, setCloseRelatedTabs] = useState(true);
  const [deleteFilesOnDisk, setDeleteFilesOnDisk] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Collapsible and Resizable sidebar states
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('flymd:projects-tree-collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const pendingSubtree = pendingDeleteNode ? collectSubtreeNodes(pendingDeleteNode) : [];
  const childSubprojectCount = Math.max(0, pendingSubtree.length - 1);
  const pendingDebateCount = pendingSubtree.filter((n) => Boolean(n.active_debate_id)).length;
  const pendingScopePaths = Array.from(
    new Set(
      pendingSubtree
        .flatMap((n) => n.scope_paths || [])
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
    )
  );

  const [treeWidth, setTreeWidth] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('flymd:projects-tree-width') || '288', 10);
    } catch {
      return 288;
    }
  });

  const isResizingRef = useRef(false);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    const startX = e.clientX;
    const startWidth = treeWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(220, Math.min(500, startWidth + delta));
      setTreeWidth(newWidth);
      try {
        localStorage.setItem('flymd:projects-tree-width', String(newWidth));
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

  const toggleCollapse = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    try {
      localStorage.setItem('flymd:projects-tree-collapsed', String(collapsed));
    } catch {}
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleOpenCreateModal = (parentId: string | null = null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setModalParentId(parentId);
    setNewProjectName('');
    setNewProjectDescription('');
    setNewProjectScope('');
    setSubmitError(null);
    const storeFolderPath = usePreviewStore.getState().folderPath;
    const defaultWs =
      workspacePath && workspacePath.trim().length > 0 && workspacePath.trim() !== '.'
        ? workspacePath.trim()
        : storeFolderPath && storeFolderPath.trim().length > 0
        ? storeFolderPath.trim()
        : '';
    setModalWorkspacePath(defaultWs);
    setShowCreateModal(true);
  };

  const handleBrowseModalWorkspace = async () => {
    try {
      const selected = await window.electronAPI?.openFolderDialog?.();
      if (selected) {
        setModalWorkspacePath(selected);
        if (onWorkspaceChange) {
          onWorkspaceChange(selected);
        }
      }
    } catch (err) {
      console.warn('Failed to pick folder:', err);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setSubmitError(null);

    const scopePaths = newProjectScope
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // If modalWorkspacePath is set, prefer that.
    // Otherwise check if a scope path contains an absolute directory!
    let chosenWs = modalWorkspacePath.trim();
    if (!chosenWs || chosenWs === '.') {
      for (const p of scopePaths) {
        if (/^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('/')) {
          chosenWs = p;
          break;
        }
      }
    }

    const effectiveWorkspace =
      chosenWs && chosenWs.length > 0 && chosenWs !== '.'
        ? chosenWs
        : workspacePath && workspacePath.trim().length > 0 && workspacePath.trim() !== '.'
        ? workspacePath.trim()
        : '.';

    const req: CreateProjectRequest = {
      parent_id: modalParentId,
      name: newProjectName.trim(),
      description: newProjectDescription.trim() || undefined,
      scope_paths: scopePaths.length > 0 ? scopePaths : undefined,
    };

    const res = await createProject(effectiveWorkspace, req);
    if (res) {
      if (modalParentId) {
        setExpandedNodes((prev) => ({ ...prev, [modalParentId]: true }));
      }
      setShowCreateModal(false);
    } else {
      const storeErr = usePreviewStore.getState().projectsError;
      setSubmitError(
        storeErr ||
          'Failed to initialize project on disk. Please ensure the workspace directory exists and is writable.'
      );
    }
  };

  const handleOpenDeleteModal = (node: ProjectTreeNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDeleteNode(node);
    setDeleteMemoryAndTree(true);
    setDeleteLinkedDebates(true);
    setResetLinkedPipelines(true);
    setCloseRelatedTabs(true);
    setDeleteFilesOnDisk(true);
    setDeleteError(null);
    setShowDeleteModal(true);
  };

  const handleConfirmDeleteProject = async () => {
    if (!pendingDeleteNode) return;
    setIsDeleting(true);
    setDeleteError(null);

    const effectiveWorkspace =
      workspacePath && workspacePath.trim().length > 0 && workspacePath.trim() !== '.'
        ? workspacePath.trim()
        : usePreviewStore.getState().folderPath || '.';

    try {
      const subtreeNodes = collectSubtreeNodes(pendingDeleteNode);
      const allProjectIds = subtreeNodes.map((n) => n.id);
      const allDebateIds = Array.from(
        new Set(
          subtreeNodes
            .map((n) => n.active_debate_id)
            .filter((id): id is string => Boolean(id && id.trim().length > 0))
        )
      );
      const allPipelineIds = Array.from(
        new Set(
          subtreeNodes
            .map((n) => n.active_pipeline_id)
            .filter((id): id is string => Boolean(id && id.trim().length > 0))
        )
      );
      const allScopePaths = Array.from(
        new Set(
          subtreeNodes
            .flatMap((n) => n.scope_paths || [])
            .map((p) => p.trim())
            .filter((p) => p.length > 0)
        )
      );

      // 1. Delete physical files on disk if requested
      if (deleteFilesOnDisk && allScopePaths.length > 0) {
        const normWs = effectiveWorkspace.toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '');
        for (const rawPath of allScopePaths) {
          const resolved = resolveScopePath(effectiveWorkspace, rawPath);
          const normResolved = resolved.toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '');
          if (
            !normResolved ||
            normResolved === normWs ||
            normResolved === '.' ||
            normResolved === '/' ||
            normResolved.length <= 3
          ) {
            console.warn('[ProjectTreeNavigator] Skipping unsafe path deletion:', resolved);
            continue;
          }
          if (window.electronAPI?.deleteFilePath) {
            try {
              await window.electronAPI.deleteFilePath(resolved);
            } catch (err) {
              console.warn('[ProjectTreeNavigator] Failed to delete file path:', resolved, err);
            }
          }
        }
      }

      // 2. Delete linked debates if requested
      if (deleteLinkedDebates && allDebateIds.length > 0) {
        for (const debateId of allDebateIds) {
          try {
            await deleteDiscussion(effectiveWorkspace, debateId);
          } catch (err) {
            console.warn('[ProjectTreeNavigator] Failed to delete debate session:', debateId, err);
          }
        }
      }

      // 3. Reset linked pipelines if requested
      if (resetLinkedPipelines && allPipelineIds.length > 0) {
        setPipelines((prev) =>
          prev.map((p) => {
            if (allPipelineIds.includes(p.id)) {
              return {
                ...p,
                steps: p.steps.map((s) => ({
                  ...s,
                  status: undefined,
                  completedTaskId: undefined,
                  errorDiagnostic: undefined,
                  completedAt: undefined,
                })),
              };
            }
            return p;
          })
        );
        const runningId = usePreviewStore.getState().runningPipelineId;
        if (runningId && allPipelineIds.includes(runningId)) {
          usePreviewStore.getState().setRunningPipelineId(null);
          usePreviewStore.getState().setRunningPipelineStepIdx(-1);
          usePreviewStore.getState().setWaitingForStepApproval(null);
        }
      }

      // 4. Close related open tabs in editor if requested
      if (closeRelatedTabs) {
        const currentTabs = usePreviewStore.getState().tabs;
        const tabsToClose = currentTabs.filter((t) => {
          if (!t.filePath) return false;
          const normTabPath = t.filePath.toLowerCase().replace(/\\/g, '/');
          for (const pid of allProjectIds) {
            if (
              normTabPath.includes(`/.flymd/projects/${pid.toLowerCase()}`) ||
              normTabPath.includes(`\\.flymd\\projects\\${pid.toLowerCase()}`)
            ) {
              return true;
            }
          }
          for (const rawPath of allScopePaths) {
            const resolved = resolveScopePath(effectiveWorkspace, rawPath);
            const normResolved = resolved.toLowerCase().replace(/\\/g, '/');
            if (normTabPath === normResolved || normTabPath.startsWith(`${normResolved}/`)) {
              return true;
            }
          }
          return false;
        });

        for (const tab of tabsToClose) {
          closeTab(tab.id);
        }

        const remainingTabs = usePreviewStore.getState().tabs;
        if (remainingTabs.length === 0) {
          addTab({
            fileName: 'Welcome.md',
            content: '# FlyMD\n\nProject files closed.\n',
          });
        }
      }

      // 5. Delete project tree node and scoped memory records
      if (deleteMemoryAndTree) {
        await deleteProject(effectiveWorkspace, pendingDeleteNode.id);
      }

      // Deselect if selected project was in the deleted subtree
      const currentSelected = usePreviewStore.getState().selectedProjectId;
      if (currentSelected && allProjectIds.includes(currentSelected)) {
        selectProject(null);
      }

      setShowDeleteModal(false);
      setPendingDeleteNode(null);
    } catch (err: any) {
      console.error('[ProjectTreeNavigator] Error deleting project:', err);
      setDeleteError(err?.message || String(err) || 'Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case 'idle':
        return (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
            <Clock className="w-2.5 h-2.5" /> Idle
          </span>
        );
      case 'debating':
        return (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-indigo-950/70 text-indigo-400 border border-indigo-700/60 animate-pulse">
            <Activity className="w-2.5 h-2.5" /> Debating
          </span>
        );
      case 'report_ready':
        return (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/70 text-cyan-300 border border-cyan-700/60">
            <FileText className="w-2.5 h-2.5" /> Report Ready
          </span>
        );
      case 'pipeline_running':
        return (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-600/60 animate-pulse">
            <Play className="w-2.5 h-2.5 fill-current" /> Running
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-600/60">
            <CheckCircle2 className="w-2.5 h-2.5" /> Done
          </span>
        );
      default:
        return null;
    }
  };

  const renderNode = (node: ProjectTreeNode, depth: number = 0) => {
    const isSelected = selectedProjectId === node.id;
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes[node.id] ?? true;

    return (
      <div key={node.id} className="select-none text-xs">
        <div
          onClick={() => selectProject(node.id)}
          className={`group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-all duration-150 ${
            isSelected
              ? 'bg-indigo-600/25 border border-indigo-500/50 text-slate-100 font-medium shadow-sm'
              : 'hover:bg-slate-800/60 text-slate-300 border border-transparent'
          }`}
          style={{ paddingLeft: `${Math.max(8, depth * 14 + 8)}px` }}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(node.id, e)}
                className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <div className="w-3.5" />
            )}

            <Boxes
              className={`w-3.5 h-3.5 shrink-0 ${
                isSelected ? 'text-indigo-400' : 'text-slate-500'
              }`}
            />

            <span className="truncate text-[12px]">{node.name}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-1">
            {getStatusBadge(node.status)}

            <button
              type="button"
              title="Add Sub-Project"
              onClick={(e) => handleOpenCreateModal(node.id, e)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-700/80 text-slate-400 hover:text-indigo-300 transition-all"
            >
              <Plus className="w-3 h-3" />
            </button>

            <button
              type="button"
              title="Delete Project / Sub-Project"
              disabled={isDeleting && pendingDeleteNode?.id === node.id}
              onClick={(e) => handleOpenDeleteModal(node, e)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-950/80 text-slate-400 hover:text-red-400 transition-all"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="flex flex-col border-l border-slate-800/80 ml-3.5 pl-0.5">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Collapsed Sidebar Rail Mode
  // -------------------------------------------------------------------------
  if (isCollapsed) {
    return (
      <aside
        onClick={() => toggleCollapse(false)}
        title="Click to expand Projects Tree"
        className="w-10 shrink-0 h-full border-r border-slate-800/90 bg-slate-950/80 hover:bg-slate-900/90 cursor-pointer flex flex-col items-center py-3 gap-3 transition-colors select-none group"
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapse(false);
          }}
          title="Expand Projects Tree"
          className="p-1 rounded-md text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors"
        >
          <PanelLeftOpen className="w-4 h-4 text-indigo-400" />
        </button>

        <div
          title={`${projectHierarchy.length} Projects Registered`}
          className="w-5 h-5 rounded-full bg-indigo-950/90 border border-indigo-700/60 text-[10px] text-indigo-300 font-mono flex items-center justify-center font-bold"
        >
          {projectHierarchy.length}
        </div>

        <div
          className="text-[10px] font-bold uppercase tracking-wider text-slate-500 group-hover:text-slate-300 transition-colors mt-2"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          Projects Tree
        </div>
      </aside>
    );
  }

  // -------------------------------------------------------------------------
  // Expanded & Resizable Sidebar Mode
  // -------------------------------------------------------------------------
  return (
    <div
      style={{ width: `${treeWidth}px` }}
      className="relative flex flex-col h-full border-r border-slate-800/80 bg-slate-950/60 backdrop-blur-sm shrink-0 select-none"
    >
      {/* Header with Collapsible & Close Controls */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800/80 bg-slate-900/70">
        <div className="flex items-center gap-2 min-w-0">
          <FolderTree className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="font-semibold text-xs tracking-wider uppercase text-slate-200 truncate">
            Projects Tree
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => handleOpenCreateModal(null)}
            title="Create Master Project"
            className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-indigo-600/80 hover:bg-indigo-600 text-white shadow-xs transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>

          <button
            type="button"
            onClick={() => toggleCollapse(true)}
            title="Collapse Projects Sidebar"
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close Projects Navigator"
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Hierarchy Tree List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {projectHierarchy.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4 text-slate-500">
            <Layers className="w-8 h-8 mb-2 stroke-[1.5] text-slate-600" />
            <p className="text-xs font-medium text-slate-400">No Projects Defined</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Create a master project to organize debates, reports, and isolated pipelines.
            </p>
            <button
              type="button"
              onClick={() => handleOpenCreateModal(null)}
              className="mt-3 flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Create Master Project
            </button>
          </div>
        ) : (
          projectHierarchy.map((rootNode) => renderNode(rootNode, 0))
        )}
      </div>

      {/* Footer Info */}
      <div className="px-3 py-2 border-t border-slate-800/80 bg-slate-900/40 text-[11px] text-slate-400 flex items-center justify-between">
        <span>{projectHierarchy.length} Master Projects</span>
        <span className="text-[10px] text-slate-500 font-mono">OMH Trees</span>
      </div>

      {/* Resizable Divider Handle (Drag right/left) */}
      <div
        onMouseDown={handleResizeMouseDown}
        title="Drag to resize Projects Tree"
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-500/60 z-30 transition-colors"
      />

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-4 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                {modalParentId ? 'Create Child Sub-Project' : 'Create Master Project'}
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {submitError && (
              <div className="mb-3 p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] leading-relaxed">
                {submitError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Project / Topic Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Physics Quantum Lab, Market Research, Book Chapter, System Architecture..."
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Workspace Directory Selector with Native Folder Picker */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-medium text-slate-400">
                    Workspace Directory
                  </label>
                  <span className="text-[10px] text-slate-500">Auto-detected from opened folder or CWD</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus-within:border-indigo-500">
                    <Folder className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="e.g. G:\xampp-httpdocs\fly4 or . (Current Directory)"
                      value={modalWorkspacePath}
                      onChange={(e) => setModalWorkspacePath(e.target.value)}
                      className="w-full bg-transparent border-0 focus:outline-none text-xs text-slate-200 font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleBrowseModalWorkspace}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs shrink-0 transition"
                    title="Select folder via native dialog..."
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                    <span>Browse...</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Description / Goals &amp; Scope
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe the main goal, topic, target audience, or requirements..."
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-medium text-slate-400">
                    Scoped Paths (Optional)
                  </label>
                  <span className="text-[10px] text-slate-500">Comma-separated</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. docs, research, chapters, src (optional)"
                  value={newProjectScope}
                  onChange={(e) => setNewProjectScope(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Optional subfolder or document filters for AI memory recall. Leave blank for full workspace coverage.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-xs rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newProjectName.trim() || isProjectsLoading}
                  className="px-3.5 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium shadow-sm transition-colors flex items-center gap-1.5"
                >
                  {isProjectsLoading && <Activity className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isProjectsLoading ? 'Creating Project...' : 'Create Project'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {showDeleteModal && pendingDeleteNode && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-rose-900/60 rounded-xl shadow-2xl p-5 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                    <span>Delete {pendingDeleteNode.parent_id ? 'Sub-Project' : 'Project'}</span>
                  </h3>
                  <div className="text-[11px] text-slate-400 truncate max-w-sm font-mono">
                    {pendingDeleteNode.name}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isDeleting) {
                    setShowDeleteModal(false);
                    setPendingDeleteNode(null);
                  }
                }}
                disabled={isDeleting}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {deleteError && (
              <div className="mt-3 p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] leading-relaxed">
                {deleteError}
              </div>
            )}

            {/* Sub-project warning badge */}
            {childSubprojectCount > 0 && (
              <div className="mt-3 flex items-start gap-2.5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-semibold text-amber-200">
                    Recursive Sub-Project Deletion
                  </div>
                  <div className="text-[11px] text-amber-300/80 mt-0.5">
                    This project has <strong>{childSubprojectCount}</strong> nested child sub-project(s). Deletion will cascade to all children and their associated data.
                  </div>
                </div>
              </div>
            )}

            <div className="mt-3 text-[11px] text-slate-400">
              Select what related memory, caches, and files to delete:
            </div>

            {/* Checkbox Options List */}
            <div className="mt-2.5 space-y-2 max-h-60 overflow-y-auto pr-1">
              {/* 1. Scoped Memory & Tree */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-800/80 cursor-pointer border border-slate-700/60 transition-colors">
                <input
                  type="checkbox"
                  checked={deleteMemoryAndTree}
                  onChange={(e) => setDeleteMemoryAndTree(e.target.checked)}
                  className="mt-0.5 rounded border-slate-600 text-rose-500 focus:ring-0 focus:ring-offset-0 bg-slate-900"
                />
                <div className="min-w-0">
                  <div className="font-semibold text-slate-200 text-[11px]">
                    Delete Project Hierarchy &amp; Scoped Memory
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Removes project tree registration and purges scoped memory records under <code className="text-purple-300 font-mono">.flymd/projects/{pendingDeleteNode.id}</code>.
                  </div>
                </div>
              </label>

              {/* 2. Linked Debates */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-800/80 cursor-pointer border border-slate-700/60 transition-colors">
                <input
                  type="checkbox"
                  checked={deleteLinkedDebates}
                  onChange={(e) => setDeleteLinkedDebates(e.target.checked)}
                  className="mt-0.5 rounded border-slate-600 text-rose-500 focus:ring-0 focus:ring-offset-0 bg-slate-900"
                />
                <div className="min-w-0">
                  <div className="font-semibold text-slate-200 text-[11px]">
                    Delete Linked Debates &amp; Deliberation History
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Purges active deliberation transcripts in <code className="text-purple-300 font-mono">.flymd/discussions</code> linked to this project or its sub-projects ({pendingDebateCount} linked).
                  </div>
                </div>
              </label>

              {/* 3. Linked Pipelines */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-800/80 cursor-pointer border border-slate-700/60 transition-colors">
                <input
                  type="checkbox"
                  checked={resetLinkedPipelines}
                  onChange={(e) => setResetLinkedPipelines(e.target.checked)}
                  className="mt-0.5 rounded border-slate-600 text-rose-500 focus:ring-0 focus:ring-offset-0 bg-slate-900"
                />
                <div className="min-w-0">
                  <div className="font-semibold text-slate-200 text-[11px]">
                    Reset Linked Workflows &amp; Pipelines
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Resets execution steps back to Idle and halts any running pipeline assigned to this project.
                  </div>
                </div>
              </label>

              {/* 4. Close Related Opened Tabs */}
              <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-800/80 cursor-pointer border border-slate-700/60 transition-colors">
                <input
                  type="checkbox"
                  checked={closeRelatedTabs}
                  onChange={(e) => setCloseRelatedTabs(e.target.checked)}
                  className="mt-0.5 rounded border-slate-600 text-rose-500 focus:ring-0 focus:ring-offset-0 bg-slate-900"
                />
                <div className="min-w-0">
                  <div className="font-semibold text-slate-200 text-[11px]">
                    Close Related Opened Files &amp; Tabs in Editor
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Closes open editor tabs pointing to this project's scoped directories or memory files.
                  </div>
                </div>
              </label>

              {/* 5. Physical Files on Disk */}
              <label
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-colors ${
                  pendingScopePaths.length === 0
                    ? 'bg-slate-900/40 border-slate-800 opacity-60 cursor-not-allowed'
                    : 'bg-slate-800/50 hover:bg-slate-800/80 cursor-pointer border-slate-700/60'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={pendingScopePaths.length === 0}
                  checked={pendingScopePaths.length > 0 && deleteFilesOnDisk}
                  onChange={(e) => setDeleteFilesOnDisk(e.target.checked)}
                  className="mt-0.5 rounded border-slate-600 text-rose-500 focus:ring-0 focus:ring-offset-0 bg-slate-900"
                />
                <div className="min-w-0">
                  <div className="font-semibold text-slate-200 text-[11px]">
                    Delete Scoped Files &amp; Folders from Disk
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {pendingScopePaths.length > 0 ? (
                      <span>
                        Permanently deletes on disk:{' '}
                        <code className="text-amber-300 font-mono text-[10px]">
                          {pendingScopePaths.join(', ')}
                        </code>
                      </span>
                    ) : (
                      <span>No custom scoped paths configured on this project.</span>
                    )}
                  </div>
                </div>
              </label>
            </div>

            {/* Footer Buttons */}
            <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setPendingDeleteNode(null);
                }}
                disabled={isDeleting}
                className="px-3 py-1.5 text-xs rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteProject}
                disabled={isDeleting}
                className="px-4 py-1.5 text-xs rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Activity className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting Project...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
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
