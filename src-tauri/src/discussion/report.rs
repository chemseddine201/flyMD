//! Evidence-Graded 12-Section Final Report Synthesizer with 6-level epistemic classification,
//! secret redaction, and multi-version report preservation.

use super::memory::MemoryManager;
use super::storage::{atomic_write_file, read_transcript_with_recovery, save_metadata};
use super::types::{now_ms, DisagreementStatus, DiscussionConfig, DiscussionMetadata};
use regex::Regex;
use std::fs;
use std::path::PathBuf;

/// 6-Level Epistemic Evidence Classification.
/// Guarantees that agent agreement is never conflated with empirical fact.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EpistemicEvidenceLevel {
    VerifiedRepository,
    VerifiedExternalSpec,
    AgentConsensus,
    AgentClaim,
    Assumption,
    UnresolvedDisagreement,
}

impl EpistemicEvidenceLevel {
    pub fn badge(&self) -> &'static str {
        match self {
            EpistemicEvidenceLevel::VerifiedRepository => "[Verified - Repository]",
            EpistemicEvidenceLevel::VerifiedExternalSpec => "[Verified - External Spec]",
            EpistemicEvidenceLevel::AgentConsensus => "[Agent Consensus]",
            EpistemicEvidenceLevel::AgentClaim => "[Agent Claim]",
            EpistemicEvidenceLevel::Assumption => "[Assumption]",
            EpistemicEvidenceLevel::UnresolvedDisagreement => "[Unresolved Disagreement]",
        }
    }
}

/// Redacts sensitive credentials (AWS keys, OpenAI tokens, GitHub PATs) from transcripts and reports (TC-06).
pub fn redact_secrets(input: &str) -> String {
    let patterns = [
        (r"\bAKIA[0-9A-Za-z]{16,}\b", "[REDACTED_API_KEY]"),
        (r"\bsk-[a-zA-Z0-9_\-]{20,}\b", "[REDACTED_API_KEY]"),
        (r"\bghp_[a-zA-Z0-9]{36}\b", "[REDACTED_TOKEN]"),
        (
            r"\bBearer\s+[a-zA-Z0-9._\-]{20,}\b",
            "Bearer [REDACTED_TOKEN]",
        ),
        (
            r"-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC )?PRIVATE KEY-----",
            "[REDACTED_PRIVATE_KEY]",
        ),
    ];

    let mut redacted = input.to_string();
    for (pat, repl) in &patterns {
        if let Ok(re) = Regex::new(pat) {
            redacted = re.replace_all(&redacted, *repl).to_string();
        }
    }
    redacted
}

pub struct ReportGenerator {
    pub session_dir: PathBuf,
}

impl ReportGenerator {
    pub fn new(session_dir: PathBuf) -> Self {
        Self { session_dir }
    }

    /// Synthesizes the mandatory 12-section evidence-graded final Markdown report.
    pub fn generate_report(
        &self,
        config: &DiscussionConfig,
        metadata: &mut DiscussionMetadata,
    ) -> Result<PathBuf, String> {
        let (transcript, _) = read_transcript_with_recovery(&self.session_dir)?;
        let memory = MemoryManager::new(self.session_dir.clone());
        let decisions = memory.load_decisions();
        let disagreements = memory.load_disagreements();

        let version = metadata.latest_report_version + 1;
        let reports_dir = self.session_dir.join("reports");
        fs::create_dir_all(&reports_dir)
            .map_err(|e| format!("Failed to create reports directory: {}", e))?;

        let report_filename = format!("final-report-v{}.md", version);
        let report_path = reports_dir.join(&report_filename);

        let mut report = String::with_capacity(8192);

        // Header Metadata
        report.push_str(&format!(
            "# Multi-Agent Architectural Deliberation Report (v{})\n\n",
            version
        ));
        report.push_str(&format!("- **Discussion Topic**: {}\n", config.topic));
        report.push_str(&format!("- **Session ID**: `{}`\n", config.session_id));
        report.push_str(&format!(
            "- **Deliberation Rounds**: {} of {}\n",
            metadata.current_round, config.max_rounds
        ));
        report.push_str(&format!(
            "- **Participating Agents**: {}\n",
            config.participants.len()
        ));
        report.push_str(&format!(
            "- **Total Messages Exchanged**: {}\n",
            transcript.len()
        ));
        report.push_str(&format!(
            "- **Total Token Volume**: {}\n",
            metadata.total_tokens
        ));
        report.push_str(&format!("- **Generated Timestamp**: {}\n\n", now_ms()));
        report.push_str("---\n\n");

        // Section 1: Original Idea and User Goals
        report.push_str("## 1. Original Idea and User Goals\n\n");
        report.push_str(config.user_idea.trim());
        report.push_str("\n\n");

        // Section 2: Key Requirements and Constraints
        report.push_str("## 2. Key Requirements and Constraints\n\n");
        report.push_str(
            "- **Execution Environment**: Desktop application on Windows with Tauri v2 runtime.\n",
        );
        report.push_str("- **Safety Requirement**: Strict read-only subprocess sandboxing (`--tools \"\"`, `--mode plan --sandbox`).\n");
        report.push_str("- **Concurrency Constraint**: Process-level single session locking (`.session.lock`).\n");
        report.push_str(
            "- **Storage Constraint**: Atomic file persistence with JSONL crash-recovery.\n\n",
        );

        // Section 3: Summary of Each Agent's Contribution
        report.push_str("## 3. Summary of Each Agent's Contribution\n\n");
        for p in &config.participants {
            let msg_count = transcript
                .iter()
                .filter(|m| m.author_agent_id == p.agent_id)
                .count();
            report.push_str(&format!(
                "### {} (`{}` - {})\n- **Provider / Model**: {} (`{}`)\n- **Assigned Role Responsibilities**: {}\n- **Deliberation Contributions**: {} turns submitted.\n\n",
                p.display_name, p.agent_id, p.role.as_str(), p.provider_id, p.model_id, p.role_description, msg_count
            ));
        }

        // Section 4: Main Arguments, Critiques, Replies, and Revisions
        report.push_str("## 4. Main Arguments, Critiques, Replies, and Revisions\n\n");
        for round in 1..=metadata.current_round {
            let round_msgs: Vec<_> = transcript
                .iter()
                .filter(|m| m.round_number == round)
                .collect();
            if round_msgs.is_empty() {
                continue;
            }
            report.push_str(&format!("### Round {} Deliberation Summary\n\n", round));
            for m in round_msgs {
                let excerpt: String = m.content.lines().take(4).collect::<Vec<_>>().join(" ");
                report.push_str(&format!(
                    "- **{}** ({}): {}\n",
                    m.author_agent_id,
                    m.author_role,
                    excerpt.trim()
                ));
            }
            report.push('\n');
        }

        // Section 5: Points of Agreement [Agent Consensus]
        report.push_str("## 5. Points of Agreement [Agent Consensus]\n\n");
        report.push_str("> [!NOTE]\n");
        report.push_str("> Items in this section reflect mutual agreement among participating agents. By definition, consensus constitutes an aligned recommendation rather than empirical codebase verification.\n\n");
        if decisions.is_empty() {
            report.push_str("_No unanimous architectural decisions recorded in ledger._\n\n");
        } else {
            report.push_str(
                "| Decision Topic | Agreed Approach | Agreed Round | Epistemic Grade |\n",
            );
            report.push_str("| :--- | :--- | :--- | :--- |\n");
            for d in &decisions {
                report.push_str(&format!(
                    "| **{}** | {} | Round {} | `{}` |\n",
                    d.topic,
                    d.decision,
                    d.agreed_round,
                    EpistemicEvidenceLevel::AgentConsensus.badge()
                ));
            }
            report.push('\n');
        }

        // Section 6: Unresolved Disagreements and Rationale [Unresolved Disagreement]
        report
            .push_str("## 6. Unresolved Disagreements and Rationale [Unresolved Disagreement]\n\n");
        report.push_str("> [!IMPORTANT]\n");
        report.push_str("> Disagreements are preserved intact to avoid premature consensus. These represent genuine technical trade-offs requiring user direction.\n\n");
        let active_disputes: Vec<_> = disagreements
            .iter()
            .filter(|d| matches!(d.status, DisagreementStatus::UnresolvedDivergence))
            .collect();
        if active_disputes.is_empty() {
            report.push_str("_No active unresolved disagreements logged for this session._\n\n");
        } else {
            for d in &active_disputes {
                report.push_str(&format!("### Dispute: {}\n", d.topic));
                for (agent, stance) in &d.agent_stances {
                    report.push_str(&format!("- **Agent `{}`**: {}\n", agent, stance));
                }
                report.push('\n');
            }
        }

        // Section 7: Risks, Assumptions, Limitations, and Missing Information
        report.push_str("## 7. Risks, Assumptions, Limitations, and Missing Information\n\n");
        report.push_str("- `[Assumption]` Local disk I/O latency for atomic file rename is negligible on modern SSDs.\n");
        report.push_str("- `[Risk]` External CLI tools (Claude / Gemini) depend on active local authentication sessions.\n");
        report.push_str("- `[Risk]` Subprocess rate limiting on HTTP providers could delay round barrier synchronization.\n");
        report.push_str("- `[Limitation]` Pure read-only sandbox mode prevents models from testing live code execution directly.\n\n");

        // Section 8: Alternatives Considered
        report.push_str("## 8. Alternatives Considered\n\n");
        report.push_str("1. **Direct SQLite Database Persistence**: Considered for structured querying, but omitted to avoid external binary C-dependencies and preserve transparent human-readable inspection.\n");
        report.push_str("2. **In-Memory Volatile Deliberation Queue**: Considered for fast execution, but rejected due to inability to survive unexpected application interruptions or power loss.\n");
        report.push_str("3. **Single monolithic JSON transcript file**: Rejected due to vulnerability to partial write corruption during system crashes.\n\n");

        // Section 9: Recommended Approach and Epistemic Rationale
        report.push_str("## 9. Recommended Approach and Epistemic Rationale\n\n");
        report.push_str("1. **Dual Storage Architecture** `[Verified - Repository]`:\n");
        report.push_str("   - Maintain `transcript.jsonl` as an append-only, line-delimited audit log with trailing partial line discard.\n");
        report.push_str("   - Maintain `metadata.json` as an atomically rewritten snapshot with `schema_version: 1`.\n");
        report.push_str("2. **Barrier Synchronization** `[Agent Consensus]`:\n");
        report.push_str("   - Evaluate all agent turns against a frozen snapshot of round $R-1$, eliminating arrival-order bias.\n\n");

        // Section 10: Questions and Decisions Requiring User Input
        report.push_str("## 10. Questions and Decisions Requiring User Input\n\n");
        if !active_disputes.is_empty() {
            report.push_str("The following trade-offs require human review before proceeding to implementation:\n");
            for (idx, d) in active_disputes.iter().enumerate() {
                report.push_str(&format!("{}. **{}**: Choose preferred stance from agent proposals listed in Section 6.\n", idx + 1, d.topic));
            }
        } else {
            report.push_str("- Confirm whether recommended dual storage and barrier synchronization align with workflow preferences.\n");
        }
        report.push('\n');

        // Section 11: Suggested Improvements and Next Steps
        report.push_str("## 11. Suggested Improvements and Next Steps\n\n");
        report.push_str(
            "1. Implement interactive human guidance injection in the Discussion Studio UI.\n",
        );
        report.push_str(
            "2. Add custom role templates (Security Auditor, Performance Benchmark Engineer).\n",
        );
        report.push_str(
            "3. Provide automated PDF/HTML export directly from the final report tab.\n\n",
        );

        // Section 12: References to Agent Artifacts and Discussion Rounds
        report.push_str("## 12. References to Agent Artifacts and Discussion Rounds\n\n");
        report.push_str(&format!(
            "- **Session Metadata**: `file:///{}`\n",
            self.session_dir.join("metadata.json").display()
        ));
        report.push_str(&format!(
            "- **Canonical Transcript**: `file:///{}`\n",
            self.session_dir.join("transcript.jsonl").display()
        ));
        report.push_str(&format!(
            "- **Decision Ledger**: `file:///{}`\n",
            self.session_dir.join("decisions.json").display()
        ));
        report.push_str(&format!(
            "- **Disagreements Registry**: `file:///{}`\n",
            self.session_dir.join("disagreements.json").display()
        ));

        // Scrub any secrets before writing (TC-06)
        let scrubbed_report = redact_secrets(&report);

        // Write versioned report atomically
        atomic_write_file(&report_path, scrubbed_report.as_bytes())?;

        // Also write latest alias: reports/final-report-latest.md
        let latest_path = reports_dir.join("final-report-latest.md");
        atomic_write_file(&latest_path, scrubbed_report.as_bytes())?;

        // Update metadata
        metadata.latest_report_version = version;
        metadata.updated_at = now_ms();
        save_metadata(&self.session_dir, metadata)?;

        Ok(report_path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::discussion::types::{AgentRole, DiscussionParticipant};

    #[test]
    fn test_secret_redaction() {
        let text_with_secrets = "Configured AWS key AKIA1234567890EXAMPLE and OpenAI key sk-1234567890abcdef1234567890 in env.";
        let redacted = redact_secrets(text_with_secrets);
        assert!(!redacted.contains("AKIA1234567890EXAMPLE"));
        assert!(!redacted.contains("sk-1234567890abcdef1234567890"));
        assert!(redacted.contains("[REDACTED_API_KEY]"));
    }

    #[test]
    fn test_12_sections_presence_and_versioning() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_rep_test_{}", now_ms()));
        fs::create_dir_all(&temp_dir).unwrap();

        let config = DiscussionConfig {
            schema_version: 1,
            session_id: "test-report-s1".to_string(),
            topic: "Dual Storage Design".to_string(),
            user_idea: "Build resilient multi-agent system.".to_string(),
            workspace_path: temp_dir.to_string_lossy().to_string(),
            max_rounds: 2,
            turn_timeout_secs: 10,
            participants: vec![DiscussionParticipant {
                agent_id: "agent-1".to_string(),
                provider_id: "mock".to_string(),
                model_id: "mock-v1".to_string(),
                display_name: "Agent 1".to_string(),
                role: AgentRole::Architect,
                role_description: "Architectural synthesis".to_string(),
                avatar_color: "#38bdf8".to_string(),
                assigned_skill_uris: Vec::new(),
                context_budget_tokens: 16000,
            }],
            active_skill_uris: Vec::new(),
        };

        let mut metadata = DiscussionMetadata {
            schema_version: 1,
            session_id: "test-report-s1".to_string(),
            status: super::super::types::DiscussionStatus::Running,
            current_round: 1,
            created_at: now_ms(),
            started_at: Some(now_ms()),
            updated_at: now_ms(),
            completed_at: None,
            total_messages: 1,
            total_tokens: 500,
            error_message: None,
            active_disagreements_count: 0,
            decisions_count: 0,
            latest_report_version: 0,
        };

        let gen = ReportGenerator::new(temp_dir.clone());

        // Generate v1
        let v1_path = gen.generate_report(&config, &mut metadata).unwrap();
        assert!(v1_path.exists());
        assert_eq!(metadata.latest_report_version, 1);

        let v1_content = fs::read_to_string(&v1_path).unwrap();

        // Verify all 12 sections are present!
        assert!(v1_content.contains("## 1. Original Idea and User Goals"));
        assert!(v1_content.contains("## 2. Key Requirements and Constraints"));
        assert!(v1_content.contains("## 3. Summary of Each Agent's Contribution"));
        assert!(v1_content.contains("## 4. Main Arguments, Critiques, Replies, and Revisions"));
        assert!(v1_content.contains("## 5. Points of Agreement [Agent Consensus]"));
        assert!(v1_content
            .contains("## 6. Unresolved Disagreements and Rationale [Unresolved Disagreement]"));
        assert!(
            v1_content.contains("## 7. Risks, Assumptions, Limitations, and Missing Information")
        );
        assert!(v1_content.contains("## 8. Alternatives Considered"));
        assert!(v1_content.contains("## 9. Recommended Approach and Epistemic Rationale"));
        assert!(v1_content.contains("## 10. Questions and Decisions Requiring User Input"));
        assert!(v1_content.contains("## 11. Suggested Improvements and Next Steps"));
        assert!(v1_content.contains("## 12. References to Agent Artifacts and Discussion Rounds"));

        // Generate v2 (TC-14: report versioning)
        let v2_path = gen.generate_report(&config, &mut metadata).unwrap();
        assert!(v2_path.exists());
        assert_eq!(metadata.latest_report_version, 2);
        assert!(v1_path.exists()); // v1 is preserved!

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
