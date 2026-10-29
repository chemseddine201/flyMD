import React, { useEffect, useState } from 'react';
import {
  Brain,
  Database,
  ShieldCheck,
  Package,
  Save,
  RefreshCw,
  Plus,
  Tag,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Layers,
  Sparkles,
  X,
} from 'lucide-react';
import { usePreviewStore } from '../../../store';
import { MemoryEntryKind, ProjectMemoryRecord } from '../../../../../shared/types';

interface ProjectObservabilityHUDProps {
  workspacePath: string;
  onClose?: () => void;
}

export const ProjectObservabilityHUD: React.FC<ProjectObservabilityHUDProps> = ({
  workspacePath,
  onClose,
}) => {
  const selectedProjectId = usePreviewStore((s) => s.selectedProjectId);
  const activeProject = usePreviewStore((s) => s.activeProject);
  const masterMemory = usePreviewStore((s) => s.masterMemory);
  const loadMasterMemory = usePreviewStore((s) => s.loadMasterMemory);
  const saveMasterMemory = usePreviewStore((s) => s.saveMasterMemory);
  const projectMemories = usePreviewStore((s) => s.projectMemories);
  const loadProjectMemory = usePreviewStore((s) => s.loadProjectMemory);
  const appendProjectMemory = usePreviewStore((s) => s.appendProjectMemory);
  const activeRecallPack = usePreviewStore((s) => s.activeRecallPack);
  const generateRecallPack = usePreviewStore((s) => s.generateRecallPack);
  const agentTasks = usePreviewStore((s) => s.agentTasks);

  const [activeTab, setActiveTab] = useState<'master' | 'scoped' | 'evidence' | 'recall'>('master');
  const [editedMasterMemory, setEditedMasterMemory] = useState(masterMemory);
  const [isSavingMaster, setIsSavingMaster] = useState(false);
  const [isGeneratingRecall, setIsGeneratingRecall] = useState(false);

  // New memory entry form state
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [newEntryKind, setNewEntryKind] = useState<MemoryEntryKind>('decision');
  const [newEntryAuthor, setNewEntryAuthor] = useState('Operator');
  const [newEntrySummary, setNewEntrySummary] = useState('');
  const [newEntryDetails, setNewEntryDetails] = useState('');
  const [newEntryTags, setNewEntryTags] = useState('');

  useEffect(() => {
    if (workspacePath) {
      loadMasterMemory(workspacePath);
    }
  }, [workspacePath, loadMasterMemory]);

  useEffect(() => {
    setEditedMasterMemory(masterMemory);
  }, [masterMemory]);

  useEffect(() => {
    if (workspacePath && selectedProjectId) {
      loadProjectMemory(workspacePath, selectedProjectId);
      generateRecallPack(workspacePath, selectedProjectId, 2000);
    }
  }, [workspacePath, selectedProjectId, loadProjectMemory, generateRecallPack]);

  const handleSaveMaster = async () => {
    if (!workspacePath) return;
    setIsSavingMaster(true);
    await saveMasterMemory(workspacePath, editedMasterMemory);
    setIsSavingMaster(false);
  };

  const handleAddMemoryEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspacePath || !selectedProjectId || !newEntrySummary.trim()) return;

    const tags = newEntryTags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    await appendProjectMemory(
      workspacePath,
      selectedProjectId,
      newEntryAuthor.trim() || 'Operator',
      newEntryKind,
      newEntrySummary.trim(),
      newEntryDetails.trim() || undefined,
      tags
    );

    setNewEntrySummary('');
    setNewEntryDetails('');
    setNewEntryTags('');
    setShowAddEntry(false);
  };

  const handleRefreshRecallPack = async () => {
    if (!workspacePath || !selectedProjectId) return;
    setIsGeneratingRecall(true);
    await generateRecallPack(workspacePath, selectedProjectId, 2000);
    setIsGeneratingRecall(false);
  };

  const scopedList = selectedProjectId ? projectMemories[selectedProjectId] || [] : [];

  const getKindBadge = (kind: MemoryEntryKind) => {
    switch (kind) {
      case 'decision':
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950/70 text-blue-300 border border-blue-700/60">
            Decision
          </span>
        );
      case 'invariant':
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950/70 text-purple-300 border border-purple-700/60">
            Invariant
          </span>
        );
      case 'deliverable':
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-700/60">
            Deliverable
          </span>
        );
      case 'audit_note':
        return (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-700/60">
            Audit Note
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full border-l border-slate-800/80 bg-slate-950/70 backdrop-blur-md w-96 shrink-0 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800/80 bg-slate-900/70">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-400" />
          <span className="font-semibold text-xs tracking-wider uppercase text-slate-100">
            Memory & Observability HUD
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-800/80 bg-slate-900/40 px-2 pt-1 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('master')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-t-md transition-colors ${
            activeTab === 'master'
              ? 'bg-slate-800 text-indigo-300 border-t-2 border-indigo-500'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
          }`}
        >
          <Brain className="w-3.5 h-3.5" />
          <span>Master</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('scoped')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-t-md transition-colors ${
            activeTab === 'scoped'
              ? 'bg-slate-800 text-indigo-300 border-t-2 border-indigo-500'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Scoped</span>
          {scopedList.length > 0 && (
            <span className="text-[10px] bg-slate-700 text-slate-300 px-1 rounded-full">
              {scopedList.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('evidence')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-t-md transition-colors ${
            activeTab === 'evidence'
              ? 'bg-slate-800 text-indigo-300 border-t-2 border-indigo-500'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Evidence</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('recall')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-t-md transition-colors ${
            activeTab === 'recall'
              ? 'bg-slate-800 text-indigo-300 border-t-2 border-indigo-500'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Recall</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-3 text-xs">
        {/* Tab 1: Master Memory */}
        {activeTab === 'master' && (
          <div className="flex flex-col h-full space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Global Invariants (`.flymd/MASTER_MEMORY.md`)</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => loadMasterMemory(workspacePath)}
                  title="Reload Master Memory"
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleSaveMaster}
                  disabled={isSavingMaster}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
                >
                  <Save className="w-3 h-3" />
                  <span>Save</span>
                </button>
              </div>
            </div>

            <textarea
              value={editedMasterMemory}
              onChange={(e) => setEditedMasterMemory(e.target.value)}
              className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 font-mono text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500/70 resize-none leading-relaxed"
              placeholder="# Master System Architecture & Global Memory Ledger..."
            />
          </div>
        )}

        {/* Tab 2: Scoped Memory */}
        {activeTab === 'scoped' && (
          <div className="flex flex-col h-full space-y-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="truncate">
                {activeProject ? `Project: ${activeProject.name}` : 'Select a Project Node'}
              </span>
              {activeProject && (
                <button
                  type="button"
                  onClick={() => setShowAddEntry(!showAddEntry)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Entry</span>
                </button>
              )}
            </div>

            {/* Mini Add Entry Form */}
            {showAddEntry && activeProject && (
              <form
                onSubmit={handleAddMemoryEntry}
                className="bg-slate-900 border border-slate-700/80 rounded-lg p-2.5 space-y-2 animate-in fade-in duration-150"
              >
                <div className="flex items-center gap-2">
                  <select
                    value={newEntryKind}
                    onChange={(e) => setNewEntryKind(e.target.value as MemoryEntryKind)}
                    className="bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-[11px] text-slate-200"
                  >
                    <option value="decision">Decision</option>
                    <option value="invariant">Invariant</option>
                    <option value="deliverable">Deliverable</option>
                    <option value="audit_note">Audit Note</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Author / Role"
                    value={newEntryAuthor}
                    onChange={(e) => setNewEntryAuthor(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200"
                  />
                </div>

                <input
                  type="text"
                  required
                  placeholder="Summary of decision or invariant..."
                  value={newEntrySummary}
                  onChange={(e) => setNewEntrySummary(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200"
                />

                <textarea
                  rows={2}
                  placeholder="Additional context or contract details..."
                  value={newEntryDetails}
                  onChange={(e) => setNewEntryDetails(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 resize-none"
                />

                <input
                  type="text"
                  placeholder="Tags (comma-separated, e.g. api, jwt, auth)"
                  value={newEntryTags}
                  onChange={(e) => setNewEntryTags(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200"
                />

                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowAddEntry(false)}
                    className="px-2 py-0.5 rounded text-[11px] text-slate-400 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-2.5 py-0.5 rounded text-[11px] bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                  >
                    Commit Record
                  </button>
                </div>
              </form>
            )}

            {/* List */}
            {!activeProject ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-slate-500">
                <Database className="w-8 h-8 mb-2 stroke-[1.5] text-slate-600" />
                <p>Select a project from the left tree to view its scoped memory ledger.</p>
              </div>
            ) : scopedList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-slate-500">
                <Database className="w-8 h-8 mb-2 stroke-[1.5] text-slate-600" />
                <p>No memory records yet for this project.</p>
                <p className="text-[10px] text-slate-600 mt-1">
                  Decisions during debates or commits will be recorded here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {scopedList.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        {getKindBadge(rec.kind)}
                        <span className="text-[11px] text-slate-400 font-medium">
                          {rec.author_role}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {new Date(rec.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-slate-200 font-medium mb-1">{rec.summary}</p>
                    {rec.details && (
                      <p className="text-slate-400 text-[11px] whitespace-pre-wrap leading-relaxed">
                        {rec.details}
                      </p>
                    )}

                    {rec.tags && rec.tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        {rec.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 flex items-center gap-0.5"
                          >
                            <Tag className="w-2.5 h-2.5" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Evidence Receipts */}
        {activeTab === 'evidence' && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <h4 className="font-semibold text-slate-200 flex items-center gap-1.5 mb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Evidence-Before-Done Receipts (OMH)
              </h4>
              <p className="text-[11px] text-slate-400 mb-3">
                Strict guarantees ensuring code cannot be marked completed without empirical proof.
              </p>

              <div className="space-y-2 text-[11px]">
                <div className="flex items-start gap-2 p-2 rounded bg-slate-950/60 border border-slate-800/80">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-slate-200">1. Architectural Contract Gate</span>
                    <p className="text-slate-400 text-[10px]">
                      Deliberation debate completed with synthesized Checklist Report.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-2 rounded bg-slate-950/60 border border-slate-800/80">
                  <FileCode className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-slate-200">2. Real Files Modified in Workspace</span>
                    <p className="text-slate-400 text-[10px]">
                      Filesystem audit confirms actual deliverable files written inside bounded scope.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-2 rounded bg-slate-950/60 border border-slate-800/80">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-slate-200">3. Process Settlement & PID Isolation</span>
                    <p className="text-slate-400 text-[10px]">
                      Sub-process terminated via Job Object tree manager without lingering handles.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Tool Receipts */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-slate-400">
                Recent Task Evidence Receipts
              </span>
              {agentTasks.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px]"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-200">@{task.targetAgentId}</span>
                    <span className="text-[10px] text-slate-500">
                      {task.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[10px] truncate">{task.fileName}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Recall Pack */}
        {activeTab === 'recall' && (
          <div className="flex flex-col h-full space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Token-Budgeted Recall Pack</span>
              <button
                type="button"
                onClick={handleRefreshRecallPack}
                disabled={isGeneratingRecall || !selectedProjectId}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 transition-colors"
              >
                <RefreshCw
                  className={`w-3 h-3 ${isGeneratingRecall ? 'animate-spin' : ''}`}
                />
                <span>Generate</span>
              </button>
            </div>

            {!activeRecallPack ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-slate-500">
                <Package className="w-8 h-8 mb-2 stroke-[1.5] text-slate-600" />
                <p>Select a project to inspect its tailored Recall Pack.</p>
              </div>
            ) : (
              <div className="flex flex-col h-full space-y-2">
                <div className="flex items-center justify-between px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px]">
                  <span className="text-slate-400">Estimated Tokens:</span>
                  <span className="font-mono font-medium text-indigo-400">
                    ~{activeRecallPack.estimated_tokens} tokens
                  </span>
                </div>

                <div className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 font-mono text-[11px] text-slate-300 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {activeRecallPack.rendered_markdown}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
