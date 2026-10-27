//! Unified Provider Runner: provider trait contract, streaming sink, process isolation,
//! Windows process-tree termination, HTTP 429 backoff, and deterministic mock adapter.

use super::types::{AgentRole, TokenUsage};
use async_trait::async_trait;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Debug, Clone)]
pub struct TurnRequest {
    pub session_id: String,
    pub round_number: u32,
    pub agent_id: String,
    pub role: AgentRole,
    pub system_prompt: String,
    pub user_prompt: String,
    pub context_summary: String,
    pub timeout_secs: u64,
    /// Discussion topic and original idea (used by the offline simulator).
    pub topic: String,
    pub user_idea: String,
    /// Optional action/query focus for this turn (used by the offline simulator).
    pub action_name: Option<String>,
    pub action_query: Option<String>,
    pub thinking_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurnResponse {
    pub raw_markdown: String,
    pub usage: TokenUsage,
    pub duration_ms: u64,
    pub model_id: String,
    pub context_truncated: bool,
    /// Reasoning trace separated from the answer, when the provider exposes one.
    pub thinking: Option<String>,
    /// True when the response came from the offline simulator.
    pub simulated: bool,
}

#[derive(Debug, thiserror::Error, Clone)]
pub enum ProviderError {
    #[error("Authentication failed or access denied: {0}")]
    AuthFailure(String),
    #[error("Rate limited (HTTP 429). Retry after {0:?} seconds")]
    RateLimited(Option<u64>),
    #[error("Turn execution timed out after {0} seconds")]
    Timeout(u64),
    #[error("Process crashed with exit code {exit_code:?}: {stderr}")]
    ProcessCrashed {
        exit_code: Option<i32>,
        stderr: String,
    },
    #[error("Context budget exceeded ({tokens} > {cap})")]
    ContextBudgetExceeded { tokens: u32, cap: u32 },
    #[error("Network connection error: {0}")]
    NetworkError(String),
    #[error("Execution was cancelled by user")]
    Cancelled,
}

#[async_trait]
pub trait StreamSink: Send + Sync {
    async fn on_chunk(&self, chunk: &str);
    /// Reasoning / thinking deltas. Default: dropped.
    async fn on_thinking_chunk(&self, _chunk: &str) {}
}

/// Estimates tokens (~3.8 chars/token) when a provider does not report usage.
pub fn estimate_tokens(text: &str) -> u32 {
    ((text.chars().count() as f64) / 3.8).ceil() as u32
}

/// Incremental splitter that separates `<thinking>…</thinking>` / `<think>…</think>`
/// blocks from answer text in a token stream. Tags may be split across chunks.
#[derive(Default)]
pub struct ThoughtSplitter {
    pending: String,
    in_thought: bool,
    pub thinking: String,
    pub answer: String,
}

const OPEN_TAGS: [&str; 2] = ["<thinking>", "<think>"];
const CLOSE_TAGS: [&str; 2] = ["</thinking>", "</think>"];

impl ThoughtSplitter {
    pub fn new() -> Self {
        Self::default()
    }

    /// Feeds a chunk; returns `(thinking_delta, answer_delta)` that are safe to emit now.
    pub fn push(&mut self, chunk: &str) -> (String, String) {
        self.pending.push_str(chunk);
        let mut think_out = String::new();
        let mut answer_out = String::new();

        loop {
            let tags: &[&str] = if self.in_thought { &CLOSE_TAGS } else { &OPEN_TAGS };
            // ASCII-only lowering keeps byte offsets aligned with `pending`.
            let lower = self.pending.to_ascii_lowercase();
            let found = tags
                .iter()
                .filter_map(|t| lower.find(t).map(|i| (i, t.len())))
                .min_by_key(|(i, _)| *i);

            if let Some((idx, len)) = found {
                let before = self.pending[..idx].to_string();
                if self.in_thought {
                    think_out.push_str(&before);
                } else {
                    answer_out.push_str(&before);
                }
                self.pending = self.pending[idx + len..].to_string();
                self.in_thought = !self.in_thought;
                continue;
            }

            // Hold back a possible partial tag at the end of the buffer.
            let max_tag = 12;
            let mut keep_from = self.pending.len();
            if let Some(lt) = self.pending.rfind('<') {
                if self.pending.len() - lt < max_tag {
                    keep_from = lt;
                }
            }
            let emit = self.pending[..keep_from].to_string();
            self.pending = self.pending[keep_from..].to_string();
            if self.in_thought {
                think_out.push_str(&emit);
            } else {
                answer_out.push_str(&emit);
            }
            break;
        }

        self.thinking.push_str(&think_out);
        self.answer.push_str(&answer_out);
        (think_out, answer_out)
    }

    /// Flushes any held-back text. An unterminated thought is kept as thinking.
    pub fn finish(&mut self) -> (String, String) {
        let rest = std::mem::take(&mut self.pending);
        if self.in_thought {
            self.thinking.push_str(&rest);
            (rest, String::new())
        } else {
            self.answer.push_str(&rest);
            (String::new(), rest)
        }
    }

    pub fn thinking_opt(&self) -> Option<String> {
        let t = self.thinking.trim();
        if t.is_empty() {
            None
        } else {
            Some(t.to_string())
        }
    }
}

/// Forwards split thinking/answer deltas to a sink.
async fn emit_split(sink: &Option<Box<dyn StreamSink>>, think: &str, answer: &str) {
    if let Some(s) = sink {
        if !think.is_empty() {
            s.on_thinking_chunk(think).await;
        }
        if !answer.is_empty() {
            s.on_chunk(answer).await;
        }
    }
}

#[async_trait]
pub trait DiscussionProvider: Send + Sync {
    fn provider_id(&self) -> &'static str;
    fn context_window_limit(&self) -> u32;

    async fn execute_turn(
        &self,
        request: TurnRequest,
        cancel_flag: Arc<AtomicBool>,
        stream_sink: Option<Box<dyn StreamSink>>,
    ) -> Result<TurnResponse, ProviderError>;
}

/// Checks text for prohibited paths to prevent unauthorized reading of sensitive files (TC-04).
pub fn check_denylist_violation(text: &str) -> Option<&'static str> {
    let lower = text.to_lowercase();
    let forbidden = [
        ".env",
        "credentials",
        "id_rsa",
        ".git/config",
        ".pem",
        ".key",
    ];
    for pattern in &forbidden {
        if lower.contains(pattern) {
            return Some(pattern);
        }
    }
    None
}

/// Terminates an entire Windows process tree (including grandchild processes like node.exe/python.exe) (TC-10).
pub fn kill_process_tree(pid: u32) {
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .output();
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::process::Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output();
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CliType {
    ClaudeCode,
    AntigravityGemini,
}

/// Production CLI Adapter: invokes external agent CLIs in strict read-only / plan-only sandbox.
pub struct CliProvider {
    pub cli_type: CliType,
    pub executable_path: PathBuf,
    pub sandbox_dir: PathBuf,
    pub context_limit: u32,
}

impl CliProvider {
    pub fn new(cli_type: CliType, executable_path: PathBuf, sandbox_dir: PathBuf) -> Self {
        let context_limit = match cli_type {
            CliType::ClaudeCode => 64000,
            CliType::AntigravityGemini => 128000,
        };
        Self {
            cli_type,
            executable_path,
            sandbox_dir,
            context_limit,
        }
    }

    /// Generates strict read-only command-line flags (TC-03).
    pub fn build_cli_args(&self, prompt: &str) -> Vec<String> {
        match self.cli_type {
            CliType::ClaudeCode => vec![
                "-p".to_string(),
                prompt.to_string(),
                "--tools".to_string(),
                "".to_string(),
            ],
            CliType::AntigravityGemini => vec![
                "-p".to_string(),
                prompt.to_string(),
                "--mode".to_string(),
                "plan".to_string(),
                "--sandbox".to_string(),
            ],
        }
    }
}

#[async_trait]
impl DiscussionProvider for CliProvider {
    fn provider_id(&self) -> &'static str {
        match self.cli_type {
            CliType::ClaudeCode => "claude-code",
            CliType::AntigravityGemini => "gemini-antigravity",
        }
    }

    fn context_window_limit(&self) -> u32 {
        self.context_limit
    }

    async fn execute_turn(
        &self,
        request: TurnRequest,
        cancel_flag: Arc<AtomicBool>,
        stream_sink: Option<Box<dyn StreamSink>>,
    ) -> Result<TurnResponse, ProviderError> {
        if cancel_flag.load(Ordering::Relaxed) {
            return Err(ProviderError::Cancelled);
        }

        // Verify denylist violation
        if let Some(pattern) = check_denylist_violation(&request.user_prompt) {
            return Err(ProviderError::AuthFailure(format!(
                "AccessDenied: Request references prohibited sensitive path pattern '{}'",
                pattern
            )));
        }

        let full_prompt = format!(
            "{}\n\n{}",
            request.system_prompt.trim(),
            request.user_prompt.trim()
        );

        let args = self.build_cli_args(&full_prompt);
        let start = std::time::Instant::now();

        // Ensure sandbox dir exists
        let _ = std::fs::create_dir_all(&self.sandbox_dir);

        let mut cmd = Command::new(&self.executable_path);
        cmd.args(&args)
            .current_dir(&self.sandbox_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        {
            // CREATE_NO_WINDOW flag
            cmd.creation_flags(0x08000000);
        }

        let mut child = cmd.spawn().map_err(|e| ProviderError::ProcessCrashed {
            exit_code: None,
            stderr: format!("Failed to spawn CLI process: {}", e),
        })?;

        let child_pid = child.id();
        let timeout_duration = Duration::from_secs(request.timeout_secs);

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| ProviderError::ProcessCrashed {
                exit_code: None,
                stderr: "Child stdout was None".to_string(),
            })?;

        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        let mut splitter = ThoughtSplitter::new();

        let run_fut = async {
            while let Ok(Some(line)) = lines.next_line().await {
                if cancel_flag.load(Ordering::Relaxed) {
                    if let Some(pid) = child_pid {
                        kill_process_tree(pid);
                    }
                    return Err(ProviderError::Cancelled);
                }

                let (think, answer) = splitter.push(&format!("{}\n", line));
                emit_split(&stream_sink, &think, &answer).await;
            }
            let (think, answer) = splitter.finish();
            emit_split(&stream_sink, &think, &answer).await;

            let status = child
                .wait()
                .await
                .map_err(|e| ProviderError::ProcessCrashed {
                    exit_code: None,
                    stderr: format!("Child wait error: {}", e),
                })?;

            if !status.success() {
                let mut err_msg = String::new();
                if let Some(mut stderr) = child.stderr.take() {
                    let err_reader = BufReader::new(&mut stderr);
                    let mut err_lines = err_reader.lines();
                    while let Ok(Some(el)) = err_lines.next_line().await {
                        err_msg.push_str(&el);
                        err_msg.push('\n');
                    }
                }
                return Err(ProviderError::ProcessCrashed {
                    exit_code: status.code(),
                    stderr: err_msg,
                });
            }

            Ok((splitter.answer.trim().to_string(), splitter.thinking_opt()))
        };

        match tokio::time::timeout(timeout_duration, run_fut).await {
            Ok(Ok((output, thinking))) => {
                let elapsed = start.elapsed().as_millis() as u64;
                let prompt_tokens = estimate_tokens(&full_prompt);
                let completion_tokens = estimate_tokens(&output)
                    + thinking.as_deref().map(estimate_tokens).unwrap_or(0);

                Ok(TurnResponse {
                    raw_markdown: output,
                    usage: TokenUsage {
                        prompt_tokens,
                        completion_tokens,
                        total_tokens: prompt_tokens + completion_tokens,
                    },
                    duration_ms: elapsed,
                    model_id: match self.cli_type {
                        CliType::ClaudeCode => "claude-code-cli".to_string(),
                        CliType::AntigravityGemini => "antigravity-agy-cli".to_string(),
                    },
                    context_truncated: false,
                    thinking,
                    simulated: false,
                })
            }
            Ok(Err(e)) => Err(e),
            Err(_) => {
                if let Some(pid) = child_pid {
                    kill_process_tree(pid);
                }
                Err(ProviderError::Timeout(request.timeout_secs))
            }
        }
    }
}

/// One parsed streaming delta from an HTTP LLM endpoint.
#[derive(Debug, Default, PartialEq)]
pub struct StreamDelta {
    pub content: Option<String>,
    pub reasoning: Option<String>,
    pub prompt_tokens: Option<u32>,
    pub completion_tokens: Option<u32>,
}

/// Parses an OpenAI-compatible SSE line. Supports `reasoning_content` (DeepSeek)
/// and `reasoning` (OpenRouter-style) deltas plus a trailing `usage` object.
pub fn parse_openai_sse_line(line: &str) -> Option<StreamDelta> {
    let payload = line.strip_prefix("data:")?.trim();
    if payload.is_empty() || payload == "[DONE]" {
        return None;
    }
    let v: serde_json::Value = serde_json::from_str(payload).ok()?;
    let delta = v.pointer("/choices/0/delta");
    let get_str = |key: &str| {
        delta
            .and_then(|d| d.get(key))
            .and_then(|x| x.as_str())
            .map(|s| s.to_string())
    };
    let usage = v.get("usage");
    let get_u32 = |key: &str| {
        usage
            .and_then(|u| u.get(key))
            .and_then(|x| x.as_u64())
            .map(|n| n as u32)
    };
    Some(StreamDelta {
        content: get_str("content"),
        reasoning: get_str("reasoning_content").or_else(|| get_str("reasoning")),
        prompt_tokens: get_u32("prompt_tokens"),
        completion_tokens: get_u32("completion_tokens"),
    })
}

/// Parses an Ollama `/api/chat` NDJSON line (`message.thinking` on newer builds,
/// `<think>` tags in `message.content` on older builds are handled by the splitter).
pub fn parse_ollama_line(line: &str) -> Option<StreamDelta> {
    let v: serde_json::Value = serde_json::from_str(line).ok()?;
    if let Some(err) = v.get("error").and_then(|e| e.as_str()) {
        return Some(StreamDelta {
            content: Some(format!("\n\n> Ollama error: {}\n", err)),
            ..Default::default()
        });
    }
    let msg = v.get("message");
    let get_str = |key: &str| {
        msg.and_then(|m| m.get(key))
            .and_then(|x| x.as_str())
            .map(|s| s.to_string())
    };
    let get_u32 = |key: &str| v.get(key).and_then(|x| x.as_u64()).map(|n| n as u32);
    Some(StreamDelta {
        content: get_str("content").or_else(|| {
            v.get("response").and_then(|x| x.as_str()).map(|s| s.to_string())
        }),
        reasoning: get_str("thinking"),
        prompt_tokens: get_u32("prompt_eval_count"),
        completion_tokens: get_u32("eval_count"),
    })
}

/// Production HTTP Adapter: handles OpenAI-compatible completions and Ollama endpoints with HTTP 429 exponential backoff.
pub struct HttpProvider {
    pub provider_name: String,
    pub client: reqwest::Client,
    pub endpoint_url: String,
    pub api_key: Option<String>,
    pub model_name: String,
    pub is_ollama: bool,
    pub max_tokens_limit: u32,
}

impl HttpProvider {
    pub fn new(
        provider_name: &str,
        client: reqwest::Client,
        endpoint_url: &str,
        api_key: Option<String>,
        model_name: &str,
        is_ollama: bool,
    ) -> Self {
        Self {
            provider_name: provider_name.to_string(),
            client,
            endpoint_url: endpoint_url.to_string(),
            api_key,
            model_name: model_name.to_string(),
            is_ollama,
            max_tokens_limit: 32000,
        }
    }
}

#[async_trait]
impl DiscussionProvider for HttpProvider {
    fn provider_id(&self) -> &'static str {
        "http-llm"
    }

    fn context_window_limit(&self) -> u32 {
        self.max_tokens_limit
    }

    async fn execute_turn(
        &self,
        request: TurnRequest,
        cancel_flag: Arc<AtomicBool>,
        stream_sink: Option<Box<dyn StreamSink>>,
    ) -> Result<TurnResponse, ProviderError> {
        if cancel_flag.load(Ordering::Relaxed) {
            return Err(ProviderError::Cancelled);
        }

        // Verify denylist violation
        if let Some(pattern) = check_denylist_violation(&request.user_prompt) {
            return Err(ProviderError::AuthFailure(format!(
                "AccessDenied: Request references prohibited sensitive path pattern '{}'",
                pattern
            )));
        }

        let start = std::time::Instant::now();
        let mut attempts: u32 = 0;
        let max_attempts: u32 = 3;
        let deadline = start + Duration::from_secs(request.timeout_secs.max(10));

        let messages = serde_json::json!([
            { "role": "system", "content": request.system_prompt },
            { "role": "user", "content": request.user_prompt }
        ]);

        let response = loop {
            attempts += 1;
            if cancel_flag.load(Ordering::Relaxed) {
                return Err(ProviderError::Cancelled);
            }

            let req_builder = if self.is_ollama {
                let base = self.endpoint_url.trim_end_matches('/');
                let url = format!("{}/api/chat", base);
                let body = serde_json::json!({
                    "model": self.model_name,
                    "messages": messages,
                    "stream": true,
                    "options": { "temperature": 0.6 }
                });
                self.client.post(&url).json(&body)
            } else {
                let base = self.endpoint_url.trim_end_matches('/');
                let url = if base.ends_with("/chat/completions") {
                    base.to_string()
                } else {
                    format!("{}/chat/completions", base)
                };

                let mut b = self
                    .client
                    .post(&url)
                    .header("Content-Type", "application/json");
                if let Some(ref key) = self.api_key {
                    if !key.trim().is_empty() {
                        b = b.header("Authorization", format!("Bearer {}", key.trim()));
                    }
                }
                let body = serde_json::json!({
                    "model": self.model_name,
                    "messages": messages,
                    "stream": true,
                    "temperature": 0.6
                });
                b.json(&body)
            };

            let resp = req_builder
                .send()
                .await
                .map_err(|e| ProviderError::NetworkError(format!("{} ({})", e, self.endpoint_url)))?;

            if resp.status().as_u16() == 429 {
                let retry_secs = resp
                    .headers()
                    .get("retry-after")
                    .and_then(|h| h.to_str().ok())
                    .and_then(|s| s.parse::<u64>().ok())
                    .unwrap_or(2 * (1 << (attempts - 1)));

                // Bounded retries inside the overall turn time budget.
                let would_exceed =
                    std::time::Instant::now() + Duration::from_secs(retry_secs) >= deadline;
                if attempts >= max_attempts || would_exceed {
                    return Err(ProviderError::RateLimited(Some(retry_secs)));
                }
                tokio::time::sleep(Duration::from_secs(retry_secs)).await;
                continue;
            }

            if !resp.status().is_success() {
                let status_code = resp.status().as_u16();
                let err_text = resp.text().await.unwrap_or_default();
                if status_code == 401 || status_code == 403 {
                    return Err(ProviderError::AuthFailure(err_text));
                }
                return Err(ProviderError::ProcessCrashed {
                    exit_code: Some(status_code as i32),
                    stderr: format!("HTTP {} from {}: {}", status_code, self.endpoint_url, err_text),
                });
            }

            break resp;
        };

        // Stream body: byte-level line buffering so multi-byte UTF-8 split across
        // network chunks is never corrupted.
        let is_ollama = self.is_ollama;
        let mut splitter = ThoughtSplitter::new();
        let mut native_thinking = String::new();
        let mut reported_prompt: Option<u32> = None;
        let mut reported_completion: Option<u32> = None;

        let stream_fut = async {
            let mut stream = response.bytes_stream();
            let mut buffer: Vec<u8> = Vec::new();

            while let Some(chunk_res) = stream.next().await {
                if cancel_flag.load(Ordering::Relaxed) {
                    return Err(ProviderError::Cancelled);
                }
                let bytes = chunk_res.map_err(|e| ProviderError::NetworkError(e.to_string()))?;
                buffer.extend_from_slice(&bytes);

                while let Some(pos) = buffer.iter().position(|b| *b == b'\n') {
                    let line_bytes: Vec<u8> = buffer.drain(..=pos).collect();
                    let line = String::from_utf8_lossy(&line_bytes).trim().to_string();
                    if line.is_empty() {
                        continue;
                    }

                    let parsed = if is_ollama {
                        parse_ollama_line(&line)
                    } else {
                        parse_openai_sse_line(&line)
                    };
                    let Some(delta) = parsed else { continue };

                    if let Some(p) = delta.prompt_tokens {
                        reported_prompt = Some(p);
                    }
                    if let Some(c) = delta.completion_tokens {
                        reported_completion = Some(c);
                    }
                    if let Some(r) = delta.reasoning.filter(|r| !r.is_empty()) {
                        native_thinking.push_str(&r);
                        if let Some(ref sink) = stream_sink {
                            sink.on_thinking_chunk(&r).await;
                        }
                    }
                    if let Some(c) = delta.content.filter(|c| !c.is_empty()) {
                        let (think, answer) = splitter.push(&c);
                        emit_split(&stream_sink, &think, &answer).await;
                    }
                }
            }
            let (think, answer) = splitter.finish();
            emit_split(&stream_sink, &think, &answer).await;
            Ok(())
        };

        let remaining = deadline.saturating_duration_since(std::time::Instant::now());
        match tokio::time::timeout(remaining, stream_fut).await {
            Ok(Ok(())) => {}
            Ok(Err(e)) => return Err(e),
            Err(_) => return Err(ProviderError::Timeout(request.timeout_secs)),
        }

        let answer = splitter.answer.trim().to_string();
        let mut thinking = native_thinking.trim().to_string();
        if let Some(tagged) = splitter.thinking_opt() {
            if !thinking.is_empty() {
                thinking.push_str("\n\n");
            }
            thinking.push_str(&tagged);
        }

        if answer.is_empty() && thinking.is_empty() {
            return Err(ProviderError::ProcessCrashed {
                exit_code: None,
                stderr: format!(
                    "Model '{}' at {} returned an empty response",
                    self.model_name, self.endpoint_url
                ),
            });
        }

        let elapsed = start.elapsed().as_millis() as u64;
        let prompt_tokens = reported_prompt.unwrap_or_else(|| {
            estimate_tokens(&request.system_prompt) + estimate_tokens(&request.user_prompt)
        });
        let completion_tokens = reported_completion
            .unwrap_or_else(|| estimate_tokens(&answer) + estimate_tokens(&thinking));

        Ok(TurnResponse {
            raw_markdown: answer,
            usage: TokenUsage {
                prompt_tokens,
                completion_tokens,
                total_tokens: prompt_tokens + completion_tokens,
            },
            duration_ms: elapsed,
            model_id: self.model_name.clone(),
            context_truncated: false,
            thinking: if thinking.is_empty() { None } else { Some(thinking) },
            simulated: false,
        })
    }
}

/// Deterministic Mock Provider for automated unit/integration tests with zero API cost.
pub struct MockProvider {
    pub provider_name: String,
    pub simulated_latency_ms: u64,
    pub simulate_timeout: bool,
    pub simulate_rate_limit: bool,
}

impl MockProvider {
    pub fn new(name: &str) -> Self {
        Self {
            provider_name: name.to_string(),
            simulated_latency_ms: 10,
            simulate_timeout: false,
            simulate_rate_limit: false,
        }
    }
}

#[async_trait]
impl DiscussionProvider for MockProvider {
    fn provider_id(&self) -> &'static str {
        "mock"
    }

    fn context_window_limit(&self) -> u32 {
        32000
    }

    async fn execute_turn(
        &self,
        request: TurnRequest,
        cancel_flag: Arc<AtomicBool>,
        stream_sink: Option<Box<dyn StreamSink>>,
    ) -> Result<TurnResponse, ProviderError> {
        if cancel_flag.load(Ordering::Relaxed) {
            return Err(ProviderError::Cancelled);
        }

        if let Some(pattern) = check_denylist_violation(&request.user_prompt) {
            return Err(ProviderError::AuthFailure(format!(
                "AccessDenied: Request references prohibited sensitive path pattern '{}'",
                pattern
            )));
        }

        if self.simulate_timeout {
            tokio::time::sleep(Duration::from_millis(50)).await;
            return Err(ProviderError::Timeout(request.timeout_secs));
        }

        if self.simulate_rate_limit {
            return Err(ProviderError::RateLimited(Some(2)));
        }

        let start = std::time::Instant::now();

        let topic_clean = if request.topic.trim().is_empty() {
            "System Architecture & Resilience"
        } else {
            request.topic.trim()
        };
        let idea_clean = if request.user_idea.trim().is_empty() {
            "Core architecture requirements and trade-offs"
        } else {
            request.user_idea.trim()
        };

        let action_focus = if let Some(ref act) = request.action_name {
            format!("Focus Area / Action: {}\n", act)
        } else if let Some(ref q) = request.action_query {
            format!("Special Directive / Query: {}\n", q)
        } else {
            String::new()
        };

        let thinking_body = match &request.role {
            AgentRole::Architect => format!(
                "Deconstructing architectural topology for \"{}\".\n\
                Step 1: Modular boundary invariant analysis for: \"{}\".\n\
                Step 2: State-machine lifecycle design: Created -> Running -> Paused -> AwaitingReview -> Completed.\n\
                Step 3: Verification of contract invariants: schema versioning, discrete recovery checkpoints, and barrier synchronization.\n\
                Step 4: Formulating structural modular architecture proposal.",
                topic_clean, idea_clean
            ),
            AgentRole::Critic => format!(
                "Adversarial stress-analysis of \"{}\".\n\
                Step 1: Threat modeling and assumption questioning regarding: \"{}\".\n\
                Step 2: Identifying single points of failure: unhandled thread panics, unbounded queue buffers, and lock starvation.\n\
                Step 3: Simulating edge-case failures: unexpected process termination, Windows FILE_SHARE lock contention, and cascade drops.\n\
                Step 4: Crafting targeted critiques against peer architectural assumptions.",
                topic_clean, idea_clean
            ),
            AgentRole::Implementer => format!(
                "Systems programming feasibility analysis for \"{}\".\n\
                Step 1: Platform constraints (Windows NT / Rust tokio async runtime) regarding: \"{}\".\n\
                Step 2: Storage I/O atomicity: evaluating MoveFileExW replace semantics vs write-ahead append logging.\n\
                Step 3: Measuring syscall latency: fsync overhead (15ms-40ms) vs in-memory channel ring-buffers.\n\
                Step 4: Formulating low-level crash-safe implementation specification.",
                topic_clean, idea_clean
            ),
            AgentRole::Auditor => format!(
                "Security & isolation audit for \"{}\".\n\
                Step 1: Zero-trust inspection of filesystem access and process elevation for: \"{}\".\n\
                Step 2: Verifying path traversal denylist checks (parent directory escape, sensitive paths).\n\
                Step 3: Secret redaction review: ensuring API keys and bearer tokens are stripped before serialization.\n\
                Step 4: Formulating sandbox policy and isolation invariant report.",
                topic_clean, idea_clean
            ),
            _ => format!(
                "Domain research and synthesis for \"{}\".\n\
                Step 1: Empirical baseline analysis regarding: \"{}\".\n\
                Step 2: Comparing industry patterns and failure case studies.\n\
                Step 3: Invariant validation: ensuring deterministic reproducibility.\n\
                Step 4: Formulating evidence-backed domain conclusions.",
                topic_clean, idea_clean
            ),
        };

        if request.thinking_enabled {
            if let Some(ref sink) = stream_sink {
                let think_chunks: Vec<&str> = thinking_body.split_whitespace().collect();
                for word in think_chunks {
                    if cancel_flag.load(Ordering::Relaxed) {
                        return Err(ProviderError::Cancelled);
                    }
                    tokio::time::sleep(Duration::from_millis(self.simulated_latency_ms.min(4))).await;
                    sink.on_thinking_chunk(&format!("{} ", word)).await;
                }
            }
        }

        let custom_section = if let Some(ref q) = request.action_query {
            format!(
                "\n\n**Special Action Directive ({})**:\n- Investigation findings: Grounded verification confirms {}",
                request.action_name.as_deref().unwrap_or("Directive"),
                q.trim()
            )
        } else {
            String::new()
        };

        let response_body = match request.round_number {
            1 => match &request.role {
                AgentRole::Architect => format!(
                    "### Position Paper by {} (Lead Architect)\n\n\
                    **Domain Analysis for Topic**: *{}*\n\
                    {}\n\
                    #### 1. Architectural Baseline & Decomposition\n\
                    - **Primary Objective**: {}\n\
                    - **Modular Topology**: Strict three-tier separation:\n\
                      1. *Subprocess Isolation Sandbox*: Read-only execution boundary with stripped environment variables.\n\
                      2. *Deterministic Event Reactor*: Unidirectional barrier synchronization preventing arrival-order bias.\n\
                      3. *Persistence Engine*: Dual storage with atomic state snapshots and append-only event logs.\n\
                    - **State Invariants**: Schema versioning (v1) validated before deserialization.\n\n\
                    #### 2. Key Hypotheses & Technical Feasibility\n\
                    - **Concurrency Model**: Asynchronous message passing via bounded `tokio::sync::mpsc` channels with backpressure.\n\
                    - **Contract Boundary**: Explicit JSON-RPC command interfaces between UI and runtime.\n\n\
                    #### 3. Recommended Validation Gates\n\
                    - Formal state transition matrix test suite covering all 8 lifecycle states.\n\
                    - Property-based testing for JSONL partial recovery.{}",
                    request.agent_id, topic_clean, action_focus.trim(), idea_clean, custom_section
                ),
                AgentRole::Critic => format!(
                    "### Position Paper by {} (Critical Adversary)\n\n\
                    **Adversarial Challenge for Topic**: *{}*\n\
                    {}\n\
                    #### 1. Scrutiny of Architectural Assumptions\n\
                    - **Underestimated Failure Modes**: High-level specifications routinely overlook process-level deadlocks during sudden power interruptions or SIGKILL signals.\n\
                    - **Single Point of Failure (SPOF)**: Monolithic session locks cause permanent denial-of-service if a previous instance crashes without releasing its lockfile.\n\
                    - **Buffer Bloat Hazard**: Unbounded streaming chunks risk overflowing memory budgets if downstream UI rendering throttles.\n\n\
                    #### 2. Critical Edge Cases to Stress-Test\n\
                    1. *Dirty Writes*: Interrupted disk writes during concurrent guidance injection.\n\
                    2. *File Watcher Cascade*: Disk persistence triggering recursive file watcher loops if writing into monitored directories.\n\
                    3. *Zombie Subprocesses*: Orphaned CLI adapter processes continuing to consume CPU after user cancellation.\n\n\
                    #### 3. Adversarial Mandate\n\
                    - Demand empirical proof of crash recovery and deterministic process-tree termination before approving design.{}",
                    request.agent_id, topic_clean, action_focus.trim(), custom_section
                ),
                AgentRole::Implementer => format!(
                    "### Position Paper by {} (Core Implementer)\n\n\
                    **Systems Engineering Specification for Topic**: *{}*\n\
                    {}\n\
                    #### 1. Low-Level Platform & Storage Realities\n\
                    - **Primary Objective**: Implement {}\n\
                    - **Storage Atomicity on Windows**: Standard `std::fs::write` is NOT atomic on Windows NTFS. Replacement must use atomic write-to-temp and `MoveFileExW` with `MOVEFILE_REPLACE_EXISTING`.\n\
                    - **Durability Model**: Single-file JSON serialization causes catastrophic truncation on crash. We must implement dual storage:\n\
                      - `transcript.jsonl`: Append-only, line-buffered with trailing partial-line recovery.\n\
                      - `metadata.json`: Atomically rewritten snapshot with schema version validation.\n\n\
                    #### 2. Subprocess Lifecycle & Process-Tree Isolation\n\
                    - Process cleanup on Windows cannot rely on standard `kill()` which only kills the parent wrapper; we must terminate the full process tree via `taskkill /F /T /PID` or Win32 Job Objects.\n\
                    - Memory budgets: Hard cap per turn at 32,000 tokens with pre-deserialization byte-limit bounds.{}",
                    request.agent_id, topic_clean, action_focus.trim(), idea_clean, custom_section
                ),
                AgentRole::Auditor => format!(
                    "### Position Paper by {} (Security Auditor)\n\n\
                    **Zero-Trust Security Audit for Topic**: *{}*\n\
                    {}\n\
                    #### 1. Security Boundaries & Process Isolation\n\
                    - **Read-Only Sandbox**: CLI adapters must strictly execute with `--tools \"\"` and `--mode plan --sandbox` to prevent arbitrary file mutation or remote command execution.\n\
                    - **Path Traversal Barrier**: Reject all input paths containing `..`, symlink escapes, or Windows alternate data streams (`::$DATA`).\n\
                    - **Secret Redaction**: Scrub API keys, Bearer tokens, and sensitive env variables from all logged messages prior to disk commit.\n\n\
                    #### 2. Auditing Requirements\n\
                    - Maintain immutable cryptographic hashes or line-delimited audit log for every turn.{}",
                    request.agent_id, topic_clean, action_focus.trim(), custom_section
                ),
                _ => format!(
                    "### Position Paper by {} ({})\n\n\
                    **Domain Analysis for Topic**: *{}*\n\
                    {}\n\
                    #### 1. Foundational Perspective\n\
                    - **Core Focus**: Domain analysis for {}\n\
                    - **Proposed Approach**: Coordinate role specialization with deterministic barrier synchronization.\n\
                    - **Identified Trade-Off**: Throughput versus strict validation invariants.{}",
                    request.agent_id, request.role.as_str(), topic_clean, action_focus.trim(), idea_clean, custom_section
                ),
            },
            2 => match &request.role {
                AgentRole::Architect => format!(
                    "### Round 2 Cross-Examination by {} (Lead Architect)\n\n\
                    **Critique Target**: *Critic's SPOF & Implementer's Storage Proposals*\n\
                    **Topic Context**: {}\n\n\
                    #### 1. Defense & Refinement of Architectural Invariants\n\
                    - **Lockfile Self-Healing**: Accept Critic's concern regarding stale locks; session locks must incorporate PID-heartbeat validation so dead processes self-release locks on startup.\n\
                    - **Durability Invariant**: Must maintain strict synchronous fsync for all state machine transitions (`Created` -> `Running` -> `Paused`). We cannot compromise on state recovery.\n\
                    - **Active Trade-Off Under Dispute**: Latency penalty of synchronous fsync vs crash-vulnerability of delayed disk flushing.\n\n\
                    #### 2. Peer Critique\n\
                    - The Critic's proposal to eliminate locks entirely is rejected; concurrency without mutual exclusion invites silent transcript corruption.",
                    request.agent_id, topic_clean
                ),
                AgentRole::Critic => format!(
                    "### Round 2 Cross-Examination by {} (Critical Adversary)\n\n\
                    **Critique Target**: *Architect's Synchronous Fsync Stance*\n\
                    **Topic Context**: {}\n\n\
                    #### 1. Scrutiny of Peer Claims\n\
                    - **The Latency Trap**: The Architect demands synchronous fsync on every turn. Benchmarks show fsync stalls the event loop for 15ms-30ms on Windows SSDs, creating massive backpressure.\n\
                    - **Active Dispute**: *Synchronous fsync durability on every turn vs asynchronous append-only buffer throughput*.\n\
                    - **Edge Case Expose**: If Windows crashes during an atomic rename, parent folder metadata is not committed unless the directory itself is flushed. The Architect's model is not crash-proof without directory sync.",
                    request.agent_id, topic_clean
                ),
                AgentRole::Implementer => format!(
                    "### Round 2 Cross-Examination by {} (Core Implementer)\n\n\
                    **Critique Target**: *Bridging the Fsync Latency vs Crash-Safety Divide*\n\
                    **Topic Context**: {}\n\n\
                    #### 1. Concrete Engineering Compromise\n\
                    - **Empirical Measurement**: Testing confirms direct fsync on each turn adds 22ms overhead, degrading deliberation speed.\n\
                    - **Proposed Resolution**: A hybrid storage contract:\n\
                      1. `transcript.jsonl`: Appended asynchronously with OS page-cache buffering. Truncate trailing incomplete line on recovery.\n\
                      2. `metadata.json`: Atomically rewritten with `MoveFileExW` and fsync ONLY at round boundaries and human pause checkpoints.\n\
                    - This provides zero data corruption risk while maintaining near zero-latency streaming throughput.",
                    request.agent_id, topic_clean
                ),
                _ => format!(
                    "### Round 2 Cross-Examination by {} ({})\n\n\
                    **Critique Target**: *Evaluating Peer Proposals*\n\
                    **Topic Context**: {}\n\n\
                    #### 1. Cross-Examination Findings\n\
                    - Concur with atomic persistence requirements.\n\
                    - Active Trade-Off Under Dispute: Synchronous durability guarantees vs async throughput scaling.",
                    request.agent_id, request.role.as_str(), topic_clean
                ),
            },
            _ => match &request.role {
                AgentRole::Architect => format!(
                    "### Round {} Rebuttal & Consensus by {} (Lead Architect)\n\n\
                    **Topic Refinement**: *{}*\n\n\
                    #### 1. Concessions & Final Stance\n\
                    - **Concession**: I concede to the Implementer's hybrid storage compromise: per-turn fsync is unneeded given append-only JSONL partial-line recovery.\n\
                    - **Firm Stance**: Metadata lookups must remain discrete and indexed; cannot compromise on O(1) session resolution.\n\
                    - **Consensus Reached**: Dual storage model with atomic `metadata.json` and append-only `transcript.jsonl`.",
                    request.round_number, request.agent_id, topic_clean
                ),
                AgentRole::Critic => format!(
                    "### Round {} Rebuttal & Consensus by {} (Critical Adversary)\n\n\
                    **Topic Refinement**: *{}*\n\n\
                    #### 1. Concessions & Final Stance\n\
                    - **Concession**: The hybrid persistence model with atomic metadata and append-only transcript resolves the data-loss risk without blocking the event loop.\n\
                    - **Firm Stance**: Strict process-tree termination with job objects must remain a mandatory security requirement.\n\
                    - **Consensus Reached**: System invariants verified for crash safety, zero-trust isolation, and low latency.",
                    request.round_number, request.agent_id, topic_clean
                ),
                AgentRole::Implementer => format!(
                    "### Round {} Rebuttal & Consensus by {} (Core Implementer)\n\n\
                    **Topic Refinement**: *{}*\n\n\
                    #### 1. Implementation Contract Approved\n\
                    - **Agreed Storage Specification**: Dual storage architecture: `metadata.json` (atomic rename swap) + `transcript.jsonl` (line-buffered append).\n\
                    - **Deterministic Barrier**: Snapshot frozen at round start, eliminating arrival-order bias.\n\
                    - **Implementation Verdict**: Design is sound, crash-resilient, and fully validated for Windows Tauri runtime.",
                    request.round_number, request.agent_id, topic_clean
                ),
                _ => format!(
                    "### Round {} Rebuttal & Consensus by {} ({})\n\n\
                    **Topic Refinement**: *{}*\n\n\
                    #### 1. Final Position\n\
                    - Concur with dual storage persistence and deterministic barrier synchronization.",
                    request.round_number, request.agent_id, request.role.as_str(), topic_clean
                ),
            },
        };

        // Stream in chunks
        if let Some(sink) = stream_sink {
            let chunks: Vec<&str> = response_body.split_whitespace().collect();
            for word in chunks {
                if cancel_flag.load(Ordering::Relaxed) {
                    return Err(ProviderError::Cancelled);
                }
                tokio::time::sleep(Duration::from_millis(self.simulated_latency_ms.min(5))).await;
                sink.on_chunk(&format!("{} ", word)).await;
            }
        } else {
            tokio::time::sleep(Duration::from_millis(self.simulated_latency_ms)).await;
        }

        let elapsed = start.elapsed().as_millis() as u64;
        let char_count = response_body.chars().count();
        let tokens = ((char_count as f64) / 3.8).ceil() as u32;

        Ok(TurnResponse {
            raw_markdown: response_body,
            usage: TokenUsage {
                prompt_tokens: 350,
                completion_tokens: tokens,
                total_tokens: 350 + tokens,
            },
            duration_ms: elapsed,
            model_id: "adaptive-domain-simulator".to_string(),
            context_truncated: false,
            thinking: if request.thinking_enabled {
                Some(thinking_body)
            } else {
                None
            },
            simulated: true,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct CollectingSink {
        collected: std::sync::Mutex<String>,
    }

    #[async_trait]
    impl StreamSink for CollectingSink {
        async fn on_chunk(&self, chunk: &str) {
            let mut guard = self.collected.lock().unwrap();
            guard.push_str(chunk);
        }
    }

    #[tokio::test]
    async fn test_mock_provider_streaming_and_cancellation() {
        let provider = MockProvider::new("test-mock");
        let cancel_flag = Arc::new(AtomicBool::new(false));

        let req = TurnRequest {
            session_id: "s-1".to_string(),
            round_number: 1,
            agent_id: "mock-agent-1".to_string(),
            role: AgentRole::Architect,
            system_prompt: "You are an architect.".to_string(),
            user_prompt: "Design the system.".to_string(),
            context_summary: String::new(),
            timeout_secs: 10,
            topic: "Architecture Design".to_string(),
            user_idea: "Build a reliable system".to_string(),
            action_name: None,
            action_query: None,
            thinking_enabled: true,
        };

        let sink = Box::new(CollectingSink {
            collected: std::sync::Mutex::new(String::new()),
        });

        let resp = provider
            .execute_turn(req, cancel_flag.clone(), Some(sink))
            .await
            .unwrap();

        assert!(resp.raw_markdown.contains("Position Paper"));
        assert!(resp.usage.completion_tokens > 0);
        assert!(resp.simulated);
        assert!(resp.thinking.is_some());

        // Test cancellation
        cancel_flag.store(true, Ordering::Relaxed);
        let req2 = TurnRequest {
            session_id: "s-1".to_string(),
            round_number: 2,
            agent_id: "mock-agent-1".to_string(),
            role: AgentRole::Critic,
            system_prompt: "".to_string(),
            user_prompt: "".to_string(),
            context_summary: "".to_string(),
            timeout_secs: 10,
            topic: "Architecture Design".to_string(),
            user_idea: "Build a reliable system".to_string(),
            action_name: None,
            action_query: None,
            thinking_enabled: false,
        };

        let err = provider
            .execute_turn(req2, cancel_flag, None)
            .await
            .unwrap_err();

        assert!(matches!(err, ProviderError::Cancelled));
    }

    #[test]
    fn test_denylist_violation_check() {
        assert_eq!(
            check_denylist_violation("Please inspect .env file for secrets"),
            Some(".env")
        );
        assert_eq!(
            check_denylist_violation("Read id_rsa to test SSH authentication"),
            Some("id_rsa")
        );
        assert_eq!(
            check_denylist_violation("Check AWS credentials here"),
            Some("credentials")
        );
        assert_eq!(
            check_denylist_violation("Clean discussion prompt analyzing architecture"),
            None
        );
    }

    #[test]
    fn test_cli_read_only_flags_generation() {
        let claude_adapter = CliProvider::new(
            CliType::ClaudeCode,
            PathBuf::from("claude.exe"),
            PathBuf::from("sandbox"),
        );
        let claude_args = claude_adapter.build_cli_args("Debate topic");
        assert_eq!(claude_args, vec!["-p", "Debate topic", "--tools", ""]);

        let gemini_adapter = CliProvider::new(
            CliType::AntigravityGemini,
            PathBuf::from("agy.exe"),
            PathBuf::from("sandbox"),
        );
        let gemini_args = gemini_adapter.build_cli_args("Debate topic");
        assert_eq!(
            gemini_args,
            vec!["-p", "Debate topic", "--mode", "plan", "--sandbox"]
        );
    }

    #[test]
    fn test_process_tree_kill_on_dead_pid() {
        // PID 99999999 does not exist, command should safely execute without panicking
        kill_process_tree(99999999);
    }

    #[test]
    fn test_thought_splitter_basic() {
        let mut splitter = ThoughtSplitter::new();
        let (t1, a1) = splitter.push("<thinking>Analyzing ");
        assert_eq!(t1, "Analyzing ");
        assert_eq!(a1, "");

        let (t2, a2) = splitter.push("options</thinking>The solution");
        assert_eq!(t2, "options");
        assert_eq!(a2, "The solution");

        let (t3, a3) = splitter.finish();
        assert_eq!(t3, "");
        assert_eq!(a3, "");

        assert_eq!(splitter.thinking, "Analyzing options");
        assert_eq!(splitter.answer, "The solution");
    }

    #[test]
    fn test_thought_splitter_split_tag() {
        let mut splitter = ThoughtSplitter::new();
        // Tag split across chunks
        let (t1, a1) = splitter.push("Preamble <think");
        assert_eq!(a1, "Preamble ");
        assert_eq!(t1, "");

        let (t2, a2) = splitter.push("ing>My reasoning</thin");
        assert_eq!(t2, "My reasoning");
        assert_eq!(a2, "");

        let (t3, a3) = splitter.push("king>Final text");
        assert_eq!(t3, "");
        assert_eq!(a3, "Final text");

        let _ = splitter.finish();
        assert_eq!(splitter.thinking, "My reasoning");
        assert_eq!(splitter.answer, "Preamble Final text");
    }

    #[test]
    fn test_parse_openai_sse_line() {
        let line = "data: {\"choices\":[{\"delta\":{\"content\":\"hello \",\"reasoning_content\":\"thinking\"}}]}";
        let delta = parse_openai_sse_line(line).unwrap();
        assert_eq!(delta.content.as_deref(), Some("hello "));
        assert_eq!(delta.reasoning.as_deref(), Some("thinking"));
    }

    #[test]
    fn test_parse_ollama_line() {
        let line = "{\"message\":{\"role\":\"assistant\",\"content\":\"hello\",\"thinking\":\"plan\"}}";
        let delta = parse_ollama_line(line).unwrap();
        assert_eq!(delta.content.as_deref(), Some("hello"));
        assert_eq!(delta.reasoning.as_deref(), Some("plan"));
    }
}
