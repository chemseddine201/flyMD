//! Debate Board Subsystem (Phase 3)
//!
//! Provides structured claim tracking, discrete round barrier synchronization,
//! computed consensus statuses (`agreed`, `uncontested`, `disputed`, `withdrawn`),
//! bad block fallbacks, `needs` context injection, and decision brief generation.

use super::memory::MemoryManager;
use super::storage::atomic_write_json;
use super::types::{
    DecisionItem, DisagreementItem, DisagreementStatus, DiscussionParticipant,
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

/// Allowed categories for claims emitted on the debate board.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum ClaimKind {
    #[serde(rename = "decision")]
    Decision,
    #[serde(rename = "risk")]
    Risk,
    #[serde(rename = "fact")]
    Fact,
    #[serde(rename = "question")]
    Question,
}

impl ClaimKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Decision => "decision",
            Self::Risk => "risk",
            Self::Fact => "fact",
            Self::Question => "question",
        }
    }

    pub fn from_str_opt(s: &str) -> Self {
        match s.trim().to_lowercase().as_str() {
            "decision" => Self::Decision,
            "risk" => Self::Risk,
            "question" => Self::Question,
            _ => Self::Fact,
        }
    }
}

/// Permitted reaction stances toward an existing board claim.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum ReactStance {
    #[serde(rename = "agree")]
    Agree,
    #[serde(rename = "object")]
    Object,
    #[serde(rename = "refine")]
    Refine,
    #[serde(rename = "withdraw")]
    Withdraw,
}

impl ReactStance {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Agree => "agree",
            Self::Object => "object",
            Self::Refine => "refine",
            Self::Withdraw => "withdraw",
        }
    }

    pub fn from_str_opt(s: &str) -> Option<Self> {
        match s.trim().to_lowercase().as_str() {
            "agree" => Some(Self::Agree),
            "object" => Some(Self::Object),
            "refine" => Some(Self::Refine),
            "withdraw" => Some(Self::Withdraw),
            _ => None,
        }
    }
}

/// Computed status of a debate board claim.
/// Status is strictly evaluated and cannot be self-declared by any single agent.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum ClaimStatus {
    #[serde(rename = "agreed")]
    Agreed,
    #[serde(rename = "uncontested")]
    Uncontested,
    #[serde(rename = "disputed")]
    Disputed,
    #[serde(rename = "withdrawn")]
    Withdrawn,
}

impl ClaimStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Agreed => "agreed",
            Self::Uncontested => "uncontested",
            Self::Disputed => "disputed",
            Self::Withdrawn => "withdrawn",
        }
    }
}

/// A structured claim registered on the shared debate board.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BoardClaim {
    pub id: String, // e.g. "C1", "C2"
    pub author_agent_id: String,
    pub author_role: String,
    pub round: u32,
    pub turn_index: u32,
    pub message_id: String,
    pub text: String,
    pub kind: ClaimKind,
    pub status: ClaimStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_paragraph: Option<String>,
}

/// An agent's recorded reaction to a registered claim.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BoardReaction {
    pub claim_id: String,
    pub author_agent_id: String,
    pub author_role: String,
    pub round: u32,
    pub stance: ReactStance,
    pub why: String,
    pub message_id: String,
}

/// Latest stance card for a single participant (older cards are dropped).
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct AgentPositionCard {
    pub agent_id: String,
    pub role: String,
    pub round: u32,
    pub position: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct RawHandoffClaim {
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub kind: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct RawHandoffReact {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub stance: Option<String>,
    #[serde(default)]
    pub why: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct RawBoardStateBlock {
    #[serde(default)]
    pub position: Option<String>,
    #[serde(default)]
    pub claims: Vec<RawHandoffClaim>,
    #[serde(default)]
    pub reacts: Vec<RawHandoffReact>,
    #[serde(default)]
    pub needs: Vec<String>,
}

/// Staged updates accumulated during a multi-agent round to preserve the round barrier.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct StagedTurnUpdate {
    pub message_id: String,
    pub agent_id: String,
    pub role: String,
    pub round: u32,
    pub turn_index: u32,
    pub position: Option<String>,
    pub claims: Vec<RawHandoffClaim>,
    pub reacts: Vec<RawHandoffReact>,
    pub needs: Vec<String>,
    pub source_paragraphs: Vec<(String, String)>,
}

/// Complete in-memory and on-disk Debate Board state.
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct DebateBoardState {
    pub claims: Vec<BoardClaim>,
    pub reactions: Vec<BoardReaction>,
    pub positions: HashMap<String, AgentPositionCard>,
    pub applied_message_ids: HashSet<String>,
    pub source_paragraphs: HashMap<String, String>,
    pub staged_round_updates: Vec<StagedTurnUpdate>,
    pub agent_pending_needs: HashMap<String, Vec<String>>,
    pub next_claim_num: u32,
    pub last_status_hash: String,
    pub consecutive_unchanged_cycles: u32,
    pub fallback_count: u32,
    pub total_turns_processed: u32,
}

impl DebateBoardState {
    pub fn new() -> Self {
        Self {
            next_claim_num: 1,
            ..Default::default()
        }
    }

    /// Load or initialize the board state from `.flymd/discussions/<session_id>/board_state.json`.
    pub fn load_or_init(session_dir: &Path) -> Self {
        let path = session_dir.join("board_state.json");
        if path.exists() {
            if let Ok(bytes) = fs::read(&path) {
                if let Ok(state) = serde_json::from_slice::<DebateBoardState>(&bytes) {
                    return state;
                }
            }
        }
        Self::new()
    }

    /// Persist board state atomically to disk.
    pub fn save(&self, session_dir: &Path) -> Result<(), String> {
        let path = session_dir.join("board_state.json");
        atomic_write_json(&path, self)
    }

    /// Extracts the first clean paragraph from turn output for bad block fallback.
    pub fn extract_fallback_position(clean_markdown: &str) -> String {
        let mut paragraph = String::new();
        for line in clean_markdown.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with("---") {
                if !paragraph.is_empty() {
                    break;
                }
                continue;
            }
            if trimmed.starts_with("Response:") || trimmed.starts_with("Summary:") {
                continue;
            }
            if !paragraph.is_empty() {
                paragraph.push(' ');
            }
            paragraph.push_str(trimmed);
            if paragraph.len() >= 300 {
                break;
            }
        }
        if paragraph.is_empty() {
            "Maintains initial domain perspective and review parameters.".to_string()
        } else {
            paragraph
        }
    }

    /// Parses `<handoff_state>` JSON block or applies fallback line extraction.
    pub fn parse_turn_block(
        raw_markdown: &str,
        clean_markdown: &str,
    ) -> (RawBoardStateBlock, bool) {
        let lower = raw_markdown.to_ascii_lowercase();
        if let Some(start) = lower.find("<handoff_state>") {
            let content_start = start + "<handoff_state>".len();
            if let Some(rel_end) = lower[content_start..].find("</handoff_state>") {
                let json_str = raw_markdown[content_start..content_start + rel_end]
                    .trim()
                    .trim_start_matches("```json")
                    .trim_start_matches("```")
                    .trim_end_matches("```")
                    .trim();

                if let Ok(mut parsed) = serde_json::from_str::<RawBoardStateBlock>(json_str) {
                    // Limits: max 8 claims, max 8 reacts
                    parsed.claims.truncate(8);
                    parsed.reacts.truncate(8);
                    parsed.needs.truncate(8);
                    return (parsed, false);
                }
            }
        }

        // Fallback: cleaned line filter for position card, no claims
        let fallback_pos = Self::extract_fallback_position(clean_markdown);
        (
            RawBoardStateBlock {
                position: Some(fallback_pos),
                claims: Vec::new(),
                reacts: Vec::new(),
                needs: Vec::new(),
            },
            true,
        )
    }

    /// Ingests an agent turn. If `is_multi_agent_round` is true, stages the update
    /// until the round barrier triggers `commit_staged_round_updates`.
    #[allow(clippy::too_many_arguments)]
    pub fn ingest_turn(
        &mut self,
        message_id: &str,
        agent_id: &str,
        role: &str,
        round: u32,
        turn_index: u32,
        raw_markdown: &str,
        clean_markdown: &str,
        is_multi_agent_round: bool,
        roster_agent_ids: &[String],
    ) {
        if self.applied_message_ids.contains(message_id) {
            return;
        }

        self.total_turns_processed += 1;
        let (parsed_block, is_fallback) = Self::parse_turn_block(raw_markdown, clean_markdown);
        if is_fallback {
            self.fallback_count += 1;
        }

        // Match claims to source paragraphs from clean markdown
        let mut source_paragraphs = Vec::new();
        for claim in &parsed_block.claims {
            if let Some(p) = find_best_source_paragraph(clean_markdown, &claim.text) {
                source_paragraphs.push((claim.text.clone(), p));
            }
        }

        let update = StagedTurnUpdate {
            message_id: message_id.to_string(),
            agent_id: agent_id.to_string(),
            role: role.to_string(),
            round,
            turn_index,
            position: parsed_block.position,
            claims: parsed_block.claims,
            reacts: parsed_block.reacts,
            needs: parsed_block.needs,
            source_paragraphs,
        };

        if is_multi_agent_round {
            self.staged_round_updates.push(update);
        } else {
            self.apply_single_update(update, roster_agent_ids);
            self.recompute_statuses(roster_agent_ids, round);
        }
    }

    /// Commits all staged updates when a multi-agent round concludes.
    pub fn commit_staged_round_updates(&mut self, roster_agent_ids: &[String], round: u32) {
        let staged = std::mem::take(&mut self.staged_round_updates);
        for update in staged {
            self.apply_single_update(update, roster_agent_ids);
        }
        self.recompute_statuses(roster_agent_ids, round);
    }

    fn apply_single_update(&mut self, update: StagedTurnUpdate, _roster_agent_ids: &[String]) {
        self.applied_message_ids.insert(update.message_id.clone());

        // 1. Update position card (latest stance only per agent)
        if let Some(pos) = update.position {
            let trimmed = pos.trim().to_string();
            if !trimmed.is_empty() {
                self.positions.insert(
                    update.agent_id.clone(),
                    AgentPositionCard {
                        agent_id: update.agent_id.clone(),
                        role: update.role.clone(),
                        round: update.round,
                        position: trimmed,
                    },
                );
            }
        }

        // 2. Add new claims with assigned IDs ("C1", "C2", ...)
        for raw_claim in update.claims {
            let text = raw_claim.text.trim().to_string();
            if text.is_empty() {
                continue;
            }
            // Avoid duplicate claim text from same author
            if self
                .claims
                .iter()
                .any(|c| c.author_agent_id == update.agent_id && c.text == text)
            {
                continue;
            }

            let id = format!("C{}", self.next_claim_num);
            self.next_claim_num += 1;

            let kind = raw_claim
                .kind
                .as_deref()
                .map(ClaimKind::from_str_opt)
                .unwrap_or(ClaimKind::Fact);

            let src_para = update
                .source_paragraphs
                .iter()
                .find(|(ct, _)| ct == &text)
                .map(|(_, p)| p.clone());

            if let Some(ref sp) = src_para {
                self.source_paragraphs.insert(id.clone(), sp.clone());
            }

            self.claims.push(BoardClaim {
                id,
                author_agent_id: update.agent_id.clone(),
                author_role: update.role.clone(),
                round: update.round,
                turn_index: update.turn_index,
                message_id: update.message_id.clone(),
                text,
                kind,
                status: ClaimStatus::Disputed, // starts disputed until evaluated
                source_paragraph: src_para,
            });
        }

        // 3. Record reactions
        for raw_react in update.reacts {
            let claim_id = raw_react.id.trim().to_uppercase();
            if claim_id.is_empty() {
                continue;
            }
            let Some(stance) = raw_react.stance.as_deref().and_then(ReactStance::from_str_opt) else {
                continue;
            };

            let why = raw_react.why.unwrap_or_default().trim().to_string();
            self.reactions.push(BoardReaction {
                claim_id,
                author_agent_id: update.agent_id.clone(),
                author_role: update.role.clone(),
                round: update.round,
                stance,
                why,
                message_id: update.message_id.clone(),
            });
        }

        // 4. Record any requested needs for this agent's next turn
        if !update.needs.is_empty() {
            self.agent_pending_needs
                .insert(update.agent_id.clone(), update.needs);
        }
    }

    /// Gets context for claims requested by an agent via `needs` in their previous turn.
    pub fn get_needs_context_for_agent(&self, agent_id: &str) -> String {
        if let Some(needs_ids) = self.agent_pending_needs.get(agent_id) {
            self.build_needs_context(needs_ids)
        } else {
            String::new()
        }
    }

    /// Consumes/clears pending needs after context has been delivered to an agent turn.
    pub fn consume_pending_needs(&mut self, agent_id: &str) {
        self.agent_pending_needs.remove(agent_id);
    }

    /// Recomputes claim statuses according to Section 3.3 rules.
    pub fn recompute_statuses(&mut self, roster_agent_ids: &[String], current_round: u32) {
        let total_claims = self.claims.len();
        for claim in &mut self.claims {
            let claim_reactions: Vec<&BoardReaction> = self
                .reactions
                .iter()
                .filter(|r| r.claim_id.eq_ignore_ascii_case(&claim.id))
                .collect();

            // 1. Withdrawn: author withdrew it
            let is_withdrawn = claim_reactions
                .iter()
                .any(|r| r.author_agent_id == claim.author_agent_id && r.stance == ReactStance::Withdraw);
            if is_withdrawn {
                claim.status = ClaimStatus::Withdrawn;
                continue;
            }

            // 2. Disputed: an objection or unaccepted refine is open
            let has_objection = claim_reactions.iter().any(|r| r.stance == ReactStance::Object);
            let has_unaccepted_refine = claim_reactions
                .iter()
                .any(|r| r.stance == ReactStance::Refine);

            if has_objection || has_unaccepted_refine {
                claim.status = ClaimStatus::Disputed;
                continue;
            }

            // 3. Agreed: another agent agreed and nothing is open
            let other_agree = claim_reactions.iter().any(|r| {
                r.author_agent_id != claim.author_agent_id && r.stance == ReactStance::Agree
            });
            if other_agree {
                claim.status = ClaimStatus::Agreed;
                continue;
            }

            // 4. Uncontested: every other participant has had a turn since the claim appeared with no reaction
            let other_roster: Vec<&String> = roster_agent_ids
                .iter()
                .filter(|id| *id != &claim.author_agent_id)
                .collect();

            let all_others_have_spoken_since = !other_roster.is_empty()
                && other_roster.iter().all(|other_id| {
                    self.positions.get(*other_id).map(|p| p.round >= claim.round).unwrap_or(false)
                        && (current_round > claim.round || total_claims > 1)
                });

            if all_others_have_spoken_since {
                claim.status = ClaimStatus::Uncontested;
            } else {
                claim.status = ClaimStatus::Disputed;
            }
        }

        // Update status hash for early convergence detection
        let mut status_fingerprint = String::new();
        for c in &self.claims {
            status_fingerprint.push_str(&format!("{}:{};", c.id, c.status.as_str()));
        }
        if status_fingerprint == self.last_status_hash && !self.claims.is_empty() {
            self.consecutive_unchanged_cycles += 1;
        } else {
            self.last_status_hash = status_fingerprint;
            self.consecutive_unchanged_cycles = 0;
        }
    }

    /// Checks if a full cycle of participants passed with no new claims and no status changes.
    pub fn is_early_converged(&self, roster_len: usize) -> bool {
        if roster_len == 0 || self.claims.is_empty() {
            return false;
        }
        self.consecutive_unchanged_cycles >= roster_len as u32
    }

    /// Formats the frozen Topic Card (Protocol, Topic, Proposal, Roster, Index, Recall).
    pub fn build_topic_card(
        topic: &str,
        user_idea: &str,
        participants: &[DiscussionParticipant],
        workspace_path: &Path,
        project_recall_pack: Option<&str>,
    ) -> String {
        let mut s = String::new();
        s.push_str(
            "# FlyMD Multi-Agent Deliberation Protocol (Frozen Topic Card)\n\
             - Refer to board claims by exact id (`C1`, `C2`, ...). Do NOT restate them.\n\
             - Write only what changes the board. State concrete facts, decisions, risks, or questions.\n\
             - Write in the language of the user's proposal.\n\
             - Never fabricate file paths, APIs, or unverified runtime capabilities.\n\n",
        );
        s.push_str(&format!("## Discussion Topic\n{}\n\n", topic.trim()));
        s.push_str(&format!(
            "## Immutable User Proposal & Constraints\n{}\n\n",
            user_idea.trim()
        ));

        s.push_str("## Active Participant Roster (Route Messages by Exact ID)\n");
        for p in participants {
            s.push_str(&format!(
                "- `@{} ({})`: {}\n",
                p.agent_id,
                p.role.as_str(),
                p.display_name
            ));
        }
        s.push('\n');

        let live_digest = crate::projects::cache::scan_workspace_digest(workspace_path, 32);
        if !live_digest.is_empty() {
            s.push_str("## Workspace File Index (Verified SHA-256)\n");
            for d in live_digest.values().take(24) {
                s.push_str(&format!(
                    "- `{}` ({} bytes, sha256: `{}`)\n",
                    d.rel_path,
                    d.bytes,
                    &d.sha256[..12.min(d.sha256.len())]
                ));
            }
            s.push('\n');
        }

        if let Some(recall) = project_recall_pack {
            if !recall.trim().is_empty() {
                s.push_str("## Project Recall Invariants (Shared Workspace Memory)\n");
                s.push_str(recall.trim());
                s.push_str("\n\n");
            }
        }

        s
    }

    /// Formats the Debate Board snapshot.
    /// Tight budget: Disputed claims never cut; Agreed claims stay one line; Withdrawn keep only ID.
    pub fn build_board_snapshot(&self) -> String {
        let mut s = String::new();
        s.push_str("## Active Debate Board Snapshot\n");
        if self.claims.is_empty() {
            s.push_str("*(Board is currently empty — formulate initial baseline positions and register claims)*\n\n");
            return s;
        }

        for c in &self.claims {
            match c.status {
                ClaimStatus::Withdrawn => {
                    s.push_str(&format!("- [{}] *(withdrawn)*\n", c.id));
                }
                ClaimStatus::Agreed => {
                    s.push_str(&format!(
                        "- [{}] `[agreed - {}]` {}\n",
                        c.id,
                        c.kind.as_str(),
                        c.text
                    ));
                }
                ClaimStatus::Uncontested => {
                    s.push_str(&format!(
                        "- [{}] `[uncontested - {}]` {}\n",
                        c.id,
                        c.kind.as_str(),
                        c.text
                    ));
                }
                ClaimStatus::Disputed => {
                    s.push_str(&format!(
                        "- [{}] `[disputed - {}]` {}\n",
                        c.id,
                        c.kind.as_str(),
                        c.text
                    ));
                    // Include any open objections/refines concisely
                    for r in self
                        .reactions
                        .iter()
                        .filter(|r| r.claim_id.eq_ignore_ascii_case(&c.id))
                    {
                        if r.stance == ReactStance::Object || r.stance == ReactStance::Refine {
                            s.push_str(&format!(
                                "  * @{} ({}): {}\n",
                                r.author_agent_id,
                                r.stance.as_str(),
                                r.why
                            ));
                        }
                    }
                }
            }
        }
        s.push('\n');
        s
    }

    /// Formats Position Cards (latest stance only per agent).
    pub fn build_position_cards_snapshot(&self) -> String {
        let mut s = String::new();
        s.push_str("## Latest Participant Positions\n");
        if self.positions.is_empty() {
            s.push_str("*(No prior positions submitted)*\n\n");
            return s;
        }

        let mut sorted_keys: Vec<&String> = self.positions.keys().collect();
        sorted_keys.sort();
        for k in sorted_keys {
            if let Some(card) = self.positions.get(k) {
                s.push_str(&format!(
                    "### `@{} ({})` — Round {}\n{}\n\n",
                    card.agent_id, card.role, card.round, card.position
                ));
            }
        }
        s
    }

    /// Builds context for requested claims via `needs` (up to ~1,500 tokens).
    pub fn build_needs_context(&self, requested_claim_ids: &[String]) -> String {
        if requested_claim_ids.is_empty() {
            return String::new();
        }
        let mut s = String::new();
        s.push_str("### Requested Claim Source Context (`needs`)\n");
        let mut tokens_used = 0;
        for id in requested_claim_ids {
            let clean_id = id.trim().to_uppercase();
            if let Some(para) = self.source_paragraphs.get(&clean_id) {
                let para_tokens = MemoryManager::estimate_tokens_by_script(para);
                if tokens_used + para_tokens > 1500 {
                    s.push_str(&format!("- **[{}]**: *(Context truncated to preserve token budget)*\n\n", clean_id));
                    break;
                }
                tokens_used += para_tokens;
                s.push_str(&format!("#### Context for Claim [{}]\n{}\n\n", clean_id, para.trim()));
            }
        }
        s
    }

    /// Synchronizes board state with existing `decisions.json` and `disagreements.json`.
    pub fn sync_to_existing_files(&self, memory: &MemoryManager) -> Result<(), String> {
        let mut decisions = Vec::new();
        for c in &self.claims {
            if c.status == ClaimStatus::Agreed || c.status == ClaimStatus::Uncontested {
                let agreed_by: Vec<String> = self
                    .reactions
                    .iter()
                    .filter(|r| r.claim_id.eq_ignore_ascii_case(&c.id) && r.stance == ReactStance::Agree)
                    .map(|r| r.author_agent_id.clone())
                    .collect();

                let mut citations = vec![format!("claim-{}", c.id)];
                citations.push(format!("round-{}", c.round));

                decisions.push(DecisionItem {
                    id: format!("decision-{}", c.id),
                    topic: format!("[{}] {}", c.id, c.text),
                    decision: c.text.clone(),
                    rationale: format!(
                        "Status: {} via Debate Board Claim {} (Kind: {})",
                        c.status.as_str(),
                        c.id,
                        c.kind.as_str()
                    ),
                    agreed_by_agents: if agreed_by.is_empty() {
                        vec![c.author_agent_id.clone()]
                    } else {
                        agreed_by
                    },
                    agreed_round: c.round,
                    evidence_citations: citations,
                });
            }
        }
        memory.save_decisions(&decisions)?;

        let mut disagreements = Vec::new();
        for c in &self.claims {
            if c.status == ClaimStatus::Disputed {
                let mut agent_stances = HashMap::new();
                for r in self
                    .reactions
                    .iter()
                    .filter(|r| r.claim_id.eq_ignore_ascii_case(&c.id))
                {
                    agent_stances.insert(
                        r.author_agent_id.clone(),
                        format!("[{}] {}", r.stance.as_str(), r.why),
                    );
                }
                disagreements.push(DisagreementItem {
                    id: format!("dispute-{}", c.id),
                    topic: format!("[{}] {}", c.id, c.text),
                    agent_stances,
                    status: DisagreementStatus::UnresolvedDivergence,
                    resolution_notes: None,
                    round_first_observed: c.round,
                    round_last_updated: c.round,
                });
            }
        }
        memory.save_disagreements(&disagreements)?;

        Ok(())
    }

    /// Generates `decision-brief.md` at debate completion.
    pub fn write_decision_brief(
        &self,
        session_dir: &Path,
        topic: &str,
        user_idea: &str,
        session_id: &str,
        total_rounds: u32,
        report_path: &str,
    ) -> Result<PathBuf, String> {
        let mut md = String::new();
        md.push_str("# Multi-Agent Architectural Deliberation — Decision Brief\n\n");
        md.push_str(&format!("- **Discussion Topic**: {}\n", topic.trim()));
        md.push_str(&format!("- **Session ID**: `{}`\n", session_id));
        md.push_str(&format!("- **Deliberation Rounds**: {}\n", total_rounds));
        md.push_str(&format!(
            "- **Full Canonical Report**: `{}`\n\n---\n\n",
            report_path
        ));

        md.push_str("## 1. Goal & Core Constraints\n\n");
        md.push_str(user_idea.trim());
        md.push_str("\n\n---\n\n");

        md.push_str("## 2. Agreed Architectural Decisions\n\n");
        let agreed_claims: Vec<&BoardClaim> = self
            .claims
            .iter()
            .filter(|c| c.status == ClaimStatus::Agreed || c.status == ClaimStatus::Uncontested)
            .collect();

        if agreed_claims.is_empty() {
            md.push_str("*(No claims reached consensus)*\n\n");
        } else {
            for c in agreed_claims {
                md.push_str(&format!(
                    "- **[{}]** ({}): {}\n",
                    c.id,
                    c.status.as_str(),
                    c.text
                ));
            }
            md.push('\n');
        }

        md.push_str("## 3. Open Disputes Requiring User Direction\n\n");
        let disputed_claims: Vec<&BoardClaim> = self
            .claims
            .iter()
            .filter(|c| c.status == ClaimStatus::Disputed)
            .collect();

        if disputed_claims.is_empty() {
            md.push_str("*(All registered claims were resolved without outstanding dispute)*\n\n");
        } else {
            for c in disputed_claims {
                md.push_str(&format!("### Dispute [{}]: {}\n", c.id, c.text));
                for r in self
                    .reactions
                    .iter()
                    .filter(|r| r.claim_id.eq_ignore_ascii_case(&c.id))
                {
                    md.push_str(&format!(
                        "- `@{} ({})`: {}\n",
                        r.author_agent_id,
                        r.stance.as_str(),
                        r.why
                    ));
                }
                md.push('\n');
            }
        }

        md.push_str("## 4. Withdrawn Options\n\n");
        let withdrawn_claims: Vec<&BoardClaim> = self
            .claims
            .iter()
            .filter(|c| c.status == ClaimStatus::Withdrawn)
            .collect();

        if withdrawn_claims.is_empty() {
            md.push_str("*(No options were withdrawn)*\n\n");
        } else {
            for c in withdrawn_claims {
                md.push_str(&format!("- [{}] {}\n", c.id, c.text));
            }
            md.push('\n');
        }

        md.push_str("## 5. Identified Architectural Risks\n\n");
        let risks: Vec<&BoardClaim> = self
            .claims
            .iter()
            .filter(|c| c.kind == ClaimKind::Risk)
            .collect();
        if risks.is_empty() {
            md.push_str("*(No explicit risks registered)*\n\n");
        } else {
            for r in risks {
                md.push_str(&format!("- **[{}]** ({}) {}\n", r.id, r.status.as_str(), r.text));
            }
            md.push('\n');
        }

        let out_path = session_dir.join("decision-brief.md");
        fs::write(&out_path, &md).map_err(|e| format!("Failed to write decision brief: {}", e))?;
        Ok(out_path)
    }
}

/// Helper to extract best-matching source paragraph for a claim text from Markdown.
fn find_best_source_paragraph(markdown: &str, claim_text: &str) -> Option<String> {
    let words: Vec<&str> = claim_text
        .split_whitespace()
        .filter(|w| w.len() > 3)
        .take(5)
        .collect();

    let mut best_para: Option<String> = None;
    let mut best_score = 0;

    for block in markdown.split("\n\n") {
        let trimmed = block.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with("<") {
            continue;
        }
        let score = words.iter().filter(|w| trimmed.contains(*w)).count();
        if score > best_score && score >= 2 {
            best_score = score;
            best_para = Some(trimmed.to_string());
        }
    }

    best_para
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_board_status_transitions() {
        let mut board = DebateBoardState::new();
        let roster = vec!["agent-a".to_string(), "agent-b".to_string(), "agent-c".to_string()];

        // Turn 1: agent-a introduces C1 (Decision)
        let raw_t1 = r#"
Here is my analysis.
<handoff_state>
{
  "position": "Advocate for modular SQLite architecture.",
  "claims": [{"text": "Adopt SQLite with WAL mode", "kind": "decision"}],
  "reacts": [],
  "needs": []
}
</handoff_state>"#;

        board.ingest_turn("msg-1", "agent-a", "Architect", 1, 1, raw_t1, "Here is my analysis.", false, &roster);
        assert_eq!(board.claims.len(), 1);
        assert_eq!(board.claims[0].id, "C1");
        assert_eq!(board.claims[0].status, ClaimStatus::Disputed); // pending review

        // Turn 2: agent-b agrees with C1
        let raw_t2 = r#"
Reviewed C1.
<handoff_state>
{
  "position": "Agree with SQLite persistence strategy.",
  "claims": [],
  "reacts": [{"id": "C1", "stance": "agree", "why": "High read performance."}],
  "needs": []
}
</handoff_state>"#;

        board.ingest_turn("msg-2", "agent-b", "Implementer", 1, 2, raw_t2, "Reviewed C1.", false, &roster);
        assert_eq!(board.claims[0].status, ClaimStatus::Agreed);

        // Turn 3: agent-c objects to C1 -> status becomes disputed
        let raw_t3 = r#"
Challenging C1.
<handoff_state>
{
  "position": "SQLite concurrency may bottleneck background workers.",
  "claims": [],
  "reacts": [{"id": "C1", "stance": "object", "why": "Single writer lock contention."}],
  "needs": []
}
</handoff_state>"#;

        board.ingest_turn("msg-3", "agent-c", "Critic", 1, 3, raw_t3, "Challenging C1.", false, &roster);
        assert_eq!(board.claims[0].status, ClaimStatus::Disputed);
    }

    #[test]
    fn test_uncontested_claim_after_cycle() {
        let mut board = DebateBoardState::new();
        let roster = vec!["agent-a".to_string(), "agent-b".to_string()];

        // Turn 1: agent-a introduces C1 (Fact)
        let raw_t1 = r#"
<handoff_state>
{
  "position": "Baseline facts.",
  "claims": [{"text": "POSIX file locks are unsupported on WASM", "kind": "fact"}],
  "reacts": [],
  "needs": []
}
</handoff_state>"#;

        board.ingest_turn("msg-1", "agent-a", "Architect", 1, 1, raw_t1, "Baseline facts.", false, &roster);
        assert_eq!(board.claims[0].status, ClaimStatus::Disputed);

        // Turn 2: agent-b speaks, submits position, but does not react to C1
        let raw_t2 = r#"
<handoff_state>
{
  "position": "Focus on frontend contracts.",
  "claims": [],
  "reacts": [],
  "needs": []
}
</handoff_state>"#;

        board.ingest_turn("msg-2", "agent-b", "Implementer", 2, 2, raw_t2, "Focus on frontend contracts.", false, &roster);
        // agent-b had a turn since C1 appeared with no objection -> becomes uncontested!
        assert_eq!(board.claims[0].status, ClaimStatus::Uncontested);
    }

    #[test]
    fn test_bad_block_fallback_preserves_position() {
        let mut board = DebateBoardState::new();
        let roster = vec!["agent-a".to_string()];

        // Raw output without <handoff_state> or broken json
        let raw_text = "### Position Statement\nWe must ensure zero runtime regressions.\n\nAdditional comments.";
        board.ingest_turn("msg-bad", "agent-a", "Architect", 1, 1, raw_text, raw_text, false, &roster);

        assert_eq!(board.fallback_count, 1);
        assert!(board.positions.contains_key("agent-a"));
        assert!(board.positions.get("agent-a").unwrap().position.contains("zero runtime regressions"));
        assert_eq!(board.claims.len(), 0);
    }

    #[test]
    fn test_decision_brief_generation() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_brief_test_{}", crate::agents::now_ms()));
        fs::create_dir_all(&temp_dir).unwrap();

        let mut board = DebateBoardState::new();
        board.claims.push(BoardClaim {
            id: "C1".to_string(),
            author_agent_id: "agent-a".to_string(),
            author_role: "Architect".to_string(),
            round: 1,
            turn_index: 1,
            message_id: "m1".to_string(),
            text: "Decouple state from view".to_string(),
            kind: ClaimKind::Decision,
            status: ClaimStatus::Agreed,
            source_paragraph: None,
        });

        let brief_path = board
            .write_decision_brief(
                &temp_dir,
                "State Isolation",
                "Build state layer",
                "disc-123",
                3,
                "reports/report.md",
            )
            .unwrap();

        assert!(brief_path.exists());
        let content = fs::read_to_string(&brief_path).unwrap();
        assert!(content.contains("# Multi-Agent Architectural Deliberation — Decision Brief"));
        assert!(content.contains("[C1]"));
        assert!(content.contains("Decouple state from view"));

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
