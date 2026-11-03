import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Users,
  Send,
  CheckCircle2,
  GitBranch,
  FileText,
  Sparkles,
  Brain,
  RefreshCw,
} from 'lucide-react';
import { usePreviewStore, selectActiveTab } from '../../store';
import { AGENT_INTENT_PRESETS } from '../../../../shared/constants';
import { AgentId, AgentTaskIntent, AgentEffortLevel } from '../../../../shared/types';
import { useSubscriptionAgents } from '../../hooks/useSubscriptionAgents';
import { UnsavedChangesModal } from '../common/UnsavedChangesModal';

const READY_AUTH_STATES = ['connected', 'api-key-ready', 'web-connected', 'ready'];

export const CouncilModal: React.FC = () => {
  const showCouncilModal = usePreviewStore((s) => s.showCouncilModal);
  const setShowCouncilModal = usePreviewStore((s) => s.setShowCouncilModal);
  const setAgentTasks = usePreviewStore((s) => s.setAgentTasks);
  const setAgentCheckpoints = usePreviewStore((s) => s.setAgentCheckpoints);
  const setViewMode = usePreviewStore((s) => s.setViewMode);
  const activeTab = usePreviewStore(selectActiveTab);
  const folderPath = usePreviewStore((s) => s.folderPath);
  const supervisionConfig = usePreviewStore((s) => s.supervisionConfig);

  const {
    enabledAgentProfiles,
    isRefreshing,
    refreshSubscriptionAgents,
    getSubscriptionTierForAgent,
  } = useSubscriptionAgents(false);

  const [selectedAgents, setSelectedAgents] = useState<AgentId[]>([]);
  const userTouchedSelection = useRef(false);
  const [intent, setIntent] = useState<AgentTaskIntent>('review');
  const [customPrompt, setCustomPrompt] = useState('');
  const [safeParallelMode, setSafeParallelMode] = useState(true);
  const [effortLevel, setEffortLevel] = useState<AgentEffortLevel>('medium');
  const [thinkingEnabled, setThinkingEnabled] = useState<boolean>(true);
  const [broadcasting, setBroadcasting] = useState(false);
  const [showDiscardAlert, setShowDiscardAlert] = useState(false);

  const handleRequestClose = () => {
    if (customPrompt.trim().length > 0) {
      setShowDiscardAlert(true);
    } else {
      setShowCouncilModal(false);
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardAlert(false);
    setCustomPrompt('');
    setShowCouncilModal(false);
  };

  // Re-scan subscriptions each time the council opens
  useEffect(() => {
    if (showCouncilModal) {
      userTouchedSelection.current = false;
      refreshSubscriptionAgents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCouncilModal]);

  // Default the council to every connected subscription agent (until the user edits the selection)
  useEffect(() => {
    if (!showCouncilModal || userTouchedSelection.current) return;
    const connected = enabledAgentProfiles
      .filter((a) => a.installed && READY_AUTH_STATES.includes(a.authStatus))
      .map((a) => a.id);
    const fallback = enabledAgentProfiles.slice(0, 2).map((a) => a.id);
    setSelectedAgents(connected.length > 0 ? connected : fallback);
  }, [showCouncilModal, enabledAgentProfiles]);

  if (!showCouncilModal) return null;

  const visibleAgents = enabledAgentProfiles;

  const toggleAgent = (agentId: AgentId) => {
    userTouchedSelection.current = true;
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
          effortLevel,
          thinkingEnabled,
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
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fade-in select-none">
      <div className="relative w-full max-w-4xl lg:max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden transition-colors duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/95">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Users size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Council of Agents — Multi-Agent Broadcast
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  Parallel Compare
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Send the current Markdown file to multiple agents simultaneously and compare their insights or solutions side-by-side.
              </p>
            </div>
          </div>

          <button
            onClick={handleRequestClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto bg-white dark:bg-slate-900">
          {/* Active File Banner */}
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs">
              <FileText size={14} className="text-sky-600 dark:text-sky-400" />
              <span className="text-slate-500 dark:text-slate-400">Broadcasting File:</span>
              <span className="font-bold text-slate-800 dark:text-white">
                {activeTab ? activeTab.fileName : 'No active Markdown file open'}
              </span>
            </div>
            <span className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">
              {selectedAgents.length} Agents Selected
            </span>
          </div>

          {/* Select Council Members */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                1. Select Council Members (2 or more recommended)
              </label>
              <button
                type="button"
                onClick={() => refreshSubscriptionAgents()}
                disabled={isRefreshing}
                className="text-[11px] text-sky-600 dark:text-sky-400 hover:text-sky-500 flex items-center gap-1 font-semibold"
              >
                <RefreshCw size={11} className={isRefreshing ? 'animate-spin' : ''} />
                Refresh Subscriptions
              </button>
            </div>
            {visibleAgents.length === 0 && (
              <div className="text-[11px] text-amber-700 dark:text-amber-300 mb-2">
                No agents discovered yet. Connect a subscription in Manage Logins, then refresh.
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {visibleAgents.map((agent) => {
                const isSelected = selectedAgents.includes(agent.id);
                const tier = getSubscriptionTierForAgent(agent.id);
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => toggleAgent(agent.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-amber-500/10 dark:bg-slate-800 border-amber-500 dark:border-amber-400/70 ring-1 ring-amber-500/30'
                        : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 opacity-75 hover:opacity-100 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: agent.accentColor }}
                        />
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {agent.name}
                        </span>
                        {agent.isCustom && (
                          <span className="text-[9px] font-bold uppercase px-1 rounded bg-violet-500/20 text-violet-700 dark:text-violet-300">
                            Custom
                          </span>
                        )}
                        {tier && (
                          <span className="text-[9px] font-bold uppercase px-1 rounded bg-sky-500/20 text-sky-700 dark:text-sky-300">
                            {tier}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate mt-0.5">
                        {agent.vendor}
                      </span>
                    </div>
                    {isSelected && (
                      <CheckCircle2 size={15} className="text-amber-500 dark:text-amber-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Shared Council Mission */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
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
                        ? 'bg-amber-500/15 border-amber-500/50 text-slate-900 dark:text-white'
                        : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <Sparkles size={12} className="text-amber-500 dark:text-amber-400" />
                      {preset.title}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
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
              className="mt-2.5 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Effort & Thinking Control */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                Reasoning Effort Level
              </label>
              <select
                value={effortLevel}
                onChange={(e) =>
                  setEffortLevel(e.target.value as AgentEffortLevel)
                }
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-amber-700 dark:text-amber-300 font-bold text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                title="Reasoning effort level applied to all council agents"
              >
                <option value="low">Low (Fastest • Minimal Tokens)</option>
                <option value="medium">Medium (Balanced • Default)</option>
                <option value="high">High (Deep Verification)</option>
                <option value="xhigh">X-High (Exhaustive Architecture)</option>
                <option value="max">Max (Maximum Effort)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                Thinking Mode (CoT)
              </label>
              <button
                type="button"
                onClick={() => setThinkingEnabled((prev) => !prev)}
                className={`w-full px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  thinkingEnabled
                    ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-700 dark:text-indigo-300 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-400 line-through'
                }`}
              >
                <Brain
                  size={14}
                  className={
                    thinkingEnabled ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'
                  }
                />
                <span>
                  {thinkingEnabled
                    ? 'Thinking Enabled (ON)'
                    : 'Thinking Disabled (OFF)'}
                </span>
              </button>
            </div>
          </div>

          {/* Safe Parallel Mode Info */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-violet-500/10 border border-violet-500/30">
            <div className="flex items-center gap-2.5">
              <GitBranch size={16} className="text-violet-600 dark:text-violet-400 shrink-0" />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Isolated Parallel Worktrees Enabled
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300">
                  Each agent runs in its own isolated sandbox so they never overwrite each other&apos;s files.
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={safeParallelMode}
              onChange={(e) => setSafeParallelMode(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-violet-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/95">
          <button
            type="button"
            onClick={handleRequestClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
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

      <UnsavedChangesModal
        isOpen={showDiscardAlert}
        title="Discard Council Instructions?"
        message="You have entered custom instructions for the council that have not been broadcast. Discard instructions?"
        confirmLabel="Discard Instructions"
        cancelLabel="Keep Editing"
        onConfirmDiscard={handleConfirmDiscard}
        onCancelKeepEditing={() => setShowDiscardAlert(false)}
      />
    </div>
  );
};
