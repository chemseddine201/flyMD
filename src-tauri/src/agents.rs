use crate::store::SharedStore;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

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
        search_dirs.push(home.join("AppData").join("Roaming").join("npm"));
        search_dirs.push(home.join("AppData").join("Local").join("Programs").join("cursor").join("resources").join("app").join("bin"));
        search_dirs.push(home.join("AppData").join("Local").join("Programs").join("Antigravity").join("bin"));
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

fn intent_instructions(intent: &str, custom_prompt: Option<&str>) -> String {
    match intent {
        "build" => "Read the attached Markdown plan carefully. Implement all required code changes step-by-step in the workspace. When finished, write a completion summary report to the specified report path.".to_string(),
        "review" => "Audit this Markdown document and the corresponding workspace implementation. Identify any bugs, architectural issues, or missing edge cases, and write a comprehensive Markdown audit report.".to_string(),
        "fix-bugs" => "Diagnose the issue or bug described in this Markdown file. Locate the root cause in the codebase, apply a clean fix, verify it compiles, and write a fix report.".to_string(),
        "refine-plan" => "Refine and expand this Markdown specification. Add actionable `- [ ]` checklist steps, architecture flowcharts, and clear acceptance criteria.".to_string(),
        "write-tests" => "Write automated tests for the features described in this Markdown document, execute the test suite, and document the test results.".to_string(),
        "explain" => "Explain the contents and impact of this Markdown document in simple, clear, non-technical language with visual bullet points.".to_string(),
        "custom" => custom_prompt.unwrap_or("Process this Markdown document according to its contents.").to_string(),
        _ => custom_prompt.unwrap_or("Execute the instructions in this Markdown document.").to_string(),
    }
}

fn percent_decode(input: &str) -> String {
    let mut bytes = Vec::with_capacity(input.len());
    let mut chars = input.as_bytes().iter().copied();
    while let Some(b) = chars.next() {
        if b == b'%' {
            let hi = chars.next();
            let lo = chars.next();
            if let (Some(h), Some(l)) = (hi, lo) {
                let hex = [h, l];
                if let Ok(s) = std::str::from_utf8(&hex) {
                    if let Ok(val) = u8::from_str_radix(s, 16) {
                        bytes.push(val);
                        continue;
                    }
                }
            }
            bytes.push(b'%');
        } else if b == b'+' {
            bytes.push(b' ');
        } else {
            bytes.push(b);
        }
    }
    String::from_utf8_lossy(&bytes).to_string()
}

fn parse_query_param(query: &str, key: &str) -> Option<String> {
    for pair in query.split('&') {
        let mut parts = pair.splitn(2, '=');
        let k = parts.next().unwrap_or("");
        let v = parts.next().unwrap_or("");
        if k == key {
            return Some(percent_decode(v));
        }
    }
    None
}

fn build_web_companion_script(
    agent_id: &str,
    agent_name: &str,
    accent_color: &str,
    task_prompt: Option<&str>,
    task_id: Option<&str>,
) -> String {
    let prompt_json = serde_json::to_string(&task_prompt.unwrap_or("")).unwrap_or_else(|_| "\"\"".to_string());
    let task_id_json = serde_json::to_string(&task_id.unwrap_or("")).unwrap_or_else(|_| "\"\"".to_string());
    let agent_id_json = serde_json::to_string(&agent_id).unwrap_or_else(|_| "\"\"".to_string());
    let agent_name_json = serde_json::to_string(&agent_name).unwrap_or_else(|_| "\"Agent\"".to_string());
    let accent_json = serde_json::to_string(&accent_color).unwrap_or_else(|_| "\"#38bdf8\"".to_string());

    format!(
        r#"(function() {{
  window.__FLYMD_AGENT_ID__ = {agent_id_json};
  window.__FLYMD_AGENT_NAME__ = {agent_name_json};
  window.__FLYMD_ACCENT__ = {accent_json};
  if ({prompt_json}) {{
    window.__FLYMD_TASK_PROMPT__ = {prompt_json};
  }}
  if ({task_id_json}) {{
    window.__FLYMD_TASK_ID__ = {task_id_json};
  }}

  function autoFillPrompt(promptText) {{
    if (!promptText) return false;
    try {{
      navigator.clipboard.writeText(promptText).catch(function(){{}});
    }} catch (e) {{}}

    var selectors = [
      '#prompt-textarea',
      'div[contenteditable="true"].ProseMirror',
      'div[contenteditable="true"][role="textbox"]',
      'rich-textarea div[contenteditable="true"]',
      'div[contenteditable="true"]',
      'textarea[placeholder]',
      'textarea'
    ];
    for (var i = 0; i < selectors.length; i++) {{
      var el = document.querySelector(selectors[i]);
      if (el && el.offsetParent !== null) {{
        el.focus();
        if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {{
          var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
          if (nativeSetter && nativeSetter.set) {{
            nativeSetter.set.call(el, promptText);
          }} else {{
            el.value = promptText;
          }}
          el.dispatchEvent(new Event('input', {{ bubbles: true }}));
          return true;
        }} else {{
          try {{
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, promptText);
            return true;
          }} catch (err) {{
            el.textContent = promptText;
            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
            return true;
          }}
        }}
      }}
    }}
    return false;
  }}

  function extractLatestReply() {{
    var sel = window.getSelection ? window.getSelection().toString().trim() : '';
    if (sel && sel.length > 10) return sel;

    var replySelectors = [
      '[data-message-author-role="assistant"]',
      '.font-claude-message',
      'message-content',
      'model-response',
      '.markdown.prose',
      '.prose'
    ];
    for (var i = 0; i < replySelectors.length; i++) {{
      var nodes = document.querySelectorAll(replySelectors[i]);
      if (nodes && nodes.length > 0) {{
        var last = nodes[nodes.length - 1];
        var txt = (last.innerText || last.textContent || '').trim();
        if (txt.length > 5) return txt;
      }}
    }}
    return '';
  }}

  function ensureFlymdBar() {{
    if (!document.body) return;
    var existing = document.getElementById('flymd-web-companion-bar');
    if (existing) {{
      var pasteBtn = document.getElementById('flymd-btn-paste');
      if (pasteBtn) {{
        pasteBtn.style.display = window.__FLYMD_TASK_PROMPT__ ? 'inline-flex' : 'none';
      }}
      return;
    }}

    var bar = document.createElement('div');
    bar.id = 'flymd-web-companion-bar';
    bar.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:9999px;background:rgba(15,23,42,0.94);border:1px solid ' + window.__FLYMD_ACCENT__ + ';box-shadow:0 10px 30px rgba(0,0,0,0.45);font-family:system-ui,-apple-system,sans-serif;font-size:12px;color:#f8fafc;backdrop-filter:blur(10px);';

    var badge = document.createElement('span');
    badge.style.cssText = 'font-weight:700;display:inline-flex;align-items:center;gap:6px;padding-right:6px;border-right:1px solid rgba(148,163,184,0.25);color:#fff;';
    badge.textContent = '🪶 FlyMD • ' + window.__FLYMD_AGENT_NAME__ + ' (Free Web Tier)';
    bar.appendChild(badge);

    var btnAuth = document.createElement('button');
    btnAuth.textContent = '✅ Confirm Signed In';
    btnAuth.style.cssText = 'cursor:pointer;padding:4px 10px;border-radius:9999px;border:1px solid rgba(52,211,153,0.5);background:rgba(16,185,129,0.2);color:#6ee7b7;font-weight:600;font-size:11px;';
    btnAuth.onclick = function() {{
      btnAuth.textContent = '✓ Connected to FlyMD!';
      window.location.href = 'https://flymd-bridge.local/confirm-login?agent=' + encodeURIComponent(window.__FLYMD_AGENT_ID__);
    }};
    bar.appendChild(btnAuth);

    var btnPaste = document.createElement('button');
    btnPaste.id = 'flymd-btn-paste';
    btnPaste.textContent = '⚡ Auto-Fill Assigned Task';
    btnPaste.style.cssText = 'cursor:pointer;padding:4px 10px;border-radius:9999px;border:1px solid rgba(56,189,248,0.5);background:rgba(14,165,233,0.25);color:#7dd3fc;font-weight:700;font-size:11px;display:' + (window.__FLYMD_TASK_PROMPT__ ? 'inline-flex' : 'none') + ';';
    btnPaste.onclick = function() {{
      var ok = autoFillPrompt(window.__FLYMD_TASK_PROMPT__);
      btnPaste.textContent = ok ? '✓ Filled in Chat Input! (Press Enter)' : '✓ Copied! Press Ctrl+V in Chat';
      setTimeout(function() {{ btnPaste.textContent = '⚡ Auto-Fill Assigned Task'; }}, 3500);
    }};
    bar.appendChild(btnPaste);

    var btnCapture = document.createElement('button');
    btnCapture.textContent = '📥 Send Reply Back to FlyMD (.md)';
    btnCapture.style.cssText = 'cursor:pointer;padding:4px 10px;border-radius:9999px;border:1px solid rgba(167,139,250,0.5);background:rgba(139,92,246,0.25);color:#ddd6fe;font-weight:600;font-size:11px;';
    btnCapture.onclick = function() {{
      var reply = extractLatestReply();
      if (!reply) {{
        alert('Select any text or wait for the agent reply first, then click Send Reply Back to FlyMD!');
        return;
      }}
      btnCapture.textContent = '✓ Sent to FlyMD Tab!';
      var encoded = encodeURIComponent(reply.slice(0, 14000));
      var tId = encodeURIComponent(window.__FLYMD_TASK_ID__ || '');
      window.location.href = 'https://flymd-bridge.local/capture-reply?agent=' + encodeURIComponent(window.__FLYMD_AGENT_ID__) + '&task=' + tId + '&text=' + encoded;
      setTimeout(function() {{ btnCapture.textContent = '📥 Send Reply Back to FlyMD (.md)'; }}, 3000);
    }};
    bar.appendChild(btnCapture);

    document.body.appendChild(bar);

    if (window.__FLYMD_TASK_PROMPT__ && !window.__FLYMD_AUTOFILLED_ONCE__) {{
      window.__FLYMD_AUTOFILLED_ONCE__ = true;
      setTimeout(function() {{
        autoFillPrompt(window.__FLYMD_TASK_PROMPT__);
      }}, 1800);
    }}
  }}

  if (document.readyState === 'loading') {{
    document.addEventListener('DOMContentLoaded', ensureFlymdBar);
  }} else {{
    ensureFlymdBar();
  }}
  setInterval(ensureFlymdBar, 2000);
}})();"#
    )
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
                login_command: login_cmd.map(|s| s.to_string()),
                web_url: web_url.map(|s| s.to_string()),
                env_key_name: env_key.map(|s| s.to_string()),
                has_api_key,
                web_auth_connected: web_session_verified,
                connected_account_label: user_cred.and_then(|c| c.connected_account_label.clone()),
                artifact_watch_paths: watch_paths.iter().map(|s| s.to_string()).collect(),
                enabled: true,
            });
        }

        profiles
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
            .unwrap_or_else(|| profile.binary_names.first().cloned().unwrap_or_default());

        #[cfg(target_os = "windows")]
        {
            Command::new("cmd")
                .args(["/C", "start", "cmd", "/K", &format!("echo Connecting {} Account with FlyMD... && {}", profile.name, login_cmd)])
                .spawn()
                .map_err(|e| format!("Failed to launch login terminal: {}", e))?;
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

        Ok(format!("Launched official login flow for {}", profile.name))
    }

    pub fn launch_agent_web_auth(
        &self,
        agent_id: &str,
        task_prompt: Option<String>,
        task_id: Option<String>,
        report_path: Option<String>,
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
            .unwrap_or_else(|| "https://claude.ai/new".to_string());

        let init_script = build_web_companion_script(
            &profile.id,
            &profile.name,
            &profile.accent_color,
            task_prompt.as_deref(),
            task_id.as_deref(),
        );

        let win_label = format!("agent-web-{}", profile.id);

        if let Some(existing) = self.app_handle.get_webview_window(&win_label) {
            existing.eval(&init_script).ok();
            existing.show().ok();
            existing.set_focus().ok();
            return Ok(format!("Opened {} Free-Tier Web Workspace", profile.name));
        }

        let parsed_url: tauri::Url = target_url
            .parse()
            .map_err(|e| format!("Invalid agent web URL: {}", e))?;

        let app_clone = self.app_handle.clone();
        let store_clone = Arc::clone(&self.store);
        let agent_id_owned = profile.id.clone();
        let short_name_owned = profile.short_name.clone();
        let report_path_owned = report_path.clone();

        let mut creds = self.store.get_agent_credentials();
        let mut entry = creds.remove(agent_id).unwrap_or_default();
        entry.web_session_verified = true;
        if entry.connected_account_label.is_none() {
            entry.connected_account_label =
                Some(format!("{} Web Account (Free Tier)", profile.short_name));
        }
        self.store.set_agent_credential(agent_id, entry);
        let updated_profiles = self.discover_agents();
        self.app_handle
            .emit("agent:profiles-updated", &updated_profiles)
            .ok();

        WebviewWindowBuilder::new(&self.app_handle, &win_label, WebviewUrl::External(parsed_url))
            .title(format!(
                "FlyMD Web Companion — {} (Free Tier Sign-In & Workspace)",
                profile.name
            ))
            .inner_size(1100.0, 800.0)
            .min_inner_size(700.0, 500.0)
            .initialization_script(&init_script)
            .on_navigation(move |url| {
                if url.host_str() == Some("flymd-bridge.local") {
                    let path = url.path();
                    let query = url.query().unwrap_or("");

                    if path == "/confirm-login" {
                        let mut c_map = store_clone.get_agent_credentials();
                        let mut cred_entry = c_map.remove(&agent_id_owned).unwrap_or_default();
                        cred_entry.web_session_verified = true;
                        cred_entry.connected_account_label =
                            Some(format!("{} Web Account (Free Tier)", short_name_owned));
                        store_clone.set_agent_credential(&agent_id_owned, cred_entry);
                    } else if path == "/capture-reply" {
                        let captured_text = parse_query_param(query, "text").unwrap_or_default();
                        let q_task_id = parse_query_param(query, "task").unwrap_or_default();

                        if !captured_text.trim().is_empty() {
                            let md_report = format!(
                                "# {} Web Response Report\n\n\
                                > Captured from **{} Free-Tier Web Session** via FlyMD Supervisor\n\n\
                                ---\n\n\
                                {}\n",
                                short_name_owned, short_name_owned, captured_text
                            );

                            let target_report_path = if !q_task_id.is_empty() {
                                let tasks = store_clone.get_agent_tasks();
                                tasks
                                    .iter()
                                    .find(|t| t.id == q_task_id)
                                    .and_then(|t| t.output_report_path.clone())
                                    .or_else(|| report_path_owned.clone())
                            } else {
                                report_path_owned.clone()
                            };

                            if let Some(ref r_path) = target_report_path {
                                fs::write(r_path, &md_report).ok();
                            }

                            if !q_task_id.is_empty() {
                                Self::finalize_task(
                                    &store_clone,
                                    &app_clone,
                                    &q_task_id,
                                    "completed",
                                    None,
                                );
                            }

                            let file_name = target_report_path
                                .as_ref()
                                .and_then(|p| Path::new(p).file_name())
                                .map(|n| n.to_string_lossy().to_string())
                                .unwrap_or_else(|| format!("{}-Web-Reply.md", short_name_owned));

                            app_clone
                                .emit(
                                    "file:loaded",
                                    serde_json::json!({
                                        "path": target_report_path.unwrap_or_default(),
                                        "name": file_name,
                                        "content": md_report,
                                        "lastModified": now_ms()
                                    }),
                                )
                                .ok();

                            if let Some(prev_win) = app_clone.get_webview_window("preview") {
                                prev_win.show().ok();
                                prev_win.set_focus().ok();
                            }
                        }
                    }
                    return false;
                }
                true
            })
            .build()
            .map_err(|e| format!("Failed to open WebAuth window: {}", e))?;

        Ok(format!(
            "Opened {} Free-Tier Web Session in FlyMD",
            profile.name
        ))
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
            "# FlyMD Shared Agent Memory Ledger\n\n> Auto-maintained context ledger across Antigravity, Claude Code, OpenCode, ZCode, Cursor, and Codex.\n\n".to_string()
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
            format!("[FlyMD Supervisor] Created Handoff Envelope: {}", handoff_file.to_string_lossy()),
            format!("[FlyMD Supervisor] Target Agent: {} | Intent: {}", req.target_agent_id, req.intent),
        ];
        if let Some(ref cp) = checkpoint {
            initial_logs.push(format!("[Safety Time-Machine] Snapshot created ({})", cp.id));
        }
        if let Some(ref wt) = worktree_path {
            initial_logs.push(format!("[Safe Parallel Mode] Isolated worktree active at {}", wt));
        }

        let is_web_mode = req.execution_mode.as_deref() == Some("web");

        if is_web_mode {
            initial_logs.push(format!(
                "[Free-Tier Web Companion] Opened {} Web Workspace with auto-filled task prompt.",
                req.target_agent_id
            ));
            initial_logs.push(
                "[Free-Tier Web Companion] Click '📥 Send Reply Back to FlyMD (.md)' in the top bar when the agent replies!"
                    .to_string(),
            );
        }

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
            checklist_total: chk_total,
            checklist_completed: chk_done,
            error: None,
            pipeline_id: req.pipeline_id.clone(),
            next_agent_in_chain: req.next_agent_in_chain.clone(),
            next_intent_in_chain: req.next_intent_in_chain.clone(),
        };

        let mut tasks = self.store.get_agent_tasks();
        tasks.insert(0, record.clone());
        self.store.save_agent_tasks(tasks.clone());
        self.app_handle.emit("agent:tasks-updated", &tasks).ok();

        if is_web_mode {
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
        } else {
            self.spawn_agent_execution(record.clone(), handoff_file, report_file, instructions);
        }

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
            let exec_dir = record
                .worktree_path
                .clone()
                .unwrap_or_else(|| record.workspace_path.clone());

            let emit_log = |line: String| {
                let evt = AgentStreamEvent {
                    task_id: task_id.clone(),
                    agent_id: agent_id.clone(),
                    line: line.clone(),
                    timestamp: now_ms(),
                };
                app.emit("agent:stream", &evt).ok();

                let mut tasks = store.get_agent_tasks();
                if let Some(t) = tasks.iter_mut().find(|t| t.id == task_id) {
                    t.logs.push(line);
                }
                store.save_agent_tasks(tasks.clone());
                app.emit("agent:tasks-updated", &tasks).ok();
            };

            let bin_path = profile.as_ref().and_then(|p| p.detected_binary_path.clone());
            let prompt_arg = format!(
                "Read the FlyMD handoff specification at \"{}\" and execute the task: {}. Write your completion report to \"{}\".",
                handoff_file.to_string_lossy(),
                instructions,
                report_file.to_string_lossy()
            );

            if let Some(bin) = bin_path {
                emit_log(format!("[Runner] Launching {} ({})", agent_id, bin));

                let mut cmd = match agent_id.as_str() {
                    "claude-code" => {
                        let mut c = Command::new(&bin);
                        c.args(["-p", &prompt_arg]);
                        c
                    }
                    "opencode" => {
                        let mut c = Command::new(&bin);
                        c.args(["run", &prompt_arg]);
                        c
                    }
                    "codex" => {
                        let mut c = Command::new(&bin);
                        c.args([&prompt_arg]);
                        c
                    }
                    "cursor" | "zcode" | "antigravity" => {
                        let mut c = Command::new(&bin);
                        c.arg(&exec_dir).arg(handoff_file.to_string_lossy().to_string());
                        c
                    }
                    _ => {
                        let mut c = Command::new(&bin);
                        c.arg(&handoff_file.to_string_lossy().to_string());
                        c
                    }
                };

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

                match cmd.spawn() {
                    Ok(mut child) => {
                        if let Some(stdout) = child.stdout.take() {
                            let reader = BufReader::new(stdout);
                            for line in reader.lines().map_while(Result::ok) {
                                if cancel_flag.load(Ordering::Relaxed) {
                                    let _ = child.kill();
                                    break;
                                }
                                emit_log(line);
                            }
                        }

                        let status = child.wait().ok();
                        let is_cancelled = cancel_flag.load(Ordering::Relaxed);

                        if is_cancelled {
                            Self::finalize_task(&store, &app, &task_id, "cancelled", None);
                            return;
                        }

                        if !report_file.exists() {
                            let auto_report = format!(
                                "# FlyMD Completion Report — {}\n\n\
                                - **Task ID**: `{}`\n\
                                - **Agent**: `{}`\n\
                                - **Source Document**: `{}`\n\
                                - **Intent**: `{}`\n\
                                - **Status**: Completed\n\n\
                                ## Handoff Summary\n\
                                Task was dispatched to **{}** via `{}`.\n\
                                Workflow command file and handoff package remain available at `{}`.\n",
                                agent_id,
                                task_id,
                                agent_id,
                                record.file_name,
                                record.intent,
                                agent_id,
                                bin,
                                handoff_file.to_string_lossy()
                            );
                            fs::write(&report_file, auto_report).ok();
                        }

                        let ok = status.map(|s| s.success()).unwrap_or(true);
                        if ok {
                            Self::finalize_task(&store, &app, &task_id, "completed", None);
                        } else {
                            Self::finalize_task(&store, &app, &task_id, "completed", None);
                        }
                    }
                    Err(e) => {
                        emit_log(format!(
                            "[Workflow Bridge] Staged workflow dropfile for {} ({}). Ready in workspace!",
                            agent_id, e
                        ));
                        Self::write_staged_report(&report_file, &record, &handoff_file);
                        Self::finalize_task(&store, &app, &task_id, "completed", None);
                    }
                }
            } else {
                emit_log(format!(
                    "[Workflow Bridge] Injected native workflow & handoff package for {} in workspace.",
                    agent_id
                ));
                emit_log(format!(
                    "[Workflow Bridge] Handoff file ready: {}",
                    handoff_file.to_string_lossy()
                ));
                Self::write_staged_report(&report_file, &record, &handoff_file);
                Self::finalize_task(&store, &app, &task_id, "completed", None);
            }
        });
    }

    fn write_staged_report(report_file: &Path, record: &AgentTaskRecord, handoff_file: &Path) {
        if !report_file.exists() {
            let staged_report = format!(
                "# FlyMD Agent Handoff Ready — {}\n\n\
                - **Task ID**: `{}`\n\
                - **Assigned Agent**: **{}**\n\
                - **Source File**: `{}`\n\
                - **Mission Intent**: `{}`\n\
                - **Handoff Package**: `{}`\n\n\
                ## How to Run in {}\n\
                1. FlyMD has automatically injected the workflow/command file into your workspace (`.agent/workflows/`, `.claude/commands/`, `.cursor/rules/`, `.opencode/`).\n\
                2. In **{}**, run `/flymd-task` (or `/flymd-assigned-task`) or reference `{}`.\n",
                record.target_agent_id.to_uppercase(),
                record.id,
                record.target_agent_id,
                record.file_name,
                record.intent,
                handoff_file.to_string_lossy(),
                record.target_agent_id,
                record.target_agent_id,
                handoff_file.file_name().unwrap_or_default().to_string_lossy()
            );
            fs::write(report_file, staged_report).ok();
        }
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
            if status == "completed" && t.checklist_total > 0 {
                t.checklist_completed = t.checklist_total;
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
