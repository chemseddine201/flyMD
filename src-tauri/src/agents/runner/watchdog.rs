//! Heartbeat progress estimation, live workspace file polling, and inactivity/ceiling watchdog.

use super::code_blocks::scan_workspace_modified_files;
use std::time::{Duration, Instant};

/// Snapshot produced whenever the 2-second heartbeat timer fires while waiting on a CLI child.
pub struct HeartbeatTick {
    pub elapsed_sec: u64,
    pub current_pct: u8,
    pub status_text: String,
    pub live_files: Vec<String>,
    pub stall_timeout_msg: Option<String>,
}

/// Tracks stream & filesystem liveness for a running agent subprocess.
pub struct WatchdogTracker {
    last_heartbeat: Instant,
    last_stdout_activity: Instant,
    last_fs_change: Instant,
    seen_created_files: Vec<String>,
    pub elapsed_sec: u64,
    pub was_stalled: bool,
    pub stall_timeout_msg: Option<String>,
}

impl Default for WatchdogTracker {
    fn default() -> Self {
        Self::new()
    }
}

impl WatchdogTracker {
    pub fn new() -> Self {
        let now = Instant::now();
        Self {
            last_heartbeat: now,
            last_stdout_activity: now,
            last_fs_change: now,
            seen_created_files: Vec::new(),
            elapsed_sec: 0,
            was_stalled: false,
            stall_timeout_msg: None,
        }
    }

    pub fn note_stream_activity(&mut self) {
        self.last_stdout_activity = Instant::now();
    }

    /// Evaluates whether 2 seconds have elapsed since the previous heartbeat.
    /// If due, computes progress percentage, intent-aware status text, live modified files,
    /// and hang/safety-ceiling watchdog thresholds.
    pub fn poll_heartbeat(
        &mut self,
        intent: &str,
        exec_dir: &str,
        task_started_at: i64,
        last_known_activity: &mut String,
    ) -> Option<HeartbeatTick> {
        if self.last_heartbeat.elapsed() < Duration::from_secs(2) {
            return None;
        }
        self.last_heartbeat = Instant::now();
        self.elapsed_sec += 2;
        let elapsed_sec = self.elapsed_sec;

        let current_pct = compute_heartbeat_progress_pct(elapsed_sec);
        let status_text = synthesize_heartbeat_status_text(intent, elapsed_sec);

        let mut live_files = scan_workspace_modified_files(exec_dir, task_started_at);
        if intent == "refine-plan" {
            live_files.retain(|f| f.to_lowercase().ends_with(".md"));
        }
        if live_files.len() > self.seen_created_files.len()
            || live_files != self.seen_created_files
        {
            self.seen_created_files = live_files.clone();
            self.last_fs_change = Instant::now();
            if let Some(newest) = live_files.last() {
                *last_known_activity = format!("Wrote workspace file `{}`", newest);
            }
        }

        let stdout_idle_sec = self.last_stdout_activity.elapsed().as_secs();
        let fs_idle_sec = self.last_fs_change.elapsed().as_secs();
        let min_activity_idle = stdout_idle_sec.min(fs_idle_sec);

        let max_timeout_sec: u64 = match intent {
            "refine-plan" => 1200,
            "build" | "fix-bugs" => 2700,
            _ => 1800,
        };
        let hang_watchdog_sec: u64 = 900; // 15 min of complete silence

        let is_hang = min_activity_idle >= hang_watchdog_sec;
        let is_ceiling = elapsed_sec >= max_timeout_sec;

        let stall_timeout_msg = if is_hang || is_ceiling {
            self.was_stalled = true;
            let msg = if is_hang {
                format!(
                    "[Hang Watchdog] No stream or workspace file activity for {}s (threshold: {}s) after `{}`. Pausing execution so you can Resume from Breakpoint or Revert & Retry.",
                    min_activity_idle, hang_watchdog_sec, last_known_activity
                )
            } else {
                format!(
                    "[Safety Ceiling] Task execution window reached maximum limit ({}s elapsed) during `{}`. Concluding execution.",
                    elapsed_sec, last_known_activity
                )
            };
            self.stall_timeout_msg = Some(msg.clone());
            Some(msg)
        } else {
            None
        };

        Some(HeartbeatTick {
            elapsed_sec,
            current_pct,
            status_text,
            live_files,
            stall_timeout_msg,
        })
    }
}

fn compute_heartbeat_progress_pct(elapsed_sec: u64) -> u8 {
    if elapsed_sec <= 20 {
        55 + ((elapsed_sec * 20) / 20) as u8
    } else if elapsed_sec <= 60 {
        75 + (((elapsed_sec - 20) * 15) / 40) as u8
    } else if elapsed_sec <= 140 {
        90 + (((elapsed_sec - 60) * 6) / 80) as u8
    } else {
        (96 + (((elapsed_sec - 140) * 2) / 60) as u8).min(98)
    }
}

fn synthesize_heartbeat_status_text(intent: &str, elapsed_sec: u64) -> String {
    if intent == "refine-plan" {
        match elapsed_sec {
            0..=10 => format!(
                "Analyzing project requirements & domain constraints ({}s)...",
                elapsed_sec
            ),
            11..=35 => format!(
                "Synthesizing architectural blueprint, Mermaid diagrams & component contracts ({}s)...",
                elapsed_sec
            ),
            _ => format!(
                "Authoring detailed Markdown implementation plan & checklist specifications ({}s)...",
                elapsed_sec
            ),
        }
    } else if intent == "review" || intent == "explain" {
        format!(
            "Auditing workspace files & compiling verification report ({}s)...",
            elapsed_sec
        )
    } else {
        match elapsed_sec {
            0..=8 => format!(
                "Analyzing implementation plan & decomposing deliverables ({}s)...",
                elapsed_sec
            ),
            9..=25 => format!(
                "Reasoning engine synthesizing specifications & logic ({}s)...",
                elapsed_sec
            ),
            26..=60 => format!(
                "Deep multi-file generation: writing HTML, CSS & JavaScript modules ({}s)...",
                elapsed_sec
            ),
            61..=120 => format!(
                "Verifying component dependencies, AST & interactive simulation states ({}s)...",
                elapsed_sec
            ),
            _ => {
                let mins = elapsed_sec / 60;
                let secs = elapsed_sec % 60;
                format!(
                    "Finalizing companion assets, code settling & invariant audits ({}m {}s)...",
                    mins, secs
                )
            }
        }
    }
}
