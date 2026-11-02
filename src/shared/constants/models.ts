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
    { id: 'pro', label: 'Claude Pro ($20/mo)', description: 'Sonnet 3.7 & Opus 5.5 priority, extended thinking up to 64k' },
    { id: 'team', label: 'Claude Team / Max ($30-100/mo)', description: 'Maximum rate limits, priority Claude Opus 5.5 & Sonnet 3.7' },
    { id: 'api', label: 'Anthropic Direct API', description: 'Pay-as-you-go developer API keys (Tier 1-4)' },
  ],
  'antigravity': [
    { id: 'free', label: 'Google AI Studio (Free)', description: 'Free tier with rate limits on Gemini 2.5 Flash' },
    { id: 'advanced', label: 'Gemini Advanced / Google One ($20/mo)', description: 'Full Gemini 4 Argon & Gemini 2.5 Pro access with 1M-2M context' },
    { id: 'ultra', label: 'Gemini Ultra / Enterprise', description: 'Maximum frontier throughput with unbounded multimodal context' },
    { id: 'vertex', label: 'Google Cloud Vertex AI', description: 'Enterprise quota with pay-as-you-go billing' },
  ],
  'openai': [
    { id: 'free', label: 'OpenAI Free', description: 'Standard GPT-4o-mini access' },
    { id: 'plus', label: 'ChatGPT Plus ($20/mo)', description: 'Access to o3-mini, o1, GPT-4o, ChatGPT-4o Latest' },
    { id: 'team', label: 'ChatGPT Team / Pro ($30-200/mo)', description: 'High limits on o3, o1-pro, and GPT-4.5' },
    { id: 'api', label: 'OpenAI Developer API (Tier 1-5)', description: 'Direct developer API access pay-as-you-go' },
  ],
  'codex': [
    { id: 'free', label: 'OpenAI Free', description: 'Standard GPT-4o-mini access' },
    { id: 'plus', label: 'ChatGPT Plus ($20/mo)', description: 'Access to o3-mini, o1, GPT-4o in Codex CLI' },
    { id: 'team', label: 'ChatGPT Team / Pro', description: 'High limits on o3 and o1-pro full reasoning models' },
    { id: 'api', label: 'OpenAI Developer API', description: 'Pay-as-you-go OPENAI_API_KEY access' },
  ],
  'cursor': [
    { id: 'free', label: 'Cursor Hobby (Free)', description: 'Limited completions and fast model requests' },
    { id: 'pro', label: 'Cursor Pro ($20/mo)', description: 'Frontier requests (Claude Opus 5.5, Claude 3.7, Gemini 4 Argon, o3-mini)' },
    { id: 'business', label: 'Cursor Business', description: 'Team quota & centralized enterprise billing' },
  ],
  'zcode': [
    { id: 'free', label: 'Zed Free Tier', description: 'Basic hosted assistant quota' },
    { id: 'pro', label: 'Zed Pro / BYOK API', description: 'Full Claude Opus 5.5, Sonnet 3.7 & custom API key models' },
  ],
  'opencode': [
    { id: 'open', label: 'Standard Open Source / CLI', description: 'Configurable multi-model gateway (Claude, Gemini, OpenAI, DeepSeek, Ollama)' },
  ],
  'deepseek': [
    { id: 'api', label: 'DeepSeek Official API', description: 'Ultra-low cost high reasoning API for R1 (671B) and V3' },
    { id: 'local', label: 'Self-Hosted / Local', description: 'Self-hosted DeepSeek R1 / V3 deployment' },
  ],
  'ollama': [
    { id: 'local', label: 'Ollama Local Runtime', description: 'Locally quantized weights running on GPU / CPU' },
  ],
};

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  // -------------------------------------------------------------
  // Anthropic / Claude Frontier & Flagship Models
  // -------------------------------------------------------------
  {
    id: 'claude-opus-5-5',
    displayName: 'Claude Opus 5.5 (Frontier Reasoning)',
    family: 'anthropic',
    providerIds: ['claude-code', 'anthropic', 'cursor', 'zcode', 'opencode'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
    defaultEffortLevel: 'high',
    supportsThinkingToggle: true,
    contextWindowTokens: 200000,
    minTier: 'pro',
    description: 'Anthropic next-gen frontier model with deep architectural reasoning, multi-file synthesis, and extreme reliability.',
  },
  {
    id: 'claude-3-7-sonnet',
    displayName: 'Claude 3.7 Sonnet (Hybrid Reasoning)',
    family: 'anthropic',
    providerIds: ['claude-code', 'anthropic', 'cursor', 'zcode', 'opencode'],
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
    id: 'claude-3-7-sonnet-thought',
    displayName: 'Claude 3.7 Sonnet (Extended Thinking)',
    family: 'anthropic',
    providerIds: ['claude-code', 'anthropic', 'cursor', 'zcode', 'opencode'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['medium', 'high', 'xhigh', 'max'],
    defaultEffortLevel: 'high',
    supportsThinkingToggle: true,
    contextWindowTokens: 200000,
    minTier: 'pro',
    description: 'Preconfigured for maximum chain-of-thought exploration with high reasoning token budget.',
  },
  {
    id: 'claude-3-opus',
    displayName: 'Claude 3 Opus (Comprehensive Deliberation)',
    family: 'anthropic',
    providerIds: ['claude-code', 'anthropic', 'cursor', 'zcode', 'opencode'],
    category: 'flagship',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
    defaultEffortLevel: 'high',
    supportsThinkingToggle: true,
    contextWindowTokens: 200000,
    minTier: 'team',
    description: 'Top-tier comprehensive deliberation and high-complexity code evaluation.',
  },
  {
    id: 'claude-3-5-sonnet',
    displayName: 'Claude 3.5 Sonnet (v2)',
    family: 'anthropic',
    providerIds: ['claude-code', 'anthropic', 'cursor', 'zcode', 'opencode'],
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
    providerIds: ['claude-code', 'anthropic', 'cursor', 'zcode', 'opencode'],
    category: 'fast',
    supportsReasoning: false,
    supportedEffortLevels: ['low'],
    defaultEffortLevel: 'low',
    supportsThinkingToggle: false,
    contextWindowTokens: 200000,
    description: 'Ultra-fast sub-second latency for lightweight file inspection and formatting.',
  },

  // -------------------------------------------------------------
  // Google / Gemini / Antigravity Frontier & Flagship Models
  // -------------------------------------------------------------
  {
    id: 'gemini-4-argon',
    displayName: 'Gemini 4 Argon (Frontier Deep Reasoning)',
    family: 'google',
    providerIds: ['antigravity', 'gemini-antigravity', 'gemini', 'cursor', 'opencode'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
    defaultEffortLevel: 'high',
    supportsThinkingToggle: true,
    contextWindowTokens: 2000000,
    minTier: 'advanced',
    description: 'Google DeepMind next-generation flagship reasoning engine with native multimodal understanding and 2M context.',
  },
  {
    id: 'gemini-3.8-flash',
    displayName: 'Gemini 3.8 Flash (High-Speed Frontier)',
    family: 'google',
    providerIds: ['antigravity', 'gemini-antigravity', 'gemini', 'cursor', 'opencode'],
    category: 'fast',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high'],
    defaultEffortLevel: 'medium',
    supportsThinkingToggle: true,
    contextWindowTokens: 1000000,
    minTier: 'advanced',
    description: 'High-speed frontier model with low latency and native thinking capability for rapid iterations.',
  },
  {
    id: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro (Deep Reasoning 1M)',
    family: 'google',
    providerIds: ['antigravity', 'gemini-antigravity', 'gemini', 'cursor', 'opencode'],
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
    providerIds: ['antigravity', 'gemini-antigravity', 'gemini', 'cursor', 'opencode'],
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
    providerIds: ['antigravity', 'gemini-antigravity', 'gemini', 'cursor', 'opencode'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high'],
    defaultEffortLevel: 'medium',
    supportsThinkingToggle: true,
    contextWindowTokens: 1000000,
    description: 'Low-latency native thinking trace streaming directly from Google DeepMind.',
  },
  {
    id: 'gemini-2.0-pro-exp-02-05',
    displayName: 'Gemini 2.0 Pro Experimental',
    family: 'google',
    providerIds: ['antigravity', 'gemini-antigravity', 'gemini', 'cursor', 'opencode'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
    defaultEffortLevel: 'high',
    supportsThinkingToggle: true,
    contextWindowTokens: 2000000,
    minTier: 'advanced',
    description: 'Experimental frontier model with superior reasoning, math, and code intelligence.',
  },
  {
    id: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro (2M Context)',
    family: 'google',
    providerIds: ['antigravity', 'gemini-antigravity', 'gemini', 'cursor', 'opencode'],
    category: 'flagship',
    supportsReasoning: false,
    supportedEffortLevels: ['low', 'medium', 'high'],
    defaultEffortLevel: 'medium',
    supportsThinkingToggle: false,
    contextWindowTokens: 2000000,
    description: 'Massive 2M token context window model for full repository and log ingestion.',
  },
  {
    id: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    family: 'google',
    providerIds: ['antigravity', 'gemini-antigravity', 'gemini', 'cursor', 'opencode'],
    category: 'fast',
    supportsReasoning: false,
    supportedEffortLevels: ['low'],
    defaultEffortLevel: 'low',
    supportsThinkingToggle: false,
    contextWindowTokens: 1000000,
    description: 'High-efficiency low-cost model for rapid document processing.',
  },

  // -------------------------------------------------------------
  // OpenAI / Codex / ChatGPT Frontier Models
  // -------------------------------------------------------------
  {
    id: 'o3',
    displayName: 'OpenAI o3 (Frontier Reasoning)',
    family: 'openai',
    providerIds: ['openai', 'codex', 'opencode', 'cursor', 'http-llm'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
    defaultEffortLevel: 'high',
    supportsThinkingToggle: true,
    contextWindowTokens: 200000,
    minTier: 'plus',
    description: 'Most powerful OpenAI frontier reasoning model designed for complex coding and deep architecture.',
  },
  {
    id: 'o3-mini',
    displayName: 'OpenAI o3-mini (High-Speed Reasoning)',
    family: 'openai',
    providerIds: ['openai', 'codex', 'opencode', 'cursor', 'http-llm'],
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
    id: 'o1-pro',
    displayName: 'OpenAI o1 Pro (Maximum Deliberation)',
    family: 'openai',
    providerIds: ['openai', 'codex', 'opencode', 'cursor', 'http-llm'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['medium', 'high', 'xhigh', 'max'],
    defaultEffortLevel: 'max',
    supportsThinkingToggle: true,
    contextWindowTokens: 200000,
    minTier: 'team',
    description: 'Uncapped reasoning compute model for the most intricate algorithmic verification challenges.',
  },
  {
    id: 'o1',
    displayName: 'OpenAI o1',
    family: 'openai',
    providerIds: ['openai', 'codex', 'opencode', 'cursor', 'http-llm'],
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
    id: 'o1-mini',
    displayName: 'OpenAI o1-mini',
    family: 'openai',
    providerIds: ['openai', 'codex', 'opencode', 'cursor', 'http-llm'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high'],
    defaultEffortLevel: 'medium',
    supportsThinkingToggle: true,
    contextWindowTokens: 128000,
    minTier: 'plus',
    description: 'Lightweight reasoning model optimized for code and math.',
  },
  {
    id: 'gpt-4.5-preview',
    displayName: 'GPT-4.5 Preview (Orion Flagship)',
    family: 'openai',
    providerIds: ['openai', 'codex', 'opencode', 'cursor', 'http-llm'],
    category: 'flagship',
    supportsReasoning: false,
    supportedEffortLevels: ['low', 'medium', 'high'],
    defaultEffortLevel: 'medium',
    supportsThinkingToggle: false,
    contextWindowTokens: 128000,
    minTier: 'team',
    description: 'Massive world knowledge flagship model with rich context intuition and language depth.',
  },
  {
    id: 'chatgpt-4o-latest',
    displayName: 'ChatGPT-4o Latest (Dynamic Omni)',
    family: 'openai',
    providerIds: ['openai', 'codex', 'opencode', 'cursor', 'http-llm'],
    category: 'flagship',
    supportsReasoning: false,
    supportedEffortLevels: ['low', 'medium'],
    defaultEffortLevel: 'medium',
    supportsThinkingToggle: false,
    contextWindowTokens: 128000,
    description: 'Continuously updated production GPT-4o model used in ChatGPT Plus.',
  },
  {
    id: 'gpt-4o',
    displayName: 'GPT-4o (Omni)',
    family: 'openai',
    providerIds: ['openai', 'codex', 'opencode', 'cursor', 'http-llm'],
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
    providerIds: ['openai', 'codex', 'opencode', 'cursor', 'http-llm'],
    category: 'fast',
    supportsReasoning: false,
    supportedEffortLevels: ['low'],
    defaultEffortLevel: 'low',
    supportsThinkingToggle: false,
    contextWindowTokens: 128000,
    description: 'Lightweight model with low latency and economical pricing.',
  },

  // -------------------------------------------------------------
  // DeepSeek Reasoning & Coding Models
  // -------------------------------------------------------------
  {
    id: 'deepseek-reasoner',
    displayName: 'DeepSeek R1 (Reasoner 671B)',
    family: 'deepseek',
    providerIds: ['deepseek', 'opencode', 'cursor', 'ollama'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high', 'xhigh'],
    defaultEffortLevel: 'high',
    supportsThinkingToggle: true,
    contextWindowTokens: 64000,
    description: 'Open-weights reasoning model with explicit <think> verification loops.',
  },
  {
    id: 'deepseek-chat',
    displayName: 'DeepSeek V3 (Chat 671B MoE)',
    family: 'deepseek',
    providerIds: ['deepseek', 'opencode', 'cursor', 'ollama'],
    category: 'balanced',
    supportsReasoning: false,
    supportedEffortLevels: ['low', 'medium'],
    defaultEffortLevel: 'medium',
    supportsThinkingToggle: false,
    contextWindowTokens: 64000,
    description: '671B parameter Mixture-of-Experts model for general code generation.',
  },
  {
    id: 'deepseek-r1',
    displayName: 'DeepSeek R1',
    family: 'deepseek',
    providerIds: ['deepseek', 'opencode', 'cursor', 'ollama'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high', 'xhigh'],
    defaultEffortLevel: 'high',
    supportsThinkingToggle: true,
    contextWindowTokens: 64000,
    description: 'DeepSeek R1 reasoning alias.',
  },

  // -------------------------------------------------------------
  // Local / Ollama Quantized Coding Models
  // -------------------------------------------------------------
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
    id: 'qwen2.5-coder:14b',
    displayName: 'Qwen 2.5 Coder 14B (Local)',
    family: 'ollama',
    providerIds: ['ollama', 'opencode'],
    category: 'local',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium'],
    defaultEffortLevel: 'medium',
    supportsThinkingToggle: true,
    contextWindowTokens: 32000,
    description: 'Medium footprint local coding model for laptops and 16GB VRAM.',
  },
  {
    id: 'deepseek-r1:70b',
    displayName: 'DeepSeek R1 70B (Local Distill)',
    family: 'ollama',
    providerIds: ['ollama', 'opencode'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high', 'xhigh'],
    defaultEffortLevel: 'high',
    supportsThinkingToggle: true,
    contextWindowTokens: 64000,
    description: 'Large local distillation of DeepSeek R1 for private on-prem reasoning.',
  },
  {
    id: 'deepseek-r1:14b',
    displayName: 'DeepSeek R1 14B (Local Distill)',
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
  {
    id: 'codestral:22b',
    displayName: 'Mistral Codestral 22B (Local)',
    family: 'ollama',
    providerIds: ['ollama', 'opencode'],
    category: 'local',
    supportsReasoning: false,
    supportedEffortLevels: ['low', 'medium'],
    defaultEffortLevel: 'medium',
    supportsThinkingToggle: false,
    contextWindowTokens: 32000,
    description: 'Mistral AI specialized 22B coding model with 32k context.',
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
 * Detects registered catalog models, dynamic naming patterns (e.g. r1, thinking, o1, o3, sonnet-3-7, opus-5, argon).
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
    lower.includes('opus-5') ||
    lower.includes('claude-3-7') ||
    lower.includes('argon') ||
    lower.includes('gemini-4') ||
    lower.includes('gemini-3.8') ||
    lower.includes('gemini-2.5-pro') ||
    lower.includes('gemini-2.0-pro') ||
    lower.includes('o3') ||
    lower.includes('o1') ||
    lower.includes('r1')
  );
}

const TIER_RANK_BY_NAME: Record<string, number> = {
  free: 0,
  hobby: 0,
  pro: 1,
  plus: 1,
  advanced: 1,
  open: 2,
  local: 2,
  custom: 2,
  team: 2,
  business: 2,
  max: 3,
  ultra: 3,
  vertex: 3,
  api: 3,
  enterprise: 3,
};

/**
 * Returns available model options for a specific agent or provider id.
 * NEVER hides advanced models from the options list; instead, ranks and badges models so that
 * the user can freely select any model in their subscription, with frontier and reasoning models
 * prioritized at the top of the dropdown.
 */
export function getAvailableModelsForAgent(
  agentOrProviderId: string,
  subscriptionTier?: string,
  dynamicRuntimeModels?: string[]
): ModelCatalogEntry[] {
  const norm = (agentOrProviderId || '').toLowerCase().trim();
  const matched = MODEL_CATALOG.filter((m) =>
    m.providerIds.some(
      (pid) =>
        pid.toLowerCase() === norm ||
        ((norm.includes('claude') || norm === 'zcode' || norm === 'cursor' || norm === 'anthropic') &&
          pid === 'claude-code') ||
        ((norm.includes('gemini') || norm.includes('antigravity') || norm === 'cursor') &&
          pid === 'antigravity') ||
        ((norm.includes('open') || norm === 'codex' || norm === 'http-llm' || norm === 'cursor') &&
          pid === 'openai') ||
        (norm.includes('deepseek') && pid === 'deepseek') ||
        (norm.includes('ollama') && pid === 'ollama')
    )
  );

  const baseList = matched.length > 0 ? matched : MODEL_CATALOG;

  // Enhance each model with clear badges
  const enrichedList = baseList.map((m) => {
    let tag = '';
    if (m.minTier && m.minTier !== 'free') {
      tag = ` [${m.minTier.toUpperCase()}]`;
    } else if (m.category === 'reasoning') {
      tag = ' [REASONING]';
    }
    return {
      ...m,
      displayName: m.displayName.includes('[') ? m.displayName : `${m.displayName}${tag}`,
    };
  });

  // Sort so Frontier Reasoning models and Flagship models appear first
  const sortedCatalog = [...enrichedList].sort((a, b) => {
    const scoreA = (a.supportsReasoning ? 10 : 0) + (a.category === 'reasoning' ? 5 : a.category === 'flagship' ? 3 : 0);
    const scoreB = (b.supportsReasoning ? 10 : 0) + (b.category === 'reasoning' ? 5 : b.category === 'flagship' ? 3 : 0);
    return scoreB - scoreA;
  });

  if (!dynamicRuntimeModels || dynamicRuntimeModels.length === 0) {
    return sortedCatalog;
  }

  const seen = new Set(sortedCatalog.map((m) => m.id.toLowerCase()));
  const dynamicEntries: ModelCatalogEntry[] = [];
  for (const rawModel of dynamicRuntimeModels) {
    const slug = rawModel.trim();
    if (!slug || seen.has(slug.toLowerCase())) continue;
    seen.add(slug.toLowerCase());
    const reasoning = isReasoningModel(slug);
    dynamicEntries.push({
      id: slug,
      displayName: `${slug} [LIVE DETECTED]`,
      family: norm.includes('ollama') ? 'ollama' : 'other',
      providerIds: [agentOrProviderId],
      category: reasoning ? 'reasoning' : norm.includes('ollama') ? 'local' : 'flagship',
      supportsReasoning: reasoning,
      supportedEffortLevels: reasoning
        ? ['low', 'medium', 'high', 'xhigh', 'max']
        : ['low', 'medium', 'high'],
      defaultEffortLevel: 'medium',
      supportsThinkingToggle: reasoning,
      contextWindowTokens: 200000,
      description: `Live detected model for ${agentOrProviderId}`,
    });
  }

  return [...dynamicEntries, ...sortedCatalog];
}

/**
 * Returns the default model ID for an agent respecting the user's subscription tier.
 */
export function getDefaultModelForAgent(
  agentId: string,
  subscriptionTier?: string
): string {
  const isFree = subscriptionTier?.toLowerCase() === 'free';
  const tier = (subscriptionTier || '').toLowerCase();
  const hasHighTier = ['pro', 'plus', 'advanced', 'team', 'max', 'vertex', 'api', 'ultra', 'enterprise'].includes(tier);

  switch (agentId.toLowerCase()) {
    case 'claude-code':
    case 'anthropic':
      if (hasHighTier) return 'claude-opus-5-5';
      return isFree ? 'claude-3-5-sonnet' : 'claude-3-7-sonnet';
    case 'antigravity':
    case 'gemini-antigravity':
    case 'gemini':
      if (hasHighTier) return 'gemini-4-argon';
      return isFree ? 'gemini-2.5-flash' : 'gemini-2.5-pro';
    case 'codex':
    case 'opencode':
    case 'openai':
    case 'http-llm':
      if (hasHighTier) return 'o3-mini';
      return isFree ? 'gpt-4o-mini' : 'o3-mini';
    case 'cursor':
      return hasHighTier ? 'claude-opus-5-5' : 'claude-3-7-sonnet';
    case 'zcode':
      return hasHighTier ? 'claude-opus-5-5' : 'claude-3-7-sonnet';
    case 'deepseek':
      return 'deepseek-reasoner';
    case 'ollama':
      return 'qwen2.5-coder:32b';
    case 'mock':
      return 'adaptive-domain-simulator';
    default: {
      const entitled = getAvailableModelsForAgent(agentId, subscriptionTier);
      return entitled[0]?.id || 'claude-opus-5-5';
    }
  }
}
