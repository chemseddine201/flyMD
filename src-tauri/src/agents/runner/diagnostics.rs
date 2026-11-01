//! Structured failure classification and `AgentErrorDiagnostic` assembly for pipeline recovery.

use crate::agents::types::{now_ms, AgentErrorDiagnostic};
use crate::agents::verify::VerificationReport;

/// Context gathered from subprocess execution to classify any non-completed task outcome.
pub struct DiagnosticInput<'a> {
    pub final_status: &'a str,
    pub was_stalled: bool,
    pub stall_timeout_msg: Option<&'a str>,
    pub last_known_activity: &'a str,
    pub captured_cli_error: Option<&'a str>,
    pub stderr_lines: &'a [String],
    pub exited_err: bool,
    pub exit_code: Option<i32>,
    pub captured_session_id: Option<String>,
    pub effective_files_to_report: &'a [String],
    pub v_report: &'a VerificationReport,
}

/// Classifies non-completed execution outcomes into structured recovery categories
/// (`timeout_hang`, `api_quota_rate_limit`, `auth_permission_error`, `process_exit_error`, `verification_gap`).
pub fn build_execution_error_diagnostic(input: DiagnosticInput<'_>) -> Option<AgentErrorDiagnostic> {
    if input.final_status == "completed" {
        return None;
    }

    let combined_err_text = format!(
        "{} {}",
        input.captured_cli_error.unwrap_or(""),
        input.stderr_lines.join(" ")
    )
    .to_lowercase();

    let (category, title, exception_message) = if input.was_stalled {
        (
            "timeout_hang".to_string(),
            "Execution Timed Out / Stalled (Watchdog)".to_string(),
            input
                .stall_timeout_msg
                .map(|s| s.to_string())
                .unwrap_or_else(|| {
                    format!(
                        "No stream output or workspace file activity detected within watchdog threshold during `{}`.",
                        input.last_known_activity
                    )
                }),
        )
    } else if combined_err_text.contains("429")
        || combined_err_text.contains("quota")
        || combined_err_text.contains("resource_exhausted")
        || combined_err_text.contains("rate limit")
        || combined_err_text.contains("overloaded")
    {
        (
            "api_quota_rate_limit".to_string(),
            "AI Provider Quota or Rate Limit Reached (429)".to_string(),
            input
                .captured_cli_error
                .map(|s| s.to_string())
                .or_else(|| input.stderr_lines.last().cloned())
                .unwrap_or_else(|| {
                    "Provider rate limit or quota exhausted during execution.".to_string()
                }),
        )
    } else if combined_err_text.contains("401")
        || combined_err_text.contains("403")
        || combined_err_text.contains("unauthorized")
        || combined_err_text.contains("authentication")
        || combined_err_text.contains("not logged in")
    {
        (
            "auth_permission_error".to_string(),
            "Authentication or Session Permission Error".to_string(),
            input
                .captured_cli_error
                .map(|s| s.to_string())
                .or_else(|| input.stderr_lines.last().cloned())
                .unwrap_or_else(|| {
                    "Agent CLI reported an authentication or permission error.".to_string()
                }),
        )
    } else if input.exited_err
        && (input.captured_cli_error.is_some() || !input.stderr_lines.is_empty())
    {
        let code_label = input
            .exit_code
            .map(|c| c.to_string())
            .unwrap_or_else(|| "non-zero".to_string());
        (
            "process_exit_error".to_string(),
            format!("CLI Subprocess Exited with Error (Code {})", code_label),
            input
                .captured_cli_error
                .map(|s| s.to_string())
                .or_else(|| input.stderr_lines.last().cloned())
                .unwrap_or_else(|| format!("Subprocess exited with code {}.", code_label)),
        )
    } else {
        (
            "verification_gap".to_string(),
            "Deliverable Verification Gaps Detected".to_string(),
            input.v_report.summary.clone(),
        )
    };

    let mut trace = input.stderr_lines.to_vec();
    if let Some(cli_e) = input.captured_cli_error {
        if !trace.iter().any(|l| l.contains(cli_e)) {
            trace.insert(0, format!("[CLI Exception] {}", cli_e));
        }
    }
    if let Some(st_msg) = input.stall_timeout_msg {
        trace.push(st_msg.to_string());
    }
    for gap in &input.v_report.gaps {
        trace.push(format!("[Verification Gap] {}", gap));
    }

    Some(AgentErrorDiagnostic {
        category,
        title,
        exception_message,
        stderr_trace: trace,
        exit_code: input.exit_code,
        last_known_activity: Some(input.last_known_activity.to_string()),
        cli_session_id: input.captured_session_id,
        modified_files: input.effective_files_to_report.to_vec(),
        can_resume_from_breakpoint: true,
        timestamp: now_ms(),
    })
}

/// Builds a diagnostic record when no executable CLI binary exists on the host for the selected agent.
pub fn build_missing_binary_diagnostic(err_msg: &str) -> AgentErrorDiagnostic {
    AgentErrorDiagnostic {
        category: "process_exit_error".to_string(),
        title: "Agent CLI Binary Not Found".to_string(),
        exception_message: err_msg.to_string(),
        stderr_trace: vec![err_msg.to_string()],
        exit_code: None,
        last_known_activity: Some("Binary discovery check".to_string()),
        cli_session_id: None,
        modified_files: Vec::new(),
        can_resume_from_breakpoint: true,
        timestamp: now_ms(),
    }
}

/// Builds a diagnostic record when a worker thread recovers from an unexpected runtime panic.
pub fn build_panic_diagnostic(
    panic_msg: &str,
    cli_session_id: Option<String>,
    modified_files: Vec<String>,
) -> AgentErrorDiagnostic {
    AgentErrorDiagnostic {
        category: "runtime_panic".to_string(),
        title: "Internal Worker Runtime Exception".to_string(),
        exception_message: panic_msg.to_string(),
        stderr_trace: vec![panic_msg.to_string()],
        exit_code: None,
        last_known_activity: Some("Worker thread execution".to_string()),
        cli_session_id,
        modified_files,
        can_resume_from_breakpoint: true,
        timestamp: now_ms(),
    }
}
