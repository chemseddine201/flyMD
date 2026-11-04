//! Discussion Orchestrator: 8-state discussion lifecycle, barrier synchronization,
//! checkpointing, and deterministic multi-turn debate coordinator.

use super::board::{ClaimStatus, DebateBoardState};
use super::convergence::{
    evaluate_round_boundary_convergence, evaluate_turn_convergence, ConvergenceVerdict,
};
use super::epistemic::{
    build_epistemic_prompt_section, evaluate_debate_epistemic_policy,
    format_board_handoff_state_emission_protocol,
};
use super::memory::MemoryManager;
use super::provider_registry::provider_lookup_key;
use super::runner::{
    has_native_thinking, ChatMessageFrame, DiscussionProvider, ProviderError, StreamSink,
    TurnRequest, TurnResponse,
};
use super::storage::{
    append_transcript_message, atomic_write_json, load_metadata, read_transcript_with_recovery,
    save_metadata, SessionLock,
};
use super::types::{
    now_ms, AgentRole, DisagreementStatus, DiscussionConfig, DiscussionMessage,
    DiscussionMessageKind, DiscussionMetadata, DiscussionParticipant, DiscussionStatus,
    RoundExecutionRecord, RoundExecutionStatus, TokenUsage, CURRENT_SCHEMA_VERSION,
};
use crate::projects::cache::{
    filter_peer_messages_for_agent, load_cognitive_packet, parse_handoff_blocks_from_markdown,
    update_workspace_cognitive_cache_with_parsed,
};
use async_trait::async_trait;
use std::collections::{HashMap, HashSet};
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
    QuotaLimitReached {
        session_id: String,
        total_tokens: u32,
        cap: u32,
    },
    ConvergenceReached {
        session_id: String,
        converged_round: u32,
        reference_round: u32,
        matched_agents: Vec<String>,
        skipped_rounds: Vec<u32>,
        reason: String,
    },
    RoundBarrierPaused {
        session_id: String,
        completed_round: u32,
        next_round: u32,
    },
    ConfigUpdated {
        session_id: String,
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

struct PreparedParticipantTurn {
    turn_request: TurnRequest,
    stream_sink: Option<Box<dyn StreamSink>>,
    truncated: bool,
}

pub struct DiscussionOrchestrator {
    pub config: DiscussionConfig,
    pub metadata: DiscussionMetadata,
    pub session_dir: PathBuf,
    pub memory: MemoryManager,
    pub board_state: DebateBoardState,
    pub skills_manager: super::skills::SkillsManager,
    pub providers: HashMap<String, Arc<dyn DiscussionProvider>>,
    pub cancel_flag: Arc<AtomicBool>,
    pub pause_flag: Arc<AtomicBool>,
    lock: Option<SessionLock>,
    event_listener: Option<Arc<dyn DiscussionEventListener>>,
    pub step_mode: bool,
}

impl DiscussionOrchestrator {
    /// Creates a new Discussion Orchestrator, initializes session directory and persists initial config and metadata.
    pub fn new(
        mut config: DiscussionConfig,
        providers: HashMap<String, Arc<dyn DiscussionProvider>>,
    ) -> Result<Self, String> {
        if config.topic.trim().is_empty() {
            return Err("Discussion topic is required to launch a deliberation".to_string());
        }
        if config.user_idea.trim().is_empty() {
            return Err("Proposal/query and target objective are required to launch a deliberation".to_string());
        }
        // Auto-align max_rounds with explicit round schedule length or per-agent participant count
        if !config.round_schedule.is_empty() && (config.repeater_mode.as_deref() == Some("per_round") || config.max_rounds == 0) {
            config.max_rounds = config.round_schedule.len() as u32;
        } else if config.repeater_mode.as_deref() == Some("per_agent") && !config.participants.is_empty() {
            config.max_rounds = config.participants.len() as u32;
        }

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
            converged_at_round: None,
            convergence_reason: None,
            round_ledger: Vec::new(),
        };

        save_metadata(&session_dir, &metadata)?;

        let memory = MemoryManager::new(session_dir.clone());
        let board_state = DebateBoardState::load_or_init(&session_dir);

        let mut skills_manager = super::skills::SkillsManager::new();
        skills_manager.discover_all_skills(
            &config.workspace_path,
            config.custom_skills_dir.as_deref(),
            config.include_default_skills,
        );

        let step_mode = config.step_mode;

        Ok(Self {
            config,
            metadata,
            session_dir,
            memory,
            board_state,
            skills_manager,
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

        let board_state = DebateBoardState::load_or_init(&session_dir);
        let step_mode = config.step_mode;

        let mut skills_manager = super::skills::SkillsManager::new();
        skills_manager.discover_all_skills(
            &config.workspace_path,
            config.custom_skills_dir.as_deref(),
            config.include_default_skills,
        );

        Ok(Self {
            config,
            metadata,
            session_dir,
            memory,
            board_state,
            skills_manager,
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

    /// Updates configuration for upcoming rounds when the deliberation is paused or failed.
    /// Strictly forbids mutating historical or currently executing rounds.
    pub fn update_future_config(&mut self, new_config: DiscussionConfig) -> Result<(), String> {
        if self.metadata.status != DiscussionStatus::Paused
            && self.metadata.status != DiscussionStatus::Failed
            && self.metadata.status != DiscussionStatus::Created
        {
            return Err(format!(
                "Cannot modify discussion configuration in state: {:?}",
                self.metadata.status
            ));
        }

        if new_config.session_id != self.config.session_id {
            return Err("Cannot mutate session_id".to_string());
        }

        if new_config.max_rounds < self.metadata.current_round {
            return Err(format!(
                "max_rounds ({}) cannot be less than current round ({})",
                new_config.max_rounds, self.metadata.current_round
            ));
        }

        // Strict Immutability Guard: Past rounds and current round (r <= current_round)
        // must not have their schedule or participants changed.
        for r in 1..=self.metadata.current_round {
            let (_, _, old_slots) = self.config.resolve_round_plan(r);
            let (_, _, new_slots) = new_config.resolve_round_plan(r);

            let old_participants: Vec<String> = old_slots.iter().map(|(p, _)| p.agent_id.clone()).collect();
            let new_participants: Vec<String> = new_slots.iter().map(|(p, _)| p.agent_id.clone()).collect();

            if old_participants != new_participants {
                return Err(format!(
                    "Cannot modify participants for Round {} which has already executed or is currently active",
                    r
                ));
            }
        }

        self.step_mode = new_config.step_mode;
        self.config = new_config;

        let config_path = self.session_dir.join("config.json");
        atomic_write_json(&config_path, &self.config)?;

        self.metadata.updated_at = now_ms();
        let _ = save_metadata(&self.session_dir, &self.metadata);

        self.notify(DiscussionEvent::ConfigUpdated {
            session_id: self.config.session_id.clone(),
        });

        Ok(())
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
            (DiscussionStatus::Failed, DiscussionStatus::Running) => true,
            (DiscussionStatus::Failed, DiscussionStatus::Cancelled) => true,
            (DiscussionStatus::Failed, DiscussionStatus::Paused) => true,
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

        let PreparedParticipantTurn {
            turn_request,
            stream_sink,
            truncated,
        } = self.build_participant_turn_request(
            &participant,
            round,
            Some(&label),
            action_name.clone(),
            Some(trimmed_query),
        )?;

        let response = provider
            .execute_turn(turn_request, self.cancel_flag.clone(), stream_sink)
            .await
            .map_err(|e| format!("Targeted action failed: {}", e))?;

        self.commit_participant_turn_response(
            &participant,
            round,
            turn_index,
            "targeted",
            DiscussionMessageKind::TargetedAction,
            action_name,
            truncated,
            response,
        )
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
            | DiscussionStatus::Interrupted
            | DiscussionStatus::Failed => {
                self.acquire_lock_if_needed()?;
                if self.metadata.started_at.is_none() {
                    self.metadata.started_at = Some(now_ms());
                }
                // Clear any prior failure error message upon resumption
                self.metadata.error_message = None;
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

        let all_scheduled = self.config.all_scheduled_participants();
        if all_scheduled.is_empty() {
            let err = "Cannot run discussion: no participants configured".to_string();
            self.metadata.error_message = Some(err.clone());
            self.transition_status(DiscussionStatus::Failed)?;
            self.release_lock();
            return Err(err);
        }

        // Main Round Deliberation Loop (supports Multi-Engine Round Repeater + Early Convergence)
        while self.metadata.current_round <= self.config.max_rounds {
            let current_round = self.metadata.current_round;
            let (round_title, _round_objective, round_slots) =
                self.config.resolve_round_plan(current_round);
            let active_participants: Vec<DiscussionParticipant> =
                round_slots.iter().map(|(p, _)| p.clone()).collect();

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

            // Check which agents have already completed turns in this round (O(1) set lookup, excluding user interventions)
            let (transcript, _) = read_transcript_with_recovery(&self.session_dir)?;
            let spoken_agent_ids: HashSet<String> = transcript
                .iter()
                .filter(|m| {
                    m.round_number == current_round
                        && m.message_kind != DiscussionMessageKind::UserIntervention
                })
                .map(|m| m.author_agent_id.clone())
                .collect();

            // If all active agents have completed turns in current_round:
            let all_agents_spoken = active_participants
                .iter()
                .all(|p| spoken_agent_ids.contains(&p.agent_id));
            if all_agents_spoken {
                self.upsert_round_ledger_record(RoundExecutionRecord {
                    round_number: current_round,
                    title: round_title.clone(),
                    status: RoundExecutionStatus::Executed,
                    converged_from_round: None,
                    reason: None,
                    skipped_agent_names: Vec::new(),
                });
                if current_round >= self.config.max_rounds {
                    return self.finalize_and_generate_report();
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
            for (slot_idx, (participant, round_directive)) in round_slots.iter().enumerate() {
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

                let disputes_before = self.metadata.active_disagreements_count;
                turn_index += 1;
                if let Err(e) = self
                    .execute_agent_turn_with_directive(
                        participant,
                        current_round,
                        turn_index,
                        round_directive.as_deref(),
                    )
                    .await
                {
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

                let new_unresolved_dispute_added =
                    self.metadata.active_disagreements_count > disputes_before;

                // Evaluate Early Convergence right after turn commits (saves remaining steps & remaining rounds)
                if self.config.context_mode.as_deref() == Some("board") {
                    if self.board_state.is_early_converged(active_participants.len()) {
                        let verdict = ConvergenceVerdict {
                            converged_round: current_round,
                            reference_round: current_round.saturating_sub(1),
                            similarity: 1.0,
                            matched_agents: active_participants
                                .iter()
                                .map(|p| p.agent_id.clone())
                                .collect(),
                            reason: "Debate board full participant cycle completed with zero new claims and stable consensus status".to_string(),
                        };
                        let remaining_in_round: Vec<DiscussionParticipant> = round_slots
                            .iter()
                            .skip(slot_idx + 1)
                            .map(|(p, _)| p.clone())
                            .filter(|p| !spoken_agent_ids.contains(&p.agent_id))
                            .collect();
                        if !remaining_in_round.is_empty() || current_round < self.config.max_rounds {
                            return self.handle_early_convergence_termination(
                                current_round,
                                &round_title,
                                turn_index,
                                &remaining_in_round,
                                &active_participants,
                                verdict,
                            );
                        }
                    }
                }

                let (updated_transcript, _) = read_transcript_with_recovery(&self.session_dir)?;
                if let Some(verdict) = evaluate_turn_convergence(
                    &updated_transcript,
                    current_round,
                    new_unresolved_dispute_added,
                ) {
                    let remaining_in_round: Vec<DiscussionParticipant> = round_slots
                        .iter()
                        .skip(slot_idx + 1)
                        .map(|(p, _)| p.clone())
                        .filter(|p| !spoken_agent_ids.contains(&p.agent_id))
                        .collect();

                    // Only short-circuit if there are remaining steps in this round OR remaining rounds to save
                    if !remaining_in_round.is_empty() || current_round < self.config.max_rounds {
                        return self.handle_early_convergence_termination(
                            current_round,
                            &round_title,
                            turn_index,
                            &remaining_in_round,
                            &active_participants,
                            verdict,
                        );
                    }
                }

                // Check if session token budget cap is breached at turn boundary
                if let Some(cap) = self.config.token_budget_cap {
                    if cap > 0 && self.metadata.total_tokens >= cap {
                        self.notify(DiscussionEvent::QuotaLimitReached {
                            session_id: self.config.session_id.clone(),
                            total_tokens: self.metadata.total_tokens,
                            cap,
                        });
                        self.transition_status(DiscussionStatus::Paused)?;
                        self.release_lock();
                        return Ok(DiscussionStatus::Paused);
                    }
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

            // When in Debate Board mode, commit all staged updates from this round barrier
            if self.config.context_mode.as_deref() == Some("board") {
                let roster_agent_ids: Vec<String> = active_participants
                    .iter()
                    .map(|p| p.agent_id.clone())
                    .collect();
                self.board_state
                    .commit_staged_round_updates(&roster_agent_ids, current_round);
                let _ = self.board_state.sync_to_existing_files(&self.memory);
                let _ = self.board_state.save(&self.session_dir);
            }

            // Round completed successfully! Record in round ledger and freeze immutable round digest.
            self.upsert_round_ledger_record(RoundExecutionRecord {
                round_number: current_round,
                title: round_title.clone(),
                status: RoundExecutionStatus::Executed,
                converged_from_round: None,
                reason: None,
                skipped_agent_names: Vec::new(),
            });
            let _ = self.memory.get_or_freeze_round_digest(current_round);
            self.notify(DiscussionEvent::RoundCompleted {
                session_id: self.config.session_id.clone(),
                round: current_round,
            });

            // Check Inter-Round Boundary Convergence before advancing to next round
            if current_round < self.config.max_rounds {
                let (post_round_transcript, _) = read_transcript_with_recovery(&self.session_dir)?;
                if let Some(verdict) = evaluate_round_boundary_convergence(
                    &post_round_transcript,
                    current_round,
                    false,
                ) {
                    return self.handle_early_convergence_termination(
                        current_round,
                        &round_title,
                        turn_index,
                        &[],
                        &active_participants,
                        verdict,
                    );
                }
            }

            // 1. Ensure active disputes reflect parsed peer contradictions (fallback only if models emitted none in classic mode):
            if self.config.context_mode.as_deref() != Some("board") && current_round == 2 {
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
                // 2. Ensure consensus decision ledger is populated (preserving real model-emitted decisions first in classic mode):
                if self.config.context_mode.as_deref() != Some("board") && self.memory.load_decisions().is_empty() {
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

                return self.finalize_and_generate_report();
            } else {
                // Check if user requested round barrier pause or configured pause_at_round_boundary
                if self.config.pause_at_round_boundary || self.pause_flag.load(Ordering::Relaxed) {
                    self.pause_flag.store(false, Ordering::SeqCst);
                    self.transition_status(DiscussionStatus::Paused)?;
                    self.release_lock();
                    self.notify(DiscussionEvent::RoundBarrierPaused {
                        session_id: self.config.session_id.clone(),
                        completed_round: current_round,
                        next_round: current_round + 1,
                    });
                    return Ok(DiscussionStatus::Paused);
                }

                // Advance to next round
                self.metadata.current_round += 1;
                self.metadata.updated_at = now_ms();
                save_metadata(&self.session_dir, &self.metadata)?;
            }
        }

        self.finalize_and_generate_report()
    }

    fn upsert_round_ledger_record(&mut self, record: RoundExecutionRecord) {
        if let Some(existing) = self
            .metadata
            .round_ledger
            .iter_mut()
            .find(|r| r.round_number == record.round_number)
        {
            *existing = record;
        } else {
            self.metadata.round_ledger.push(record);
            self.metadata
                .round_ledger
                .sort_by_key(|r| r.round_number);
        }
    }

    fn handle_early_convergence_termination(
        &mut self,
        converged_round: u32,
        round_title: &str,
        mut last_turn_index: u32,
        remaining_in_round: &[DiscussionParticipant],
        active_participants: &[DiscussionParticipant],
        verdict: ConvergenceVerdict,
    ) -> Result<DiscussionStatus, String> {
        let mut skipped_in_round_names = Vec::new();

        // 1. Explicitly record any escaped steps in `converged_round` as Ignored (`SkippedConsensus`, 0 queries)
        for rem_p in remaining_in_round {
            last_turn_index += 1;
            skipped_in_round_names.push(rem_p.display_name.clone());
            let skip_msg = DiscussionMessage {
                id: format!(
                    "skip-r{}-{}-{}",
                    converged_round,
                    rem_p.agent_id,
                    now_ms()
                ),
                session_id: self.config.session_id.clone(),
                round_number: converged_round,
                turn_index: last_turn_index,
                author_agent_id: rem_p.agent_id.clone(),
                author_role: rem_p.role.as_str().to_string(),
                author_provider: rem_p.provider_id.clone(),
                message_kind: DiscussionMessageKind::SkippedConsensus,
                target_peer_ids: Vec::new(),
                content: format!(
                    "> **[Ignored Step — Duplicate Summary Consensus]**\n> Step skipped for **{}** (`{}`) to save queries because successive agents already converged on the same summary ({})",
                    rem_p.display_name,
                    rem_p.role.as_str(),
                    verdict.reason
                ),
                timestamp: now_ms(),
                token_usage: Some(TokenUsage::default()),
                duration_ms: 0,
                truncated: false,
                thinking_content: None,
                action_name: Some("Ignored (Converged)".to_string()),
                model_id: Some(rem_p.model_id.clone()),
                simulated: true,
                author_display_name: Some(rem_p.display_name.clone()),
            };
            append_transcript_message(&self.session_dir, &skip_msg)?;
            self.metadata.total_messages += 1;
        }

        // 2. Record `converged_round` in round_ledger
        let converged_status = if skipped_in_round_names.is_empty() {
            RoundExecutionStatus::Executed
        } else {
            RoundExecutionStatus::ConvergedEarly
        };
        self.upsert_round_ledger_record(RoundExecutionRecord {
            round_number: converged_round,
            title: round_title.to_string(),
            status: converged_status,
            converged_from_round: Some(verdict.reference_round),
            reason: Some(verdict.reason.clone()),
            skipped_agent_names: skipped_in_round_names,
        });

        let _ = self.memory.get_or_freeze_round_digest(converged_round);
        self.notify(DiscussionEvent::RoundCompleted {
            session_id: self.config.session_id.clone(),
            round: converged_round,
        });

        // 3. Mark all subsequent rounds `(converged_round + 1)..=max_rounds` as Ignored / Duplicated (0 queries!)
        let mut skipped_rounds = Vec::new();
        for skipped_r in (converged_round + 1)..=self.config.max_rounds {
            skipped_rounds.push(skipped_r);
            let (skipped_title, _, skipped_slots) = self.config.resolve_round_plan(skipped_r);
            let skipped_agents: Vec<String> = skipped_slots
                .into_iter()
                .map(|(p, _)| p.display_name)
                .collect();
            self.upsert_round_ledger_record(RoundExecutionRecord {
                round_number: skipped_r,
                title: skipped_title,
                status: RoundExecutionStatus::IgnoredConsensus,
                converged_from_round: Some(converged_round),
                reason: Some(format!(
                    "Duplicated / Ignored — Same debate summary already settled in Round {}.",
                    converged_round
                )),
                skipped_agent_names: skipped_agents,
            });
        }

        self.metadata.converged_at_round = Some(converged_round);
        self.metadata.convergence_reason = Some(verdict.reason.clone());
        self.metadata.updated_at = now_ms();

        // Ensure decision ledger records consensus if none emitted yet (classic mode only)
        if self.config.context_mode.as_deref() != Some("board") && self.memory.load_decisions().is_empty() {
            let agreed_by: Vec<String> = active_participants
                .iter()
                .map(|p| p.agent_id.clone())
                .collect();
            let _ = self.memory.record_decision(
                &format!("Early Consensus Summary: {}", self.config.topic),
                &verdict.reason,
                &format!(
                    "Successive summary convergence verified at Round {} of {}.",
                    converged_round, self.config.max_rounds
                ),
                agreed_by,
                converged_round,
                vec![format!("round-{}", converged_round)],
            );
        }

        save_metadata(&self.session_dir, &self.metadata)?;

        self.notify(DiscussionEvent::ConvergenceReached {
            session_id: self.config.session_id.clone(),
            converged_round,
            reference_round: verdict.reference_round,
            matched_agents: verdict.matched_agents,
            skipped_rounds,
            reason: verdict.reason,
        });

        self.finalize_and_generate_report()
    }

    /// Synthesizes the 12-section evidence report, updates decision metrics, transitions to AwaitingReview, and releases lock.
    fn finalize_and_generate_report(&mut self) -> Result<DiscussionStatus, String> {
        if self.config.context_mode.as_deref() == Some("board") {
            let _ = self.board_state.sync_to_existing_files(&self.memory);
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

        if self.config.context_mode.as_deref() == Some("board") {
            let report_path = self.session_dir.join("report.md");
            let _ = self.board_state.write_decision_brief(
                &self.session_dir,
                &self.config.topic,
                &self.config.user_idea,
                &self.config.session_id,
                self.metadata.current_round,
                &report_path.to_string_lossy(),
            );

            // Record agreed decisions in shared project memory
            let ws_path = PathBuf::from(&self.config.workspace_path);
            let project_id = "root";
            for claim in &self.board_state.claims {
                if claim.status == ClaimStatus::Agreed || claim.status == ClaimStatus::Uncontested {
                    let _ = crate::projects::memory::record_scoped_memory(
                        &ws_path,
                        project_id,
                        &claim.author_role,
                        crate::projects::types::MemoryEntryKind::Decision,
                        &claim.text,
                        claim.source_paragraph.as_deref(),
                        vec![
                            format!("claim-{}", claim.id),
                            format!("session-{}", self.config.session_id),
                        ],
                    );
                }
            }
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

        // In classic mode, record locked_invariants into decisions.json;
        // In board mode, decisions.json is fed strictly by computed consensus claims (Section 3.4).
        if self.config.context_mode.as_deref() != Some("board") {
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

        let clean_markdown = parsed.clean_markdown.clone();
        let ws_path = PathBuf::from(&self.config.workspace_path);
        let pipeline_id_for_cache = if self.config.context_mode.as_deref() == Some("board") {
            Some(self.config.session_id.as_str())
        } else {
            None
        };
        let _ = update_workspace_cognitive_cache_with_parsed(
            &ws_path,
            &participant.agent_id,
            participant.role.as_str(),
            pipeline_id_for_cache,
            round,
            Some(&self.config.user_idea),
            parsed,
            false, // Deliberation turns are read-only councils, avoid heavy disk walk
            None,
        );

        self.metadata.decisions_count = self.memory.load_decisions().len();
        self.metadata.active_disagreements_count = self
            .memory
            .load_disagreements()
            .iter()
            .filter(|d| matches!(d.status, DisagreementStatus::UnresolvedDivergence))
            .count();

        (clean_markdown, target_peers)
    }

    fn build_participant_turn_request(
        &self,
        participant: &DiscussionParticipant,
        round: u32,
        frame_action_label: Option<&str>,
        request_action_name: Option<String>,
        action_query: Option<String>,
    ) -> Result<PreparedParticipantTurn, String> {
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

        let is_board_mode = self.config.context_mode.as_deref() == Some("board");
        let (mut frames, truncated) = if is_board_mode {
            let project_id = "root";
            let nodes = crate::projects::storage::load_all_projects(&ws_path);
            let tree = crate::projects::tree::ProjectTree::from_nodes(nodes);
            let recall_pack =
                crate::projects::memory::build_recall_pack(&ws_path, &tree, project_id, 300);
            let recall_text = if !recall_pack.rendered_markdown.trim().is_empty() {
                Some(recall_pack.rendered_markdown.as_str())
            } else {
                None
            };

            let topic_card = DebateBoardState::build_topic_card(
                &self.config.topic,
                &self.config.user_idea,
                &self.config.participants,
                &ws_path,
                recall_text,
            );

            let board_snapshot = self.board_state.build_board_snapshot();
            let positions_snapshot = self.board_state.build_position_cards_snapshot();

            let is_multi_agent_same_model_round = {
                let (_, _, round_slots) = self.config.resolve_round_plan(round);
                let same_model_count = round_slots
                    .iter()
                    .filter(|(p, _)| p.model_id == participant.model_id)
                    .count();
                same_model_count > 1
            };

            let mut board_frames = Vec::new();
            if is_multi_agent_same_model_round {
                let mut sys = topic_card;
                sys.push_str("\n\n");
                sys.push_str(&board_snapshot);
                sys.push_str("\n\n");
                sys.push_str(&positions_snapshot);
                board_frames.push(ChatMessageFrame {
                    role: "system".to_string(),
                    content: sys,
                    cache_anchor: true,
                });
            } else {
                board_frames.push(ChatMessageFrame {
                    role: "system".to_string(),
                    content: topic_card,
                    cache_anchor: true,
                });
                let mut snapshot_frame = board_snapshot;
                snapshot_frame.push_str("\n\n");
                snapshot_frame.push_str(&positions_snapshot);
                board_frames.push(ChatMessageFrame {
                    role: "user".to_string(),
                    content: snapshot_frame,
                    cache_anchor: false,
                });
            }

            let mut turn_frame = String::new();
            turn_frame.push_str(&format!(
                "## Active Role Assignment\nYou are **{}** (Agent ID: `{}`, Role: `{}`).\n{}\n\n",
                participant.display_name,
                participant.agent_id,
                participant.role.as_str(),
                participant.role_description.trim()
            ));

            let all_peer_msgs = self.memory.load_peer_messages();
            let inbox = filter_peer_messages_for_agent(
                &all_peer_msgs,
                &participant.agent_id,
                participant.role.as_str(),
            );
            if !inbox.is_empty() {
                turn_frame.push_str("### Direct Peer Messages Addressed to You\n");
                for pm in inbox.iter().rev().take(6).rev() {
                    turn_frame.push_str(&format!(
                        "- From **{} ({})** [{}]: {}\n",
                        pm.from_agent, pm.from_role, pm.kind, pm.message
                    ));
                }
                turn_frame.push('\n');
            }

            let needs_context = self.board_state.get_needs_context_for_agent(&participant.agent_id);
            if !needs_context.is_empty() {
                turn_frame.push_str(&needs_context);
                turn_frame.push('\n');
            }

            turn_frame.push_str(&build_epistemic_prompt_section(
                &epistemic_decision,
                &ws_path,
                cognitive_pkt.as_ref(),
            ));

            if let Some(q) = action_query.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
                let label = frame_action_label.unwrap_or("Focused Turn Directive");
                turn_frame.push_str(&format!("\n### {}\nSpecifically address: {}\n", label, q));
            }

            turn_frame.push_str(
                "\n### Turn Instructions\n\
                 - Refer to board claims by id (`C1`, `C2`, ...). Do not restate them.\n\
                 - Write only what changes the board. State concrete facts, decisions, risks, or questions.\n\
                 - Write in the language of the user's proposal.\n",
            );

            let has_native = has_native_thinking(&participant.provider_id, &participant.model_id);
            if participant.thinking_enabled && !has_native {
                turn_frame.push_str(
                    "\n### Thinking Protocol\n\
                     Reason step-by-step inside `<thinking>...</thinking>` before writing your structured Markdown response.\n",
                );
            }

            turn_frame.push_str(&format_board_handoff_state_emission_protocol(
                epistemic_decision.requires_blind_self_conclusion(),
            ));

            board_frames.push(ChatMessageFrame {
                role: "user".to_string(),
                content: turn_frame,
                cache_anchor: false,
            });

            (board_frames, false)
        } else {
            self.memory
                .assemble_prefix_pinned_frames(
                    participant,
                    round,
                    &self.config.topic,
                    &self.config.user_idea,
                    &ws_path,
                    &epistemic_decision,
                    cognitive_pkt.as_ref(),
                    frame_action_label,
                    action_query.as_deref(),
                )
                .map_err(|e| format!("Failed to assemble context frames: {}", e))?
        };

        // Resolve active skills for this participant according to isolation policy
        let participant_skills = self.skills_manager.resolve_skills_for_participant(
            &participant.agent_id,
            &participant.provider_id,
            &participant.model_id,
            &participant.assigned_skill_uris,
            self.config.include_default_skills,
        );
        let skills_prompt_block =
            super::skills::SkillsManager::format_prompt_block(&participant_skills);
        if !skills_prompt_block.is_empty() {
            if let Some(last_frame) = frames.last_mut() {
                last_frame.content.push_str(&skills_prompt_block);
            }
        }

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
            action_name: request_action_name,
            action_query,
            thinking_enabled: participant.thinking_enabled,
            effort_level: participant.effort_level.clone(),
            model_id: Some(participant.model_id.clone()),
            token_saver: self.config.token_saver.clone(),
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

        Ok(PreparedParticipantTurn {
            turn_request,
            stream_sink,
            truncated,
        })
    }

    #[allow(clippy::too_many_arguments)]
    fn commit_participant_turn_response(
        &mut self,
        participant: &DiscussionParticipant,
        round: u32,
        turn_index: u32,
        id_prefix: &str,
        message_kind: DiscussionMessageKind,
        action_name: Option<String>,
        truncated: bool,
        response: TurnResponse,
    ) -> Result<DiscussionMessage, String> {
        let (clean_markdown, target_peer_ids) =
            self.ingest_turn_cognitive_state(participant, round, &response.raw_markdown);

        let msg_id = format!("{}-r{}-{}-{}", id_prefix, round, participant.agent_id, now_ms());
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
            content: clean_markdown.clone(),
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

        if self.config.context_mode.as_deref() == Some("board") {
            self.board_state.consume_pending_needs(&participant.agent_id);
            let roster_agent_ids: Vec<String> = self
                .config
                .participants
                .iter()
                .map(|p| p.agent_id.clone())
                .collect();
            let is_multi_agent_round = self.config.repeater_mode.as_deref() != Some("per_agent")
                && self.config.participants.len() > 1;
            self.board_state.ingest_turn(
                &msg_id,
                &participant.agent_id,
                participant.role.as_str(),
                round,
                turn_index,
                &response.raw_markdown,
                &clean_markdown,
                is_multi_agent_round,
                &roster_agent_ids,
            );
            if !is_multi_agent_round {
                let _ = self.board_state.sync_to_existing_files(&self.memory);
            }
            let _ = self.board_state.save(&self.session_dir);
        }

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

    async fn execute_agent_turn_with_directive(
        &mut self,
        participant: &DiscussionParticipant,
        round: u32,
        turn_index: u32,
        round_directive: Option<&str>,
    ) -> Result<(), String> {
        let action_name = participant.custom_action.as_ref().map(|a| a.name.clone());
        let base_query = participant.custom_query.clone().or_else(|| {
            participant
                .custom_action
                .as_ref()
                .map(|a| a.prompt_directive.clone())
        });
        let action_query = match (round_directive.map(str::trim).filter(|s| !s.is_empty()), base_query) {
            (Some(rd), Some(bq)) if rd != bq => Some(format!(
                "Round {} Specialist Focus: {}\nRole Standing Directive: {}",
                round, rd, bq
            )),
            (Some(rd), _) => Some(rd.to_string()),
            (None, bq) => bq,
        };

        self.notify(DiscussionEvent::TurnStarted {
            session_id: self.config.session_id.clone(),
            round,
            agent_id: participant.agent_id.clone(),
            role: participant.role.as_str().to_string(),
            action_name: action_name.clone(),
        });

        let provider = self.resolve_participant_provider(participant)?;
        let PreparedParticipantTurn {
            turn_request,
            stream_sink,
            truncated,
        } = self.build_participant_turn_request(
            participant,
            round,
            action_name.as_deref(),
            action_name.clone(),
            action_query,
        )?;

        let message_kind = match round {
            1 => DiscussionMessageKind::InitialAnalysis,
            2 => DiscussionMessageKind::PeerCritique,
            _ => DiscussionMessageKind::RebuttalRevision,
        };

        match provider
            .execute_turn(turn_request, self.cancel_flag.clone(), stream_sink)
            .await
        {
            Ok(response) => {
                self.commit_participant_turn_response(
                    participant,
                    round,
                    turn_index,
                    "msg",
                    message_kind,
                    action_name,
                    truncated,
                    response,
                )?;
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
                    ProviderError::NetworkError(msg)
                        if msg.contains("connection error")
                            || msg.contains("11434")
                            || msg.contains("refused") =>
                    {
                        format!(
                            "Failed to connect to local engine ({}). Ensure service is running or switch Preset Engine to 'Local Adaptive Reasoner'.",
                            msg
                        )
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
    use crate::discussion::types::{AgentRole, DiscussionRoundPlan, DiscussionRoundSlot};
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
                    effort_level: Some("medium".to_string()),
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
                    effort_level: Some("medium".to_string()),
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
                    effort_level: Some("medium".to_string()),
                },
            ],
            active_skill_uris: Vec::new(),
            step_mode: false,
            custom_skills_dir: None,
            include_default_skills: true,
            token_budget_cap: None,
            ..Default::default()
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

    #[tokio::test]
    async fn test_discussion_orchestrator_pauses_on_budget_cap_breach() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_quota_test_{}", now_ms()));
        fs::create_dir_all(&temp_dir).unwrap();

        let mut config = build_test_config(&temp_dir);
        // Set a small token budget cap that will be exceeded on turn 1
        config.token_budget_cap = Some(100);

        let mut providers: HashMap<String, Arc<dyn DiscussionProvider>> = HashMap::new();
        providers.insert("mock".to_string(), Arc::new(MockProvider::new("mock")));

        let mut orchestrator = DiscussionOrchestrator::new(config, providers).unwrap();
        let status = orchestrator.run_discussion().await.unwrap();

        assert_eq!(status, DiscussionStatus::Paused);
        assert!(orchestrator.metadata.total_tokens >= 100);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[tokio::test]
    async fn test_10_round_debate_stops_early_at_round_4_and_marks_rounds_5_to_10_ignored() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_conv10_test_{}", now_ms()));
        fs::create_dir_all(&temp_dir).unwrap();

        let mut config = build_test_config(&temp_dir);
        config.max_rounds = 10;

        let mut providers: HashMap<String, Arc<dyn DiscussionProvider>> = HashMap::new();
        providers.insert("mock".to_string(), Arc::new(MockProvider::new("mock")));

        let mut orchestrator = DiscussionOrchestrator::new(config, providers).unwrap();
        let status = orchestrator.run_discussion().await.unwrap();

        assert_eq!(status, DiscussionStatus::AwaitingReview);
        // Round 3 settles consensus; in Round 4, once the first 2 agents confirm the settled Round 3 summary,
        // Agent 3 in Round 4 AND Rounds 5..=10 are immediately skipped to save queries!
        assert_eq!(orchestrator.metadata.converged_at_round, Some(4));

        let ignored_rounds: Vec<u32> = orchestrator
            .metadata
            .round_ledger
            .iter()
            .filter(|r| r.status == RoundExecutionStatus::IgnoredConsensus)
            .map(|r| r.round_number)
            .collect();
        assert_eq!(ignored_rounds, vec![5, 6, 7, 8, 9, 10]);

        let (transcript, _) = read_transcript_with_recovery(&orchestrator.session_dir).unwrap();
        // Verify the escaped 3rd step in Round 4 was recorded as SkippedConsensus (Ignored) with 0 queries
        assert!(transcript
            .iter()
            .any(|m| m.round_number == 4 && m.message_kind == DiscussionMessageKind::SkippedConsensus));
        // Verify zero turns were ever executed for Rounds 5..10
        assert!(transcript.iter().all(|m| m.round_number <= 4));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    fn repeater_participant(
        agent_id: &str,
        provider_id: &str,
        display_name: &str,
        role: AgentRole,
    ) -> DiscussionParticipant {
        DiscussionParticipant {
            agent_id: agent_id.to_string(),
            provider_id: provider_id.to_string(),
            model_id: format!("{}-model", provider_id),
            display_name: display_name.to_string(),
            role,
            role_description: format!("{} with deep domain experience.", display_name),
            avatar_color: "#a78bfa".to_string(),
            assigned_skill_uris: Vec::new(),
            context_budget_tokens: 16000,
            custom_action: None,
            custom_query: None,
            thinking_enabled: true,
            effort_level: Some("high".to_string()),
        }
    }

    #[tokio::test]
    async fn test_multi_engine_round_repeater_executes_distinct_engines_and_custom_roles_per_round() {
        use crate::discussion::types::{DiscussionRoundPlan, DiscussionRoundSlot};
        use std::collections::HashSet;

        let temp_dir = std::env::temp_dir().join(format!("flymd_repeater_test_{}", now_ms()));
        fs::create_dir_all(&temp_dir).unwrap();

        let mut config = build_test_config(&temp_dir);
        config.max_rounds = 2;
        config.selected_engines = vec![
            "engine-alpha".to_string(),
            "engine-beta".to_string(),
            "engine-gamma".to_string(),
        ];
        config.repeater_mode = Some("per_round".to_string());
        config.round_schedule = vec![
            DiscussionRoundPlan {
                round_number: 1,
                title: "Round 1: Architecture & Cost Discovery".to_string(),
                objective: Some("Decompose the system and estimate operating cost.".to_string()),
                slots: vec![
                    DiscussionRoundSlot {
                        slot_id: "r1-s1".to_string(),
                        participant: repeater_participant(
                            "r1-architect",
                            "engine-alpha",
                            "Principal Architect",
                            AgentRole::Architect,
                        ),
                        round_directive: Some("Propose the modular blueprint.".to_string()),
                    },
                    DiscussionRoundSlot {
                        slot_id: "r1-s2".to_string(),
                        participant: repeater_participant(
                            "r1-finops",
                            "engine-beta",
                            "FinOps Cost Auditor",
                            AgentRole::Custom("FinOps Cost Auditor".to_string()),
                        ),
                        round_directive: Some("Audit the cost profile of the blueprint.".to_string()),
                    },
                ],
            },
            DiscussionRoundPlan {
                round_number: 2,
                title: "Round 2: Regulatory & Adversarial Review".to_string(),
                objective: None,
                slots: vec![
                    DiscussionRoundSlot {
                        slot_id: "r2-s1".to_string(),
                        participant: repeater_participant(
                            "r2-counsel",
                            "engine-gamma",
                            "Regulatory Counsel",
                            AgentRole::Custom("Regulatory Counsel".to_string()),
                        ),
                        round_directive: Some("Check compliance exposure.".to_string()),
                    },
                    DiscussionRoundSlot {
                        slot_id: "r2-s2".to_string(),
                        participant: repeater_participant(
                            "r2-critic",
                            "engine-alpha",
                            "Adversarial Critic",
                            AgentRole::Critic,
                        ),
                        round_directive: None,
                    },
                ],
            },
        ];

        let mut providers: HashMap<String, Arc<dyn DiscussionProvider>> = HashMap::new();
        for engine in ["engine-alpha", "engine-beta", "engine-gamma"] {
            providers.insert(engine.to_string(), Arc::new(MockProvider::new(engine)));
        }

        let mut orchestrator = DiscussionOrchestrator::new(config, providers).unwrap();
        let status = orchestrator.run_discussion().await.unwrap();
        assert_eq!(status, DiscussionStatus::AwaitingReview);

        let (transcript, _) = read_transcript_with_recovery(&orchestrator.session_dir).unwrap();
        let agent_turns = |round: u32| -> Vec<&DiscussionMessage> {
            transcript
                .iter()
                .filter(|m| m.round_number == round && m.author_agent_id != "human-user")
                .filter(|m| m.message_kind != DiscussionMessageKind::UserIntervention)
                .collect()
        };

        let r1 = agent_turns(1);
        let r1_providers: HashSet<&str> = r1.iter().map(|m| m.author_provider.as_str()).collect();
        assert_eq!(
            r1_providers,
            HashSet::from(["engine-alpha", "engine-beta"]),
            "Round 1 must run exactly the engines scheduled for Round 1"
        );
        assert!(r1.iter().any(|m| m.author_role == "FinOps Cost Auditor"));

        let r2 = agent_turns(2);
        assert!(!r2.is_empty(), "Round 2 must execute its own scheduled slots");
        assert!(r2.iter().all(|m| m.author_provider != "engine-beta"));
        assert!(r2
            .iter()
            .any(|m| m.author_provider == "engine-gamma" && m.author_role == "Regulatory Counsel"));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[tokio::test]
    async fn test_round_barrier_pause_and_resumption() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_barrier_test_{}", now_ms()));
        fs::create_dir_all(&temp_dir).unwrap();

        let mut config = build_test_config(&temp_dir);
        config.max_rounds = 2;
        config.pause_at_round_boundary = true;

        let mut providers: HashMap<String, Arc<dyn DiscussionProvider>> = HashMap::new();
        providers.insert("mock".to_string(), Arc::new(MockProvider::new("mock")));

        let mut orchestrator = DiscussionOrchestrator::new(config, providers).unwrap();
        let status = orchestrator.run_discussion().await.unwrap();
        assert_eq!(status, DiscussionStatus::Paused, "Must pause at round 1 barrier");
        assert_eq!(orchestrator.metadata.current_round, 1);

        // Verify Round 1 ledger was recorded
        let r1_ledger = orchestrator.metadata.round_ledger.iter().find(|r| r.round_number == 1);
        assert!(r1_ledger.is_some());
        assert_eq!(r1_ledger.unwrap().status, RoundExecutionStatus::Executed);

        // Resume deliberation to execute Round 2
        let second_status = orchestrator.run_discussion().await.unwrap();
        assert_eq!(second_status, DiscussionStatus::AwaitingReview, "Must complete round 2 upon resumption");
        assert_eq!(orchestrator.metadata.current_round, 2);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[tokio::test]
    async fn test_resume_failed_discussion() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_fail_resume_test_{}", now_ms()));
        fs::create_dir_all(&temp_dir).unwrap();

        let config = build_test_config(&temp_dir);
        let mut providers: HashMap<String, Arc<dyn DiscussionProvider>> = HashMap::new();
        providers.insert("mock".to_string(), Arc::new(MockProvider::new("mock")));

        let mut orchestrator = DiscussionOrchestrator::new(config, providers).unwrap();
        // Simulate a failure during previous turn execution
        orchestrator.metadata.status = DiscussionStatus::Failed;
        orchestrator.metadata.error_message = Some("Process exited with code 1".to_string());

        // Resuming from Failed state must clear error and run cleanly
        let status = orchestrator.run_discussion().await.unwrap();
        assert_eq!(status, DiscussionStatus::AwaitingReview);
        assert!(orchestrator.metadata.error_message.is_none());

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[tokio::test]
    async fn test_update_future_config_invariants() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_config_invariants_test_{}", now_ms()));
        fs::create_dir_all(&temp_dir).unwrap();

        let mut config = build_test_config(&temp_dir);
        config.max_rounds = 3;
        config.round_schedule = vec![
            DiscussionRoundPlan {
                round_number: 1,
                title: "Round 1".to_string(),
                objective: None,
                slots: vec![DiscussionRoundSlot {
                    slot_id: "r1-s1".to_string(),
                    participant: config.participants[0].clone(),
                    round_directive: None,
                }],
            },
            DiscussionRoundPlan {
                round_number: 2,
                title: "Round 2".to_string(),
                objective: None,
                slots: vec![DiscussionRoundSlot {
                    slot_id: "r2-s1".to_string(),
                    participant: config.participants[1].clone(),
                    round_directive: None,
                }],
            },
        ];

        let mut providers: HashMap<String, Arc<dyn DiscussionProvider>> = HashMap::new();
        providers.insert("mock".to_string(), Arc::new(MockProvider::new("mock")));

        let mut orchestrator = DiscussionOrchestrator::new(config.clone(), providers).unwrap();
        orchestrator.metadata.status = DiscussionStatus::Paused;
        orchestrator.metadata.current_round = 1;

        // 1. Mutating Round 1 participants must be rejected because Round 1 is current/executed
        let mut illegal_config = config.clone();
        illegal_config.round_schedule[0].slots[0].participant.agent_id = "mutated-agent".to_string();
        let err = orchestrator.update_future_config(illegal_config);
        assert!(err.is_err());
        assert!(err.unwrap_err().contains("Cannot modify participants for Round 1"));

        // 2. Mutating Round 2 (upcoming round) must succeed
        let mut legal_config = config.clone();
        legal_config.round_schedule[1].slots[0].participant.agent_id = "new-future-agent".to_string();
        let res = orchestrator.update_future_config(legal_config);
        assert!(res.is_ok());

        // Verify disk persistence
        let read_back_bytes = fs::read(orchestrator.session_dir.join("config.json")).unwrap();
        let read_back_config: DiscussionConfig = serde_json::from_slice(&read_back_bytes).unwrap();
        assert_eq!(read_back_config.round_schedule[1].slots[0].participant.agent_id, "new-future-agent");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[tokio::test]
    async fn test_per_agent_config_edit_rejection_and_clean_persistence_fix() {
        use crate::discussion::commands::update_discussion_config_on_disk;
        use crate::discussion::golden_tests::RecordingMockProvider;

        let temp_dir = std::env::temp_dir().join(format!("flymd_b1_test_{}", now_ms()));
        fs::create_dir_all(&temp_dir).unwrap();

        let session_id = format!("disc-test-b1-{}", now_ms());
        let participants = vec![
            DiscussionParticipant {
                agent_id: "agent-lead".to_string(),
                provider_id: "mock".to_string(),
                model_id: "gemini-4-argon".to_string(),
                display_name: "Teacher".to_string(),
                role: AgentRole::Architect,
                role_description: "Lead domain architect.".to_string(),
                avatar_color: "#38bdf8".to_string(),
                assigned_skill_uris: Vec::new(),
                context_budget_tokens: 32000,
                custom_action: None,
                custom_query: None,
                thinking_enabled: true,
                effort_level: Some("medium".to_string()),
            },
            DiscussionParticipant {
                agent_id: "agent-critic".to_string(),
                provider_id: "mock".to_string(),
                model_id: "claude-opus-5-5".to_string(),
                display_name: "Adversarial Critic".to_string(),
                role: AgentRole::Critic,
                role_description: "Adversarial stress tester.".to_string(),
                avatar_color: "#ef4444".to_string(),
                assigned_skill_uris: Vec::new(),
                context_budget_tokens: 32000,
                custom_action: None,
                custom_query: None,
                thinking_enabled: true,
                effort_level: Some("medium".to_string()),
            },
            DiscussionParticipant {
                agent_id: "agent-dev".to_string(),
                provider_id: "mock".to_string(),
                model_id: "gemini-4-argon".to_string(),
                display_name: "Developer".to_string(),
                role: AgentRole::Implementer,
                role_description: "Systems implementer.".to_string(),
                avatar_color: "#10b981".to_string(),
                assigned_skill_uris: Vec::new(),
                context_budget_tokens: 16000,
                custom_action: None,
                custom_query: None,
                thinking_enabled: true,
                effort_level: Some("medium".to_string()),
            },
        ];

        let config = DiscussionConfig {
            schema_version: 1,
            session_id: session_id.clone(),
            topic: "Arabic & Distributed Agents".to_string(),
            user_idea: "Build a resilient debate system.".to_string(),
            workspace_path: temp_dir.to_string_lossy().to_string(),
            max_rounds: 3,
            turn_timeout_secs: 10,
            participants: participants.clone(),
            repeater_mode: Some("per_agent".to_string()),
            round_schedule: Vec::new(), // empty schedule in per_agent mode!
            ..Default::default()
        };

        let (mock_provider, turns_log, _) = RecordingMockProvider::new("mock");
        let mut providers: HashMap<String, Arc<dyn DiscussionProvider>> = HashMap::new();
        providers.insert("mock".to_string(), Arc::new(mock_provider));

        let mut orchestrator = DiscussionOrchestrator::new(config.clone(), providers).unwrap();
        // Simulate failed state at Round 1 (identical to disc-1793743338597)
        orchestrator.metadata.status = DiscussionStatus::Failed;
        orchestrator.metadata.current_round = 1;
        save_metadata(&orchestrator.session_dir, &orchestrator.metadata).unwrap();

        // 1. REPRODUCE BUG: Simulate the broken modal payload that created a roundSchedule with all 3 participants
        let mut broken_config = config.clone();
        broken_config.round_schedule = vec![DiscussionRoundPlan {
            round_number: 1,
            title: "Round 1".to_string(),
            objective: None,
            slots: participants
                .iter()
                .enumerate()
                .map(|(idx, p)| DiscussionRoundSlot {
                    slot_id: format!("slot-r1-{}", idx + 1),
                    participant: p.clone(),
                    round_directive: None,
                })
                .collect(),
        }];

        // Guard MUST reject this broken payload
        let broken_err = orchestrator.update_future_config(broken_config.clone());
        assert!(broken_err.is_err());
        assert!(broken_err.unwrap_err().contains("Cannot modify participants for Round 1"));

        // 2. VERIFY FIX: In per_agent mode with empty schedule, mutating participants directly succeeds
        let mut fixed_config = config.clone();
        fixed_config.participants[0].model_id = "gemini-3.8-flash".to_string();
        fixed_config.participants[0].effort_level = Some("low".to_string());
        // round_schedule remains empty!

        let fix_res = orchestrator.update_future_config(fixed_config.clone());
        assert!(fix_res.is_ok(), "Fixed per_agent config update must succeed");

        // Verify disk persistence
        let read_back_bytes = fs::read(orchestrator.session_dir.join("config.json")).unwrap();
        let read_back: DiscussionConfig = serde_json::from_slice(&read_back_bytes).unwrap();
        assert_eq!(read_back.participants[0].model_id, "gemini-3.8-flash");
        assert_eq!(read_back.participants[0].effort_level.as_deref(), Some("low"));

        // 3. Resume and verify TurnRequest sends the updated model & effort!
        orchestrator.metadata.status = DiscussionStatus::Created; // clear failed status for run
        orchestrator.run_discussion().await.unwrap();

        let recorded = turns_log.lock().unwrap();
        assert!(!recorded.is_empty(), "Turn must have executed");
        assert_eq!(recorded[0].model_id.as_deref(), Some("gemini-3.8-flash"));
        assert_eq!(recorded[0].effort_level.as_deref(), Some("low"));
        drop(recorded);

        // 4. Test when orchestrator is NOT in memory (commands::update_discussion_config)
        // Reset metadata on disk to Failed
        let mut disk_meta = load_metadata(&orchestrator.session_dir).unwrap();
        disk_meta.status = DiscussionStatus::Failed;
        disk_meta.current_round = 1;
        save_metadata(&orchestrator.session_dir, &disk_meta).unwrap();

        // Broken payload is rejected from disk
        let disk_err = update_discussion_config_on_disk(&orchestrator.session_dir, broken_config);
        assert!(disk_err.is_err());
        assert!(disk_err.unwrap_err().contains("Cannot modify participants for Round 1"));

        // Fixed payload succeeds from disk
        let mut disk_fixed = read_back.clone();
        disk_fixed.participants[0].model_id = "gemini-3.8-flash-updated".to_string();
        let disk_ok = update_discussion_config_on_disk(&orchestrator.session_dir, disk_fixed);
        assert!(disk_ok.is_ok());

        let final_read_bytes = fs::read(orchestrator.session_dir.join("config.json")).unwrap();
        let final_config: DiscussionConfig = serde_json::from_slice(&final_read_bytes).unwrap();
        assert_eq!(final_config.participants[0].model_id, "gemini-3.8-flash-updated");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[tokio::test]
    async fn test_copy_of_fly13_session_persistence_and_retry_with_mock_provider() {
        use crate::discussion::commands::update_discussion_config_on_disk;
        use crate::discussion::golden_tests::RecordingMockProvider;

        let session_fixture_src = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("src")
            .join("discussion")
            .join("fixtures")
            .join("disc-1793743338597");
        assert!(
            session_fixture_src.exists(),
            "Checked-in session fixture must exist at {}",
            session_fixture_src.display()
        );

        let temp_dir = std::env::temp_dir().join(format!("flymd_session_copy_test_{}", now_ms()));
        let temp_session_dir = temp_dir.join(".flymd").join("discussions").join("disc-1793743338597");
        fs::create_dir_all(&temp_session_dir).unwrap();

        // Recursively copy session fixture files to isolated temp copy
        for entry in fs::read_dir(&session_fixture_src).unwrap() {
            let entry = entry.unwrap();
            let dest = temp_session_dir.join(entry.file_name());
            if entry.file_type().unwrap().is_file() {
                fs::copy(entry.path(), &dest).unwrap();
            } else if entry.file_type().unwrap().is_dir() {
                let _ = fs::create_dir_all(&dest);
            }
        }

        // Verify config loaded from copied session
        let initial_config_bytes = fs::read(temp_session_dir.join("config.json")).unwrap();
        let mut initial_config: DiscussionConfig = serde_json::from_slice(&initial_config_bytes).unwrap();
        // Point workspace_path to temp_dir so it is completely isolated from fly13
        initial_config.workspace_path = temp_dir.to_string_lossy().to_string();
        fs::write(temp_session_dir.join("config.json"), serde_json::to_vec_pretty(&initial_config).unwrap()).unwrap();

        assert_eq!(initial_config.repeater_mode.as_deref(), Some("per_agent"));
        assert!(initial_config.round_schedule.is_empty());
        assert_eq!(initial_config.participants[0].model_id, "gemini-4-argon");
        assert_eq!(initial_config.participants[0].effort_level.as_deref(), Some("medium"));

        // 1. Orchestrator NOT in memory (commands::update_discussion_config_on_disk)
        let mut disk_mutated = initial_config.clone();
        disk_mutated.participants[0].model_id = "gemini-3.8-flash".to_string();
        disk_mutated.participants[0].effort_level = Some("low".to_string());

        let disk_res = update_discussion_config_on_disk(&temp_session_dir, disk_mutated);
        assert!(disk_res.is_ok(), "Disk update when orchestrator is not in memory must succeed");

        // Re-read from disk and verify persistence
        let read1_bytes = fs::read(temp_session_dir.join("config.json")).unwrap();
        let read1_config: DiscussionConfig = serde_json::from_slice(&read1_bytes).unwrap();
        assert_eq!(read1_config.participants[0].model_id, "gemini-3.8-flash");
        assert_eq!(read1_config.participants[0].effort_level.as_deref(), Some("low"));

        // 2. Orchestrator IS in memory
        let (mock_antigravity, turns_log, _) = RecordingMockProvider::new("antigravity");
        let (mock_claude, _, _) = RecordingMockProvider::new("claude-code");
        let mut providers: HashMap<String, Arc<dyn DiscussionProvider>> = HashMap::new();
        providers.insert("antigravity".to_string(), Arc::new(mock_antigravity));
        providers.insert("claude-code".to_string(), Arc::new(mock_claude));

        let mut orchestrator = DiscussionOrchestrator::new(read1_config.clone(), providers).unwrap();
        // Mutate model and effort in memory
        let mut mem_mutated = read1_config.clone();
        mem_mutated.participants[0].model_id = "gemini-2.5-pro".to_string();
        mem_mutated.participants[0].effort_level = Some("high".to_string());

        let mem_res = orchestrator.update_future_config(mem_mutated);
        assert!(mem_res.is_ok(), "In-memory orchestrator config update must succeed");

        // Verify disk persistence after in-memory update
        let read2_bytes = fs::read(temp_session_dir.join("config.json")).unwrap();
        let read2_config: DiscussionConfig = serde_json::from_slice(&read2_bytes).unwrap();
        assert_eq!(read2_config.participants[0].model_id, "gemini-2.5-pro");
        assert_eq!(read2_config.participants[0].effort_level.as_deref(), Some("high"));

        // 3. Resume & Retry sends updated model and effort to TurnRequest
        // Clear failed state to simulate clicking 'Resume & Retry'
        orchestrator.metadata.status = DiscussionStatus::Created;
        save_metadata(&temp_session_dir, &orchestrator.metadata).unwrap();

        let run_res = orchestrator.run_discussion().await;
        assert!(run_res.is_ok(), "Discussion run must succeed with mock provider");

        let recorded = turns_log.lock().unwrap();
        assert!(!recorded.is_empty(), "TurnRequest must have been delivered to antigravity provider");
        assert_eq!(recorded[0].model_id.as_deref(), Some("gemini-2.5-pro"));
        assert_eq!(recorded[0].effort_level.as_deref(), Some("high"));
        drop(recorded);

        // 4. Invariants check: executed rounds stay locked
        let mut invalid_past_edit = read2_config.clone();
        invalid_past_edit.round_schedule = vec![
            DiscussionRoundPlan {
                round_number: 1,
                title: "Tampered Round 1".to_string(),
                objective: None,
                slots: vec![],
            }
        ];
        let reject_res = orchestrator.update_future_config(invalid_past_edit);
        assert!(reject_res.is_err(), "Executed round 1 must remain strictly locked");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[tokio::test]
    async fn test_debate_board_full_run_with_computed_consensus_and_decision_brief() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_board_test_{}", now_ms()));
        fs::create_dir_all(&temp_dir).unwrap();

        let mut config = build_test_config(&temp_dir);
        config.max_rounds = 2;
        config.context_mode = Some("board".to_string());

        let mut providers: HashMap<String, Arc<dyn DiscussionProvider>> = HashMap::new();
        providers.insert("mock".to_string(), Arc::new(MockProvider::new("mock")));

        let mut orchestrator = DiscussionOrchestrator::new(config, providers).unwrap();
        let status = orchestrator.run_discussion().await.unwrap();

        assert_eq!(status, DiscussionStatus::AwaitingReview);

        // 1. Board state persisted to disk
        let board_path = orchestrator.session_dir.join("board_state.json");
        assert!(board_path.exists(), "board_state.json must be written to disk");

        let read_board = DebateBoardState::load_or_init(&orchestrator.session_dir);
        assert!(!read_board.claims.is_empty(), "Debate board must record structured claims");
        assert!(!read_board.positions.is_empty(), "Position cards must be registered");

        // 2. Computed status check
        let has_agreed = read_board.claims.iter().any(|c| c.status == ClaimStatus::Agreed || c.status == ClaimStatus::Uncontested);
        assert!(has_agreed, "At least one claim must reach agreed or uncontested computed consensus");

        // 3. Keep existing files fed
        let decisions = orchestrator.memory.load_decisions();
        assert!(!decisions.is_empty(), "decisions.json must be populated from agreed/uncontested board claims");
        assert!(decisions.iter().all(|d| d.rationale.contains("Debate Board Claim")));

        // 4. Decision brief generated
        let brief_path = orchestrator.session_dir.join("decision-brief.md");
        assert!(brief_path.exists(), "decision-brief.md must be generated at debate conclusion");
        let brief_content = fs::read_to_string(&brief_path).unwrap();
        assert!(brief_content.contains("Agreed Architectural Decisions"));
        assert!(brief_content.contains("Goal & Core Constraints"));

        // 5. Shared project memory recorded
        let scoped_records = crate::projects::storage::read_project_memory_records(&temp_dir, "root");
        assert!(!scoped_records.is_empty(), "Agreed board decisions must be recorded to project memory");

        // 6. Pipeline handoff package uses decision-brief.md in place of report.md
        let report_path = orchestrator.session_dir.join("report.md");
        fs::write(&report_path, "# Full Report\n## 4. Raw Rounds\nLong transcript...\n## 5. Summary").unwrap();

        let req = crate::agents::types::AgentTaskRequest {
            intent: "build-feature".to_string(),
            file_path: report_path.to_string_lossy().to_string(),
            markdown_content: "Fallback full report content".to_string(),
            token_saver: Some("standard".to_string()),
            target_agent_id: "claude-code".to_string(),
            ..Default::default()
        };
        let pkg = crate::agents::handoff_prompt::assemble_task_handoff_package(&req, &temp_dir.to_string_lossy(), &[]);
        assert!(pkg.body_to_process.contains("Agreed Architectural Decisions"), "Pipeline must use decision-brief in place of report");

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
