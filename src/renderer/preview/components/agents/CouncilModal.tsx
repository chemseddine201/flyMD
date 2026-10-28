import React, { useState } from 'react';
import {
  X,
  Users,
  Send,
  CheckCircle2,
  GitBranch,
  FileText,
  Sparkles,
} from 'lucide-react';
import { usePreviewStore, selectActiveTab } from '../../store';
import { AGENT_INTENT_PRESETS } from '../../../../shared/constants';
import { AgentId, AgentTaskIntent } from '../../../../shared/types';

export const CouncilModal: React.FC = () => {
  const showCouncilModal = usePreviewStore((s) => s.showCouncilModal);
  const setShowCouncilModal = usePreviewStore((s) => s.setShowCouncilModal);
  const agentProfiles = usePreviewStore((s) => s.agentProfiles);
  const setAgentTasks = usePreviewStore((s) => s.setAgentTasks);
  const setAgentCheckpoints = usePreviewStore((s) => s.setAgentCheckpoints);
  const setViewMode = usePreviewStore((s) => s.setViewMode);
  const activeTab = usePreviewStore(selectActiveTab);
  const folderPath = usePreviewStore((s) => s.folderPath);
  const supervisionConfig = usePreviewStore((s) => s.supervisionConfig);

  const [selectedAgents, setSelectedAgents] = useState<AgentId[]>([
    'antigravity',
    'claude-code',
    'opencode',
  ]);
  const [intent, setIntent] = useState<AgentTaskIntent>('review');
  const [customPrompt, setCustomPrompt] = useState('');
  const [safeParallelMode, setSafeParallelMode] = useState(true);
  const [broadcasting, setBroadcasting] = useState(false);

  if (!showCouncilModal) return null;

  const enabledProfiles = agentProfiles.filter((a) => a.enabled);
  const visibleAgents = enabledProfiles.length > 0 ? enabledProfiles : agentProfiles;

  const toggleAgent = (agentId: AgentId) => {
    setSelectedAgents((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId]
    );
  };

  const resolvedWorkspace =
    folderPath ||
    supervisionConfig?.path ||
    (activeTab?.filePath ? activeTab.filePath.replace(/[\\/][^\\/]+$/, '') : '');

  const handleBroadcast = async () => {
    if (!activeTab || selectedAgents.length === 0) return;
    setBroadcasting(true);
    try {
      for (const agentId of selectedAgents) {
        await window.electronAPI.dispatchAgentTask({
          targetAgentId: agentId,
          filePath: activeTab.filePath,
          fileName: activeTab.fileName,
          markdownContent: activeTab.content,
          intent,
          customPrompt: customPrompt.trim() || undefined,
          workspacePath: resolvedWorkspace,
          createSafetyCheckpoint: true,
          safeParallelMode,
          attachSharedMemory: true,
        });
      }
      const [tasks, checkpoints] = await Promise.all([
        window.electronAPI.getAgentTasks(),
        window.electronAPI.getAgentCheckpoints(),
      ]);
      setAgentTasks(tasks);
      setAgentCheckpoints(checkpoints);
      setShowCouncilModal(false);
      setViewMode('agents');
    } catch (err) {
      console.error('Failed to broadcast to Council of Agents:', err);
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-4xl lg:max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/95">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Users size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Council of Agents — Multi-Agent Broadcast
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Parallel Compare
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Send the current Markdown file to multiple agents simultaneously and compare their insights or solutions side-by-side.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowCouncilModal(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* Active File Banner */}
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center gap-2 text-xs">
              <FileText size={14} className="text-sky-400" />
              <span className="text-slate-400">Broadcasting File:</span>
              <span className="font-bold text-white">
                {activeTab ? activeTab.fileName : 'No active Markdown file open'}
              </span>
            </div>
            <span className="text-[11px] text-amber-300 font-semibold">
              {selectedAgents.length} Agents Selected
            </span>
          </div>

          {/* Select Council Members */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              1. Select Council Members (2 or more recommended)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {visibleAgents.map((agent) => {
                const isSelected = selectedAgents.includes(agent.id);
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => toggleAgent(agent.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-slate-800 border-amber-400/70 ring-1 ring-amber-400/30'
                        : 'bg-slate-950/60 border-slate-800 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: agent.accentColor }}
                        />
                        <span className="text-xs font-bold text-white truncate">
                          {agent.name}
                        </span>
                        {agent.isCustom && (
                          <span className="text-[9px] font-bold uppercase px-1 rounded bg-violet-500/25 text-violet-300">
                            Custom
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                        {agent.vendor}
                      </span>
                    </div>
                    {isSelected && (
                      <CheckCircle2 size={15} className="text-amber-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Shared Council Mission */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              2. Council Mission
            </label>
            <div className="grid grid-cols-2 gap-2">
              {AGENT_INTENT_PRESETS.slice(0, 6).map((preset) => {
                const active = intent === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setIntent(preset.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      active
                        ? 'bg-amber-500/15 border-amber-500/50 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <Sparkles size={12} className="text-amber-400" />
                      {preset.title}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {preset.nonDevLabel}
                    </div>
                  </button>
                );
              })}
            </div>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={2}
              placeholder="Optional instructions for all selected agents..."
              className="mt-2.5 w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Safe Parallel Mode Info */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-violet-500/10 border border-violet-500/30">
            <div className="flex items-center gap-2.5">
              <GitBranch size={16} className="text-violet-400 shrink-0" />
              <div>
                <div className="text-xs font-bold text-white">
                  Isolated Parallel Worktrees Enabled
                </div>
                <div className="text-[11px] text-slate-300">
                  Each agent runs in its own isolated sandbox so they never overwrite each other&apos;s files.
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={safeParallelMode}
              onChange={(e) => setSafeParallelMode(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-violet-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-slate-800 bg-slate-900/95">
          <button
            type="button"
            onClick={() => setShowCouncilModal(false)}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!activeTab || selectedAgents.length === 0 || broadcasting}
            onClick={handleBroadcast}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition-all"
          >
            <Send size={14} />
            {broadcasting
              ? 'Broadcasting...'
              : `Broadcast to ${selectedAgents.length} Agents`}
          </button>
        </div>
      </div>
    </div>
  );
};
