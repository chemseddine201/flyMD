import React from 'react';
import {
  Sparkles,
  Sliders,
  Settings,
  Cpu,
  Brain,
  Check,
  Edit3,
  Bot,
  Trash2,
  Plus,
  RotateCcw,
  ToggleLeft,
  ToggleRight,
  CopyPlus,
  Folder,
  FolderOpen,
  Shield,
  Layers,
  Info,
} from 'lucide-react';
import {
  DiscussionParticipant,
  AgentEffortLevel,
  SkillDescriptor,
} from '../../../../../../shared/types';
import { ModelEffortSideBySidePicker } from '../../common/ModelEffortSideBySidePicker';
import {
  DeliberationPreset,
  ACTION_CATALOG,
} from '../../../../services/deliberationPresetRepository';

export interface AvailableProviderOption {
  id: string;
  name: string;
  model: string;
  available: boolean;
}

export interface NewDeliberationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunch: () => void;

  newTopic: string;
  setNewTopic: (v: string) => void;
  newIdea: string;
  setNewIdea: (v: string) => void;

  maxRoundsInput: string;
  setMaxRoundsInput: (v: string) => void;
  setMaxRounds: (v: number) => void;

  turnTimeoutInput: string;
  setTurnTimeoutInput: (v: string) => void;
  setTurnTimeoutSecs: (v: number) => void;

  newDebateMode: 'preset' | 'actions' | 'custom';
  setNewDebateMode: (v: 'preset' | 'actions' | 'custom') => void;
  enableStepModeInNew: boolean;
  setEnableStepModeInNew: (v: boolean) => void;

  presets: DeliberationPreset[];
  selectedPreset: string;
  onSelectPreset: (id: string) => void;
  onTogglePresetEnabled: (id: string, e?: React.MouseEvent) => void;
  onDeletePreset: (id: string, e?: React.MouseEvent) => void;
  onDuplicatePreset: (preset: DeliberationPreset, e?: React.MouseEvent) => void;
  onResetPresetsToDefaults: () => void;

  editingPreset: DeliberationPreset | null;
  setEditingPreset: React.Dispatch<React.SetStateAction<DeliberationPreset | null>>;
  isCreatingNewPreset: boolean;
  onStartCreatePreset: () => void;
  onStartEditPreset: (preset: DeliberationPreset, e?: React.MouseEvent) => void;
  onSaveEditingPreset: () => void;

  customParticipants: DiscussionParticipant[];
  onUpdateParticipant: (idx: number, updates: Partial<DiscussionParticipant>) => void;
  onAddParticipant: () => void;
  onRemoveParticipant: (idx: number) => void;

  availableProviders: AvailableProviderOption[];
  presetEngine: string;
  setPresetEngine: (v: string) => void;
  presetEffortLevel: AgentEffortLevel;
  setPresetEffortLevel: (v: AgentEffortLevel) => void;
  presetThinkingEnabled: boolean;
  setPresetThinkingEnabled: React.Dispatch<React.SetStateAction<boolean>>;

  customSkillsDir?: string;
  setCustomSkillsDir?: (v: string) => void;
  includeDefaultSkills?: boolean;
  setIncludeDefaultSkills?: (v: boolean) => void;
  detectedSkills?: SkillDescriptor[];
  isScanningSkills?: boolean;
  onBrowseSkillsDir?: () => void;
  onSkillsDirChange?: (v: string) => void;
}

const COLOR_PALETTE = ['#38bdf8', '#818cf8', '#ef4444', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#a855f7'];

export const NewDeliberationModal: React.FC<NewDeliberationModalProps> = ({
  isOpen,
  onClose,
  onLaunch,
  newTopic,
  setNewTopic,
  newIdea,
  setNewIdea,
  maxRoundsInput,
  setMaxRoundsInput,
  setMaxRounds,
  turnTimeoutInput,
  setTurnTimeoutInput,
  setTurnTimeoutSecs,
  newDebateMode,
  setNewDebateMode,
  enableStepModeInNew,
  setEnableStepModeInNew,
  presets,
  selectedPreset,
  onSelectPreset,
  onTogglePresetEnabled,
  onDeletePreset,
  onDuplicatePreset,
  onResetPresetsToDefaults,
  editingPreset,
  setEditingPreset,
  isCreatingNewPreset,
  onStartCreatePreset,
  onStartEditPreset,
  onSaveEditingPreset,
  customParticipants,
  onUpdateParticipant,
  onAddParticipant,
  onRemoveParticipant,
  availableProviders,
  presetEngine,
  setPresetEngine,
  presetEffortLevel,
  setPresetEffortLevel,
  presetThinkingEnabled,
  setPresetThinkingEnabled,
  customSkillsDir = '',
  setCustomSkillsDir,
  includeDefaultSkills = true,
  setIncludeDefaultSkills,
  detectedSkills = [],
  isScanningSkills = false,
  onBrowseSkillsDir,
  onSkillsDirChange,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="w-full max-w-4xl lg:max-w-5xl bg-slate-900 border border-slate-800/90 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden transition-all duration-200">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-sky-400" />
            <h3 className="text-sm font-bold text-slate-100">
              Configure Multi-Agent Deliberation
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-base"
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Discussion Topic</label>
            <input
              type="text"
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              placeholder="e.g. Market Expansion Strategy, Scientific Methodology Review, Product Architecture, Novel Plot Outline..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Proposal, Objectives &amp; Constraints</label>
            <textarea
              rows={3}
              value={newIdea}
              onChange={(e) => setNewIdea(e.target.value)}
              placeholder="Describe the core proposition, context, challenges, constraints, or specific angles to evaluate..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-sky-500 leading-relaxed transition-colors"
            />
          </div>

          {/* Mode Selection Tab: Preset vs Custom Actions vs Custom Team */}
          <div className="border border-slate-800 rounded-xl p-3.5 bg-slate-950/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
              <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Sliders size={13} className="text-sky-400" />
                <span>Agent Team &amp; Action Presets</span>
              </div>
              <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setNewDebateMode('preset')}
                  className={`px-3 py-1 rounded text-[11px] font-semibold transition-all ${
                    newDebateMode === 'preset'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Presets ({presets.filter((p) => p.enabled).length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewDebateMode('actions');
                    setEditingPreset(null);
                  }}
                  className={`px-3 py-1 rounded text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
                    newDebateMode === 'actions'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Settings size={11} />
                  <span>Custom Actions &amp; Roles</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewDebateMode('custom')}
                  className={`px-3 py-1 rounded text-[11px] font-semibold transition-all ${
                    newDebateMode === 'custom'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Custom Team ({customParticipants.length})
                </button>
              </div>
            </div>

            {/* Connected Engines Indicator */}
            {availableProviders.some((ap) => ap.available) && (
              <div className="mb-3 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={12} className="text-emerald-400" />
                  <span>
                    <strong>Detected AI Engines:</strong>{' '}
                    {availableProviders
                      .filter((ap) => ap.available)
                      .map((ap) => `${ap.name} (${ap.model})`)
                      .join(', ')}
                  </span>
                </div>
              </div>
            )}

            {newDebateMode === 'preset' ? (
              <div className="space-y-3">
                {/* Preset Engine Switcher */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0">
                      <Cpu size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-100 flex items-center gap-2 truncate">
                        <span>Preset AI Engine</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20 font-medium hidden sm:inline">
                          Shared across all agents
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                        Frontier agent or fast built-in reasoning engine
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                    <select
                      value={presetEngine}
                      onChange={(e) => setPresetEngine(e.target.value)}
                      className="w-full sm:w-auto min-w-0 sm:max-w-[320px] shrink-0 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-sky-500 font-medium truncate shadow-inner cursor-pointer"
                    >
                      <option value="mock">⚡ Built-in Adaptive Domain Simulator (Fast)</option>
                      {availableProviders
                        .filter((ap) => ap.id !== 'mock')
                        .map((p) => (
                          <option key={p.id} value={p.id} disabled={!p.available}>
                            {p.name} {p.available ? `(${p.model})` : '(Not Detected)'}
                          </option>
                        ))}
                    </select>

                    {/* Preset Shared Effort Dropdown */}
                    <select
                      value={presetEffortLevel}
                      onChange={(e) =>
                        setPresetEffortLevel(e.target.value as AgentEffortLevel)
                      }
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-sky-300 text-xs font-bold focus:outline-none focus:border-sky-500 cursor-pointer shadow-inner"
                      title="Shared reasoning effort level across all preset participants"
                    >
                      <option value="low">Low Effort</option>
                      <option value="medium">Med Effort (Default)</option>
                      <option value="high">High Effort</option>
                      <option value="xhigh">X-High Effort</option>
                      <option value="max">Max Effort</option>
                    </select>

                    {/* Preset Thinking Mode Toggle */}
                    <button
                      type="button"
                      onClick={() => setPresetThinkingEnabled((prev) => !prev)}
                      className={`px-2.5 py-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-inner ${
                        presetThinkingEnabled
                          ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 line-through'
                      }`}
                      title={
                        presetThinkingEnabled
                          ? 'Thinking Mode: ON (Click to disable and save tokens)'
                          : 'Thinking Mode: OFF (Click to enable)'
                      }
                    >
                      <Brain
                        size={12}
                        className={
                          presetThinkingEnabled
                            ? 'text-indigo-400'
                            : 'text-slate-500'
                        }
                      />
                      <span>{presetThinkingEnabled ? 'Thinking ON' : 'Thinking OFF'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {presets
                    .filter((p) => p.enabled)
                    .map((preset) => {
                      const isSelected = selectedPreset === preset.id;
                      return (
                        <div
                          key={preset.id}
                          onClick={() => onSelectPreset(preset.id)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-sky-500/15 border-sky-500/50 text-slate-100 shadow-sm'
                              : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900 text-slate-300'
                          }`}
                        >
                          <div className="font-bold text-xs flex items-center justify-between">
                            <span className="truncate">{preset.name}</span>
                            {isSelected && <Check size={13} className="text-sky-400 shrink-0" />}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                            {preset.description}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-2 flex items-center justify-between">
                            <span>{preset.participants.length} participating agents</span>
                            <span className="text-indigo-400 flex items-center gap-1">
                              <Brain size={10} />
                              <span>Thinking On</span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setNewDebateMode('actions');
                      setEditingPreset(null);
                    }}
                    className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium"
                  >
                    <Settings size={12} />
                    <span>Manage, customize roles &amp; queries, or add new action presets &rarr;</span>
                  </button>
                </div>
              </div>
            ) : newDebateMode === 'actions' ? (
              <div className="space-y-3">
                {editingPreset ? (
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <Edit3 size={15} className="text-amber-400" />
                        <h4 className="text-xs font-bold text-slate-100">
                          {isCreatingNewPreset ? 'Create New Action Preset' : `Edit Preset: ${editingPreset.name}`}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingPreset(null)}
                          className="px-3 py-1 rounded text-slate-400 hover:text-slate-200 text-xs font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={onSaveEditingPreset}
                          className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-sm"
                        >
                          Save Preset
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1 text-[11px]">Preset Name</label>
                        <input
                          type="text"
                          value={editingPreset.name}
                          onChange={(e) => setEditingPreset({ ...editingPreset, name: e.target.value })}
                          placeholder="e.g. Market Strategy & Execution Risk, System Architecture, Policy Review..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1 text-[11px]">Description</label>
                        <input
                          type="text"
                          value={editingPreset.description}
                          onChange={(e) => setEditingPreset({ ...editingPreset, description: e.target.value })}
                          placeholder="Short description of this deliberation focus"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>

                    {/* Participating Agent Roles in this Preset */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <Bot size={13} className="text-sky-400" />
                          Agent Roles &amp; Custom Queries ({editingPreset.participants.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const nextIdx = editingPreset.participants.length + 1;
                            const color = COLOR_PALETTE[(nextIdx - 1) % COLOR_PALETTE.length];
                            const newAgent: DiscussionParticipant = {
                              agentId: `agent-custom-${Date.now()}`,
                              providerId: 'mock',
                              modelId: 'custom-expert-v1',
                              displayName: `Specialist ${nextIdx}`,
                              role: 'custom',
                              roleDescription: 'Custom inquiry focus and domain analysis.',
                              avatarColor: color,
                              assignedSkillUris: [],
                              contextBudgetTokens: 16000,
                              thinkingEnabled: true,
                              customAction: {
                                id: `action-${Date.now()}`,
                                name: 'Specialized Inquiry',
                                description: 'Custom domain inquiry',
                                promptDirective: 'Evaluate specific failure modes and validation criteria.',
                              },
                            };
                            setEditingPreset({
                              ...editingPreset,
                              participants: [...editingPreset.participants, newAgent],
                            });
                          }}
                          className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold"
                        >
                          <Plus size={12} /> Add Agent Role
                        </button>
                      </div>

                      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                        {editingPreset.participants.map((p, pIdx) => (
                          <div
                            key={p.agentId || pIdx}
                            className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-1">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: p.avatarColor || '#38bdf8' }}
                                />
                                <input
                                  type="text"
                                  value={p.displayName}
                                  onChange={(e) => {
                                    const copy = [...editingPreset.participants];
                                    copy[pIdx] = { ...copy[pIdx], displayName: e.target.value };
                                    setEditingPreset({ ...editingPreset, participants: copy });
                                  }}
                                  placeholder="Agent Display Name"
                                  className="w-44 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-100 font-bold focus:outline-none focus:border-sky-500"
                                />
                                <select
                                  value={p.role}
                                  onChange={(e) => {
                                    const copy = [...editingPreset.participants];
                                    copy[pIdx] = { ...copy[pIdx], role: e.target.value as any };
                                    setEditingPreset({ ...editingPreset, participants: copy });
                                  }}
                                  className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300 font-medium focus:outline-none focus:border-sky-500 cursor-pointer"
                                >
                                  <option value="architect">Architect</option>
                                  <option value="critic">Critic / Adversary</option>
                                  <option value="implementer">Implementer</option>
                                  <option value="auditor">Auditor</option>
                                  <option value="user">User Proxy</option>
                                  <option value="custom">Custom Specialist</option>
                                </select>
                              </div>
                              {editingPreset.participants.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const copy = editingPreset.participants.filter((_, idx) => idx !== pIdx);
                                    setEditingPreset({ ...editingPreset, participants: copy });
                                  }}
                                  className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                                  title="Remove agent role"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>

                            <div>
                              <input
                                type="text"
                                value={p.roleDescription || ''}
                                onChange={(e) => {
                                  const copy = [...editingPreset.participants];
                                  copy[pIdx] = { ...copy[pIdx], roleDescription: e.target.value };
                                  setEditingPreset({ ...editingPreset, participants: copy });
                                }}
                                placeholder="Role description (e.g. Focus on market risks, feasibility, or quality standards)"
                                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300 focus:outline-none focus:border-sky-500 text-[11px]"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] text-amber-400 font-semibold mb-1">
                                Custom Prompt Directive / Invariant Query for this Agent:
                              </label>
                              <textarea
                                rows={2}
                                value={p.customAction?.promptDirective || ''}
                                onChange={(e) => {
                                  const copy = [...editingPreset.participants];
                                  copy[pIdx] = {
                                    ...copy[pIdx],
                                    customAction: {
                                      id: copy[pIdx].customAction?.id || `action-${Date.now()}`,
                                      name: copy[pIdx].displayName,
                                      description: copy[pIdx].roleDescription || '',
                                      promptDirective: e.target.value,
                                    },
                                  };
                                  setEditingPreset({ ...editingPreset, participants: copy });
                                }}
                                placeholder="e.g. Evaluate core assumptions, analyze edge cases, and scrutinize deliverables against key objectives."
                                className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 text-xs focus:outline-none focus:border-amber-500/70 leading-relaxed font-mono"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-800">
                      <div>
                        <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                          <Settings size={14} className="text-amber-400" />
                          Deliberation Action Presets &amp; Role Library
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Enable, disable, customize, or define specialized multi-agent inquiry roles.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={onResetPresetsToDefaults}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Restore default deliberation presets"
                        >
                          <RotateCcw size={11} />
                          <span>Restore Defaults</span>
                        </button>
                        <button
                          type="button"
                          onClick={onStartCreatePreset}
                          className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1 transition-all shadow-sm"
                        >
                          <Plus size={13} />
                          <span>+ Add Custom Action Preset</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {presets.map((preset) => (
                        <div
                          key={preset.id}
                          className={`p-3 rounded-xl border transition-all ${
                            preset.enabled
                              ? 'bg-slate-900/90 border-slate-800'
                              : 'bg-slate-950/60 border-slate-800/60 opacity-60'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="min-w-0 flex items-start gap-2.5">
                              <button
                                type="button"
                                onClick={(e) => onTogglePresetEnabled(preset.id, e)}
                                className={`p-1 rounded transition-colors mt-0.5 ${
                                  preset.enabled
                                    ? 'text-emerald-400 hover:text-emerald-300'
                                    : 'text-slate-600 hover:text-slate-400'
                                }`}
                                title={preset.enabled ? 'Click to disable preset' : 'Click to enable preset'}
                              >
                                {preset.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                              </button>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-slate-100">{preset.name}</span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                    {preset.participants.length} agents
                                  </span>
                                  {preset.isBuiltIn && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                      Built-in
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 mt-0.5">{preset.description}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                              <button
                                type="button"
                                onClick={(e) => onStartEditPreset(preset, e)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                                title="Edit roles and custom queries"
                              >
                                <Edit3 size={11} className="text-amber-400" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => onDuplicatePreset(preset, e)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                                title="Duplicate preset"
                              >
                                <CopyPlus size={12} />
                              </button>
                              {presets.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => onDeletePreset(preset.id, e)}
                                  className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
                                  title="Delete preset"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Custom Team Editor with Custom Actions & Query Builders */
              <div className="space-y-3">
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {customParticipants.map((p, idx) => {
                    const selectedActionId = p.customAction?.id || 'standard';
                    return (
                      <div
                        key={p.agentId || idx}
                        className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs"
                      >
                        {/* Row 1: Identity, Role, Provider, Model */}
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={p.avatarColor || '#38bdf8'}
                            onChange={(e) => onUpdateParticipant(idx, { avatarColor: e.target.value })}
                            className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent shrink-0"
                            title="Avatar color"
                          />
                          <input
                            type="text"
                            value={p.displayName}
                            onChange={(e) => onUpdateParticipant(idx, { displayName: e.target.value })}
                            placeholder="Agent Name"
                            className="w-28 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200"
                          />
                          <select
                            value={p.role}
                            onChange={(e) => onUpdateParticipant(idx, { role: e.target.value as any })}
                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs"
                          >
                            <option value="architect">Architect</option>
                            <option value="critic">Critic</option>
                            <option value="auditor">Auditor</option>
                            <option value="implementer">Implementer</option>
                            <option value="researcher">Researcher</option>
                            <option value="security-specialist">Security Specialist</option>
                          </select>
                          <select
                            value={p.providerId}
                            onChange={(e) => {
                              const provId = e.target.value;
                              const matched = availableProviders.find((ap) => ap.id === provId);
                              onUpdateParticipant(idx, {
                                providerId: provId,
                                modelId: matched?.model || p.modelId,
                              });
                            }}
                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs"
                          >
                            <option value="mock">Local Reasoner (Simulated)</option>
                            {availableProviders.map((ap) => (
                              <option key={ap.id} value={ap.id}>
                                {ap.name} {ap.available ? '✓ Ready' : '(Not configured)'}
                              </option>
                            ))}
                            {!availableProviders.some((ap) => ap.id === 'ollama') && (
                              <option value="ollama">Ollama</option>
                            )}
                            {!availableProviders.some((ap) => ap.id === 'claude-code') && (
                              <option value="claude-code">Claude Code CLI</option>
                            )}
                            {!availableProviders.some((ap) => ap.id === 'gemini-antigravity') && (
                              <option value="gemini-antigravity">Gemini CLI</option>
                            )}
                            {!availableProviders.some((ap) => ap.id === 'deepseek') && (
                              <option value="deepseek">DeepSeek</option>
                            )}
                            {!availableProviders.some((ap) => ap.id === 'http-llm') && (
                              <option value="http-llm">OpenAI / HTTP</option>
                            )}
                          </select>
                          <button
                            type="button"
                            disabled={customParticipants.length <= 2}
                            onClick={() => onRemoveParticipant(idx)}
                            className="p-1 text-slate-500 hover:text-rose-400 disabled:opacity-20 shrink-0"
                            title="Remove agent"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {/* Row 2: Side-by-Side Model & Effort Matrix */}
                        <div className="pt-1.5 border-t border-slate-800/60">
                          <ModelEffortSideBySidePicker
                            agentId={p.providerId || p.agentId}
                            selectedModel={p.modelId}
                            onChangeModel={(m) => onUpdateParticipant(idx, { modelId: m })}
                            effortLevel={p.effortLevel || 'medium'}
                            onChangeEffortLevel={(eff) => onUpdateParticipant(idx, { effortLevel: eff })}
                            thinkingEnabled={p.thinkingEnabled ?? true}
                            onToggleThinking={() =>
                              onUpdateParticipant(idx, {
                                thinkingEnabled: !(p.thinkingEnabled ?? true),
                              })
                            }
                            compact={true}
                          />
                        </div>

                        {/* Row 3: Custom Action Directive */}
                        <div className="flex items-center gap-2 pt-1.5 border-t border-slate-800/60">
                          <span className="text-[11px] font-semibold text-sky-400 shrink-0">Custom Action:</span>
                          <select
                            value={selectedActionId}
                            onChange={(e) => {
                              const actId = e.target.value;
                              const found = ACTION_CATALOG.find((ac) => ac.id === actId);
                              if (found && found.id !== 'standard') {
                                onUpdateParticipant(idx, {
                                  customAction: {
                                    id: found.id,
                                    name: found.name,
                                    description: found.description,
                                    promptDirective: found.promptDirective,
                                  },
                                });
                              } else {
                                onUpdateParticipant(idx, { customAction: undefined });
                              }
                            }}
                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-xs flex-1"
                          >
                            {ACTION_CATALOG.map((ac) => (
                              <option key={ac.id} value={ac.id}>
                                {ac.name} — {ac.description}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Row 3: Optional Freeform Query Directive for this Agent */}
                        <div className="pt-0.5">
                          <input
                            type="text"
                            value={p.customQuery || ''}
                            onChange={(e) => onUpdateParticipant(idx, { customQuery: e.target.value })}
                            placeholder="Specific inquiry or directive for this agent (e.g. 'Focus on SQLite journal crash recovery')..."
                            className="w-full bg-slate-950 border border-slate-800/80 rounded px-2.5 py-1 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-sky-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={onAddParticipant}
                  className="w-full py-1.5 rounded-lg border border-dashed border-slate-700 hover:border-sky-500 text-slate-400 hover:text-sky-400 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus size={13} />
                  <span>Add Participating Agent</span>
                </button>
              </div>
            )}
          </div>

          {/* Rounds, Timeout, and Execution Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-semibold text-xs">Deliberation Rounds</label>
                <span className="text-[10px] text-slate-500">1 - 10</span>
              </div>
              <input
                type="number"
                value={maxRoundsInput}
                onChange={(e) => {
                  setMaxRoundsInput(e.target.value);
                  const parsed = parseInt(e.target.value, 10);
                  if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
                    setMaxRounds(parsed);
                  }
                }}
                onBlur={() => {
                  const parsed = parseInt(maxRoundsInput, 10);
                  if (isNaN(parsed) || parsed < 1) {
                    setMaxRoundsInput('1');
                    setMaxRounds(1);
                  } else if (parsed > 10) {
                    setMaxRoundsInput('10');
                    setMaxRounds(10);
                  } else {
                    setMaxRoundsInput(String(parsed));
                    setMaxRounds(parsed);
                  }
                }}
                placeholder="3"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-semibold text-xs">Turn Timeout (s)</label>
                <span className="text-[10px] text-slate-500">15s - 600s</span>
              </div>
              <input
                type="number"
                value={turnTimeoutInput}
                onChange={(e) => {
                  setTurnTimeoutInput(e.target.value);
                  const parsed = parseInt(e.target.value, 10);
                  if (!isNaN(parsed) && parsed >= 15 && parsed <= 600) {
                    setTurnTimeoutSecs(parsed);
                  }
                }}
                onBlur={() => {
                  const parsed = parseInt(turnTimeoutInput, 10);
                  if (isNaN(parsed) || parsed < 15) {
                    setTurnTimeoutInput('15');
                    setTurnTimeoutSecs(15);
                  } else if (parsed > 600) {
                    setTurnTimeoutInput('600');
                    setTurnTimeoutSecs(600);
                  } else {
                    setTurnTimeoutInput(String(parsed));
                    setTurnTimeoutSecs(parsed);
                  }
                }}
                placeholder="120"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
              />
              {Number(turnTimeoutInput) < 15 && turnTimeoutInput !== '' && (
                <div className="text-[10px] text-amber-400 mt-1">
                  * Min 15s (will adjust on blur)
                </div>
              )}
              {Number(turnTimeoutInput) > 600 && (
                <div className="text-[10px] text-amber-400 mt-1">
                  * Max 600s (will adjust on blur)
                </div>
              )}
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1 text-xs">Initial Execution</label>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="stepModeCheck"
                  checked={enableStepModeInNew}
                  onChange={(e) => setEnableStepModeInNew(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-800 text-sky-500 focus:ring-0 cursor-pointer w-4 h-4"
                />
                <label htmlFor="stepModeCheck" className="text-slate-300 text-xs cursor-pointer select-none">
                  Step-by-Step Mode (Pause after each turn)
                </label>
              </div>
            </div>
          </div>

          {/* Custom Skills Injection & Tool Isolation */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold text-slate-200">Custom Skills & Domain Knowledge</span>
              </div>
              <span className="text-[10px] text-slate-400">Optional linked folder with SKILL.md competencies</span>
            </div>

            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={customSkillsDir}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (setCustomSkillsDir) setCustomSkillsDir(val);
                    if (onSkillsDirChange) onSkillsDirChange(val);
                  }}
                  placeholder="Link custom skills directory (e.g. C:\my-skills or .flymd/skills)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-2.5 text-slate-200 text-xs focus:outline-none focus:border-sky-500 placeholder-slate-600"
                />
              </div>
              {onBrowseSkillsDir && (
                <button
                  type="button"
                  onClick={onBrowseSkillsDir}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-700/60 transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                  <span>Browse</span>
                </button>
              )}
            </div>

            {/* Live Detected Skills Badges */}
            {detectedSkills && detectedSkills.length > 0 && (
              <div className="space-y-1.5 bg-slate-900/50 rounded-lg p-2 border border-slate-800/60">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {detectedSkills.length} Custom Skill{detectedSkills.length > 1 ? 's' : ''} Detected
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {detectedSkills.map((s) => (
                    <span
                      key={s.uri}
                      title={s.description || s.uri}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-sky-950/70 text-sky-300 border border-sky-800/60 font-mono"
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {isScanningSkills && (
              <div className="text-[11px] text-sky-400 flex items-center gap-1.5 italic">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                Scanning custom skills directory...
              </div>
            )}

            {/* Interactive Tool Inclusion / Isolation Choice */}
            <div className="pt-1 border-t border-slate-800/60 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="includeDefaultSkillsCheck"
                  checked={includeDefaultSkills}
                  onChange={(e) =>
                    setIncludeDefaultSkills && setIncludeDefaultSkills(e.target.checked)
                  }
                  className="rounded bg-slate-900 border-slate-800 text-sky-500 focus:ring-0 cursor-pointer w-4 h-4 mt-0.5"
                />
                <div>
                  <label
                    htmlFor="includeDefaultSkillsCheck"
                    className="text-slate-200 text-xs font-medium cursor-pointer select-none"
                  >
                    Include Default Built-in Tool Skills alongside Custom Skills
                  </label>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {includeDefaultSkills
                      ? 'Shared Mode: Default methodology guidelines are active. Custom skills override matching names.'
                      : 'Isolated Mode: Agents run strictly in domain isolation. Default built-in tool prompts are excluded.'}
                  </p>
                </div>
              </div>
              <span
                className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border select-none shrink-0 ${
                  includeDefaultSkills
                    ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/60'
                    : 'bg-amber-950/50 text-amber-400 border-amber-800/60'
                }`}
              >
                {includeDefaultSkills ? 'Shared Tools' : 'Isolated Domain'}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end gap-2 bg-slate-900/60">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onLaunch}
            className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-colors shadow-sm"
          >
            Launch Deliberation
          </button>
        </div>
      </div>
    </div>
  );
};

