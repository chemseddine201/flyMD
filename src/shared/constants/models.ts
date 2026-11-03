import { AgentEffortLevel, FetchedAgentModel } from '../types/agents';

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
    { id: 'pro', label: 'Claude Pro ($20/mo)', description: 'Opus 5.5 & Sonnet 5.5 priority, extended thinking up to 64k' },
    { id: 'team', label: 'Claude Team / Max ($30-100/mo)', description: 'Maximum rate limits, priority Claude Opus 5.5 & Sonnet 5.5' },
    { id: 'api', label: 'Anthropic Direct API', description: 'Pay-as-you-go developer API keys (Tier 1-4)' },
  ],
  'antigravity': [
    { id: 'free', label: 'Antigravity Basic', description: 'Gemini 3.8 Flash & Gemini 4 Argon subscription access' },
    { id: 'advanced', label: 'Antigravity Subscription', description: 'Gemini 4 Argon, Gemini 3.8 Flash, Claude Opus 5.5, Claude Sonnet 5.5 & GPT-OSS 120B' },
    { id: 'ultra', label: 'Antigravity Ultra / Enterprise', description: 'Maximum frontier throughput across all Antigravity models' },
    { id: 'vertex', label: 'Google Cloud Vertex AI', description: 'Enterprise quota with pay-as-you-go billing' },
  ],
  'openai': [
    { id: 'free', label: 'OpenAI Free', description: 'Standard GPT-4o access' },
    { id: 'plus', label: 'ChatGPT Plus ($20/mo)', description: 'Access to o3-mini, o3, GPT-4o' },
    { id: 'team', label: 'ChatGPT Team / Pro ($30-200/mo)', description: 'High limits on o3 and o3-mini' },
    { id: 'api', label: 'OpenAI Developer API (Tier 1-5)', description: 'Direct developer API access pay-as-you-go' },
  ],
  'codex': [
    { id: 'free', label: 'OpenAI Free', description: 'Standard GPT-4o access' },
    { id: 'plus', label: 'ChatGPT Plus ($20/mo)', description: 'Access to o3-mini, o3, GPT-4o in Codex CLI' },
    { id: 'team', label: 'ChatGPT Team / Pro', description: 'High limits on o3 and o3-mini full reasoning models' },
    { id: 'api', label: 'OpenAI Developer API', description: 'Pay-as-you-go OPENAI_API_KEY access' },
  ],
  'cursor': [
    { id: 'free', label: 'Cursor Hobby (Free)', description: 'Limited completions and fast model requests' },
    { id: 'pro', label: 'Cursor Pro ($20/mo)', description: 'Frontier requests (Claude Opus 5.5, Sonnet 5.5, Gemini 4 Argon, o3-mini)' },
    { id: 'business', label: 'Cursor Business', description: 'Team quota & centralized enterprise billing' },
  ],
  'zcode': [
    { id: 'free', label: 'Zed Free Tier', description: 'Basic hosted assistant quota' },
    { id: 'pro', label: 'Zed Pro / BYOK API', description: 'Full Claude Opus 5.5, Sonnet 5.5 & custom API key models' },
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
  // Antigravity (`agy models`) Verified Subscription Models
  // -------------------------------------------------------------
  {
    id: 'gemini-4-argon',
    displayName: 'Gemini 4 Argon',
    family: 'google',
    providerIds: ['antigravity', 'gemini-antigravity', 'gemini', 'cursor', 'opencode'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high'],
    defaultEffortLevel: 'high',
    supportsThinkingToggle: true,
    contextWindowTokens: 2000000,
    description: 'Google DeepMind flagship reasoning engine via Antigravity subscription (Low / Medium / High effort).',
  },
  {
    id: 'gemini-3.8-flash',
    displayName: 'Gemini 3.8 Flash',
    family: 'google',
    providerIds: ['antigravity', 'gemini-antigravity', 'gemini', 'cursor', 'opencode'],
    category: 'fast',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high'],
    defaultEffortLevel: 'high',
    supportsThinkingToggle: true,
    contextWindowTokens: 1000000,
    description: 'High-speed frontier model with native reasoning via Antigravity subscription (Low / Medium / High effort).',
  },
  {
    id: 'gpt-oss-120b',
    displayName: 'GPT-OSS 120B',
    family: 'openai',
    providerIds: ['antigravity', 'gemini-antigravity', 'opencode'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['medium'],
    defaultEffortLevel: 'medium',
    supportsThinkingToggle: true,
    contextWindowTokens: 128000,
    description: 'GPT-OSS 120B open-weights model on Antigravity subscription (Medium effort).',
  },

  // -------------------------------------------------------------
  // Anthropic / Claude Code (`claude`) & Antigravity Shared Models
  // -------------------------------------------------------------
  {
    id: 'claude-opus-5-5',
    displayName: 'Claude Opus 5.5',
    family: 'anthropic',
    providerIds: ['claude-code', 'anthropic', 'antigravity', 'gemini-antigravity', 'cursor', 'zcode', 'opencode'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
    defaultEffortLevel: 'high',
    supportsThinkingToggle: true,
    contextWindowTokens: 200000,
    description: 'Anthropic frontier model with deep architectural reasoning and multi-file synthesis.',
  },
  {
    id: 'claude-sonnet-5-5',
    displayName: 'Claude Sonnet 5.5',
    family: 'anthropic',
    providerIds: ['claude-code', 'anthropic', 'antigravity', 'gemini-antigravity', 'cursor', 'zcode', 'opencode'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
    defaultEffortLevel: 'high',
    supportsThinkingToggle: true,
    contextWindowTokens: 200000,
    description: 'Balanced high-speed reasoning model supported across Claude Code and Antigravity.',
  },
  {
    id: 'opus',
    displayName: 'Claude Opus (Latest Alias)',
    family: 'anthropic',
    providerIds: ['claude-code', 'anthropic'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
    defaultEffortLevel: 'high',
    supportsThinkingToggle: true,
    contextWindowTokens: 200000,
    description: 'Claude Code CLI alias pointing to the latest Opus subscription model.',
  },
  {
    id: 'sonnet',
    displayName: 'Claude Sonnet (Latest Alias)',
    family: 'anthropic',
    providerIds: ['claude-code', 'anthropic'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
    defaultEffortLevel: 'high',
    supportsThinkingToggle: true,
    contextWindowTokens: 200000,
    description: 'Claude Code CLI alias pointing to the latest Sonnet subscription model.',
  },
  {
    id: 'haiku',
    displayName: 'Claude Haiku (Fast Alias)',
    family: 'anthropic',
    providerIds: ['claude-code', 'anthropic'],
    category: 'fast',
    supportsReasoning: false,
    supportedEffortLevels: ['low', 'medium', 'high'],
    defaultEffortLevel: 'medium',
    supportsThinkingToggle: false,
    contextWindowTokens: 200000,
    description: 'Claude Code CLI alias pointing to the fast Haiku subscription model.',
  },

  // -------------------------------------------------------------
  // OpenAI / Codex Subscription Models
  // -------------------------------------------------------------
  {
    id: 'o3-mini',
    displayName: 'OpenAI o3-mini',
    family: 'openai',
    providerIds: ['openai', 'codex', 'opencode', 'cursor', 'http-llm'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high'],
    defaultEffortLevel: 'high',
    supportsThinkingToggle: true,
    contextWindowTokens: 200000,
    description: 'Fast reasoning model specialized for coding and architecture.',
  },
  {
    id: 'o3',
    displayName: 'OpenAI o3',
    family: 'openai',
    providerIds: ['openai', 'codex', 'opencode', 'cursor', 'http-llm'],
    category: 'reasoning',
    supportsReasoning: true,
    supportedEffortLevels: ['low', 'medium', 'high', 'xhigh'],
    defaultEffortLevel: 'high',
    supportsThinkingToggle: true,
    contextWindowTokens: 200000,
    description: 'Deep reasoning model for complex coding and architecture.',
  },
  {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    family: 'openai',
    providerIds: ['openai', 'codex', 'opencode', 'cursor', 'http-llm'],
    category: 'flagship',
    supportsReasoning: false,
    supportedEffortLevels: ['low', 'medium', 'high'],
    defaultEffortLevel: 'medium',
    supportsThinkingToggle: false,
    contextWindowTokens: 128000,
    description: 'Flagship multimodal model with reliable tool calling.',
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
];

// Live runtime cache populated when the user clicks the Fetch Models button in the picker
const LIVE_FETCHED_MODELS_BY_AGENT: Record<string, ModelCatalogEntry[]> = {};

function normalizeAgentKey(agentOrProviderId: string): string {
  const norm = (agentOrProviderId || '').toLowerCase().trim();
  if (norm === 'antigravity' || norm === 'gemini-antigravity' || norm === 'gemini' || norm === 'agy') {
    return 'antigravity';
  }
  if (norm === 'claude-code' || norm === 'claude' || norm === 'anthropic') {
    return 'claude-code';
  }
  if (norm === 'codex' || norm === 'openai' || norm === 'http-llm') {
    return 'codex';
  }
  return norm;
}

export function setLiveFetchedModelsForAgent(
  agentOrProviderId: string,
  fetched: FetchedAgentModel[]
): ModelCatalogEntry[] {
  const key = normalizeAgentKey(agentOrProviderId);
  if (!fetched || fetched.length === 0) return getAvailableModelsForAgent(agentOrProviderId);

  const entries: ModelCatalogEntry[] = fetched.map((f) => {
    const existing = MODEL_CATALOG.find((m) => m.id.toLowerCase() === f.id.toLowerCase());
    const efforts = (
      f.supportedEffortLevels && f.supportedEffortLevels.length > 0
        ? f.supportedEffortLevels
        : existing?.supportedEffortLevels || ['low', 'medium', 'high']
    ) as AgentEffortLevel[];
    const defaultEff = (
      f.defaultEffortLevel && efforts.includes(f.defaultEffortLevel as AgentEffortLevel)
        ? f.defaultEffortLevel
        : efforts.includes('high')
        ? 'high'
        : efforts[0] || 'medium'
    ) as AgentEffortLevel;
    return {
      id: f.id,
      displayName: f.displayName || existing?.displayName || f.id,
      family: existing?.family || (key === 'antigravity' ? 'google' : key === 'claude-code' ? 'anthropic' : 'other'),
      providerIds: [key, agentOrProviderId],
      category: existing?.category || (f.supportsReasoning ? 'reasoning' : 'flagship'),
      supportsReasoning: f.supportsReasoning ?? true,
      supportedEffortLevels: efforts,
      defaultEffortLevel: defaultEff,
      supportsThinkingToggle: f.supportsReasoning ?? true,
      contextWindowTokens: existing?.contextWindowTokens || 200000,
      description: f.description || existing?.description || `${f.displayName} (${agentOrProviderId} subscription)`,
    };
  });

  LIVE_FETCHED_MODELS_BY_AGENT[key] = entries;
  return entries;
}

export async function fetchAndCacheAgentModels(agentOrProviderId: string): Promise<ModelCatalogEntry[]> {
  const norm = normalizeAgentKey(agentOrProviderId);
  try {
    if (norm.includes('ollama') && typeof window !== 'undefined' && (window as any).electronAPI?.getOllamaModels) {
      const res = await (window as any).electronAPI.getOllamaModels();
      if (res?.models && Array.isArray(res.models) && res.models.length > 0) {
        const mapped: FetchedAgentModel[] = res.models.map((m: string) => ({
          id: m,
          displayName: m,
          supportsReasoning: isReasoningModel(m),
          supportedEffortLevels: ['low', 'medium', 'high'],
          defaultEffortLevel: 'medium',
          description: `Local Ollama model (${m})`,
        }));
        return setLiveFetchedModelsForAgent(agentOrProviderId, mapped);
      }
    }
    if (typeof window !== 'undefined' && (window as any).electronAPI?.fetchAgentModels) {
      const live: FetchedAgentModel[] = await (window as any).electronAPI.fetchAgentModels(agentOrProviderId);
      if (Array.isArray(live) && live.length > 0) {
        return setLiveFetchedModelsForAgent(agentOrProviderId, live);
      }
    }
  } catch (err) {
    console.warn('[models] Failed to fetch live models for', agentOrProviderId, err);
  }
  return getAvailableModelsForAgent(agentOrProviderId);
}

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
 * Returns ONLY the available subscription model options for a specific agent or provider id.
 * When live models have been fetched via `fetchAndCacheAgentModels`, returns those exact subscription models.
 */
export function getAvailableModelsForAgent(
  agentOrProviderId: string,
  _subscriptionTier?: string,
  dynamicRuntimeModels?: string[]
): ModelCatalogEntry[] {
  const norm = (agentOrProviderId || '').toLowerCase().trim();
  const agentKey = normalizeAgentKey(norm);

  if (LIVE_FETCHED_MODELS_BY_AGENT[agentKey] && LIVE_FETCHED_MODELS_BY_AGENT[agentKey].length > 0) {
    return LIVE_FETCHED_MODELS_BY_AGENT[agentKey];
  }

  const matched = MODEL_CATALOG.filter((m) =>
    m.providerIds.some(
      (pid) =>
        pid.toLowerCase() === norm ||
        pid.toLowerCase() === agentKey ||
        ((norm.includes('claude') || norm === 'zcode' || norm === 'cursor' || norm === 'anthropic') &&
          pid === 'claude-code') ||
        ((norm.includes('gemini') || norm.includes('antigravity') || norm === 'agy') &&
          pid === 'antigravity') ||
        ((norm.includes('open') || norm === 'codex' || norm === 'http-llm') &&
          pid === 'openai') ||
        (norm.includes('deepseek') && pid === 'deepseek') ||
        (norm.includes('ollama') && pid === 'ollama')
    )
  );

  const baseList = matched.length > 0 ? matched : MODEL_CATALOG;

  // Tailor effort levels per agent (e.g. `agy` supports low/medium/high, or medium for gpt-oss-120b)
  const tailoredList: ModelCatalogEntry[] = baseList.map((m) => {
    if (agentKey === 'antigravity') {
      const agyEfforts: AgentEffortLevel[] =
        m.id === 'gpt-oss-120b'
          ? ['medium']
          : (m.supportedEffortLevels.filter((e) => e === 'low' || e === 'medium' || e === 'high') as AgentEffortLevel[]);
      return {
        ...m,
        supportedEffortLevels: agyEfforts.length > 0 ? agyEfforts : ['low', 'medium', 'high'],
        defaultEffortLevel: m.id === 'gpt-oss-120b' ? 'medium' : 'high',
      };
    }
    return { ...m };
  });

  if (!dynamicRuntimeModels || dynamicRuntimeModels.length === 0) {
    return tailoredList;
  }

  const seen = new Set(tailoredList.map((m) => m.id.toLowerCase()));
  const dynamicEntries: ModelCatalogEntry[] = [];
  for (const rawModel of dynamicRuntimeModels) {
    const slug = rawModel.trim();
    if (!slug || seen.has(slug.toLowerCase())) continue;
    seen.add(slug.toLowerCase());
    const reasoning = isReasoningModel(slug);
    dynamicEntries.push({
      id: slug,
      displayName: slug,
      family: norm.includes('ollama') ? 'ollama' : 'other',
      providerIds: [agentOrProviderId],
      category: reasoning ? 'reasoning' : norm.includes('ollama') ? 'local' : 'flagship',
      supportsReasoning: reasoning,
      supportedEffortLevels: ['low', 'medium', 'high'],
      defaultEffortLevel: 'medium',
      supportsThinkingToggle: reasoning,
      contextWindowTokens: 200000,
      description: `Live detected model for ${agentOrProviderId}`,
    });
  }

  return [...dynamicEntries, ...tailoredList];
}

/**
 * Normalizes a model ID for the target agent so legacy/unsupported slugs (such as `gemini-2.5-pro`)
 * automatically resolve to a valid subscription model for that agent.
 */
export function normalizeModelForAgent(
  agentId: string,
  modelId?: string,
  subscriptionTier?: string
): string {
  const available = getAvailableModelsForAgent(agentId, subscriptionTier);
  const raw = (modelId || '').trim();
  if (!raw || raw === 'default') {
    return getDefaultModelForAgent(agentId, subscriptionTier);
  }

  const lower = raw.toLowerCase();
  const agentKey = normalizeAgentKey(agentId);

  if (agentKey === 'antigravity') {
    if (
      lower === 'gemini-2.5-pro' ||
      lower === 'gemini-2.0-pro-exp-02-05' ||
      lower === 'gemini-1.5-pro' ||
      lower === 'gemini-pro'
    ) {
      return 'gemini-4-argon';
    }
    if (
      lower === 'gemini-2.5-flash' ||
      lower === 'gemini-2.0-flash-thinking' ||
      lower === 'gemini-1.5-flash' ||
      lower === 'gemini-flash'
    ) {
      return 'gemini-3.8-flash';
    }
    // Strip baked-in effort suffix if present
    for (const suffix of ['-low', '-medium', '-high', '-xhigh', '-max']) {
      if (lower.endsWith(suffix)) {
        const stripped = raw.slice(0, -suffix.length);
        if (available.some((m) => m.id.toLowerCase() === stripped.toLowerCase())) {
          return stripped;
        }
      }
    }
  }

  if (lower === 'claude-3-7-sonnet' || lower === 'claude-3-7-sonnet-thought' || lower === 'claude-3-5-sonnet') {
    return 'claude-sonnet-5-5';
  }
  if (lower === 'claude-3-opus') {
    return 'claude-opus-5-5';
  }

  const exact = available.find((m) => m.id.toLowerCase() === lower);
  if (exact) return exact.id;

  return available[0]?.id || getDefaultModelForAgent(agentId, subscriptionTier);
}

/**
 * Returns the default model ID for an agent respecting the user's subscription tier.
 */
export function getDefaultModelForAgent(
  agentId: string,
  subscriptionTier?: string
): string {
  const isFree = subscriptionTier?.toLowerCase() === 'free';
  const agentKey = normalizeAgentKey(agentId);

  if (LIVE_FETCHED_MODELS_BY_AGENT[agentKey] && LIVE_FETCHED_MODELS_BY_AGENT[agentKey].length > 0) {
    return LIVE_FETCHED_MODELS_BY_AGENT[agentKey][0].id;
  }

  switch (agentKey) {
    case 'claude-code':
      return isFree ? 'claude-sonnet-5-5' : 'claude-opus-5-5';
    case 'antigravity':
      return isFree ? 'gemini-3.8-flash' : 'gemini-4-argon';
    case 'codex':
      return isFree ? 'gpt-4o' : 'o3-mini';
    case 'cursor':
    case 'zcode':
    case 'opencode':
      return 'claude-opus-5-5';
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
