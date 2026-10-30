//! Role-Aware Epistemic Router & Selective Re-Read Policy Engine.
//!
//! Decides deterministically whether a downstream agent (`Implementer`, `Explain`, etc.)
//! inherits verified comprehension directly from `.flymd/cache/cognitive_state.json`
//! (skipping redundant file scans and saving ~75–85% of exploration tokens), or whether
//! an adversarial/verification role (`Critic`, `Auditor`, `review`, `fix-bugs`) or a
//! cryptographic/dispute trigger requires inspecting raw disk slices and concluding an
//! independent résumé (`<independent_resume>`) before comparing against peer claims.

use super::types::AgentRole;
use crate::projects::cache::{
    format_compact_digest_markdown, read_targeted_file_slices, scan_workspace_digest,
    verify_cached_digests, CognitiveHandoffPacket, DigestVerificationReport,
};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EpistemicMode {
    /// First mover (`Architect`, `Researcher`, `refine-plan`) or cold workspace: builds canonical digest.
    PrimaryMapper,
    /// Debate Round 1: shares immutable workspace index at Token 0, isolates peer stances.
    IsolatedPosition,
    /// Trusted fast-path (`Implementer` / `build`, `explain`): inherits verified SHA-256 digest directly; skips re-reading untouched files.
    DirectInherit,
    /// Selective delta check (`write-tests`, hash drift, unverified assumptions, or disputed slices): inherits unchanged digest + reads only delta slices.
    DeltaVerify,
    /// Anti-confirmation-bias mode (`Critic`, `Auditor`, `review`): withholds upstream prose self-praise, reads raw code slices first, concludes own `<independent_resume>`.
    BlindIndependentAudit,
    /// Root-cause rebuild (`fix-bugs` or post-failure): marks prior mental model suspect, reads raw failing code, concludes fresh `<independent_resume>`.
    GroundTruthRebuild,
}

impl EpistemicMode {
    pub fn as_label(&self) -> &'static str {
        match self {
            EpistemicMode::PrimaryMapper => "PRIMARY_MAPPER",
            EpistemicMode::IsolatedPosition => "ISOLATED_POSITION",
            EpistemicMode::DirectInherit => "DIRECT_INHERIT",
            EpistemicMode::DeltaVerify => "DELTA_VERIFY",
            EpistemicMode::BlindIndependentAudit => "BLIND_INDEPENDENT_AUDIT",
            EpistemicMode::GroundTruthRebuild => "GROUND_TRUTH_REBUILD",
        }
    }

    pub fn requires_blind_self_conclusion(&self) -> bool {
        matches!(
            self,
            EpistemicMode::BlindIndependentAudit | EpistemicMode::GroundTruthRebuild
        )
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReReadTrigger {
    /// Trigger 1: Disk SHA-256 differs from cached SHA-256 or new unindexed files appeared.
    Sha256Mismatch(Vec<String>),
    /// Trigger 2: Upstream flagged `confidence == "low"` or left `unverified_assumptions`.
    EpistemicUncertainty(Vec<String>),
    /// Trigger 3: Peer agents recorded unresolved contradictions/disputes.
    PeerContradiction(Vec<String>),
    /// Trigger 4: Role/intent shifted into adversarial verification (`Critic`, `Auditor`, `review`, `fix-bugs`).
    AdversarialRoleTransition,
    /// Trigger 5: Previous task/turn failed or reported broken invariants.
    PriorExecutionFailure,
}

#[derive(Debug, Clone)]
pub struct EpistemicDecision {
    pub mode: EpistemicMode,
    pub triggers: Vec<ReReadTrigger>,
    pub files_to_reread: Vec<String>,
    pub unchanged_verified_files: Vec<String>,
    pub verification_report: DigestVerificationReport,
}

impl EpistemicDecision {
    pub fn requires_blind_self_conclusion(&self) -> bool {
        self.mode.requires_blind_self_conclusion()
    }
}

fn select_priority_audit_files(workspace_path: &Path, max_files: usize) -> Vec<String> {
    let live = scan_workspace_digest(workspace_path, 32);
    let mut code_files: Vec<String> = live
        .keys()
        .filter(|p| {
            let low = p.to_ascii_lowercase();
            !low.ends_with(".md") && !low.ends_with(".markdown")
        })
        .cloned()
        .collect();

    // Prioritize interactive logic & markup files first
    code_files.sort_by_key(|p| {
        let low = p.to_ascii_lowercase();
        if low.ends_with(".js") || low.ends_with(".ts") || low.ends_with(".tsx") || low.ends_with(".rs") {
            0
        } else if low.ends_with(".html") {
            1
        } else if low.ends_with(".css") {
            2
        } else {
            3
        }
    });

    if code_files.is_empty() {
        live.keys().take(max_files).cloned().collect()
    } else {
        code_files.into_iter().take(max_files).collect()
    }
}

/// Evaluates epistemic routing for a Multi-Agent Discussion turn.
pub fn evaluate_debate_epistemic_policy(
    role: &AgentRole,
    round: u32,
    workspace_path: &Path,
    packet: Option<&CognitiveHandoffPacket>,
    active_dispute_topics: &[String],
) -> EpistemicDecision {
    let mut triggers = Vec::new();
    let mut files_to_reread = Vec::new();

    let verification_report = if let Some(pkt) = packet {
        if !pkt.workspace_digest.is_empty() {
            verify_cached_digests(workspace_path, &pkt.workspace_digest)
        } else {
            DigestVerificationReport::default()
        }
    } else {
        DigestVerificationReport::default()
    };

    if round == 1 {
        let audit_files = if matches!(role, AgentRole::Critic | AgentRole::Auditor) {
            triggers.push(ReReadTrigger::AdversarialRoleTransition);
            select_priority_audit_files(workspace_path, 3)
        } else {
            Vec::new()
        };
        return EpistemicDecision {
            mode: EpistemicMode::IsolatedPosition,
            triggers,
            files_to_reread: audit_files,
            unchanged_verified_files: verification_report.unchanged_files.clone(),
            verification_report,
        };
    }

    // Round 2+: Check all 5 deterministic triggers
    let mut drifted = verification_report.stale_or_modified_files.clone();
    drifted.extend(verification_report.new_unindexed_files.clone());
    if !drifted.is_empty() {
        files_to_reread.extend(drifted.clone());
        triggers.push(ReReadTrigger::Sha256Mismatch(drifted));
    }

    if let Some(pkt) = packet {
        if pkt.confidence.eq_ignore_ascii_case("low") || !pkt.unverified_assumptions.is_empty() {
            let mut reasons = pkt.unverified_assumptions.clone();
            if reasons.is_empty() {
                reasons.push("Upstream confidence marked low".to_string());
            }
            triggers.push(ReReadTrigger::EpistemicUncertainty(reasons));
        }
    }

    if !active_dispute_topics.is_empty() {
        triggers.push(ReReadTrigger::PeerContradiction(
            active_dispute_topics.to_vec(),
        ));
    }

    let is_adversarial = matches!(role, AgentRole::Critic | AgentRole::Auditor);
    if is_adversarial {
        triggers.push(ReReadTrigger::AdversarialRoleTransition);
        if files_to_reread.is_empty() {
            files_to_reread = select_priority_audit_files(workspace_path, 3);
        }
        return EpistemicDecision {
            mode: EpistemicMode::BlindIndependentAudit,
            triggers,
            files_to_reread,
            unchanged_verified_files: verification_report.unchanged_files.clone(),
            verification_report,
        };
    }

    let mode = if packet.is_none() {
        EpistemicMode::PrimaryMapper
    } else if !triggers.is_empty() {
        if files_to_reread.is_empty() {
            files_to_reread = select_priority_audit_files(workspace_path, 2);
        }
        EpistemicMode::DeltaVerify
    } else {
        EpistemicMode::DirectInherit
    };

    EpistemicDecision {
        mode,
        triggers,
        files_to_reread,
        unchanged_verified_files: verification_report.unchanged_files.clone(),
        verification_report,
    }
}

/// Evaluates epistemic routing for a Multi-Agent Pipeline / Task Handoff step.
pub fn evaluate_pipeline_epistemic_policy(
    intent: &str,
    is_first_step: bool,
    workspace_path: &Path,
    packet: Option<&CognitiveHandoffPacket>,
    prior_execution_failed: bool,
) -> EpistemicDecision {
    evaluate_pipeline_epistemic_policy_with_override(
        intent,
        is_first_step,
        workspace_path,
        packet,
        prior_execution_failed,
        None,
    )
}

/// Evaluates epistemic routing for a Multi-Agent Pipeline with an optional explicit policy override
/// (e.g., from a user-defined CustomPipelineAction: "collaborative" vs. "independent-audit").
pub fn evaluate_pipeline_epistemic_policy_with_override(
    intent: &str,
    is_first_step: bool,
    workspace_path: &Path,
    packet: Option<&CognitiveHandoffPacket>,
    prior_execution_failed: bool,
    policy_override: Option<&str>,
) -> EpistemicDecision {
    let mut triggers = Vec::new();
    let mut files_to_reread = Vec::new();

    let verification_report = if let Some(pkt) = packet {
        if !pkt.workspace_digest.is_empty() {
            verify_cached_digests(workspace_path, &pkt.workspace_digest)
        } else {
            DigestVerificationReport::default()
        }
    } else {
        DigestVerificationReport::default()
    };

    if prior_execution_failed {
        triggers.push(ReReadTrigger::PriorExecutionFailure);
    }

    let mut drifted = verification_report.stale_or_modified_files.clone();
    drifted.extend(verification_report.new_unindexed_files.clone());
    if !drifted.is_empty() {
        files_to_reread.extend(drifted.clone());
        triggers.push(ReReadTrigger::Sha256Mismatch(drifted));
    }

    if let Some(pkt) = packet {
        if pkt.confidence.eq_ignore_ascii_case("low") || !pkt.unverified_assumptions.is_empty() {
            let mut reasons = pkt.unverified_assumptions.clone();
            if reasons.is_empty() {
                reasons.push("Upstream confidence marked low".to_string());
            }
            triggers.push(ReReadTrigger::EpistemicUncertainty(reasons));
        }
        if !pkt.active_disputes.is_empty() {
            triggers.push(ReReadTrigger::PeerContradiction(pkt.active_disputes.clone()));
        }
    }

    let normalized_intent = intent.trim().to_ascii_lowercase();
    let clean_policy = policy_override.map(|p| p.trim().to_ascii_lowercase());

    let mode = if clean_policy.as_deref() == Some("independent-audit") {
        triggers.push(ReReadTrigger::AdversarialRoleTransition);
        if files_to_reread.is_empty() {
            files_to_reread = select_priority_audit_files(workspace_path, 4);
        }
        EpistemicMode::BlindIndependentAudit
    } else if clean_policy.as_deref() == Some("collaborative") {
        if prior_execution_failed {
            EpistemicMode::GroundTruthRebuild
        } else if packet.is_none() || is_first_step {
            EpistemicMode::PrimaryMapper
        } else if !triggers.is_empty() {
            EpistemicMode::DeltaVerify
        } else {
            EpistemicMode::DirectInherit
        }
    } else {
        match normalized_intent.as_str() {
            "fix-bugs" => {
                triggers.push(ReReadTrigger::AdversarialRoleTransition);
                if files_to_reread.is_empty() {
                    files_to_reread = select_priority_audit_files(workspace_path, 4);
                }
                EpistemicMode::GroundTruthRebuild
            }
            "review" => {
                triggers.push(ReReadTrigger::AdversarialRoleTransition);
                if files_to_reread.is_empty() {
                    files_to_reread = select_priority_audit_files(workspace_path, 4);
                }
                EpistemicMode::BlindIndependentAudit
            }
            "refine-plan" => {
                if is_first_step || packet.is_none() {
                    EpistemicMode::PrimaryMapper
                } else if !triggers.is_empty() {
                    EpistemicMode::DeltaVerify
                } else {
                    EpistemicMode::DirectInherit
                }
            }
            "write-tests" => {
                if files_to_reread.is_empty() {
                    files_to_reread = select_priority_audit_files(workspace_path, 3);
                }
                EpistemicMode::DeltaVerify
            }
            "explain" => {
                if prior_execution_failed {
                    EpistemicMode::GroundTruthRebuild
                } else if packet.is_some() && drifted_is_empty(&triggers) {
                    EpistemicMode::DirectInherit
                } else if packet.is_some() {
                    EpistemicMode::DeltaVerify
                } else {
                    EpistemicMode::PrimaryMapper
                }
            }
            "build" | _ => {
                if prior_execution_failed {
                    if files_to_reread.is_empty() {
                        files_to_reread = select_priority_audit_files(workspace_path, 3);
                    }
                    EpistemicMode::GroundTruthRebuild
                } else if packet.is_none() {
                    EpistemicMode::PrimaryMapper
                } else if !triggers.is_empty() {
                    EpistemicMode::DeltaVerify
                } else {
                    EpistemicMode::DirectInherit
                }
            }
        }
    };

    EpistemicDecision {
        mode,
        triggers,
        files_to_reread,
        unchanged_verified_files: verification_report.unchanged_files.clone(),
        verification_report,
    }
}

fn drifted_is_empty(triggers: &[ReReadTrigger]) -> bool {
    !triggers
        .iter()
        .any(|t| matches!(t, ReReadTrigger::Sha256Mismatch(_)))
}

/// Determines whether consecutive steps on the same CLI agent (`claude-code`) can safely reuse
/// its warm local session (`--continue`) to preserve provider-side KV cache.
/// Never reuses session state across adversarial `BlindIndependentAudit` / `GroundTruthRebuild` boundaries!
pub fn can_reuse_cli_session_continuously(
    decision: &EpistemicDecision,
    agent_id: &str,
    pipeline_id: Option<&str>,
    packet: Option<&CognitiveHandoffPacket>,
    now_epoch_ms: i64,
) -> bool {
    if decision.requires_blind_self_conclusion() {
        return false;
    }
    if agent_id != "claude-code" {
        return false;
    }
    let (Some(pid), Some(pkt)) = (pipeline_id, packet) else {
        return false;
    };
    if pkt.pipeline_id.as_deref() != Some(pid) {
        return false;
    }
    if pkt.last_cli_agent_id.as_deref() != Some(agent_id) {
        return false;
    }
    if let Some(last_ts) = pkt.last_cli_completed_at {
        // Warm session window: 30 minutes
        (now_epoch_ms - last_ts) >= 0 && (now_epoch_ms - last_ts) <= 30 * 60 * 1000
    } else {
        false
    }
}

/// Formats the Epistemic Context & Directive block injected into pipeline handoffs and debate tails.
pub fn build_epistemic_prompt_section(
    decision: &EpistemicDecision,
    workspace_path: &Path,
    packet: Option<&CognitiveHandoffPacket>,
) -> String {
    let mut s = String::new();
    s.push_str(&format!(
        "## Epistemic Handoff Mode: `{}`\n\n",
        decision.mode.as_label()
    ));

    match decision.mode {
        EpistemicMode::DirectInherit => {
            s.push_str(
                "> **FAST-PATH CACHE INHERITANCE ACTIVE**: Upstream file comprehension and SHA-256 digests are cryptographically verified against disk.\n\
                 > - **DO NOT** run redundant directory scans (`ls`/`find`) or re-read untouched files listed as verified below.\n\
                 > - Adopt the verified DOM contracts, exported symbol names, and locked invariants directly, and focus 100% of your tokens on executing your assigned deliverable.\n\n",
            );
            if let Some(pkt) = packet {
                s.push_str(&format_compact_digest_markdown(pkt, true));
            }
        }
        EpistemicMode::DeltaVerify => {
            s.push_str(
                "> **SELECTIVE DELTA VERIFICATION ACTIVE**: Unchanged workspace files remain cache-verified (skip re-reading them), while specific modified/uncertain files are attached below for direct verification.\n\n",
            );
            if let Some(pkt) = packet {
                s.push_str(&format_compact_digest_markdown(pkt, true));
            }
            if !decision.files_to_reread.is_empty() {
                s.push_str("### Targeted Delta Slices Requiring Fresh Inspection\n\n");
                s.push_str(&read_targeted_file_slices(
                    workspace_path,
                    &decision.files_to_reread,
                    90,
                    9000,
                ));
            }
        }
        EpistemicMode::BlindIndependentAudit => {
            s.push_str(
                "> **ANTI-CONFIRMATION-BIAS BLIND AUDIT PROTOCOL (MANDATORY)**:\n\
                 > Upstream prose self-summaries have been **intentionally withheld** so you do not rubber-stamp unverified claims.\n\
                 > 1. **Step 1 — Read Raw Evidence**: Inspect the actual workspace files and raw slices below directly.\n\
                 > 2. **Step 2 — Conclude Your Own Résumé**: Write an `<independent_resume>...</independent_resume>` block summarizing what the code on disk *actually* implements (DOM bindings, logic completeness, edge cases).\n\
                 > 3. **Step 3 — Discrepancy Audit**: Compare your independent résumé against the Immutable Project Contract invariants and report any missing logic, stubbed handlers, or bugs.\n\n",
            );
            if let Some(pkt) = packet {
                // Pass ONLY objective file hashes/contracts, withholding upstream subjective claims (`include_upstream_claims = false`)
                s.push_str(&format_compact_digest_markdown(pkt, false));
            }
            if !decision.files_to_reread.is_empty() {
                s.push_str("### Raw Workspace Evidence Slices for Independent Audit\n\n");
                s.push_str(&read_targeted_file_slices(
                    workspace_path,
                    &decision.files_to_reread,
                    110,
                    12000,
                ));
            }
        }
        EpistemicMode::GroundTruthRebuild => {
            s.push_str(
                "> **GROUND-TRUTH REBUILD PROTOCOL (MANDATORY)**:\n\
                 > Prior assumptions or code states triggered a defect/failure alert and are marked **SUSPECT**.\n\
                 > 1. Re-read the raw failing files directly from disk.\n\
                 > 2. Output an `<independent_resume>...</independent_resume>` documenting the verified root cause.\n\
                 > 3. Apply the complete fix directly to disk and emit updated invariants.\n\n",
            );
            if !decision.files_to_reread.is_empty() {
                s.push_str("### Raw Suspect File Slices on Disk\n\n");
                s.push_str(&read_targeted_file_slices(
                    workspace_path,
                    &decision.files_to_reread,
                    110,
                    12000,
                ));
            }
        }
        EpistemicMode::PrimaryMapper | EpistemicMode::IsolatedPosition => {
            if let Some(pkt) = packet {
                if !pkt.workspace_digest.is_empty() {
                    s.push_str(&format_compact_digest_markdown(pkt, false));
                }
            }
        }
    }

    s
}

/// Compact footer instruction asking the agent to emit `<handoff_state>` (and `<independent_resume>` when auditing)
/// so the next model in the debate or pipeline receives digested comprehension and `@Role` peer messages.
pub fn format_handoff_state_emission_protocol(require_independent_resume: bool) -> String {
    let mut s = String::new();
    if require_independent_resume {
        s.push_str(
            "\n\n### Mandatory Self-Conclusion Block\n\
             Include an `<independent_resume>...</independent_resume>` section containing your independent technical conclusion derived strictly from raw file/spec evidence.\n",
        );
    }
    s.push_str(
        "\n### Cross-Model State Handoff Footer (Compact)\n\
         At the very end of your response, append a concise `<handoff_state>` JSON block (~120 tokens max) to pass verified state and direct `@Role` messages to downstream agents without forcing them to re-read unchanged files:\n\
         ```xml\n\
         <handoff_state>\n\
         {\"confidence\":\"high\",\"lockedInvariants\":[\"...\"],\"activeDisputes\":[\"...\"],\"unverifiedAssumptions\":[],\"peerMessages\":[{\"toRole\":\"Implementer\",\"kind\":\"directive\",\"message\":\"...\"}]}\n\
         </handoff_state>\n\
         ```\n",
    );
    s
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::projects::cache::update_workspace_cognitive_cache;
    use std::fs;

    #[test]
    fn test_epistemic_routing_direct_inherit_vs_blind_audit_vs_hash_drift() {
        let temp_dir = std::env::temp_dir().join("flymd_epistemic_router_test");
        let _ = fs::remove_dir_all(&temp_dir);
        fs::create_dir_all(&temp_dir).unwrap();

        fs::write(
            temp_dir.join("index.html"),
            "<!DOCTYPE html><html><body><button id=\"startBtn\">Go</button></body></html>",
        )
        .unwrap();
        fs::write(temp_dir.join("app.js"), "export function boot() {}\n").unwrap();

        // Step 1: Architect populates cognitive cache
        let pkt = update_workspace_cognitive_cache(
            &temp_dir,
            "claude-code",
            "Architect",
            Some("pipe-1"),
            1,
            Some("Build interactive app with #startBtn"),
            "- **Core Invariant**: Keep #startBtn bound to boot().",
            Some("claude-code"),
        );

        // Step 2: Implementer (`build`) with unchanged hashes -> DirectInherit + warm CLI reuse allowed!
        let dec_build =
            evaluate_pipeline_epistemic_policy("build", false, &temp_dir, Some(&pkt), false);
        assert_eq!(dec_build.mode, EpistemicMode::DirectInherit);
        assert!(dec_build.triggers.is_empty());
        assert!(can_reuse_cli_session_continuously(
            &dec_build,
            "claude-code",
            Some("pipe-1"),
            Some(&pkt),
            pkt.updated_at + 5000
        ));

        // Step 3: Reviewer (`review`) -> BlindIndependentAudit + CLI session reuse BLOCKED to prevent bias!
        let dec_review =
            evaluate_pipeline_epistemic_policy("review", false, &temp_dir, Some(&pkt), false);
        assert_eq!(dec_review.mode, EpistemicMode::BlindIndependentAudit);
        assert!(dec_review.requires_blind_self_conclusion());
        assert!(!can_reuse_cli_session_continuously(
            &dec_review,
            "claude-code",
            Some("pipe-1"),
            Some(&pkt),
            pkt.updated_at + 5000
        ));

        // Modify app.js behind the cache's back -> Implementer (`build`) upgrades to DeltaVerify via Sha256Mismatch!
        fs::write(
            temp_dir.join("app.js"),
            "export function boot() { console.log('external edit'); }\n",
        )
        .unwrap();
        let dec_drifted =
            evaluate_pipeline_epistemic_policy("build", false, &temp_dir, Some(&pkt), false);
        assert_eq!(dec_drifted.mode, EpistemicMode::DeltaVerify);
        assert!(dec_drifted
            .triggers
            .iter()
            .any(|t| matches!(t, ReReadTrigger::Sha256Mismatch(_))));
        assert!(dec_drifted.files_to_reread.contains(&"app.js".to_string()));

        let _ = fs::remove_dir_all(&temp_dir);
    }
}

