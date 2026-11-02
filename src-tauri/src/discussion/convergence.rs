//! Deterministic Successive Summary Convergence Engine.
//!
//! Detects when two successive agent turns (or successive rounds) reach an equivalent
//! summary/consensus with no newly opened unresolved disputes, allowing the orchestrator
//! to halt redundant remaining turns and rounds without wasting user queries/tokens.

use super::types::{DiscussionMessage, DiscussionMessageKind};
use std::collections::HashSet;

/// Minimum similarity score `[0.0, 1.0]` required to declare successive summaries converged.
pub const CONVERGENCE_SIMILARITY_THRESHOLD: f64 = 0.82;

/// Minimum normalized character length required before evaluating convergence
/// (prevents false positives on ultra-short acknowledgments or empty responses).
const MIN_FINGERPRINT_CHARS: usize = 30;

#[derive(Debug, Clone, PartialEq)]
pub struct ConvergenceVerdict {
    pub converged_round: u32,
    pub reference_round: u32,
    pub similarity: f64,
    pub matched_agents: Vec<String>,
    pub reason: String,
}

fn is_substantive_debate_turn(kind: DiscussionMessageKind) -> bool {
    matches!(
        kind,
        DiscussionMessageKind::InitialAnalysis
            | DiscussionMessageKind::PeerCritique
            | DiscussionMessageKind::RebuttalRevision
            | DiscussionMessageKind::SynthesisReport
    )
}

/// Strips machine XML blocks (`<handoff_state>`, `<independent_resume>`) and `@Role:` bus directives.
fn strip_machine_envelopes(input: &str) -> String {
    let mut cleaned = input.to_string();
    for (open_tag, close_tag) in [
        ("<handoff_state>", "</handoff_state>"),
        ("<independent_resume>", "</independent_resume>"),
    ] {
        while let Some(start) = cleaned.find(open_tag) {
            if let Some(end_rel) = cleaned[start..].find(close_tag) {
                let end = start + end_rel + close_tag.len();
                cleaned.replace_range(start..end, "");
            } else {
                cleaned.truncate(start);
                break;
            }
        }
    }

    cleaned
        .lines()
        .filter(|line| {
            let t = line.trim();
            !(t.starts_with("- @") && t.contains(':'))
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Checks if a line is structural header boilerplate containing agent names or round numbers.
fn is_boilerplate_header_line(trimmed: &str) -> bool {
    let lower = trimmed.to_lowercase();
    if lower.starts_with("### position paper by ")
        || lower.starts_with("### round ")
        || lower.starts_with("**domain analysis for topic**:")
        || lower.starts_with("**adversarial challenge for topic**:")
        || lower.starts_with("**systems engineering specification for topic**:")
        || lower.starts_with("**zero-trust security & validation audit for topic**:")
        || lower.starts_with("**topic refinement**:")
        || lower.starts_with("**topic context**:")
        || lower.starts_with("**critique target**:")
        || lower.starts_with("focus area / action:")
    {
        return true;
    }
    false
}

/// Checks if a heading or bullet explicitly introduces a summary / conclusion / consensus verdict.
fn is_summary_marker_heading(trimmed: &str) -> bool {
    let lower = trimmed
        .trim_start_matches('#')
        .trim_start_matches('-')
        .trim_start_matches('*')
        .trim()
        .to_lowercase();

    const MARKERS: &[&str] = &[
        "summary",
        "executive summary",
        "conclusion",
        "conclusions",
        "final recommendation",
        "final position",
        "final stance",
        "concessions & final stance",
        "consensus reached",
        "implementation verdict",
        "verdict",
        "ملخص",
        "الخلاصة",
        "النتيجة",
    ];

    MARKERS.iter().any(|m| {
        lower == *m
            || lower.starts_with(&format!("{}:", m))
            || lower.starts_with(&format!("{}**:", m))
            || lower.starts_with(&format!("**{}**:", m))
            || (trimmed.starts_with('#') && lower.contains(m))
    })
}

/// Normalizes UTF-8 text into lowercase alphanumeric tokens separated by single spaces.
/// Safe for all Unicode scripts (Latin, Arabic, CJK, Cyrillic) — zero byte-index slicing.
pub fn normalize_utf8_text(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut prev_space = true;

    for ch in text.chars() {
        if ch.is_alphanumeric() {
            for lc in ch.to_lowercase() {
                out.push(lc);
            }
            prev_space = false;
        } else if !prev_space {
            out.push(' ');
            prev_space = true;
        }
    }

    out.trim().to_string()
}

/// Extracts a normalized substantive summary fingerprint from an agent's Markdown turn.
pub fn extract_summary_fingerprint(raw_content: &str) -> String {
    let clean = strip_machine_envelopes(raw_content);
    let mut explicit_summary_lines: Vec<&str> = Vec::new();
    let mut body_lines: Vec<&str> = Vec::new();
    let mut in_summary_section = false;

    for line in clean.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || is_boilerplate_header_line(trimmed) {
            continue;
        }

        if is_summary_marker_heading(trimmed) {
            in_summary_section = true;
            // If it's an inline summary bullet like `- **Consensus Reached**: Adopt X`, include the value after `:`
            if !trimmed.starts_with('#') {
                if let Some((_, rhs)) = trimmed.split_once(':') {
                    if !rhs.trim().is_empty() {
                        explicit_summary_lines.push(rhs.trim());
                    }
                } else {
                    explicit_summary_lines.push(trimmed);
                }
            }
            continue;
        }

        if trimmed.starts_with('#') && in_summary_section {
            // Exited explicit summary heading into another section
            in_summary_section = false;
        }

        if in_summary_section {
            explicit_summary_lines.push(trimmed);
        }

        if !trimmed.starts_with('#') {
            body_lines.push(trimmed);
        }
    }

    if !explicit_summary_lines.is_empty() {
        let norm_explicit = normalize_utf8_text(&explicit_summary_lines.join(" "));
        if norm_explicit.chars().count() >= MIN_FINGERPRINT_CHARS {
            return norm_explicit;
        }
    }

    normalize_utf8_text(&body_lines.join(" "))
}

/// Computes deterministic Dice similarity `[0.0, 1.0]` combining token-set overlap and UTF-8 character trigrams.
pub fn compute_summary_similarity(norm_a: &str, norm_b: &str) -> f64 {
    let chars_a: Vec<char> = norm_a.chars().collect();
    let chars_b: Vec<char> = norm_b.chars().collect();

    if chars_a.len() < MIN_FINGERPRINT_CHARS || chars_b.len() < MIN_FINGERPRINT_CHARS {
        return 0.0;
    }
    if norm_a == norm_b {
        return 1.0;
    }

    // 1. Distinct token Dice coefficient
    let tokens_a: HashSet<&str> = norm_a
        .split_whitespace()
        .filter(|t| t.chars().count() >= 2)
        .collect();
    let tokens_b: HashSet<&str> = norm_b
        .split_whitespace()
        .filter(|t| t.chars().count() >= 2)
        .collect();

    let token_dice = if tokens_a.is_empty() || tokens_b.is_empty() {
        0.0
    } else {
        let inter = tokens_a.intersection(&tokens_b).count();
        (2.0 * inter as f64) / ((tokens_a.len() + tokens_b.len()) as f64)
    };

    // 2. Character 3-gram Dice coefficient (UTF-8 char-window safe)
    let trigrams_a: HashSet<(char, char, char)> = chars_a
        .windows(3)
        .map(|w| (w[0], w[1], w[2]))
        .collect();
    let trigrams_b: HashSet<(char, char, char)> = chars_b
        .windows(3)
        .map(|w| (w[0], w[1], w[2]))
        .collect();

    let trigram_dice = if trigrams_a.is_empty() || trigrams_b.is_empty() {
        token_dice
    } else {
        let inter = trigrams_a.intersection(&trigrams_b).count();
        (2.0 * inter as f64) / ((trigrams_a.len() + trigrams_b.len()) as f64)
    };

    0.55 * token_dice + 0.45 * trigram_dice
}

/// Evaluates right after an agent turn finishes whether:
///
/// 1. Two successive agents in `current_round` reached the same summary (`>= 0.82`), OR
/// 2. Two successive agents in `current_round` (`>= 2`) both repeated their exact summaries from `current_round - 1`.
///
/// Returns `None` if `new_unresolved_dispute_added` is true.
pub fn evaluate_turn_convergence(
    transcript: &[DiscussionMessage],
    current_round: u32,
    new_unresolved_dispute_added: bool,
) -> Option<ConvergenceVerdict> {
    if new_unresolved_dispute_added {
        return None;
    }

    let round_turns: Vec<&DiscussionMessage> = transcript
        .iter()
        .filter(|m| m.round_number == current_round && is_substantive_debate_turn(m.message_kind))
        .collect();

    if round_turns.len() < 2 {
        return None;
    }

    let prev = round_turns[round_turns.len() - 2];
    let curr = round_turns[round_turns.len() - 1];

    // Case A: Two successive distinct agents in the current round produced equivalent summaries
    if prev.author_agent_id != curr.author_agent_id {
        let fp_prev = extract_summary_fingerprint(&prev.content);
        let fp_curr = extract_summary_fingerprint(&curr.content);
        let sim = compute_summary_similarity(&fp_prev, &fp_curr);

        if sim >= CONVERGENCE_SIMILARITY_THRESHOLD {
            let prev_name = prev
                .author_display_name
                .clone()
                .unwrap_or_else(|| prev.author_agent_id.clone());
            let curr_name = curr
                .author_display_name
                .clone()
                .unwrap_or_else(|| curr.author_agent_id.clone());
            return Some(ConvergenceVerdict {
                converged_round: current_round,
                reference_round: current_round,
                similarity: sim,
                matched_agents: vec![prev_name.clone(), curr_name.clone()],
                reason: format!(
                    "Successive agents ({} and {}) reached equivalent summary consensus ({:.0}% match) in Round {}.",
                    prev_name,
                    curr_name,
                    sim * 100.0,
                    current_round
                ),
            });
        }
    }

    // Case B: In Round >= 2, two successive agents in `current_round` repeated their summaries from `current_round - 1`
    // (meaning the debate already settled in Round `current_round - 1` and agents are repeating their settled stance).
    if current_round >= 2 {
        let prev_round_turns: Vec<&DiscussionMessage> = transcript
            .iter()
            .filter(|m| {
                m.round_number == current_round - 1 && is_substantive_debate_turn(m.message_kind)
            })
            .collect();

        let match_prev_self = prev_round_turns
            .iter()
            .rev()
            .find(|m| m.author_agent_id == prev.author_agent_id)
            .map(|old| {
                compute_summary_similarity(
                    &extract_summary_fingerprint(&old.content),
                    &extract_summary_fingerprint(&prev.content),
                )
            })
            .unwrap_or(0.0);

        let match_curr_self = prev_round_turns
            .iter()
            .rev()
            .find(|m| m.author_agent_id == curr.author_agent_id)
            .map(|old| {
                compute_summary_similarity(
                    &extract_summary_fingerprint(&old.content),
                    &extract_summary_fingerprint(&curr.content),
                )
            })
            .unwrap_or(0.0);

        if match_prev_self >= CONVERGENCE_SIMILARITY_THRESHOLD
            && match_curr_self >= CONVERGENCE_SIMILARITY_THRESHOLD
        {
            let avg_sim = (match_prev_self + match_curr_self) * 0.5;
            let prev_name = prev
                .author_display_name
                .clone()
                .unwrap_or_else(|| prev.author_agent_id.clone());
            let curr_name = curr
                .author_display_name
                .clone()
                .unwrap_or_else(|| curr.author_agent_id.clone());
            return Some(ConvergenceVerdict {
                converged_round: current_round,
                reference_round: current_round - 1,
                similarity: avg_sim,
                matched_agents: vec![prev_name.clone(), curr_name.clone()],
                reason: format!(
                    "Successive agents ({} and {}) confirmed the same settled summary as Round {} ({:.0}% match).",
                    prev_name,
                    curr_name,
                    current_round - 1,
                    avg_sim * 100.0
                ),
            });
        }
    }

    None
}

/// Evaluates at the end of `current_round` (`>= 2`) whether the entire round's consolidated summary
/// duplicates `current_round - 1` (covers 1-agent rounds or cross-role round repeaters).
pub fn evaluate_round_boundary_convergence(
    transcript: &[DiscussionMessage],
    current_round: u32,
    new_unresolved_dispute_added: bool,
) -> Option<ConvergenceVerdict> {
    if current_round < 2 || new_unresolved_dispute_added {
        return None;
    }

    let curr_fps: Vec<String> = transcript
        .iter()
        .filter(|m| m.round_number == current_round && is_substantive_debate_turn(m.message_kind))
        .map(|m| extract_summary_fingerprint(&m.content))
        .filter(|fp| !fp.is_empty())
        .collect();

    let prev_fps: Vec<String> = transcript
        .iter()
        .filter(|m| {
            m.round_number == current_round - 1 && is_substantive_debate_turn(m.message_kind)
        })
        .map(|m| extract_summary_fingerprint(&m.content))
        .filter(|fp| !fp.is_empty())
        .collect();

    if curr_fps.is_empty() || prev_fps.is_empty() {
        return None;
    }

    let joined_curr = curr_fps.join(" ");
    let joined_prev = prev_fps.join(" ");
    let sim = compute_summary_similarity(&joined_prev, &joined_curr);

    if sim >= CONVERGENCE_SIMILARITY_THRESHOLD {
        let agents: Vec<String> = transcript
            .iter()
            .filter(|m| {
                m.round_number == current_round && is_substantive_debate_turn(m.message_kind)
            })
            .map(|m| {
                m.author_display_name
                    .clone()
                    .unwrap_or_else(|| m.author_agent_id.clone())
            })
            .collect();
        return Some(ConvergenceVerdict {
            converged_round: current_round,
            reference_round: current_round - 1,
            similarity: sim,
            matched_agents: agents,
            reason: format!(
                "Round {} reached the same consolidated summary as Round {} ({:.0}% match).",
                current_round,
                current_round - 1,
                sim * 100.0
            ),
        });
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::discussion::types::now_ms;

    fn make_msg(
        id: &str,
        round: u32,
        turn: u32,
        agent_id: &str,
        display_name: &str,
        content: &str,
    ) -> DiscussionMessage {
        DiscussionMessage {
            id: id.to_string(),
            session_id: "s-conv".to_string(),
            round_number: round,
            turn_index: turn,
            author_agent_id: agent_id.to_string(),
            author_role: "Architect".to_string(),
            author_provider: "mock".to_string(),
            message_kind: DiscussionMessageKind::RebuttalRevision,
            target_peer_ids: vec![],
            content: content.to_string(),
            timestamp: now_ms(),
            token_usage: None,
            duration_ms: 100,
            truncated: false,
            thinking_content: None,
            action_name: None,
            model_id: None,
            simulated: true,
            author_display_name: Some(display_name.to_string()),
        }
    }

    #[test]
    fn test_successive_agents_same_summary_triggers_convergence() {
        let m1 = make_msg(
            "m1",
            2,
            1,
            "agent-arch",
            "Lead Architect",
            "### Analysis\nWe evaluated Redis vs SQLite.\n\n## Executive Summary\nAdopt local SQLite WAL mode with bounded read pools and strict atomic schema migrations for zero-dependency desktop reliability.",
        );
        let m2 = make_msg(
            "m2",
            2,
            2,
            "agent-critic",
            "Security Critic",
            "### Peer Review\nI concur with the storage trade-offs.\n\n## Executive Summary\nAdopt local SQLite WAL mode with bounded read pools and strict atomic schema migrations for zero-dependency desktop reliability.",
        );

        let verdict = evaluate_turn_convergence(&[m1, m2], 2, false);
        assert!(verdict.is_some());
        let v = verdict.unwrap();
        assert_eq!(v.converged_round, 2);
        assert!(v.similarity >= 0.95);
    }

    #[test]
    fn test_arabic_utf8_successive_summaries_converge_cleanly() {
        let m1 = make_msg(
            "m1",
            3,
            1,
            "agent-1",
            "المهندس المعماري",
            "## الخلاصة\nاعتماد بنية متعددة الوكلاء مع فصل كامل للمسؤوليات وحفظ كامل لتفاصيل النقاش دون اقتطاع.",
        );
        let m2 = make_msg(
            "m2",
            3,
            2,
            "agent-2",
            "الناقد التقني",
            "## الخلاصة\nاعتماد بنية متعددة الوكلاء مع فصل كامل للمسؤوليات وحفظ كامل لتفاصيل النقاش دون اقتطاع.",
        );

        let verdict = evaluate_turn_convergence(&[m1, m2], 3, false);
        assert!(verdict.is_some());
        assert!(verdict.unwrap().similarity >= 0.95);
    }

    #[test]
    fn test_dispute_veto_prevents_premature_convergence() {
        let m1 = make_msg(
            "m1",
            2,
            1,
            "agent-1",
            "Architect",
            "## Summary\nUse PostgreSQL connection pooling with async Tokio workers and strict timeout bounds.",
        );
        let m2 = make_msg(
            "m2",
            2,
            2,
            "agent-2",
            "Critic",
            "## Summary\nUse PostgreSQL connection pooling with async Tokio workers and strict timeout bounds.",
        );

        // When a new unresolved dispute was raised on this turn, convergence is vetoed
        assert!(evaluate_turn_convergence(&[m1, m2], 2, true).is_none());
    }

    #[test]
    fn test_distinct_role_perspectives_do_not_false_positive() {
        let m1 = make_msg(
            "m1",
            1,
            1,
            "agent-arch",
            "Architect",
            "## Summary\nPropose a three-tier event-driven microservice topology using Kafka topics and schema registries.",
        );
        let m2 = make_msg(
            "m2",
            1,
            2,
            "agent-critic",
            "Critic",
            "## Summary\nReject distributed brokers completely; enforce a single-binary embedded monolith to eliminate network partitions.",
        );

        assert!(evaluate_turn_convergence(&[m1, m2], 1, false).is_none());
    }
}

