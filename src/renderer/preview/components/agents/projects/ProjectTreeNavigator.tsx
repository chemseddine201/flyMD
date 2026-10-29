import React, { useState } from 'react';
import {
  FolderTree,
  FolderPlus,
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
}

export const ProjectTreeNavigator: React.FC<ProjectTreeNavigatorProps> = ({
  workspacePath,
}) => {
  const projectHierarchy = usePreviewStore((s) => s.projectHierarchy);
  const selectedProjectId = usePreviewStore((s) => s.selectedProjectId);
  const selectProject = usePreviewStore((s) => s.selectProject);
  const createProject = usePreviewStore((s) => s.createProject);
  const deleteProject = usePreviewStore((s) => s.deleteProject);
  const isProjectsLoading = usePreviewStore((s) => s.isProjectsLoading);
  const projectsError = usePreviewStore((s) => s.projectsError);

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalParentId, setModalParentId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectScope, setNewProjectScope] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setSubmitError(null);

    const effectiveWorkspace =
      workspacePath && workspacePath.trim().length > 0 ? workspacePath.trim() : '.';

    const scopePaths = newProjectScope
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

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
      setSubmitError(
        projectsError ||
          'Failed to initialize project on disk. Please ensure the workspace directory exists and is writable.'
      );
    }
  };

  const handleDelete = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const effectiveWorkspace =
      workspacePath && workspacePath.trim().length > 0 ? workspacePath.trim() : '.';
    setDeletingId(projectId);
    await deleteProject(effectiveWorkspace, projectId);
    setDeletingId(null);
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
              title="Delete Project Node"
              disabled={deletingId === node.id}
              onClick={(e) => handleDelete(node.id, e)}
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

  return (
    <div className="flex flex-col h-full border-r border-slate-800/80 bg-slate-950/50 backdrop-blur-sm w-72 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800/80 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-xs tracking-wider uppercase text-slate-200">
            Projects Tree
          </span>
        </div>

        <button
          type="button"
          onClick={() => handleOpenCreateModal(null)}
          title="Create Root Project"
          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-indigo-600/80 hover:bg-indigo-600 text-white shadow-sm transition-colors"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span>New Project</span>
        </button>
      </div>

      {/* Hierarchy Tree List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {projectHierarchy.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4 text-slate-500">
            <Layers className="w-8 h-8 mb-2 stroke-[1.5] text-slate-600" />
            <p className="text-xs font-medium text-slate-400">No Projects Defined</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Create a root project to organize debates, reports, and isolated pipelines.
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
        <span>{projectHierarchy.length} Root Projects</span>
        <span className="text-[10px] text-slate-500">OMH Scoped Trees</span>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-4 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              {modalParentId ? 'Create Child Sub-Project' : 'Create Master Project'}
            </h3>

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
                  placeholder="e.g. Market Research, Content Strategy, Product Launch, Book Chapter, System Architecture..."
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
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
                  <span className="text-[10px] text-slate-500">Leave blank for general topics</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. docs, research, chapters, src (optional)"
                  value={newProjectScope}
                  onChange={(e) => setNewProjectScope(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Optional folder or document paths. Leave empty if this project covers broad topics across the workspace.
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
    </div>
  );
};

