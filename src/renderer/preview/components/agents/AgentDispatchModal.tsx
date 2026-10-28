import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Send,
  ShieldCheck,
  GitBranch,
  BrainCircuit,
  CheckSquare,
  Square,
  Sparkles,
  Rocket,
  Wrench,
  CheckCircle2,
  Lightbulb,
  MessageSquarePlus,
  ArrowRight,
  FileText,
  KeyRound,
  Globe,
  Terminal,
  Plus,
} from 'lucide-react';
import { usePreviewStore } from '../../store';
import { AGENT_INTENT_PRESETS } from '../../../../shared/constants';
import { AgentId, AgentTaskIntent } from '../../../../shared/types';

export const AgentDispatchModal: React.FC = () => {
  const dispatchDraft = usePreviewStore((s) => s.dispatchDraft);
  const closeDispatchModal = usePreviewStore((s) => s.closeDispatchModal);
  const agentProfiles = usePreviewStore((s) => s.agentProfiles);
  const setAgentTasks = usePreviewStore((s) => s.setAgentTasks);
  const setAgentCheckpoints = usePreviewStore((s) => s.setAgentCheckpoints);
  const setShowAgentAccountsModal = usePreviewStore((s) => s.setShowAgentAccountsModal);
  const folderPath = usePreviewStore((s) => s.folderPath);
  const supervisionConfig = usePreviewStore((s) => s.supervisionConfig);
  const setViewMode = usePreviewStore((s) => s.setViewMode);

  const [targetAgentId, setTargetAgentId] = useState<AgentId>('claude-code');
  const [intent, setIntent] = useState<AgentTaskIntent>('build');
  const [customPrompt, setCustomPrompt] = useState('');
  const [createSafetyCheckpoint, setCreateSafetyCheckpoint] = useState(true);
  const [safeParallelMode, setSafeParallelMode] = useState(false);
  const [attachSharedMemory, setAttachSharedMemory] = useState(true);
  const [nextAgentInChain, setNextAgentInChain] = useState<string>('');
  const [nextIntentInChain, setNextIntentInChain] = useState<AgentTaskIntent>('review');
  const [selectedTasks, setSelectedTasks] = useState<Record<number, boolean>>({});
  const [filterSelectedOnly, setFilterSelectedOnly] = useState(false);
  const [executionMode, setExecutionMode] = useState<'in-app' | 'web'>('in-app');
  const [submitting, setSubmitting] = useState(false);

  const checklistItems = useMemo(() => {
    if (!dispatchDraft?.markdownContent) return [];
    const lines = dispatchDraft.markdownContent.split(/\r?\n/);
    const items: { index: number; text: string; checked: boolean }[] = [];
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('* [ ] ')) {
        items.push({ index: idx, text: trimmed.slice(6).trim(), checked: false });
      } else if (
        trimmed.startsWith('- [x] ') ||
        trimmed.startsWith('- [X] ') ||
        trimmed.startsWith('* [x] ') ||
        trimmed.startsWith('* [X] ')
      ) {
        items.push({ index: idx, text: trimmed.slice(6).trim(), checked: true });
      }
    });
    return items;
  }, [dispatchDraft?.markdownContent]);

  useEffect(() => {
    if (dispatchDraft) {
      const targetId = dispatchDraft.targetAgentId || 'claude-code';
      setTargetAgentId(targetId);
      setNextAgentInChain(dispatchDraft.nextAgentInChain || '');
      setExecutionMode('in-app');
      const initialSelected: Record<number, boolean> = {};
      checklistItems.forEach((item) => {
        if (!item.checked) {
          initialSelected[item.index] = true;
        }
      });
      setSelectedTasks(initialSelected);
      setFilterSelectedOnly(false);
    }
  }, [dispatchDraft, checklistItems]);

  if (!dispatchDraft || !dispatchDraft.isOpen) return null;

  const visibleAgents =
    agentProfiles.filter((a) => a.enabled).length > 0
      ? agentProfiles.filter((a) => a.enabled)
      : agentProfiles;

  const targetAgent =
    visibleAgents.find((a) => a.id === targetAgentId) ||
    agentProfiles.find((a) => a.id === targetAgentId) ||
    visibleAgents[0];

  const resolvedWorkspace =
    folderPath ||
    supervisionConfig?.path ||
    (dispatchDraft.sourceFilePath
      ? dispatchDraft.sourceFilePath.replace(/[\\/][^\\/]+$/, '')
      : '');

  const getIntentIcon = (iconName: string) => {
    switch (iconName) {
      case 'Rocket':
        return <Rocket size={15} />;
      case 'ShieldCheck':
        return <ShieldCheck size={15} />;
      case 'Wrench':
        return <Wrench size={15} />;
      case 'Sparkles':
        return <Sparkles size={15} />;
      case 'CheckCircle2':
        return <CheckCircle2 size={15} />;
      case 'Lightbulb':
        return <Lightbulb size={15} />;
      default:
        return <MessageSquarePlus size={15} />;
    }
  };

  const toggleChecklistItem = (index: number) => {
    setSelectedTasks((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleDispatch = async () => {
    setSubmitting(true);
    try {
      const chosenChecklist = filterSelectedOnly
        ? checklistItems
            .filter((item) => selectedTasks[item.index])
            .map((item) => item.text)
        : undefined;

      if (executionMode === 'web') {
        const presetMeta = AGENT_INTENT_PRESETS.find((p) => p.id === intent);
        const promptHeader =
          customPrompt.trim() || presetMeta?.promptTemplate || 'Process this Markdown document.';
        const clipboardPayload = `# FlyMD Task (${intent.toUpperCase()})\n\n${promptHeader}\n\n---\n\n## Source File: ${dispatchDraft.sourceFileName}\n\n${dispatchDraft.markdownContent}`;
        try {
          await navigator.clipboard.writeText(clipboardPayload);
        } catch {}
      }

      await window.electronAPI.dispatchAgentTask({
        targetAgentId,
        sourceAgentId: dispatchDraft.sourceAgentId,
        filePath: dispatchDraft.sourceFilePath,
        fileName: dispatchDraft.sourceFileName,
        markdownContent: dispatchDraft.markdownContent,
        selectedExcerpt: dispatchDraft.selectedExcerpt,
        selectedChecklistItems: chosenChecklist,
        intent,
        customPrompt: customPrompt.trim() || undefined,
        workspacePath: resolvedWorkspace,
        createSafetyCheckpoint,
        safeParallelMode,
        attachSharedMemory,
        executionMode,
        pipelineId: dispatchDraft.pipelineId,
        nextAgentInChain: nextAgentInChain ? nextAgentInChain : undefined,
        nextIntentInChain: nextAgentInChain ? nextIntentInChain : undefined,
      });

      const [updatedTasks, updatedCheckpoints] = await Promise.all([
        window.electronAPI.getAgentTasks(),
        window.electronAPI.getAgentCheckpoints(),
      ]);
      setAgentTasks(updatedTasks);
      setAgentCheckpoints(updatedCheckpoints);
      closeDispatchModal();
      setViewMode('agents');
    } catch (err) {
      console.error('Failed to dispatch agent task:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/95">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center border"
              style={{
                backgroundColor: `${targetAgent?.accentColor || '#38bdf8'}18`,
                borderColor: `${targetAgent?.accentColor || '#38bdf8'}50`,
                color: targetAgent?.accentColor || '#38bdf8',
              }}
            >
              <Send size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Confirm & Assign Markdown to Agent
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Human-in-the-Loop Gate
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                <FileText size={12} className="text-sky-400" />
                <span className="font-semibold text-slate-200">{dispatchDraft.sourceFileName}</span>
                {dispatchDraft.sourceAgentId && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    Created by {dispatchDraft.sourceAgentId}
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={closeDispatchModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Step 1: Choose Target Agent */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                1. Choose Which Agent Receives This File
              </label>
              <button
                type="button"
                onClick={() => setShowAgentAccountsModal(true)}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
              >
                <Plus size={12} /> Add Custom Agent / Manage Logins
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {visibleAgents.map((agent) => {
                const isSelected = agent.id === targetAgentId;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => setTargetAgentId(agent.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-slate-800/90 border-sky-400 shadow-sm ring-1 ring-sky-400/40'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: agent.accentColor }}
                        />
                        <span className="text-xs font-bold text-white truncate">
                          {agent.name}
                        </span>
                        {agent.isCustom && (
                          <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-300">
                            Custom
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                        {agent.webUrl || agent.vendor}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Execution Mode Selector: In-App Agent Chat Studio vs External Browser */}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExecutionMode('in-app')}
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                  executionMode === 'in-app'
                    ? 'bg-sky-500/15 border-sky-500/50 text-white ring-1 ring-sky-500/30'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Terminal size={16} className="text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    In-App Chat &amp; Live Progress Studio
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-bold uppercase">
                      Recommended
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-300 mt-0.5">
                    Runs directly inside FlyMD with live step progress, thinking trace, native IDE sync, and rendered Markdown chat!
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setExecutionMode('web')}
                className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                  executionMode === 'web'
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-white ring-1 ring-emerald-500/30'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Globe size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-white">
                    Also Open External Web Browser
                  </div>
                  <div className="text-[10px] text-slate-300 mt-0.5">
                    Copies your Markdown prompt to clipboard and opens {targetAgent?.shortName} in your default browser.
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Step 2: Plain-English Mission / Intent */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              2. What Should {targetAgent?.name} Do? (Plain-English Goal)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AGENT_INTENT_PRESETS.map((preset) => {
                const active = intent === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setIntent(preset.id)}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      active
                        ? 'bg-sky-500/15 border-sky-500/50 text-white'
                        : 'bg-slate-950/60 border-slate-800/90 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`mt-0.5 p-1.5 rounded-lg ${
                        active ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {getIntentIcon(preset.iconName)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white">{preset.title}</div>
                      <div className="text-[11px] text-sky-300/90 font-medium">
                        “{preset.nonDevLabel}”
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">
                        {preset.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-2.5">
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={2}
                placeholder="Optional extra instructions in plain words (e.g., 'Focus on mobile layout first' or 'Keep existing styles')..."
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Step 3: Checklist Step Selector (if file has tasks) */}
          {checklistItems.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-200">
                  Checklist Tasks Detected ({checklistItems.length} steps in document)
                </span>
                <label className="flex items-center gap-1.5 text-[11px] text-sky-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterSelectedOnly}
                    onChange={(e) => setFilterSelectedOnly(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-sky-500"
                  />
                  Only send checked steps below
                </label>
              </div>
              {filterSelectedOnly && (
                <div className="max-h-32 overflow-y-auto space-y-1 pr-1 mt-2 border-t border-slate-800/80 pt-2">
                  {checklistItems.map((item) => {
                    const isPicked = !!selectedTasks[item.index];
                    return (
                      <button
                        key={item.index}
                        type="button"
                        onClick={() => toggleChecklistItem(item.index)}
                        className="w-full flex items-center gap-2 text-left px-2 py-1 rounded hover:bg-slate-900 text-xs"
                      >
                        {isPicked ? (
                          <CheckSquare size={13} className="text-sky-400 shrink-0" />
                        ) : (
                          <Square size={13} className="text-slate-600 shrink-0" />
                        )}
                        <span
                          className={
                            isPicked ? 'text-slate-200' : 'text-slate-500 line-through'
                          }
                        >
                          {item.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Safety & Multi-Agent Protection Switches */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setCreateSafetyCheckpoint(!createSafetyCheckpoint)}
              className={`p-3 rounded-xl border text-left transition-all ${
                createSafetyCheckpoint
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <ShieldCheck size={15} className="text-emerald-400" />
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  {createSafetyCheckpoint ? 'ON' : 'OFF'}
                </span>
              </div>
              <div className="text-xs font-bold text-white">Safety Time-Machine</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Auto-saves a restore point so you can 1-click Undo if the agent makes a mistake.
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSafeParallelMode(!safeParallelMode)}
              className={`p-3 rounded-xl border text-left transition-all ${
                safeParallelMode
                  ? 'bg-violet-500/10 border-violet-500/40 text-violet-200'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <GitBranch size={15} className="text-violet-400" />
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">
                  {safeParallelMode ? 'ISOLATED' : 'DIRECT'}
                </span>
              </div>
              <div className="text-xs font-bold text-white">Safe Parallel Sandbox</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Runs in an isolated worktree so multiple agents can work at the same time safely.
              </div>
            </button>

            <button
              type="button"
              onClick={() => setAttachSharedMemory(!attachSharedMemory)}
              className={`p-3 rounded-xl border text-left transition-all ${
                attachSharedMemory
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <BrainCircuit size={15} className="text-amber-400" />
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  {attachSharedMemory ? 'SHARED' : 'OFF'}
                </span>
              </div>
              <div className="text-xs font-bold text-white">Shared Project Memory</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Shares `.flymd/MEMORY.md` so this agent knows what other agents already did.
              </div>
            </button>
          </div>

          {/* Step 5: Optional Relay Chain */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <ArrowRight size={14} className="text-sky-400" />
              <span className="font-semibold">Auto-Relay When Done (Optional):</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={nextAgentInChain}
                onChange={(e) => setNextAgentInChain(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200"
              >
                <option value="">None (Stop after {targetAgent?.shortName})</option>
                {visibleAgents
                  .filter((a) => a.id !== targetAgentId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      Then hand off to {a.name}
                    </option>
                  ))}
              </select>
              {nextAgentInChain && (
                <select
                  value={nextIntentInChain}
                  onChange={(e) => setNextIntentInChain(e.target.value as AgentTaskIntent)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200"
                >
                  {AGENT_INTENT_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      for {p.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-900/95">
          <div className="text-[11px] text-slate-400 truncate max-w-md">
            Workspace: <span className="text-slate-300 font-mono">{resolvedWorkspace || 'Current file folder'}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={closeDispatchModal}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleDispatch}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-xs font-bold text-slate-950 shadow-lg shadow-sky-500/20 transition-all"
            >
              <Send size={14} />
              {submitting ? 'Dispatching...' : `Confirm & Send to ${targetAgent?.shortName}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
