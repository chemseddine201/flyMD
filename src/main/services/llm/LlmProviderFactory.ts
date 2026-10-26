import { LLMConfig } from '../../../shared/types';
import { LlmProvider } from './LlmProvider';
import { OllamaProvider } from './OllamaProvider';
import { OpenAiCompatibleProvider } from './OpenAiCompatibleProvider';

export class LlmProviderFactory {
  private static ollamaProvider = new OllamaProvider();
  private static openAiProvider = new OpenAiCompatibleProvider();

  public static getProvider(config?: LLMConfig): LlmProvider {
    if (config?.provider === 'openai-compatible' || config?.provider === 'custom') {
      return this.openAiProvider;
    }
    return this.ollamaProvider;
  }
}

