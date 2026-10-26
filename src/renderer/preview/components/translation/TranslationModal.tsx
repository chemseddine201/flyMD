import React, { useState, useEffect, useRef } from 'react';
import { OllamaModel, LLMConfig, LLMProviderType, AppSettings, TranslationRequest } from '../../../../shared/types';
import { generateTranslatedFileName } from '../../../../shared/utils';
import { useIpcEvent } from '../../../shared/hooks/useIpcEvent';
import { LlmConfigPanel } from './LlmConfigPanel';
import { TranslationWorkspace } from './TranslationWorkspace';
import { Languages, Server, X, AlertCircle } from 'lucide-react';

export interface OllamaModalProps {
  isOpen: boolean;
  onClose: () => void;
  fullContent: string;
  selectedContent?: string;
  fileName: string;
  onOpenAsNewTab: (translatedContent: string, targetLang: string) => void;
  onReplaceContent: (newContent: string) => void;
  onInsertBelow: (newContent: string) => void;
  onSaveAsNewFile: (suggestedName: string, content: string) => void;
  defaultModel?: string;
  initialLlmConfig?: LLMConfig;
  onSaveSettings?: (patch: Partial<AppSettings>) => void;
}

export const TranslationModal: React.FC<OllamaModalProps> = ({
  isOpen,
  onClose,
  fullContent,
  selectedContent,
  fileName,
  onOpenAsNewTab,
  onReplaceContent,
  onInsertBelow,
  onSaveAsNewFile,
  defaultModel,
  initialLlmConfig,
  onSaveSettings,
}) => {
  // Tabs: 'translate' | 'config'
  const [activeTab, setActiveTab] = useState<'translate' | 'config'>('translate');

  // Provider configuration state
  const [provider, setProvider] = useState<LLMProviderType>(initialLlmConfig?.provider || 'ollama');
  const [endpointUrl, setEndpointUrl] = useState<string>(
    initialLlmConfig?.endpointUrl || 'http://127.0.0.1:11434'
  );
  const [apiKey, setApiKey] = useState<string>(initialLlmConfig?.apiKey || '');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [isSavingDefault, setIsSavingDefault] = useState<boolean>(false);

  // Model selection state
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(
    initialLlmConfig?.model || defaultModel || 'qwen2.5:3b'
  );
  const [customModelInput, setCustomModelInput] = useState<string>('');
  const [useCustomModel, setUseCustomModel] = useState<boolean>(false);

  // Target Language & Scope
  const [targetLang, setTargetLang] = useState<string>('English');
  const [customLangInput, setCustomLangInput] = useState<string>('');
  const [scope, setScope] = useState<'selection' | 'full'>(selectedContent ? 'selection' : 'full');

  // Streaming & Execution State
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [streamedText, setStreamedText] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
  }>({ tested: false, success: false, message: '' });

  // Sync initial config
  useEffect(() => {
    if (initialLlmConfig) {
      setProvider(initialLlmConfig.provider || 'ollama');
      setEndpointUrl(initialLlmConfig.endpointUrl || 'http://127.0.0.1:11434');
      setApiKey(initialLlmConfig.apiKey || '');
      if (initialLlmConfig.model) setSelectedModel(initialLlmConfig.model);
    }
  }, [initialLlmConfig]);

  // Fetch models on modal open
  useEffect(() => {
    if (isOpen) {
      loadModels();
    }
  }, [isOpen, provider, endpointUrl]);

  const loadModels = async () => {
    try {
      const cfg: LLMConfig = {
        provider,
        endpointUrl,
        apiKey: apiKey.trim() || undefined,
        model: activeModelName,
      };
      const res = await window.electronAPI.getOllamaModels(cfg);
      if (res.success && res.models && res.models.length > 0) {
        setModels(res.models);
        if (!res.models.some((m) => m.name === selectedModel)) {
          setSelectedModel(res.models[0].name);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus({ tested: false, success: false, message: '' });
    try {
      const cfg: LLMConfig = {
        provider,
        endpointUrl,
        apiKey: apiKey.trim() || undefined,
        model: activeModelName,
      };
      const res = await window.electronAPI.testLlmConnection(cfg);
      setConnectionStatus({
        tested: true,
        success: res.success,
        message: res.message,
      });
      if (res.models && res.models.length > 0) {
        setModels(res.models);
      }
    } catch (err: any) {
      setConnectionStatus({
        tested: true,
        success: false,
        message: err.message || 'Connection failed',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSaveAsDefault = () => {
    if (!onSaveSettings) return;
    const cfg: LLMConfig = {
      provider,
      endpointUrl,
      apiKey: apiKey.trim() || undefined,
      model: activeModelName,
    };
    onSaveSettings({
      llmConfig: cfg,
      ollamaModel: activeModelName,
      ollamaUrl: endpointUrl,
    });
    setIsSavingDefault(true);
    setTimeout(() => setIsSavingDefault(false), 2000);
  };

  // IPC Event Subscriptions for Streaming
  useIpcEvent<string>(
    window.electronAPI.onTranslationChunk,
    (chunk) => {
      setStreamedText((prev) => prev + chunk);
    }
  );

  useIpcEvent<{ success: boolean; text?: string; error?: string }>(
    window.electronAPI.onTranslationComplete,
    (res) => {
      setIsTranslating(false);
      if (!res.success) {
        setErrorMsg(res.error || 'Translation failed');
      }
    }
  );

  const activeModelName = useCustomModel && customModelInput.trim() ? customModelInput.trim() : selectedModel;
  const effectiveTargetLang = targetLang === 'custom' ? customLangInput.trim() || 'English' : targetLang;
  const textToTranslate = scope === 'selection' && selectedContent ? selectedContent : fullContent;

  const handleStartTranslate = () => {
    if (!textToTranslate.trim()) {
      setErrorMsg('No text available to translate');
      return;
    }

    setErrorMsg(null);
    setStreamedText('');
    setIsTranslating(true);

    const cfg: LLMConfig = {
      provider,
      endpointUrl,
      apiKey: apiKey.trim() || undefined,
      model: activeModelName,
    };

    const req: TranslationRequest = {
      text: textToTranslate,
      targetLanguage: effectiveTargetLang,
      model: activeModelName,
      config: cfg,
    };

    window.electronAPI.startTranslation(req);
  };

  const handleAbortTranslate = () => {
    window.electronAPI.abortTranslation();
    setIsTranslating(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="h-14 px-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span>AI Markdown Translator</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-sky-400 font-mono border border-slate-700">
                  {provider.toUpperCase()} : {activeModelName}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Preserves math (KaTeX), code blocks, and markdown structure
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher Tabs */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('translate')}
                className={`px-3 py-1 rounded-lg transition font-medium flex items-center gap-1.5 ${
                  activeTab === 'translate'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Languages className="w-3.5 h-3.5" />
                <span>Translate</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('config')}
                className={`px-3 py-1 rounded-lg transition font-medium flex items-center gap-1.5 ${
                  activeTab === 'config'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>Server & Models</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-950/50 border border-rose-500/40 rounded-xl text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'config' ? (
            <LlmConfigPanel
              provider={provider}
              onChangeProvider={setProvider}
              endpointUrl={endpointUrl}
              onChangeEndpointUrl={setEndpointUrl}
              apiKey={apiKey}
              onChangeApiKey={setApiKey}
              showApiKey={showApiKey}
              onToggleShowApiKey={() => setShowApiKey(!showApiKey)}
              selectedModel={selectedModel}
              onChangeSelectedModel={setSelectedModel}
              models={models}
              onRefreshModels={loadModels}
              useCustomModel={useCustomModel}
              onToggleUseCustomModel={setUseCustomModel}
              customModelInput={customModelInput}
              onChangeCustomModelInput={setCustomModelInput}
              onTestConnection={handleTestConnection}
              isTestingConnection={isTestingConnection}
              connectionStatus={connectionStatus}
              onSaveAsDefault={handleSaveAsDefault}
              isSavingDefault={isSavingDefault}
            />
          ) : (
            <TranslationWorkspace
              sourceText={textToTranslate}
              streamedText={streamedText}
              isTranslating={isTranslating}
              targetLang={targetLang}
              onChangeTargetLang={setTargetLang}
              customLangInput={customLangInput}
              onChangeCustomLangInput={setCustomLangInput}
              scope={scope}
              onChangeScope={setScope}
              hasSelection={!!selectedContent}
              onStartTranslate={handleStartTranslate}
              onAbortTranslate={handleAbortTranslate}
              onOpenAsNewTab={() => {
                onOpenAsNewTab(streamedText, effectiveTargetLang);
                onClose();
              }}
              onReplaceContent={() => {
                onReplaceContent(streamedText);
                onClose();
              }}
              onInsertBelow={() => {
                onInsertBelow(streamedText);
                onClose();
              }}
              onSaveAsFile={() => {
                const suggested = generateTranslatedFileName(fileName, effectiveTargetLang);
                onSaveAsNewFile(suggested, streamedText);
              }}
              activeModelName={activeModelName}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export const OllamaModal = TranslationModal;

