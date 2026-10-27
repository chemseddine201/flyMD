//! Memory and Context Manager: decision ledger, disagreement registry, and budget-constrained context assembly.

use super::storage::{atomic_write_json, read_transcript_with_recovery};
use super::types::{now_ms, DecisionItem, DisagreementItem, DisagreementStatus, DiscussionMessage};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

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
}
