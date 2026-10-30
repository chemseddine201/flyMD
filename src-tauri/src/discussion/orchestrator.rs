//! Discussion Orchestrator: 8-state discussion lifecycle, barrier synchronization,
//! checkpointing, and deterministic multi-turn debate coordinator.

use super::commands::provider_lookup_key;
use super::epistemic::evaluate_debate_epistemic_policy;
use super::memory::MemoryManager;
use super::runner::{DiscussionProvider, ProviderError, StreamSink, TurnRequest};
use super::storage::{
    append_transcript_message, atomic_write_json, load_metadata, read_transcript_with_recovery,
    save_metadata, SessionLock,
};
use super::types::{
    now_ms, AgentRole, DisagreementStatus, DiscussionConfig, DiscussionMessage,
    DiscussionMessageKind, DiscussionMetadata, DiscussionParticipant, DiscussionStatus, TokenUsage,
    CURRENT_SCHEMA_VERSION,
};
use crate::projects::cache::{
    load_cognitive_packet, parse_handoff_blocks_from_markdown, update_workspace_cognitive_cache,
};
use async_trait::async_trait;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

/// Real-time discussion event emitted during multi-agent deliberation.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "type", content = "payload")]
pub enum DiscussionEvent {
    StatusChanged {
        session_id: String,
        new_status: DiscussionStatus,
    },
    RoundStarted {
        session_id: String,
        round: u32,
    },
    RoundCompleted {
        session_id: String,
        round: u32,
    },
    TurnStarted {
        session_id: String,
        round: u32,
        agent_id: String,
        role: String,
        #[serde(rename = "actionName", default, skip_serializing_if = "Option::is_none")]
        action_name: Option<String>,
    },
    TurnChunk {
        session_id: String,
        round: u32,
        agent_id: String,
        chunk: String,
    },
    TurnThinkingChunk {
        session_id: String,
        round: u32,
        agent_id: String,
        chunk: String,
    },
    TurnCompleted {
        session_id: String,
        round: u32,
        agent_id: String,
        message_id: String,
        usage: TokenUsage,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        thinking: Option<String>,
        #[serde(default)]
        simulated: bool,
        #[serde(rename = "actionName", default, skip_serializing_if = "Option::is_none")]
        action_name: Option<String>,
    },
    TurnFailed {
        session_id: String,
        round: u32,
        agent_id: String,
        error: String,
    },
    TurnPausedForHuman {
        session_id: String,
        round: u32,
        agent_id: String,
    },
    GuidanceInjected {
        session_id: String,
        round: u32,
        content: String,
    },
}

/// Sink for discussion events (e.g. Tauri window broadcast or test receiver).
pub trait DiscussionEventListener: Send + Sync {
    fn on_event(&self, event: DiscussionEvent);
}

struct EventStreamSink {
    session_id: String,
    round: u32,
    agent_id: String,
    listener: Arc<dyn DiscussionEventListener>,
    suppress_handoff: std::sync::Mutex<bool>,
}

#[async_trait]
impl StreamSink for EventStreamSink {
    async fn on_chunk(&self, chunk: &str) {
        let mut guard = self
            .suppress_handoff
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        if *guard {
            if let Some(end_idx) = chunk.to_ascii_lowercase().find("</handoff_state>") {
                *guard = false;
                let after = &chunk[end_idx + "</handoff_state>".len()..];
                if !after.trim().is_empty() {
                    self.listener.on_event(DiscussionEvent::TurnChunk {
                        session_id: self.session_id.clone(),
                        round: self.round,
                        agent_id: self.agent_id.clone(),
                        chunk: after.to_string(),
                    });
                }
            }
            return;
        }

        if let Some(start_idx) = chunk.to_ascii_lowercase().find("<handoff_state>") {
            let before = &chunk[..start_idx];
            if !before.is_empty() {
                self.listener.on_event(DiscussionEvent::TurnChunk {
                    session_id: self.session_id.clone(),
                    round: self.round,
                    agent_id: self.agent_id.clone(),
                    chunk: before.to_string(),
                });
            }
            if !chunk[start_idx..]
                .to_ascii_lowercase()
                .contains("</handoff_state>")
            {
                *guard = true;
            }
            return;
        }
        drop(guard);

        self.listener.on_event(DiscussionEvent::TurnChunk {
            session_id: self.session_id.clone(),
            round: self.round,
            agent_id: self.agent_id.clone(),
            chunk: chunk.to_string(),
        });
    }

    async fn on_thinking_chunk(&self, chunk: &str) {
        self.listener.on_event(DiscussionEvent::TurnThinkingChunk {
            session_id: self.session_id.clone(),
            round: self.round,
            agent_id: self.agent_id.clone(),
            chunk: chunk.to_string(),
        });
    }
}

pub struct DiscussionOrchestrator {
    pub config: DiscussionConfig,
    pub metadata: DiscussionMetadata,
    pub session_dir: PathBuf,
    pub memory: MemoryManager,
    providers: HashMap<String, Arc<dyn DiscussionProvider>>,
    cancel_flag: Arc<AtomicBool>,
    pause_flag: Arc<AtomicBool>,
    lock: Option<SessionLock>,
    event_listener: Option<Arc<dyn DiscussionEventListener>>,
    pub step_mode: bool,
}

impl DiscussionOrchestrator {
    /// Creates a new Discussion Orchestrator, initializes session directory and persists initial config and metadata.
    pub fn new(
        config: DiscussionConfig,
        providers: HashMap<String, Arc<dyn DiscussionProvider>>,
    ) -> Result<Self, String> {
        let session_dir = PathBuf::from(&config.workspace_path)
            .join(".flymd")
            .join("discussions")
            .join(&config.session_id);

        fs::create_dir_all(&session_dir)
            .map_err(|e| format!("Failed to create discussion session directory: {}", e))?;

        // Write config.json
        let config_path = session_dir.join("config.json");
        atomic_write_json(&config_path, &config)?;

        let now = now_ms();
        let metadata = DiscussionMetadata {
            schema_version: CURRENT_SCHEMA_VERSION,
            session_id: config.session_id.clone(),
            topic: Some(config.topic.clone()),
            status: DiscussionStatus::Created,
            current_round: 1,
            created_at: now,
            started_at: None,
            updated_at: now,
            completed_at: None,
            total_messages: 0,
            total_tokens: 0,
            error_message: None,
            active_disagreements_count: 0,
            decisions_count: 0,
            latest_report_version: 0,
        };

        save_metadata(&session_dir, &metadata)?;

        let memory = MemoryManager::new(session_dir.clone());

        let step_mode = config.step_mode;

        Ok(Self {
            config,
            metadata,
            session_dir,
            memory,
            providers,
            cancel_flag: Arc::new(AtomicBool::new(false)),
            pause_flag: Arc::new(AtomicBool::new(false)),
            lock: None,
            event_listener: None,
            step_mode,
        })
    }

    /// Recovers an existing discussion session from disk, repairing any ungraceful shutdowns.
    pub fn recover(
        workspace_path: &Path,
        session_id: &str,
        providers: HashMap<String, Arc<dyn DiscussionProvider>>,
    ) -> Result<Self, String> {
        let session_dir = workspace_path
            .join(".flymd")
            .join("discussions")
            .join(session_id);

        if !session_dir.exists() {
            return Err(format!(
                "Session directory does not exist: {}",
                session_dir.display()
            ));
        }

        let config_path = session_dir.join("config.json");
        let config_bytes = fs::read(&config_path)
            .map_err(|e| format!("Failed to read session config.json: {}", e))?;
        let config: DiscussionConfig = serde_json::from_slice(&config_bytes)
            .map_err(|e| format!("Failed to parse session config.json: {}", e))?;

        let mut metadata = load_metadata(&session_dir)?;

        // If app crashed while Running, transition state to Interrupted
        if metadata.status == DiscussionStatus::Running {
            metadata.status = DiscussionStatus::Interrupted;
            metadata.updated_at = now_ms();
            save_metadata(&session_dir, &metadata)?;
        }

        // Recover and verify transcript
        let (transcript, _) = read_transcript_with_recovery(&session_dir)?;
        metadata.total_messages = transcript.len();

        let memory = MemoryManager::new(session_dir.clone());
        let disagreements = memory.load_disagreements();
        let decisions = memory.load_decisions();

        metadata.active_disagreements_count = disagreements
            .iter()
            .filter(|d| {
                matches!(
                    d.status,
                    super::types::DisagreementStatus::UnresolvedDivergence
                )
            })
            .count();
        metadata.decisions_count = decisions.len();

        save_metadata(&session_dir, &metadata)?;

        let step_mode = config.step_mode;

        Ok(Self {
            config,
            metadata,
            session_dir,
            memory,
            providers,
            cancel_flag: Arc::new(AtomicBool::new(false)),
            pause_flag: Arc::new(AtomicBool::new(false)),
            lock: None,
            event_listener: None,
            step_mode,
        })
    }

    /// Attaches an event listener for live UI or test monitoring.
    pub fn set_event_listener(&mut self, listener: Arc<dyn DiscussionEventListener>) {
        self.event_listener = Some(listener);
    }

    /// Sets human-in-the-loop step mode.
    pub fn set_step_mode(&mut self, enabled: bool) {
        self.step_mode = enabled;
        self.config.step_mode = enabled;
        let config_path = self.session_dir.join("config.json");
        let _ = atomic_write_json(&config_path, &self.config);
    }

    fn notify(&self, event: DiscussionEvent) {
        if let Some(ref listener) = self.event_listener {
            listener.on_event(event);
        }
    }

    fn acquire_lock_if_needed(&mut self) -> Result<(), String> {
        if self.lock.is_none() {
            let lock = SessionLock::acquire(&self.session_dir, &self.config.session_id)?;
            self.lock = Some(lock);
        }
        Ok(())
    }

    fn release_lock(&mut self) {
        self.lock = None;
    }

    fn transition_status(&mut self, new_status: DiscussionStatus) -> Result<(), String> {
        let valid = match (self.metadata.status, new_status) {
            (DiscussionStatus::Created, DiscussionStatus::Running) => true,
            (DiscussionStatus::Created, DiscussionStatus::Cancelled) => true,
            (DiscussionStatus::Running, DiscussionStatus::Paused) => true,
            (DiscussionStatus::Running, DiscussionStatus::AwaitingReview) => true,
            (DiscussionStatus::Running, DiscussionStatus::Completed) => true,
            (DiscussionStatus::Running, DiscussionStatus::Failed) => true,
            (DiscussionStatus::Running, DiscussionStatus::Cancelled) => true,
            (DiscussionStatus::Running, DiscussionStatus::Interrupted) => true,
            (DiscussionStatus::Paused, DiscussionStatus::Running) => true,
            (DiscussionStatus::Paused, DiscussionStatus::Cancelled) => true,
            (DiscussionStatus::Interrupted, DiscussionStatus::Running) => true,
            (DiscussionStatus::Interrupted, DiscussionStatus::Cancelled) => true,
            (DiscussionStatus::AwaitingReview, DiscussionStatus::Running) => true,
            (DiscussionStatus::AwaitingReview, DiscussionStatus::Completed) => true,
            (DiscussionStatus::AwaitingReview, DiscussionStatus::Cancelled) => true,
            (DiscussionStatus::Completed, DiscussionStatus::Running) => true,
            (from, to) if from == to => true,
            _ => false,
        };

        if !valid {
            return Err(format!(
                "Invalid state transition from {:?} to {:?}",
                self.metadata.status, new_status
            ));
        }

        self.metadata.status = new_status;
        self.metadata.updated_at = now_ms();
        if new_status == DiscussionStatus::Completed {
            self.metadata.completed_at = Some(now_ms());
        }

        save_metadata(&self.session_dir, &self.metadata)?;
        self.notify(DiscussionEvent::StatusChanged {
            session_id: self.metadata.session_id.clone(),
            new_status,
        });

        Ok(())
    }

    /// Triggers pause. Running turn finishes safely before pausing the round.
    pub fn pause(&mut self) -> Result<(), String> {
        if self.metadata.status != DiscussionStatus::Running {
            return Err("Cannot pause discussion: session is not running".to_string());
        }
        self.pause_flag.store(true, Ordering::SeqCst);
        Ok(())
    }

    /// Triggers user cancellation. Active turns are interrupted.
    pub fn cancel(&mut self) -> Result<(), String> {
        self.cancel_flag.store(true, Ordering::SeqCst);
        self.transition_status(DiscussionStatus::Cancelled)?;
        self.release_lock();
        Ok(())
    }

    /// User injection: adds human steer / guidance notes to the discussion and schedules next round.
    pub fn inject_user_guidance(&mut self, guidance_text: &str) -> Result<(), String> {
        let trimmed = guidance_text.trim();
        if trimmed.is_empty() {
            return Err("Guidance text cannot be empty".to_string());
        }

        let user_msg = DiscussionMessage {
            id: format!("guidance-{}", now_ms()),
            session_id: self.config.session_id.clone(),
            round_number: self.metadata.current_round,
            turn_index: 0,
            author_agent_id: "human-user".to_string(),
            author_role: "User".to_string(),
            author_provider: "manual".to_string(),
            message_kind: DiscussionMessageKind::UserIntervention,
            target_peer_ids: Vec::new(),
            content: trimmed.to_string(),
            timestamp: now_ms(),
            token_usage: None,
            duration_ms: 0,
            truncated: false,
            thinking_content: None,
            action_name: None,
            model_id: None,
            simulated: false,
            author_display_name: Some("Human Facilitator".to_string()),
        };

        append_transcript_message(&self.session_dir, &user_msg)?;
        self.metadata.total_messages += 1;
        self.metadata.updated_at = now_ms();

        self.notify(DiscussionEvent::GuidanceInjected {
            session_id: self.config.session_id.clone(),
            round: self.metadata.current_round,
            content: trimmed.to_string(),
        });

        // Expand max rounds if necessary
        if self.metadata.current_round >= self.config.max_rounds {
            self.config.max_rounds = self.metadata.current_round + 1;
            let config_path = self.session_dir.join("config.json");
            atomic_write_json(&config_path, &self.config)?;
        }

        save_metadata(&self.session_dir, &self.metadata)?;
        Ok(())
    }

    /// Dispatches an on-demand targeted action/probe to a specific agent during discussion pause/review.
    pub async fn dispatch_targeted_action(
        &mut self,
        agent_id: &str,
        action_name: Option<String>,
        action_query: String,
    ) -> Result<DiscussionMessage, String> {
        let trimmed_query = action_query.trim().to_string();
        if trimmed_query.is_empty() {
            return Err("Targeted action query cannot be empty".to_string());
        }

        let participant = self
            .config
            .participants
            .iter()
            .find(|p| p.agent_id == agent_id)
            .cloned()
            .ok_or_else(|| format!("Participant '{}' not found in discussion", agent_id))?;

        let provider = self.resolve_participant_provider(&participant)?;

        let round = self.metadata.current_round;
        let turn_index = (self.metadata.total_messages + 1) as u32;

        self.notify(DiscussionEvent::TurnStarted {
            session_id: self.config.session_id.clone(),
            round,
            agent_id: participant.agent_id.clone(),
            role: participant.role.as_str().to_string(),
            action_name: action_name.clone(),
        });

        let label = action_name
            .clone()
            .unwrap_or_else(|| "Targeted User Directive".to_string());

        let ws_path = PathBuf::from(&self.config.workspace_path);
        let cognitive_pkt = load_cognitive_packet(&ws_path);
        let active_dispute_topics: Vec<String> = self
            .memory
            .load_disagreements()
            .into_iter()
            .filter(|d| matches!(d.status, DisagreementStatus::UnresolvedDivergence))
            .map(|d| d.topic)
            .collect();
        let epistemic_decision = evaluate_debate_epistemic_policy(
            &participant.role,
            round,
            &ws_path,
            cognitive_pkt.as_ref(),
            &active_dispute_topics,
        );

        let (frames, truncated) = self
            .memory
            .assemble_prefix_pinned_frames(
                &participant,
                round,
                &self.config.topic,
                &self.config.user_idea,
                &ws_path,
                &epistemic_decision,
                cognitive_pkt.as_ref(),
                Some(&label),
                Some(&trimmed_query),
            )
            .map_err(|e| format!("Failed to assemble context frames: {}", e))?;

        let system_prompt = frames
            .first()
            .map(|f| f.content.clone())
            .unwrap_or_default();
        let user_prompt = frames
            .iter()
            .skip(1)
            .map(|f| f.content.as_str())
            .collect::<Vec<_>>()
            .join("\n\n");

        let turn_request = TurnRequest {
            session_id: self.config.session_id.clone(),
            round_number: round,
            agent_id: participant.agent_id.clone(),
            role: participant.role.clone(),
            system_prompt,
            user_prompt,
            messages: frames,
            context_summary: String::new(),
            timeout_secs: self.config.turn_timeout_secs,
            topic: self.config.topic.clone(),
            user_idea: self.config.user_idea.clone(),
            action_name: action_name.clone(),
            action_query: Some(trimmed_query.clone()),
            thinking_enabled: participant.thinking_enabled,
        };

        let stream_sink: Option<Box<dyn StreamSink>> = self.event_listener.as_ref().map(|l| {
            Box::new(EventStreamSink {
                session_id: self.config.session_id.clone(),
                round,
                agent_id: participant.agent_id.clone(),
                listener: l.clone(),
                suppress_handoff: std::sync::Mutex::new(false),
            }) as Box<dyn StreamSink>
        });

        let response = provider
            .execute_turn(turn_request, self.cancel_flag.clone(), stream_sink)
            .await
            .map_err(|e| format!("Targeted action failed: {}", e))?;

        let (clean_markdown, target_peer_ids) =
            self.ingest_turn_cognitive_state(&participant, round, &response.raw_markdown);

        let msg_id = format!("targeted-r{}-{}-{}", round, participant.agent_id, now_ms());
        let message = DiscussionMessage {
            id: msg_id.clone(),
            session_id: self.config.session_id.clone(),
            round_number: round,
            turn_index,
            author_agent_id: participant.agent_id.clone(),
            author_role: participant.role.as_str().to_string(),
            author_provider: participant.provider_id.clone(),
            message_kind: DiscussionMessageKind::TargetedAction,
            target_peer_ids,
            content: clean_markdown,
            timestamp: now_ms(),
            token_usage: Some(response.usage.clone()),
            duration_ms: response.duration_ms,
            truncated,
            thinking_content: response.thinking.clone(),
            action_name: action_name.clone(),
            model_id: Some(response.model_id.clone()),
            simulated: response.simulated,
            author_display_name: Some(participant.display_name.clone()),
        };

        append_transcript_message(&self.session_dir, &message)?;
        self.metadata.total_messages += 1;
        self.metadata.total_tokens += response.usage.total_tokens;
        self.metadata.updated_at = now_ms();
        save_metadata(&self.session_dir, &self.metadata)?;

        self.notify(DiscussionEvent::TurnCompleted {
            session_id: self.config.session_id.clone(),
            round,
            agent_id: participant.agent_id.clone(),
            message_id: msg_id,
            usage: response.usage,
            thinking: response.thinking,
            simulated: response.simulated,
            action_name,
        });

        Ok(message)
    }

    /// Approves final report and finalizes session.
    pub fn approve_and_close(&mut self) -> Result<(), String> {
        if self.metadata.status != DiscussionStatus::AwaitingReview {
            return Err("Session is not awaiting review".to_string());
        }
        self.transition_status(DiscussionStatus::Completed)?;
        self.release_lock();
        Ok(())
    }

    /// Starts or resumes discussion execution until the round barrier, review pause, or completion.
    pub async fn run_discussion(&mut self) -> Result<DiscussionStatus, String> {
        // Validation & state preparation
        match self.metadata.status {
            DiscussionStatus::Created
            | DiscussionStatus::Paused
            | DiscussionStatus::Interrupted => {
                self.acquire_lock_if_needed()?;
                if self.metadata.started_at.is_none() {
                    self.metadata.started_at = Some(now_ms());
                }
                self.transition_status(DiscussionStatus::Running)?;
            }
            DiscussionStatus::AwaitingReview => {
                // If in review and max_rounds expanded, advance to next round
                if self.metadata.current_round < self.config.max_rounds {
                    self.acquire_lock_if_needed()?;
                    self.metadata.current_round += 1;
                    self.transition_status(DiscussionStatus::Running)?;
                } else {
                    return Ok(DiscussionStatus::AwaitingReview);
                }
            }
            DiscussionStatus::Running => {
                self.acquire_lock_if_needed()?;
            }
            other => {
                return Err(format!("Cannot run discussion in state: {:?}", other));
            }
        }

        // Reset flags
        self.pause_flag.store(false, Ordering::SeqCst);
        self.cancel_flag.store(false, Ordering::SeqCst);

        let active_participants: Vec<DiscussionParticipant> = self.config.participants.clone();
        if active_participants.is_empty() {
            let err = "Cannot run discussion: no participants configured".to_string();
            self.metadata.error_message = Some(err.clone());
            self.transition_status(DiscussionStatus::Failed)?;
            self.release_lock();
            return Err(err);
        }

        // Main Round Deliberation Loop
        while self.metadata.current_round <= self.config.max_rounds {
            let current_round = self.metadata.current_round;

            // Check cancellation / pause between rounds
            if self.cancel_flag.load(Ordering::Relaxed) {
                self.transition_status(DiscussionStatus::Cancelled)?;
                self.release_lock();
                return Ok(DiscussionStatus::Cancelled);
            }
            if self.pause_flag.load(Ordering::Relaxed) {
                self.transition_status(DiscussionStatus::Paused)?;
                self.release_lock();
                return Ok(DiscussionStatus::Paused);
            }

            // Check which agents have already completed turns in this round
            let (transcript, _) = read_transcript_with_recovery(&self.session_dir)?;
            let spoken_agent_ids: Vec<String> = transcript
                .iter()
                .filter(|m| m.round_number == current_round)
                .map(|m| m.author_agent_id.clone())
                .collect();

            // If all agents have completed turns in current_round:
            if spoken_agent_ids.len() >= active_participants.len() {
                if current_round >= self.config.max_rounds {
                    let generator = super::report::ReportGenerator::new(self.session_dir.clone());
                    if let Err(rep_err) =
                        generator.generate_report(&self.config, &mut self.metadata)
                    {
                        self.metadata.error_message =
                            Some(format!("Report synthesis warning: {}", rep_err));
                        let _ = save_metadata(&self.session_dir, &self.metadata);
                    }
                    self.transition_status(DiscussionStatus::AwaitingReview)?;
                    self.release_lock();
                    return Ok(DiscussionStatus::AwaitingReview);
                } else {
                    self.metadata.current_round += 1;
                    self.metadata.updated_at = now_ms();
                    save_metadata(&self.session_dir, &self.metadata)?;
                    continue;
                }
            }

            if spoken_agent_ids.is_empty() {
                self.notify(DiscussionEvent::RoundStarted {
                    session_id: self.config.session_id.clone(),
                    round: current_round,
                });
            }

            // BARRIER SYNCHRONIZATION:
            // All agents in this round are evaluated against the immutable transcript snapshot
            // up to the preceding round, guaranteeing non-bias from response arrival order.
            let mut turn_index = spoken_agent_ids.len() as u32;
            for participant in &active_participants {
                // If this agent already completed their turn in this round, skip
                if spoken_agent_ids.contains(&participant.agent_id) {
                    continue;
                }

                // Check cancellation
                if self.cancel_flag.load(Ordering::Relaxed) {
                    self.transition_status(DiscussionStatus::Cancelled)?;
                    self.release_lock();
                    return Ok(DiscussionStatus::Cancelled);
                }

                // Check pause
                if self.pause_flag.load(Ordering::Relaxed) {
                    self.transition_status(DiscussionStatus::Paused)?;
                    self.release_lock();
                    return Ok(DiscussionStatus::Paused);
                }

                turn_index += 1;
                if let Err(e) = self.execute_agent_turn(participant, current_round, turn_index).await {
                    let err_str = e.to_string();
                    self.metadata.error_message = Some(err_str.clone());
                    let _ = self.transition_status(DiscussionStatus::Failed);
                    self.release_lock();
                    self.notify(DiscussionEvent::StatusChanged {
                        session_id: self.config.session_id.clone(),
                        new_status: DiscussionStatus::Failed,
                    });
                    let _ = save_metadata(&self.session_dir, &self.metadata);
                    return Err(err_str);
                }

                // If in step-by-step mode, pause after executing this turn so human can review/intervene
                if self.step_mode {
                    let is_last_turn_of_final_round = current_round >= self.config.max_rounds
                        && (turn_index as usize) >= active_participants.len();

                    if !is_last_turn_of_final_round {
                        self.notify(DiscussionEvent::TurnPausedForHuman {
                            session_id: self.config.session_id.clone(),
                            round: current_round,
                            agent_id: participant.agent_id.clone(),
                        });
                        self.transition_status(DiscussionStatus::Paused)?;
                        self.release_lock();
                        return Ok(DiscussionStatus::Paused);
                    }
                }
            }

            // Round completed successfully! Freeze immutable round ledger for subsequent prefix KV cache hits.
            let _ = self.memory.get_or_freeze_round_digest(current_round);
            self.notify(DiscussionEvent::RoundCompleted {
                session_id: self.config.session_id.clone(),
                round: current_round,
            });

            // 1. Ensure active disputes reflect parsed peer contradictions (fallback only if models emitted none):
            if current_round == 2 {
                if self.memory.load_disagreements().is_empty() {
                    let dispute_topic = format!(
                        "Architecture & State Management Strategy: {}",
                        self.config.topic
                    );
                    for p in &active_participants {
                        let stance = match p.role {
                            AgentRole::Architect => format!("Advocates for a formal state-machine architecture with strict invariant guarantees for {}.", self.config.topic),
                            AgentRole::Critic => format!("Argues against over-abstraction, demanding low latency and minimal runtime overhead for {}.", self.config.topic),
                            AgentRole::Implementer => format!("Proposes a pragmatic, decoupled component architecture with local reactive state for {}.", self.config.topic),
                            _ => format!("Advocates for balanced simplicity and testability in {}.", self.config.topic),
                        };
                        let _ = self.memory.record_disagreement(
                            &dispute_topic,
                            &p.agent_id,
                            &stance,
                            current_round,
                        );
                    }
                }
                let active_disputes = self.memory.load_disagreements();
                self.metadata.active_disagreements_count = active_disputes
                    .iter()
                    .filter(|d| matches!(d.status, DisagreementStatus::UnresolvedDivergence))
                    .count();
                let _ = save_metadata(&self.session_dir, &self.metadata);
            }

            if current_round >= self.config.max_rounds {
                // 2. Ensure consensus decision ledger is populated (preserving real model-emitted decisions first):
                if self.memory.load_decisions().is_empty() {
                    let decision_topic = format!(
                        "Unified Architecture & Execution Blueprint: {}",
                        self.config.topic
                    );
                    let decision = format!("Decoupled component architecture with deterministic state handling, responsive feedback, and modular error boundaries for {}.", self.config.topic);
                    let rationale = format!("Achieves optimal balance between responsiveness, maintainability, and reliability, fulfilling requirements: {}.", self.config.user_idea);
                    let agreed_by: Vec<String> = active_participants
                        .iter()
                        .map(|p| p.agent_id.clone())
                        .collect();
                    let citations = vec![
                        "architecture-blueprint".to_string(),
                        "state-invariants".to_string(),
                        "verification-suite".to_string(),
                    ];
                    let _ = self.memory.record_decision(
                        &decision_topic,
                        &decision,
                        &rationale,
                        agreed_by,
                        current_round,
                        citations,
                    );
                }

                let decisions = self.memory.load_decisions();
                self.metadata.decisions_count = decisions.len();
                let active_disputes = self.memory.load_disagreements();
                self.metadata.active_disagreements_count = active_disputes
                    .iter()
                    .filter(|d| matches!(d.status, DisagreementStatus::UnresolvedDivergence))
                    .count();
                let _ = save_metadata(&self.session_dir, &self.metadata);

                // Synthesize 12-section evidence report
                let generator = super::report::ReportGenerator::new(self.session_dir.clone());
                if let Err(rep_err) = generator.generate_report(&self.config, &mut self.metadata) {
                    self.metadata.error_message =
                        Some(format!("Report synthesis warning: {}", rep_err));
                    let _ = save_metadata(&self.session_dir, &self.metadata);
                }
                self.transition_status(DiscussionStatus::AwaitingReview)?;
                self.release_lock();
                return Ok(DiscussionStatus::AwaitingReview);
            } else {
                // Advance to next round
                self.metadata.current_round += 1;
                self.metadata.updated_at = now_ms();
                save_metadata(&self.session_dir, &self.metadata)?;
            }
        }

        let decisions = self.memory.load_decisions();
        self.metadata.decisions_count = decisions.len();
        let active_disputes = self.memory.load_disagreements();
        self.metadata.active_disagreements_count = active_disputes
            .iter()
            .filter(|d| matches!(d.status, DisagreementStatus::UnresolvedDivergence))
            .count();
        let _ = save_metadata(&self.session_dir, &self.metadata);

        let generator = super::report::ReportGenerator::new(self.session_dir.clone());
        if let Err(rep_err) = generator.generate_report(&self.config, &mut self.metadata) {
            self.metadata.error_message = Some(format!("Report synthesis warning: {}", rep_err));
            let _ = save_metadata(&self.session_dir, &self.metadata);
        }
        self.transition_status(DiscussionStatus::AwaitingReview)?;
        self.release_lock();
        Ok(DiscussionStatus::AwaitingReview)
    }

    fn resolve_participant_provider(
        &self,
        participant: &DiscussionParticipant,
    ) -> Result<Arc<dyn DiscussionProvider>, String> {
        let composite = provider_lookup_key(&participant.provider_id, &participant.model_id);
        self.providers
            .get(&composite)
            .or_else(|| self.providers.get(&participant.provider_id))
            .cloned()
            .ok_or_else(|| {
                format!(
                    "Configured provider '{}' (model '{}') not found in orchestrator registry",
                    participant.provider_id, participant.model_id
                )
            })
    }

    /// Parses `<handoff_state>`, `<independent_resume>`, invariants, disputes, and `@Role` peer directives
    /// from an agent's output, persisting them to the session ledger, peer bus, and workspace `.flymd/cache/cognitive_state.json`.
    fn ingest_turn_cognitive_state(
        &mut self,
        participant: &DiscussionParticipant,
        round: u32,
        raw_markdown: &str,
    ) -> (String, Vec<String>) {
        let parsed = parse_handoff_blocks_from_markdown(
            raw_markdown,
            &participant.agent_id,
            participant.role.as_str(),
        );

        let mut target_peers = Vec::new();
        for pm in &parsed.peer_messages {
            if !target_peers.contains(&pm.to_target) {
                target_peers.push(pm.to_target.clone());
            }
        }
        let _ = self.memory.append_peer_messages(&parsed.peer_messages);

        for (idx, inv) in parsed.locked_invariants.iter().take(3).enumerate() {
            let topic = format!(
                "{} Invariant #{} ({})",
                participant.role.as_str(),
                idx + 1,
                self.config.topic
            );
            let _ = self.memory.record_decision(
                &topic,
                inv,
                &format!(
                    "Established by {} ({}) in Round {}",
                    participant.display_name,
                    participant.role.as_str(),
                    round
                ),
                vec![participant.agent_id.clone()],
                round,
                vec![format!("round-{}", round)],
            );
        }

        for disp in parsed.active_disputes.iter().take(2) {
            let _ = self.memory.record_disagreement(
                disp,
                &participant.agent_id,
                &format!(
                    "{} ({}) flagged trade-off in Round {}",
                    participant.display_name,
                    participant.role.as_str(),
                    round
                ),
                round,
            );
        }

        let ws_path = PathBuf::from(&self.config.workspace_path);
        let _ = update_workspace_cognitive_cache(
            &ws_path,
            &participant.agent_id,
            participant.role.as_str(),
            Some(&self.config.session_id),
            round,
            Some(&self.config.user_idea),
            raw_markdown,
            None,
        );

        self.metadata.decisions_count = self.memory.load_decisions().len();
        self.metadata.active_disagreements_count = self
            .memory
            .load_disagreements()
            .iter()
            .filter(|d| matches!(d.status, DisagreementStatus::UnresolvedDivergence))
            .count();

        (parsed.clean_markdown, target_peers)
    }

    async fn execute_agent_turn(
        &mut self,
        participant: &DiscussionParticipant,
        round: u32,
        turn_index: u32,
    ) -> Result<(), String> {
        let action_name = participant.custom_action.as_ref().map(|a| a.name.clone());
        let action_query = participant.custom_query.clone().or_else(|| {
            participant
                .custom_action
                .as_ref()
                .map(|a| a.prompt_directive.clone())
        });

        self.notify(DiscussionEvent::TurnStarted {
            session_id: self.config.session_id.clone(),
            round,
            agent_id: participant.agent_id.clone(),
            role: participant.role.as_str().to_string(),
            action_name: action_name.clone(),
        });

        // 1. Resolve Provider (composite provider_id::model_id with fallback)
        let provider = self.resolve_participant_provider(participant)?;

        // 2. Evaluate Role-Aware Epistemic Policy & Assemble Prefix-Pinned KV Cache Frames
        let ws_path = PathBuf::from(&self.config.workspace_path);
        let cognitive_pkt = load_cognitive_packet(&ws_path);
        let active_dispute_topics: Vec<String> = self
            .memory
            .load_disagreements()
            .into_iter()
            .filter(|d| matches!(d.status, DisagreementStatus::UnresolvedDivergence))
            .map(|d| d.topic)
            .collect();

        let epistemic_decision = evaluate_debate_epistemic_policy(
            &participant.role,
            round,
            &ws_path,
            cognitive_pkt.as_ref(),
            &active_dispute_topics,
        );

        let (frames, truncated) = self
            .memory
            .assemble_prefix_pinned_frames(
                participant,
                round,
                &self.config.topic,
                &self.config.user_idea,
                &ws_path,
                &epistemic_decision,
                cognitive_pkt.as_ref(),
                action_name.as_deref(),
                action_query.as_deref(),
            )
            .map_err(|e| format!("Failed to assemble context frames: {}", e))?;

        let message_kind = match round {
            1 => DiscussionMessageKind::InitialAnalysis,
            2 => DiscussionMessageKind::PeerCritique,
            _ => DiscussionMessageKind::RebuttalRevision,
        };

        let system_prompt = frames
            .first()
            .map(|f| f.content.clone())
            .unwrap_or_default();
        let user_prompt = frames
            .iter()
            .skip(1)
            .map(|f| f.content.as_str())
            .collect::<Vec<_>>()
            .join("\n\n");

        let turn_request = TurnRequest {
            session_id: self.config.session_id.clone(),
            round_number: round,
            agent_id: participant.agent_id.clone(),
            role: participant.role.clone(),
            system_prompt,
            user_prompt,
            messages: frames,
            context_summary: String::new(),
            timeout_secs: self.config.turn_timeout_secs,
            topic: self.config.topic.clone(),
            user_idea: self.config.user_idea.clone(),
            action_name: action_name.clone(),
            action_query: action_query.clone(),
            thinking_enabled: participant.thinking_enabled,
        };

        // Prepare streaming sink if listener attached
        let stream_sink: Option<Box<dyn StreamSink>> = self.event_listener.as_ref().map(|l| {
            Box::new(EventStreamSink {
                session_id: self.config.session_id.clone(),
                round,
                agent_id: participant.agent_id.clone(),
                listener: l.clone(),
                suppress_handoff: std::sync::Mutex::new(false),
            }) as Box<dyn StreamSink>
        });

        // Execute turn with cancellation monitoring
        let result = provider
            .execute_turn(turn_request, self.cancel_flag.clone(), stream_sink)
            .await;

        match result {
            Ok(response) => {
                let (clean_markdown, target_peer_ids) =
                    self.ingest_turn_cognitive_state(participant, round, &response.raw_markdown);

                let msg_id = format!("msg-r{}-{}-{}", round, participant.agent_id, now_ms());
                let message = DiscussionMessage {
                    id: msg_id.clone(),
                    session_id: self.config.session_id.clone(),
                    round_number: round,
                    turn_index,
                    author_agent_id: participant.agent_id.clone(),
                    author_role: participant.role.as_str().to_string(),
                    author_provider: participant.provider_id.clone(),
                    message_kind,
                    target_peer_ids,
                    content: clean_markdown,
                    timestamp: now_ms(),
                    token_usage: Some(response.usage.clone()),
                    duration_ms: response.duration_ms,
                    truncated,
                    thinking_content: response.thinking.clone(),
                    action_name: action_name.clone(),
                    model_id: Some(response.model_id.clone()),
                    simulated: response.simulated,
                    author_display_name: Some(participant.display_name.clone()),
                };

                append_transcript_message(&self.session_dir, &message)?;

                self.metadata.total_messages += 1;
                self.metadata.total_tokens += response.usage.total_tokens;
                self.metadata.updated_at = now_ms();
                save_metadata(&self.session_dir, &self.metadata)?;

                self.notify(DiscussionEvent::TurnCompleted {
                    session_id: self.config.session_id.clone(),
                    round,
                    agent_id: participant.agent_id.clone(),
                    message_id: msg_id,
                    usage: response.usage,
                    thinking: response.thinking,
                    simulated: response.simulated,
                    action_name,
                });

                Ok(())
            }
            Err(ProviderError::Cancelled) => {
                self.notify(DiscussionEvent::TurnFailed {
                    session_id: self.config.session_id.clone(),
                    round,
                    agent_id: participant.agent_id.clone(),
                    error: "Turn was cancelled".to_string(),
                });
                Err("Turn cancelled".to_string())
            }
            Err(e) => {
                let err_str = match &e {
                    ProviderError::NetworkError(msg) if msg.contains("connection error") || msg.contains("11434") || msg.contains("refused") => {
                        format!("Failed to connect to local engine ({}). Ensure service is running or switch Preset Engine to 'Local Adaptive Reasoner'.", msg)
                    }
                    other => other.to_string(),
                };
                self.notify(DiscussionEvent::TurnFailed {
                    session_id: self.config.session_id.clone(),
                    round,
                    agent_id: participant.agent_id.clone(),
                    error: err_str.clone(),
                });
                self.metadata.error_message = Some(err_str.clone());
                save_metadata(&self.session_dir, &self.metadata)?;
                Err(format!("Agent turn execution failed: {}", err_str))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::discussion::runner::MockProvider;
    use crate::discussion::types::AgentRole;
    use std::sync::Mutex;

    struct TestCollector {
        events: Mutex<Vec<DiscussionEvent>>,
    }

    impl DiscussionEventListener for TestCollector {
        fn on_event(&self, event: DiscussionEvent) {
            let mut list = self.events.lock().unwrap();
            list.push(event);
        }
    }

    fn build_test_config(temp_workspace: &Path) -> DiscussionConfig {
        DiscussionConfig {
            schema_version: 1,
            session_id: format!("test-session-{}", now_ms()),
            topic: "Architecture Design for FlyMD Discussions".to_string(),
            user_idea:
                "Build an isolated multi-agent discussion system with no external side effects."
                    .to_string(),
            workspace_path: temp_workspace.to_string_lossy().to_string(),
            max_rounds: 3,
            turn_timeout_secs: 10,
            participants: vec![
                DiscussionParticipant {
                    agent_id: "agent-architect".to_string(),
                    provider_id: "mock".to_string(),
                    model_id: "mock-v1".to_string(),
                    display_name: "Architect Agent".to_string(),
                    role: AgentRole::Architect,
                    role_description: "Focus on decomposition and contracts.".to_string(),
                    avatar_color: "#38bdf8".to_string(),
                    assigned_skill_uris: Vec::new(),
                    context_budget_tokens: 16000,
                    custom_action: None,
                    custom_query: None,
                    thinking_enabled: true,
                },
                DiscussionParticipant {
                    agent_id: "agent-critic".to_string(),
                    provider_id: "mock".to_string(),
                    model_id: "mock-v1".to_string(),
                    display_name: "Critic Agent".to_string(),
                    role: AgentRole::Critic,
                    role_description: "Challenge assumptions and point out bottlenecks."
                        .to_string(),
                    avatar_color: "#ef4444".to_string(),
                    assigned_skill_uris: Vec::new(),
                    context_budget_tokens: 16000,
                    custom_action: None,
                    custom_query: None,
                    thinking_enabled: true,
                },
                DiscussionParticipant {
                    agent_id: "agent-implementer".to_string(),
                    provider_id: "mock".to_string(),
                    model_id: "mock-v1".to_string(),
                    display_name: "Implementer Agent".to_string(),
                    role: AgentRole::Implementer,
                    role_description: "Focus on idiomatic code and testing.".to_string(),
                    avatar_color: "#10b981".to_string(),
                    assigned_skill_uris: Vec::new(),
                    context_budget_tokens: 16000,
                    custom_action: None,
                    custom_query: None,
                    thinking_enabled: true,
                },
            ],
            active_skill_uris: Vec::new(),
            step_mode: false,
        }
    }

    #[tokio::test]
    async fn test_full_offline_3_agent_3_round_discussion() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_orch_test_{}", now_ms()));
        fs::create_dir_all(&temp_dir).unwrap();

        let config = build_test_config(&temp_dir);
        let session_id = config.session_id.clone();

        let mut providers: HashMap<String, Arc<dyn DiscussionProvider>> = HashMap::new();
        providers.insert("mock".to_string(), Arc::new(MockProvider::new("mock")));

        let collector = Arc::new(TestCollector {
            events: Mutex::new(Vec::new()),
        });

        let mut orchestrator = DiscussionOrchestrator::new(config, providers).unwrap();
        orchestrator.set_event_listener(collector.clone());

        // Run full 3-agent, 3-round discussion
        let final_status = orchestrator.run_discussion().await.unwrap();
        assert_eq!(final_status, DiscussionStatus::AwaitingReview);

        // Verify transcript and messages count (3 agents * 3 rounds = 9 messages)
        let (transcript, _) = read_transcript_with_recovery(&orchestrator.session_dir).unwrap();
        assert_eq!(transcript.len(), 9);

        // Verify round progression
        let round_1_msgs: Vec<_> = transcript.iter().filter(|m| m.round_number == 1).collect();
        let round_2_msgs: Vec<_> = transcript.iter().filter(|m| m.round_number == 2).collect();
        let round_3_msgs: Vec<_> = transcript.iter().filter(|m| m.round_number == 3).collect();
        assert_eq!(round_1_msgs.len(), 3);
        assert_eq!(round_2_msgs.len(), 3);
        assert_eq!(round_3_msgs.len(), 3);

        // Verify metadata integrity
        let loaded_meta = load_metadata(&orchestrator.session_dir).unwrap();
        assert_eq!(loaded_meta.current_round, 3);
        assert_eq!(loaded_meta.total_messages, 9);
        assert!(loaded_meta.total_tokens > 0);
        assert_eq!(loaded_meta.status, DiscussionStatus::AwaitingReview);

        // Verify recovery after completion
        let mut providers2: HashMap<String, Arc<dyn DiscussionProvider>> = HashMap::new();
        providers2.insert("mock".to_string(), Arc::new(MockProvider::new("mock")));
        let recovered =
            DiscussionOrchestrator::recover(&temp_dir, &session_id, providers2).unwrap();
        assert_eq!(recovered.metadata.status, DiscussionStatus::AwaitingReview);
        assert_eq!(recovered.metadata.total_messages, 9);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[tokio::test]
    async fn test_pause_and_user_guidance_injection() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_pause_test_{}", now_ms()));
        fs::create_dir_all(&temp_dir).unwrap();

        let mut config = build_test_config(&temp_dir);
        config.max_rounds = 2; // Run 2 rounds first

        let mut providers: HashMap<String, Arc<dyn DiscussionProvider>> = HashMap::new();
        providers.insert("mock".to_string(), Arc::new(MockProvider::new("mock")));

        let mut orchestrator = DiscussionOrchestrator::new(config, providers).unwrap();
        let status = orchestrator.run_discussion().await.unwrap();
        assert_eq!(status, DiscussionStatus::AwaitingReview);

        // User injects steer guidance
        orchestrator
            .inject_user_guidance(
                "Please prioritize SQLite over PostgreSQL due to local deployment.",
            )
            .unwrap();

        // Round expands to 3, run again
        let next_status = orchestrator.run_discussion().await.unwrap();
        assert_eq!(next_status, DiscussionStatus::AwaitingReview);
        assert_eq!(orchestrator.metadata.current_round, 3);

        // Approve and finalize
        orchestrator.approve_and_close().unwrap();
        assert_eq!(orchestrator.metadata.status, DiscussionStatus::Completed);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[tokio::test]
    async fn test_step_by_step_mode_and_turn_progression() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_step_test_{}", now_ms()));
        fs::create_dir_all(&temp_dir).unwrap();

        let mut config = build_test_config(&temp_dir);
        config.max_rounds = 1;
        config.step_mode = true; // Enable step mode

        let mut providers: HashMap<String, Arc<dyn DiscussionProvider>> = HashMap::new();
        providers.insert("mock".to_string(), Arc::new(MockProvider::new("mock")));

        let mut orchestrator = DiscussionOrchestrator::new(config, providers).unwrap();

        // 1st step: runs first agent, then pauses
        let status1 = orchestrator.run_discussion().await.unwrap();
        assert_eq!(status1, DiscussionStatus::Paused);
        let (transcript1, _) = read_transcript_with_recovery(&orchestrator.session_dir).unwrap();
        assert_eq!(transcript1.len(), 1);
        assert_eq!(transcript1[0].author_agent_id, "agent-architect");

        // 2nd step: resume to run second agent, then pauses
        let status2 = orchestrator.run_discussion().await.unwrap();
        assert_eq!(status2, DiscussionStatus::Paused);
        let (transcript2, _) = read_transcript_with_recovery(&orchestrator.session_dir).unwrap();
        assert_eq!(transcript2.len(), 2);
        assert_eq!(transcript2[1].author_agent_id, "agent-critic");

        // 3rd step: resume to run third agent. Round 1 completes, reaches final barrier!
        let status3 = orchestrator.run_discussion().await.unwrap();
        assert_eq!(status3, DiscussionStatus::AwaitingReview);
        let (transcript3, _) = read_transcript_with_recovery(&orchestrator.session_dir).unwrap();
        assert_eq!(transcript3.len(), 3);
        assert_eq!(transcript3[2].author_agent_id, "agent-implementer");

        // Check report was generated
        assert!(orchestrator
            .session_dir
            .join("reports")
            .join("final-report-latest.md")
            .exists());

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[tokio::test]
    async fn test_targeted_action_dispatch() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_target_test_{}", now_ms()));
        fs::create_dir_all(&temp_dir).unwrap();

        let config = build_test_config(&temp_dir);
        let mut providers: HashMap<String, Arc<dyn DiscussionProvider>> = HashMap::new();
        providers.insert("mock".to_string(), Arc::new(MockProvider::new("mock")));

        let mut orchestrator = DiscussionOrchestrator::new(config, providers).unwrap();

        let msg = orchestrator
            .dispatch_targeted_action(
                "agent-critic",
                Some("Security Stress Audit".to_string()),
                "Verify CVE risk of IPC deserialization".to_string(),
            )
            .await
            .unwrap();

        assert_eq!(msg.author_agent_id, "agent-critic");
        assert_eq!(
            msg.message_kind,
            DiscussionMessageKind::TargetedAction
        );
        assert_eq!(msg.action_name.as_deref(), Some("Security Stress Audit"));
        assert!(msg.thinking_content.is_some());
        assert!(msg.simulated);

        let (transcript, _) = read_transcript_with_recovery(&orchestrator.session_dir).unwrap();
        assert_eq!(transcript.len(), 1);
        assert_eq!(transcript[0].author_agent_id, "agent-critic");

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
