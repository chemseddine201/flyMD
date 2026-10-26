import { LLMConfig, LLMProviderType } from '../types';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ar', name: 'Arabic (العربية)' },
  { code: 'fr', name: 'French (Français)' },
  { code: 'es', name: 'Spanish (Español)' },
  { code: 'de', name: 'German (Deutsch)' },
  { code: 'zh', name: 'Chinese (中文)' },
  { code: 'ja', name: 'Japanese (日本語)' },
  { code: 'ru', name: 'Russian (Русский)' },
  { code: 'pt', name: 'Portuguese (Português)' },
  { code: 'it', name: 'Italian (Italiano)' },
  { code: 'ko', name: 'Korean (한국어)' },
  { code: 'tr', name: 'Turkish (Türkçe)' },
] as const;

export interface ProviderPreset {
  id: string;
  label: string;
  provider: LLMProviderType;
  endpointUrl: string;
  defaultModel: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'ollama',
    label: 'Ollama Local',
    provider: 'ollama',
    endpointUrl: 'http://127.0.0.1:11434',
    defaultModel: 'qwen2.5:3b',
  },
  {
    id: 'openai',
    label: 'OpenAI (Official)',
    provider: 'openai-compatible',
    endpointUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'groq',
    label: 'Groq (Ultra-Fast)',
    provider: 'openai-compatible',
    endpointUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    provider: 'openai-compatible',
    endpointUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.5-sonnet',
  },
  {
    id: 'vllm',
    label: 'vLLM / LM Studio',
    provider: 'openai-compatible',
    endpointUrl: 'http://127.0.0.1:1234/v1',
    defaultModel: 'local-model',
  },
];

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: 'ollama',
  endpointUrl: 'http://127.0.0.1:11434',
  apiKey: '',
  model: 'qwen2.5:3b',
};

