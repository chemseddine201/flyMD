//! Registry and factory for discussion inference providers (CLI subprocesses, HTTP LLMs, Ollama, and Mock engines).

use super::runner::{CliProvider, CliType, DiscussionProvider, HttpProvider, MockProvider};
use super::types::DiscussionConfig;
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
}

/// Composite lookup key (`provider_id::model_id`) so multiple participants sharing a provider
/// (e.g. two Ollama or HTTP agents running different models) never overwrite each other's model,
/// while two participants using the exact same model share the exact same `Arc<dyn DiscussionProvider>`.
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

    for p in &config.participants {
        let composite_key = provider_lookup_key(&p.provider_id, &p.model_id);
        if map.contains_key(&composite_key) {
            continue;
        }

        let provider_arc: Arc<dyn DiscussionProvider> = match p.provider_id.as_str() {
            "claude-code" => {
                let custom_bin = creds
                    .get("claude-code")
                    .and_then(|c| c.custom_binary_path.as_ref())
                    .map(PathBuf::from);
                let exe = custom_bin.or_else(|| resolve_executable("claude"));
                if let Some(exe_path) = exe {
                    Arc::new(CliProvider::new(
                        CliType::ClaudeCode,
                        exe_path,
                        session_sandbox.clone(),
                    ))
                } else {
                    Arc::new(MockProvider::new("claude-code"))
                }
            }
            "gemini-antigravity" => {
                let custom_bin = creds
                    .get("antigravity")
                    .and_then(|c| c.custom_binary_path.as_ref())
                    .map(PathBuf::from);
                let exe = custom_bin.or_else(|| resolve_executable("agy"));
                if let Some(exe_path) = exe {
                    Arc::new(CliProvider::new(
                        CliType::AntigravityGemini,
                        exe_path,
                        session_sandbox.clone(),
                    ))
                } else {
                    Arc::new(MockProvider::new("gemini-antigravity"))
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
                        .unwrap_or_else(|| "qwen2.5:3b".to_string())
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
            "deepseek" | "kimi" | "http-llm" => {
                let (default_endpoint, default_model) = match p.provider_id.as_str() {
                    "deepseek" => ("https://api.deepseek.com", "deepseek-reasoner"),
                    "kimi" => ("https://api.moonshot.cn/v1", "moonshot-v1-8k"),
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
                    .get(&p.provider_id)
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
            _ => Arc::new(MockProvider::new(&p.provider_id)),
        };

        map.insert(composite_key, provider_arc.clone());
        map.entry(p.provider_id.clone()).or_insert(provider_arc);
    }

    map
}

pub fn detect_available_providers(store: &crate::store::AppStore) -> Vec<AvailableProviderInfo> {
    let settings = store.get_settings();
    let creds = store.get_agent_credentials();

    let claude_available = creds
        .get("claude-code")
        .and_then(|c| c.custom_binary_path.as_ref())
        .map(PathBuf::from)
        .map(|p| p.exists())
        .unwrap_or_else(|| resolve_executable("claude").is_some());

    let gemini_available = creds
        .get("antigravity")
        .and_then(|c| c.custom_binary_path.as_ref())
        .map(PathBuf::from)
        .map(|p| p.exists())
        .unwrap_or_else(|| resolve_executable("agy").is_some());

    let ollama_configured = !settings.ollama_url.trim().is_empty()
        && check_tcp_port_alive(&settings.ollama_url, 11434);
    let http_configured = !settings.llm_config.endpoint_url.trim().is_empty();
    let deepseek_has_key = creds.get("deepseek").and_then(|c| c.api_key.as_ref()).is_some()
        || settings.llm_config.api_key.as_ref().map(|k| !k.trim().is_empty()).unwrap_or(false);

    vec![
        AvailableProviderInfo {
            id: "mock".to_string(),
            name: "Adaptive Domain Simulator (Local)".to_string(),
            provider_type: "simulator".to_string(),
            available: true,
            description: "Zero API cost local analyzer that evaluates architecture and generates multi-step reasoning.".to_string(),
            default_model: "domain-reasoner-v1".to_string(),
            supports_thinking: true,
            supports_effort: false,
        },
        AvailableProviderInfo {
            id: "ollama".to_string(),
            name: "Ollama Local Engine".to_string(),
            provider_type: "ollama".to_string(),
            available: ollama_configured,
            description: format!("Local Ollama daemon at {}", settings.ollama_url),
            default_model: if !settings.ollama_model.is_empty() {
                settings.ollama_model.clone()
            } else {
                "qwen2.5:3b".to_string()
            },
            supports_thinking: true,
            supports_effort: false,
        },
        AvailableProviderInfo {
            id: "deepseek".to_string(),
            name: "DeepSeek Reasoning (R1)".to_string(),
            provider_type: "http".to_string(),
            available: deepseek_has_key,
            description: "Native reasoning engine with chain-of-thought tokens.".to_string(),
            default_model: "deepseek-reasoner".to_string(),
            supports_thinking: true,
            supports_effort: false,
        },
        AvailableProviderInfo {
            id: "http-llm".to_string(),
            name: "Custom LLM / OpenAI API".to_string(),
            provider_type: "http".to_string(),
            available: http_configured,
            description: format!("Configured endpoint at {}", settings.llm_config.endpoint_url),
            default_model: if !settings.llm_config.model.is_empty() {
                settings.llm_config.model.clone()
            } else {
                "gpt-4o".to_string()
            },
            supports_thinking: true,
            supports_effort: false,
        },
        AvailableProviderInfo {
            id: "claude-code".to_string(),
            name: "Claude Code CLI".to_string(),
            provider_type: "cli".to_string(),
            available: claude_available,
            description: "Anthropic Claude Code CLI in plan/read-only mode.".to_string(),
            default_model: "claude-3-7-sonnet".to_string(),
            supports_thinking: true,
            supports_effort: true,
        },
        AvailableProviderInfo {
            id: "gemini-antigravity".to_string(),
            name: "Antigravity Gemini CLI (agy)".to_string(),
            provider_type: "cli".to_string(),
            available: gemini_available,
            description: "Google Antigravity CLI sandbox runner.".to_string(),
            default_model: "gemini-2.5-pro".to_string(),
            supports_thinking: true,
            supports_effort: true,
        },
    ]
}

