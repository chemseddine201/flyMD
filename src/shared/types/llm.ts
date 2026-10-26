export type LLMProviderType = 'ollama' | 'openai-compatible' | 'custom';

export interface LLMConfig {
  provider: LLMProviderType;
  endpointUrl: string;
  apiKey?: string;
  model: string;
}

export interface OllamaModel {
  name: string;
  modified_at?: string;
  size?: number;
  digest?: string;
  details?: {
    family?: string;
    parameter_size?: string;
  };
}

export interface TranslationRequest {
  text: string;
  targetLanguage: string;
  model?: string;
  config?: LLMConfig;
}

export interface TranslationStreamChunk {
  chunk: string;
  done: boolean;
}

