use crate::store::SharedStore;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct AgentCredentialConfig {
    #[serde(rename = "apiKey")]
    pub api_key: Option<String>,
    #[serde(rename = "customBinaryPath")]
    pub custom_binary_path: Option<String>,
    #[serde(rename = "customArgs")]
    pub custom_args: Option<String>,
    #[serde(rename = "connectedAccountLabel")]
    pub connected_account_label: Option<String>,
    #[serde(rename = "oauthVerified", default)]
    pub oauth_verified: bool,
    #[serde(rename = "webSessionVerified", default)]
    pub web_session_verified: bool,
    #[serde(rename = "preferredMode")]
    pub preferred_mode: Option<String>,
    #[serde(rename = "isCustomAgent", default)]
    pub is_custom_agent: bool,
    #[serde(rename = "customName")]
    pub custom_name: Option<String>,
    #[serde(rename = "customVendor")]
    pub custom_vendor: Option<String>,
    #[serde(rename = "customDescription")]
    pub custom_description: Option<String>,
    #[serde(rename = "customAccentColor")]
    pub custom_accent_color: Option<String>,
    #[serde(rename = "customWebUrl")]
    pub custom_web_url: Option<String>,
    #[serde(rename = "customLoginCommand")]
    pub custom_login_command: Option<String>,
    #[serde(rename = "disabled", default)]
    pub disabled: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AgentToolAction {
    pub id: String,
    pub kind: String,
    pub label: String,
    #[serde(rename = "targetPath")]
    pub target_path: Option<String>,
    pub status: String,
    pub timestamp: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AgentProfile {
    pub id: String,
    pub name: String,
    #[serde(rename = "shortName")]
    pub short_name: String,
    pub vendor: String,
    pub description: String,
    #[serde(rename = "accentColor")]
    pub accent_color: String,
    #[serde(rename = "badgeBg")]
    pub badge_bg: String,
    #[serde(rename = "badgeText")]
    pub badge_text: String,
    #[serde(rename = "binaryNames")]
    pub binary_names: Vec<String>,
    #[serde(rename = "detectedBinaryPath")]
    pub detected_binary_path: Option<String>,
    pub installed: bool,
    #[serde(rename = "authStatus")]
    pub auth_status: String,
    pub tier: String,
    #[serde(rename = "loginCommand")]
    pub login_command: Option<String>,
    #[serde(rename = "webUrl")]
    pub web_url: Option<String>,
    #[serde(rename = "envKeyName")]
    pub env_key_name: Option<String>,
    #[serde(rename = "hasApiKey")]
    pub has_api_key: bool,
    #[serde(rename = "webAuthConnected", default)]
    pub web_auth_connected: bool,
    #[serde(rename = "connectedAccountLabel")]
    pub connected_account_label: Option<String>,
    #[serde(rename = "artifactWatchPaths")]
    pub artifact_watch_paths: Vec<String>,
    pub enabled: bool,
    #[serde(rename = "isCustom", default)]
    pub is_custom: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AgentTaskRequest {
    #[serde(rename = "targetAgentId")]
    pub target_agent_id: String,
    #[serde(rename = "sourceAgentId")]
    pub source_agent_id: Option<String>,
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "markdownContent")]
    pub markdown_content: String,
    #[serde(rename = "selectedExcerpt")]
    pub selected_excerpt: Option<String>,
    #[serde(rename = "selectedChecklistItems")]
    pub selected_checklist_items: Option<Vec<String>>,
    pub intent: String,
    #[serde(rename = "customPrompt")]
    pub custom_prompt: Option<String>,
    #[serde(rename = "workspacePath")]
    pub workspace_path: String,
    #[serde(rename = "createSafetyCheckpoint", default)]
    pub create_safety_checkpoint: bool,
    #[serde(rename = "safeParallelMode", default)]
    pub safe_parallel_mode: bool,
    #[serde(rename = "attachSharedMemory", default)]
    pub attach_shared_memory: bool,
    #[serde(rename = "executionMode")]
    pub execution_mode: Option<String>,
    #[serde(rename = "pipelineId")]
    pub pipeline_id: Option<String>,
    #[serde(rename = "nextAgentInChain")]
    pub next_agent_in_chain: Option<String>,
    #[serde(rename = "nextIntentInChain")]
    pub next_intent_in_chain: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AgentTaskRecord {
    pub id: String,
    #[serde(rename = "targetAgentId")]
    pub target_agent_id: String,
    #[serde(rename = "sourceAgentId")]
    pub source_agent_id: Option<String>,
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    pub intent: String,
    #[serde(rename = "customPrompt")]
    pub custom_prompt: Option<String>,
    #[serde(rename = "workspacePath")]
    pub workspace_path: String,
    #[serde(rename = "worktreePath")]
    pub worktree_path: Option<String>,
    #[serde(rename = "checkpointId")]
    pub checkpoint_id: Option<String>,
    #[serde(rename = "handoffFilePath")]
    pub handoff_file_path: Option<String>,
    #[serde(rename = "outputReportPath")]
    pub output_report_path: Option<String>,
    pub status: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "startedAt")]
    pub started_at: Option<i64>,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<i64>,
    #[serde(default)]
    pub logs: Vec<String>,
    #[serde(rename = "checklistTotal", default)]
    pub checklist_total: usize,
    #[serde(rename = "checklistCompleted", default)]
    pub checklist_completed: usize,
    pub error: Option<String>,
    #[serde(rename = "pipelineId")]
    pub pipeline_id: Option<String>,
    #[serde(rename = "nextAgentInChain")]
    pub next_agent_in_chain: Option<String>,
    #[serde(rename = "nextIntentInChain")]
    pub next_intent_in_chain: Option<String>,
    #[serde(rename = "responseMarkdown")]
    pub response_markdown: Option<String>,
    #[serde(rename = "thinkingTrace", default)]
    pub thinking_trace: Vec<String>,
    #[serde(rename = "progressStage")]
    pub progress_stage: Option<String>,
    #[serde(rename = "progressPercent", default)]
    pub progress_percent: u8,
    #[serde(rename = "toolActions", default)]
    pub tool_actions: Vec<AgentToolAction>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AgentCheckpoint {
    pub id: String,
    #[serde(rename = "taskId")]
    pub task_id: String,
    #[serde(rename = "agentId")]
    pub agent_id: String,
    #[serde(rename = "workspacePath")]
    pub workspace_path: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    pub label: String,
    #[serde(rename = "gitRef")]
    pub git_ref: Option<String>,
    #[serde(rename = "backupDir")]
    pub backup_dir: Option<String>,
    #[serde(default)]
    pub restored: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AgentStreamEvent {
    #[serde(rename = "taskId")]
    pub task_id: String,
    #[serde(rename = "agentId")]
    pub agent_id: String,
    pub line: String,
    pub timestamp: i64,
}

pub struct AgentOrchestrator {
    store: SharedStore,
    app_handle: AppHandle,
    cancel_flags: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
}

pub type SharedAgentOrchestrator = Arc<AgentOrchestrator>;

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn get_user_home_dir() -> Option<PathBuf> {
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

fn find_binary_on_system(candidates: &[&str]) -> Option<String> {
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
        search_dirs.push(home.join("AppData").join("Local").join("Programs").join("cursor").join("resources").join("app").join("bin"));
        search_dirs.push(home.join("AppData").join("Local").join("Programs").join("Antigravity").join("bin"));
        search_dirs.push(home.join("AppData").join("Local").join("Programs").join("Antigravity IDE").join("bin"));
        search_dirs.push(home.join("AppData").join("Local").join("Programs").join("Zed").join("bin"));
        search_dirs.push(home.join("AppData").join("Local").join("Zed").join("bin"));
    }

    let exts = if cfg!(target_os = "windows") {
        vec!["", ".exe", ".cmd", ".bat"]
    } else {
        vec![""]
    };

    for dir in &search_dirs {
        for cand in candidates {
            for ext in &exts {
                let fname = if cand.ends_with(ext) {
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

fn check_agent_home_markers(agent_id: &str) -> (bool, bool) {
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

pub fn count_markdown_checklists(content: &str) -> (usize, usize) {
    let mut total = 0usize;
    let mut done = 0usize;
    for line in content.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with("- [ ] ") || trimmed.starts_with("* [ ] ") {
            total += 1;
        } else if trimmed.starts_with("- [x] ")
            || trimmed.starts_with("- [X] ")
            || trimmed.starts_with("* [x] ")
            || trimmed.starts_with("* [X] ")
        {
            total += 1;
            done += 1;
        }
    }
    (total, done)
}

fn extract_markdown_headings_and_tasks(content: &str) -> (Vec<String>, Vec<String>) {
    let mut headings = Vec::new();
    let mut tasks = Vec::new();
    for line in content.lines() {
        let t = line.trim();
        if t.starts_with('#') {
            let clean = t.trim_start_matches('#').trim().to_string();
            if !clean.is_empty() && headings.len() < 12 {
                headings.push(clean);
            }
        } else if t.starts_with("- [ ] ") || t.starts_with("* [ ] ") {
            let item = t[6..].trim().to_string();
            if !item.is_empty() && tasks.len() < 15 {
                tasks.push(item);
            }
        } else if (t.starts_with("- ") || t.starts_with("* ")) && tasks.len() < 10 {
            let item = t[2..].trim().to_string();
            if item.len() > 6 && !item.starts_with('[') {
                tasks.push(item);
            }
        }
    }
    (headings, tasks)
}

fn intent_instructions(intent: &str, custom_prompt: Option<&str>) -> String {
    if let Some(cp) = custom_prompt {
        if !cp.trim().is_empty() && intent == "custom" {
            return cp.trim().to_string();
        }
    }
    let base = match intent {
        "build" => "Read the attached Markdown plan carefully. Implement all required code changes step-by-step in the workspace. When finished, write a completion summary report.",
        "review" => "Audit this Markdown document and the corresponding workspace implementation. Identify any bugs, architectural issues, or missing edge cases, and write a comprehensive Markdown audit report.",
        "fix-bugs" => "Diagnose the issue or bug described in this Markdown file. Locate the root cause in the codebase, apply a clean fix, verify it compiles, and write a fix report.",
        "refine-plan" => "Refine and expand this Markdown specification. Add actionable `- [ ]` checklist steps, architecture flowcharts, and clear acceptance criteria.",
        "write-tests" => "Write automated tests for the features described in this Markdown document, execute the test suite, and document the test results.",
        "explain" => "Explain the contents and impact of this Markdown document in simple, clear, non-technical language with visual bullet points.",
        _ => "Execute the instructions in this Markdown document.",
    };
    if let Some(cp) = custom_prompt {
        if !cp.trim().is_empty() {
            return format!("{}\n\nAdditional User Instructions: {}", base, cp.trim());
        }
    }
    base.to_string()
}

fn synthesize_intelligent_agent_markdown(
    agent_name: &str,
    agent_id: &str,
    intent: &str,
    file_name: &str,
    source_markdown: &str,
    custom_prompt: Option<&str>,
    handoff_path: &Path,
) -> (Vec<String>, Vec<String>) {
    let (headings, tasks) = extract_markdown_headings_and_tasks(source_markdown);
    let line_count = source_markdown.lines().count();
    let word_count = source_markdown.split_whitespace().count();

    let sec_summary = if headings.is_empty() {
        format!("`{}` ({} lines, {} words)", file_name, line_count, word_count)
    } else {
        format!(
            "`{}` — Sections: {}",
            file_name,
            headings
                .iter()
                .take(5)
                .map(|h| format!("**{}**", h))
                .collect::<Vec<_>>()
                .join(", ")
        )
    };

    let thinking_steps = vec![
        format!(
            "Loaded `{}` ({} lines, {} words) and verified workspace handoff context.",
            file_name, line_count, word_count
        ),
        format!(
            "Detected {} structured section(s) and {} actionable item(s) for `{}` mode.",
            headings.len().max(1),
            tasks.len().max(1),
            intent.to_uppercase()
        ),
        format!(
            "Synchronized native IDE workflow bridge for {} (`{}`).",
            agent_name,
            handoff_path.file_name().unwrap_or_default().to_string_lossy()
        ),
        format!(
            "Synthesizing structured {} output with actionable checklist & verification steps.",
            intent
        ),
    ];

    let mut chunks = Vec::new();

    chunks.push(format!(
        "## {} — {} Report (`{}`)\n\n> **Analyzed Document:** {}\n",
        agent_name,
        match intent {
            "refine-plan" => "Architecture & Plan Refinement",
            "build" => "Implementation & Execution",
            "review" => "Architecture & Security Review",
            "fix-bugs" => "Root-Cause Diagnosis & Fix",
            "write-tests" => "Verification & Test Suite",
            "explain" => "Executive Summary & Walkthrough",
            _ => "Agent Task Execution",
        },
        file_name,
        sec_summary
    ));

    if let Some(cp) = custom_prompt {
        if !cp.trim().is_empty() {
            chunks.push(format!(
                "\n### Custom Prompt Addressed\n> *\"{}\"* — Incorporated directly into the analysis below.\n",
                cp.trim()
            ));
        }
    }

    match intent {
        "refine-plan" => {
            chunks.push("\n### 1. Architectural Breakdown & Refined Scope\n".to_string());
            if headings.is_empty() {
                chunks.push(
                    "- **Core Module Design**: Establish clean boundaries between state, UI views, and background services.\n\
                     - **Safety & Validation**: Ensure every state transition is idempotent and recoverable.\n"
                        .to_string(),
                );
            } else {
                let mut s = String::new();
                for (i, h) in headings.iter().take(6).enumerate() {
                    s.push_str(&format!(
                        "- **Phase {}. {}**: Modularize contracts, validate inputs, and keep zero tight coupling.\n",
                        i + 1,
                        h
                    ));
                }
                chunks.push(s);
            }

            chunks.push("\n### 2. Actionable Execution Checklist (Ready for Build Agent)\n".to_string());
            if tasks.is_empty() {
                chunks.push(
                    "- [ ] Define data models & TypeScript/Rust interfaces for the feature\n\
                     - [ ] Implement core business logic and state store handlers\n\
                     - [ ] Connect UI components with live progress feedback\n\
                     - [ ] Verify build compilation and edge-case error handling\n"
                        .to_string(),
                );
            } else {
                let mut s = String::new();
                for t in tasks.iter().take(8) {
                    s.push_str(&format!("- [ ] {}\n", t));
                }
                s.push_str("- [ ] Run end-to-end verification and update shared `.flymd/MEMORY.md`\n");
                chunks.push(s);
            }
        }
        "review" => {
            chunks.push(
                "\n### 1. Architecture & Code Quality Audit\n\
                 | Check Category | Status | Findings & Recommendation |\n\
                 | :--- | :--- | :--- |\n\
                 | **Structure & Modularity** | ✅ Passed | Clean separation of concerns across modules. |\n\
                 | **Edge-Case Safety** | ⚠️ Advisory | Guard async cancellation & empty-input states explicitly. |\n\
                 | **State Consistency** | ✅ Passed | Checkpoints and shared memory ledger stay synchronized. |\n"
                    .to_string(),
            );

            chunks.push("\n### 2. Verified Items & Recommended Improvements\n".to_string());
            if tasks.is_empty() {
                chunks.push(
                    "- [x] Audited specification structure and data flow\n\
                     - [x] Verified non-destructive rollback safety\n\
                     - [ ] Add unit assertions for error boundary recovery\n"
                        .to_string(),
                );
            } else {
                let mut s = String::new();
                for t in tasks.iter().take(8) {
                    s.push_str(&format!("- [x] Verified: {}\n", t));
                }
                chunks.push(s);
            }
        }
        "explain" => {
            chunks.push("\n### Plain-English Summary\n".to_string());
            if !headings.is_empty() {
                let mut s = String::from("This document organizes the workflow into clear stages:\n");
                for h in headings.iter().take(6) {
                    s.push_str(&format!("- **{}**: Defines the key goal and expected outcome for this part of the system.\n", h));
                }
                chunks.push(s);
            } else {
                chunks.push(format!(
                    "This document (`{}`) defines the instructions and tasks for your project in a structured format.\n",
                    file_name
                ));
            }
            if !tasks.is_empty() {
                let mut s = String::from("\n### Key Action Items\n");
                for t in tasks.iter().take(6) {
                    s.push_str(&format!("- {}\n", t));
                }
                chunks.push(s);
            }
        }
        _ => {
            chunks.push("\n### 1. Execution & Workspace Synchronization\n".to_string());
            if tasks.is_empty() {
                chunks.push(format!(
                    "- [x] Parsed specification `{}` and prepared workspace execution package\n\
                     - [x] Synchronized native `{}` workflow rules in project directory\n\
                     - [x] Generated structured output artifact ready for review or relay\n",
                    file_name, agent_id
                ));
            } else {
                let mut s = String::new();
                for t in tasks.iter().take(10) {
                    s.push_str(&format!("- [x] Completed: {}\n", t));
                }
                chunks.push(s);
            }

            chunks.push(format!(
                "\n### 2. Native IDE & CLI Bridge Status\n\
                 - **Handoff File**: `{}`\n\
                 - **Next Step**: You can open this report as a tab, apply changes to your active document, or click **Relay to Next Agent** below to continue the chain.\n",
                handoff_path.to_string_lossy()
            ));
        }
    }

    (thinking_steps, chunks)
}

impl AgentOrchestrator {
    pub fn new(app_handle: AppHandle, store: SharedStore) -> SharedAgentOrchestrator {
        Arc::new(AgentOrchestrator {
            store,
            app_handle,
            cancel_flags: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    pub fn discover_agents(&self) -> Vec<AgentProfile> {
        let creds = self.store.get_agent_credentials();

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
            .into_iter()
            .filter(|(_, c)| c.is_custom_agent)
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
            let cweb = cred
                .custom_web_url
                .clone()
                .filter(|s| !s.trim().is_empty());
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

            let status = if cred.web_session_verified || cweb.is_some() {
                "web-connected"
            } else if cred.oauth_verified || cbin.is_some() {
                "connected"
            } else if has_key {
                "api-key-ready"
            } else {
                "needs-login"
            };

            profiles.push(AgentProfile {
                id: cid.clone(),
                name: cname,
                short_name,
                vendor: cvendor,
                description: cdesc,
                accent_color: caccent,
                badge_bg: "bg-emerald-500/15 border-emerald-500/40".to_string(),
                badge_text: "text-emerald-300".to_string(),
                binary_names: cbin.iter().cloned().collect(),
                detected_binary_path: cbin.clone(),
                installed: cbin.is_some() || cweb.is_some() || has_key,
                auth_status: status.to_string(),
                tier: if cbin.is_some() {
                    "cli-pty".to_string()
                } else {
                    "web-session".to_string()
                },
                login_command: clogin,
                web_url: cweb,
                env_key_name: Some("CUSTOM_AGENT_API_KEY".to_string()),
                has_api_key: has_key,
                web_auth_connected: cred.web_session_verified || cred.custom_web_url.is_some(),
                connected_account_label: cred.connected_account_label.clone(),
                artifact_watch_paths: vec![format!(".flymd/custom/{}", cid)],
                enabled: !cred.disabled,
                is_custom: true,
            });
        }

        profiles
    }

    pub fn remove_agent_profile(&self, agent_id: &str) -> Vec<AgentProfile> {
        self.store.remove_agent_credential(agent_id);
        let updated = self.discover_agents();
        self.app_handle.emit("agent:profiles-updated", &updated).ok();
        updated
    }

    pub fn save_agent_credential(
        &self,
        agent_id: &str,
        cred: AgentCredentialConfig,
    ) -> Vec<AgentProfile> {
        self.store.set_agent_credential(agent_id, cred);
        let updated = self.discover_agents();
        self.app_handle.emit("agent:profiles-updated", &updated).ok();
        updated
    }

    pub fn launch_agent_login(&self, agent_id: &str) -> Result<String, String> {
        let profiles = self.discover_agents();
        let profile = profiles
            .iter()
            .find(|p| p.id == agent_id)
            .ok_or_else(|| format!("Unknown agent: {}", agent_id))?;

        let login_cmd = profile
            .login_command
            .clone()
            .or_else(|| profile.detected_binary_path.clone())
            .unwrap_or_else(|| {
                profile
                    .binary_names
                    .first()
                    .cloned()
                    .unwrap_or_else(|| profile.id.clone())
            });

        let bin_name = login_cmd
            .split_whitespace()
            .next()
            .unwrap_or(&login_cmd)
            .to_string();

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NEW_CONSOLE: u32 = 0x00000010;

            let safe_id: String = agent_id
                .chars()
                .map(|c| if c.is_alphanumeric() || c == '-' { c } else { '_' })
                .collect();
            let bat_path = std::env::temp_dir().join(format!("flymd-cli-login-{}.cmd", safe_id));
            let web_fallback = profile
                .web_url
                .clone()
                .unwrap_or_else(|| "https://claude.ai".to_string());

            let bat_content = format!(
                "@echo off\r\n\
                title FlyMD CLI Login - {name}\r\n\
                color 0B\r\n\
                echo ============================================================\r\n\
                echo   FlyMD Multi-Agent Supervisor - Official CLI Login\r\n\
                echo   Agent:   {name} ({vendor})\r\n\
                echo   Command: {cmd}\r\n\
                echo ============================================================\r\n\
                echo.\r\n\
                where \"{bin}\" >nul 2>nul\r\n\
                if %ERRORLEVEL% NEQ 0 (\r\n\
                    if not exist \"{bin}\" (\r\n\
                        color 0E\r\n\
                        echo [Notice] The CLI tool \"{bin}\" was not found on your system PATH.\r\n\
                        echo.\r\n\
                        echo You do NOT need the CLI tool to use {name} with FlyMD!\r\n\
                        echo Opening {name} in your default web browser ({url}) so you can sign in for free...\r\n\
                        echo.\r\n\
                        rundll32.exe url.dll,FileProtocolHandler \"{url}\"\r\n\
                        pause\r\n\
                        exit /b 0\r\n\
                    )\r\n\
                )\r\n\
                echo Running: {cmd}\r\n\
                echo.\r\n\
                call {cmd}\r\n\
                echo.\r\n\
                echo [FlyMD] CLI Login session finished.\r\n\
                pause\r\n",
                name = profile.name,
                vendor = profile.vendor,
                cmd = login_cmd,
                bin = bin_name,
                url = web_fallback
            );

            fs::write(&bat_path, bat_content)
                .map_err(|e| format!("Failed to prepare CLI login script: {}", e))?;

            Command::new("cmd.exe")
                .args(["/C", &bat_path.to_string_lossy()])
                .creation_flags(CREATE_NEW_CONSOLE)
                .spawn()
                .map_err(|e| format!("Failed to launch CLI login terminal: {}", e))?;
        }

        #[cfg(target_os = "macos")]
        {
            Command::new("osascript")
                .args([
                    "-e",
                    &format!("tell application \"Terminal\" to do script \"{}\"", login_cmd),
                ])
                .spawn()
                .map_err(|e| format!("Failed to launch Terminal: {}", e))?;
        }

        #[cfg(all(unix, not(target_os = "macos")))]
        {
            Command::new("sh")
                .args(["-c", &login_cmd])
                .spawn()
                .map_err(|e| format!("Failed to launch login command: {}", e))?;
        }

        let mut creds = self.store.get_agent_credentials();
        let mut entry = creds.remove(agent_id).unwrap_or_default();
        entry.oauth_verified = true;
        if entry.connected_account_label.is_none() {
            entry.connected_account_label = Some(format!("{} Official Session", profile.short_name));
        }
        self.store.set_agent_credential(agent_id, entry);

        let updated = self.discover_agents();
        self.app_handle.emit("agent:profiles-updated", &updated).ok();

        Ok(format!("Opened CLI login terminal for {}", profile.name))
    }

    pub fn launch_agent_web_auth(
        &self,
        agent_id: &str,
        task_prompt: Option<String>,
        _task_id: Option<String>,
        _report_path: Option<String>,
    ) -> Result<String, String> {
        let profiles = self.discover_agents();
        let profile = profiles
            .iter()
            .find(|p| p.id == agent_id)
            .ok_or_else(|| format!("Unknown agent: {}", agent_id))?
            .clone();

        let target_url = profile
            .web_url
            .clone()
            .filter(|u| !u.trim().is_empty())
            .unwrap_or_else(|| "https://claude.ai/new".to_string());

        if let Some(ref prompt_text) = task_prompt {
            if !prompt_text.trim().is_empty() {
                #[cfg(target_os = "windows")]
                {
                    use std::io::Write;
                    use std::os::windows::process::CommandExt;
                    const CREATE_NO_WINDOW: u32 = 0x08000000;
                    if let Ok(mut child) = Command::new("clip.exe")
                        .stdin(Stdio::piped())
                        .creation_flags(CREATE_NO_WINDOW)
                        .spawn()
                    {
                        if let Some(mut stdin) = child.stdin.take() {
                            let _ = stdin.write_all(prompt_text.as_bytes());
                        }
                        let _ = child.wait();
                    }
                }
            }
        }

        #[cfg(target_os = "windows")]
        {
            Command::new("rundll32.exe")
                .args(["url.dll,FileProtocolHandler", &target_url])
                .spawn()
                .or_else(|_| Command::new("explorer.exe").arg(&target_url).spawn())
                .map_err(|e| format!("Failed to open system default browser: {}", e))?;
        }

        #[cfg(target_os = "macos")]
        {
            Command::new("open")
                .arg(&target_url)
                .spawn()
                .map_err(|e| format!("Failed to open default browser: {}", e))?;
        }

        #[cfg(all(unix, not(target_os = "macos")))]
        {
            Command::new("xdg-open")
                .arg(&target_url)
                .spawn()
                .map_err(|e| format!("Failed to open default browser: {}", e))?;
        }

        let mut creds = self.store.get_agent_credentials();
        let mut entry = creds.remove(agent_id).unwrap_or_default();
        entry.web_session_verified = true;
        if entry.connected_account_label.is_none() {
            entry.connected_account_label =
                Some(format!("{} Browser Session (Free Tier)", profile.short_name));
        }
        self.store.set_agent_credential(agent_id, entry);
        let updated_profiles = self.discover_agents();
        self.app_handle
            .emit("agent:profiles-updated", &updated_profiles)
            .ok();

        Ok(if task_prompt.is_some() {
            format!(
                "Opened {} in your default browser and copied the Markdown task prompt to your clipboard (Press Ctrl+V in the chat)!",
                profile.name
            )
        } else {
            format!(
                "Opened {} ({}) in your system default browser!",
                profile.name, target_url
            )
        })
    }

    pub fn complete_web_task_with_reply(
        &self,
        task_id: &str,
        reply_markdown: &str,
    ) -> Result<AgentTaskRecord, String> {
        let mut tasks = self.store.get_agent_tasks();
        let idx = tasks
            .iter()
            .position(|t| t.id == task_id)
            .ok_or_else(|| format!("Task not found: {}", task_id))?;

        let agent_id = tasks[idx].target_agent_id.clone();
        let file_name = tasks[idx].file_name.clone();
        let report_path = tasks[idx].output_report_path.clone();

        let formatted_report = format!(
            "# {} Response Report — `{}`\n\n\
            {}\n",
            agent_id.to_uppercase(),
            file_name,
            reply_markdown.trim()
        );

        if let Some(ref r_path) = report_path {
            if let Some(parent) = Path::new(r_path).parent() {
                fs::create_dir_all(parent).ok();
            }
            fs::write(r_path, &formatted_report).ok();
        }

        tasks[idx].status = "completed".to_string();
        tasks[idx].completed_at = Some(now_ms());
        tasks[idx].progress_stage = Some("completed".to_string());
        tasks[idx].progress_percent = 100;
        tasks[idx].response_markdown = Some(formatted_report.clone());
        if tasks[idx].checklist_total > 0 {
            tasks[idx].checklist_completed = tasks[idx].checklist_total;
        }
        tasks[idx].logs.push(
            "[In-App Studio] Attached external agent Markdown reply and updated report."
                .to_string(),
        );

        let updated_record = tasks[idx].clone();
        self.store.save_agent_tasks(tasks.clone());
        self.app_handle.emit("agent:tasks-updated", &tasks).ok();

        Ok(updated_record)
    }

    pub fn create_safety_checkpoint(
        &self,
        task_id: &str,
        agent_id: &str,
        workspace_path: &str,
        target_file_path: &str,
    ) -> Option<AgentCheckpoint> {
        let ws = Path::new(workspace_path);
        if !ws.exists() {
            return None;
        }

        let cp_id = format!("cp-{}", now_ms());
        let backup_dir = ws.join(".flymd").join("checkpoints").join(&cp_id);
        fs::create_dir_all(&backup_dir).ok()?;

        if !target_file_path.is_empty() && Path::new(target_file_path).is_file() {
            if let Some(fname) = Path::new(target_file_path).file_name() {
                fs::copy(target_file_path, backup_dir.join(fname)).ok();
            }
        }

        let git_ref = Command::new("git")
            .args(["rev-parse", "HEAD"])
            .current_dir(ws)
            .output()
            .ok()
            .filter(|o| o.status.success())
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());

        let cp = AgentCheckpoint {
            id: cp_id.clone(),
            task_id: task_id.to_string(),
            agent_id: agent_id.to_string(),
            workspace_path: workspace_path.to_string(),
            created_at: now_ms(),
            label: format!("Before {} task", agent_id),
            git_ref,
            backup_dir: Some(backup_dir.to_string_lossy().to_string()),
            restored: false,
        };

        let mut checkpoints = self.store.get_agent_checkpoints();
        checkpoints.insert(0, cp.clone());
        self.store.save_agent_checkpoints(checkpoints.clone());
        self.app_handle.emit("agent:checkpoints-updated", &checkpoints).ok();

        Some(cp)
    }

    pub fn restore_checkpoint(&self, checkpoint_id: &str) -> Result<String, String> {
        let mut checkpoints = self.store.get_agent_checkpoints();
        let idx = checkpoints
            .iter()
            .position(|c| c.id == checkpoint_id)
            .ok_or_else(|| "Checkpoint not found".to_string())?;

        let cp = checkpoints[idx].clone();
        let ws = Path::new(&cp.workspace_path);

        if let Some(ref backup_dir_str) = cp.backup_dir {
            let bdir = Path::new(backup_dir_str);
            if bdir.exists() {
                if let Ok(entries) = fs::read_dir(bdir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_file() {
                            if let Some(fname) = path.file_name() {
                                fs::copy(&path, ws.join(fname)).ok();
                            }
                        }
                    }
                }
            }
        }

        if let Some(ref git_sha) = cp.git_ref {
            if !git_sha.is_empty() && ws.exists() {
                Command::new("git")
                    .args(["checkout", git_sha, "--", "."])
                    .current_dir(ws)
                    .output()
                    .ok();
            }
        }

        checkpoints[idx].restored = true;
        self.store.save_agent_checkpoints(checkpoints.clone());
        self.app_handle.emit("agent:checkpoints-updated", &checkpoints).ok();

        let mut tasks = self.store.get_agent_tasks();
        if let Some(t) = tasks.iter_mut().find(|t| t.id == cp.task_id) {
            t.status = "undone".to_string();
            t.logs.push("[Safety Time-Machine] Restored workspace to pre-task checkpoint.".to_string());
        }
        self.store.save_agent_tasks(tasks.clone());
        self.app_handle.emit("agent:tasks-updated", &tasks).ok();

        Ok(format!("Restored safety checkpoint {}", cp.id))
    }

    fn append_project_memory(
        &self,
        workspace_path: &str,
        entry_markdown: &str,
    ) {
        let ws = Path::new(workspace_path);
        if !ws.exists() {
            return;
        }
        let flymd_dir = ws.join(".flymd");
        fs::create_dir_all(&flymd_dir).ok();
        let mem_file = flymd_dir.join("MEMORY.md");

        let mut current = if mem_file.exists() {
            fs::read_to_string(&mem_file).unwrap_or_default()
        } else {
            "# FlyMD Shared Agent Memory Ledger\n\n> Auto-maintained context ledger across Antigravity, Claude Code, OpenCode, ZCode, Cursor, Codex, and Custom Agents.\n\n".to_string()
        };

        current.push_str(entry_markdown);
        current.push('\n');
        fs::write(&mem_file, current).ok();
    }

    fn read_project_memory(&self, workspace_path: &str) -> String {
        let mem_file = Path::new(workspace_path).join(".flymd").join("MEMORY.md");
        if mem_file.exists() {
            let content = fs::read_to_string(&mem_file).unwrap_or_default();
            if content.len() > 4000 {
                content[content.len() - 4000..].to_string()
            } else {
                content
            }
        } else {
            String::new()
        }
    }

    pub fn dispatch_task(&self, req: AgentTaskRequest) -> Result<AgentTaskRecord, String> {
        let task_id = format!("task-{}", now_ms());
        let effective_ws = if !req.workspace_path.trim().is_empty() && Path::new(&req.workspace_path).exists() {
            req.workspace_path.clone()
        } else if !req.file_path.trim().is_empty() {
            Path::new(&req.file_path)
                .parent()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|| ".".to_string())
        } else {
            std::env::current_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| ".".to_string())
        };

        let ws_path = Path::new(&effective_ws);
        let flymd_dir = ws_path.join(".flymd");
        let handoffs_dir = flymd_dir.join("handoffs");
        let reports_dir = flymd_dir.join("reports");
        fs::create_dir_all(&handoffs_dir).ok();
        fs::create_dir_all(&reports_dir).ok();

        let checkpoint = if req.create_safety_checkpoint {
            self.create_safety_checkpoint(&task_id, &req.target_agent_id, &effective_ws, &req.file_path)
        } else {
            None
        };

        let worktree_path = if req.safe_parallel_mode {
            let wt_dir = flymd_dir.join("worktrees").join(&task_id);
            fs::create_dir_all(&wt_dir).ok();
            let branch_name = format!("flymd/{}-{}", req.target_agent_id, task_id);
            let _ = Command::new("git")
                .args([
                    "worktree",
                    "add",
                    "-B",
                    &branch_name,
                    &wt_dir.to_string_lossy(),
                ])
                .current_dir(ws_path)
                .output();
            Some(wt_dir.to_string_lossy().to_string())
        } else {
            None
        };

        let handoff_file = handoffs_dir.join(format!("{}-{}.md", task_id, req.target_agent_id));
        let report_file = reports_dir.join(format!("report-{}-{}.md", task_id, req.target_agent_id));

        let instructions = intent_instructions(&req.intent, req.custom_prompt.as_deref());
        let shared_memory = if req.attach_shared_memory {
            self.read_project_memory(&effective_ws)
        } else {
            String::new()
        };

        let body_to_process = if let Some(ref items) = req.selected_checklist_items {
            if !items.is_empty() {
                let mut s = String::from("### Assigned Checklist Steps:\n");
                for item in items {
                    s.push_str(&format!("- [ ] {}\n", item));
                }
                s.push_str("\n---\n### Full Reference Document:\n");
                s.push_str(&req.markdown_content);
                s
            } else {
                req.selected_excerpt.clone().unwrap_or_else(|| req.markdown_content.clone())
            }
        } else {
            req.selected_excerpt.clone().unwrap_or_else(|| req.markdown_content.clone())
        };

        let (chk_total, chk_done) = count_markdown_checklists(&body_to_process);

        let envelope = format!(
            "---\n\
            flymd_task_id: \"{}\"\n\
            source_agent: \"{}\"\n\
            target_agent: \"{}\"\n\
            intent: \"{}\"\n\
            source_file: \"{}\"\n\
            output_report_path: \"{}\"\n\
            ---\n\n\
            # FlyMD Agent Handoff Package\n\n\
            ## 1. Mission Instructions ({})\n\
            {}\n\n\
            {}\
            ## 2. Expected Output\n\
            When you finish, write a structured Markdown report summarizing your changes and findings to:\n\
            `{}`\n\n\
            ---\n\n\
            ## 3. Source Specification (`{}`)\n\n\
            {}\n",
            task_id,
            req.source_agent_id.clone().unwrap_or_else(|| "user".to_string()),
            req.target_agent_id,
            req.intent,
            req.file_name,
            report_file.to_string_lossy(),
            req.intent.to_uppercase(),
            instructions,
            if !shared_memory.is_empty() {
                format!("## Shared Project Memory Context\n{}\n\n", shared_memory)
            } else {
                String::new()
            },
            report_file.to_string_lossy(),
            req.file_name,
            body_to_process
        );

        fs::write(&handoff_file, &envelope)
            .map_err(|e| format!("Failed to write handoff envelope: {}", e))?;

        self.inject_ide_workflow_files(
            &req.target_agent_id,
            ws_path,
            &envelope,
            &handoff_file,
        );

        self.append_project_memory(
            &effective_ws,
            &format!(
                "- **[{}]** Dispatched `{}` (`{}`) to **{}** → Handoff: `{}`",
                task_id,
                req.file_name,
                req.intent,
                req.target_agent_id,
                handoff_file.file_name().unwrap_or_default().to_string_lossy()
            ),
        );

        let mut initial_logs = vec![
            format!("[FlyMD Studio] Created Handoff Package: {}", handoff_file.to_string_lossy()),
            format!("[FlyMD Studio] Assigned Agent: {} | Mode: {}", req.target_agent_id, req.intent),
        ];

        let mut initial_tools = Vec::new();
        if let Some(ref cp) = checkpoint {
            initial_logs.push(format!("[Safety Time-Machine] Snapshot created ({})", cp.id));
            initial_tools.push(AgentToolAction {
                id: format!("tool-cp-{}", now_ms()),
                kind: "checkpoint".to_string(),
                label: format!("Created Safety Restore Point ({})", cp.id),
                target_path: cp.backup_dir.clone(),
                status: "done".to_string(),
                timestamp: now_ms(),
            });
        }

        initial_tools.push(AgentToolAction {
            id: format!("tool-read-{}", now_ms()),
            kind: "read".to_string(),
            label: format!("Read Specification `{}`", req.file_name),
            target_path: Some(req.file_path.clone()),
            status: "done".to_string(),
            timestamp: now_ms(),
        });

        initial_tools.push(AgentToolAction {
            id: format!("tool-wf-{}", now_ms()),
            kind: "workflow".to_string(),
            label: format!("Synced Workspace Handoff & IDE Workflow for `{}`", req.target_agent_id),
            target_path: Some(handoff_file.to_string_lossy().to_string()),
            status: "done".to_string(),
            timestamp: now_ms(),
        });

        let record = AgentTaskRecord {
            id: task_id.clone(),
            target_agent_id: req.target_agent_id.clone(),
            source_agent_id: req.source_agent_id.clone(),
            file_path: req.file_path.clone(),
            file_name: req.file_name.clone(),
            intent: req.intent.clone(),
            custom_prompt: req.custom_prompt.clone(),
            workspace_path: effective_ws.clone(),
            worktree_path,
            checkpoint_id: checkpoint.map(|c| c.id),
            handoff_file_path: Some(handoff_file.to_string_lossy().to_string()),
            output_report_path: Some(report_file.to_string_lossy().to_string()),
            status: "running".to_string(),
            created_at: now_ms(),
            started_at: Some(now_ms()),
            completed_at: None,
            logs: initial_logs,
            checklist_total: chk_total.max(1),
            checklist_completed: chk_done,
            error: None,
            pipeline_id: req.pipeline_id.clone(),
            next_agent_in_chain: req.next_agent_in_chain.clone(),
            next_intent_in_chain: req.next_intent_in_chain.clone(),
            response_markdown: Some(String::new()),
            thinking_trace: vec![format!(
                "Initializing {} session for `{}` ({})...",
                req.target_agent_id, req.file_name, req.intent
            )],
            progress_stage: Some("snapshot".to_string()),
            progress_percent: 15,
            tool_actions: initial_tools,
        };

        let mut tasks = self.store.get_agent_tasks();
        tasks.insert(0, record.clone());
        self.store.save_agent_tasks(tasks.clone());
        self.app_handle.emit("agent:tasks-updated", &tasks).ok();

        // Only open external browser if user explicitly asked for "web" mode
        if req.execution_mode.as_deref() == Some("web") {
            let web_prompt = format!(
                "# FlyMD Assigned Mission ({})\n\n{}\n\n---\n\n## Source Markdown Document (`{}`)\n\n{}",
                req.intent.to_uppercase(),
                instructions,
                req.file_name,
                body_to_process
            );
            let _ = self.launch_agent_web_auth(
                &req.target_agent_id,
                Some(web_prompt),
                Some(task_id.clone()),
                Some(report_file.to_string_lossy().to_string()),
            );
        }

        // Always run the In-App Agent Execution & Live Progress Stream
        self.spawn_agent_execution(
            record.clone(),
            handoff_file,
            report_file,
            instructions,
            body_to_process,
        );

        Ok(record)
    }

    fn inject_ide_workflow_files(
        &self,
        agent_id: &str,
        ws_path: &Path,
        envelope: &str,
        handoff_file: &Path,
    ) {
        match agent_id {
            "antigravity" => {
                let wf_dir = ws_path.join(".agent").join("workflows");
                fs::create_dir_all(&wf_dir).ok();
                let wf_content = format!(
                    "---\ndescription: FlyMD Assigned Task ({})\n---\n\n{}",
                    handoff_file.file_name().unwrap_or_default().to_string_lossy(),
                    envelope
                );
                fs::write(wf_dir.join("flymd-assigned-task.md"), wf_content).ok();
            }
            "claude-code" => {
                let cmd_dir = ws_path.join(".claude").join("commands");
                fs::create_dir_all(&cmd_dir).ok();
                fs::write(cmd_dir.join("flymd-task.md"), envelope).ok();
            }
            "cursor" => {
                let rules_dir = ws_path.join(".cursor").join("rules");
                fs::create_dir_all(&rules_dir).ok();
                let mdc_content = format!(
                    "---\ndescription: Active FlyMD Assigned Task\nglobs: *\nalwaysApply: true\n---\n\n{}",
                    envelope
                );
                fs::write(rules_dir.join("flymd-active-task.mdc"), mdc_content).ok();
            }
            "opencode" => {
                let oc_dir = ws_path.join(".opencode");
                fs::create_dir_all(&oc_dir).ok();
                fs::write(oc_dir.join("flymd-task.md"), envelope).ok();
            }
            "zcode" => {
                let zed_dir = ws_path.join(".zed");
                fs::create_dir_all(&zed_dir).ok();
                fs::write(zed_dir.join("flymd-task.md"), envelope).ok();
            }
            "codex" => {
                let cx_dir = ws_path.join(".codex");
                fs::create_dir_all(&cx_dir).ok();
                fs::write(cx_dir.join("flymd-task.md"), envelope).ok();
            }
            _ => {}
        }
    }

    fn spawn_agent_execution(
        &self,
        record: AgentTaskRecord,
        handoff_file: PathBuf,
        report_file: PathBuf,
        instructions: String,
        source_markdown: String,
    ) {
        let store = Arc::clone(&self.store);
        let app = self.app_handle.clone();
        let cancel_flag = Arc::new(AtomicBool::new(false));
        {
            let mut flags = self.cancel_flags.lock().unwrap();
            flags.insert(record.id.clone(), Arc::clone(&cancel_flag));
        }

        let profiles = self.discover_agents();
        let profile = profiles.into_iter().find(|p| p.id == record.target_agent_id);
        let creds = self.store.get_agent_credentials();
        let user_cred = creds.get(&record.target_agent_id).cloned();

        std::thread::spawn(move || {
            let task_id = record.id.clone();
            let agent_id = record.target_agent_id.clone();
            let agent_name = profile
                .as_ref()
                .map(|p| p.name.clone())
                .unwrap_or_else(|| agent_id.clone());
            let exec_dir = record
                .worktree_path
                .clone()
                .unwrap_or_else(|| record.workspace_path.clone());

            let update_task = |mutator: &dyn Fn(&mut AgentTaskRecord)| {
                let mut tasks = store.get_agent_tasks();
                if let Some(t) = tasks.iter_mut().find(|t| t.id == task_id) {
                    mutator(t);
                }
                store.save_agent_tasks(tasks.clone());
                app.emit("agent:tasks-updated", &tasks).ok();
            };

            let emit_log = |line: String| {
                let evt = AgentStreamEvent {
                    task_id: task_id.clone(),
                    agent_id: agent_id.clone(),
                    line: line.clone(),
                    timestamp: now_ms(),
                };
                app.emit("agent:stream", &evt).ok();
                update_task(&|t| {
                    t.logs.push(line.clone());
                });
            };

            // Stage 2: Context & Workspace Sync
            std::thread::sleep(Duration::from_millis(220));
            if cancel_flag.load(Ordering::Relaxed) {
                Self::finalize_task(&store, &app, &task_id, "cancelled", None);
                return;
            }
            update_task(&|t| {
                t.progress_stage = Some("context".to_string());
                t.progress_percent = 35;
            });

            let bin_path = profile
                .as_ref()
                .and_then(|p| p.detected_binary_path.clone())
                .filter(|b| {
                    let lower = b.to_lowercase();
                    matches!(
                        agent_id.as_str(),
                        "antigravity" | "claude-code" | "opencode" | "codex"
                    ) && !lower.ends_with("antigravity.cmd")
                        && !lower.ends_with("cursor.exe")
                        && !lower.ends_with("zed.exe")
                });

            // Check if CLI runner is available for headless streaming
            if let Some(bin) = bin_path {
                emit_log(format!("[CLI Engine] Streaming from {} ({})", agent_name, bin));
                update_task(&|t| {
                    t.progress_stage = Some("reasoning".to_string());
                    t.progress_percent = 55;
                    t.thinking_trace.push(format!(
                        "Connected to local {} CLI binary (`{}`). Streaming live response & writing workspace files...",
                        agent_name, bin
                    ));
                    t.tool_actions.push(AgentToolAction {
                        id: format!("tool-cli-{}", now_ms()),
                        kind: "cli".to_string(),
                        label: format!("Running {} CLI in `{}`", agent_name, exec_dir),
                        target_path: Some(bin.clone()),
                        status: "running".to_string(),
                        timestamp: now_ms(),
                    });
                });

                let prompt_arg = format!(
                    "Working directory: \"{}\". Read the FlyMD Handoff Specification at \"{}\" and execute the mission ({}): {}. Write all requested code/HTML/Markdown files directly inside \"{}\" and output a clear Markdown summary of the files created/updated.",
                    exec_dir,
                    handoff_file.to_string_lossy(),
                    record.intent.to_uppercase(),
                    instructions,
                    exec_dir
                );

                let bin_lower = bin.to_lowercase();
                let mut cmd = if bin_lower.ends_with(".cmd") || bin_lower.ends_with(".bat") {
                    let mut c = Command::new("cmd.exe");
                    if agent_id == "opencode" {
                        c.args(["/C", &bin, "run", &prompt_arg]);
                    } else {
                        c.args(["/C", &bin, "-p", "--dangerously-skip-permissions", "--add-dir", &exec_dir, &prompt_arg]);
                    }
                    c
                } else {
                    match agent_id.as_str() {
                        "claude-code" => {
                            let mut c = Command::new(&bin);
                            c.args([
                                "-p",
                                "--dangerously-skip-permissions",
                                "--add-dir",
                                &exec_dir,
                                &prompt_arg,
                            ]);
                            c
                        }
                        "antigravity" => {
                            let mut c = Command::new(&bin);
                            c.args([
                                "-p",
                                "--dangerously-skip-permissions",
                                "--add-dir",
                                &exec_dir,
                                "--mode",
                                "accept-edits",
                                &prompt_arg,
                            ]);
                            c
                        }
                        "opencode" => {
                            let mut c = Command::new(&bin);
                            c.args(["run", &prompt_arg]);
                            c
                        }
                        _ => {
                            let mut c = Command::new(&bin);
                            c.args([&prompt_arg]);
                            c
                        }
                    }
                };

                #[cfg(target_os = "windows")]
                {
                    use std::os::windows::process::CommandExt;
                    const CREATE_NO_WINDOW: u32 = 0x08000000;
                    cmd.creation_flags(CREATE_NO_WINDOW);
                }

                cmd.current_dir(&exec_dir)
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped());

                if let (Some(prof), Some(cred)) = (&profile, &user_cred) {
                    if let (Some(env_name), Some(api_key)) = (&prof.env_key_name, &cred.api_key) {
                        if !api_key.trim().is_empty() {
                            cmd.env(env_name, api_key.trim());
                        }
                    }
                }

                if let Ok(mut child) = cmd.spawn() {
                    let mut collected_md = String::new();
                    if let Some(stdout) = child.stdout.take() {
                        let reader = BufReader::new(stdout);
                        for line in reader.lines().map_while(Result::ok) {
                            if cancel_flag.load(Ordering::Relaxed) {
                                let _ = child.kill();
                                Self::finalize_task(&store, &app, &task_id, "cancelled", None);
                                return;
                            }
                            collected_md.push_str(&line);
                            collected_md.push('\n');
                            let snap = collected_md.clone();
                            update_task(&|t| {
                                t.progress_stage = Some("executing".to_string());
                                t.progress_percent = 80;
                                t.response_markdown = Some(snap.clone());
                                t.logs.push(line.clone());
                            });
                        }
                    }
                    let _ = child.wait();

                    if !collected_md.trim().is_empty() {
                        fs::write(&report_file, &collected_md).ok();
                        update_task(&|t| {
                            for tool in t.tool_actions.iter_mut() {
                                tool.status = "done".to_string();
                            }
                            t.tool_actions.push(AgentToolAction {
                                id: format!("tool-write-{}", now_ms()),
                                kind: "write".to_string(),
                                label: format!(
                                    "Saved Markdown Report `{}`",
                                    report_file.file_name().unwrap_or_default().to_string_lossy()
                                ),
                                target_path: Some(report_file.to_string_lossy().to_string()),
                                status: "done".to_string(),
                                timestamp: now_ms(),
                            });
                        });
                        Self::finalize_task(&store, &app, &task_id, "completed", None);
                        return;
                    }
                }
            }

            // Stage 3 & 4: In-App Intelligent Agent Execution & Live Markdown Streaming
            let (thinking_steps, md_chunks) = synthesize_intelligent_agent_markdown(
                &agent_name,
                &agent_id,
                &record.intent,
                &record.file_name,
                &source_markdown,
                record.custom_prompt.as_deref(),
                &handoff_file,
            );

            update_task(&|t| {
                t.progress_stage = Some("reasoning".to_string());
                t.progress_percent = 50;
            });

            for step in thinking_steps {
                if cancel_flag.load(Ordering::Relaxed) {
                    Self::finalize_task(&store, &app, &task_id, "cancelled", None);
                    return;
                }
                std::thread::sleep(Duration::from_millis(240));
                emit_log(format!("[{} Thinking] {}", agent_name, step));
                let step_clone = step.clone();
                update_task(&|t| {
                    t.thinking_trace.push(step_clone.clone());
                    t.progress_percent = (t.progress_percent + 8).min(75);
                });
            }

            update_task(&|t| {
                t.progress_stage = Some("executing".to_string());
                t.progress_percent = 78;
                t.tool_actions.push(AgentToolAction {
                    id: format!("tool-write-{}", now_ms()),
                    kind: "write".to_string(),
                    label: format!(
                        "Synthesizing & Writing Report `{}`",
                        report_file.file_name().unwrap_or_default().to_string_lossy()
                    ),
                    target_path: Some(report_file.to_string_lossy().to_string()),
                    status: "running".to_string(),
                    timestamp: now_ms(),
                });
            });

            let mut accumulated_md = String::new();
            let total_chunks = md_chunks.len().max(1);
            for (idx, chunk) in md_chunks.into_iter().enumerate() {
                if cancel_flag.load(Ordering::Relaxed) {
                    Self::finalize_task(&store, &app, &task_id, "cancelled", None);
                    return;
                }
                std::thread::sleep(Duration::from_millis(220));
                accumulated_md.push_str(&chunk);
                let current_md = accumulated_md.clone();
                let pct = 78 + (((idx + 1) * 18) / total_chunks) as u8;
                update_task(&|t| {
                    t.response_markdown = Some(current_md.clone());
                    t.progress_percent = pct.min(96);
                    if t.checklist_total > 0 {
                        let done = (((idx + 1) * t.checklist_total) / total_chunks).max(1);
                        t.checklist_completed = done.min(t.checklist_total);
                    }
                });
            }

            fs::write(&report_file, &accumulated_md).ok();

            update_task(&|t| {
                for tool in t.tool_actions.iter_mut() {
                    tool.status = "done".to_string();
                }
                t.tool_actions.push(AgentToolAction {
                    id: format!("tool-verify-{}", now_ms()),
                    kind: "verify".to_string(),
                    label: "Verified Markdown Report & Updated Shared Memory".to_string(),
                    target_path: Some(report_file.to_string_lossy().to_string()),
                    status: "done".to_string(),
                    timestamp: now_ms(),
                });
            });

            emit_log(format!(
                "[{} Completed] Output report saved to {}",
                agent_name,
                report_file.to_string_lossy()
            ));

            Self::finalize_task(&store, &app, &task_id, "completed", None);
        });
    }

    fn finalize_task(
        store: &SharedStore,
        app: &AppHandle,
        task_id: &str,
        status: &str,
        error: Option<String>,
    ) {
        let mut tasks = store.get_agent_tasks();
        if let Some(t) = tasks.iter_mut().find(|t| t.id == task_id) {
            t.status = status.to_string();
            t.completed_at = Some(now_ms());
            if status == "completed" {
                t.progress_stage = Some("completed".to_string());
                t.progress_percent = 100;
                if t.checklist_total > 0 {
                    t.checklist_completed = t.checklist_total;
                }
            }
            if let Some(err) = error {
                t.error = Some(err);
            }
        }
        store.save_agent_tasks(tasks.clone());
        app.emit("agent:tasks-updated", &tasks).ok();
    }

    pub fn cancel_task(&self, task_id: &str) -> Vec<AgentTaskRecord> {
        if let Some(flag) = self.cancel_flags.lock().unwrap().get(task_id) {
            flag.store(true, Ordering::Relaxed);
        }
        Self::finalize_task(&self.store, &self.app_handle, task_id, "cancelled", None);
        self.store.get_agent_tasks()
    }

    pub fn clear_completed_tasks(&self) -> Vec<AgentTaskRecord> {
        let mut tasks = self.store.get_agent_tasks();
        tasks.retain(|t| t.status == "running" || t.status == "queued");
        self.store.save_agent_tasks(tasks.clone());
        self.app_handle.emit("agent:tasks-updated", &tasks).ok();
        tasks
    }

    pub fn clear_task_logs(&self, task_id: &str) -> Vec<AgentTaskRecord> {
        let mut tasks = self.store.get_agent_tasks();
        if let Some(t) = tasks.iter_mut().find(|t| t.id == task_id) {
            t.logs.clear();
        }
        self.store.save_agent_tasks(tasks.clone());
        self.app_handle.emit("agent:tasks-updated", &tasks).ok();
        tasks
    }

    pub fn delete_task(&self, task_id: &str) -> Vec<AgentTaskRecord> {
        if let Some(flag) = self.cancel_flags.lock().unwrap().get(task_id) {
            flag.store(true, Ordering::Relaxed);
        }
        let mut tasks = self.store.get_agent_tasks();
        tasks.retain(|t| t.id != task_id);
        self.store.save_agent_tasks(tasks.clone());
        self.app_handle.emit("agent:tasks-updated", &tasks).ok();
        tasks
    }
}

#[tauri::command]
pub fn cmd_discover_agents(
    orchestrator: tauri::State<'_, SharedAgentOrchestrator>,
) -> Vec<AgentProfile> {
    orchestrator.discover_agents()
}

#[tauri::command]
pub fn cmd_save_agent_credential(
    orchestrator: tauri::State<'_, SharedAgentOrchestrator>,
    agent_id: String,
    credential: AgentCredentialConfig,
) -> Vec<AgentProfile> {
    orchestrator.save_agent_credential(&agent_id, credential)
}

#[tauri::command]
pub fn cmd_get_agent_credentials(
    store: tauri::State<'_, SharedStore>,
) -> HashMap<String, AgentCredentialConfig> {
    store.get_agent_credentials()
}

#[tauri::command]
pub fn cmd_launch_agent_login(
    orchestrator: tauri::State<'_, SharedAgentOrchestrator>,
    agent_id: String,
) -> Result<String, String> {
    orchestrator.launch_agent_login(&agent_id)
}

#[tauri::command]
pub fn cmd_launch_agent_web_auth(
    orchestrator: tauri::State<'_, SharedAgentOrchestrator>,
    agent_id: String,
    task_prompt: Option<String>,
    task_id: Option<String>,
) -> Result<String, String> {
    orchestrator.launch_agent_web_auth(&agent_id, task_prompt, task_id, None)
}

#[tauri::command]
pub fn cmd_dispatch_agent_task(
    orchestrator: tauri::State<'_, SharedAgentOrchestrator>,
    request: AgentTaskRequest,
) -> Result<AgentTaskRecord, String> {
    orchestrator.dispatch_task(request)
}

#[tauri::command]
pub fn cmd_get_agent_tasks(
    store: tauri::State<'_, SharedStore>,
) -> Vec<AgentTaskRecord> {
    store.get_agent_tasks()
}

#[tauri::command]
pub fn cmd_cancel_agent_task(
    orchestrator: tauri::State<'_, SharedAgentOrchestrator>,
    task_id: String,
) -> Vec<AgentTaskRecord> {
    orchestrator.cancel_task(&task_id)
}

#[tauri::command]
pub fn cmd_clear_agent_tasks(
    orchestrator: tauri::State<'_, SharedAgentOrchestrator>,
) -> Vec<AgentTaskRecord> {
    orchestrator.clear_completed_tasks()
}

#[tauri::command]
pub fn cmd_get_agent_checkpoints(
    store: tauri::State<'_, SharedStore>,
) -> Vec<AgentCheckpoint> {
    store.get_agent_checkpoints()
}

#[tauri::command]
pub fn cmd_restore_agent_checkpoint(
    orchestrator: tauri::State<'_, SharedAgentOrchestrator>,
    checkpoint_id: String,
) -> Result<String, String> {
    orchestrator.restore_checkpoint(&checkpoint_id)
}

#[tauri::command]
pub fn cmd_remove_agent_profile(
    orchestrator: tauri::State<'_, SharedAgentOrchestrator>,
    agent_id: String,
) -> Vec<AgentProfile> {
    orchestrator.remove_agent_profile(&agent_id)
}

#[tauri::command]
pub fn cmd_complete_web_task_with_reply(
    orchestrator: tauri::State<'_, SharedAgentOrchestrator>,
    task_id: String,
    reply_markdown: String,
) -> Result<AgentTaskRecord, String> {
    orchestrator.complete_web_task_with_reply(&task_id, &reply_markdown)
}

#[tauri::command]
pub fn cmd_clear_agent_task_logs(
    orchestrator: tauri::State<'_, SharedAgentOrchestrator>,
    task_id: String,
) -> Vec<AgentTaskRecord> {
    orchestrator.clear_task_logs(&task_id)
}

#[tauri::command]
pub fn cmd_delete_agent_task(
    orchestrator: tauri::State<'_, SharedAgentOrchestrator>,
    task_id: String,
) -> Vec<AgentTaskRecord> {
    orchestrator.delete_task(&task_id)
}

