import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePreviewStore, PreviewStoreState } from '../store';
import {
  AgentCredentialConfig,
  AgentCredentialsMap,
  AgentProfile,
  AvailableProviderInfo,
} from '../../../shared/types';
import { getDefaultModelForAgent } from '../../../shared/constants/models';

/**
 * Dynamic subscription-aware agent & engine discovery hook.
 * Eliminates all hardcoded/static tool and agent dropdowns by fetching the user's
 * live discovered CLI/API/Custom agents, subscription tiers, credentials, and local Ollama models.
 */
export function useSubscriptionAgents(autoFetchOnMount = true) {
  const agentProfiles = usePreviewStore(
    (s: PreviewStoreState) => s.agentProfiles
  );
  const setAgentProfiles = usePreviewStore(
    (s: PreviewStoreState) => s.setAgentProfiles
  );
  const availableProviders = usePreviewStore(
    (s: PreviewStoreState) => s.availableProviders
  );
  const loadAvailableProviders = usePreviewStore(
    (s: PreviewStoreState) => s.loadAvailableProviders
  );
  const settings = usePreviewStore((s: PreviewStoreState) => s.settings);

  const [credentials, setCredentials] = useState<AgentCredentialsMap>({});
  const [liveOllamaModels, setLiveOllamaModels] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const refreshSubscriptionAgents = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const tasks: Promise<void>[] = [
        loadAvailableProviders(),
        (async () => {
          if (window.electronAPI?.discoverAgents) {
            const profiles = await window.electronAPI.discoverAgents();
            if (Array.isArray(profiles)) {
              setAgentProfiles(profiles);
            }
          }
        })(),
        (async () => {
          if (window.electronAPI?.getAgentCredentials) {
            const creds = await window.electronAPI.getAgentCredentials();
            setCredentials(creds || {});
          }
        })(),
        (async () => {
          if (window.electronAPI?.getOllamaModels) {
            try {
              const ollamaUrl =
                settings?.ollamaUrl || 'http://127.0.0.1:11434';
              const res = await window.electronAPI.getOllamaModels({
                provider: 'ollama',
                endpointUrl: ollamaUrl,
                model: settings?.ollamaModel || '',
              });
              if (res?.success && Array.isArray(res.models)) {
                setLiveOllamaModels(
                  res.models
                    .map((m: { name: string }) => m.name)
                    .filter(Boolean)
                );
              }
            } catch {
              // Ollama daemon offline; ignore silently
            }
          }
        })(),
      ];
      await Promise.allSettled(tasks);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadAvailableProviders, setAgentProfiles, settings?.ollamaModel, settings?.ollamaUrl]);

  useEffect(() => {
    if (autoFetchOnMount) {
      refreshSubscriptionAgents();
    }
  }, [autoFetchOnMount, refreshSubscriptionAgents]);

  // Memoized O(1) lookup maps
  const profilesById = useMemo(() => {
    const map = new Map<string, AgentProfile>();
    for (const p of agentProfiles) {
      map.set(p.id, p);
      if (p.id === 'antigravity') {
        map.set('gemini-antigravity', p);
      }
    }
    return map;
  }, [agentProfiles]);

  /**
   * Unified dynamic list of providers merged from backend `availableProviders` and live `agentProfiles`,
   * sorted with active subscription-connected agents first.
   */
  const dynamicProviders = useMemo<AvailableProviderInfo[]>(() => {
    const merged = new Map<string, AvailableProviderInfo>();

    for (const ap of availableProviders) {
      const cred = credentials[ap.id];
      if (cred?.disabled) continue;
      const tier = cred?.subscriptionTier || ap.subscriptionTier;
      const model =
        cred?.selectedModel ||
        ap.model ||
        getDefaultModelForAgent(ap.id, tier);
      merged.set(ap.id, {
        ...ap,
        subscriptionTier: tier,
        model,
      });
    }

    // Ensure every enabled discovered AgentProfile (including newly added custom/subscription agents) is represented
    for (const prof of agentProfiles) {
      if (!prof.enabled) continue;
      if (merged.has(prof.id)) continue;
      const cred: AgentCredentialConfig | undefined = credentials[prof.id];
      const tier = cred?.subscriptionTier || prof.subscriptionTier;
      const isReady =
        prof.installed &&
        (['connected', 'api-key-ready', 'web-connected', 'ready'].includes(
          prof.authStatus
        ) ||
          Boolean(prof.detectedBinaryPath));

      merged.set(prof.id, {
        id: prof.id,
        name: tier
          ? `${prof.name} [${tier.toUpperCase()}]`
          : prof.name,
        providerType: prof.isCustom ? 'custom' : 'cli',
        available: isReady,
        model:
          cred?.selectedModel ||
          prof.defaultModelId ||
          getDefaultModelForAgent(prof.id, tier),
        supportsThinking: prof.supportsThinking ?? true,
        supportsEffort: prof.supportsEffort ?? false,
        description: prof.description,
        authStatus: prof.authStatus,
        subscriptionTier: tier,
        accountLabel: prof.connectedAccountLabel,
        vendor: prof.vendor,
        accentColor: prof.accentColor,
        isCustom: prof.isCustom,
      });
    }

    const list = Array.from(merged.values());
    list.sort((a, b) => {
      if (a.id === 'mock') return 1;
      if (b.id === 'mock') return -1;
      if (a.available !== b.available) return a.available ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [availableProviders, agentProfiles, credentials]);

  const providersById = useMemo(() => {
    const map = new Map<string, AvailableProviderInfo>();
    for (const p of dynamicProviders) {
      map.set(p.id, p);
      if (p.id === 'antigravity') {
        map.set('gemini-antigravity', p);
      }
    }
    return map;
  }, [dynamicProviders]);

  const activeSubscriptionProviders = useMemo(
    () => dynamicProviders.filter((p) => p.available && p.id !== 'mock'),
    [dynamicProviders]
  );

  const enabledAgentProfiles = useMemo(() => {
    const enabled = agentProfiles.filter((a) => a.enabled);
    // Sort connected subscription agents first
    return [...(enabled.length > 0 ? enabled : agentProfiles)].sort((a, b) => {
      const aReady = ['connected', 'api-key-ready', 'web-connected'].includes(
        a.authStatus
      );
      const bReady = ['connected', 'api-key-ready', 'web-connected'].includes(
        b.authStatus
      );
      if (aReady !== bReady) return aReady ? -1 : 1;
      if (a.installed !== b.installed) return a.installed ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [agentProfiles]);

  const preferredDefaultAgentId = useMemo<string>(() => {
    if (activeSubscriptionProviders.length > 0) {
      return activeSubscriptionProviders[0].id;
    }
    const readyProfile = enabledAgentProfiles.find(
      (a) =>
        a.installed &&
        ['connected', 'api-key-ready', 'web-connected'].includes(a.authStatus)
    );
    if (readyProfile) return readyProfile.id;
    if (enabledAgentProfiles.length > 0) return enabledAgentProfiles[0].id;
    return dynamicProviders[0]?.id || 'mock';
  }, [activeSubscriptionProviders, enabledAgentProfiles, dynamicProviders]);

  const getSubscriptionTierForAgent = useCallback(
    (agentOrProviderId: string): string | undefined => {
      const norm =
        agentOrProviderId === 'gemini-antigravity'
          ? 'antigravity'
          : agentOrProviderId;
      return (
        credentials[norm]?.subscriptionTier ||
        providersById.get(norm)?.subscriptionTier ||
        profilesById.get(norm)?.subscriptionTier
      );
    },
    [credentials, providersById, profilesById]
  );

  const getDynamicModelsForAgent = useCallback(
    (agentOrProviderId: string): string[] => {
      const norm =
        agentOrProviderId === 'gemini-antigravity'
          ? 'antigravity'
          : agentOrProviderId;
      const list: string[] = [];
      const userSelected = credentials[norm]?.selectedModel;
      if (userSelected && userSelected.trim()) {
        list.push(userSelected.trim());
      }
      if (norm === 'ollama' && liveOllamaModels.length > 0) {
        list.push(...liveOllamaModels);
      }
      const provDefault = providersById.get(norm)?.model;
      if (provDefault && provDefault.trim() && provDefault !== 'default') {
        list.push(provDefault.trim());
      }
      return list;
    },
    [credentials, liveOllamaModels, providersById]
  );

  return {
    dynamicProviders,
    activeSubscriptionProviders,
    providersById,
    enabledAgentProfiles,
    profilesById,
    credentials,
    liveOllamaModels,
    preferredDefaultAgentId,
    isRefreshing,
    refreshSubscriptionAgents,
    getSubscriptionTierForAgent,
    getDynamicModelsForAgent,
  };
}

