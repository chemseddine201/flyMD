//! Unified Provider Runner: provider trait contract, streaming sink, and deterministic mock adapter for offline testing.

use super::types::{AgentRole, TokenUsage};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

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
    #[error("Authentication failed: {0}")]
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
}
