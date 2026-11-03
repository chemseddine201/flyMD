import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DiscussionConfig,
  DiscussionParticipant,
  AvailableProviderInfo,
  AgentEffortLevel,
  SkillDescriptor,
  CustomRoleDefinition,
  DebateRepeaterMode,
  DiscussionRoundPlan,
} from '../../../../../../shared/types';
import {
  DeliberationPreset,
  DEFAULT_PRESET_TEMPLATES,
  loadSavedPresets,
  savePresetsToStorage,
} from '../../../../services/deliberationPresetRepository';
import {
  loadAllRoleDefinitions,
  saveUserCustomRoles,
} from '../../../../services/customRoleRepository';
import { DISCUSSION_AVATAR_PALETTE } from '../../../../utils/discussionTextUtils';
import { selectParticipantsById, usePreviewStore, PreviewStoreState } from '../../../../store';
import { useSubscriptionAgents } from '../../../../hooks/useSubscriptionAgents';
import { getDefaultModelForAgent } from '../../../../../../shared/constants/models';

export type NewDebateModeTab = 'preset' | 'repeater' | 'custom';

export interface UseNewDeliberationDraftParams {
  resolvedWorkspace: string;
  availableProviders?: AvailableProviderInfo[];
  startNewDiscussion: (config: DiscussionConfig) => Promise<void>;
}

const PHASE_TITLES = [
  'Discovery, Architecture & Domain Synthesis',
  'Adversarial Red-Team, Risk & Edge-Case Critique',
  'Implementation Blueprint, Trade-Offs & Verification',
  'Security, Performance & Operational Resilience Audit',
];

export function useNewDeliberationDraft({
  resolvedWorkspace,
  startNewDiscussion,
}: UseNewDeliberationDraftParams) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [showCustomRolesModal, setShowCustomRolesModal] = useState(false);
  const setShowAgentAccountsModal = usePreviewStore(
    (s: PreviewStoreState) => s.setShowAgentAccountsModal
  );

  // Live subscription-aware dynamic agent & model discovery
  const {
    dynamicProviders,
    activeSubscriptionProviders,
    providersById,
    preferredDefaultAgentId,
    isRefreshing: isRefreshingSubscriptions,
    refreshSubscriptionAgents,
    getSubscriptionTierForAgent,
    getDynamicModelsForAgent,
  } = useSubscriptionAgents(true);

  // Presets & Custom Actions Management State
  const [presets, setPresets] = useState<DeliberationPreset[]>(loadSavedPresets);
  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    const first = loadSavedPresets().find((p) => p.enabled);
    return first ? first.id : 'architecture';
  });
  const [editingPreset, setEditingPreset] = useState<DeliberationPreset | null>(
    null
  );
  const [isCreatingNewPreset, setIsCreatingNewPreset] = useState(false);

  // Specialist Roles Library (Built-in + Unlimited User Custom Roles)
  const [allRoles, setAllRoles] = useState<CustomRoleDefinition[]>(
    loadAllRoleDefinitions
  );

  // New discussion configuration state
  const [newTopic, setNewTopic] = useState('');
  const [newIdea, setNewIdea] = useState('');
  const [newObjective, setNewObjective] = useState('');
  const [maxRounds, setMaxRounds] = useState(4);
  const [maxRoundsInput, setMaxRoundsInput] = useState<string>('4');
  const [turnTimeoutSecs, setTurnTimeoutSecs] = useState(120);
  const [turnTimeoutInput, setTurnTimeoutInput] = useState<string>('120');
  const [newDebateMode, setNewDebateMode] =
    useState<NewDebateModeTab>('preset');

  const [presetEngine, setPresetEngine] = useState<string>('');
  const [selectedEngines, setSelectedEngines] = useState<string[]>([]);
  const hasUserCustomizedEngines = useRef(false);

  const [repeaterMode, setRepeaterMode] = useState<DebateRepeaterMode>('off');
  const [roundSchedule, setRoundSchedule] = useState<DiscussionRoundPlan[]>([]);

  const [presetEffortLevel, setPresetEffortLevel] =
    useState<AgentEffortLevel>('medium');
  const [presetThinkingEnabled, setPresetThinkingEnabled] =
    useState<boolean>(true);
  const [enableStepModeInNew, setEnableStepModeInNew] = useState(false);
  const [customSkillsDir, setCustomSkillsDir] = useState<string>('');
  const [includeDefaultSkills, setIncludeDefaultSkills] =
    useState<boolean>(true);
  const [detectedSkills, setDetectedSkills] = useState<SkillDescriptor[]>([]);
  const [isScanningSkills, setIsScanningSkills] = useState<boolean>(false);
  const [tokenBudgetCapInput, setTokenBudgetCapInput] =
    useState<string>('50000');

  // Re-fetch live subscription agents every time the modal opens
  useEffect(() => {
    if (showNewModal) {
      refreshSubscriptionAgents();
    }
  }, [showNewModal, refreshSubscriptionAgents]);

  // Synchronize default engine(s) with the user's real connected subscriptions
  useEffect(() => {
    if (!presetEngine && preferredDefaultAgentId) {
      setPresetEngine(preferredDefaultAgentId);
    }
    if (!hasUserCustomizedEngines.current) {
      if (activeSubscriptionProviders.length > 0) {
        setSelectedEngines(activeSubscriptionProviders.map((p) => p.id));
      } else if (preferredDefaultAgentId) {
        setSelectedEngines([preferredDefaultAgentId]);
      }
    }
  }, [activeSubscriptionProviders, preferredDefaultAgentId, presetEngine]);

  const handleToggleSelectedEngine = useCallback((engineId: string) => {
    hasUserCustomizedEngines.current = true;
    setSelectedEngines((prev) => {
      if (prev.includes(engineId)) {
        return prev.length <= 1 ? prev : prev.filter((id) => id !== engineId);
      }
      return [...prev, engineId];
    });
  }, []);

  const handleSelectAllReadyEngines = useCallback(() => {
    hasUserCustomizedEngines.current = true;
    if (activeSubscriptionProviders.length > 0) {
      setSelectedEngines(activeSubscriptionProviders.map((p) => p.id));
    } else {
      setSelectedEngines([preferredDefaultAgentId || 'mock']);
    }
  }, [activeSubscriptionProviders, preferredDefaultAgentId]);

  const handleCreateCustomRole = useCallback(
    (roleInput: Omit<CustomRoleDefinition, 'id' | 'isBuiltIn'>) => {
      const created: CustomRoleDefinition = {
        ...roleInput,
        id: `custom-role-${Date.now()}`,
        isBuiltIn: false,
      };
      setAllRoles((prev) => {
        const next = [...prev, created];
        saveUserCustomRoles(next);
        return next;
      });
    },
    []
  );

  const handleDeleteCustomRole = useCallback((roleId: string) => {
    setAllRoles((prev) => {
      const next = prev.filter((r) => r.isBuiltIn || r.id !== roleId);
      saveUserCustomRoles(next);
      return next;
    });
  }, []);

  const buildRoundPlans = useCallback(
    (
      count: number,
      engines: string[],
      roles: CustomRoleDefinition[]
    ): DiscussionRoundPlan[] => {
      const pool =
        engines.length > 0 ? engines : [preferredDefaultAgentId || 'mock'];
      const rolePool =
        roles.length > 0 ? roles : loadAllRoleDefinitions();

      const plans: DiscussionRoundPlan[] = [];
      let cursor = 0;

      for (let r = 1; r <= count; r++) {
        const phaseTitle =
          PHASE_TITLES[(r - 1) % PHASE_TITLES.length];
        const slotsCount = Math.min(Math.max(2, pool.length), 3);
        const slots = Array.from({ length: slotsCount }, (_, sIdx) => {
          const engId = pool[cursor % pool.length];
          const roleDef = rolePool[cursor % rolePool.length];
          cursor += 1;

          const tier = getSubscriptionTierForAgent(engId);
          const prov = providersById.get(engId);
          const resolvedModel =
            prov?.model || getDefaultModelForAgent(engId, tier);

          return {
            slotId: `slot-r${r}-${sIdx + 1}-${Date.now() + cursor}`,
            roundDirective: roleDef.defaultDirective,
            participant: {
              agentId: `round${r}-slot${sIdx + 1}-${roleDef.id}`,
              providerId: engId,
              modelId: resolvedModel,
              displayName: roleDef.name,
              role: roleDef.roleKey,
              roleDescription: roleDef.experienceProfile,
              avatarColor: roleDef.avatarColor,
              assignedSkillUris: roleDef.assignedSkillUris || [],
              contextBudgetTokens: 24000,
              thinkingEnabled: presetThinkingEnabled,
              effortLevel: presetEffortLevel,
            },
          };
        });

        plans.push({
          roundNumber: r,
          title: `Round ${r}: ${phaseTitle}`,
          objective:
            'Apply specialized role experience, challenge peer assumptions, and converge when consensus is verified.',
          slots,
        });
      }

      return plans;
    },
    [
      preferredDefaultAgentId,
      getSubscriptionTierForAgent,
      providersById,
      presetThinkingEnabled,
      presetEffortLevel,
    ]
  );

  const handleAutoBuildRoundSchedule = useCallback(
    (targetMode?: 'cycle' | 'per_round') => {
      const modeToBuild =
        targetMode || (repeaterMode === 'per_round' ? 'per_round' : 'cycle');
      const effectiveMax = Math.min(
        10,
        Math.max(1, parseInt(maxRoundsInput, 10) || maxRounds || 3)
      );
      const count =
        modeToBuild === 'per_round'
          ? effectiveMax
          : Math.min(effectiveMax, Math.max(2, Math.min(3, selectedEngines.length || 2)));
      setRoundSchedule(buildRoundPlans(count, selectedEngines, allRoles));
    },
    [
      repeaterMode,
      maxRoundsInput,
      maxRounds,
      selectedEngines,
      buildRoundPlans,
      allRoles,
    ]
  );

  // Keep per_round schedule length aligned when user changes maxRounds
  useEffect(() => {
    if (repeaterMode !== 'per_round') return;
    const targetLen = Math.min(10, Math.max(1, maxRounds));
    setRoundSchedule((prev) => {
      if (prev.length === targetLen) return prev;
      if (prev.length > targetLen) return prev.slice(0, targetLen);
      const extra = buildRoundPlans(
        targetLen - prev.length,
        selectedEngines,
        allRoles
      ).map((p, idx) => ({
        ...p,
        roundNumber: prev.length + idx + 1,
        title: `Round ${prev.length + idx + 1}: ${
          PHASE_TITLES[(prev.length + idx) % PHASE_TITLES.length]
        }`,
      }));
      return [...prev, ...extra];
    });
  }, [repeaterMode, maxRounds, buildRoundPlans, selectedEngines, allRoles]);

  const handleBrowseSkillsDir = useCallback(async () => {
    if (window.electronAPI?.openFolderDialog) {
      const selected = await window.electronAPI.openFolderDialog();
      if (selected) {
        setCustomSkillsDir(selected);
        setIsScanningSkills(true);
        try {
          if (window.electronAPI.scanCustomSkillsDir) {
            const skills = await window.electronAPI.scanCustomSkillsDir(selected);
            setDetectedSkills(skills || []);
          }
        } finally {
          setIsScanningSkills(false);
        }
      }
    }
  }, []);

  const handleSkillsDirChange = useCallback(async (dirPath: string) => {
    setCustomSkillsDir(dirPath);
    if (!dirPath.trim()) {
      setDetectedSkills([]);
      return;
    }
    if (window.electronAPI?.scanCustomSkillsDir) {
      try {
        const skills = await window.electronAPI.scanCustomSkillsDir(
          dirPath.trim()
        );
        setDetectedSkills(skills || []);
      } catch {
        setDetectedSkills([]);
      }
    }
  }, []);

  const [customParticipants, setCustomParticipants] = useState<
    DiscussionParticipant[]
  >(
    () =>
      (
        loadSavedPresets().find((p) => p.id === 'architecture') ||
        loadSavedPresets()[0]
      ).participants
  );

  const presetsById = useMemo(() => {
    const map = new Map<string, DeliberationPreset>();
    for (const p of presets) {
      map.set(p.id, p);
    }
    return map;
  }, [presets]);

  const customParticipantsById = selectParticipantsById(customParticipants);

  const savePresets = useCallback((updated: DeliberationPreset[]) => {
    setPresets(updated);
    savePresetsToStorage(updated);
  }, []);

  const handleSelectPreset = useCallback(
    (key: string) => {
      setSelectedPreset(key);
      const found = presetsById.get(key);
      if (found) {
        setCustomParticipants(found.participants);
      }
    },
    [presetsById]
  );

  const handleTogglePresetEnabled = useCallback(
    (id: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      const updated = presets.map((p) =>
        p.id === id ? { ...p, enabled: !p.enabled } : p
      );
      savePresets(updated);
      if (selectedPreset === id) {
        const fallback = updated.find((p) => p.enabled) || updated[0];
        if (fallback) {
          setSelectedPreset(fallback.id);
          setCustomParticipants(fallback.participants);
        }
      }
    },
    [presets, savePresets, selectedPreset]
  );

  const handleStartEditPreset = useCallback(
    (preset: DeliberationPreset, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      setIsCreatingNewPreset(false);
      setEditingPreset(JSON.parse(JSON.stringify(preset)));
      setShowCustomRolesModal(true);
    },
    []
  );

  const handleStartCreatePreset = useCallback(() => {
    const defaultEng = preferredDefaultAgentId || 'mock';
    const defaultTier = getSubscriptionTierForAgent(defaultEng);
    const defaultModel =
      providersById.get(defaultEng)?.model ||
      getDefaultModelForAgent(defaultEng, defaultTier);
    const secondEng =
      selectedEngines.find((id) => id !== defaultEng) || defaultEng;
    const secondTier = getSubscriptionTierForAgent(secondEng);
    const secondModel =
      providersById.get(secondEng)?.model ||
      getDefaultModelForAgent(secondEng, secondTier);

    const newId = `preset-${Date.now()}`;
    const newPreset: DeliberationPreset = {
      id: newId,
      name: 'Custom Domain Action Deliberation',
      description:
        'Domain-specific deliberation team with custom roles and inquiry directives.',
      enabled: true,
      isBuiltIn: false,
      participants: [
        {
          agentId: `agent-lead-${Date.now()}`,
          providerId: defaultEng,
          modelId: defaultModel,
          displayName: 'Domain Architect',
          role: 'architect',
          roleDescription:
            'Primary domain specialist proposing architecture and requirements.',
          avatarColor: '#38bdf8',
          assignedSkillUris: [],
          contextBudgetTokens: 32000,
          customAction: {
            id: `action-${Date.now()}-1`,
            name: 'Domain Invariant Decomposition',
            description: 'Decompose core domain logic',
            promptDirective:
              'Decompose the domain model, invariants, and edge cases for this topic.',
          },
        },
        {
          agentId: `agent-critic-${Date.now()}`,
          providerId: secondEng,
          modelId: secondModel,
          displayName: 'Adversarial Critic',
          role: 'critic',
          roleDescription:
            'Challenge assumptions, find single points of failure, and expose bottlenecks.',
          avatarColor: '#ef4444',
          assignedSkillUris: [],
          contextBudgetTokens: 32000,
          customAction: {
            id: `action-${Date.now()}-2`,
            name: 'Adversarial Challenge',
            description: 'Stress test failure modes',
            promptDirective:
              'Challenge all unstated assumptions, bottlenecks, and error recovery strategies.',
          },
        },
      ],
    };
    setIsCreatingNewPreset(true);
    setEditingPreset(newPreset);
    setShowCustomRolesModal(true);
  }, [
    preferredDefaultAgentId,
    getSubscriptionTierForAgent,
    providersById,
    selectedEngines,
  ]);

  const handleSaveEditingPreset = useCallback(() => {
    if (!editingPreset) return;
    const exists = presetsById.has(editingPreset.id);
    const updated = exists
      ? presets.map((p) => (p.id === editingPreset.id ? editingPreset : p))
      : [...presets, editingPreset];
    savePresets(updated);
    setSelectedPreset(editingPreset.id);
    setCustomParticipants(editingPreset.participants);
    setEditingPreset(null);
    setIsCreatingNewPreset(false);
  }, [editingPreset, presetsById, presets, savePresets]);

  const handleDeletePreset = useCallback(
    (id: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      if (presets.length <= 1) return;
      const updated = presets.filter((p) => p.id !== id);
      savePresets(updated);
      if (selectedPreset === id) {
        const fallback = updated.find((p) => p.enabled) || updated[0];
        if (fallback) {
          setSelectedPreset(fallback.id);
          setCustomParticipants(fallback.participants);
        }
      }
    },
    [presets, savePresets, selectedPreset]
  );

  const handleDuplicatePreset = useCallback(
    (preset: DeliberationPreset, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      const cloned: DeliberationPreset = {
        ...JSON.parse(JSON.stringify(preset)),
        id: `preset-${Date.now()}`,
        name: `${preset.name} (Custom Copy)`,
        isBuiltIn: false,
        enabled: true,
      };
      savePresets([...presets, cloned]);
    },
    [presets, savePresets]
  );

  const handleResetPresetsToDefaults = useCallback(() => {
    savePresets(DEFAULT_PRESET_TEMPLATES);
    setSelectedPreset('architecture');
    setCustomParticipants(DEFAULT_PRESET_TEMPLATES[0].participants);
    setEditingPreset(null);
  }, [savePresets]);

  const handleAddParticipant = useCallback(() => {
    setCustomParticipants((prev) => {
      const nextIdx = prev.length + 1;
      const color =
        DISCUSSION_AVATAR_PALETTE[
          (nextIdx - 1) % DISCUSSION_AVATAR_PALETTE.length
        ];
      const enginePool =
        selectedEngines.length > 0
          ? selectedEngines
          : [preferredDefaultAgentId || 'mock'];
      const chosenProvider = enginePool[(nextIdx - 1) % enginePool.length];
      const tier = getSubscriptionTierForAgent(chosenProvider);
      const modelId =
        providersById.get(chosenProvider)?.model ||
        getDefaultModelForAgent(chosenProvider, tier);
      const roleDef = allRoles[(nextIdx - 1) % allRoles.length];

      const newAgent: DiscussionParticipant = {
        agentId: `agent-custom-${Date.now()}`,
        providerId: chosenProvider,
        modelId,
        displayName: roleDef?.name || `Expert Agent ${nextIdx}`,
        role: roleDef?.roleKey || 'critic',
        roleDescription:
          roleDef?.experienceProfile ||
          'Provide specialized domain analysis and technical critique.',
        avatarColor: roleDef?.avatarColor || color,
        assignedSkillUris: roleDef?.assignedSkillUris || [],
        contextBudgetTokens: 16000,
        thinkingEnabled: true,
        effortLevel: presetEffortLevel,
      };
      return [...prev, newAgent];
    });
  }, [
    selectedEngines,
    preferredDefaultAgentId,
    getSubscriptionTierForAgent,
    providersById,
    allRoles,
    presetEffortLevel,
  ]);

  const handleUpdateParticipant = useCallback(
    (index: number, updates: Partial<DiscussionParticipant>) => {
      setCustomParticipants((prev) => {
        const copy = [...prev];
        copy[index] = { ...copy[index], ...updates };
        return copy;
      });
    },
    []
  );

  const handleRemoveParticipant = useCallback((index: number) => {
    setCustomParticipants((prev) =>
      prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)
    );
  }, []);

  const handleOpenManageAccounts = useCallback(() => {
    setShowNewModal(false);
    setShowAgentAccountsModal(true);
  }, [setShowAgentAccountsModal]);

  const isTopicValid = newTopic.trim().length > 0;
  const isIdeaValid = newIdea.trim().length > 0;
  const isFormValid = isTopicValid && isIdeaValid;

  const handleLaunchNewDiscussion = useCallback(async () => {
    const trimmedTopic = newTopic.trim();
    const trimmedIdea = newIdea.trim();
    if (!resolvedWorkspace || !trimmedTopic || !trimmedIdea) {
      return;
    }
    const sessionId = `disc-${Date.now()}`;
    const topicToUse = trimmedTopic;
    const ideaToUse = trimmedIdea;

    const currentPreset =
      presetsById.get(selectedPreset) ||
      presets[0] ||
      DEFAULT_PRESET_TEMPLATES[0];

    const activeEnginePool =
      selectedEngines.length > 0
        ? selectedEngines
        : [presetEngine || preferredDefaultAgentId || 'mock'];

    // In Multi-Agent Round Repeater: max rounds = round schedule length.
    // In Custom Team: max rounds = custom participants length (1 dedicated round per agent).
    // In Preset Team: max rounds = preset participants length (1 dedicated round per agent).
    const effectiveRepeaterMode: DebateRepeaterMode =
      newDebateMode === 'repeater' ? repeaterMode : 'per_agent';
    const useRepeaterSchedule =
      newDebateMode === 'repeater' && effectiveRepeaterMode !== 'off';

    const effectiveMaxRounds =
      newDebateMode === 'repeater' && useRepeaterSchedule
        ? roundSchedule.length > 0
          ? roundSchedule.length
          : Math.min(10, Math.max(1, selectedEngines.length || 3))
        : newDebateMode === 'custom'
        ? Math.max(1, customParticipants.length)
        : Math.max(1, currentPreset.participants.length);

    let finalRoundSchedule: DiscussionRoundPlan[] | undefined;
    if (useRepeaterSchedule) {
      const sourceSchedule =
        roundSchedule.length > 0
          ? roundSchedule
          : buildRoundPlans(
              effectiveMaxRounds,
              activeEnginePool,
              allRoles
            );

      finalRoundSchedule = sourceSchedule.map((plan, pIdx) => ({
        ...plan,
        roundNumber: plan.roundNumber || pIdx + 1,
        title:
          plan.title?.trim() ||
          `Round ${pIdx + 1}: ${PHASE_TITLES[pIdx % PHASE_TITLES.length]}`,
        slots: plan.slots.map((slot, sIdx) => {
          const sp = slot.participant;
          const tier = getSubscriptionTierForAgent(sp.providerId);
          const resolvedModel =
            sp.modelId ||
            providersById.get(sp.providerId)?.model ||
            getDefaultModelForAgent(sp.providerId, tier);
          return {
            ...slot,
            slotId: slot.slotId || `slot-r${pIdx + 1}-${sIdx + 1}`,
            participant: {
              ...sp,
              agentId:
                sp.agentId?.trim() || `round-${pIdx + 1}-agent-${sIdx + 1}`,
              displayName:
                sp.displayName?.trim() || `Specialist ${sIdx + 1}`,
              role: sp.role || 'critic',
              modelId: resolvedModel,
              roleDescription:
                sp.roleDescription?.trim() ||
                'Provide specialized domain experience, rigorous critique, and actionable synthesis.',
              contextBudgetTokens: sp.contextBudgetTokens || 24000,
              effortLevel: sp.effortLevel || presetEffortLevel || 'medium',
              thinkingEnabled:
                sp.thinkingEnabled ?? presetThinkingEnabled ?? true,
            },
          };
        }),
      }));
    }

    let participants =
      newDebateMode === 'preset' || newDebateMode === 'repeater'
        ? currentPreset.participants
        : customParticipants;

    if (finalRoundSchedule && finalRoundSchedule.length > 0) {
      // Populate base participants from scheduled slots so metadata & sidebars reflect the scheduled team
      const seen = new Set<string>();
      const collected: DiscussionParticipant[] = [];
      for (const plan of finalRoundSchedule) {
        for (const slot of plan.slots) {
          const key = `${slot.participant.displayName}::${slot.participant.providerId}`;
          if (!seen.has(key)) {
            seen.add(key);
            collected.push(slot.participant);
          }
        }
      }
      if (collected.length >= 2) {
        participants = collected;
      }
    } else if (newDebateMode === 'preset' || newDebateMode === 'repeater') {
      // Multi-engine preset support: rotate every selected subscription engine across the preset team
      const poolToDistribute = activeEnginePool;

      participants = participants.map((p, idx) => {
        const assignedEngine = poolToDistribute[idx % poolToDistribute.length];
        if (assignedEngine === 'mock') {
          return {
            ...p,
            providerId: 'mock',
            modelId: p.modelId || 'adaptive-domain-simulator',
            thinkingEnabled: presetThinkingEnabled,
            effortLevel: presetEffortLevel,
          };
        }
        const matched = providersById.get(assignedEngine);
        const tier = getSubscriptionTierForAgent(assignedEngine);
        return {
          ...p,
          providerId: assignedEngine,
          modelId:
            matched?.model ||
            getDefaultModelForAgent(assignedEngine, tier) ||
            p.modelId,
          thinkingEnabled: presetThinkingEnabled,
          effortLevel: presetEffortLevel,
        };
      });
    } else {
      // Ensure custom participants with legacy 'mock' fallback upgrade to real provider if untouched
      participants = participants.map((p) => {
        const matched = providersById.get(p.providerId);
        const tier = getSubscriptionTierForAgent(p.providerId);
        return {
          ...p,
          modelId:
            p.modelId && p.modelId !== 'custom-expert-v1'
              ? p.modelId
              : matched?.model || getDefaultModelForAgent(p.providerId, tier),
        };
      });
    }

    const sanitizedParticipants = participants.map((p, idx) => ({
      ...p,
      displayName: p.displayName?.trim() || `Specialist Agent ${idx + 1}`,
      role: p.role || 'critic',
      roleDescription:
        p.roleDescription?.trim() ||
        'Provide specialized domain analysis, critical perspectives, and actionable recommendations.',
      customQuery:
        p.customQuery?.trim() ||
        'Analyze the topic for strategic soundness, feasibility, evidence quality, and potential risks.',
      contextBudgetTokens: p.contextBudgetTokens || 16000,
      effortLevel: p.effortLevel || presetEffortLevel || 'medium',
      thinkingEnabled: p.thinkingEnabled ?? presetThinkingEnabled ?? true,
    }));

    const config: DiscussionConfig = {
      schemaVersion: 1,
      sessionId,
      topic: topicToUse,
      userIdea: ideaToUse,
      workspacePath: resolvedWorkspace,
      maxRounds: effectiveMaxRounds,
      turnTimeoutSecs: Math.min(
        600,
        Math.max(15, parseInt(turnTimeoutInput, 10) || turnTimeoutSecs || 120)
      ),
      participants: sanitizedParticipants,
      activeSkillUris: detectedSkills.map((s) => s.uri),
      stepMode: enableStepModeInNew,
      customSkillsDir: customSkillsDir.trim() || undefined,
      includeDefaultSkills,
      tokenBudgetCap:
        !isNaN(parseInt(tokenBudgetCapInput, 10)) &&
        parseInt(tokenBudgetCapInput, 10) > 0
          ? parseInt(tokenBudgetCapInput, 10)
          : undefined,
      selectedEngines: activeEnginePool,
      repeaterMode: effectiveRepeaterMode,
      roundSchedule: finalRoundSchedule,
    };

    setShowNewModal(false);
    await startNewDiscussion(config);
  }, [
    resolvedWorkspace,
    newTopic,
    newIdea,
    newObjective,
    maxRoundsInput,
    maxRounds,
    presetsById,
    selectedPreset,
    presets,
    selectedEngines,
    presetEngine,
    preferredDefaultAgentId,
    repeaterMode,
    newDebateMode,
    roundSchedule,
    buildRoundPlans,
    allRoles,
    customParticipants,
    getSubscriptionTierForAgent,
    providersById,
    presetEffortLevel,
    presetThinkingEnabled,
    turnTimeoutInput,
    turnTimeoutSecs,
    detectedSkills,
    enableStepModeInNew,
    customSkillsDir,
    includeDefaultSkills,
    tokenBudgetCapInput,
    startNewDiscussion,
  ]);

  return {
    showNewModal,
    setShowNewModal,
    presets,
    selectedPreset,
    editingPreset,
    setEditingPreset,
    isCreatingNewPreset,
    newTopic,
    setNewTopic,
    newIdea,
    setNewIdea,
    newObjective,
    setNewObjective,
    isTopicValid,
    isIdeaValid,
    isFormValid,
    maxRounds,
    maxRoundsInput,
    setMaxRoundsInput,
    setMaxRounds,
    turnTimeoutInput,
    setTurnTimeoutInput,
    setTurnTimeoutSecs,
    newDebateMode,
    setNewDebateMode,
    presetEngine,
    setPresetEngine,
    selectedEngines,
    handleToggleSelectedEngine,
    handleSelectAllReadyEngines,
    repeaterMode,
    setRepeaterMode,
    roundSchedule,
    setRoundSchedule,
    handleAutoBuildRoundSchedule,
    allRoles,
    handleCreateCustomRole,
    handleDeleteCustomRole,
    dynamicProviders,
    isRefreshingSubscriptions,
    refreshSubscriptionAgents,
    getSubscriptionTierForAgent,
    getDynamicModelsForAgent,
    handleOpenManageAccounts,
    presetEffortLevel,
    setPresetEffortLevel,
    presetThinkingEnabled,
    setPresetThinkingEnabled,
    enableStepModeInNew,
    setEnableStepModeInNew,
    customSkillsDir,
    setCustomSkillsDir,
    includeDefaultSkills,
    setIncludeDefaultSkills,
    tokenBudgetCapInput,
    setTokenBudgetCapInput,
    detectedSkills,
    isScanningSkills,
    handleBrowseSkillsDir,
    handleSkillsDirChange,
    customParticipants,
    customParticipantsById,
    handleSelectPreset,
    handleTogglePresetEnabled,
    handleStartEditPreset,
    handleStartCreatePreset,
    handleSaveEditingPreset,
    handleDeletePreset,
    handleDuplicatePreset,
    handleResetPresetsToDefaults,
    handleAddParticipant,
    handleUpdateParticipant,
    handleRemoveParticipant,
    handleLaunchNewDiscussion,
    showCustomRolesModal,
    setShowCustomRolesModal,
  };
}
