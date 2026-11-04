import React, { useState, useMemo, useRef } from 'react';
import {
  Sparkles,
  Sliders,
  Settings,
  Bot,
  Trash2,
  Plus,
  Repeat,
  Layers,
  FolderOpen,
  ShieldCheck,
  X,
  ToggleLeft,
  ToggleRight,
  Info,
  Clock,
  Coins,
  CheckCircle2,
  Paperclip,
  AlertTriangle,
} from 'lucide-react';
import {
  DiscussionParticipant,
  AgentEffortLevel,
  SkillDescriptor,
  AvailableProviderInfo,
  CustomRoleDefinition,
  DebateRepeaterMode,
  DiscussionRoundPlan,
  DiscussionAttachedFile,
} from '../../../../../../shared/types';
import { DiscussionAttachmentPills } from './discussionAttachmentUtils';
import { ModelEffortSideBySidePicker } from '../../common/ModelEffortSideBySidePicker';
import {
  DeliberationPreset,
  ACTION_CATALOG,
} from '../../../../services/deliberationPresetRepository';
import { DebateRoundRepeaterBuilder } from './DebateRoundRepeaterBuilder';
import { CustomActionsAndRolesModal } from './CustomActionsAndRolesModal';
import { NewDebateModeTab } from './useNewDeliberationDraft';
import { getDefaultModelForAgent } from '../../../../../../shared/constants/models';
import { UnsavedChangesModal } from '../../../common/UnsavedChangesModal';

export interface AvailableProviderOption {
  id: string;
  name: string;
  model: string;
  available: boolean;
}

/** Live subscription, multi-engine, role-library and round-repeater wiring. */
export interface RepeaterAndSubscriptionProps {
  dynamicProviders: AvailableProviderInfo[];
  selectedEngines: string[];
  onToggleSelectedEngine: (engineId: string) => void;
  onSelectAllReadyEngines: () => void;
  isRefreshingSubscriptions: boolean;
  onRefreshSubscriptions: () => void;
  onOpenManageAccounts?: () => void;
  repeaterMode: DebateRepeaterMode;
  onChangeRepeaterMode: (mode: DebateRepeaterMode) => void;
  maxRounds: number;
  roundSchedule: DiscussionRoundPlan[];
  onChangeRoundSchedule: (schedule: DiscussionRoundPlan[]) => void;
  onAutoBuildRoundSchedule: (targetMode?: 'cycle' | 'per_round') => void;
  allRoles: CustomRoleDefinition[];
  onCreateCustomRole: (role: Omit<CustomRoleDefinition, 'id' | 'isBuiltIn'>) => void;
  onDeleteCustomRole: (roleId: string) => void;
  getSubscriptionTierForAgent: (agentOrProviderId: string) => string | undefined;
  getDynamicModelsForAgent: (agentOrProviderId: string) => string[];
}

export interface NewDeliberationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunch: () => void;

  newTopic: string;
  setNewTopic: (v: string) => void;
  newIdea: string;
  setNewIdea: (v: string) => void;
  newObjective?: string;
  setNewObjective?: (v: string) => void;
  isFormValid?: boolean;

  maxRoundsInput: string;
  setMaxRoundsInput: (v: string) => void;
  setMaxRounds: (v: number) => void;

  turnTimeoutInput: string;
  setTurnTimeoutInput: (v: string) => void;
  setTurnTimeoutSecs: (v: number) => void;

  newDebateMode: NewDebateModeTab;
  setNewDebateMode: (v: NewDebateModeTab) => void;
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

  availableProviders?: AvailableProviderOption[];
  presetEngine?: string;
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
  tokenBudgetCapInput?: string;
  setTokenBudgetCapInput?: (v: string) => void;

  showCustomRolesModal?: boolean;
  setShowCustomRolesModal?: (v: boolean) => void;

  attachedFiles?: DiscussionAttachedFile[];
  onAddAttachedFiles?: (files: FileList | File[]) => Promise<void>;
  onRemoveAttachedFile?: (fileId: string) => void;
  attachmentClampedNotice?: boolean;

  repeater: RepeaterAndSubscriptionProps;
}

export const NewDeliberationModal: React.FC<NewDeliberationModalProps> = ({
  isOpen,
  onClose,
  onLaunch,
  newTopic,
  setNewTopic,
  newIdea,
  setNewIdea,
  newObjective = '',
  setNewObjective,
  isFormValid,
  attachedFiles,
  onAddAttachedFiles,
  onRemoveAttachedFile,
  attachmentClampedNotice,
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
  tokenBudgetCapInput = '50000',
  setTokenBudgetCapInput,
  showCustomRolesModal = false,
  setShowCustomRolesModal,
  repeater,
}) => {
  const [internalShowRolesModal, setInternalShowRolesModal] = useState(false);
  const [showDiscardAlert, setShowDiscardAlert] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const effectiveFormValid =
    isFormValid !== undefined
      ? isFormValid
      : Boolean(newTopic.trim()) && Boolean(newIdea.trim());

  const hasUnsavedDraft = useMemo(() => {
    return Boolean(
      newTopic.trim() ||
        newIdea.trim() ||
        (attachedFiles && attachedFiles.length > 0)
    );
  }, [newTopic, newIdea, attachedFiles]);

  const handleRequestClose = () => {
    if (hasUnsavedDraft) {
      setShowDiscardAlert(true);
    } else {
      onClose();
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardAlert(false);
    onClose();
  };

  if (!isOpen) return null;

  const isRolesModalOpen =
    showCustomRolesModal !== undefined ? showCustomRolesModal : internalShowRolesModal;
  const setIsRolesModalOpen = (open: boolean) => {
    if (setShowCustomRolesModal) {
      setShowCustomRolesModal(open);
    } else {
      setInternalShowRolesModal(open);
    }
  };

  const engineOptions = repeater.dynamicProviders;
  const roleOptions = repeater.allRoles;
  const findRoleFor = (role: string) =>
    roleOptions.find((r) => r.roleKey === role || r.name === role);

  const selectedPresetObj = presets.find((p) => p.id === selectedPreset) || presets[0];

  const calculatedRounds =
    newDebateMode === 'repeater'
      ? repeater.roundSchedule.length || 2
      : newDebateMode === 'custom'
      ? customParticipants.length
      : selectedPresetObj?.participants.length || 3;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 md:p-[19px] animate-fadeIn">
        <div className="w-full max-w-4xl md:max-w-5xl lg:max-w-6xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden transition-all duration-200">
          {/* Modal Header with Dedicated Roles Library Button */}
          <div className="p-4 md:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/80">
            <div className="flex items-center gap-2.5">
              <Sparkles size={18} className="text-sky-500 dark:text-sky-400" />
              <div>
                <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100">
                  Configure Multi-Agent Epistemic Deliberation
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  1 dedicated round per specialist agent with early convergence quota protection.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRolesModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                title="Open dedicated Roles Library & Presets Manager"
              >
                <Settings size={13} />
                <span>Manage Roles &amp; Presets</span>
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

          {/* Modal Body */}
          <div className="p-4 sm:p-5 md:p-[19px] space-y-4 md:space-y-5 overflow-y-auto text-xs bg-slate-50/30 dark:bg-slate-950/30">
            {/* Section 1: Discussion Topic & Combined Proposal, Query & Target Objective */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">
                  Discussion Topic
                </label>
                <input
                  type="text"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="e.g. Microkernel Security Architecture, Trade-off Matrix, Database Sharding..."
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-sky-500 transition-colors shadow-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">
                  Proposal, Query &amp; Target Objective
                </label>
                <textarea
                  rows={2}
                  value={newIdea}
                  onChange={(e) => setNewIdea(e.target.value)}
                  placeholder="Describe key requirements, user query, proposed approach, target objectives, invariants, or constraints..."
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-sky-500 leading-relaxed transition-colors shadow-xs"
                />
              </div>
            </div>

            {/* Multi-File Reference Attachments (Up to 10 files, all allowed extensions) */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onAddAttachedFiles?.(e.target.files);
                  e.target.value = '';
                }
              }}
              className="hidden"
            />
            <div
              onDragOver={(e) => {
                if (e.dataTransfer?.types?.includes('Files')) {
                  e.preventDefault();
                  setIsDragOver(true);
                }
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                  onAddAttachedFiles?.(e.dataTransfer.files);
                }
              }}
              className={`p-3 rounded-xl border transition-colors ${
                isDragOver
                  ? 'border-sky-500 bg-sky-500/10 ring-2 ring-sky-500/30'
                  : 'border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950/60'
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Paperclip size={13} className="text-sky-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Attached Reference Files
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    (Max 10 files &mdash; code, specs, configs, documents, images)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={attachedFiles && attachedFiles.length >= 10}
                  className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-500/15 hover:bg-sky-100 dark:hover:bg-sky-500/25 border border-sky-300 dark:border-sky-500/30 text-sky-800 dark:text-sky-300 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40"
                >
                  <Paperclip size={12} />
                  <span>
                    Attach Files {attachedFiles && attachedFiles.length > 0 ? `(${attachedFiles.length}/10)` : ''}
                  </span>
                </button>
              </div>

              {attachedFiles && attachedFiles.length > 0 ? (
                <DiscussionAttachmentPills
                  files={attachedFiles}
                  onRemove={onRemoveAttachedFile || (() => {})}
                  maxFiles={10}
                />
              ) : (
                <div className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 italic">
                  Drop files here or click Attach Files to include project specifications, code files, or logs into Round 1 deliberation.
                </div>
              )}

              {attachmentClampedNotice && (
                <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle size={11} />
                  <span>Maximum 10 files allowed. Additional files were omitted.</span>
                </div>
              )}
            </div>

            {/* Section 2: Custom Skills & Domain Knowledge (PLACED UPFRONT AT INCEPTION) */}
            <div className="bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3.5 md:p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-200">
                    Custom Skills &amp; Domain Knowledge (Upfront Inception)
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Optional linked directory with domain <code className="text-sky-600 dark:text-sky-300">SKILL.md</code> competencies
                </span>
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
                    placeholder="Link custom skills folder (e.g. G:\xampp-httpdocs\vrsily2\skills or .flymd/skills)"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg py-1.5 px-2.5 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-sky-500 placeholder-slate-400 dark:placeholder-slate-600 shadow-xs"
                  />
                </div>
                {onBrowseSkillsDir && (
                  <button
                    type="button"
                    onClick={onBrowseSkillsDir}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-sky-500" />
                    <span>Browse</span>
                  </button>
                )}
              </div>

              {detectedSkills.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    Detected Custom Skills ({detectedSkills.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {detectedSkills.map((sk) => (
                      <div
                        key={sk.uri}
                        className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1"
                        title={sk.description}
                      >
                        <span className="font-semibold">{sk.name}</span>
                        {sk.replaces && sk.replaces.length > 0 && (
                          <span className="text-[9px] bg-emerald-500/20 px-1 rounded text-emerald-600 dark:text-emerald-300 font-mono">
                            OVERRIDE
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isScanningSkills && (
                <div className="text-[11px] text-sky-600 dark:text-sky-400 flex items-center gap-1.5 italic">
                  <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                  Scanning custom skills directory...
                </div>
              )}

              {/* Tool Inclusion / Isolation Choice */}
              <div className="pt-1 border-t border-slate-100 dark:border-slate-800/60 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="includeDefaultSkillsCheck"
                    checked={includeDefaultSkills}
                    onChange={(e) => setIncludeDefaultSkills && setIncludeDefaultSkills(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-sky-500 focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <label
                      htmlFor="includeDefaultSkillsCheck"
                      className="text-slate-800 dark:text-slate-200 text-xs font-medium cursor-pointer select-none"
                    >
                      Include Default Built-in Tool Skills alongside Custom Skills
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {includeDefaultSkills
                        ? 'Shared Mode: Default methodology guidelines are active. Custom skills override matching names.'
                        : 'Isolated Mode: Agents run strictly in domain isolation. Default built-in tool prompts are excluded.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Mode Selection Tab (Preset vs Repeater vs Custom Team) */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 md:p-4 bg-white dark:bg-slate-950/60 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sliders size={13} className="text-sky-500 dark:text-sky-400" />
                  <span>Agent Team &amp; Deliberation Mode</span>
                </div>
                <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setNewDebateMode('preset')}
                    className={`px-3 py-1 rounded text-[11px] font-semibold transition-all ${
                      newDebateMode === 'preset'
                        ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Presets ({presets.filter((p) => p.enabled).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewDebateMode('repeater');
                      if (repeater.repeaterMode === 'off') {
                        repeater.onChangeRepeaterMode('per_round');
                        if (repeater.roundSchedule.length === 0) {
                          repeater.onAutoBuildRoundSchedule('per_round');
                        }
                      }
                    }}
                    className={`px-3 py-1 rounded text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
                      newDebateMode === 'repeater'
                        ? 'bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-500/30 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Repeat size={11} />
                    <span>Multi-Engine Round Repeater</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewDebateMode('custom')}
                    className={`px-3 py-1 rounded text-[11px] font-semibold transition-all ${
                      newDebateMode === 'custom'
                        ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    Custom Team ({customParticipants.length})
                  </button>
                </div>
              </div>

              {/* Mode Body */}
              {newDebateMode === 'preset' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {presets
                      .filter((p) => p.enabled)
                      .map((preset) => {
                        const isSelected = selectedPreset === preset.id;
                        return (
                          <div
                            key={preset.id}
                            onClick={() => onSelectPreset(preset.id)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-sky-500/10 border-sky-500/60 shadow-sm'
                                : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                                {preset.name}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {preset.participants.length} rounds
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
                              {preset.description}
                            </p>
                            <div className="flex items-center gap-1 flex-wrap">
                              {preset.participants.map((part, idx) => (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
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
                        );
                      })}
                  </div>
                </div>
              ) : newDebateMode === 'repeater' ? (
                /* Multi-Engine Round Repeater */
                <DebateRoundRepeaterBuilder
                  dynamicProviders={repeater.dynamicProviders}
                  selectedEngines={repeater.selectedEngines}
                  onToggleSelectedEngine={repeater.onToggleSelectedEngine}
                  onSelectAllReadyEngines={repeater.onSelectAllReadyEngines}
                  isRefreshingSubscriptions={repeater.isRefreshingSubscriptions}
                  onRefreshSubscriptions={repeater.onRefreshSubscriptions}
                  repeaterMode={repeater.repeaterMode}
                  onChangeRepeaterMode={repeater.onChangeRepeaterMode}
                  maxRounds={calculatedRounds}
                  roundSchedule={repeater.roundSchedule}
                  onChangeRoundSchedule={repeater.onChangeRoundSchedule}
                  onAutoBuildRoundSchedule={repeater.onAutoBuildRoundSchedule}
                  allRoles={repeater.allRoles}
                  onCreateCustomRole={repeater.onCreateCustomRole}
                  onDeleteCustomRole={repeater.onDeleteCustomRole}
                  getSubscriptionTierForAgent={repeater.getSubscriptionTierForAgent}
                  getDynamicModelsForAgent={repeater.getDynamicModelsForAgent}
                  onOpenManageAccounts={repeater.onOpenManageAccounts}
                />
              ) : (
                /* Custom Team Editor */
                <div className="space-y-3">
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {customParticipants.map((p, idx) => {
                      const selectedActionId = p.customAction?.id || 'standard';
                      return (
                        <div
                          key={p.agentId || idx}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-2 text-xs shadow-xs"
                        >
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
                              className="w-28 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-900 dark:text-slate-200"
                            />
                            <select
                              value={p.role}
                              onChange={(e) => {
                                const picked = roleOptions.find(
                                  (r) => r.roleKey === e.target.value || r.id === e.target.value
                                );
                                if (!picked) return;
                                onUpdateParticipant(idx, {
                                  role: picked.roleKey,
                                  roleDescription: picked.experienceProfile,
                                  avatarColor: picked.avatarColor,
                                });
                              }}
                              className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-700 dark:text-slate-200 text-xs max-w-[180px]"
                            >
                              {roleOptions.map((r) => (
                                <option key={r.id} value={r.roleKey}>
                                  {r.name}
                                </option>
                              ))}
                            </select>
                            <select
                              value={p.providerId}
                              onChange={(e) => {
                                const provId = e.target.value;
                                const matched = engineOptions.find((ap) => ap.id === provId);
                                onUpdateParticipant(idx, {
                                  providerId: provId,
                                  modelId:
                                    matched?.model ||
                                    getDefaultModelForAgent(
                                      provId,
                                      repeater.getSubscriptionTierForAgent(provId)
                                    ),
                                });
                              }}
                              className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-700 dark:text-slate-200 text-xs flex-1 min-w-0"
                            >
                              {engineOptions.map((ap) => (
                                <option
                                  key={ap.id}
                                  value={ap.id}
                                  disabled={!ap.available && ap.id !== 'mock' && ap.id !== p.providerId}
                                >
                                  {ap.name}{' '}
                                  {ap.available || ap.id === 'mock' ? '✓ Ready' : '(Not connected)'}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={customParticipants.length <= 2}
                              onClick={() => onRemoveParticipant(idx)}
                              className="p-1 text-slate-400 hover:text-rose-500 disabled:opacity-20 shrink-0"
                              title="Remove agent"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800/60">
                            <ModelEffortSideBySidePicker
                              agentId={p.providerId || p.agentId}
                              subscriptionTier={repeater.getSubscriptionTierForAgent(p.providerId)}
                              dynamicModels={repeater.getDynamicModelsForAgent(p.providerId)}
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

                          <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/60">
                            <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 shrink-0">
                              Action Directive:
                            </span>
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
                              className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-slate-700 dark:text-slate-200 text-xs flex-1"
                            >
                              {ACTION_CATALOG.map((ac) => (
                                <option key={ac.id} value={ac.id}>
                                  {ac.name} — {ac.description}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <input
                              type="text"
                              value={p.customQuery || ''}
                              onChange={(e) => onUpdateParticipant(idx, { customQuery: e.target.value })}
                              placeholder="Specific inquiry or directive for this agent..."
                              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded px-2.5 py-1 text-[11px] text-slate-800 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-sky-500"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={onAddParticipant}
                    className="w-full py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 hover:border-sky-500 text-slate-600 dark:text-slate-400 hover:text-sky-600 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus size={13} />
                    <span>Add Participating Agent</span>
                  </button>
                </div>
              )}
            </div>

            {/* Section 4: Execution Parameters (AUTO-DERIVED ROUNDS, TIMEOUT, TOKEN BUDGET, STEP MODE) */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
              {/* Auto-derived Structured Rounds (Replaces manual rounds counter) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1">
                    <Repeat size={12} className="text-sky-500 dark:text-sky-400" />
                    Structured Rounds
                  </label>
                  <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">1 per Agent</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-slate-200 text-xs font-semibold flex items-center justify-between">
                  <span className="truncate">
                    {newDebateMode === 'repeater'
                      ? `${repeater.roundSchedule.length || 2} Repeater Rounds`
                      : newDebateMode === 'custom'
                      ? `${customParticipants.length} Dedicated Agent Rounds`
                      : `${selectedPresetObj?.participants.length || 3} Preset Agent Rounds`}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono shrink-0 ml-1">
                    AUTO
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1">
                    <Clock size={12} className="text-amber-500" />
                    Turn Timeout
                  </label>
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
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1">
                    <Coins size={12} className="text-emerald-500" />
                    Token Budget Cap
                  </label>
                  <span className="text-[10px] text-slate-500">Tokens</span>
                </div>
                <input
                  type="number"
                  value={tokenBudgetCapInput}
                  onChange={(e) => setTokenBudgetCapInput && setTokenBudgetCapInput(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-violet-500" />
                    Step Approval Mode
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableStepModeInNew(!enableStepModeInNew)}
                  className={`w-full p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-between transition-colors ${
                    enableStepModeInNew
                      ? 'bg-violet-500/15 border-violet-500/50 text-violet-700 dark:text-violet-300'
                      : 'bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span>{enableStepModeInNew ? 'Interactive Approval' : 'Autonomous Run'}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800">
                    {enableStepModeInNew ? 'PAUSE' : 'AUTO'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 md:p-5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/80">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              ⚡ Deliberation runs in isolated workspace sandboxes with verifiable cognitive checkpoints.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRequestClose}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!effectiveFormValid}
                onClick={onLaunch}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 ${
                  effectiveFormValid
                    ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 cursor-pointer'
                    : 'bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-500 opacity-60 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                }`}
                title={
                  !effectiveFormValid
                    ? 'Discussion Topic and Proposal / Target Objective are required to launch a deliberation'
                    : `Launch ${calculatedRounds}-Round Deliberation`
                }
              >
                <Sparkles size={14} />
                <span>Launch {calculatedRounds}-Round Deliberation</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Standalone Decoupled Custom Actions & Roles Modal */}
      <CustomActionsAndRolesModal
        isOpen={isRolesModalOpen}
        onClose={() => setIsRolesModalOpen(false)}
        presets={presets}
        allRoles={roleOptions}
        dynamicProviders={repeater.dynamicProviders}
        selectedEngines={repeater.selectedEngines}
        editingPreset={editingPreset}
        isCreatingNewPreset={isCreatingNewPreset}
        setEditingPreset={setEditingPreset}
        onSaveEditingPreset={onSaveEditingPreset}
        onStartCreatePreset={onStartCreatePreset}
        onStartEditPreset={onStartEditPreset}
        onDuplicatePreset={onDuplicatePreset}
        onDeletePreset={onDeletePreset}
        onTogglePresetEnabled={onTogglePresetEnabled}
        onResetPresetsToDefaults={onResetPresetsToDefaults}
        onCreateCustomRole={repeater.onCreateCustomRole}
        onDeleteCustomRole={repeater.onDeleteCustomRole}
        getSubscriptionTierForAgent={repeater.getSubscriptionTierForAgent}
      />

      <UnsavedChangesModal
        isOpen={showDiscardAlert}
        title="Discard Deliberation Draft?"
        message="You have entered a discussion topic or objective details that will be lost if you close now. Do you want to discard your draft?"
        confirmLabel="Discard Draft"
        cancelLabel="Keep Editing"
        onConfirmDiscard={handleConfirmDiscard}
        onCancelKeepEditing={() => setShowDiscardAlert(false)}
      />
    </>
  );
};
