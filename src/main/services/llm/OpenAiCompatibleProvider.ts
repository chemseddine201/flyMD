import { LLMConfig, OllamaModel, TranslationRequest } from '../../../shared/types';
import { LlmTestConnectionResult, LlmGetModelsResult } from '../../../shared/ipc';
import { LlmProvider, SYSTEM_TRANSLATION_PROMPT } from './LlmProvider';

export class OpenAiCompatibleProvider implements LlmProvider {
  private normalizeChatUrl(endpointUrl: string): string {
    const trimmed = endpointUrl.trim().replace(/\/+$/, '');
    if (trimmed.endsWith('/chat/completions')) {
      return trimmed;
    }
    return `${trimmed}/chat/completions`;
  }

  public async testConnection(config: LLMConfig): Promise<LlmTestConnectionResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const baseUrl = config.endpointUrl.trim().replace(/\/+$/, '');
      const modelsUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/models` : `${baseUrl}/v1/models`;

      const headers: Record<string, string> = {};
      if (config.apiKey && config.apiKey.trim()) {
        headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
      }

      // First attempt: fetch /models
      try {
        const res = await fetch(modelsUrl, { headers, signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = (await res.json()) as any;
          const modelList = Array.isArray(data?.data)
            ? data.data.map((m: any) => ({ name: m.id || m.name }))
            : [];
          return {
            success: true,
            message: `Connected successfully! Found ${modelList.length} model(s).`,
            models: modelList,
          };
        }
      } catch {
        // Fall back to lightweight chat test
      }

      // Second attempt: quick ping via chat completions with max_tokens: 1
      const chatUrl = this.normalizeChatUrl(config.endpointUrl);
      const chatController = new AbortController();
      const chatTimeout = setTimeout(() => chatController.abort(), 6000);

      const chatRes = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey?.trim() ? { Authorization: `Bearer ${config.apiKey.trim()}` } : {}),
        },
        body: JSON.stringify({
          model: config.model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
        signal: chatController.signal,
      });
      clearTimeout(chatTimeout);

      if (chatRes.ok || chatRes.status === 400) {
        return {
          success: true,
          message: `Connected to ${config.provider} server successfully!`,
        };
      } else if (chatRes.status === 401 || chatRes.status === 403) {
        return { success: false, message: `Authentication failed (HTTP ${chatRes.status}): Invalid API Key.` };
      } else {
        return { success: false, message: `Server responded with HTTP ${chatRes.status}` };
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, message: 'Connection timed out after 6 seconds.' };
      }
      return { success: false, message: err.message || 'Failed to connect to server.' };
    }
  }

  public async listModels(config: LLMConfig): Promise<LlmGetModelsResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const baseUrl = config.endpointUrl.trim().replace(/\/+$/, '');
      const modelsUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/models` : `${baseUrl}/models`;
      const headers: Record<string, string> = {};
      if (config.apiKey?.trim()) {
        headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
      }

      const res = await fetch(modelsUrl, { headers, signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return { success: false, models: [], error: `Server returned status ${res.status}` };
      }

      const data = (await res.json()) as any;
      const models = Array.isArray(data?.data)
        ? data.data.map((m: any) => ({ name: m.id || m.name }))
        : [];
      return { success: true, models };
    } catch (err: any) {
      return {
        success: false,
        models: [],
        error: err.name === 'AbortError' ? 'Connection timed out' : (err.message || 'Failed to connect to LLM server'),
      };
    }
  }

  public async streamTranslate(
    request: TranslationRequest,
    onChunk: (chunk: string) => void,
    signal: AbortSignal
  ): Promise<{ success: boolean; result: string; error?: string }> {
    const config = request.config || {
      provider: 'openai-compatible' as const,
      endpointUrl: 'https://api.openai.com/v1',
      model: request.model || 'gpt-4o-mini',
    };
    const model = request.model || config.model || 'gpt-4o-mini';
    const systemPrompt = SYSTEM_TRANSLATION_PROMPT(request.targetLanguage);
    const chatUrl = this.normalizeChatUrl(config.endpointUrl);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (config.apiKey && config.apiKey.trim()) {
        headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
      }

      const response = await fetch(chatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: request.text },
          ],
          temperature: 0.2,
          stream: true,
        }),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return { success: false, result: '', error: `Server error (${response.status}): ${errorText}` };
      }

      if (!response.body) {
        return { success: false, result: '', error: 'Response body is empty' };
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

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || !line.startsWith('data:')) continue;
          const dataStr = line.replace(/^data:\s*/, '');
          if (dataStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(dataStr);
            const deltaContent = parsed.choices?.[0]?.delta?.content || '';
            if (deltaContent) {
              fullText += deltaContent;
              onChunk(deltaContent);
            }
          } catch {
            // Ignore partial JSON chunks
          }
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

