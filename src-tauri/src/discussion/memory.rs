//! Memory and Context Manager: decision ledger, disagreement registry, and budget-constrained context assembly.

use super::epistemic::{
    build_epistemic_prompt_section, format_handoff_state_emission_protocol, EpistemicDecision,
};
use super::runner::ChatMessageFrame;
use super::storage::{atomic_write_json, read_transcript_with_recovery};
use super::types::{
    now_ms, DecisionItem, DisagreementItem, DisagreementStatus, DiscussionMessage,
    DiscussionMessageKind, DiscussionParticipant,
};
use crate::projects::cache::{
    filter_peer_messages_for_agent, format_compact_digest_markdown, scan_workspace_digest,
    CognitiveHandoffPacket, PeerDirectMessage,
};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

pub struct MemoryManager {
    session_dir: PathBuf,
}

impl MemoryManager {
    pub fn new(session_dir: PathBuf) -> Self {
        Self { session_dir }
    }

    /// Fast heuristic token estimator (~3.8 characters per token for mixed markdown/code).
    pub fn estimate_tokens(text: &str) -> u32 {
        let char_count = text.chars().count();
        ((char_count as f64) / 3.8).ceil() as u32
    }

    /// Loads the active decision ledger from `decisions.json`.
    pub fn load_decisions(&self) -> Vec<DecisionItem> {
        let path = self.session_dir.join("decisions.json");
        if path.exists() {
            if let Ok(bytes) = fs::read(&path) {
                if let Ok(items) = serde_json::from_slice::<Vec<DecisionItem>>(&bytes) {
                    return items;
                }
            }
        }
        Vec::new()
    }

    /// Saves the decision ledger atomically to `decisions.json`.
    pub fn save_decisions(&self, decisions: &[DecisionItem]) -> Result<(), String> {
        let path = self.session_dir.join("decisions.json");
        atomic_write_json(&path, &decisions)
    }

    /// Loads the active disagreement registry from `disagreements.json`.
    pub fn load_disagreements(&self) -> Vec<DisagreementItem> {
        let path = self.session_dir.join("disagreements.json");
        if path.exists() {
            if let Ok(bytes) = fs::read(&path) {
                if let Ok(items) = serde_json::from_slice::<Vec<DisagreementItem>>(&bytes) {
                    return items;
                }
            }
        }
        Vec::new()
    }

    /// Saves the disagreement registry atomically to `disagreements.json`.
    pub fn save_disagreements(&self, disagreements: &[DisagreementItem]) -> Result<(), String> {
        let path = self.session_dir.join("disagreements.json");
        atomic_write_json(&path, &disagreements)
    }

    /// Records or updates a disagreement topic.
    pub fn record_disagreement(
        &self,
        topic: &str,
        agent_id: &str,
        stance: &str,
        round: u32,
    ) -> Result<(), String> {
        let mut list = self.load_disagreements();
        if let Some(item) = list
            .iter_mut()
            .find(|d| d.topic.eq_ignore_ascii_case(topic))
        {
            item.agent_stances
                .insert(agent_id.to_string(), stance.to_string());
            item.round_last_updated = round;
            item.status = DisagreementStatus::UnresolvedDivergence;
        } else {
            let mut stances = HashMap::new();
            stances.insert(agent_id.to_string(), stance.to_string());
            list.push(DisagreementItem {
                id: format!("dispute-{}", now_ms()),
                topic: topic.to_string(),
                agent_stances: stances,
                status: DisagreementStatus::UnresolvedDivergence,
                resolution_notes: None,
                round_first_observed: round,
                round_last_updated: round,
            });
        }
        self.save_disagreements(&list)
    }

    /// Records an agreed decision item into the ledger.
    pub fn record_decision(
        &self,
        topic: &str,
        decision: &str,
        rationale: &str,
        agreed_by: Vec<String>,
        round: u32,
        citations: Vec<String>,
    ) -> Result<(), String> {
        let mut list = self.load_decisions();
        if let Some(existing) = list
            .iter_mut()
            .find(|d| d.topic.eq_ignore_ascii_case(topic))
        {
            existing.decision = decision.to_string();
            existing.rationale = rationale.to_string();
            existing.agreed_by_agents = agreed_by;
            existing.agreed_round = round;
            existing.evidence_citations = citations;
        } else {
            list.push(DecisionItem {
                id: format!("decision-{}", now_ms()),
                topic: topic.to_string(),
                decision: decision.to_string(),
                rationale: rationale.to_string(),
                agreed_by_agents: agreed_by,
                agreed_round: round,
                evidence_citations: citations,
            });
        }
        self.save_decisions(&list)
    }

    /// Assembles a budget-constrained context prompt for an agent turn.
    ///
    /// Priority 1 (Never dropped): Original user idea & constraints
    /// Priority 2 (Preserved strictly): Active disputes & direct peer critiques targeting this agent
    /// Priority 3: Non-relevant peer papers (omitted first)
    /// Priority 4: Early settled consensus (compressed to high-density summary table)
    /// Priority 5: Intermediate thinking traces and filler conversational preamble
    pub fn assemble_turn_context(
        &self,
        target_agent_id: &str,
        current_round: u32,
        user_idea: &str,
        context_budget_tokens: u32,
    ) -> Result<(String, bool), String> {
        let (transcript, _) = read_transcript_with_recovery(&self.session_dir)?;
        let decisions = self.load_decisions();
        let disagreements = self.load_disagreements();

        let mut truncated = false;
        let mut context_buffer = String::new();

        // 1. Original User Idea (Priority 1)
        context_buffer.push_str("## Original User Proposal & Constraints\n");
        context_buffer.push_str(user_idea.trim());
        context_buffer.push_str("\n\n");

        // 2. Early Settled Decisions (Priority 4 - Formatted as High-Density Markdown Table)
        if !decisions.is_empty() {
            context_buffer.push_str("### Settled Architectural Alignments\n");
            context_buffer
                .push_str("| Decision Topic | Consensus Conclusion | Agreed In Round |\n");
            context_buffer.push_str("| :--- | :--- | :--- |\n");
            for d in &decisions {
                context_buffer.push_str(&format!(
                    "| **{}** | {} | Round {} |\n",
                    d.topic, d.decision, d.agreed_round
                ));
            }
            context_buffer.push('\n');
        }

        // 3. Persistent & Active Disagreements (Priority 2)
        let active_disputes: Vec<&DisagreementItem> = disagreements
            .iter()
            .filter(|d| matches!(d.status, DisagreementStatus::UnresolvedDivergence))
            .collect();

        if !active_disputes.is_empty() {
            context_buffer.push_str("### Active Disagreements Under Debate\n");
            for d in &active_disputes {
                context_buffer.push_str(&format!("- **Disputed Topic: {}**\n", d.topic));
                for (agent, stance) in &d.agent_stances {
                    context_buffer.push_str(&format!("  * *{}*: \"{}\"\n", agent, stance.trim()));
                }
            }
            context_buffer.push('\n');
        }

        // 4. Previous Round Messages
        if current_round > 1 {
            let prev_round = current_round - 1;
            let prev_msgs: Vec<&DiscussionMessage> = transcript
                .iter()
                .filter(|m| m.round_number == prev_round)
                .collect();

            context_buffer.push_str(&format!(
                "### Round {} Contributions from Peer Agents\n",
                prev_round
            ));

            for m in &prev_msgs {
                let is_self = m.author_agent_id == target_agent_id;
                let header = if is_self {
                    format!("#### Your Previous Round Stance ({})\n", m.author_role)
                } else {
                    format!(
                        "#### Peer Contribution: {} ({})\n",
                        m.author_agent_id, m.author_role
                    )
                };
                context_buffer.push_str(&header);

                // Check budget
                let current_tokens =
                    Self::estimate_tokens(&context_buffer) + Self::estimate_tokens(&m.content);

                if current_tokens > (context_budget_tokens * 85 / 100) && !is_self {
                    truncated = true;
                    // Provide summarized excerpt
                    let excerpt: String = m.content.lines().take(12).collect::<Vec<_>>().join("\n");
                    context_buffer.push_str(&format!(
                        "> [Context Budget Notice: Detailed arguments from {} compressed]\n{}\n\n",
                        m.author_agent_id, excerpt
                    ));
                } else {
                    context_buffer.push_str(m.content.trim());
                    context_buffer.push_str("\n\n");
                }
            }
        }

        Ok((context_buffer, truncated))
    }

    /// Loads persisted direct `@Role` / `@agent` peer messages for this discussion session.
    pub fn load_peer_messages(&self) -> Vec<PeerDirectMessage> {
        let path = self.session_dir.join("peer_bus.json");
        if path.exists() {
            if let Ok(bytes) = fs::read(&path) {
                if let Ok(items) = serde_json::from_slice::<Vec<PeerDirectMessage>>(&bytes) {
                    return items;
                }
            }
        }
        Vec::new()
    }

    /// Appends new direct peer messages to `peer_bus.json`.
    pub fn append_peer_messages(&self, new_msgs: &[PeerDirectMessage]) -> Result<(), String> {
        if new_msgs.is_empty() {
            return Ok(());
        }
        let mut list = self.load_peer_messages();
        for m in new_msgs {
            if !list
                .iter()
                .any(|x| x.from_agent == m.from_agent && x.to_target == m.to_target && x.message == m.message)
            {
                list.push(m.clone());
            }
        }
        let path = self.session_dir.join("peer_bus.json");
        atomic_write_json(&path, &list)
    }

    /// Builds (and pins on disk) the immutable Token-0 Shared System Prefix.
    /// Guaranteed 100% byte-identical across ALL participants and ALL rounds of the session
    /// so Ollama, DeepSeek, OpenAI, Kimi, and Anthropic hit hardware prefix KV caches.
    pub fn get_or_init_shared_system_prefix(
        &self,
        topic: &str,
        user_idea: &str,
        workspace_path: &Path,
    ) -> String {
        let prefix_file = self.session_dir.join("shared_prefix.md");
        if prefix_file.exists() {
            if let Ok(existing) = fs::read_to_string(&prefix_file) {
                if !existing.trim().is_empty() {
                    return existing;
                }
            }
        }

        let mut prefix = String::new();
        prefix.push_str(
            "# FlyMD Multi-Agent Deliberation Protocol (Immutable Shared Prefix)\n\
             - Ground every architectural, security, and implementation claim in concrete technical evidence.\n\
             - Never fabricate file contents, APIs, or runtime capabilities.\n\
             - Surface genuine engineering trade-offs rather than conforming prematurely.\n\
             - Communicate directly with peer roles (`@Architect`, `@Implementer`, `@Critic`, `@Auditor`) to pass verified contracts and resolve disputes without redundant file re-reading.\n\n",
        );
        prefix.push_str(&format!("## Discussion Topic\n{}\n\n", topic.trim()));
        prefix.push_str(&format!(
            "## Original User Proposal & Core Constraints\n{}\n\n",
            user_idea.trim()
        ));

        let initial_digest = scan_workspace_digest(workspace_path, 36);
        if !initial_digest.is_empty() {
            let pkt = CognitiveHandoffPacket {
                producer_agent: "workspace-indexer".to_string(),
                producer_role: "Baseline".to_string(),
                workspace_digest: initial_digest,
                ..Default::default()
            };
            prefix.push_str(&format_compact_digest_markdown(&pkt, false));
        }

        let _ = fs::write(&prefix_file, &prefix);
        prefix
    }

    /// Compresses a completed round into an immutable ~200–350 token ledger block (`round_{r}_ledger.md`).
    /// Once written, it never mutates in later rounds, preserving multi-round prefix KV cache alignment.
    pub fn get_or_freeze_round_digest(&self, round: u32) -> Result<Option<String>, String> {
        let ledger_file = self.session_dir.join(format!("round_{}_ledger.md", round));
        if ledger_file.exists() {
            if let Ok(cached) = fs::read_to_string(&ledger_file) {
                if !cached.trim().is_empty() {
                    return Ok(Some(cached));
                }
            }
        }

        let (transcript, _) = read_transcript_with_recovery(&self.session_dir)?;
        let round_msgs: Vec<&DiscussionMessage> = transcript
            .iter()
            .filter(|m| m.round_number == round)
            .collect();
        if round_msgs.is_empty() {
            return Ok(None);
        }

        let mut digest = format!("## Immutable Round {} Deliberation Ledger\n\n", round);
        for m in round_msgs {
            if m.message_kind == DiscussionMessageKind::UserIntervention {
                digest.push_str(&format!(
                    "- **[Human Facilitator Steer]**: {}\n",
                    m.content.trim()
                ));
                continue;
            }

            digest.push_str(&format!(
                "### `@{} ({})`\n",
                m.author_agent_id, m.author_role
            ));

            // Keep high-signal bullets, headings, `@Peer` mentions, and `<independent_resume>` lines (max 10 lines)
            let mut selected_lines: Vec<&str> = m
                .content
                .lines()
                .map(str::trim)
                .filter(|l| {
                    !l.is_empty()
                        && (l.starts_with('-')
                            || l.starts_with('*')
                            || l.starts_with("1.")
                            || l.starts_with("2.")
                            || l.starts_with('@')
                            || l.contains("Invariant")
                            || l.contains("Dispute")
                            || l.contains("Consensus")
                            || l.contains("Concession")
                            || l.contains("<independent_resume>"))
                })
                .take(10)
                .collect();

            if selected_lines.is_empty() {
                selected_lines = m
                    .content
                    .lines()
                    .map(str::trim)
                    .filter(|l| !l.is_empty() && !l.starts_with('#'))
                    .take(6)
                    .collect();
            }

            for line in selected_lines {
                let bounded: String = line.chars().take(220).collect();
                digest.push_str(&format!("{}\n", bounded));
            }
            digest.push('\n');
        }

        let _ = fs::write(&ledger_file, &digest);
        Ok(Some(digest))
    }

    /// Assembles Prefix-Pinned `ChatMessageFrame`s:
    /// - Frame 0 (`system`, anchored): 100% shared immutable protocol + spec + workspace SHA-256 index
    /// - Frames `1..round-1` (`user`, anchored): append-only frozen round ledgers
    /// - Final Frame (`user`, dynamic): active role persona, `@Role` peer inbox, epistemic gate & turn directive
    pub fn assemble_prefix_pinned_frames(
        &self,
        participant: &DiscussionParticipant,
        current_round: u32,
        topic: &str,
        user_idea: &str,
        workspace_path: &Path,
        epistemic_decision: &EpistemicDecision,
        cognitive_packet: Option<&CognitiveHandoffPacket>,
        action_name: Option<&str>,
        action_query: Option<&str>,
    ) -> Result<(Vec<ChatMessageFrame>, bool), String> {
        let mut frames = Vec::new();
        let mut truncated = false;

        // 1. Frame 0: Immutable Shared System Prefix (Token 0 KV-cache anchor)
        let shared_prefix =
            self.get_or_init_shared_system_prefix(topic, user_idea, workspace_path);
        frames.push(ChatMessageFrame {
            role: "system".to_string(),
            content: shared_prefix,
            cache_anchor: true,
        });

        // 2. Frames 1..current_round-1: Append-Only Frozen Round Ledgers
        let mut total_tokens = Self::estimate_tokens(&frames[0].content);
        let budget_cap = (participant.context_budget_tokens * 85) / 100;

        for r in 1..current_round {
            if let Some(ledger) = self.get_or_freeze_round_digest(r)? {
                let ledger_tokens = Self::estimate_tokens(&ledger);
                if total_tokens + ledger_tokens <= budget_cap {
                    total_tokens += ledger_tokens;
                    frames.push(ChatMessageFrame {
                        role: "user".to_string(),
                        content: ledger,
                        cache_anchor: r + 1 == current_round,
                    });
                } else {
                    truncated = true;
                }
            }
        }

        // 3. Final Frame: Dynamic Agent Role, Peer Inbox, Ledger Delta & Epistemic Tail
        let mut tail = String::new();
        tail.push_str(&format!(
            "## Active Role Assignment\n\
             You are **{}** (Agent ID: `{}`, Role: `{}`).\n\
             {}\n\n",
            participant.display_name,
            participant.agent_id,
            participant.role.as_str(),
            participant.role_description.trim()
        ));

        // Direct Peer Inbox (`@Role` / `@agent_id`)
        let all_peer_msgs = self.load_peer_messages();
        let inbox = filter_peer_messages_for_agent(
            &all_peer_msgs,
            &participant.agent_id,
            participant.role.as_str(),
        );
        if !inbox.is_empty() {
            tail.push_str("### Direct Peer Messages Addressed to You\n");
            for pm in inbox.iter().rev().take(6).rev() {
                tail.push_str(&format!(
                    "- From **{} ({})** [{}]: {}\n",
                    pm.from_agent, pm.from_role, pm.kind, pm.message
                ));
            }
            tail.push('\n');
        }

        // Current Round Human Facilitator Guidance (if injected before this turn)
        let (transcript, _) = read_transcript_with_recovery(&self.session_dir)?;
        let round_guidance: Vec<&DiscussionMessage> = transcript
            .iter()
            .filter(|m| {
                m.round_number == current_round
                    && m.message_kind == DiscussionMessageKind::UserIntervention
            })
            .collect();
        if !round_guidance.is_empty() {
            tail.push_str("### Human Facilitator Guidance for This Round\n");
            for g in round_guidance {
                tail.push_str(&format!("- {}\n", g.content.trim()));
            }
            tail.push('\n');
        }

        // Compact Settled Decisions & Active Disputes
        let decisions = self.load_decisions();
        if !decisions.is_empty() {
            tail.push_str("### Locked Consensus Decisions (Do Not Re-Litigate Unless Broken)\n");
            for d in decisions.iter().take(8) {
                tail.push_str(&format!(
                    "- **{}**: {} *(Round {})*\n",
                    d.topic, d.decision, d.agreed_round
                ));
            }
            tail.push('\n');
        }

        let disagreements = self.load_disagreements();
        let active_disputes: Vec<&DisagreementItem> = disagreements
            .iter()
            .filter(|d| matches!(d.status, DisagreementStatus::UnresolvedDivergence))
            .collect();
        if !active_disputes.is_empty() {
            tail.push_str("### Active Unresolved Disputes Requiring Resolution\n");
            for d in active_disputes.iter().take(6) {
                tail.push_str(&format!("- **{}**:\n", d.topic));
                for (ag, st) in &d.agent_stances {
                    tail.push_str(&format!("  * `{}`: {}\n", ag, st.trim()));
                }
            }
            tail.push('\n');
        }

        // Role-Aware Epistemic Section (Direct Cache Inheritance vs. Blind Raw-Slice Audit)
        tail.push_str(&build_epistemic_prompt_section(
            epistemic_decision,
            workspace_path,
            cognitive_packet,
        ));

        // Round Mission Directive
        match current_round {
            1 => {
                tail.push_str(&format!(
                    "### Round 1 Directive: Independent Position & Contract Mapping ({})\n\
                     Analyze the proposal from your `{}` perspective. Establish core invariants, surface critical risks, and address targeted directives (`@Implementer`, `@Critic`, `@Architect`) to your peers.\n",
                    participant.role.as_str(),
                    participant.role.as_str()
                ));
            }
            2 => {
                tail.push_str(
                    "### Round 2 Directive: Cross-Examination & Peer Inbox Response\n\
                     Answer peer questions in your Direct Peer Inbox above, challenge unverified assumptions with concrete technical evidence, and narrow active disputes toward actionable engineering contracts.\n",
                );
            }
            _ => {
                tail.push_str(&format!(
                    "### Round {} Directive: Rebuttal, Convergence & Final Contract\n\
                     Resolve remaining disputes, concede points proven by technical evidence, and lock final implementation invariants.\n",
                    current_round
                ));
            }
        }

        if let Some(q) = action_query.map(str::trim).filter(|s| !s.is_empty()) {
            let label = action_name.unwrap_or("Focused Turn Directive");
            tail.push_str(&format!("\n### {}\nSpecifically address: {}\n", label, q));
        }

        if participant.thinking_enabled {
            tail.push_str(
                "\n### Thinking Protocol\n\
                 Reason step-by-step inside `<thinking>...</thinking>` before writing your structured Markdown response.\n",
            );
        }

        tail.push_str(&format_handoff_state_emission_protocol(
            epistemic_decision.requires_blind_self_conclusion(),
        ));

        frames.push(ChatMessageFrame {
            role: "user".to_string(),
            content: tail,
            cache_anchor: false,
        });

        Ok((frames, truncated))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_estimation() {
        let text = "Hello world, this is a test of token estimation for markdown code blocks.";
        let tokens = MemoryManager::estimate_tokens(text);
        assert!(tokens >= 15 && tokens <= 25);
    }

    #[test]
    fn test_decision_and_disagreement_persistence() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_mem_test_{}", now_ms()));
        fs::create_dir_all(&temp_dir).unwrap();

        let mem = MemoryManager::new(temp_dir.clone());
        mem.record_decision(
            "Database Engine",
            "SQLite with WAL mode",
            "Zero config and high local read speed",
            vec!["agent-1".to_string(), "agent-2".to_string()],
            1,
            vec!["workspace/db.rs".to_string()],
        )
        .unwrap();

        let loaded = mem.load_decisions();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].topic, "Database Engine");

        mem.record_disagreement("ORM vs Raw SQL", "agent-1", "Prefers SeaORM", 1)
            .unwrap();
        mem.record_disagreement("ORM vs Raw SQL", "agent-2", "Prefers Rusqlite raw SQL", 2)
            .unwrap();

        let disputes = mem.load_disagreements();
        assert_eq!(disputes.len(), 1);
        assert_eq!(disputes[0].agent_stances.len(), 2);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_prefix_pinned_frames_byte_identical_across_agents_and_rounds() {
        use super::super::epistemic::evaluate_debate_epistemic_policy;
        use super::super::storage::append_transcript_message;
        use super::super::types::AgentRole;

        let temp_ws = std::env::temp_dir().join(format!("flymd_kv_prefix_ws_{}", now_ms()));
        let session_dir = temp_ws.join(".flymd").join("discussions").join("s1");
        fs::create_dir_all(&session_dir).unwrap();
        fs::write(
            temp_ws.join("index.html"),
            "<!DOCTYPE html><html><body><canvas id=\"labCanvas\"></canvas></body></html>",
        )
        .unwrap();

        let mem = MemoryManager::new(session_dir.clone());
        let p_arch = DiscussionParticipant {
            agent_id: "arch-1".to_string(),
            provider_id: "ollama".to_string(),
            model_id: "qwen2.5:7b".to_string(),
            display_name: "Lead Architect".to_string(),
            role: AgentRole::Architect,
            role_description: "System decomposition".to_string(),
            avatar_color: "#38bdf8".to_string(),
            assigned_skill_uris: vec![],
            context_budget_tokens: 16000,
            custom_action: None,
            custom_query: None,
            thinking_enabled: true,
            effort_level: Some("medium".to_string()),
        };
        let p_critic = DiscussionParticipant {
            agent_id: "critic-1".to_string(),
            provider_id: "ollama".to_string(),
            model_id: "qwen2.5:7b".to_string(),
            display_name: "Adversarial Critic".to_string(),
            role: AgentRole::Critic,
            role_description: "Stress testing".to_string(),
            avatar_color: "#ef4444".to_string(),
            assigned_skill_uris: vec![],
            context_budget_tokens: 16000,
            custom_action: None,
            custom_query: None,
            thinking_enabled: true,
            effort_level: Some("medium".to_string()),
        };

        let dec1 = evaluate_debate_epistemic_policy(&p_arch.role, 1, &temp_ws, None, &[]);
        let dec2 = evaluate_debate_epistemic_policy(&p_critic.role, 1, &temp_ws, None, &[]);

        let (frames_arch_r1, _) = mem
            .assemble_prefix_pinned_frames(
                &p_arch,
                1,
                "Physics Engine",
                "Build 60fps simulation",
                &temp_ws,
                &dec1,
                None,
                None,
                None,
            )
            .unwrap();
        let (frames_critic_r1, _) = mem
            .assemble_prefix_pinned_frames(
                &p_critic,
                1,
                "Physics Engine",
                "Build 60fps simulation",
                &temp_ws,
                &dec2,
                None,
                None,
                None,
            )
            .unwrap();

        // Token-0 System Frame MUST be 100% byte-identical between Architect and Critic!
        assert_eq!(frames_arch_r1[0].content, frames_critic_r1[0].content);
        assert!(frames_arch_r1[0].content.contains("#labCanvas"));
        assert!(!frames_arch_r1[0].content.contains("Lead Architect"));
        assert!(frames_arch_r1[1].content.contains("Lead Architect"));
        assert!(frames_critic_r1[1].content.contains("Adversarial Critic"));

        // Append Round 1 message and verify Round 2 keeps Frame 0 identical + appends immutable Frame 1
        append_transcript_message(
            &session_dir,
            &DiscussionMessage {
                id: "m1".to_string(),
                session_id: "s1".to_string(),
                round_number: 1,
                turn_index: 1,
                author_agent_id: "arch-1".to_string(),
                author_role: "Architect".to_string(),
                author_provider: "ollama".to_string(),
                message_kind: DiscussionMessageKind::InitialAnalysis,
                target_peer_ids: vec!["Critic".to_string()],
                content: "- **Core Invariant**: Fixed timestep physics.\n- @Critic: Check dt clamping?".to_string(),
                timestamp: now_ms(),
                token_usage: None,
                duration_ms: 10,
                truncated: false,
                thinking_content: None,
                action_name: None,
                model_id: None,
                simulated: true,
                author_display_name: None,
            },
        )
        .unwrap();

        let dec_critic_r2 = evaluate_debate_epistemic_policy(&p_critic.role, 2, &temp_ws, None, &[]);
        let (frames_critic_r2, _) = mem
            .assemble_prefix_pinned_frames(
                &p_critic,
                2,
                "Physics Engine",
                "Build 60fps simulation",
                &temp_ws,
                &dec_critic_r2,
                None,
                None,
                None,
            )
            .unwrap();

        assert_eq!(frames_critic_r2.len(), 3);
        assert_eq!(frames_critic_r2[0].content, frames_arch_r1[0].content);
        assert!(frames_critic_r2[1]
            .content
            .contains("Immutable Round 1 Deliberation Ledger"));
        assert!(frames_critic_r2[2]
            .content
            .contains("BLIND_INDEPENDENT_AUDIT"));

        let _ = fs::remove_dir_all(&temp_ws);
    }
}
