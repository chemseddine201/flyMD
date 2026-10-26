import { LLMConfig, TranslationRequest } from '../../../shared/types';
import { LlmTestConnectionResult, LlmGetModelsResult } from '../../../shared/ipc';

export const SYSTEM_TRANSLATION_PROMPT = (targetLanguage: string): string =>
  `You are an expert technical translator. Translate the given Markdown text into ${targetLanguage}.
STRICT RULES:
1. Preserve all Markdown structure, syntax, headers (#, ##), bold (**), italic (*), code blocks (\`\`\`), inline code (\`), blockquotes (>), lists (- / 1.), and tables (|---|) exactly.
2. DO NOT translate code identifiers, URLs, programming code, KaTeX math blocks ($...$ or $$...$$), or HTML tags.
3. Output ONLY the translated Markdown content. Do not include any greeting, preamble, explanations, or conversational filler.`;

export interface LlmProvider {
  testConnection(config: LLMConfig): Promise<LlmTestConnectionResult>;
  listModels(config: LLMConfig): Promise<LlmGetModelsResult>;
  streamTranslate(
    request: TranslationRequest,
    onChunk: (chunk: string) => void,
    signal: AbortSignal
  ): Promise<{ success: boolean; result: string; error?: string }>;
}

