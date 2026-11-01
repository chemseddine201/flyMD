import React, { useCallback, useMemo, useState } from 'react';
import {
  DiscussionConfig,
  DiscussionParticipant,
  AvailableProviderInfo,
  AgentEffortLevel,
} from '../../../../../../shared/types';
import {
  DeliberationPreset,
  DEFAULT_PRESET_TEMPLATES,
  loadSavedPresets,
  savePresetsToStorage,
} from '../../../../services/deliberationPresetRepository';
import { DISCUSSION_AVATAR_PALETTE } from '../../../../utils/discussionTextUtils';
import { selectParticipantsById } from '../../../../store';

export interface UseNewDeliberationDraftParams {
  resolvedWorkspace: string;
  availableProviders: AvailableProviderInfo[];
  startNewDiscussion: (config: DiscussionConfig) => Promise<void>;
}

export function useNewDeliberationDraft({
  resolvedWorkspace,
  availableProviders,
  startNewDiscussion,
}: UseNewDeliberationDraftParams) {
  const [showNewModal, setShowNewModal] = useState(false);

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

  // New discussion configuration state
  const [newTopic, setNewTopic] = useState('');
  const [newIdea, setNewIdea] = useState('');
  const [maxRounds, setMaxRounds] = useState(3);
  const [maxRoundsInput, setMaxRoundsInput] = useState<string>('3');
  const [turnTimeoutSecs, setTurnTimeoutSecs] = useState(120);
  const [turnTimeoutInput, setTurnTimeoutInput] = useState<string>('120');
  const [newDebateMode, setNewDebateMode] = useState<
    'preset' | 'actions' | 'custom'
  >('preset');
  const [presetEngine, setPresetEngine] = useState<string>('mock');
  const [presetEffortLevel, setPresetEffortLevel] =
    useState<AgentEffortLevel>('medium');
  const [presetThinkingEnabled, setPresetThinkingEnabled] =
    useState<boolean>(true);
  const [enableStepModeInNew, setEnableStepModeInNew] = useState(false);
  const [customParticipants, setCustomParticipants] = useState<
    DiscussionParticipant[]
  >(
    () =>
      (
        loadSavedPresets().find((p) => p.id === 'architecture') ||
        loadSavedPresets()[0]
      ).participants
  );

  // O(1) lookup maps for presets, providers, and configured participants
  const presetsById = useMemo(() => {
    const map = new Map<string, DeliberationPreset>();
    for (const p of presets) {
      map.set(p.id, p);
    }
    return map;
  }, [presets]);

  const providersById = useMemo(() => {
    const map = new Map<string, AvailableProviderInfo>();
    for (const ap of availableProviders) {
      map.set(ap.id, ap);
    }
    return map;
  }, [availableProviders]);

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
      setNewDebateMode('actions');
    },
    []
  );

  const handleStartCreatePreset = useCallback(() => {
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
          providerId: 'mock',
          modelId: 'custom-expert-v1',
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
          providerId: 'mock',
          modelId: 'custom-critic-v1',
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
    setNewDebateMode('actions');
  }, []);

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
      const newAgent: DiscussionParticipant = {
        agentId: `agent-custom-${Date.now()}`,
        providerId: 'mock',
        modelId: 'custom-expert-v1',
        displayName: `Expert Agent ${nextIdx}`,
        role: 'critic',
        roleDescription:
          'Provide specialized domain analysis and technical critique.',
        avatarColor: color,
        assignedSkillUris: [],
        contextBudgetTokens: 16000,
        thinkingEnabled: true,
      };
      return [...prev, newAgent];
    });
  }, []);

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

  const handleLaunchNewDiscussion = useCallback(async () => {
    if (!resolvedWorkspace) return;
    const sessionId = `disc-${Date.now()}`;
    const topicToUse = newTopic.trim() || 'Multi-Agent Deliberation';
    const ideaToUse =
      newIdea.trim() ||
      `In-depth multi-perspective evaluation and decision analysis for: ${topicToUse}`;

    const currentPreset =
      presetsById.get(selectedPreset) ||
      presets[0] ||
      DEFAULT_PRESET_TEMPLATES[0];
    let participants =
      newDebateMode === 'preset'
        ? currentPreset.participants
        : customParticipants;

    if (newDebateMode === 'preset') {
      let targetProvider = presetEngine;
      if (presetEngine === 'auto') {
        const best = availableProviders.find(
          (ap) => ap.available && ap.id !== 'mock'
        );
        targetProvider = best ? best.id : 'mock';
      }

      const matched = providersById.get(targetProvider);
      participants = participants.map((p) => {
        if (targetProvider === 'mock') {
          return {
            ...p,
            providerId: 'mock',
            modelId: p.modelId || 'adaptive-domain-simulator',
            thinkingEnabled: presetThinkingEnabled,
            effortLevel: presetEffortLevel,
          };
        }
        return {
          ...p,
          providerId: targetProvider,
          modelId: matched?.model || p.modelId,
          thinkingEnabled: presetThinkingEnabled,
          effortLevel: presetEffortLevel,
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
      maxRounds: Math.min(
        10,
        Math.max(1, parseInt(maxRoundsInput, 10) || maxRounds || 3)
      ),
      turnTimeoutSecs: Math.min(
        600,
        Math.max(15, parseInt(turnTimeoutInput, 10) || turnTimeoutSecs || 120)
      ),
      participants: sanitizedParticipants,
      activeSkillUris: [],
      stepMode: enableStepModeInNew,
    };

    setShowNewModal(false);
    await startNewDiscussion(config);
  }, [
    resolvedWorkspace,
    newTopic,
    newIdea,
    presetsById,
    selectedPreset,
    presets,
    newDebateMode,
    customParticipants,
    presetEngine,
    availableProviders,
    providersById,
    presetThinkingEnabled,
    presetEffortLevel,
    maxRoundsInput,
    maxRounds,
    turnTimeoutInput,
    turnTimeoutSecs,
    enableStepModeInNew,
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
    presetEffortLevel,
    setPresetEffortLevel,
    presetThinkingEnabled,
    setPresetThinkingEnabled,
    enableStepModeInNew,
    setEnableStepModeInNew,
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
  };
}

