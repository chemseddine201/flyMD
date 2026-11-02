import React, { useEffect, useMemo, useState } from 'react';
import { Brain, Cpu, Sparkles, Zap, ChevronDown, Check, X } from 'lucide-react';
import { AgentEffortLevel } from '../../../../../shared/types';
import {
  EFFORT_DESCRIPTIONS,
  getAvailableModelsForAgent,
  getDefaultModelForAgent,
  isReasoningModel,
  ModelCatalogEntry,
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

  useEffect(() => {
    if (selectedModel && selectedModel.trim().length > 0) {
      setCustomInputVal(selectedModel.trim());
    }
  }, [selectedModel]);

  const effectiveModel = useMemo(() => {
    if (selectedModel && selectedModel.trim().length > 0) return selectedModel.trim();
    return getDefaultModelForAgent(agentId, subscriptionTier);
  }, [selectedModel, agentId, subscriptionTier]);

  const availableModels: ModelCatalogEntry[] = useMemo(() => {
    const list = getAvailableModelsForAgent(agentId, subscriptionTier, dynamicModels);
    if (
      effectiveModel &&
      !list.some((m) => m.id.toLowerCase() === effectiveModel.toLowerCase())
    ) {
      const reasoning = isReasoningModel(effectiveModel);
      return [
        {
          id: effectiveModel,
          displayName: `${effectiveModel} [ACTIVE]`,
          family: 'other',
          providerIds: [agentId],
          category: reasoning ? 'reasoning' : 'flagship',
          supportsReasoning: reasoning,
          supportedEffortLevels: reasoning
            ? ['low', 'medium', 'high', 'xhigh', 'max']
            : ['low', 'medium', 'high'],
          defaultEffortLevel: 'medium',
          supportsThinkingToggle: reasoning,
          contextWindowTokens: 200000,
          description: `Active model selection (${effectiveModel})`,
        },
        ...list,
      ];
    }
    return list;
  }, [agentId, subscriptionTier, dynamicModels, effectiveModel]);

  const reasoningSupported = useMemo(() => {
    return isReasoningModel(effectiveModel);
  }, [effectiveModel]);

  const handleSelectDropdown = (val: string) => {
    if (val === '__custom__') {
      setIsCustomMode(true);
      if (customInputVal.trim()) {
        onChangeModel(customInputVal.trim());
      }
    } else {
      setIsCustomMode(false);
      onChangeModel(val);
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

  const effortLevels: AgentEffortLevel[] = ['low', 'medium', 'high', 'xhigh', 'max'];

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 text-xs bg-neutral-900/80 border border-neutral-700/60 rounded-lg p-1.5 ${
          disabled ? 'opacity-50 pointer-events-none' : ''
        } ${className}`}
      >
        {/* Model Dropdown */}
        <div className="flex items-center gap-1 min-w-[140px]">
          <Cpu className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          {isCustomMode ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={customInputVal}
                onChange={(e) => setCustomInputVal(e.target.value)}
                onBlur={handleCustomBlur}
                placeholder="model-slug..."
                className="w-24 bg-neutral-950 border border-blue-500/50 rounded px-1.5 py-0.5 text-xs text-neutral-200 focus:outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setIsCustomMode(false)}
                title="Back to dropdown options"
                className="text-[11px] text-neutral-400 hover:text-white p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <select
              value={effectiveModel}
              onChange={(e) => handleSelectDropdown(e.target.value)}
              className="bg-transparent text-neutral-200 text-xs font-medium cursor-pointer focus:outline-none truncate max-w-[150px]"
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id} className="bg-neutral-900 text-neutral-200">
                  {m.displayName}
                </option>
              ))}
              <option value="__custom__" className="bg-neutral-900 text-blue-400">
                + Custom Slug...
              </option>
            </select>
          )}
        </div>

        {/* Separator */}
        <div className="h-4 w-px bg-neutral-700/60" />

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
                    ? 'bg-purple-900/60 text-purple-300 border border-purple-500/40 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="flex items-center bg-neutral-950 border border-neutral-700/60 rounded p-0.5 gap-0.5">
              {effortLevels.map((lvl) => {
                const active = effortLevel === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => onChangeEffortLevel(lvl)}
                    title={`${EFFORT_DESCRIPTIONS[lvl].label}: ${EFFORT_DESCRIPTIONS[lvl].badge} — ${EFFORT_DESCRIPTIONS[lvl].desc}`}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
                      active
                        ? 'bg-purple-600/80 text-white shadow-xs'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
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
            className="flex items-center gap-1 text-[11px] text-neutral-400 px-1.5 py-0.5 bg-neutral-950/60 rounded border border-neutral-800"
            title="This model does not require extended reasoning effort parameters."
          >
            <Zap className="w-3 h-3 text-amber-400/80 shrink-0" />
            <span className="text-[10px] font-mono text-neutral-400">Standard</span>
          </div>
        )}
      </div>
    );
  }

  // Expanded / Standard View (Used in Step Editors, Modals, Dispatcher)
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-neutral-900/90 border border-neutral-800 rounded-xl ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      } ${className}`}
    >
      {/* Left Column: Model Selection */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
          <span className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            Active Model Selection
          </span>
          {isCustomMode && (
            <button
              type="button"
              onClick={() => setIsCustomMode(false)}
              className="text-[10px] text-blue-400 hover:underline"
            >
              Back to Catalog
            </button>
          )}
        </div>

        {isCustomMode ? (
          <div className="relative">
            <input
              type="text"
              value={customInputVal}
              onChange={(e) => setCustomInputVal(e.target.value)}
              onBlur={handleCustomBlur}
              placeholder="e.g. claude-3-7-sonnet or my-fine-tune"
              className="w-full bg-neutral-950 border border-blue-500/60 rounded-lg px-2.5 py-1.5 text-xs text-neutral-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <span className="text-[10px] text-neutral-400 mt-1 block">
              Custom model identifier passed directly via <code className="text-blue-300">--model</code>.
            </span>
          </div>
        ) : (
          <div className="relative">
            <select
              value={effectiveModel}
              onChange={(e) => handleSelectDropdown(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700/80 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-blue-500 cursor-pointer appearance-none pr-8"
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id} className="bg-neutral-900 text-neutral-200">
                  {m.displayName} {m.supportsReasoning ? '🧠' : '⚡'}
                </option>
              ))}
              <option value="__custom__" className="bg-neutral-900 text-blue-400">
                + Custom Model Slug...
              </option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        )}

        {/* Selected model micro-description */}
        <div className="text-[11px] text-neutral-400 line-clamp-1">
          {availableModels.find((m) => m.id === effectiveModel)?.description ||
            `Target model slug: ${effectiveModel}`}
        </div>
      </div>

      {/* Right Column: Effort Matrix & Thinking Toggle */}
      <div className="flex flex-col gap-1.5 border-t md:border-t-0 md:border-l border-neutral-800 md:pl-3 pt-2 md:pt-0">
        <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
          <span className="flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            Reasoning Effort Matrix
          </span>
          {reasoningSupported && onToggleThinking && (
            <button
              type="button"
              onClick={onToggleThinking}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                thinkingEnabled
                  ? 'bg-purple-900/60 text-purple-200 border border-purple-500/50'
                  : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
              }`}
            >
              <Sparkles className="w-2.5 h-2.5" />
              {thinkingEnabled ? 'Thinking ON' : 'Thinking OFF'}
            </button>
          )}
        </div>

        {reasoningSupported ? (
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-5 gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
              {effortLevels.map((lvl) => {
                const active = effortLevel === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => onChangeEffortLevel(lvl)}
                    className={`py-1 text-center rounded text-xs font-semibold transition-all ${
                      active
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850'
                    }`}
                  >
                    {EFFORT_DESCRIPTIONS[lvl].label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[10px] text-neutral-400 px-0.5">
              <span className="text-purple-300/90 font-medium">
                {EFFORT_DESCRIPTIONS[effortLevel].badge}
              </span>
              <span className="truncate max-w-[180px] text-neutral-400 text-right">
                {EFFORT_DESCRIPTIONS[effortLevel].desc}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col justify-center h-full min-h-[46px] px-3 py-2 bg-neutral-950/70 border border-neutral-800/80 rounded-lg">
            <div className="flex items-center gap-1.5 text-xs text-neutral-300 font-medium">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Standard Latency Generation
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">
              This model processes tokens with standard generation speed and does not require extended reasoning effort parameters.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

