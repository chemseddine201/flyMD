import React, { useState, useMemo } from 'react';
import {
  Settings,
  Plus,
  Edit3,
  Trash2,
  CopyPlus,
  RotateCcw,
  Bot,
  Sliders,
  Sparkles,
  Download,
  Upload,
  X,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
} from 'lucide-react';
import {
  CustomRoleDefinition,
  DiscussionParticipant,
  AvailableProviderInfo,
} from '../../../../../../shared/types';
import { DeliberationPreset } from '../../../../services/deliberationPresetRepository';
import { getDefaultModelForAgent } from '../../../../../../shared/constants/models';
import { DISCUSSION_AVATAR_PALETTE } from '../../../../utils/discussionTextUtils';
import { UnsavedChangesModal } from '../../../common/UnsavedChangesModal';

export interface CustomActionsAndRolesModalProps {
  isOpen: boolean;
  onClose: () => void;
  presets: DeliberationPreset[];
  allRoles: CustomRoleDefinition[];
  dynamicProviders: AvailableProviderInfo[];
  selectedEngines: string[];
  editingPreset: DeliberationPreset | null;
  isCreatingNewPreset: boolean;
  setEditingPreset: (preset: DeliberationPreset | null) => void;
  onSaveEditingPreset: () => void;
  onStartCreatePreset: () => void;
  onStartEditPreset: (preset: DeliberationPreset, e?: React.MouseEvent) => void;
  onDuplicatePreset: (preset: DeliberationPreset, e?: React.MouseEvent) => void;
  onDeletePreset: (presetId: string, e?: React.MouseEvent) => void;
  onTogglePresetEnabled: (presetId: string, e?: React.MouseEvent) => void;
  onResetPresetsToDefaults: () => void;
  onCreateCustomRole: (roleInput: Omit<CustomRoleDefinition, 'id' | 'isBuiltIn'>) => void;
  onDeleteCustomRole: (roleId: string) => void;
  getSubscriptionTierForAgent: (agentId: string) => string | undefined;
}

export const CustomActionsAndRolesModal: React.FC<CustomActionsAndRolesModalProps> = ({
  isOpen,
  onClose,
  presets,
  allRoles,
  dynamicProviders,
  selectedEngines,
  editingPreset,
  isCreatingNewPreset,
  setEditingPreset,
  onSaveEditingPreset,
  onStartCreatePreset,
  onStartEditPreset,
  onDuplicatePreset,
  onDeletePreset,
  onTogglePresetEnabled,
  onResetPresetsToDefaults,
  onCreateCustomRole,
  onDeleteCustomRole,
  getSubscriptionTierForAgent,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'presets' | 'roles'>('presets');
  const [showNewRoleForm, setShowNewRoleForm] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleKey, setNewRoleKey] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRoleDirective, setNewRoleDirective] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#38bdf8');
  const [showDiscardAlert, setShowDiscardAlert] = useState(false);
  const [pendingDeletePresetId, setPendingDeletePresetId] = useState<string | null>(null);
  const [pendingDeleteRoleId, setPendingDeleteRoleId] = useState<string | null>(null);

  const hasUnsavedChanges = useMemo(() => {
    if (showNewRoleForm && Boolean(newRoleName.trim() || newRoleKey.trim() || newRoleDesc.trim() || newRoleDirective.trim())) {
      return true;
    }
    if (editingPreset !== null) {
      return true;
    }
    return false;
  }, [showNewRoleForm, newRoleName, newRoleKey, newRoleDesc, newRoleDirective, editingPreset]);

  const handleRequestClose = () => {
    if (hasUnsavedChanges) {
      setShowDiscardAlert(true);
    } else {
      onClose();
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardAlert(false);
    setShowNewRoleForm(false);
    setNewRoleName('');
    setNewRoleKey('');
    setNewRoleDesc('');
    setNewRoleDirective('');
    setEditingPreset(null);
    onClose();
  };

  if (!isOpen) return null;

  const handleSaveNewRole = () => {
    if (!newRoleName.trim()) return;
    onCreateCustomRole({
      name: newRoleName.trim(),
      roleKey: newRoleKey.trim() || newRoleName.trim().toLowerCase().replace(/[^a-z0-9]/g, '-'),
      experienceProfile: newRoleDesc.trim() || 'Custom technical inquiry and domain analysis.',
      defaultDirective: newRoleDirective.trim() || 'Analyze the topic for critical risks, bottlenecks, and feasibility.',
      assignedSkillUris: [],
      avatarColor: newRoleColor,
    });
    setNewRoleName('');
    setNewRoleKey('');
    setNewRoleDesc('');
    setNewRoleDirective('');
    setShowNewRoleForm(false);
  };

  const handleExportJSON = () => {
    const data = {
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      presets,
      userRoles: allRoles.filter((r) => !r.isBuiltIn),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flymd-deliberation-roles-and-presets-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 md:p-6 animate-fadeIn">
      <div className="w-full max-w-4xl md:max-w-5xl lg:max-w-6xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden transition-all duration-200">
        {/* Modal Header */}
        <div className="p-4 md:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <Settings size={18} className="text-amber-500 dark:text-amber-400" />
            <div>
              <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100">
                Deliberation Roles Library &amp; Action Presets
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Manage specialized team roles, invariant queries, and customizable deliberation templates.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportJSON}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors"
              title="Export presets and custom roles to JSON"
            >
              <Download size={12} />
              <span className="hidden sm:inline">Export JSON</span>
            </button>
            <button
              type="button"
              onClick={handleRequestClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Sub-tabs header */}
        <div className="flex items-center justify-between px-4 md:px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveSubTab('presets');
                setEditingPreset(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'presets'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Action Presets ({presets.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveSubTab('roles');
                setEditingPreset(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'roles'
                  ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Specialist Roles Library ({allRoles.length})
            </button>
          </div>

          {activeSubTab === 'presets' && !editingPreset && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onResetPresetsToDefaults}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                title="Restore default presets"
              >
                <RotateCcw size={11} />
                <span className="hidden sm:inline">Defaults</span>
              </button>
              <button
                type="button"
                onClick={onStartCreatePreset}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
              >
                <Plus size={13} />
                <span>+ New Preset</span>
              </button>
            </div>
          )}

          {activeSubTab === 'roles' && (
            <button
              type="button"
              onClick={() => setShowNewRoleForm((prev) => !prev)}
              className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
            >
              <Plus size={13} />
              <span>+ Define New Role</span>
            </button>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 md:p-5 overflow-y-auto space-y-4 flex-1 bg-slate-50/50 dark:bg-slate-950/40">
          {activeSubTab === 'presets' ? (
            editingPreset ? (
              /* Preset Editor */
              <div className="p-4 md:p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Edit3 size={15} className="text-amber-500 dark:text-amber-400" />
                    <h4 className="text-xs md:text-sm font-bold text-slate-900 dark:text-slate-100">
                      {isCreatingNewPreset ? 'Create New Action Preset' : `Edit Preset: ${editingPreset.name}`}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingPreset(null)}
                      className="px-3 py-1 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 text-xs font-semibold"
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
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-[11px]">
                      Preset Name
                    </label>
                    <input
                      type="text"
                      value={editingPreset.name}
                      onChange={(e) => setEditingPreset({ ...editingPreset, name: e.target.value })}
                      placeholder="e.g. Core Architecture Synthesis, Adversarial Red-Team..."
                      className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-[11px]">
                      Description
                    </label>
                    <input
                      type="text"
                      value={editingPreset.description}
                      onChange={(e) => setEditingPreset({ ...editingPreset, description: e.target.value })}
                      placeholder="Brief overview of this deliberation team focus"
                      className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                {/* Participating Agent Roles in this Preset */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                      <Bot size={13} className="text-sky-500 dark:text-sky-400" />
                      Assigned Agent Roles ({editingPreset.participants.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextIdx = editingPreset.participants.length + 1;
                        const color = DISCUSSION_AVATAR_PALETTE[(nextIdx - 1) % DISCUSSION_AVATAR_PALETTE.length];
                        const leadEngine = selectedEngines[0] || dynamicProviders[0]?.id || 'mock';
                        const leadModel =
                          dynamicProviders.find((ep) => ep.id === leadEngine)?.model ||
                          getDefaultModelForAgent(leadEngine, getSubscriptionTierForAgent(leadEngine));
                        const newAgent: DiscussionParticipant = {
                          agentId: `agent-custom-${Date.now()}`,
                          providerId: leadEngine,
                          modelId: leadModel,
                          displayName: `Specialist ${nextIdx}`,
                          role: 'custom',
                          roleDescription: 'Specialized analysis and domain verification.',
                          avatarColor: color,
                          assignedSkillUris: [],
                          contextBudgetTokens: 16000,
                          thinkingEnabled: true,
                          customAction: {
                            id: `action-${Date.now()}`,
                            name: 'Domain Inquiry',
                            description: 'Custom domain inquiry',
                            promptDirective: 'Evaluate critical bottlenecks, edge-cases, and verification criteria.',
                          },
                        };
                        setEditingPreset({
                          ...editingPreset,
                          participants: [...editingPreset.participants, newAgent],
                        });
                      }}
                      className="text-xs text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Plus size={12} /> Add Agent Role
                    </button>
                  </div>

                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {editingPreset.participants.map((p: DiscussionParticipant, pIdx: number) => (
                      <div
                        key={p.agentId || pIdx}
                        className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
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
                              className="w-44 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-900 dark:text-slate-100 font-bold focus:outline-none focus:border-sky-500"
                            />
                            <select
                              value={p.role}
                              onChange={(e) => {
                                const picked = allRoles.find((r) => r.roleKey === e.target.value || r.id === e.target.value);
                                const copy = [...editingPreset.participants];
                                copy[pIdx] = {
                                  ...copy[pIdx],
                                  role: picked?.roleKey || e.target.value,
                                  roleDescription: copy[pIdx].roleDescription || picked?.experienceProfile,
                                  avatarColor: picked?.avatarColor || copy[pIdx].avatarColor,
                                };
                                setEditingPreset({ ...editingPreset, participants: copy });
                              }}
                              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:border-sky-500 cursor-pointer"
                            >
                              {allRoles.map((r) => (
                                <option key={r.id} value={r.roleKey}>
                                  {r.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          {editingPreset.participants.length > 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                const copy = editingPreset.participants.filter((_: DiscussionParticipant, idx: number) => idx !== pIdx);
                                setEditingPreset({ ...editingPreset, participants: copy });
                              }}
                              className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
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
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-sky-500 text-[11px]"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-amber-600 dark:text-amber-400 font-semibold mb-1">
                            Prompt Directive / Invariant Query:
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
                            placeholder="e.g. Scrutinize core invariants, identify failure modes, and verify consensus."
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded p-2 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:border-amber-500/70 leading-relaxed font-mono"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Presets Grid */
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {presets.map((preset) => (
                    <div
                      key={preset.id}
                      className={`p-4 rounded-xl border transition-all ${
                        preset.enabled
                          ? 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 shadow-sm'
                          : 'bg-slate-100/60 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800/60 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => onTogglePresetEnabled(preset.id, e)}
                            className={`p-0.5 rounded transition-colors ${
                              preset.enabled
                                ? 'text-emerald-500 dark:text-emerald-400 hover:text-emerald-600'
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                            title={preset.enabled ? 'Click to disable' : 'Click to enable'}
                          >
                            {preset.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                          </button>
                          <div>
                            <span className="font-bold text-xs text-slate-900 dark:text-slate-100 block">
                              {preset.name}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              {preset.participants.length} dedicated agent rounds
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => onStartEditPreset(preset, e)}
                            className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                          >
                            <Edit3 size={11} className="text-amber-500 dark:text-amber-400" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => onDuplicatePreset(preset, e)}
                            className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            title="Duplicate"
                          >
                            <CopyPlus size={12} />
                          </button>
                          {presets.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingDeletePresetId(preset.id);
                              }}
                              className="p-1 rounded hover:bg-rose-500/15 text-slate-400 hover:text-rose-500"
                              title="Delete preset template"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                        {preset.description}
                      </p>

                      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-800/80">
                        {preset.participants.map((part: DiscussionParticipant, idx: number) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: part.avatarColor || '#38bdf8' }}
                            />
                            {part.displayName}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            /* Roles Library Tab */
            <div className="space-y-4">
              {showNewRoleForm && (
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-sky-500/40 space-y-3 shadow-md animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-sky-600 dark:text-sky-300 flex items-center gap-1.5">
                      <Sparkles size={13} />
                      Define New Specialist Role
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowNewRoleForm(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Role Title
                      </label>
                      <input
                        type="text"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        placeholder="e.g. Security Penetration Auditor"
                        className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Role Key Slug
                      </label>
                      <input
                        type="text"
                        value={newRoleKey}
                        onChange={(e) => setNewRoleKey(e.target.value)}
                        placeholder="e.g. security-auditor"
                        className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Accent Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={newRoleColor}
                          onChange={(e) => setNewRoleColor(e.target.value)}
                          className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
                        />
                        <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{newRoleColor}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Experience Profile &amp; Focus Area
                    </label>
                    <input
                      type="text"
                      value={newRoleDesc}
                      onChange={(e) => setNewRoleDesc(e.target.value)}
                      placeholder="e.g. Performs zero-trust threat modeling, probes attack vectors, and verifies crypto implementations."
                      className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Default Round Prompt Directive
                    </label>
                    <textarea
                      rows={2}
                      value={newRoleDirective}
                      onChange={(e) => setNewRoleDirective(e.target.value)}
                      placeholder="e.g. Audit the proposed design for vulnerabilities, privilege escalations, and unvalidated inputs."
                      className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleSaveNewRole}
                      className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition shadow-sm"
                    >
                      Save Role to Library
                    </button>
                  </div>
                </div>
              )}

              {/* Roles Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {allRoles.map((role) => (
                  <div
                    key={role.id}
                    className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: role.avatarColor || '#38bdf8' }}
                          />
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                            {role.name}
                          </span>
                        </div>
                        {role.isBuiltIn ? (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                            Built-in
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPendingDeleteRoleId(role.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                            title="Delete custom role"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
                        {role.experienceProfile}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-slate-500 font-mono truncate">
                      <code>role: {role.roleKey}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 md:p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/80">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <ShieldCheck size={12} className="text-emerald-500" />
            Roles &amp; Presets are automatically saved to local storage for subsequent deliberations.
          </span>
          <button
            type="button"
            onClick={handleRequestClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-950 text-xs font-bold transition shadow-sm"
          >
            Done
          </button>
        </div>
      </div>

      <UnsavedChangesModal
        isOpen={showDiscardAlert}
        title="Unsaved Role or Preset Changes"
        message="You have modified deliberation role or preset draft data. If you close now, your unsaved draft will be lost."
        confirmLabel="Discard & Close"
        cancelLabel="Keep Editing"
        onConfirmDiscard={handleConfirmDiscard}
        onCancelKeepEditing={() => setShowDiscardAlert(false)}
      />

      {pendingDeletePresetId && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-900/60 rounded-xl shadow-2xl p-5 text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-2">
              <Trash2 size={18} />
              <h4 className="text-sm font-bold">Delete Preset Template?</h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
              Are you sure you want to delete this preset template? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeletePresetId(null)}
                className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeletePreset(pendingDeletePresetId);
                  setPendingDeletePresetId(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteRoleId && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-900/60 rounded-xl shadow-2xl p-5 text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-2">
              <Trash2 size={18} />
              <h4 className="text-sm font-bold">Delete Custom Role?</h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
              Are you sure you want to permanently delete this custom deliberation role?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteRoleId(null)}
                className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteCustomRole(pendingDeleteRoleId);
                  setPendingDeleteRoleId(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
