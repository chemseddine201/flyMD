import { AgentEffortLevel } from '../types/agents';

export interface SubscriptionTierDefinition {
  id: string;
  label: string;
  priceNote?: string;
  description: string;
}

export interface ModelCatalogEntry {
  id: string;
  displayName: string;
  family: 'anthropic' | 'google' | 'openai' | 'deepseek' | 'ollama' | 'other';
  providerIds: string[]; // compatible agent / provider IDs
  category: 'flagship' | 'reasoning' | 'fast' | 'balanced' | 'local';
  supportsReasoning: boolean;
  supportedEffortLevels: AgentEffortLevel[];
  defaultEffortLevel: AgentEffortLevel;
  supportsThinkingToggle: boolean;
  contextWindowTokens: number;
  minTier?: string;
  recommendedFor?: string[];
  description: string;
}

export const SUBSCRIPTION_TIERS: Record<string, SubscriptionTierDefinition[]> = {
  'claude-code': [
    { id: 'free', label: 'Anthropic Free Tier', description: 'Basic tier with strict rate limits' },
    { id: 'pro', label: 'Claude Pro ($20/mo)', description: '5x higher usage, Sonnet 3.7 priority, extended thinking' },
    { id: 'team', label: 'Claude Team / Max', description: 'Maximum rate limits, priority Sonnet 3.7 & Opus' },
    { id: 'api', label: 'Anthropic Direct API', description: 'Pay-as-you-go developer API keys (Tier 1-4)' },
  ],
  'antigravity': [
    { id: 'free', label: 'Google AI Studio (Free)', description: 'Free tier with rate limits on Gemini 2.5' },
    { id: 'advanced', label: 'Gemini Advanced / Google One ($20/mo)', description: 'Full Gemini 2.5 Pro access with 1M-2M context' },
    { id: 'vertex', label: 'Google Cloud Vertex AI', description: 'Enterprise enterprise quota with pay-as-you-go billing' },
  ],
  'openai': [
    { id: 'free', label: 'OpenAI Free', description: 'Standard GPT-4o-mini access' },
    { id: 'plus', label: 'ChatGPT Plus ($20/mo)', description: 'Access to o1, o3-mini, GPT-4o' },
    { id: 'team', label: 'ChatGPT Team / Pro', description: 'High limits on o1 and full reasoning models' },
    { id: 'api', label: 'OpenAI Developer API (Tier 1-5)', description: 'Direct developer API access pay-as-you-go' },
  ],
  'opencode': [
    { id: 'open', label: 'Standard Open Source / CLI', description: 'Configurable multi-model gateway' },
  ],
  'deepseek': [
    { id: 'api', label: 'DeepSeek Official API', description: 'Ultra-low cost high reasoning API for R1 and V3' },
    { id: 'local', label: 'Self-Hosted / Local', description: 'Self-hosted DeepSeek R1 / V3 deployment' },
  ],
  'ollama': [
    { id: 'local', label: 'Ollama Local Runtime', description: 'Locally quantized weights running on GPU / CPU' },
  ],
};

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  // Anthropic Models
  {
    id: 'claude-3-7-sonnet',
    displayName: 'Claude 3.7 Sonnet (Hybrid Reasoning)',
    family: 'anthropic',
    providerIds: ['claude-code', 'anthropic'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
    defaultEffortLevel: 'medium',
    supportsThinkingToggle: true,
    contextWindowTokens: 200000,
    minTier: 'pro',
    description: 'Premier hybrid model with instantaneous answering or dynamically extended thinking up to 64k tokens.',
  },
  {
    id: 'claude-3-5-sonnet',
    displayName: 'Claude 3.5 Sonnet',
    family: 'anthropic',
    providerIds: ['claude-code', 'anthropic'],
    category: 'flagship',
    supportsReasoning: false,
    supportedEffortLevels: ['low', 'medium', 'high'],
    defaultEffortLevel: 'medium',
    supportsThinkingToggle: false,
    contextWindowTokens: 200000,
    description: 'Industry benchmark for code generation and architectural synthesis.',
  },
  {
    id: 'claude-3-5-haiku',
    displayName: 'Claude 3.5 Haiku',
    family: 'anthropic',
    providerIds: ['claude-code', 'anthropic'],
    category: 'fast',
    supportsReasoning: false,
    supportedEffortLevels: ['low'],
    defaultEffortLevel: 'low',
    supportsThinkingToggle: false,
    contextWindowTokens: 200000,
    description: 'Ultra-fast sub-second latency for lightweight file inspection and formatting.',
  },

  // Google Gemini Models
  {
    id: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro (Deep Reasoning)',
    family: 'google',
    providerIds: ['antigravity', 'gemini-antigravity', 'gemini'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
    defaultEffortLevel: 'high',
    supportsThinkingToggle: true,
    contextWindowTokens: 1000000,
    minTier: 'advanced',
    description: 'Deep multimodal reasoning with up to 1M token context for massive codebase digestion.',
  },
  {
    id: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    family: 'google',
    providerIds: ['antigravity', 'gemini-antigravity', 'gemini'],
    category: 'fast',
    supportsReasoning: false,
    supportedEffortLevels: ['low', 'medium'],
    defaultEffortLevel: 'low',
    supportsThinkingToggle: false,
    contextWindowTokens: 1000000,
    description: 'High-speed 1M context engine ideal for fast pipeline loops and quick linting.',
  },
  {
    id: 'gemini-2.0-flash-thinking',
    displayName: 'Gemini 2.0 Flash Thinking',
    family: 'google',
    providerIds: ['antigravity', 'gemini-antigravity', 'gemini'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high'],
    defaultEffortLevel: 'medium',
    supportsThinkingToggle: true,
    contextWindowTokens: 1000000,
    description: 'Low-latency native thinking trace streaming directly from Google DeepMind.',
  },

  // OpenAI Models
  {
    id: 'o3-mini',
    displayName: 'OpenAI o3-mini',
    family: 'openai',
    providerIds: ['openai', 'opencode'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high'],
    defaultEffortLevel: 'medium',
    supportsThinkingToggle: true,
    contextWindowTokens: 200000,
    minTier: 'plus',
    description: 'Fast, cost-effective reasoning model specialized for math, science, and coding.',
  },
  {
    id: 'o1',
    displayName: 'OpenAI o1',
    family: 'openai',
    providerIds: ['openai', 'opencode'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high', 'max'],
    defaultEffortLevel: 'high',
    supportsThinkingToggle: true,
    contextWindowTokens: 200000,
    minTier: 'plus',
    description: 'Full-depth deliberation model for difficult architectural and debugging challenges.',
  },
  {
    id: 'gpt-4o',
    displayName: 'GPT-4o (Omni)',
    family: 'openai',
    providerIds: ['openai', 'opencode'],
    category: 'flagship',
    supportsReasoning: false,
    supportedEffortLevels: ['low', 'medium'],
    defaultEffortLevel: 'medium',
    supportsThinkingToggle: false,
    contextWindowTokens: 128000,
    description: 'Flagship non-reasoning multimodal model with reliable tool calling and speed.',
  },
  {
    id: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    family: 'openai',
    providerIds: ['openai', 'opencode'],
    category: 'fast',
    supportsReasoning: false,
    supportedEffortLevels: ['low'],
    defaultEffortLevel: 'low',
    supportsThinkingToggle: false,
    contextWindowTokens: 128000,
    description: 'Lightweight model with low latency and economical pricing.',
  },

  // DeepSeek Models
  {
    id: 'deepseek-reasoner',
    displayName: 'DeepSeek R1 (Reasoner)',
    family: 'deepseek',
    providerIds: ['deepseek', 'opencode'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high', 'xhigh'],
    defaultEffortLevel: 'high',
    supportsThinkingToggle: true,
    contextWindowTokens: 64000,
    description: 'Open-weights reasoning model with explicit `<think>` verification loops.',
  },
  {
    id: 'deepseek-chat',
    displayName: 'DeepSeek V3 (Chat)',
    family: 'deepseek',
    providerIds: ['deepseek', 'opencode'],
    category: 'balanced',
    supportsReasoning: false,
    supportedEffortLevels: ['low', 'medium'],
    defaultEffortLevel: 'medium',
    supportsThinkingToggle: false,
    contextWindowTokens: 64000,
    description: '671B parameter Mixture-of-Experts model for general code generation.',
  },

  // Local / Ollama Models
  {
    id: 'qwen2.5-coder:32b',
    displayName: 'Qwen 2.5 Coder 32B (Local)',
    family: 'ollama',
    providerIds: ['ollama', 'opencode'],
    category: 'local',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high'],
    defaultEffortLevel: 'medium',
    supportsThinkingToggle: true,
    contextWindowTokens: 32000,
    description: 'Top-tier local coding model running offline on consumer GPUs.',
  },
  {
    id: 'deepseek-r1:14b',
    displayName: 'DeepSeek R1 14B (Local)',
    family: 'ollama',
    providerIds: ['ollama', 'opencode'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high'],
    defaultEffortLevel: 'medium',
    supportsThinkingToggle: true,
    contextWindowTokens: 32000,
    description: 'Quantized local distillation of DeepSeek R1 for private offline reasoning.',
  },
  {
    id: 'llama3.3:70b',
    displayName: 'Llama 3.3 70B (Local)',
    family: 'ollama',
    providerIds: ['ollama', 'opencode'],
    category: 'local',
    supportsReasoning: false,
    supportedEffortLevels: ['low', 'medium'],
    defaultEffortLevel: 'medium',
    supportsThinkingToggle: false,
    contextWindowTokens: 32000,
    description: 'State of the art open source 70B foundation model running locally via Ollama.',
  },
];

export const EFFORT_DESCRIPTIONS: Record<
  AgentEffortLevel,
  { label: string; badge: string; desc: string }
> = {
  low: {
    label: 'Low',
    badge: '1k-4k tokens',
    desc: 'Rapid synthesis, brief self-correction, minimum token consumption.',
  },
  medium: {
    label: 'Medium',
    badge: '4k-16k tokens',
    desc: 'Balanced reasoning with systematic verification and invariant checks.',
  },
  high: {
    label: 'High',
    badge: '16k-32k tokens',
    desc: 'Deep multi-step exploration, architectural audit, edge-case probing.',
  },
  xhigh: {
    label: 'X-High',
    badge: '32k-48k tokens',
    desc: 'Exhaustive deliberation, complex cross-file dependency proofs.',
  },
  max: {
    label: 'Max',
    badge: '48k-64k tokens',
    desc: 'Unbounded reasoning budget up to provider ceiling for maximum fidelity.',
  },
};

/**
 * Determines whether a given model slug supports extended reasoning/thinking traces.
 * Detects both registered catalog models and dynamic naming patterns (e.g., r1, thinking, o1, o3, sonnet-3-7).
 */
export function isReasoningModel(modelId?: string): boolean {
  if (!modelId) return false;
  const match = MODEL_CATALOG.find(
    (m) => m.id.toLowerCase() === modelId.toLowerCase()
  );
  if (match) return match.supportsReasoning;

  const lower = modelId.toLowerCase();
  return (
    lower.includes('reason') ||
    lower.includes('think') ||
    lower.includes('claude-3-7') ||
    lower.includes('o1') ||
    lower.includes('o3') ||
    lower.includes('r1')
  );
}

/**
 * Returns available model options for a specific agent or provider id, optionally taking
 * subscription tier into account.
 */
export function getAvailableModelsForAgent(
  agentOrProviderId: string,
  _subscriptionTier?: string
): ModelCatalogEntry[] {
  const norm = agentOrProviderId.toLowerCase();
  const matched = MODEL_CATALOG.filter((m) =>
    m.providerIds.some(
      (pid) =>
        pid.toLowerCase() === norm ||
        (norm.includes('claude') && pid === 'claude-code') ||
        (norm.includes('gemini') && pid === 'antigravity') ||
        (norm.includes('open') && pid === 'opencode') ||
        (norm.includes('ollama') && pid === 'ollama')
    )
  );

  return matched.length > 0 ? matched : MODEL_CATALOG;
}

/**
 * Returns the default model ID for an agent based on its capabilities.
 */
export function getDefaultModelForAgent(agentId: string): string {
  switch (agentId.toLowerCase()) {
    case 'claude-code':
      return 'claude-3-7-sonnet';
    case 'antigravity':
    case 'gemini-antigravity':
      return 'gemini-2.5-pro';
    case 'opencode':
      return 'o3-mini';
    case 'openai':
      return 'o3-mini';
    case 'deepseek':
      return 'deepseek-reasoner';
    case 'ollama':
      return 'qwen2.5-coder:32b';
    default:
      return 'claude-3-7-sonnet';
  }
}
