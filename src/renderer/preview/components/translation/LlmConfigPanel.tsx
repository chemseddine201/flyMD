 import React from 'react';
import { LLMConfig, LLMProviderType, OllamaModel } from '../../../../shared/types';
import { PROVIDER_PRESETS } from '../../../../shared/constants';
import {
  Server,
  Globe,
  Key,
  Cpu,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Save,
} from 'lucide-react';

interface LlmConfigPanelProps {
  provider: LLMProviderType;
  onChangeProvider: (provider: LLMProviderType) => void;
  endpointUrl: string;
  onChangeEndpointUrl: (url: string) => void;
  apiKey: string;
  onChangeApiKey: (key: string) => void;
  showApiKey: boolean;
  onToggleShowApiKey: () => void;
  selectedModel: string;
  onChangeSelectedModel: (model: string) => void;
  models: OllamaModel[];
  onRefreshModels: () => void;
  useCustomModel: boolean;
  onToggleUseCustomModel: (val: boolean) => void;
  customModelInput: string;
  onChangeCustomModelInput: (val: string) => void;
  onTestConnection: () => void;
  isTestingConnection: boolean;
  connectionStatus: { tested: boolean; success: boolean; message: string };
  onSaveAsDefault: () => void;
  isSavingDefault: boolean;
}

export const LlmConfigPanel: React.FC<LlmConfigPanelProps> = ({
  provider,
  onChangeProvider,
  endpointUrl,
  onChangeEndpointUrl,
  apiKey,
  onChangeApiKey,
  showApiKey,
  onToggleShowApiKey,
  selectedModel,
  onChangeSelectedModel,
  models,
  onRefreshModels,
  useCustomModel,
  onToggleUseCustomModel,
  customModelInput,
  onChangeCustomModelInput,
  onTestConnection,
  isTestingConnection,
  connectionStatus,
  onSaveAsDefault,
  isSavingDefault,
}) => {
  return (
    <div className="space-y-4 p-4 bg-slate-950/70 rounded-xl border border-slate-800 text-xs">
      {/* Provider Selector */}
      <div>
        <label className="block text-slate-400 font-medium mb-1.5 flex items-center gap-1.5">
          <Server className="w-3.5 h-3.5 text-sky-400" />
          <span>LLM Service Provider</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {PROVIDER_PRESETS.map((preset) => {
            const isSelected =
              provider === preset.provider &&
              (endpointUrl.trim().replace(/\/+$/, '') === preset.endpointUrl.trim().replace(/\/+$/, '') ||
                (preset.provider === 'ollama' && provider === 'ollama' && endpointUrl.includes('11434')) ||
                (preset.id === 'vllm' && endpointUrl.includes('1234')));
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onChangeProvider(preset.provider);
                  onChangeEndpointUrl(preset.endpointUrl);
                  onChangeSelectedModel(preset.defaultModel);
                }}
                className={`py-2 px-2.5 rounded-lg border text-left transition flex flex-col gap-0.5 ${
                  isSelected
                    ? 'bg-sky-950/80 border-sky-500 text-sky-200 shadow-sm shadow-sky-900/30'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <span className="font-semibold text-xs">{preset.label}</span>
                <span className="text-[10px] text-slate-500 truncate">{preset.defaultModel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Endpoint URL */}
      <div>
        <label className="block text-slate-400 font-medium mb-1 flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-emerald-400" />
          <span>Endpoint URL</span>
        </label>
        <input
          type="text"
          value={endpointUrl}
          onChange={(e) => onChangeEndpointUrl(e.target.value)}
          placeholder="http://127.0.0.1:11434 or https://api.openai.com/v1"
          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono text-xs"
        />
      </div>

      {/* API Key (if not local ollama or if custom) */}
      {provider !== 'ollama' && (
        <div>
          <label className="block text-slate-400 font-medium mb-1 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>API Key / Bearer Token</span>
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => onChangeApiKey(e.target.value)}
              placeholder="sk-... (leave empty if your server has no auth)"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-3 pr-9 py-1.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono text-xs"
            />
            <button
              type="button"
              onClick={onToggleShowApiKey}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
            >
              {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Model Selection & Custom Model Input */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-slate-400 font-medium flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span>Model Selection</span>
          </label>
          <button
            type="button"
            onClick={onRefreshModels}
            title="Fetch available models from server"
            className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 transition"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh models</span>
          </button>
        </div>

        {useCustomModel ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customModelInput}
              onChange={(e) => onChangeCustomModelInput(e.target.value)}
              placeholder="e.g. gpt-4o-mini, claude-3-5-sonnet, deepseek-coder"
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => onToggleUseCustomModel(false)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
            >
              Select list
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={selectedModel}
              onChange={(e) => onChangeSelectedModel(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500 text-xs"
            >
              {models.length > 0 ? (
                models.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                  </option>
                ))
              ) : (
                <option value={selectedModel}>{selectedModel || 'No models discovered'}</option>
              )}
            </select>
            <button
              type="button"
              onClick={() => onToggleUseCustomModel(true)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
            >
              Custom name
            </button>
          </div>
        )}
      </div>

      {/* Test Connection and Status Result */}
      <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onTestConnection}
            disabled={isTestingConnection}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50"
          >
            {isTestingConnection ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
            <span>{isTestingConnection ? 'Testing...' : 'Test Connection'}</span>
          </button>

          <button
            type="button"
            onClick={onSaveAsDefault}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSavingDefault ? 'Saved!' : 'Save as Default'}</span>
          </button>
        </div>

        {connectionStatus.tested && (
          <div
            className={`flex items-center gap-2 p-2 rounded-lg text-xs border ${
              connectionStatus.success
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}
          >
            {connectionStatus.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="truncate">{connectionStatus.message}</span>
          </div>
        )}
      </div>
    </div>
  );
};
