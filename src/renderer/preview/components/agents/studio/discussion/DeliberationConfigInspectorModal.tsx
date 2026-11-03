import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Sliders,
  Lock,
  Edit3,
  AlertTriangle,
  CheckCircle,
  Plus,
  Trash2,
  Info,
  Layers,
  Pause,
  Bot,
  Sparkles,
  Zap,
  RefreshCw,
} from 'lucide-react';
import {
  DiscussionConfig,
  DiscussionMetadata,
  DiscussionRoundPlan,
  DiscussionRoundSlot,
  DiscussionParticipant,
  AgentEffortLevel,
  AvailableProviderInfo,
} from '../../../../../../shared/types';
import { UnsavedChangesModal } from '../../../common/UnsavedChangesModal';
import { renderDiscussionStatusBadge } from '../../../../utils/discussionTextUtils';
import {
  fetchAndCacheAgentModels,
  getAvailableModelsForAgent,
  normalizeModelForAgent,
} from '../../../../../../shared/constants/models';

export interface DeliberationConfigInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: DiscussionConfig | null;
  metadata: DiscussionMetadata | null;
  onSaveConfig: (updatedConfig: DiscussionConfig) => Promise<void>;
  availableProviders: AvailableProviderInfo[];
  getDynamicModelsForAgent?: (agentOrProviderId: string) => string[];
  getSubscriptionTierForAgent?: (agentOrProviderId: string) => string | undefined;
}

export const DeliberationConfigInspectorModal: React.FC<DeliberationConfigInspectorModalProps> = ({
  isOpen,
  onClose,
  config,
  metadata,
  onSaveConfig,
  availableProviders,
  getDynamicModelsForAgent,
  getSubscriptionTierForAgent,
}) => {
  const [localConfig, setLocalConfig] = useState<DiscussionConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showDiscardAlert, setShowDiscardAlert] = useState(false);
  const [fetchingAgentKey, setFetchingAgentKey] = useState<string | null>(null);
  const [fetchRev, setFetchRev] = useState(0);

  const handleFetchModelsForProvider = async (providerOrAgentId: string) => {
    if (fetchingAgentKey) return;
    setFetchingAgentKey(providerOrAgentId);
    try {
      await fetchAndCacheAgentModels(providerOrAgentId);
      setFetchRev((r) => r + 1);
    } finally {
      setFetchingAgentKey(null);
    }
  };

  // Initialize local config whenever config prop changes
  useEffect(() => {
    if (config) {
      setLocalConfig(JSON.parse(JSON.stringify(config)));
      setSaveError(null);
      setSaveSuccess(false);
    }
  }, [config, isOpen]);

  // Check dirty state
  const isDirty = useMemo(() => {
    if (!config || !localConfig) return false;
    return JSON.stringify(config) !== JSON.stringify(localConfig);
  }, [config, localConfig]);

  const isEditable = useMemo(() => {
    if (!metadata) return false;
    return metadata.status === 'paused' || metadata.status === 'failed' || metadata.status === 'created';
  }, [metadata]);

  const currentRound = metadata?.currentRound || 1;

  // Safe close handler with dirty detection
  const handleRequestClose = useCallback(() => {
    if (isDirty) {
      setShowDiscardAlert(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleRequestClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleRequestClose]);

  if (!isOpen || !localConfig) return null;

  const handleTogglePauseAtBoundary = () => {
    if (!isEditable) return;
    setLocalConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pauseAtRoundBoundary: !prev.pauseAtRoundBoundary,
      };
    });
  };

  const handleMaxRoundsChange = (val: number) => {
    if (!isEditable) return;
    const clamped = Math.max(currentRound, Math.min(10, val));
    setLocalConfig((prev) => {
      if (!prev) return prev;
      // If expanding round schedule, ensure future rounds have empty or default plans
      const schedule = [...(prev.roundSchedule || [])];
      return {
        ...prev,
        maxRounds: clamped,
        roundSchedule: schedule,
      };
    });
  };

  const handleUpdateSlot = (
    roundNumber: number,
    slotIdx: number,
    patch: Partial<DiscussionParticipant> & { roundDirective?: string }
  ) => {
    const canModifyRound =
      isEditable &&
      (roundNumber > currentRound ||
        (roundNumber === currentRound && metadata?.status === 'failed'));
    if (!canModifyRound) return;
    setLocalConfig((prev) => {
      if (!prev) return prev;
      const schedule = [...(prev.roundSchedule || [])];
      let roundPlan = schedule.find((p) => p.roundNumber === roundNumber);
      if (!roundPlan) {
        roundPlan = {
          roundNumber,
          title: `Round ${roundNumber}: Specialist Deliberation`,
          objective: '',
          slots: (prev.participants || []).map((part, idx) => ({
            slotId: `slot-r${roundNumber}-${idx + 1}`,
            participant: { ...part },
            roundDirective: '',
          })),
        };
        schedule.push(roundPlan);
      }
      const slots = [...roundPlan.slots];
      let targetAgentId: string | undefined;
      if (slots[slotIdx]) {
        const currentSlot = slots[slotIdx];
        targetAgentId = currentSlot.participant.agentId;
        const updatedParticipant: DiscussionParticipant = {
          ...currentSlot.participant,
          ...(patch.agentId !== undefined ? { agentId: patch.agentId } : {}),
          ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
          ...(patch.role !== undefined ? { role: patch.role } : {}),
          ...(patch.providerId !== undefined ? { providerId: patch.providerId } : {}),
          ...(patch.modelId !== undefined ? { modelId: patch.modelId } : {}),
          ...(patch.effortLevel !== undefined ? { effortLevel: patch.effortLevel } : {}),
          ...(patch.thinkingEnabled !== undefined ? { thinkingEnabled: patch.thinkingEnabled } : {}),
        };
        slots[slotIdx] = {
          ...currentSlot,
          participant: updatedParticipant,
          ...(patch.roundDirective !== undefined ? { roundDirective: patch.roundDirective } : {}),
        };
        roundPlan.slots = slots;
      }
      const updatedParticipants = (prev.participants || []).map((part) => {
        if (targetAgentId && part.agentId === targetAgentId) {
          return {
            ...part,
            ...(patch.modelId !== undefined ? { modelId: patch.modelId } : {}),
            ...(patch.effortLevel !== undefined ? { effortLevel: patch.effortLevel } : {}),
            ...(patch.thinkingEnabled !== undefined ? { thinkingEnabled: patch.thinkingEnabled } : {}),
          };
        }
        return part;
      });
      return {
        ...prev,
        participants: updatedParticipants,
        roundSchedule: schedule,
      };
    });
  };

  const handleAddSlot = (roundNumber: number) => {
    if (!isEditable || roundNumber <= currentRound) return;
    setLocalConfig((prev) => {
      if (!prev) return prev;
      const schedule = [...(prev.roundSchedule || [])];
      let roundPlan = schedule.find((p) => p.roundNumber === roundNumber);
      if (!roundPlan) {
        roundPlan = {
          roundNumber,
          title: `Round ${roundNumber}: Specialist Deliberation`,
          objective: '',
          slots: [],
        };
        schedule.push(roundPlan);
      }
      const newSlot: DiscussionRoundSlot = {
        slotId: `slot-r${roundNumber}-${roundPlan.slots.length + 1}`,
        participant: {
          agentId: `custom-agent-${Date.now()}`,
          displayName: 'Specialist Advisor',
          role: 'custom' as any,
          providerId: 'ClaudeCode',
          modelId: 'claude-3-7-sonnet',
          effortLevel: 'medium',
          thinkingEnabled: true,
        },
        roundDirective: '',
      };
      roundPlan.slots = [...roundPlan.slots, newSlot];
      return {
        ...prev,
        roundSchedule: schedule,
      };
    });
  };

  const handleRemoveSlot = (roundNumber: number, slotIdx: number) => {
    if (!isEditable || roundNumber <= currentRound) return;
    setLocalConfig((prev) => {
      if (!prev) return prev;
      const schedule = [...(prev.roundSchedule || [])];
      const roundPlan = schedule.find((p) => p.roundNumber === roundNumber);
      if (roundPlan && roundPlan.slots.length > 1) {
        roundPlan.slots = roundPlan.slots.filter((_, idx) => idx !== slotIdx);
      }
      return {
        ...prev,
        roundSchedule: schedule,
      };
    });
  };

  const handleSave = async () => {
    if (!isEditable || !localConfig) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await onSaveConfig(localConfig);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      setSaveError(err.message || String(err));
    } finally {
      setIsSaving(false);
    }
  };

  // Derive all rounds up to maxRounds
  const roundsList: number[] = [];
  for (let r = 1; r <= (localConfig.maxRounds || 3); r++) {
    roundsList.push(r);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-slate-100 transition-colors">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              <Sliders size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Deliberation Configuration &amp; Details
                </h2>
                {metadata && renderDiscussionStatusBadge(metadata.status)}
              </div>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-md">
                Session ID: {localConfig.sessionId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRequestClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Status Diagnostic Callout */}
          {metadata?.status === 'paused' && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30 flex items-start gap-3">
              <Pause size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 dark:text-amber-200">
                <span className="font-semibold">Deliberation is paused.</span> Historical rounds (≤ Round {currentRound}) are strictly immutable. You can modify upcoming rounds (&gt; Round {currentRound}), adjust engine assignments, reasoning effort, or toggle round barrier synchronization before resuming.
              </div>
            </div>
          )}

          {metadata?.status === 'failed' && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 flex items-start gap-3">
              <AlertTriangle size={16} className="text-rose-500 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-800 dark:text-rose-200">
                <span className="font-semibold">Deliberation failed during turn execution.</span> All completed turns up to Round {currentRound} are safely preserved in disk ledgers. You can adjust upcoming rounds and click Resume in the studio toolbar to retry the failed turn.
              </div>
            </div>
          )}

          {metadata?.status === 'running' && (
            <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-500/30 flex items-start gap-3">
              <Info size={16} className="text-sky-500 shrink-0 mt-0.5" />
              <div className="text-xs text-sky-800 dark:text-sky-200">
                <span className="font-semibold">Deliberation is currently running.</span> Live configuration is locked in read-only mode to prevent mid-turn state divergence. Pause deliberation to modify upcoming rounds.
              </div>
            </div>
          )}

          {/* Deliberation Premise & Scope Card */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 space-y-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Topic &amp; Premise
              </div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {localConfig.topic || 'Multi-Agent Technical Deliberation'}
              </div>
            </div>
            {localConfig.userIdea && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  User Requirements / Epistemic Objective
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                  {localConfig.userIdea}
                </div>
              </div>
            )}
          </div>

          {/* Global Deliberation Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Round Barrier Pause Setting */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>Round Barrier Sync</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${localConfig.pauseAtRoundBoundary ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                    {localConfig.pauseAtRoundBoundary ? 'PAUSE EACH' : 'CONTINUOUS'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Pause deliberation after each round completes for human audit.
                </p>
              </div>
              <button
                type="button"
                disabled={!isEditable}
                onClick={handleTogglePauseAtBoundary}
                className={`mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                  localConfig.pauseAtRoundBoundary
                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                } ${!isEditable ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span>{localConfig.pauseAtRoundBoundary ? 'Pause Between Rounds: ON' : 'Pause Between Rounds: OFF'}</span>
              </button>
            </div>

            {/* Total Rounds Setting */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>Max Deliberation Rounds</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-500 font-mono">
                    Round {currentRound} of {localConfig.maxRounds}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Total rounds planned before synthesis report generation.
                </p>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  disabled={!isEditable || localConfig.maxRounds <= currentRound}
                  onClick={() => handleMaxRoundsChange(localConfig.maxRounds - 1)}
                  className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-bold disabled:opacity-40"
                >
                  -
                </button>
                <div className="flex-1 text-center font-mono font-bold text-sm">
                  {localConfig.maxRounds}
                </div>
                <button
                  type="button"
                  disabled={!isEditable || localConfig.maxRounds >= 10}
                  onClick={() => handleMaxRoundsChange(localConfig.maxRounds + 1)}
                  className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-bold disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>

            {/* Token Budget Cap */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>Token Budget Cap</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-mono">
                    {(metadata?.totalTokens || 0).toLocaleString()} used
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Budget threshold that automatically pauses deliberation if reached.
                </p>
              </div>
              <div className="mt-3 text-xs font-mono text-slate-600 dark:text-slate-400">
                {localConfig.tokenBudgetCap ? `${localConfig.tokenBudgetCap.toLocaleString()} tokens` : 'Unlimited Budget'}
              </div>
            </div>
          </div>

          {/* Round-by-Round Breakdown & Editor */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Layers size={14} className="text-sky-500" />
                <span>Round Schedule &amp; In-Flight Participant Plan</span>
              </h3>
              <div className="text-[10px] text-slate-400">
                Rounds ≤ {currentRound} are locked to preserve epistemic continuity.
              </div>
            </div>

            {roundsList.map((roundNum) => {
              const isFailedCurrentRound =
                roundNum === currentRound && metadata?.status === 'failed';
              const isPastOrLocked = roundNum <= currentRound && !isFailedCurrentRound;
              const roundPlan = localConfig.roundSchedule?.find((p) => p.roundNumber === roundNum);
              const slots: DiscussionRoundSlot[] =
                roundPlan?.slots && roundPlan.slots.length > 0
                  ? roundPlan.slots
                  : (localConfig.participants || []).map((part, idx) => ({
                      slotId: `slot-r${roundNum}-${idx + 1}`,
                      participant: part,
                      roundDirective: '',
                    }));

              return (
                <div
                  key={`${roundNum}-${fetchRev}`}
                  className={`p-4 rounded-xl border transition-all ${
                    isPastOrLocked
                      ? 'border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 opacity-85'
                      : isFailedCurrentRound
                      ? 'border-rose-500/40 bg-rose-50/30 dark:bg-rose-950/15'
                      : 'border-sky-500/30 dark:border-sky-500/20 bg-sky-50/20 dark:bg-sky-950/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                        Round {roundNum}
                      </span>
                      {isPastOrLocked ? (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-semibold">
                          <Lock size={10} />
                          <span>{roundNum < currentRound ? 'Executed' : 'Current Active'} (Locked)</span>
                        </span>
                      ) : isFailedCurrentRound ? (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-semibold">
                          <Edit3 size={10} />
                          <span>Failed Round — Model &amp; Effort Editable for Retry</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-700 dark:text-sky-400 font-semibold">
                          <Edit3 size={10} />
                          <span>Upcoming (Editable)</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      {slots.length} participating agent(s)
                    </div>
                  </div>

                  {/* Slots list */}
                  <div className="space-y-2">
                    {slots.map((slot, sIdx) => {
                      const p = slot.participant;
                      const providerKey = p.providerId || p.agentId;
                      const dynamicModels = getDynamicModelsForAgent
                        ? getDynamicModelsForAgent(providerKey)
                        : [];
                      const tier = getSubscriptionTierForAgent
                        ? getSubscriptionTierForAgent(providerKey)
                        : undefined;
                      const catalogModels = getAvailableModelsForAgent(
                        providerKey,
                        tier,
                        dynamicModels
                      );
                      const resolvedModelId = normalizeModelForAgent(
                        providerKey,
                        p.modelId,
                        tier
                      );
                      const activeCatalogModel =
                        catalogModels.find(
                          (m) => m.id.toLowerCase() === resolvedModelId.toLowerCase()
                        ) || catalogModels[0];
                      const supportedEfforts: AgentEffortLevel[] =
                        activeCatalogModel?.supportedEffortLevels &&
                        activeCatalogModel.supportedEffortLevels.length > 0
                          ? activeCatalogModel.supportedEffortLevels
                          : ['low', 'medium', 'high'];

                      return (
                        <div
                          key={slot.slotId || sIdx}
                          className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-[200px]">
                            <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                              <Bot size={14} />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {p.displayName || p.agentId}
                              </div>
                              <div className="text-[10px] font-mono text-slate-600 dark:text-slate-400 uppercase">
                                Role: {p.role} • Provider: {p.providerId}
                              </div>
                            </div>
                          </div>

                          {/* Editable controls for future rounds or failed current round */}
                          {!isPastOrLocked && isEditable ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Model selector + Fetch button */}
                              <div className="flex items-center gap-1">
                                <select
                                  value={resolvedModelId}
                                  onChange={(e) => {
                                    const nextModel = e.target.value;
                                    const entry = catalogModels.find((m) => m.id === nextModel);
                                    const patch: Partial<DiscussionParticipant> = {
                                      modelId: nextModel,
                                    };
                                    if (
                                      entry?.supportedEffortLevels &&
                                      entry.supportedEffortLevels.length > 0 &&
                                      !entry.supportedEffortLevels.includes(
                                        (p.effortLevel || 'medium') as AgentEffortLevel
                                      )
                                    ) {
                                      patch.effortLevel =
                                        entry.defaultEffortLevel || entry.supportedEffortLevels[0];
                                    }
                                    handleUpdateSlot(roundNum, sIdx, patch);
                                  }}
                                  className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-200 focus:outline-none cursor-pointer"
                                >
                                  {catalogModels.map((m) => (
                                    <option
                                      key={m.id}
                                      value={m.id}
                                      className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200"
                                    >
                                      {m.displayName} ({m.id})
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleFetchModelsForProvider(providerKey)}
                                  disabled={fetchingAgentKey === providerKey}
                                  title="Fetch real available models from subscription CLI"
                                  className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                                >
                                  <RefreshCw
                                    size={11}
                                    className={fetchingAgentKey === providerKey ? 'animate-spin text-sky-500' : ''}
                                  />
                                </button>
                              </div>

                              {/* Effort level */}
                              <div className="flex items-center rounded bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-300 dark:border-slate-700">
                                {supportedEfforts.map((eff) => (
                                  <button
                                    key={eff}
                                    type="button"
                                    onClick={() =>
                                      handleUpdateSlot(roundNum, sIdx, { effortLevel: eff })
                                    }
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
                                      (p.effortLevel || 'medium') === eff
                                        ? 'bg-sky-500 text-slate-950'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                                  >
                                    {eff[0]}
                                  </button>
                                ))}
                              </div>

                              {/* Delete slot (only for future rounds) */}
                              {roundNum > currentRound && slots.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSlot(roundNum, sIdx)}
                                  className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-500 transition-colors"
                                  title="Remove agent slot"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {p.modelId}
                              </span>
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400">
                                {(p.effortLevel || 'medium')[0]} Effort
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Add Slot Button for Future Rounds */}
                    {roundNum > currentRound && isEditable && (
                      <button
                        type="button"
                        onClick={() => handleAddSlot(roundNum)}
                        className="w-full py-2 rounded-lg border border-dashed border-sky-500/40 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Plus size={13} />
                        <span>Add Participating Agent to Round {roundNum}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2 text-xs">
            {saveError && (
              <span className="text-rose-500 font-semibold flex items-center gap-1">
                <AlertTriangle size={14} />
                <span>{saveError}</span>
              </span>
            )}
            {saveSuccess && (
              <span className="text-emerald-500 font-semibold flex items-center gap-1">
                <CheckCircle size={14} />
                <span>Configuration updated successfully!</span>
              </span>
            )}
            {!saveError && !saveSuccess && isDirty && (
              <span className="text-amber-500 font-medium">
                Unsaved modifications pending.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRequestClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            {isEditable && (
              <button
                type="button"
                disabled={!isDirty || isSaving}
                onClick={handleSave}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed shadow-md transition-all flex items-center gap-1.5"
              >
                {isSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Configuration</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <UnsavedChangesModal
        isOpen={showDiscardAlert}
        title="Discard Configuration Changes?"
        message="You have modified the deliberation round configuration. If you close now without saving, your modifications will be lost."
        confirmLabel="Discard Changes"
        cancelLabel="Keep Editing"
        onConfirmDiscard={() => {
          setShowDiscardAlert(false);
          onClose();
        }}
        onCancelKeepEditing={() => setShowDiscardAlert(false)}
      />
    </div>
  );
};
