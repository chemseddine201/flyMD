import React, { useEffect, useMemo, useState } from 'react';
import { Brain, Cpu, Sparkles, Zap, ChevronDown, RefreshCw, X } from 'lucide-react';
import { AgentEffortLevel } from '../../../../../shared/types';
import {
  EFFORT_DESCRIPTIONS,
  fetchAndCacheAgentModels,
  getAvailableModelsForAgent,
  getDefaultModelForAgent,
  isReasoningModel,
  ModelCatalogEntry,
  normalizeModelForAgent,
} from '../../../../../shared/constants/models';

export interface ModelEffortSideBySidePickerProps {
  agentId: string;
  selectedModel?: string;
  onChangeModel: (model: string) => void;
  effortLevel?: AgentEffortLevel;
  onChangeEffortLevel: (effort: AgentEffortLevel) => void;
  thinkingEnabled?: boolean;
  onToggleThinking?: () => void;
  subscriptionTier?: string;
  dynamicModels?: string[];
  compact?: boolean;
  disabled?: boolean;
  className?: string;
}

export const ModelEffortSideBySidePicker: React.FC<ModelEffortSideBySidePickerProps> = ({
  agentId,
  selectedModel,
  onChangeModel,
  effortLevel = 'medium',
  onChangeEffortLevel,
  thinkingEnabled = true,
  onToggleThinking,
  subscriptionTier,
  dynamicModels,
  compact = false,
  disabled = false,
  className = '',
}) => {
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [customInputVal, setCustomInputVal] = useState<string>(selectedModel || '');
  const [isFetchingModels, setIsFetchingModels] = useState<boolean>(false);
  const [fetchRevision, setFetchRevision] = useState<number>(0);

  const availableModels: ModelCatalogEntry[] = useMemo(() => {
    return getAvailableModelsForAgent(agentId, subscriptionTier, dynamicModels);
  }, [agentId, subscriptionTier, dynamicModels, fetchRevision]);

  const effectiveModel = useMemo(() => {
    return normalizeModelForAgent(agentId, selectedModel, subscriptionTier);
  }, [selectedModel, agentId, subscriptionTier, fetchRevision]);

  const activeModelEntry = useMemo(() => {
    return (
      availableModels.find((m) => m.id.toLowerCase() === effectiveModel.toLowerCase()) ||
      availableModels[0]
    );
  }, [availableModels, effectiveModel]);

  const supportedEfforts: AgentEffortLevel[] = useMemo(() => {
    if (activeModelEntry?.supportedEffortLevels && activeModelEntry.supportedEffortLevels.length > 0) {
      return activeModelEntry.supportedEffortLevels;
    }
    return ['low', 'medium', 'high'];
  }, [activeModelEntry]);

  useEffect(() => {
    if (selectedModel && selectedModel.trim().length > 0) {
      const normalized = normalizeModelForAgent(agentId, selectedModel, subscriptionTier);
      setCustomInputVal(normalized);
      if (normalized !== selectedModel.trim()) {
        onChangeModel(normalized);
      }
    }
  }, [selectedModel, agentId, subscriptionTier]);

  useEffect(() => {
    if (supportedEfforts.length > 0 && !supportedEfforts.includes(effortLevel)) {
      const fallback = activeModelEntry?.defaultEffortLevel && supportedEfforts.includes(activeModelEntry.defaultEffortLevel)
        ? activeModelEntry.defaultEffortLevel
        : supportedEfforts[supportedEfforts.length - 1];
      onChangeEffortLevel(fallback);
    }
  }, [supportedEfforts, effortLevel, activeModelEntry]);

  const [fetchError, setFetchError] = useState<string | null>(null);

  const handleFetchModels = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isFetchingModels) return;
    setIsFetchingModels(true);
    try {
      const res = await fetchAndCacheAgentModels(agentId);
      setFetchRevision((r) => r + 1);
      if (res.error) {
        setFetchError(res.error);
      } else {
        setFetchError(null);
        const liveList = res.models;
        if (liveList.length > 0) {
          const currentMatch = liveList.find(
            (m) => m.id.toLowerCase() === (selectedModel || '').trim().toLowerCase()
          );
          const chosen = currentMatch || liveList[0];
          if (!currentMatch && chosen) {
            onChangeModel(chosen.id);
          }
          if (
            chosen?.supportedEffortLevels &&
            chosen.supportedEffortLevels.length > 0 &&
            !chosen.supportedEffortLevels.includes(effortLevel)
          ) {
            onChangeEffortLevel(chosen.defaultEffortLevel || chosen.supportedEffortLevels[0]);
          }
        }
      }
    } finally {
      setIsFetchingModels(false);
    }
  };

  const reasoningSupported = useMemo(() => {
    if (activeModelEntry) return activeModelEntry.supportsReasoning;
    return isReasoningModel(effectiveModel);
  }, [activeModelEntry, effectiveModel]);

  const handleSelectDropdown = (val: string) => {
    if (val === '__custom__') {
      setIsCustomMode(true);
      if (customInputVal.trim()) {
        onChangeModel(customInputVal.trim());
      }
    } else {
      setIsCustomMode(false);
      onChangeModel(val);
      const found = availableModels.find((m) => m.id === val);
      if (
        found?.supportedEffortLevels &&
        found.supportedEffortLevels.length > 0 &&
        !found.supportedEffortLevels.includes(effortLevel)
      ) {
        onChangeEffortLevel(found.defaultEffortLevel || found.supportedEffortLevels[0]);
      }
    }
  };

  const handleCustomBlur = () => {
    const trimmed = customInputVal.trim();
    if (trimmed) {
      onChangeModel(trimmed);
    } else {
      setIsCustomMode(false);
      onChangeModel(getDefaultModelForAgent(agentId));
    }
  };

  if (compact) {
    return (
      <div className="flex flex-col">
        <div
          className={`flex items-center gap-2 text-xs bg-slate-100/90 dark:bg-neutral-900/80 border border-slate-300 dark:border-neutral-700/60 rounded-lg p-1.5 ${
            disabled ? 'opacity-50 pointer-events-none' : ''
          } ${className}`}
        >
        {/* Model Dropdown + Small Fetch Button */}
        <div className="flex items-center gap-1 min-w-[140px]">
          <Cpu className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          {isCustomMode ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={customInputVal}
                onChange={(e) => setCustomInputVal(e.target.value)}
                onBlur={handleCustomBlur}
                placeholder="model-slug..."
                className="w-24 bg-white dark:bg-neutral-950 border border-blue-500/50 rounded px-1.5 py-0.5 text-xs text-slate-800 dark:text-neutral-200 focus:outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setIsCustomMode(false)}
                title="Back to subscription models"
                className="text-[11px] text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <select
              value={effectiveModel}
              onChange={(e) => handleSelectDropdown(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-neutral-200 text-xs font-medium cursor-pointer focus:outline-none truncate max-w-[145px]"
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id} className="bg-white dark:bg-neutral-900 text-slate-900 dark:text-neutral-200">
                  {m.displayName}
                </option>
              ))}
              <option value="__custom__" className="bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400">
                + Custom Slug...
              </option>
            </select>
          )}
          <button
            type="button"
            onClick={handleFetchModels}
            disabled={isFetchingModels}
            title="Fetch live available models from subscription CLI"
            className="p-1 rounded text-slate-600 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-200/70 dark:hover:bg-neutral-800 transition-colors shrink-0"
          >
            <RefreshCw className={`w-3 h-3 ${isFetchingModels ? 'animate-spin text-blue-500' : ''}`} />
          </button>
        </div>

        {/* Separator */}
        <div className="h-4 w-px bg-slate-300 dark:bg-neutral-700/60" />

        {/* Side-by-Side Reasoning / Effort Controls */}
        {reasoningSupported ? (
          <div className="flex items-center gap-1.5">
            {onToggleThinking && (
              <button
                type="button"
                onClick={onToggleThinking}
                title={thinkingEnabled ? 'Thinking Enabled' : 'Thinking Off'}
                className={`p-1 rounded transition-colors ${
                  thinkingEnabled
                    ? 'bg-purple-500/20 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-500/40 shadow-xs'
                    : 'text-slate-500 dark:text-neutral-500 hover:text-slate-700 dark:hover:text-neutral-300'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="flex items-center bg-white dark:bg-neutral-950 border border-slate-300 dark:border-neutral-700/60 rounded p-0.5 gap-0.5">
              {supportedEfforts.map((lvl) => {
                const active = effortLevel === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => onChangeEffortLevel(lvl)}
                    title={`${EFFORT_DESCRIPTIONS[lvl].label}: ${EFFORT_DESCRIPTIONS[lvl].badge} — ${EFFORT_DESCRIPTIONS[lvl].desc}`}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
                      active
                        ? 'bg-purple-600/90 text-white shadow-xs'
                        : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {lvl.slice(0, 1).toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div
            className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-neutral-400 px-1.5 py-0.5 bg-slate-50 dark:bg-neutral-950/60 rounded border border-slate-200 dark:border-neutral-800"
            title="This model does not require extended reasoning effort parameters."
          >
            <Zap className="w-3 h-3 text-amber-500 dark:text-amber-400/80 shrink-0" />
            <span className="text-[10px] font-mono text-slate-600 dark:text-neutral-400">Standard</span>
          </div>
        )}
      </div>
      {fetchError && (
        <div className="text-[10px] text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1 px-1">
          <span>{fetchError}. Showing the built-in list.</span>
          <button
            type="button"
            onClick={() => handleFetchModels()}
            className="underline font-bold hover:text-rose-700 dark:hover:text-rose-300 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
  }

  // Expanded / Standard View (Used in Step Editors, Modals, Dispatcher)
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-neutral-900/90 border border-slate-200 dark:border-neutral-800 rounded-xl ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      } ${className}`}
    >
      {/* Left Column: Model Selection */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-neutral-300">
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Active Model Selection
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleFetchModels}
              disabled={isFetchingModels}
              title="Fetch live available models from your subscription CLI"
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 transition-colors"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${isFetchingModels ? 'animate-spin' : ''}`} />
              {isFetchingModels ? 'Fetching...' : 'Fetch Models'}
            </button>
            {isCustomMode && (
              <button
                type="button"
                onClick={() => setIsCustomMode(false)}
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
              >
                Back to Catalog
              </button>
            )}
          </div>
        </div>

        {isCustomMode ? (
          <div className="relative">
            <input
              type="text"
              value={customInputVal}
              onChange={(e) => setCustomInputVal(e.target.value)}
              onBlur={handleCustomBlur}
              placeholder="e.g. gemini-4-argon or claude-opus-5-5"
              className="w-full bg-white dark:bg-neutral-950 border border-blue-500/60 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <span className="text-[10px] text-slate-600 dark:text-neutral-400 mt-1 block">
              Custom model identifier passed directly via <code className="text-blue-600 dark:text-blue-300">--model</code>.
            </span>
          </div>
        ) : (
          <div className="relative">
            <select
              value={effectiveModel}
              onChange={(e) => handleSelectDropdown(e.target.value)}
              className="w-full bg-white dark:bg-neutral-950 border border-slate-300 dark:border-neutral-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-neutral-200 focus:outline-none focus:border-blue-500 cursor-pointer appearance-none pr-8"
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id} className="bg-white dark:bg-neutral-900 text-slate-900 dark:text-neutral-200">
                  {m.displayName} {m.supportsReasoning ? '🧠' : '⚡'}
                </option>
              ))}
              <option value="__custom__" className="bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400">
                + Custom Model Slug...
              </option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-neutral-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        )}

        {fetchError && (
          <div className="text-[10px] text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1">
            <span>{fetchError}. Showing the built-in list.</span>
            <button
              type="button"
              onClick={() => handleFetchModels()}
              className="underline font-bold hover:text-rose-700 dark:hover:text-rose-300 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Selected model micro-description */}
        <div className="text-[11px] text-slate-600 dark:text-neutral-400 line-clamp-1">
          {availableModels.find((m) => m.id === effectiveModel)?.description ||
            `Target model slug: ${effectiveModel}`}
        </div>
      </div>

      {/* Right Column: Effort Matrix & Thinking Toggle */}
      <div className="flex flex-col gap-1.5 border-t md:border-t-0 md:border-l border-slate-200 dark:border-neutral-800 md:pl-3 pt-2 md:pt-0">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-neutral-300">
          <span className="flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            Reasoning Effort Matrix
          </span>
          {reasoningSupported && onToggleThinking && (
            <button
              type="button"
              onClick={onToggleThinking}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                thinkingEnabled
                  ? 'bg-purple-500/20 dark:bg-purple-900/60 text-purple-700 dark:text-purple-200 border border-purple-500/50'
                  : 'bg-slate-200 dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 border border-slate-300 dark:border-neutral-700'
              }`}
            >
              <Sparkles className="w-2.5 h-2.5" />
              {thinkingEnabled ? 'Thinking ON' : 'Thinking OFF'}
            </button>
          )}
        </div>

        {reasoningSupported ? (
          <div className="flex flex-col gap-1.5">
            <div
              className="grid gap-1 bg-white dark:bg-neutral-950 p-1 rounded-lg border border-slate-200 dark:border-neutral-800"
              style={{ gridTemplateColumns: `repeat(${Math.max(1, supportedEfforts.length)}, minmax(0, 1fr))` }}
            >
              {supportedEfforts.map((lvl) => {
                const active = effortLevel === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => onChangeEffortLevel(lvl)}
                    className={`py-1 text-center rounded text-xs font-semibold transition-all ${
                      active
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                        : 'text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-850'
                    }`}
                  >
                    {EFFORT_DESCRIPTIONS[lvl].label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-neutral-400 px-0.5">
              <span className="text-purple-700 dark:text-purple-300/90 font-medium">
                {EFFORT_DESCRIPTIONS[effortLevel]?.badge || ''}
              </span>
              <span className="truncate max-w-[180px] text-slate-600 dark:text-neutral-400 text-right">
                {EFFORT_DESCRIPTIONS[effortLevel]?.desc || ''}
              </span>
            </div>

            {effortLevel === 'high' && (
              <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium px-0.5">
                High effort costs ~1.4x medium on debate turns.
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col justify-center h-full min-h-[46px] px-3 py-2 bg-white dark:bg-neutral-950/70 border border-slate-200 dark:border-neutral-800/80 rounded-lg">
            <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-neutral-300 font-medium">
              <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              Standard Latency Generation
            </div>
            <div className="text-[10px] text-slate-600 dark:text-neutral-400 mt-0.5">
              This model processes tokens with standard generation speed and does not require extended reasoning effort parameters.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

