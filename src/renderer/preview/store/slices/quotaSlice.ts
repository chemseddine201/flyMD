import { StateCreator } from 'zustand';

export interface TokenQuotaConfig {
  enabled: boolean;
  budgetCap: number; // 0 = unlimited
  softWarningPercent: number; // e.g. 80
  breachAction: 'pause_at_boundary' | 'warn_only';
}

export interface WorkspaceTokenMetrics {
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  costUsd?: number;
  basis?: 'reported' | 'estimated';
}

const DEFAULT_QUOTA_CONFIG: TokenQuotaConfig = {
  enabled: true,
  budgetCap: 50000,
  softWarningPercent: 80,
  breachAction: 'pause_at_boundary',
};

const DEFAULT_METRICS: WorkspaceTokenMetrics = {
  promptTokens: 0,
  completionTokens: 0,
  reasoningTokens: 0,
  totalTokens: 0,
};

function loadSavedQuotaConfig(): TokenQuotaConfig {
  try {
    const raw = localStorage.getItem('flymd:token-quota-config');
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_QUOTA_CONFIG, ...parsed };
    }
  } catch {}
  return DEFAULT_QUOTA_CONFIG;
}

function persistQuotaConfig(config: TokenQuotaConfig) {
  try {
    localStorage.setItem('flymd:token-quota-config', JSON.stringify(config));
  } catch {}
}

function loadCumulativeMetrics(): WorkspaceTokenMetrics {
  try {
    const raw = localStorage.getItem('flymd:cumulative-token-metrics');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        promptTokens: Number(parsed.promptTokens) || 0,
        completionTokens: Number(parsed.completionTokens) || 0,
        reasoningTokens: Number(parsed.reasoningTokens) || 0,
        totalTokens: Number(parsed.totalTokens) || 0,
      };
    }
  } catch {}
  return DEFAULT_METRICS;
}

function persistCumulativeMetrics(metrics: WorkspaceTokenMetrics) {
  try {
    localStorage.setItem('flymd:cumulative-token-metrics', JSON.stringify(metrics));
  } catch {}
}

export interface QuotaSlice {
  tokenQuotaConfig: TokenQuotaConfig;
  sessionTokenMetrics: WorkspaceTokenMetrics;
  cumulativeTokenMetrics: WorkspaceTokenMetrics;

  setTokenQuotaConfig: (partial: Partial<TokenQuotaConfig>) => void;
  recordTokenUsage: (usage: Partial<WorkspaceTokenMetrics>) => void;
  resetSessionTokenMetrics: () => void;
  resetCumulativeTokenMetrics: () => void;
  getQuotaStatus: () => {
    percent: number;
    isSoftWarning: boolean;
    isBreached: boolean;
  };
}

export const createQuotaSlice: StateCreator<QuotaSlice, [], [], QuotaSlice> = (
  set,
  get
) => ({
  tokenQuotaConfig: loadSavedQuotaConfig(),
  sessionTokenMetrics: { ...DEFAULT_METRICS },
  cumulativeTokenMetrics: loadCumulativeMetrics(),

  setTokenQuotaConfig: (partial) => {
    const next = { ...get().tokenQuotaConfig, ...partial };
    persistQuotaConfig(next);
    set({ tokenQuotaConfig: next });
  },

  recordTokenUsage: (usage) => {
    const prompt = usage.promptTokens || 0;
    const completion = usage.completionTokens || 0;
    const reasoning = usage.reasoningTokens || 0;
    const total = usage.totalTokens || prompt + completion + reasoning;
    const cacheRead = usage.cacheReadTokens || 0;
    const cacheWrite = usage.cacheWriteTokens || 0;
    const cost = usage.costUsd || 0;
    const basis = usage.basis;

    const currentSession = get().sessionTokenMetrics;
    const nextSession: WorkspaceTokenMetrics = {
      promptTokens: currentSession.promptTokens + prompt,
      completionTokens: currentSession.completionTokens + completion,
      reasoningTokens: currentSession.reasoningTokens + reasoning,
      totalTokens: currentSession.totalTokens + total,
      cacheReadTokens: (currentSession.cacheReadTokens || 0) + cacheRead,
      cacheWriteTokens: (currentSession.cacheWriteTokens || 0) + cacheWrite,
      costUsd: (currentSession.costUsd || 0) + cost,
      basis: basis || currentSession.basis,
    };

    const currentCumul = get().cumulativeTokenMetrics;
    const nextCumul: WorkspaceTokenMetrics = {
      promptTokens: currentCumul.promptTokens + prompt,
      completionTokens: currentCumul.completionTokens + completion,
      reasoningTokens: currentCumul.reasoningTokens + reasoning,
      totalTokens: currentCumul.totalTokens + total,
      cacheReadTokens: (currentCumul.cacheReadTokens || 0) + cacheRead,
      cacheWriteTokens: (currentCumul.cacheWriteTokens || 0) + cacheWrite,
      costUsd: (currentCumul.costUsd || 0) + cost,
      basis: basis || currentCumul.basis,
    };

    persistCumulativeMetrics(nextCumul);
    set({
      sessionTokenMetrics: nextSession,
      cumulativeTokenMetrics: nextCumul,
    });
  },

  resetSessionTokenMetrics: () => {
    set({ sessionTokenMetrics: { ...DEFAULT_METRICS } });
  },

  resetCumulativeTokenMetrics: () => {
    persistCumulativeMetrics(DEFAULT_METRICS);
    set({ cumulativeTokenMetrics: { ...DEFAULT_METRICS } });
  },

  getQuotaStatus: () => {
    const { tokenQuotaConfig, sessionTokenMetrics } = get();
    if (!tokenQuotaConfig.enabled || tokenQuotaConfig.budgetCap <= 0) {
      return { percent: 0, isSoftWarning: false, isBreached: false };
    }

    const percent = Math.min(
      999,
      Math.round((sessionTokenMetrics.totalTokens / tokenQuotaConfig.budgetCap) * 100)
    );
    const isSoftWarning = percent >= tokenQuotaConfig.softWarningPercent && percent < 100;
    const isBreached = sessionTokenMetrics.totalTokens >= tokenQuotaConfig.budgetCap;

    return { percent, isSoftWarning, isBreached };
  },
});

