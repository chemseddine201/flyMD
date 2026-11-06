//! Registry and factory for discussion inference providers (discovered user-subscription CLI agents,
//! custom agents, HTTP LLMs, Ollama local daemon, and offline simulator).

use super::runner::{CliProvider, CliType, DiscussionProvider, HttpProvider, MockProvider};
use super::types::DiscussionConfig;
use crate::agents::discovery::discover_agent_profiles;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

pub fn check_tcp_port_alive(url_str: &str, default_port: u16) -> bool {
    let Ok(parsed) = reqwest::Url::parse(url_str) else {
        return false;
    };
    let Some(host) = parsed.host_str() else {
        return false;
    };
    let port = parsed.port().unwrap_or(default_port);
    use std::net::{TcpStream, ToSocketAddrs};
    format!("{}:{}", host, port)
        .to_socket_addrs()
        .ok()
        .and_then(|mut addrs| addrs.next())
        .map(|addr| TcpStream::connect_timeout(&addr, std::time::Duration::from_millis(80)).is_ok())
        .unwrap_or(false)
}

pub fn resolve_executable(name: &str) -> Option<PathBuf> {
    crate::common::process::find_binary_on_system(&[name]).map(PathBuf::from)
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct AvailableProviderInfo {
    pub id: String,
    pub name: String,
    #[serde(rename = "providerType")]
    pub provider_type: String,
    pub available: bool,
    pub description: String,
    #[serde(rename = "model", alias = "defaultModel")]
    pub default_model: String,
    #[serde(rename = "supportsThinking")]
    pub supports_thinking: bool,
    #[serde(rename = "supportsEffort", default)]
    pub supports_effort: bool,
    #[serde(rename = "authStatus", default)]
    pub auth_status: String,
    #[serde(
        rename = "subscriptionTier",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub subscription_tier: Option<String>,
    #[serde(
        rename = "accountLabel",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub account_label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vendor: Option<String>,
    #[serde(
        rename = "accentColor",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub accent_color: Option<String>,
    #[serde(rename = "isCustom", default)]
    pub is_custom: bool,
}

/// Composite lookup key (`provider_id::model_id`) so multiple participants or rounds sharing a provider
/// with different models never overwrite each other's model configuration.
pub fn provider_lookup_key(provider_id: &str, model_id: &str) -> String {
    let m = model_id.trim();
    if m.is_empty() || m == "default" {
        provider_id.to_string()
    } else {
        format!("{}::{}", provider_id, m)
    }
}

pub fn build_provider_map(
    config: &DiscussionConfig,
    client: reqwest::Client,
    store: Option<&crate::store::AppStore>,
) -> HashMap<String, Arc<dyn DiscussionProvider>> {
    let mut map: HashMap<String, Arc<dyn DiscussionProvider>> = HashMap::new();
    let session_sandbox = PathBuf::from(&config.workspace_path)
        .join(".flymd")
        .join("discussions")
        .join(&config.session_id)
        .join(".sandbox");

    let settings = store.map(|s| s.get_settings());
    let creds = store.map(|s| s.get_agent_credentials()).unwrap_or_default();
    let discovered_profiles = discover_agent_profiles(&creds);

    // Register providers across BOTH base `participants` AND every round slot in `round_schedule`
    let all_participants = config.all_scheduled_participants();

    for p in &all_participants {
        let composite_key = provider_lookup_key(&p.provider_id, &p.model_id);
        if map.contains_key(&composite_key) {
            continue;
        }

        let norm_provider = if p.provider_id == "gemini-antigravity" {
            "antigravity"
        } else {
            p.provider_id.as_str()
        };

        let provider_arc: Arc<dyn DiscussionProvider> = match norm_provider {
            "claude-code" => {
                let custom_bin = creds
                    .get("claude-code")
                    .and_then(|c| c.custom_binary_path.as_ref())
                    .filter(|s| !s.trim().is_empty())
                    .map(PathBuf::from);
                let exe = custom_bin.or_else(|| resolve_executable("claude"));
                if let Some(exe_path) = exe {
                    Arc::new(CliProvider::new(
                        CliType::ClaudeCode,
                        exe_path,
                        session_sandbox.clone(),
                    ))
                } else {
                    Arc::new(MockProvider::new(&p.provider_id))
                }
            }
            "antigravity" => {
                let custom_bin = creds
                    .get("antigravity")
                    .and_then(|c| c.custom_binary_path.as_ref())
                    .filter(|s| !s.trim().is_empty())
                    .map(PathBuf::from);
                let exe = custom_bin
                    .or_else(|| resolve_executable("agy"))
                    .or_else(|| resolve_executable("antigravity"));
                if let Some(exe_path) = exe {
                    Arc::new(CliProvider::new(
                        CliType::AntigravityGemini,
                        exe_path,
                        session_sandbox.clone(),
                    ))
                } else {
                    Arc::new(MockProvider::new(&p.provider_id))
                }
            }
            "opencode" => {
                let custom_bin = creds
                    .get("opencode")
                    .and_then(|c| c.custom_binary_path.as_ref())
                    .filter(|s| !s.trim().is_empty())
                    .map(PathBuf::from);
                let exe = custom_bin.or_else(|| resolve_executable("opencode"));
                if let Some(exe_path) = exe {
                    Arc::new(CliProvider::new(
                        CliType::OpenCode,
                        exe_path,
                        session_sandbox.clone(),
                    ))
                } else {
                    Arc::new(MockProvider::new("opencode"))
                }
            }
            "codex" => {
                let custom_bin = creds
                    .get("codex")
                    .and_then(|c| c.custom_binary_path.as_ref())
                    .filter(|s| !s.trim().is_empty())
                    .map(PathBuf::from);
                let exe = custom_bin.or_else(|| resolve_executable("codex"));
                if let Some(exe_path) = exe {
                    Arc::new(CliProvider::new(
                        CliType::Codex,
                        exe_path,
                        session_sandbox.clone(),
                    ))
                } else if let Some(api_key) = creds
                    .get("codex")
                    .and_then(|c| c.api_key.clone())
                    .filter(|k| !k.trim().is_empty())
                {
                    let model = if !p.model_id.is_empty() && p.model_id != "default" {
                        p.model_id.clone()
                    } else {
                        "o3-mini".to_string()
                    };
                    Arc::new(HttpProvider::new(
                        "codex",
                        client.clone(),
                        "https://api.openai.com/v1",
                        Some(api_key),
                        &model,
                        false,
                    ))
                } else {
                    Arc::new(MockProvider::new("codex"))
                }
            }
            "ollama" => {
                let endpoint = settings
                    .as_ref()
                    .map(|s| s.ollama_url.as_str())
                    .filter(|u| !u.trim().is_empty())
                    .unwrap_or("http://127.0.0.1:11434");
                let model = if !p.model_id.is_empty() && p.model_id != "default" {
                    p.model_id.clone()
                } else {
                    settings
                        .as_ref()
                        .map(|s| s.ollama_model.clone())
                        .filter(|m| !m.trim().is_empty())
                        .unwrap_or_else(|| "qwen2.5-coder:32b".to_string())
                };
                Arc::new(HttpProvider::new(
                    &p.provider_id,
                    client.clone(),
                    endpoint,
                    None,
                    &model,
                    true,
                ))
            }
            "deepseek" | "kimi" | "http-llm" | "openai" => {
                let (default_endpoint, default_model) = match norm_provider {
                    "deepseek" => ("https://api.deepseek.com", "deepseek-reasoner"),
                    "kimi" => ("https://api.moonshot.cn/v1", "moonshot-v1-8k"),
                    "openai" => ("https://api.openai.com/v1", "o3-mini"),
                    _ => (
                        settings
                            .as_ref()
                            .map(|s| s.llm_config.endpoint_url.as_str())
                            .filter(|u| !u.trim().is_empty())
                            .unwrap_or("https://api.openai.com/v1"),
                        settings
                            .as_ref()
                            .map(|s| s.llm_config.model.as_str())
                            .filter(|m| !m.trim().is_empty())
                            .unwrap_or("gpt-4o"),
                    ),
                };

                let api_key = creds
                    .get(norm_provider)
                    .and_then(|c| c.api_key.clone())
                    .or_else(|| {
                        settings
                            .as_ref()
                            .and_then(|s| s.llm_config.api_key.clone())
                    })
                    .filter(|k| !k.trim().is_empty());

                let model = if !p.model_id.is_empty() && p.model_id != "default" {
                    p.model_id.clone()
                } else {
                    default_model.to_string()
                };

                Arc::new(HttpProvider::new(
                    &p.provider_id,
                    client.clone(),
                    default_endpoint,
                    api_key,
                    &model,
                    false,
                ))
            }
            other_id => {
                // Check discovered builtin/custom agent profiles (e.g. cursor, zcode, or user custom agents)
                let cred_opt = creds.get(other_id);
                let profile_opt = discovered_profiles.iter().find(|pr| pr.id == other_id);
                let detected_bin = cred_opt
                    .and_then(|c| c.custom_binary_path.as_ref())
                    .filter(|s| !s.trim().is_empty())
                    .map(PathBuf::from)
                    .or_else(|| {
                        profile_opt
                            .and_then(|pr| pr.detected_binary_path.as_ref())
                            .map(PathBuf::from)
                    });

                if let Some(exe_path) = detected_bin {
                    Arc::new(CliProvider::new(
                        CliType::GenericCli {
                            agent_id: other_id.to_string(),
                            custom_args: cred_opt.and_then(|c| c.custom_args.clone()),
                        },
                        exe_path,
                        session_sandbox.clone(),
                    ))
                } else if let (Some(endpoint), Some(api_key)) = (
                    cred_opt
                        .and_then(|c| c.custom_web_url.as_deref())
                        .filter(|u| u.starts_with("http") && u.contains("/v1")),
                    cred_opt
                        .and_then(|c| c.api_key.clone())
                        .filter(|k| !k.trim().is_empty()),
                ) {
                    let model = if !p.model_id.is_empty() && p.model_id != "default" {
                        p.model_id.clone()
                    } else {
                        "gpt-4o".to_string()
                    };
                    Arc::new(HttpProvider::new(
                        other_id,
                        client.clone(),
                        endpoint,
                        Some(api_key),
                        &model,
                        false,
                    ))
                } else {
                    Arc::new(MockProvider::new(other_id))
                }
            }
        };

        map.insert(composite_key, provider_arc.clone());
        map.entry(p.provider_id.clone()).or_insert(provider_arc);
    }

    map
}

/// Dynamically discovers all user-subscribed & installed agents, custom user agents,
/// local Ollama daemons, and configured API endpoints — eliminating static hardcoded provider lists.
pub fn detect_available_providers(store: &crate::store::AppStore) -> Vec<AvailableProviderInfo> {
    let settings = store.get_settings();
    let creds = store.get_agent_credentials();
    let discovered_agents = discover_agent_profiles(&creds);

    let mut providers: Vec<AvailableProviderInfo> = Vec::new();

    // 1. Dynamically populate from discovered user agents & subscriptions
    for profile in discovered_agents {
        if !profile.enabled {
            continue;
        }

        let is_authed_or_ready = matches!(
            profile.auth_status.as_str(),
            "connected" | "api-key-ready" | "web-connected" | "ready"
        ) || profile.detected_binary_path.is_some();

        let available = profile.installed && is_authed_or_ready;

        let default_model = profile
            .default_model_id
            .clone()
            .unwrap_or_else(|| "claude-3-7-sonnet".to_string());

        let tier_badge = profile
            .subscription_tier
            .as_deref()
            .map(|t| format!(" [{}]", t.to_uppercase()))
            .unwrap_or_default();

        providers.push(AvailableProviderInfo {
            id: profile.id.clone(),
            name: format!("{}{}", profile.name, tier_badge),
            provider_type: if profile.is_custom {
                "custom".to_string()
            } else {
                "cli".to_string()
            },
            available,
            description: profile.description.clone(),
            default_model,
            supports_thinking: profile.supports_thinking.unwrap_or(true),
            supports_effort: profile.supports_effort.unwrap_or(false),
            auth_status: profile.auth_status.clone(),
            subscription_tier: profile.subscription_tier.clone(),
            account_label: profile.connected_account_label.clone(),
            vendor: Some(profile.vendor.clone()),
            accent_color: Some(profile.accent_color.clone()),
            is_custom: profile.is_custom,
        });
    }

    // 2. Local Ollama runtime (dynamic probe against configured daemon URL)
    let ollama_configured = !settings.ollama_url.trim().is_empty()
        && check_tcp_port_alive(&settings.ollama_url, 11434);
    if ollama_configured || !settings.ollama_model.trim().is_empty() {
        providers.push(AvailableProviderInfo {
            id: "ollama".to_string(),
            name: "Ollama Local Engine [LOCAL]".to_string(),
            provider_type: "ollama".to_string(),
            available: ollama_configured,
            description: format!("Local Ollama daemon at {}", settings.ollama_url),
            default_model: if !settings.ollama_model.trim().is_empty() {
                settings.ollama_model.clone()
            } else {
                "qwen2.5-coder:32b".to_string()
            },
            supports_thinking: true,
            supports_effort: false,
            auth_status: if ollama_configured {
                "connected".to_string()
            } else {
                "not-installed".to_string()
            },
            subscription_tier: Some("local".to_string()),
            account_label: Some("Local GPU / CPU Runtime".to_string()),
            vendor: Some("Ollama".to_string()),
            accent_color: Some("#fbbf24".to_string()),
            is_custom: false,
        });
    }

    // 3. DeepSeek Direct API (included dynamically when API credentials exist)
    let deepseek_cred = creds.get("deepseek");
    let deepseek_has_key = deepseek_cred
        .and_then(|c| c.api_key.as_ref())
        .map(|k| !k.trim().is_empty())
        .unwrap_or(false)
        || std::env::var("DEEPSEEK_API_KEY")
            .ok()
            .map(|v| !v.trim().is_empty())
            .unwrap_or(false);
    if deepseek_has_key {
        let tier = deepseek_cred
            .and_then(|c| c.subscription_tier.clone())
            .unwrap_or_else(|| "api".to_string());
        let model = deepseek_cred
            .and_then(|c| c.selected_model.clone())
            .filter(|m| !m.trim().is_empty())
            .unwrap_or_else(|| "deepseek-reasoner".to_string());
        providers.push(AvailableProviderInfo {
            id: "deepseek".to_string(),
            name: format!("DeepSeek Reasoning [{}]", tier.to_uppercase()),
            provider_type: "http".to_string(),
            available: true,
            description: "Native DeepSeek R1 / V3 API with chain-of-thought reasoning.".to_string(),
            default_model: model,
            supports_thinking: true,
            supports_effort: false,
            auth_status: "api-key-ready".to_string(),
            subscription_tier: Some(tier),
            account_label: Some("DeepSeek API".to_string()),
            vendor: Some("DeepSeek".to_string()),
            accent_color: Some("#6366f1".to_string()),
            is_custom: false,
        });
    }

    // 4. Configured Custom OpenAI-compatible HTTP Endpoint
    let http_configured = !settings.llm_config.endpoint_url.trim().is_empty()
        && settings
            .llm_config
            .api_key
            .as_ref()
            .map(|k| !k.trim().is_empty())
            .unwrap_or(false);
    if http_configured {
        providers.push(AvailableProviderInfo {
            id: "http-llm".to_string(),
            name: "Configured OpenAI / HTTP API [API]".to_string(),
            provider_type: "http".to_string(),
            available: true,
            description: format!("Configured endpoint at {}", settings.llm_config.endpoint_url),
            default_model: if !settings.llm_config.model.trim().is_empty() {
                settings.llm_config.model.clone()
            } else {
                "gpt-4o".to_string()
            },
            supports_thinking: true,
            supports_effort: false,
            auth_status: "api-key-ready".to_string(),
            subscription_tier: Some("api".to_string()),
            account_label: Some("Direct API Endpoint".to_string()),
            vendor: Some("OpenAI Compatible".to_string()),
            accent_color: Some("#22c55e".to_string()),
            is_custom: false,
        });
    }

    // Sort so active/available user-subscribed agents always appear first!
    providers.sort_by(|a, b| b.available.cmp(&a.available).then_with(|| a.name.cmp(&b.name)));

    // 5. Offline Simulator fallback at the end (clearly typed as simulator)
    providers.push(AvailableProviderInfo {
        id: "mock".to_string(),
        name: "Offline Domain Simulator (Zero-Quota Fallback)".to_string(),
        provider_type: "simulator".to_string(),
        available: true,
        description:
            "Zero-quota local simulator for testing multi-round choreography without consuming subscription queries."
                .to_string(),
        default_model: "adaptive-domain-simulator".to_string(),
        supports_thinking: true,
        supports_effort: false,
        auth_status: "local-simulator".to_string(),
        subscription_tier: Some("simulator".to_string()),
        account_label: Some("Built-in Offline Simulator".to_string()),
        vendor: Some("FlyMD Local".to_string()),
        accent_color: Some("#94a3b8".to_string()),
        is_custom: false,
    });

    providers
}
