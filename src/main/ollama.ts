import { jsonStore } from './infrastructure/persistence/JsonStore';
import { TranslationService } from './services/llm/TranslationService';
import { LLMConfig, TranslationRequest } from '../shared/types';

export const translationService = new TranslationService(jsonStore);

// Backward-compatibility wrapper for legacy references
export const ollamaService = {
  testConnection: (config: LLMConfig) => translationService.testConnection(config),
  getModels: (configOrUrl?: any) => translationService.listModels(configOrUrl),
  translate: (
    req: TranslationRequest,
    _defaultUrl: string,
    onChunk: (chunk: string) => void
  ) => translationService.translate(req, onChunk, 'legacy'),
  abortActiveTranslation: () => translationService.abort('legacy'),
};

export const llmService = ollamaService;
