import React from 'react';
import {
  Bot,
  KeyRound,
  Users,
  RefreshCw,
  BrainCircuit,
  SlidersHorizontal,
  Trash2,
  FolderGit2,
  FolderTree,
  Boxes,
  Brain,
} from 'lucide-react';
import { ProjectNode, ScannedMdFile } from '../../../../../shared/types';
import { TokenQuotaHUD } from '../common/TokenQuotaHUD';

export type AgentLifecycleStage = 'debate' | 'report' | 'pipeline';

export interface StudioTopHeaderBarProps {
  resolvedWorkspace: string;
  showProjectTree: boolean;
  onToggleProjectTree: () => void;
  activeProject: ProjectNode | null;
  lifecycleStage: AgentLifecycleStage;
  onSelectLifecycleStage: (stage: AgentLifecycleStage) => void;
  workspaceFocusMode: 'workspace' | 'file';
  focusFilePath: string;
  activeTabFilePath?: string;
  cleanWorkspaceFiles: ScannedMdFile[];
  onChangeTargetScope: (mode: 'workspace' | 'file', filePath: string) => void;
  onOpenAdvancedDispatchModal: () => void;
  onOpenCouncilBroadcastModal: () => void;
  showObservabilityHUD: boolean;
  onToggleObservabilityHUD: () => void;
  onOpenSharedMemory: () => void;
  onRequestClearCacheModal: () => void;
  onOpenAgentAccountsModal: () => void;
  refreshing: boolean;
  onRefreshAll: () => void;
}

export const StudioTopHeaderBar: React.FC<StudioTopHeaderBarProps> = React.memo(
  ({
    resolvedWorkspace,
    showProjectTree,
    onToggleProjectTree,
    activeProject,
    lifecycleStage,
    onSelectLifecycleStage,
    workspaceFocusMode,
    focusFilePath,
    activeTabFilePath,
    cleanWorkspaceFiles,
    onChangeTargetScope,
    onOpenAdvancedDispatchModal,
    onOpenCouncilBroadcastModal,
    showObservabilityHUD,
    onToggleObservabilityHUD,
    onOpenSharedMemory,
    onRequestClearCacheModal,
    onOpenAgentAccountsModal,
    refreshing,
    onRefreshAll,
  }) => {
    return (
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
              onClick={onToggleProjectTree}
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
              onClick={() => onSelectLifecycleStage('debate')}
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
              onClick={() => onSelectLifecycleStage('report')}
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
              onClick={() => onSelectLifecycleStage('pipeline')}
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
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Scope:
            </span>
            <select
              value={
                workspaceFocusMode === 'workspace'
                  ? '__root__'
                  : focusFilePath || activeTabFilePath || ''
              }
              onChange={(e) => {
                if (e.target.value === '__root__') {
                  onChangeTargetScope('workspace', '');
                } else {
                  onChangeTargetScope('file', e.target.value);
                }
              }}
              className="bg-transparent text-slate-200 font-semibold text-[11px] focus:outline-none cursor-pointer border-0 py-0 max-w-[220px] truncate"
              title="Target Scope: Entire Project Workspace vs Specific Focused Document"
            >
              <option value="__root__">
                🌐 Entire Workspace (
                {resolvedWorkspace ? resolvedWorkspace.split(/[\\/]/).pop() : 'Root'})
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
          <TokenQuotaHUD />

          <button
            type="button"
            onClick={onOpenAdvancedDispatchModal}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
            title="Advanced Task Options (Checklist filter, Parallel Worktree, etc.)"
          >
            <SlidersHorizontal size={14} className="text-sky-400" />
          </button>

          <button
            type="button"
            onClick={onOpenCouncilBroadcastModal}
            className="p-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 transition-colors"
            title="Council Broadcast (Multi-Agent Sync)"
          >
            <Users size={14} />
          </button>

          {resolvedWorkspace && (
            <button
              type="button"
              onClick={onToggleObservabilityHUD}
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
              onClick={onOpenSharedMemory}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
              title="Open Shared Memory (.flymd/MEMORY.md)"
            >
              <BrainCircuit size={14} className="text-amber-400" />
            </button>
          )}

          {resolvedWorkspace && (
            <button
              type="button"
              onClick={onRequestClearCacheModal}
              className="p-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 transition-colors"
              title="Clear Memory & Cache (Handoffs, checkpoints, memory ledger)"
            >
              <Trash2 size={14} className="text-rose-400" />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenAgentAccountsModal}
            className="p-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 transition-colors shadow-sm"
            title="Custom Agents & Logins (API Keys & Profiles)"
          >
            <KeyRound size={14} />
          </button>

          <button
            type="button"
            onClick={onRefreshAll}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
            title="Refresh Agents & Sessions"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>
    );
  }
);
