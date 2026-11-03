//! Agent discovery, binary detection, and authentication status resolution.

use super::types::{AgentCredentialConfig, AgentProfile, FetchedAgentModel};
use std::collections::HashMap;

pub use crate::common::process::{find_binary_on_system, get_user_home_dir};

/// Checks dot-directories and config markers for installed agent state.
pub fn check_agent_home_markers(agent_id: &str) -> (bool, bool) {
    let Some(home) = get_user_home_dir() else {
        return (false, false);
    };

    match agent_id {
        "antigravity" => {
            let brain = home.join(".gemini").join("antigravity");
            let exists = brain.exists();
            (exists, exists)
        }
        "claude-code" => {
            let claude_dir = home.join(".claude");
            let claude_json = home.join(".claude.json");
            let cred = claude_dir.join(".credentials.json");
            let installed = claude_dir.exists() || claude_json.exists();
            let authed = cred.exists() || claude_json.exists();
            (installed, authed)
        }
        "opencode" => {
            let oc_dir = home.join(".config").join("opencode");
            let oc_share = home.join(".local").join("share").join("opencode");
            let oc_home = home.join(".opencode");
            let installed = oc_dir.exists() || oc_share.exists() || oc_home.exists();
            let authed = oc_share.join("auth.json").exists() || oc_dir.exists();
            (installed, authed)
        }
        "zcode" => {
            let zed_dir = home.join(".config").join("zed");
            let zed_win = home.join("AppData").join("Roaming").join("Zed");
            let installed = zed_dir.exists() || zed_win.exists();
            (installed, installed)
        }
        "cursor" => {
            let cur_dir = home.join(".cursor");
            let cur_win = home.join("AppData").join("Roaming").join("Cursor");
            let installed = cur_dir.exists() || cur_win.exists();
            (installed, installed)
        }
        "codex" => {
            let cx_dir = home.join(".codex");
            let installed = cx_dir.exists();
            let authed = cx_dir.join("auth.json").exists() || cx_dir.join("config.json").exists();
            (installed, authed)
        }
        _ => (false, false),
    }
}

/// Inspects agent credentials and configuration files to extract active subscription tier,
/// configured default model, and connected account identity.
pub fn detect_agent_subscription_and_model(
    agent_id: &str,
) -> (Option<String>, Option<String>, Option<String>) {
    let Some(home) = get_user_home_dir() else {
        return (None, None, None);
    };

    match agent_id {
        "claude-code" => {
            let mut detected_tier = None;
            let mut detected_model = None;
            let mut detected_account = None;

            // 1. Try ~/.claude/.credentials.json for subscription type & org
            let cred_path = home.join(".claude").join(".credentials.json");
            if let Ok(content) = std::fs::read_to_string(&cred_path) {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(oauth) = v.get("claudeAiOauth") {
                        if let Some(st) = oauth.get("subscriptionType").and_then(|s| s.as_str()) {
                            detected_tier = Some(st.to_string());
                        }
                    }
                    if let Some(org) = v.get("organizationUuid").and_then(|s| s.as_str()) {
                        let prefix = if org.len() > 8 { &org[..8] } else { org };
                        detected_account = Some(format!("Claude Org ({})", prefix));
                    }
                }
            }

            // 2. Try ~/.claude/settings.json for configured default models (e.g. claude-opus-5-5)
            let settings_path = home.join(".claude").join("settings.json");
            if let Ok(content) = std::fs::read_to_string(&settings_path) {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(ms) = v.get("modelSettings").and_then(|m| m.as_object()) {
                        for key in ms.keys() {
                            if key.contains("opus") || key.contains("sonnet") || key.contains("claude") {
                                detected_model = Some(key.clone());
                                break;
                            }
                        }
                    }
                }
            }

            // Fallback: If on pro/team tier and no model explicitly configured in settings, default to frontier opus
            if detected_model.is_none() {
                if let Some(ref tier) = detected_tier {
                    if tier == "pro" || tier == "team" || tier == "max" {
                        detected_model = Some("claude-opus-5-5".to_string());
                    }
                }
            }

            (detected_tier, detected_model, detected_account)
        }
        "antigravity" => {
            let mut detected_tier = None;
            let mut detected_model = None;
            let mut detected_account = None;

            let gemini_dir = home.join(".gemini");
            let accounts_path = gemini_dir.join("google_accounts.json");
            if let Ok(content) = std::fs::read_to_string(&accounts_path) {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(active) = v.get("active").and_then(|s| s.as_str()) {
                        if !active.trim().is_empty() {
                            detected_account = Some(active.to_string());
                            detected_tier = Some("advanced".to_string());
                            detected_model = Some("gemini-4-argon".to_string());
                        }
                    }
                }
            }

            if detected_tier.is_none() && gemini_dir.join("antigravity").exists() {
                detected_tier = Some("advanced".to_string());
                detected_model = Some("gemini-4-argon".to_string());
            }

            (detected_tier, detected_model, detected_account)
        }
        "cursor" => {
            (Some("pro".to_string()), Some("claude-opus-5-5".to_string()), None)
        }
        "codex" => {
            (Some("plus".to_string()), Some("o3-mini".to_string()), None)
        }
        "zcode" => {
            (Some("pro".to_string()), Some("claude-opus-5-5".to_string()), None)
        }
        "opencode" => {
            (Some("open".to_string()), Some("claude-opus-5-5".to_string()), None)
        }
        _ => (None, None, None),
    }
}

/// Scans and returns all builtin and user-custom agent profiles with live auth and binary status.
pub fn discover_agent_profiles(
    creds: &HashMap<String, AgentCredentialConfig>,
) -> Vec<AgentProfile> {
    let definitions = vec![
        (
            "antigravity",
            "Antigravity",
            "Antigravity",
            "Google DeepMind",
            "Agentic coding IDE & workspace supervisor with deep reasoning and artifact generation.",
            "#38bdf8",
            "bg-sky-500/15 border-sky-500/40",
            "text-sky-300",
            vec!["agy", "antigravity"],
            "ide-workflow",
            Some("agy auth login"),
            Some("https://aistudio.google.com/prompts/new_chat"),
            Some("GEMINI_API_KEY"),
            vec![".gemini/antigravity/brain", ".agent/workflows"],
        ),
        (
            "claude-code",
            "Claude Code",
            "Claude",
            "Anthropic",
            "Autonomous terminal & IDE coding agent powered by Claude Sonnet & Opus.",
            "#fb923c",
            "bg-orange-500/15 border-orange-500/40",
            "text-orange-300",
            vec!["claude"],
            "cli-pty",
            Some("claude login"),
            Some("https://claude.ai/new"),
            Some("ANTHROPIC_API_KEY"),
            vec![".claude", ".claude/commands"],
        ),
        (
            "opencode",
            "OpenCode",
            "OpenCode",
            "OpenCode AI",
            "Open-source terminal coding agent supporting multi-provider LLMs and fast execution.",
            "#34d399",
            "bg-emerald-500/15 border-emerald-500/40",
            "text-emerald-300",
            vec!["opencode"],
            "cli-pty",
            Some("opencode auth login"),
            Some("https://openrouter.ai/chat"),
            Some("OPENAI_API_KEY"),
            vec![".opencode"],
        ),
        (
            "zcode",
            "ZCode / Zed",
            "ZCode",
            "Zed Industries",
            "High-performance multiplayer & AI-native code editor with inline assistant.",
            "#a78bfa",
            "bg-violet-500/15 border-violet-500/40",
            "text-violet-300",
            vec!["zcode", "zed"],
            "ide-workflow",
            Some("zed --login"),
            Some("https://zed.dev/account"),
            Some("ANTHROPIC_API_KEY"),
            vec![".zed"],
        ),
        (
            "cursor",
            "Cursor",
            "Cursor",
            "Anysphere",
            "AI-first code editor with Composer multi-file agent and .cursor/rules workflows.",
            "#60a5fa",
            "bg-blue-500/15 border-blue-500/40",
            "text-blue-300",
            vec!["cursor"],
            "ide-workflow",
            Some("cursor"),
            Some("https://www.cursor.com/agents"),
            Some("OPENAI_API_KEY"),
            vec![".cursor/rules"],
        ),
        (
            "codex",
            "OpenAI Codex",
            "Codex",
            "OpenAI",
            "Lightweight terminal coding agent from OpenAI for autonomous code synthesis & testing.",
            "#f472b6",
            "bg-pink-500/15 border-pink-500/40",
            "text-pink-300",
            vec!["codex"],
            "cli-pty",
            Some("codex login"),
            Some("https://chatgpt.com/"),
            Some("OPENAI_API_KEY"),
            vec![".codex"],
        ),
    ];

    let mut profiles = Vec::new();

    for (
        id,
        name,
        short_name,
        vendor,
        desc,
        accent,
        badge_bg,
        badge_text,
        bins,
        tier,
        login_cmd,
        web_url,
        env_key,
        watch_paths,
    ) in definitions
    {
        let user_cred = creds.get(id);
        let custom_bin = user_cred
            .and_then(|c| c.custom_binary_path.clone())
            .filter(|s| !s.trim().is_empty());

        let detected_bin = custom_bin.or_else(|| find_binary_on_system(&bins));
        let (marker_installed, marker_authed) = check_agent_home_markers(id);

        let has_stored_key = user_cred
            .and_then(|c| c.api_key.as_ref())
            .map(|k| !k.trim().is_empty())
            .unwrap_or(false);

        let has_env_key = env_key
            .and_then(|k| std::env::var(k).ok())
            .map(|v| !v.trim().is_empty())
            .unwrap_or(false);

        let has_api_key = has_stored_key || has_env_key;
        let oauth_verified = user_cred.map(|c| c.oauth_verified).unwrap_or(false) || marker_authed;
        let web_session_verified = user_cred.map(|c| c.web_session_verified).unwrap_or(false);
        let installed = detected_bin.is_some()
            || marker_installed
            || has_api_key
            || oauth_verified
            || web_session_verified;

        let auth_status = if web_session_verified {
            "web-connected"
        } else if oauth_verified {
            "connected"
        } else if has_api_key {
            "api-key-ready"
        } else if installed {
            "needs-login"
        } else {
            "not-installed"
        };

        let resolved_web_url = user_cred
            .and_then(|c| c.custom_web_url.clone())
            .filter(|s| !s.trim().is_empty())
            .or_else(|| web_url.map(|s| s.to_string()));

        let resolved_login_cmd = user_cred
            .and_then(|c| c.custom_login_command.clone())
            .filter(|s| !s.trim().is_empty())
            .or_else(|| login_cmd.map(|s| s.to_string()));

        let is_disabled = user_cred.map(|c| c.disabled).unwrap_or(false);

        let supports_effort = matches!(id, "claude-code" | "antigravity" | "codex" | "opencode");
        let supports_thinking = matches!(id, "claude-code" | "antigravity" | "codex" | "opencode");

        let (dyn_tier, dyn_model, dyn_account) = detect_agent_subscription_and_model(id);

        let resolved_account_label = user_cred
            .and_then(|c| c.connected_account_label.clone())
            .or(dyn_account);

        let resolved_subscription_tier = user_cred
            .and_then(|c| c.subscription_tier.clone())
            .filter(|s| !s.trim().is_empty())
            .or(dyn_tier)
            .or_else(|| {
                if has_api_key {
                    Some(if id == "antigravity" { "vertex".to_string() } else { "api".to_string() })
                } else if oauth_verified {
                    Some(match id {
                        "claude-code" => "pro".to_string(),
                        "antigravity" => "advanced".to_string(),
                        "codex" => "plus".to_string(),
                        _ => "open".to_string(),
                    })
                } else if web_session_verified {
                    Some("free".to_string())
                } else {
                    None
                }
            });

        let resolved_default_model = user_cred
            .and_then(|c| c.selected_model.clone())
            .filter(|s| !s.trim().is_empty())
            .or(dyn_model)
            .or_else(|| {
                Some(match id {
                    "claude-code" => {
                        if resolved_subscription_tier.as_deref() == Some("free") {
                            "claude-3-5-sonnet".to_string()
                        } else {
                            "claude-opus-5-5".to_string()
                        }
                    }
                    "antigravity" => {
                        if resolved_subscription_tier.as_deref() == Some("free") {
                            "gemini-3.8-flash".to_string()
                        } else {
                            "gemini-4-argon".to_string()
                        }
                    }
                    "codex" => {
                        if resolved_subscription_tier.as_deref() == Some("free") {
                            "gpt-4o-mini".to_string()
                        } else {
                            "o3-mini".to_string()
                        }
                    }
                    "opencode" => "claude-opus-5-5".to_string(),
                    "cursor" | "zcode" => "claude-opus-5-5".to_string(),
                    _ => "claude-opus-5-5".to_string(),
                })
            });

        profiles.push(AgentProfile {
            id: id.to_string(),
            name: name.to_string(),
            short_name: short_name.to_string(),
            vendor: vendor.to_string(),
            description: desc.to_string(),
            accent_color: accent.to_string(),
            badge_bg: badge_bg.to_string(),
            badge_text: badge_text.to_string(),
            binary_names: bins.iter().map(|s| s.to_string()).collect(),
            detected_binary_path: detected_bin,
            installed,
            auth_status: auth_status.to_string(),
            tier: tier.to_string(),
            login_command: resolved_login_cmd,
            web_url: resolved_web_url,
            env_key_name: env_key.map(|s| s.to_string()),
            has_api_key,
            web_auth_connected: web_session_verified,
            connected_account_label: resolved_account_label,
            artifact_watch_paths: watch_paths.iter().map(|s| s.to_string()).collect(),
            enabled: !is_disabled,
            is_custom: false,
            supports_effort: Some(supports_effort),
            supports_thinking: Some(supports_thinking),
            default_model_id: resolved_default_model,
            subscription_tier: resolved_subscription_tier,
        });
    }

    let mut custom_entries: Vec<(String, AgentCredentialConfig)> = creds
        .iter()
        .filter(|(_, c)| c.is_custom_agent)
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect();
    custom_entries.sort_by(|a, b| a.0.cmp(&b.0));

    for (cid, cred) in custom_entries {
        let cname = cred
            .custom_name
            .clone()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| "Custom Agent".to_string());
        let short_name = cname
            .split_whitespace()
            .next()
            .unwrap_or(&cname)
            .to_string();
        let cvendor = cred
            .custom_vendor
            .clone()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| "Custom Agent".to_string());
        let cdesc = cred
            .custom_description
            .clone()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| "User-defined custom AI agent for Markdown handoffs.".to_string());
        let caccent = cred
            .custom_accent_color
            .clone()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| "#10b981".to_string());
        let cbin = cred
            .custom_binary_path
            .clone()
            .filter(|s| !s.trim().is_empty());
        let cweb = cred.custom_web_url.clone().filter(|s| !s.trim().is_empty());
        let clogin = cred
            .custom_login_command
            .clone()
            .filter(|s| !s.trim().is_empty())
            .or_else(|| cbin.clone());
        let has_key = cred
            .api_key
            .as_ref()
            .map(|k| !k.trim().is_empty())
            .unwrap_or(false);

        let installed = cbin.is_some() || cweb.is_some() || has_key;
        let auth_status = if cred.web_session_verified {
            "web-connected"
        } else if cred.oauth_verified {
            "connected"
        } else if has_key {
            "api-key-ready"
        } else if installed {
            "ready"
        } else {
            "needs-setup"
        };

        profiles.push(AgentProfile {
            id: cid,
            name: cname,
            short_name,
            vendor: cvendor,
            description: cdesc,
            accent_color: caccent,
            badge_bg: "bg-emerald-500/15 border-emerald-500/40".to_string(),
            badge_text: "text-emerald-300".to_string(),
            binary_names: cbin.clone().map(|b| vec![b]).unwrap_or_default(),
            detected_binary_path: cbin,
            installed,
            auth_status: auth_status.to_string(),
            tier: "custom-runner".to_string(),
            login_command: clogin,
            web_url: cweb,
            env_key_name: None,
            has_api_key: has_key,
            web_auth_connected: cred.web_session_verified,
            connected_account_label: cred
                .connected_account_label
                .clone()
                .or_else(|| Some("Custom User Agent".to_string())),
            artifact_watch_paths: Vec::new(),
            enabled: !cred.disabled,
            is_custom: true,
            supports_effort: Some(cred.default_effort_level.is_some()),
            supports_thinking: Some(cred.default_thinking_enabled.unwrap_or(true)),
            default_model_id: cred
                .selected_model
                .clone()
                .filter(|s| !s.trim().is_empty())
                .or_else(|| Some("custom-agent-default".to_string())),
            subscription_tier: cred
                .subscription_tier
                .clone()
                .filter(|s| !s.trim().is_empty())
                .or_else(|| Some(if has_key { "api".to_string() } else { "custom".to_string() })),
        });
    }

    profiles
}

/// Probes the installed CLI / subscription configuration for the specified agent and returns
/// only the real available subscription models with their supported effort tiers.
pub fn fetch_live_agent_models(
    agent_id: &str,
    creds: &HashMap<String, AgentCredentialConfig>,
) -> Vec<FetchedAgentModel> {
    let norm = agent_id.trim().to_lowercase();

    if norm == "antigravity" || norm == "gemini-antigravity" || norm == "gemini" || norm == "agy" {
        let custom_bin = creds
            .get("antigravity")
            .and_then(|c| c.custom_binary_path.clone())
            .filter(|s| !s.trim().is_empty());
        let bin = custom_bin.or_else(|| find_binary_on_system(&["agy", "antigravity"]));

        if let Some(bin_path) = bin {
            let lower_bin = bin_path.to_lowercase();
            let mut cmd = if lower_bin.ends_with(".cmd") || lower_bin.ends_with(".bat") {
                let mut c = std::process::Command::new("cmd");
                c.args(["/C", &bin_path, "models"]);
                c
            } else {
                let mut c = std::process::Command::new(&bin_path);
                c.arg("models");
                c
            };

            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                const CREATE_NO_WINDOW: u32 = 0x08000000;
                cmd.creation_flags(CREATE_NO_WINDOW);
            }

            if let Ok(output) = cmd.output() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let mut order: Vec<String> = Vec::new();
                let mut name_map: HashMap<String, String> = HashMap::new();
                let mut efforts_map: HashMap<String, Vec<String>> = HashMap::new();

                for line in stdout.lines() {
                    let trimmed = line.trim();
                    let Some((raw_slug, raw_label)) = trimmed.split_once('\t') else {
                        continue;
                    };
                    let slug = raw_slug.trim();
                    let label = raw_label.trim();
                    if slug.is_empty() {
                        continue;
                    }

                    let mut base_slug = slug.to_string();
                    let mut parsed_effort: Option<String> = None;
                    for eff_suffix in ["low", "medium", "high", "xhigh", "max"] {
                        let pat = format!("-{}", eff_suffix);
                        if slug.ends_with(&pat) {
                            base_slug = slug[..slug.len() - pat.len()].to_string();
                            parsed_effort = Some(eff_suffix.to_string());
                            break;
                        }
                    }

                    let mut clean_label = label.to_string();
                    for suffix_label in [" (Low)", " (Medium)", " (High)", " (X-High)", " (Max)"] {
                        if clean_label.ends_with(suffix_label) {
                            clean_label = clean_label[..clean_label.len() - suffix_label.len()]
                                .trim()
                                .to_string();
                            break;
                        }
                    }

                    if !order.contains(&base_slug) {
                        order.push(base_slug.clone());
                    }
                    name_map.entry(base_slug.clone()).or_insert(clean_label);
                    let entry = efforts_map.entry(base_slug).or_default();
                    if let Some(eff) = parsed_effort {
                        if !entry.contains(&eff) {
                            entry.push(eff);
                        }
                    }
                }

                if !order.is_empty() {
                    let canonical = ["low", "medium", "high", "xhigh", "max"];
                    return order
                        .into_iter()
                        .map(|id| {
                            let mut effs = efforts_map.remove(&id).unwrap_or_default();
                            effs.sort_by_key(|e| {
                                canonical.iter().position(|c| c == e).unwrap_or(99)
                            });
                            if effs.is_empty() {
                                effs = vec![
                                    "low".to_string(),
                                    "medium".to_string(),
                                    "high".to_string(),
                                ];
                            }
                            let default_effort = if effs.iter().any(|e| e == "high") {
                                "high".to_string()
                            } else if effs.iter().any(|e| e == "medium") {
                                "medium".to_string()
                            } else {
                                effs[0].clone()
                            };
                            let display_name =
                                name_map.remove(&id).unwrap_or_else(|| id.clone());
                            FetchedAgentModel {
                                id: id.clone(),
                                display_name: display_name.clone(),
                                supports_reasoning: true,
                                supported_effort_levels: effs,
                                default_effort_level: default_effort,
                                description: Some(format!(
                                    "{} (Live Antigravity CLI subscription model)",
                                    display_name
                                )),
                            }
                        })
                        .collect();
                }
            }
        }

        return vec![
            FetchedAgentModel {
                id: "gemini-4-argon".to_string(),
                display_name: "Gemini 4 Argon".to_string(),
                supports_reasoning: true,
                supported_effort_levels: vec![
                    "low".to_string(),
                    "medium".to_string(),
                    "high".to_string(),
                ],
                default_effort_level: "high".to_string(),
                description: Some("Flagship Gemini 4 Argon reasoning model via Antigravity CLI.".to_string()),
            },
            FetchedAgentModel {
                id: "gemini-3.8-flash".to_string(),
                display_name: "Gemini 3.8 Flash".to_string(),
                supports_reasoning: true,
                supported_effort_levels: vec![
                    "low".to_string(),
                    "medium".to_string(),
                    "high".to_string(),
                ],
                default_effort_level: "high".to_string(),
                description: Some("High-speed Gemini 3.8 Flash model via Antigravity CLI.".to_string()),
            },
            FetchedAgentModel {
                id: "claude-opus-5-5".to_string(),
                display_name: "Claude Opus 5.5".to_string(),
                supports_reasoning: true,
                supported_effort_levels: vec![
                    "low".to_string(),
                    "medium".to_string(),
                    "high".to_string(),
                ],
                default_effort_level: "high".to_string(),
                description: Some("Claude Opus 5.5 via Antigravity CLI.".to_string()),
            },
            FetchedAgentModel {
                id: "claude-sonnet-5-5".to_string(),
                display_name: "Claude Sonnet 5.5".to_string(),
                supports_reasoning: true,
                supported_effort_levels: vec![
                    "low".to_string(),
                    "medium".to_string(),
                    "high".to_string(),
                ],
                default_effort_level: "high".to_string(),
                description: Some("Claude Sonnet 5.5 via Antigravity CLI.".to_string()),
            },
            FetchedAgentModel {
                id: "gpt-oss-120b".to_string(),
                display_name: "GPT-OSS 120B".to_string(),
                supports_reasoning: true,
                supported_effort_levels: vec!["medium".to_string()],
                default_effort_level: "medium".to_string(),
                description: Some("GPT-OSS 120B (Medium effort) via Antigravity CLI.".to_string()),
            },
        ];
    }

    if norm == "claude-code" || norm == "claude" || norm == "anthropic" {
        let mut models: Vec<FetchedAgentModel> = Vec::new();
        let mut seen: Vec<String> = Vec::new();

        if let Some(home) = get_user_home_dir() {
            let settings_path = home.join(".claude").join("settings.json");
            if let Ok(content) = std::fs::read_to_string(&settings_path) {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(ms) = v.get("modelSettings").and_then(|m| m.as_object()) {
                        for key in ms.keys() {
                            let k = key.trim().to_string();
                            if !k.is_empty() && !seen.contains(&k) {
                                seen.push(k.clone());
                                let display = match k.as_str() {
                                    "claude-opus-5-5" => "Claude Opus 5.5".to_string(),
                                    "claude-sonnet-5-5" => "Claude Sonnet 5.5".to_string(),
                                    other => other.to_string(),
                                };
                                models.push(FetchedAgentModel {
                                    id: k,
                                    display_name: display,
                                    supports_reasoning: true,
                                    supported_effort_levels: vec![
                                        "low".to_string(),
                                        "medium".to_string(),
                                        "high".to_string(),
                                        "xhigh".to_string(),
                                        "max".to_string(),
                                    ],
                                    default_effort_level: "high".to_string(),
                                    description: Some("Configured in ~/.claude/settings.json".to_string()),
                                });
                            }
                        }
                    }
                }
            }
        }

        let defaults = [
            ("claude-opus-5-5", "Claude Opus 5.5", vec!["low", "medium", "high", "xhigh", "max"], "high"),
            ("claude-sonnet-5-5", "Claude Sonnet 5.5", vec!["low", "medium", "high", "xhigh", "max"], "high"),
            ("opus", "Claude Opus (Latest Alias)", vec!["low", "medium", "high", "xhigh", "max"], "high"),
            ("sonnet", "Claude Sonnet (Latest Alias)", vec!["low", "medium", "high", "xhigh", "max"], "high"),
            ("haiku", "Claude Haiku (Fast Alias)", vec!["low", "medium", "high"], "medium"),
        ];

        for (id, name, effs, def_eff) in defaults {
            if !seen.contains(&id.to_string()) {
                seen.push(id.to_string());
                models.push(FetchedAgentModel {
                    id: id.to_string(),
                    display_name: name.to_string(),
                    supports_reasoning: true,
                    supported_effort_levels: effs.into_iter().map(|s| s.to_string()).collect(),
                    default_effort_level: def_eff.to_string(),
                    description: Some(format!("{} via Claude Code CLI subscription", name)),
                });
            }
        }
        return models;
    }

    if norm == "codex" || norm == "openai" {
        return vec![
            FetchedAgentModel {
                id: "o3-mini".to_string(),
                display_name: "OpenAI o3-mini".to_string(),
                supports_reasoning: true,
                supported_effort_levels: vec!["low".to_string(), "medium".to_string(), "high".to_string()],
                default_effort_level: "high".to_string(),
                description: Some("Fast reasoning model via OpenAI Codex CLI.".to_string()),
            },
            FetchedAgentModel {
                id: "o3".to_string(),
                display_name: "OpenAI o3".to_string(),
                supports_reasoning: true,
                supported_effort_levels: vec![
                    "low".to_string(),
                    "medium".to_string(),
                    "high".to_string(),
                    "xhigh".to_string(),
                ],
                default_effort_level: "high".to_string(),
                description: Some("Deep reasoning model via OpenAI Codex CLI.".to_string()),
            },
            FetchedAgentModel {
                id: "gpt-4o".to_string(),
                display_name: "GPT-4o".to_string(),
                supports_reasoning: false,
                supported_effort_levels: vec!["low".to_string(), "medium".to_string(), "high".to_string()],
                default_effort_level: "medium".to_string(),
                description: Some("Omni model via OpenAI Codex CLI.".to_string()),
            },
        ];
    }

    vec![
        FetchedAgentModel {
            id: "claude-opus-5-5".to_string(),
            display_name: "Claude Opus 5.5".to_string(),
            supports_reasoning: true,
            supported_effort_levels: vec![
                "low".to_string(),
                "medium".to_string(),
                "high".to_string(),
            ],
            default_effort_level: "high".to_string(),
            description: Some("Claude Opus 5.5 frontier model.".to_string()),
        },
        FetchedAgentModel {
            id: "claude-sonnet-5-5".to_string(),
            display_name: "Claude Sonnet 5.5".to_string(),
            supports_reasoning: true,
            supported_effort_levels: vec![
                "low".to_string(),
                "medium".to_string(),
                "high".to_string(),
            ],
            default_effort_level: "high".to_string(),
            description: Some("Claude Sonnet 5.5 balanced model.".to_string()),
        },
        FetchedAgentModel {
            id: "gemini-4-argon".to_string(),
            display_name: "Gemini 4 Argon".to_string(),
            supports_reasoning: true,
            supported_effort_levels: vec![
                "low".to_string(),
                "medium".to_string(),
                "high".to_string(),
            ],
            default_effort_level: "high".to_string(),
            description: Some("Gemini 4 Argon reasoning model.".to_string()),
        },
    ]
}
