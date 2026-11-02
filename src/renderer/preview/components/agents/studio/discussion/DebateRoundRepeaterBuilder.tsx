import React, { useState } from 'react';
import {
  Cpu,
  Repeat,
  Plus,
  Trash2,
  RefreshCw,
  KeyRound,
  Sparkles,
  Check,
  Wand2,
  UserPlus,
  Layers,
  Zap,
} from 'lucide-react';
import {
  AvailableProviderInfo,
  CustomRoleDefinition,
  DebateRepeaterMode,
  DiscussionRoundPlan,
  DiscussionRoundSlot,
  SkillDescriptor,
} from '../../../../../../shared/types';
import { ModelEffortSideBySidePicker } from '../../common/ModelEffortSideBySidePicker';
import { getDefaultModelForAgent } from '../../../../../../shared/constants/models';

export interface DebateRoundRepeaterBuilderProps {
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

  detectedSkills?: SkillDescriptor[];
  getSubscriptionTierForAgent: (agentOrProviderId: string) => string | undefined;
  getDynamicModelsForAgent: (agentOrProviderId: string) => string[];
}

const ROLE_COLORS = [
  '#38bdf8',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#a78bfa',
  '#06b6d4',
  '#f472b6',
  '#818cf8',
];

export const DebateRoundRepeaterBuilder: React.FC<DebateRoundRepeaterBuilderProps> = ({
  dynamicProviders,
  selectedEngines,
  onToggleSelectedEngine,
  onSelectAllReadyEngines,
  isRefreshingSubscriptions,
  onRefreshSubscriptions,
  onOpenManageAccounts,
  repeaterMode,
  onChangeRepeaterMode,
  maxRounds,
  roundSchedule,
  onChangeRoundSchedule,
  onAutoBuildRoundSchedule,
  allRoles,
  onCreateCustomRole,
  onDeleteCustomRole,
  detectedSkills = [],
  getSubscriptionTierForAgent,
  getDynamicModelsForAgent,
}) => {
  const [showRoleCreator, setShowRoleCreator] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleExperience, setNewRoleExperience] = useState('');
  const [newRoleDirective, setNewRoleDirective] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#38bdf8');
  const [newRoleSkills, setNewRoleSkills] = useState<string[]>([]);

  const handleSaveNewRole = () => {
    const trimmed = newRoleName.trim();
    if (!trimmed) return;
    onCreateCustomRole({
      roleKey: trimmed,
      name: trimmed,
      experienceProfile:
        newRoleExperience.trim() ||
        `Senior ${trimmed} bringing deep domain experience, critical validation, and practical judgment.`,
      defaultDirective:
        newRoleDirective.trim() ||
        `Evaluate the proposal strictly through the lens of ${trimmed}, identifying trade-offs, blind spots, and concrete improvements.`,
      assignedSkillUris: newRoleSkills,
      avatarColor: newRoleColor,
    });
    setNewRoleName('');
    setNewRoleExperience('');
    setNewRoleDirective('');
    setNewRoleSkills([]);
    setShowRoleCreator(false);
  };

  const updateRoundPlan = (
    roundIdx: number,
    updates: Partial<DiscussionRoundPlan>
  ) => {
    const next = roundSchedule.map((plan, idx) =>
      idx === roundIdx ? { ...plan, ...updates } : plan
    );
    onChangeRoundSchedule(next);
  };

  const updateSlot = (
    roundIdx: number,
    slotIdx: number,
    updater: (slot: DiscussionRoundSlot) => DiscussionRoundSlot
  ) => {
    const next = roundSchedule.map((plan, rIdx) => {
      if (rIdx !== roundIdx) return plan;
      return {
        ...plan,
        slots: plan.slots.map((slot, sIdx) =>
          sIdx === slotIdx ? updater(slot) : slot
        ),
      };
    });
    onChangeRoundSchedule(next);
  };

  const handleAddRoundStep = () => {
    const nextRoundNum = roundSchedule.length + 1;
    const enginePool =
      selectedEngines.length > 0
        ? selectedEngines
        : [dynamicProviders[0]?.id || 'mock'];
    const engA = enginePool[(nextRoundNum - 1) % enginePool.length];
    const engB = enginePool[nextRoundNum % enginePool.length];
    const roleA = allRoles[(nextRoundNum * 2 - 2) % allRoles.length];
    const roleB = allRoles[(nextRoundNum * 2 - 1) % allRoles.length];
    const tierA = getSubscriptionTierForAgent(engA);
    const tierB = getSubscriptionTierForAgent(engB);
    const provA = dynamicProviders.find((p) => p.id === engA);
    const provB = dynamicProviders.find((p) => p.id === engB);

    const newPlan: DiscussionRoundPlan = {
      roundNumber: nextRoundNum,
      title: `Round Step ${nextRoundNum}: Specialist Deep-Dive & Cross-Critique`,
      objective:
        'Challenge unresolved trade-offs using specialized domain experience and verify consensus readiness.',
      slots: [
        {
          slotId: `slot-r${nextRoundNum}-1-${Date.now()}`,
          roundDirective: roleA.defaultDirective,
          participant: {
            agentId: `repeater-r${nextRoundNum}-a1-${Date.now()}`,
            providerId: engA,
            modelId: provA?.model || getDefaultModelForAgent(engA, tierA),
            displayName: roleA.name,
            role: roleA.roleKey,
            roleDescription: roleA.experienceProfile,
            avatarColor: roleA.avatarColor,
            assignedSkillUris: roleA.assignedSkillUris || [],
            contextBudgetTokens: 24000,
            thinkingEnabled: true,
            effortLevel: 'high',
          },
        },
        {
          slotId: `slot-r${nextRoundNum}-2-${Date.now() + 1}`,
          roundDirective: roleB.defaultDirective,
          participant: {
            agentId: `repeater-r${nextRoundNum}-a2-${Date.now() + 1}`,
            providerId: engB,
            modelId: provB?.model || getDefaultModelForAgent(engB, tierB),
            displayName: roleB.name,
            role: roleB.roleKey,
            roleDescription: roleB.experienceProfile,
            avatarColor: roleB.avatarColor,
            assignedSkillUris: roleB.assignedSkillUris || [],
            contextBudgetTokens: 24000,
            thinkingEnabled: true,
            effortLevel: 'high',
          },
        },
      ],
    };

    onChangeRoundSchedule([...roundSchedule, newPlan]);
  };

  const handleRemoveRoundStep = (roundIdx: number) => {
    if (roundSchedule.length <= 1) return;
    const filtered = roundSchedule
      .filter((_, idx) => idx !== roundIdx)
      .map((plan, idx) => ({ ...plan, roundNumber: idx + 1 }));
    onChangeRoundSchedule(filtered);
  };

  const handleAddSlotToRound = (roundIdx: number) => {
    const plan = roundSchedule[roundIdx];
    if (!plan) return;
    const slotNum = plan.slots.length + 1;
    const enginePool =
      selectedEngines.length > 0
        ? selectedEngines
        : [dynamicProviders[0]?.id || 'mock'];
    const engId = enginePool[(roundIdx + slotNum - 1) % enginePool.length];
    const roleDef = allRoles[(roundIdx + slotNum - 1) % allRoles.length];
    const tier = getSubscriptionTierForAgent(engId);
    const prov = dynamicProviders.find((p) => p.id === engId);

    const newSlot: DiscussionRoundSlot = {
      slotId: `slot-r${plan.roundNumber}-${slotNum}-${Date.now()}`,
      roundDirective: roleDef.defaultDirective,
      participant: {
        agentId: `repeater-r${plan.roundNumber}-s${slotNum}-${Date.now()}`,
        providerId: engId,
        modelId: prov?.model || getDefaultModelForAgent(engId, tier),
        displayName: roleDef.name,
        role: roleDef.roleKey,
        roleDescription: roleDef.experienceProfile,
        avatarColor: roleDef.avatarColor,
        assignedSkillUris: roleDef.assignedSkillUris || [],
        contextBudgetTokens: 24000,
        thinkingEnabled: true,
        effortLevel: 'medium',
      },
    };

    updateRoundPlan(roundIdx, { slots: [...plan.slots, newSlot] });
  };

  const handleRemoveSlotFromRound = (roundIdx: number, slotIdx: number) => {
    const plan = roundSchedule[roundIdx];
    if (!plan || plan.slots.length <= 1) return;
    updateRoundPlan(roundIdx, {
      slots: plan.slots.filter((_, idx) => idx !== slotIdx),
    });
  };

  return (
    <div className="space-y-4">
      {/* 1. Dynamic Subscription Multi-Engine Pool */}
      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400">
              <Cpu size={14} />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
                <span>Multi-Engine Subscription Pool</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                  {selectedEngines.length} Selected
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Dynamically synced from your active CLI logins, API keys, subscription tiers, and local models. Select multiple engines to combine their strengths.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onSelectAllReadyEngines}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 text-[11px] font-semibold transition-colors"
            >
              Select All Ready
            </button>
            <button
              type="button"
              onClick={onRefreshSubscriptions}
              disabled={isRefreshingSubscriptions}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1 transition-colors"
              title="Re-scan installed agent CLIs, subscription tiers, and Ollama models"
            >
              <RefreshCw
                size={11}
                className={isRefreshingSubscriptions ? 'animate-spin text-sky-400' : 'text-sky-400'}
              />
              <span>Refresh</span>
            </button>
            {onOpenManageAccounts && (
              <button
                type="button"
                onClick={onOpenManageAccounts}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold flex items-center gap-1 transition-colors"
              >
                <KeyRound size={11} />
                <span>Subscriptions</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {dynamicProviders.map((prov) => {
            const isSelected = selectedEngines.includes(prov.id);
            const isSim = prov.id === 'mock';
            const canSelect = prov.available || isSim;
            const tierLabel = prov.subscriptionTier
              ? prov.subscriptionTier.toUpperCase()
              : isSim
              ? 'SIMULATOR'
              : (prov.providerType || 'engine').toUpperCase();

            return (
              <button
                key={prov.id}
                type="button"
                disabled={!canSelect && !isSelected}
                onClick={() => onToggleSelectedEngine(prov.id)}
                className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-sky-500/15 border-sky-500/50 text-slate-100 ring-1 ring-sky-500/30'
                    : canSelect
                    ? 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-300'
                    : 'bg-slate-950/30 border-slate-800/50 text-slate-500 opacity-55 cursor-not-allowed'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: prov.available
                          ? prov.accentColor || '#10b981'
                          : '#64748b',
                      }}
                    />
                    <span className="text-xs font-bold truncate">{prov.name}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-sky-300 border border-slate-700 font-bold shrink-0">
                      {tierLabel}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                    {prov.available
                      ? `Model: ${prov.model}`
                      : 'Not connected — configure in Subscriptions'}
                  </div>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-400/50 flex items-center justify-center shrink-0">
                    <Check size={11} className="text-sky-300" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Unlimited Custom Role & Domain Experience Library */}
      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <UserPlus size={13} className="text-amber-400" />
              <span>Specialist Roles, Experience &amp; Skills ({allRoles.length})</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Assign deep domain experience and competencies to each round&apos;s agents, or define your own specialist roles.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowRoleCreator((prev) => !prev)}
            className="px-3 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1 transition-colors"
          >
            <Plus size={12} />
            <span>{showRoleCreator ? 'Close Role Creator' : 'Define Custom Specialist Role'}</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {allRoles.map((r) => (
            <span
              key={r.id}
              title={`${r.experienceProfile}\nDirective: ${r.defaultDirective}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800 text-[11px] text-slate-200"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: r.avatarColor }}
              />
              <span className="font-semibold">{r.name}</span>
              {!r.isBuiltIn && (
                <button
                  type="button"
                  onClick={() => onDeleteCustomRole(r.id)}
                  className="text-slate-500 hover:text-rose-400 ml-0.5"
                  title="Delete custom role"
                >
                  &times;
                </button>
              )}
            </span>
          ))}
        </div>

        {showRoleCreator && (
          <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 space-y-2.5 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Specialist Role Title
                </label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g. Distributed Database Architect, FinOps Cost Auditor, Regulatory Counsel..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Badge Accent
                </label>
                <div className="flex items-center gap-1.5 pt-1">
                  {ROLE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewRoleColor(c)}
                      className={`w-5 h-5 rounded-full border ${
                        newRoleColor === c
                          ? 'ring-2 ring-white border-white scale-110'
                          : 'border-slate-700 opacity-75'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Experience, Background &amp; Domain Skills
              </label>
              <input
                type="text"
                value={newRoleExperience}
                onChange={(e) => setNewRoleExperience(e.target.value)}
                placeholder="e.g. 12+ years scaling high-throughput event pipelines, zero-downtime migrations, and fault isolation..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Standing Round Inquiry Directive
              </label>
              <input
                type="text"
                value={newRoleDirective}
                onChange={(e) => setNewRoleDirective(e.target.value)}
                placeholder="e.g. Challenge data consistency guarantees, partition recovery, and operational complexity..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              />
            </div>

            {detectedSkills.length > 0 && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Bind Detected Custom Skills (Optional)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {detectedSkills.map((sk) => {
                    const active = newRoleSkills.includes(sk.uri);
                    return (
                      <button
                        key={sk.uri}
                        type="button"
                        onClick={() =>
                          setNewRoleSkills((prev) =>
                            prev.includes(sk.uri)
                              ? prev.filter((u) => u !== sk.uri)
                              : [...prev, sk.uri]
                          )
                        }
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono border transition-colors ${
                          active
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        {active ? '✓ ' : '+ '}
                        {sk.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowRoleCreator(false)}
                className="px-3 py-1 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newRoleName.trim()}
                onClick={handleSaveNewRole}
                className="px-3.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-bold"
              >
                Save Role to Library
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Round Repeater & Per-Round Split Choreography */}
      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <Repeat size={14} className="text-violet-400" />
              <span>Debate Round Repeater &amp; Per-Round Engine/Role Split</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Split rounds into a repeating specialist cycle or customize each round with its own engine, model, and role. Automatically stops early if successive summaries converge!
            </p>
          </div>

          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => {
                onChangeRepeaterMode('cycle');
                if (roundSchedule.length === 0) {
                  onAutoBuildRoundSchedule('cycle');
                }
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                repeaterMode === 'cycle'
                  ? 'bg-violet-500/25 text-violet-200 border border-violet-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cycle Repeater
            </button>
            <button
              type="button"
              onClick={() => {
                onChangeRepeaterMode('per_round');
                onAutoBuildRoundSchedule('per_round');
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                repeaterMode === 'per_round'
                  ? 'bg-sky-500/25 text-sky-200 border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Split All {maxRounds} Rounds
            </button>
            <button
              type="button"
              onClick={() => onChangeRepeaterMode('off')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                repeaterMode === 'off'
                  ? 'bg-slate-800 text-slate-200 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Shared Team
            </button>
          </div>
        </div>

        {repeaterMode === 'off' ? (
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between gap-3">
            <span>
              <strong>Multi-Engine Team Mode:</strong> Your{' '}
              <strong>{selectedEngines.length}</strong> selected subscription engine(s) will be distributed across the active preset/team participants for all rounds, stopping early if consensus is reached.
            </span>
            <button
              type="button"
              onClick={() => {
                onChangeRepeaterMode('cycle');
                onAutoBuildRoundSchedule('cycle');
              }}
              className="px-3 py-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-violet-200 text-xs font-bold shrink-0 flex items-center gap-1"
            >
              <Wand2 size={12} />
              <span>Enable Round Repeater</span>
            </button>
          </div>
        ) : (
          <>
            {/* Live Cycle Preview & Auto-Generate Bar */}
            <div className="p-2.5 rounded-lg bg-violet-950/25 border border-violet-500/30 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-violet-300 flex items-center gap-1">
                  <Zap size={12} className="text-amber-400" />
                  Execution Schedule ({maxRounds} Max Rounds):
                </span>
                {Array.from({ length: maxRounds }, (_, i) => {
                  const rNum = i + 1;
                  const mappedPlan =
                    roundSchedule.length > 0
                      ? repeaterMode === 'per_round'
                        ? roundSchedule.find((p) => p.roundNumber === rNum) ||
                          roundSchedule[i % roundSchedule.length]
                        : roundSchedule[i % roundSchedule.length]
                      : null;
                  return (
                    <span
                      key={rNum}
                      className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[10px]"
                    >
                      R{rNum}&rarr;Step{' '}
                      {mappedPlan ? mappedPlan.roundNumber : 1} (
                      {mappedPlan?.slots.length || 2} turns)
                    </span>
                  );
                })}
                <span className="text-[10px] text-emerald-400 font-semibold ml-1">
                  • Auto-skips remaining rounds on consensus
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  onAutoBuildRoundSchedule(
                    repeaterMode === 'per_round' ? 'per_round' : 'cycle'
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-violet-200 text-[11px] font-bold flex items-center gap-1 shrink-0"
                title="Automatically distribute selected subscription engines and specialist roles across rounds"
              >
                <Wand2 size={11} />
                <span>Auto-Distribute Engines &amp; Roles</span>
              </button>
            </div>

            {/* Round Schedule Cards */}
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {roundSchedule.map((plan, roundIdx) => {
                const matchingRounds: number[] = [];
                if (repeaterMode === 'cycle' && roundSchedule.length > 0) {
                  for (let r = 1; r <= maxRounds; r++) {
                    if ((r - 1) % roundSchedule.length === roundIdx) {
                      matchingRounds.push(r);
                    }
                  }
                } else {
                  matchingRounds.push(plan.roundNumber);
                }

                return (
                  <div
                    key={`round-plan-${plan.roundNumber}-${roundIdx}`}
                    className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                      <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                        <span className="px-2 py-0.5 rounded-md bg-violet-500/20 border border-violet-500/40 text-violet-200 font-bold text-[11px] shrink-0">
                          {repeaterMode === 'cycle'
                            ? `Cycle Step ${roundIdx + 1} (Rounds ${matchingRounds.join(', ')})`
                            : `Round ${plan.roundNumber}`}
                        </span>
                        <input
                          type="text"
                          value={plan.title}
                          onChange={(e) =>
                            updateRoundPlan(roundIdx, { title: e.target.value })
                          }
                          placeholder="Round phase title..."
                          className="flex-1 bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs font-bold text-slate-100 focus:outline-none focus:border-violet-400"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAddSlotToRound(roundIdx)}
                          className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sky-300 text-[11px] font-semibold flex items-center gap-1"
                        >
                          <Plus size={11} />
                          <span>Add Agent Turn</span>
                        </button>
                        {roundSchedule.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRoundStep(roundIdx)}
                            className="p-1 text-slate-500 hover:text-rose-400"
                            title="Remove round step"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={plan.objective || ''}
                        onChange={(e) =>
                          updateRoundPlan(roundIdx, { objective: e.target.value })
                        }
                        placeholder="Round focus objective (e.g. 'Architecture decomposition & threat model critique')..."
                        className="w-full bg-slate-900/70 border border-slate-800/80 rounded px-2.5 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-violet-400"
                      />
                    </div>

                    {/* Slots inside this Round */}
                    <div className="space-y-2">
                      {plan.slots.map((slot, slotIdx) => {
                        const p = slot.participant;
                        const matchedRole = allRoles.find(
                          (r) => r.roleKey === p.role || r.name === p.role
                        );
                        const subTier = getSubscriptionTierForAgent(p.providerId);
                        const dynModels = getDynamicModelsForAgent(p.providerId);

                        return (
                          <div
                            key={slot.slotId || `${roundIdx}-${slotIdx}`}
                            className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                                Turn {slotIdx + 1}
                              </span>
                              <input
                                type="color"
                                value={p.avatarColor || '#38bdf8'}
                                onChange={(e) =>
                                  updateSlot(roundIdx, slotIdx, (s) => ({
                                    ...s,
                                    participant: {
                                      ...s.participant,
                                      avatarColor: e.target.value,
                                    },
                                  }))
                                }
                                className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer shrink-0"
                                title="Agent badge color"
                              />
                              <input
                                type="text"
                                value={p.displayName}
                                onChange={(e) =>
                                  updateSlot(roundIdx, slotIdx, (s) => ({
                                    ...s,
                                    participant: {
                                      ...s.participant,
                                      displayName: e.target.value,
                                    },
                                  }))
                                }
                                placeholder="Agent Display Name"
                                className="w-40 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-semibold text-slate-100"
                              />

                              {/* Dynamic Specialist Role Selector */}
                              <select
                                value={matchedRole ? matchedRole.id : 'custom'}
                                onChange={(e) => {
                                  const picked = allRoles.find(
                                    (r) => r.id === e.target.value
                                  );
                                  if (!picked) return;
                                  updateSlot(roundIdx, slotIdx, (s) => ({
                                    ...s,
                                    roundDirective: picked.defaultDirective,
                                    participant: {
                                      ...s.participant,
                                      role: picked.roleKey,
                                      displayName: picked.name,
                                      roleDescription: picked.experienceProfile,
                                      avatarColor: picked.avatarColor,
                                      assignedSkillUris:
                                        picked.assignedSkillUris?.length > 0
                                          ? picked.assignedSkillUris
                                          : s.participant.assignedSkillUris,
                                    },
                                  }));
                                }}
                                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-amber-300 font-semibold"
                                title="Specialist Role & Experience Profile"
                              >
                                {allRoles.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    Role: {r.name}
                                  </option>
                                ))}
                                {!matchedRole && (
                                  <option value="custom">Role: {p.role}</option>
                                )}
                              </select>

                              {/* Dynamic Subscription Engine Selector */}
                              <select
                                value={p.providerId}
                                onChange={(e) => {
                                  const nextProvId = e.target.value;
                                  const foundProv = dynamicProviders.find(
                                    (dp) => dp.id === nextProvId
                                  );
                                  const nextTier =
                                    getSubscriptionTierForAgent(nextProvId);
                                  updateSlot(roundIdx, slotIdx, (s) => ({
                                    ...s,
                                    participant: {
                                      ...s.participant,
                                      providerId: nextProvId,
                                      modelId:
                                        foundProv?.model ||
                                        getDefaultModelForAgent(
                                          nextProvId,
                                          nextTier
                                        ),
                                    },
                                  }));
                                }}
                                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-sky-300 font-semibold flex-1 min-w-[160px]"
                                title="Subscription AI Engine for this turn"
                              >
                                {dynamicProviders.map((dp) => (
                                  <option
                                    key={dp.id}
                                    value={dp.id}
                                    disabled={!dp.available && dp.id !== 'mock'}
                                  >
                                    Engine: {dp.name}{' '}
                                    {dp.available || dp.id === 'mock'
                                      ? `(${dp.model})`
                                      : '(Not connected)'}
                                  </option>
                                ))}
                              </select>

                              {plan.slots.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveSlotFromRound(roundIdx, slotIdx)
                                  }
                                  className="p-1 text-slate-500 hover:text-rose-400"
                                  title="Remove agent turn from round"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>

                            {/* Subscription-Aware Model, Effort & Thinking Picker */}
                            <ModelEffortSideBySidePicker
                              agentId={p.providerId}
                              subscriptionTier={subTier}
                              dynamicModels={dynModels}
                              selectedModel={p.modelId}
                              onChangeModel={(m) =>
                                updateSlot(roundIdx, slotIdx, (s) => ({
                                  ...s,
                                  participant: { ...s.participant, modelId: m },
                                }))
                              }
                              effortLevel={p.effortLevel || 'medium'}
                              onChangeEffortLevel={(eff) =>
                                updateSlot(roundIdx, slotIdx, (s) => ({
                                  ...s,
                                  participant: {
                                    ...s.participant,
                                    effortLevel: eff,
                                  },
                                }))
                              }
                              thinkingEnabled={p.thinkingEnabled ?? true}
                              onToggleThinking={() =>
                                updateSlot(roundIdx, slotIdx, (s) => ({
                                  ...s,
                                  participant: {
                                    ...s.participant,
                                    thinkingEnabled: !(
                                      s.participant.thinkingEnabled ?? true
                                    ),
                                  },
                                }))
                              }
                              compact={true}
                            />

                            {/* Experience Profile & Specific Round Directive */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={p.roleDescription || ''}
                                onChange={(e) =>
                                  updateSlot(roundIdx, slotIdx, (s) => ({
                                    ...s,
                                    participant: {
                                      ...s.participant,
                                      roleDescription: e.target.value,
                                    },
                                  }))
                                }
                                placeholder="Domain experience & skills profile..."
                                className="bg-slate-950 border border-slate-800/80 rounded px-2 py-1 text-[11px] text-slate-300"
                              />
                              <input
                                type="text"
                                value={slot.roundDirective || ''}
                                onChange={(e) =>
                                  updateSlot(roundIdx, slotIdx, (s) => ({
                                    ...s,
                                    roundDirective: e.target.value,
                                  }))
                                }
                                placeholder="Round-specific directive or challenge..."
                                className="bg-slate-950 border border-slate-800/80 rounded px-2 py-1 text-[11px] text-amber-200/90"
                              />
                            </div>

                            {/* Per-Slot Skill Binding Pills if Custom Skills Detected */}
                            {detectedSkills.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                <span className="text-[10px] text-slate-400 flex items-center gap-1 mr-1">
                                  <Layers size={10} className="text-sky-400" />
                                  Skills:
                                </span>
                                {detectedSkills.map((sk) => {
                                  const bound = (
                                    p.assignedSkillUris || []
                                  ).includes(sk.uri);
                                  return (
                                    <button
                                      key={sk.uri}
                                      type="button"
                                      onClick={() =>
                                        updateSlot(roundIdx, slotIdx, (s) => {
                                          const cur =
                                            s.participant.assignedSkillUris ||
                                            [];
                                          const nextUris = cur.includes(sk.uri)
                                            ? cur.filter((u) => u !== sk.uri)
                                            : [...cur, sk.uri];
                                          return {
                                            ...s,
                                            participant: {
                                              ...s.participant,
                                              assignedSkillUris: nextUris,
                                            },
                                          };
                                        })
                                      }
                                      className={`px-1.5 py-0.2 rounded text-[10px] font-mono border ${
                                        bound
                                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                                          : 'bg-slate-950 text-slate-500 border-slate-800'
                                      }`}
                                    >
                                      {bound ? '✓ ' : ''}
                                      {sk.name}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {repeaterMode === 'cycle' && (
              <button
                type="button"
                onClick={handleAddRoundStep}
                className="w-full py-1.5 rounded-lg border border-dashed border-violet-500/40 hover:border-violet-400 text-violet-300 hover:text-violet-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus size={13} />
                <span>Add Specialist Step to Repeater Cycle</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

