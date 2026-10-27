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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurnResponse {
    pub raw_markdown: String,
    pub usage: TokenUsage,
    pub duration_ms: u64,
    pub model_id: String,
    pub context_truncated: bool,
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
        let mut full_output = String::new();

        let run_fut = async {
            while let Ok(Some(line)) = lines.next_line().await {
                if cancel_flag.load(Ordering::Relaxed) {
                    if let Some(pid) = child_pid {
                        kill_process_tree(pid);
                    }
                    return Err(ProviderError::Cancelled);
                }

                if let Some(ref sink) = stream_sink {
                    sink.on_chunk(&format!("{}\n", line)).await;
                }
                full_output.push_str(&line);
                full_output.push('\n');
            }

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

            Ok(full_output)
        };

        match tokio::time::timeout(timeout_duration, run_fut).await {
            Ok(Ok(output)) => {
                let elapsed = start.elapsed().as_millis() as u64;
                let char_count = output.chars().count();
                let completion_tokens = ((char_count as f64) / 3.8).ceil() as u32;

                Ok(TurnResponse {
                    raw_markdown: output,
                    usage: TokenUsage {
                        prompt_tokens: ((full_prompt.chars().count() as f64) / 3.8).ceil() as u32,
                        completion_tokens,
                        total_tokens: (((full_prompt.chars().count() + char_count) as f64) / 3.8)
                            .ceil() as u32,
                    },
                    duration_ms: elapsed,
                    model_id: format!("{:?}", self.cli_type),
                    context_truncated: false,
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
        let mut attempts = 0;
        let max_attempts = 3;

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
                    "messages": [
                        { "role": "system", "content": request.system_prompt },
                        { "role": "user", "content": request.user_prompt }
                    ],
                    "stream": true,
                    "options": { "temperature": 0.3 }
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
                    b = b.header("Authorization", format!("Bearer {}", key.trim()));
                }
                let body = serde_json::json!({
                    "model": self.model_name,
                    "messages": [
                        { "role": "system", "content": request.system_prompt },
                        { "role": "user", "content": request.user_prompt }
                    ],
                    "stream": true,
                    "temperature": 0.3
                });
                b.json(&body)
            };

            let resp = req_builder
                .send()
                .await
                .map_err(|e| ProviderError::NetworkError(e.to_string()))?;

            if resp.status().as_u16() == 429 {
                if attempts >= max_attempts {
                    return Err(ProviderError::RateLimited(Some(2)));
                }

                // Parse Retry-After header if provided
                let retry_secs = resp
                    .headers()
                    .get("retry-after")
                    .and_then(|h| h.to_str().ok())
                    .and_then(|s| s.parse::<u64>().ok())
                    .unwrap_or(2 * (1 << (attempts - 1)));

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
                    stderr: err_text,
                });
            }

            break resp;
        };

        // Stream body
        let mut stream = response.bytes_stream();
        let mut full_output = String::new();
        let mut buffer = String::new();

        while let Some(chunk_res) = stream.next().await {
            if cancel_flag.load(Ordering::Relaxed) {
                return Err(ProviderError::Cancelled);
            }

            let bytes = chunk_res.map_err(|e| ProviderError::NetworkError(e.to_string()))?;
            buffer.push_str(&String::from_utf8_lossy(&bytes));

            while let Some(pos) = buffer.find('\n') {
                let line = buffer[..pos].trim().to_string();
                buffer = buffer[pos + 1..].to_string();

                if line.is_empty() {
                    continue;
                }

                let text_delta = if self.is_ollama {
                    #[derive(Deserialize)]
                    struct OllamaMsg {
                        content: Option<String>,
                    }
                    #[derive(Deserialize)]
                    struct OllamaChunk {
                        message: Option<OllamaMsg>,
                        response: Option<String>,
                    }
                    if let Ok(c) = serde_json::from_str::<OllamaChunk>(&line) {
                        c.message.and_then(|m| m.content).or(c.response)
                    } else {
                        None
                    }
                } else if line.starts_with("data: ") {
                    let payload = &line[6..].trim();
                    if *payload == "[DONE]" {
                        None
                    } else {
                        #[derive(Deserialize)]
                        struct Delta {
                            content: Option<String>,
                        }
                        #[derive(Deserialize)]
                        struct Choice {
                            delta: Option<Delta>,
                        }
                        #[derive(Deserialize)]
                        struct OpenAiChunk {
                            choices: Vec<Choice>,
                        }
                        serde_json::from_str::<OpenAiChunk>(payload)
                            .ok()
                            .and_then(|c| c.choices.into_iter().next())
                            .and_then(|ch| ch.delta)
                            .and_then(|d| d.content)
                    }
                } else {
                    None
                };

                if let Some(delta) = text_delta {
                    if !delta.is_empty() {
                        if let Some(ref sink) = stream_sink {
                            sink.on_chunk(&delta).await;
                        }
                        full_output.push_str(&delta);
                    }
                }
            }
        }

        let elapsed = start.elapsed().as_millis() as u64;
        let char_count = full_output.chars().count();
        let tokens = ((char_count as f64) / 3.8).ceil() as u32;

        Ok(TurnResponse {
            raw_markdown: full_output,
            usage: TokenUsage {
                prompt_tokens: 300,
                completion_tokens: tokens,
                total_tokens: 300 + tokens,
            },
            duration_ms: elapsed,
            model_id: self.model_name.clone(),
            context_truncated: false,
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

        let response_body = match request.round_number {
            1 => match request.role {
                AgentRole::Architect => format!(
                    "### Position Paper by {} (Architect)\n\n\
                    **Proposed Architecture**: Modular state machine with atomic persistence.\n\
                    - Requirement Decomposition: Split into storage, memory, and orchestration layers.\n\
                    - Baseline Assumptions: Local SQLite or JSONL is sufficient for single-user desktop performance.\n\
                    - Technical Risk: Concurrency locks must be guarded against zombie process crashes.",
                    request.agent_id
                ),
                AgentRole::Critic => format!(
                    "### Position Paper by {} (Critic)\n\n\
                    **Initial Critique of Requirements**: High-level specifications underestimate concurrency conflicts.\n\
                    - Identified Risk: Background watchers can recursively trigger if files are written into watched directories.\n\
                    - Alternative Consideration: In-memory queues with batched flushing.",
                    request.agent_id
                ),
                _ => format!(
                    "### Position Paper by {} ({})\n\n\
                    **Implementation Proposal**: Idiomatic Rust backend with async streams and strict type contracts.\n\
                    - Recommendation: Strong validation on schema versions before deserialization.",
                    request.agent_id, request.role.as_str()
                ),
            },
            2 => format!(
                "### Round 2 Cross-Examination by {} ({})\n\n\
                **Critique of Peer Proposals**:\n\
                1. I agree with the proposal for atomic persistence to prevent corruption.\n\
                2. However, I strongly disagree with in-memory-only queues; persistence must be append-only.\n\
                3. **Active Trade-Off Under Dispute**: Single-file JSON vs Append-only JSONL for session recovery.",
                request.agent_id, request.role.as_str()
            ),
            _ => format!(
                "### Round {} Rebuttal & Revised Position by {} ({})\n\n\
                **Concessions & Firm Stances**:\n\
                - Concession: I concede that JSONL append-only logging is superior for crash resilience.\n\
                - Firm Stance: I maintain that metadata must remain a discrete JSON document for fast startup lookups.\n\
                - **Consensus Reached**: Dual storage model with atomic metadata.json and append-only transcript.jsonl.",
                request.round_number, request.agent_id, request.role.as_str()
            ),
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
            model_id: "mock-model-v1".to_string(),
            context_truncated: false,
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
}
