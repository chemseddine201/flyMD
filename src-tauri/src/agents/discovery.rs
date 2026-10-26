//! Agent discovery, binary detection, and authentication status resolution.

use super::types::{AgentCredentialConfig, AgentProfile};
use std::collections::HashMap;
use std::path::PathBuf;

/// Resolves the user's home directory across Windows / Unix platforms.
pub fn get_user_home_dir() -> Option<PathBuf> {
    if let Ok(profile) = std::env::var("USERPROFILE") {
        let p = PathBuf::from(profile);
        if p.exists() {
            return Some(p);
        }
    }
    if let Ok(home) = std::env::var("HOME") {
        let p = PathBuf::from(home);
        if p.exists() {
            return Some(p);
        }
    }
    None
}

/// Locates executable binaries across PATH and standard user installation directories.
pub fn find_binary_on_system(candidates: &[&str]) -> Option<String> {
    let mut search_dirs: Vec<PathBuf> = Vec::new();

    if let Ok(path_var) = std::env::var("PATH") {
        for part in std::env::split_paths(&path_var) {
            if part.exists() {
                search_dirs.push(part);
            }
        }
    }

    if let Some(home) = get_user_home_dir() {
        search_dirs.push(home.join(".local").join("bin"));
        search_dirs.push(home.join(".cargo").join("bin"));
        search_dirs.push(home.join(".opencode").join("bin"));
        search_dirs.push(home.join(".claude").join("local"));
        search_dirs.push(home.join("AppData").join("Local").join("agy").join("bin"));
        search_dirs.push(home.join("AppData").join("Roaming").join("npm"));
        search_dirs.push(
            home.join("AppData")
                .join("Local")
                .join("Programs")
                .join("cursor")
                .join("resources")
                .join("app")
                .join("bin"),
        );
        search_dirs.push(
            home.join("AppData")
                .join("Local")
                .join("Programs")
                .join("Antigravity")
                .join("bin"),
        );
        search_dirs.push(
            home.join("AppData")
                .join("Local")
                .join("Programs")
                .join("Antigravity IDE")
                .join("bin"),
        );
        search_dirs.push(
            home.join("AppData")
                .join("Local")
                .join("Programs")
                .join("Zed")
                .join("bin"),
        );
        search_dirs.push(home.join("AppData").join("Local").join("Zed").join("bin"));
    }

    let exts = if cfg!(target_os = "windows") {
        vec![".exe", ".cmd", ".bat", ""]
    } else {
        vec![""]
    };

    for dir in &search_dirs {
        for cand in candidates {
            for ext in &exts {
                let fname = if !ext.is_empty() && cand.ends_with(ext) {
                    cand.to_string()
                } else {
                    format!("{}{}", cand, ext)
                };
                let full = dir.join(&fname);
                if full.is_file() {
                    return Some(full.to_string_lossy().to_string());
                }
            }
        }
    }

    None
}

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
            connected_account_label: user_cred.and_then(|c| c.connected_account_label.clone()),
            artifact_watch_paths: watch_paths.iter().map(|s| s.to_string()).collect(),
            enabled: !is_disabled,
            is_custom: false,
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
        });
    }

    profiles
}
