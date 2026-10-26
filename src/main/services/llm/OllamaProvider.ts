import { LLMConfig, OllamaModel, TranslationRequest } from '../../../shared/types';
import { LlmTestConnectionResult, LlmGetModelsResult } from '../../../shared/ipc';
import { LlmProvider, SYSTEM_TRANSLATION_PROMPT } from './LlmProvider';

export class OllamaProvider implements LlmProvider {
  public async testConnection(config: LLMConfig): Promise<LlmTestConnectionResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const url = `${config.endpointUrl.trim().replace(/\/+$/, '')}/api/tags`;

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return { success: false, message: `Ollama returned HTTP status ${res.status}` };
      }

      const data = (await res.json()) as { models?: OllamaModel[] };
      const models = data.models || [];
      return {
        success: true,
        message: `Connected to Ollama! Found ${models.length} model(s).`,
        models,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, message: 'Connection timed out after 6 seconds.' };
      }
      return { success: false, message: err.message || 'Failed to connect to Ollama server.' };
    }
  }

  public async listModels(config: LLMConfig): Promise<LlmGetModelsResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const url = `${config.endpointUrl.trim().replace(/\/+$/, '')}/api/tags`;

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return { success: false, models: [], error: `Ollama returned status ${res.status}` };
      }

      const data = (await res.json()) as { models?: OllamaModel[] };
      return { success: true, models: data.models || [] };
    } catch (err: any) {
      return {
        success: false,
        models: [],
        error: err.name === 'AbortError' ? 'Connection timed out' : (err.message || 'Failed to list models'),
      };
    }
  }

  public async streamTranslate(
    request: TranslationRequest,
    onChunk: (chunk: string) => void,
    signal: AbortSignal
  ): Promise<{ success: boolean; result: string; error?: string }> {
    const config = request.config || {
      provider: 'ollama',
      endpointUrl: 'http://127.0.0.1:11434',
      model: request.model || 'qwen2.5:3b',
    };
    const model = request.model || config.model || 'qwen2.5:3b';
    const systemPrompt = SYSTEM_TRANSLATION_PROMPT(request.targetLanguage);
    const url = `${config.endpointUrl.trim().replace(/\/+$/, '')}/api/generate`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: request.text,
          system: systemPrompt,
          stream: true,
          options: {
            temperature: 0.2,
          },
        }),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return { success: false, result: '', error: `Ollama error (${response.status}): ${errorText}` };
      }

      if (!response.body) {
        return { success: false, result: '', error: 'Ollama response body is empty' };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.response) {
              fullText += parsed.response;
              onChunk(parsed.response);
            }
          } catch {
            // Ignore partial JSON lines
          }
        }
      }

      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer);
          if (parsed.response) {
            fullText += parsed.response;
            onChunk(parsed.response);
          }
        } catch {
          // ignore
        }
      }

      return { success: true, result: fullText };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, result: '', error: 'Translation was cancelled by user' };
      }
      return { success: false, result: '', error: err.message || 'Failed to stream translation' };
    }
  }
}

