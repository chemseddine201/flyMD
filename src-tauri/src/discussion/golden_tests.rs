//! Golden test suite capturing today's baseline behavior (Part A).
//!
//! Asserts byte-identical stability across:
//! - Assembled context frames per turn
//! - CLI arguments per agent and intent
//! - `transcript.jsonl`
//! - Final evidence report markdown
//! - Discussion lifecycle event order
//!
//! Scenarios covered:
//! 1. English per_agent mode
//! 2. Arabic per_agent mode with pause, guidance injection, and failed turn retry
//! 3. English per_round repeater mode with round barrier pause and resumption
//! 4. Arabic 10-round early convergence (halts at round 4, marks 5..10 ignored)
//! 5. CLI arguments generation across agent providers and pipeline intents

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use regex::Regex;
use serde::{Deserialize, Serialize};

use crate::common::time::now_ms;
use crate::discussion::orchestrator::{DiscussionEvent, DiscussionEventListener, DiscussionOrchestrator};
use crate::discussion::runner::{
    ChatMessageFrame, CliProvider, CliType, DiscussionProvider, MockProvider, ProviderError,
    StreamSink, TurnRequest, TurnResponse,
};
use crate::discussion::types::{
    AgentRole, DiscussionConfig, DiscussionParticipant, DiscussionRoundPlan, DiscussionRoundSlot,
    DiscussionStatus,
};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GoldenScenarioData {
    pub scenario_name: String,
    pub frames_per_turn: Vec<Vec<ChatMessageFrame>>,
    pub transcript_lines: Vec<String>,
    pub events: Vec<serde_json::Value>,
    pub final_report: String,
    #[serde(default)]
    pub cli_arguments: Option<Vec<Vec<String>>>,
}

/// Normalizes timestamps, generated IDs, and volatile workspace paths
pub fn normalize_golden_text(input: &str, session_id: &str, workspace: &Path) -> String {
    let ws_str = workspace.to_string_lossy().to_string();
    let ws_escaped = ws_str.replace('\\', "\\\\");
    let ws_fwd = ws_str.replace('\\', "/");

    let mut out = input.to_string();

    out = out.replace(&ws_escaped, "<WORKSPACE>");
    out = out.replace(&ws_str, "<WORKSPACE>");
    out = out.replace(&ws_fwd, "<WORKSPACE>");

    out = out.replace(session_id, "<SESSION_ID>");

    // Message IDs (e.g. msg-1793743338718-4a2e or msg-1793-abc)
    let msg_re = Regex::new(r"msg-[a-zA-Z0-9_\-]+").unwrap();
    out = msg_re.replace_all(&out, "msg-<ID>").to_string();

    // Skip consensus IDs (e.g. skip-r4-agent-implementer-1793743338718)
    let skip_re = Regex::new(r"skip-[a-zA-Z0-9_\-]+").unwrap();
    out = skip_re.replace_all(&out, "skip-<ID>").to_string();

    // Slot IDs (e.g. slot-r1-1)
    let slot_re = Regex::new(r"slot-[a-zA-Z0-9_\-]+").unwrap();
    out = slot_re.replace_all(&out, "slot-<ID>").to_string();

    // 13-digit Unix timestamps (e.g. 1793743338718)
    let ts_re = Regex::new(r"\b1[789]\d{11}\b").unwrap();
    out = ts_re.replace_all(&out, "<TIMESTAMP>").to_string();

    // ISO timestamps (e.g. 2026-11-04T01:30:14.123Z)
    let iso_re = Regex::new(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})").unwrap();
    out = iso_re.replace_all(&out, "<ISO_TIMESTAMP>").to_string();

    // Duration milliseconds (camelCase and snake_case)
    let dur_re = Regex::new(r#""duration(?:Ms|_ms)":\s*\d+"#).unwrap();
    out = dur_re.replace_all(&out, r#""durationMs": 0"#).to_string();

    // Temp directories like flymd_golden_...
    let temp_dir_re = Regex::new(r"flymd_[a-zA-Z0-9_\-]+").unwrap();
    out = temp_dir_re.replace_all(&out, "flymd_<TEMP_DIR>").to_string();

    out
}

pub struct TestEventCollector {
    pub events: Mutex<Vec<DiscussionEvent>>,
}

impl DiscussionEventListener for TestEventCollector {
    fn on_event(&self, event: DiscussionEvent) {
        self.events.lock().unwrap().push(event);
    }
}

pub struct RecordingMockProvider {
    inner: MockProvider,
    pub recorded_turns: Arc<Mutex<Vec<TurnRequest>>>,
    pub fail_next_turn: Arc<AtomicBool>,
}

impl RecordingMockProvider {
    pub fn new(name: &str) -> (Self, Arc<Mutex<Vec<TurnRequest>>>, Arc<AtomicBool>) {
        let recorded = Arc::new(Mutex::new(Vec::new()));
        let fail = Arc::new(AtomicBool::new(false));
        let mut inner = MockProvider::new(name);
        inner.simulated_latency_ms = 0; // zero latency for fast tests
        (
            Self {
                inner,
                recorded_turns: recorded.clone(),
                fail_next_turn: fail.clone(),
            },
            recorded,
            fail,
        )
    }
}

#[async_trait]
impl DiscussionProvider for RecordingMockProvider {
    fn provider_id(&self) -> &str {
        self.inner.provider_id()
    }
    fn context_window_limit(&self) -> u32 {
        self.inner.context_window_limit()
    }
    async fn execute_turn(
        &self,
        request: TurnRequest,
        cancel_flag: Arc<AtomicBool>,
        stream_sink: Option<Box<dyn StreamSink>>,
    ) -> Result<TurnResponse, ProviderError> {
        if self.fail_next_turn.swap(false, Ordering::Relaxed) {
            return Err(ProviderError::ProcessCrashed {
                exit_code: Some(1),
                stderr: "Simulated turn failure for retry recovery golden test".to_string(),
            });
        }
        self.recorded_turns.lock().unwrap().push(request.clone());
        self.inner.execute_turn(request, cancel_flag, stream_sink).await
    }
}

fn fixture_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("src")
        .join("discussion")
        .join("fixtures")
        .join(name)
}

fn assert_or_record_golden(fixture_filename: &str, actual: &GoldenScenarioData) {
    let path = fixture_path(fixture_filename);
    let serialized_actual = serde_json::to_string_pretty(actual).unwrap();

    let record_mode = std::env::var("FLYMD_RECORD_GOLDEN")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    if !path.exists() {
        if !record_mode {
            panic!(
                "Golden fixture '{}' is missing at {}. Set FLYMD_RECORD_GOLDEN=1 to record fixtures explicitly.",
                fixture_filename,
                path.display()
            );
        }
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        fs::write(&path, &serialized_actual).expect("Failed to write initial golden fixture");
        println!("Recorded new golden fixture: {}", path.display());
        return;
    }

    if record_mode {
        fs::write(&path, &serialized_actual).expect("Failed to update golden fixture in record mode");
        println!("Updated golden fixture: {}", path.display());
        return;
    }

    let expected_raw = fs::read_to_string(&path).expect("Failed to read golden fixture");
        let expected: GoldenScenarioData =
            serde_json::from_str(&expected_raw).expect("Failed to deserialize golden fixture");

        assert_eq!(
            actual.scenario_name, expected.scenario_name,
            "Golden scenario name mismatch in {}",
            fixture_filename
        );

        assert_eq!(
            actual.frames_per_turn.len(),
            expected.frames_per_turn.len(),
            "Golden frames count mismatch in {}",
            fixture_filename
        );

        for (t_idx, (act_turn, exp_turn)) in actual
            .frames_per_turn
            .iter()
            .zip(expected.frames_per_turn.iter())
            .enumerate()
        {
            assert_eq!(
                act_turn.len(),
                exp_turn.len(),
                "Turn {} frames count mismatch in {}",
                t_idx,
                fixture_filename
            );
            for (f_idx, (act_f, exp_f)) in act_turn.iter().zip(exp_turn.iter()).enumerate() {
                assert_eq!(
                    act_f.role, exp_f.role,
                    "Turn {} frame {} role mismatch in {}",
                    t_idx, f_idx, fixture_filename
                );
                assert_eq!(
                    act_f.cache_anchor, exp_f.cache_anchor,
                    "Turn {} frame {} cache_anchor mismatch in {}",
                    t_idx, f_idx, fixture_filename
                );
                assert_eq!(
                    act_f.content, exp_f.content,
                    "Turn {} frame {} content mismatch in {}",
                    t_idx, f_idx, fixture_filename
                );
            }
        }

        assert_eq!(
            actual.transcript_lines, expected.transcript_lines,
            "Golden transcript mismatch in {}",
            fixture_filename
        );

        assert_eq!(
            actual.events, expected.events,
            "Golden events sequence mismatch in {}",
            fixture_filename
        );

        assert_eq!(
            actual.final_report, expected.final_report,
            "Golden final report mismatch in {}",
            fixture_filename
        );

        if expected.cli_arguments.is_some() {
            assert_eq!(
                actual.cli_arguments, expected.cli_arguments,
                "Golden CLI arguments mismatch in {}",
                fixture_filename
            );
        }
    }

fn build_golden_participants() -> Vec<DiscussionParticipant> {
    vec![
        DiscussionParticipant {
            agent_id: "agent-architect".to_string(),
            provider_id: "mock".to_string(),
            model_id: "mock-v1".to_string(),
            display_name: "Architect Agent".to_string(),
            role: AgentRole::Architect,
            role_description: "Focus on decomposition, contracts, and system bounds.".to_string(),
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
            role_description: "Challenge assumptions and surface bottlenecks.".to_string(),
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
            role_description: "Focus on idiomatic implementation and testing.".to_string(),
            avatar_color: "#10b981".to_string(),
            assigned_skill_uris: Vec::new(),
            context_budget_tokens: 16000,
            custom_action: None,
            custom_query: None,
            thinking_enabled: true,
            effort_level: Some("medium".to_string()),
        },
    ]
}

// ---------------------------------------------------------------------------
// 1. English per_agent Golden Test
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_golden_english_scenario_per_agent() {
    let temp_dir = std::env::temp_dir().join(format!("flymd_golden_en_per_agent_{}", now_ms()));
    fs::create_dir_all(&temp_dir).unwrap();

    let session_id = format!("golden-en-per-agent-{}", now_ms());
    let config = DiscussionConfig {
        schema_version: 1,
        session_id: session_id.clone(),
        topic: "Architecture Design for FlyMD Discussions".to_string(),
        user_idea: "Build an isolated multi-agent discussion system with no external side effects.".to_string(),
        workspace_path: temp_dir.to_string_lossy().to_string(),
        max_rounds: 3,
        turn_timeout_secs: 10,
        participants: build_golden_participants(),
        active_skill_uris: Vec::new(),
        step_mode: false,
        custom_skills_dir: None,
        include_default_skills: true,
        token_budget_cap: None,
        repeater_mode: Some("per_agent".to_string()),
        round_schedule: Vec::new(),
        ..Default::default()
    };

    let (mock_provider, turns_log, _) = RecordingMockProvider::new("mock");
    let mut providers: HashMap<String, Arc<dyn DiscussionProvider>> = HashMap::new();
    providers.insert("mock".to_string(), Arc::new(mock_provider));

    let collector = Arc::new(TestEventCollector {
        events: Mutex::new(Vec::new()),
    });

    let mut orchestrator = DiscussionOrchestrator::new(config, providers).unwrap();
    orchestrator.set_event_listener(collector.clone());

    let final_status = orchestrator.run_discussion().await.unwrap();
    assert_eq!(final_status, DiscussionStatus::AwaitingReview);

    // Collect and normalize frames
    let raw_turns = turns_log.lock().unwrap().clone();
    let frames_per_turn: Vec<Vec<ChatMessageFrame>> = raw_turns
        .into_iter()
        .map(|req| {
            req.messages
                .into_iter()
                .map(|mut f| {
                    f.content = normalize_golden_text(&f.content, &session_id, &temp_dir);
                    f
                })
                .collect()
        })
        .collect();

    // Collect and normalize transcript
    let transcript_raw = fs::read_to_string(orchestrator.session_dir.join("transcript.jsonl")).unwrap();
    let transcript_lines: Vec<String> = transcript_raw
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| normalize_golden_text(l, &session_id, &temp_dir))
        .collect();

    // Collect and normalize events
    let raw_events = collector.events.lock().unwrap().clone();
    let events: Vec<serde_json::Value> = raw_events
        .into_iter()
        .map(|e| {
            let s = serde_json::to_string(&e).unwrap();
            let norm = normalize_golden_text(&s, &session_id, &temp_dir);
            serde_json::from_str(&norm).unwrap()
        })
        .collect();

    // Collect and normalize report
    let report_raw = fs::read_to_string(
        orchestrator.session_dir.join("reports").join("final-report-latest.md"),
    )
    .unwrap();
    let final_report = normalize_golden_text(&report_raw, &session_id, &temp_dir);

    let golden = GoldenScenarioData {
        scenario_name: "english_per_agent".to_string(),
        frames_per_turn,
        transcript_lines,
        events,
        final_report,
        cli_arguments: None,
    };

    assert_or_record_golden("golden_english_per_agent.json", &golden);

    let _ = fs::remove_dir_all(&temp_dir);
}

// ---------------------------------------------------------------------------
// 2. Arabic per_agent with Pause, Resume & Failed Turn Retry
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_golden_arabic_scenario_per_agent_with_pause_resume_retry() {
    let temp_dir = std::env::temp_dir().join(format!("flymd_golden_ar_per_agent_{}", now_ms()));
    fs::create_dir_all(&temp_dir).unwrap();

    let session_id = format!("golden-ar-per-agent-{}", now_ms());
    let config = DiscussionConfig {
        schema_version: 1,
        session_id: session_id.clone(),
        topic: "تصميم بنية مرنة لتطبيق FlyMD متعدد الوكلاء".to_string(),
        user_idea: "بناء نظام تداول موزع وقوي يعتمد على مسار الرسائل الآمن وإدارة الذاكرة المحلية والتحقق من الهوية".to_string(),
        workspace_path: temp_dir.to_string_lossy().to_string(),
        max_rounds: 3,
        turn_timeout_secs: 10,
        participants: build_golden_participants(),
        active_skill_uris: Vec::new(),
        step_mode: false,
        custom_skills_dir: None,
        include_default_skills: true,
        token_budget_cap: None,
        repeater_mode: Some("per_agent".to_string()),
        round_schedule: Vec::new(),
        pause_at_round_boundary: true, // will pause after Round 1!
        ..Default::default()
    };

    let (mock_provider, turns_log, fail_flag) = RecordingMockProvider::new("mock");
    let mut providers: HashMap<String, Arc<dyn DiscussionProvider>> = HashMap::new();
    providers.insert("mock".to_string(), Arc::new(mock_provider));

    let collector = Arc::new(TestEventCollector {
        events: Mutex::new(Vec::new()),
    });

    let mut orchestrator = DiscussionOrchestrator::new(config, providers).unwrap();
    orchestrator.set_event_listener(collector.clone());

    // Phase 1: Run Round 1, halts at round barrier pause
    let status_round_1 = orchestrator.run_discussion().await.unwrap();
    assert_eq!(status_round_1, DiscussionStatus::Paused);
    assert_eq!(orchestrator.metadata.current_round, 1);

    // Phase 2: Inject user guidance before Round 2
    orchestrator
        .inject_user_guidance("يرجى التركيز على حماية الذاكرة المؤقتة والتحقق من التوقيع الرقمي للرسائل.")
        .unwrap();

    // Phase 3: Trigger a simulated failure during Round 2 turn execution
    fail_flag.store(true, Ordering::Relaxed);
    let fail_res = orchestrator.run_discussion().await;
    assert!(fail_res.is_err() || orchestrator.metadata.status == DiscussionStatus::Failed);
    assert_eq!(orchestrator.metadata.status, DiscussionStatus::Failed);

    // Phase 4: Resume & Retry from Failed status to complete Round 2; pauses at round 2 barrier
    let round2_resume_status = orchestrator.run_discussion().await.unwrap();
    assert_eq!(round2_resume_status, DiscussionStatus::Paused);
    assert_eq!(orchestrator.metadata.current_round, 2);

    // Phase 5: Resume to execute Round 3 to full review
    let final_status = orchestrator.run_discussion().await.unwrap();
    assert_eq!(final_status, DiscussionStatus::AwaitingReview);
    assert_eq!(orchestrator.metadata.current_round, 3);

    // Collect and normalize frames
    let raw_turns = turns_log.lock().unwrap().clone();
    let frames_per_turn: Vec<Vec<ChatMessageFrame>> = raw_turns
        .into_iter()
        .map(|req| {
            req.messages
                .into_iter()
                .map(|mut f| {
                    f.content = normalize_golden_text(&f.content, &session_id, &temp_dir);
                    f
                })
                .collect()
        })
        .collect();

    // Collect and normalize transcript
    let transcript_raw = fs::read_to_string(orchestrator.session_dir.join("transcript.jsonl")).unwrap();
    let transcript_lines: Vec<String> = transcript_raw
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| normalize_golden_text(l, &session_id, &temp_dir))
        .collect();

    // Collect and normalize events
    let raw_events = collector.events.lock().unwrap().clone();
    let events: Vec<serde_json::Value> = raw_events
        .into_iter()
        .map(|e| {
            let s = serde_json::to_string(&e).unwrap();
            let norm = normalize_golden_text(&s, &session_id, &temp_dir);
            serde_json::from_str(&norm).unwrap()
        })
        .collect();

    // Collect and normalize report
    let report_raw = fs::read_to_string(
        orchestrator.session_dir.join("reports").join("final-report-latest.md"),
    )
    .unwrap();
    let final_report = normalize_golden_text(&report_raw, &session_id, &temp_dir);

    let golden = GoldenScenarioData {
        scenario_name: "arabic_per_agent_with_pause_resume_retry".to_string(),
        frames_per_turn,
        transcript_lines,
        events,
        final_report,
        cli_arguments: None,
    };

    assert_or_record_golden("golden_arabic_per_agent_with_pause_resume_retry.json", &golden);

    let _ = fs::remove_dir_all(&temp_dir);
}

// ---------------------------------------------------------------------------
// 3. English Repeater Mode with Round Barrier Pause
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_golden_english_repeater_mode_with_round_barrier() {
    let temp_dir = std::env::temp_dir().join(format!("flymd_golden_en_repeater_{}", now_ms()));
    fs::create_dir_all(&temp_dir).unwrap();

    let session_id = format!("golden-en-repeater-{}", now_ms());
    let participants = build_golden_participants();

    let round_schedule = vec![
        DiscussionRoundPlan {
            round_number: 1,
            title: "Round 1: Blueprint & Architecture".to_string(),
            objective: Some("Establish blueprint contracts.".to_string()),
            slots: vec![
                DiscussionRoundSlot {
                    slot_id: "r1-s1".to_string(),
                    participant: participants[0].clone(),
                    round_directive: Some("Decompose modular components.".to_string()),
                },
                DiscussionRoundSlot {
                    slot_id: "r1-s2".to_string(),
                    participant: participants[1].clone(),
                    round_directive: Some("Critique single point of failures.".to_string()),
                },
            ],
        },
        DiscussionRoundPlan {
            round_number: 2,
            title: "Round 2: Systems Verification".to_string(),
            objective: Some("Verify implementation specifications.".to_string()),
            slots: vec![DiscussionRoundSlot {
                slot_id: "r2-s1".to_string(),
                participant: participants[2].clone(),
                round_directive: Some("Synthesize final concrete specification.".to_string()),
            }],
        },
    ];

    let config = DiscussionConfig {
        schema_version: 1,
        session_id: session_id.clone(),
        topic: "Multi-Engine Repeater Architecture with Discrete Barriers".to_string(),
        user_idea: "Discrete scheduling per round with strict round boundary pause".to_string(),
        workspace_path: temp_dir.to_string_lossy().to_string(),
        max_rounds: 2,
        turn_timeout_secs: 10,
        participants,
        active_skill_uris: Vec::new(),
        step_mode: false,
        custom_skills_dir: None,
        include_default_skills: true,
        token_budget_cap: None,
        repeater_mode: Some("per_round".to_string()),
        round_schedule,
        pause_at_round_boundary: true,
        ..Default::default()
    };

    let (mock_provider, turns_log, _) = RecordingMockProvider::new("mock");
    let mut providers: HashMap<String, Arc<dyn DiscussionProvider>> = HashMap::new();
    providers.insert("mock".to_string(), Arc::new(mock_provider));

    let collector = Arc::new(TestEventCollector {
        events: Mutex::new(Vec::new()),
    });

    let mut orchestrator = DiscussionOrchestrator::new(config, providers).unwrap();
    orchestrator.set_event_listener(collector.clone());

    // Round 1 runs both slots, then pauses at round barrier
    let status1 = orchestrator.run_discussion().await.unwrap();
    assert_eq!(status1, DiscussionStatus::Paused);
    assert_eq!(orchestrator.metadata.current_round, 1);

    // Resuming executes Round 2 to completion
    let status2 = orchestrator.run_discussion().await.unwrap();
    assert_eq!(status2, DiscussionStatus::AwaitingReview);
    assert_eq!(orchestrator.metadata.current_round, 2);

    // Collect and normalize frames
    let raw_turns = turns_log.lock().unwrap().clone();
    let frames_per_turn: Vec<Vec<ChatMessageFrame>> = raw_turns
        .into_iter()
        .map(|req| {
            req.messages
                .into_iter()
                .map(|mut f| {
                    f.content = normalize_golden_text(&f.content, &session_id, &temp_dir);
                    f
                })
                .collect()
        })
        .collect();

    // Collect and normalize transcript
    let transcript_raw = fs::read_to_string(orchestrator.session_dir.join("transcript.jsonl")).unwrap();
    let transcript_lines: Vec<String> = transcript_raw
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| normalize_golden_text(l, &session_id, &temp_dir))
        .collect();

    // Collect and normalize events
    let raw_events = collector.events.lock().unwrap().clone();
    let events: Vec<serde_json::Value> = raw_events
        .into_iter()
        .map(|e| {
            let s = serde_json::to_string(&e).unwrap();
            let norm = normalize_golden_text(&s, &session_id, &temp_dir);
            serde_json::from_str(&norm).unwrap()
        })
        .collect();

    // Collect and normalize report
    let report_raw = fs::read_to_string(
        orchestrator.session_dir.join("reports").join("final-report-latest.md"),
    )
    .unwrap();
    let final_report = normalize_golden_text(&report_raw, &session_id, &temp_dir);

    let golden = GoldenScenarioData {
        scenario_name: "english_repeater_barrier".to_string(),
        frames_per_turn,
        transcript_lines,
        events,
        final_report,
        cli_arguments: None,
    };

    assert_or_record_golden("golden_english_repeater_barrier.json", &golden);

    let _ = fs::remove_dir_all(&temp_dir);
}

// ---------------------------------------------------------------------------
// 4. Arabic Early Convergence (10 rounds -> converged at round 4)
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_golden_arabic_early_convergence() {
    let temp_dir = std::env::temp_dir().join(format!("flymd_golden_ar_conv_{}", now_ms()));
    fs::create_dir_all(&temp_dir).unwrap();

    let session_id = format!("golden-ar-conv-{}", now_ms());
    let config = DiscussionConfig {
        schema_version: 1,
        session_id: session_id.clone(),
        topic: "تحقيق الإجماع المعرفي المبكر للأنظمة الموزعة".to_string(),
        user_idea: "إيقاف جولات النقاش مبكراً عند وصول الوكلاء إلى اتفاق كامل لتوفير استهلاك الموارد".to_string(),
        workspace_path: temp_dir.to_string_lossy().to_string(),
        max_rounds: 10,
        turn_timeout_secs: 10,
        participants: build_golden_participants(),
        active_skill_uris: Vec::new(),
        step_mode: false,
        custom_skills_dir: None,
        include_default_skills: true,
        token_budget_cap: None,
        ..Default::default()
    };

    let (mock_provider, turns_log, _) = RecordingMockProvider::new("mock");
    let mut providers: HashMap<String, Arc<dyn DiscussionProvider>> = HashMap::new();
    providers.insert("mock".to_string(), Arc::new(mock_provider));

    let collector = Arc::new(TestEventCollector {
        events: Mutex::new(Vec::new()),
    });

    let mut orchestrator = DiscussionOrchestrator::new(config, providers).unwrap();
    orchestrator.set_event_listener(collector.clone());

    let final_status = orchestrator.run_discussion().await.unwrap();
    assert_eq!(final_status, DiscussionStatus::AwaitingReview);
    assert_eq!(orchestrator.metadata.converged_at_round, Some(4));

    // Collect and normalize frames
    let raw_turns = turns_log.lock().unwrap().clone();
    let frames_per_turn: Vec<Vec<ChatMessageFrame>> = raw_turns
        .into_iter()
        .map(|req| {
            req.messages
                .into_iter()
                .map(|mut f| {
                    f.content = normalize_golden_text(&f.content, &session_id, &temp_dir);
                    f
                })
                .collect()
        })
        .collect();

    // Collect and normalize transcript
    let transcript_raw = fs::read_to_string(orchestrator.session_dir.join("transcript.jsonl")).unwrap();
    let transcript_lines: Vec<String> = transcript_raw
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| normalize_golden_text(l, &session_id, &temp_dir))
        .collect();

    // Collect and normalize events
    let raw_events = collector.events.lock().unwrap().clone();
    let events: Vec<serde_json::Value> = raw_events
        .into_iter()
        .map(|e| {
            let s = serde_json::to_string(&e).unwrap();
            let norm = normalize_golden_text(&s, &session_id, &temp_dir);
            serde_json::from_str(&norm).unwrap()
        })
        .collect();

    // Collect and normalize report
    let report_raw = fs::read_to_string(
        orchestrator.session_dir.join("reports").join("final-report-latest.md"),
    )
    .unwrap();
    let final_report = normalize_golden_text(&report_raw, &session_id, &temp_dir);

    let golden = GoldenScenarioData {
        scenario_name: "arabic_early_convergence".to_string(),
        frames_per_turn,
        transcript_lines,
        events,
        final_report,
        cli_arguments: None,
    };

    assert_or_record_golden("golden_arabic_early_convergence.json", &golden);

    let _ = fs::remove_dir_all(&temp_dir);
}

// ---------------------------------------------------------------------------
// 5. CLI Arguments Matrix Golden Test
// ---------------------------------------------------------------------------
#[test]
fn test_golden_cli_arguments_matrix() {
    let dummy_prompt = "Examine modular invariants";
    let dummy_path = PathBuf::from("dummy_cli_test");

    let claude_cli = CliProvider {
        cli_type: CliType::ClaudeCode,
        executable_path: dummy_path.clone(),
        sandbox_dir: dummy_path.clone(),
        context_limit: 32000,
    };
    let claude_args_high = claude_cli.build_cli_args(
        dummy_prompt,
        Some("high"),
        true,
        Some("claude-sonnet-5-5"),
    );
    let claude_args_no_think = claude_cli.build_cli_args(
        dummy_prompt,
        Some("medium"),
        false,
        Some("claude-opus-5-5"),
    );

    let agy_cli = CliProvider {
        cli_type: CliType::AntigravityGemini,
        executable_path: dummy_path.clone(),
        sandbox_dir: dummy_path.clone(),
        context_limit: 32000,
    };
    let agy_args_argon = agy_cli.build_cli_args(
        dummy_prompt,
        Some("medium"),
        true,
        Some("gemini-4-argon"),
    );
    let agy_args_flash = agy_cli.build_cli_args(
        dummy_prompt,
        Some("low"),
        false,
        Some("gemini-3.8-flash"),
    );

    let opencode_cli = CliProvider {
        cli_type: CliType::OpenCode,
        executable_path: dummy_path.clone(),
        sandbox_dir: dummy_path.clone(),
        context_limit: 32000,
    };
    let opencode_args = opencode_cli.build_cli_args(dummy_prompt, None, false, Some("deepseek-r1"));

    let codex_cli = CliProvider {
        cli_type: CliType::Codex,
        executable_path: dummy_path.clone(),
        sandbox_dir: dummy_path.clone(),
        context_limit: 32000,
    };
    let codex_args = codex_cli.build_cli_args(dummy_prompt, None, false, Some("o3-mini"));

    // Pipeline CLI commands across intents
    let p_build = crate::agents::runner::cli_builder::build_agent_cli_command(
        "agy",
        "antigravity",
        "G:\\workspace",
        "Build prompt directive",
        None,
        false,
        true,
        "high",
        Some("gemini-4-argon"),
    );
    let p_build_args: Vec<String> = p_build.get_args().map(|a| a.to_string_lossy().into_owned()).collect();

    let p_fix = crate::agents::runner::cli_builder::build_agent_cli_command(
        "claude",
        "claude-code",
        "G:\\workspace",
        "Fix bugs directive",
        Some("session-xyz"),
        true,
        false,
        "low",
        Some("claude-sonnet-5-5"),
    );
    let p_fix_args: Vec<String> = p_fix.get_args().map(|a| a.to_string_lossy().into_owned()).collect();

    let cli_matrix = vec![
        claude_args_high,
        claude_args_no_think,
        agy_args_argon,
        agy_args_flash,
        opencode_args,
        codex_args,
        p_build_args,
        p_fix_args,
    ];

    let golden = GoldenScenarioData {
        scenario_name: "cli_arguments_matrix".to_string(),
        frames_per_turn: Vec::new(),
        transcript_lines: Vec::new(),
        events: Vec::new(),
        final_report: String::new(),
        cli_arguments: Some(cli_matrix),
    };

    assert_or_record_golden("golden_cli_arguments.json", &golden);
}

#[test]
#[should_panic(expected = "Set FLYMD_RECORD_GOLDEN=1 to record fixtures explicitly")]
fn test_missing_fixture_fails_without_env_var() {
    let dummy_data = GoldenScenarioData {
        scenario_name: "dummy".to_string(),
        frames_per_turn: Vec::new(),
        transcript_lines: Vec::new(),
        events: Vec::new(),
        final_report: String::new(),
        cli_arguments: None,
    };
    assert_or_record_golden("nonexistent_test_fixture_12345.json", &dummy_data);
}
