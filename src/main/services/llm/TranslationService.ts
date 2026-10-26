import { LLMConfig, TranslationRequest } from '../../../shared/types';
import { LlmTestConnectionResult, LlmGetModelsResult } from '../../../shared/ipc';
import { LlmProviderFactory } from './LlmProviderFactory';
import { JsonStore } from '../../infrastructure/persistence/JsonStore';

export class TranslationService {
  private activeControllers: Map<string, AbortController> = new Map();

  constructor(private store: JsonStore) {}

  public async testConnection(config?: LLMConfig): Promise<LlmTestConnectionResult> {
    const effectiveConfig = config || this.store.getSettings().llmConfig;
    const provider = LlmProviderFactory.getProvider(effectiveConfig);
    return provider.testConnection(effectiveConfig);
  }

  public async listModels(config?: LLMConfig | string): Promise<LlmGetModelsResult> {
    const settings = this.store.getSettings();
    let effectiveConfig: LLMConfig;

    if (typeof config === 'string') {
      effectiveConfig = { provider: 'ollama', endpointUrl: config, model: settings.ollamaModel || 'qwen2.5:3b' };
    } else if (config) {
      effectiveConfig = config;
    } else {
      effectiveConfig = settings.llmConfig || {
        provider: 'ollama',
        endpointUrl: settings.ollamaUrl || 'http://127.0.0.1:11434',
        model: settings.ollamaModel || 'qwen2.5:3b',
      };
    }

    const provider = LlmProviderFactory.getProvider(effectiveConfig);
    return provider.listModels(effectiveConfig);
  }

  public async translate(
    request: TranslationRequest,
    onChunk: (chunk: string) => void,
    callerId = 'default'
  ): Promise<{ success: boolean; result: string; error?: string }> {
    // Abort any existing translation for this caller
    this.abort(callerId);

    const controller = new AbortController();
    this.activeControllers.set(callerId, controller);

    const settings = this.store.getSettings();
    const config = request.config || settings.llmConfig;
    const provider = LlmProviderFactory.getProvider(config);

    try {
      const result = await provider.streamTranslate(
        { ...request, config },
        onChunk,
        controller.signal
      );
      return result;
    } finally {
      if (this.activeControllers.get(callerId) === controller) {
        this.activeControllers.delete(callerId);
      }
    }
  }

  public abort(callerId = 'default'): void {
    const controller = this.activeControllers.get(callerId);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(callerId);
    }
  }

  public abortAll(): void {
    for (const controller of this.activeControllers.values()) {
      controller.abort();
    }
    this.activeControllers.clear();
  }
}

