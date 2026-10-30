//! Storage integrity, atomic file writes, session locking, and JSONL recovery.

use super::types::{now_ms, DiscussionMessage, DiscussionMetadata};
use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SessionLockData {
    pub pid: u32,
    pub timestamp: i64,
    #[serde(rename = "sessionId")]
    pub session_id: String,
}

/// Resolves the canonical discussion directory inside the `.flymd` namespace.
pub fn resolve_discussion_dir(workspace_path: &str, session_id: &str) -> PathBuf {
    Path::new(workspace_path)
        .join(".flymd")
        .join("discussions")
        .join(session_id)
}

/// Initializes directory tree for a new discussion session.
pub fn initialize_discussion_workspace(
    workspace_path: &str,
    session_id: &str,
) -> Result<PathBuf, String> {
    let session_dir = resolve_discussion_dir(workspace_path, session_id);
    let subdirs = ["rounds", "agents", "reports", ".sandbox"];

    for sub in &subdirs {
        let p = session_dir.join(sub);
        fs::create_dir_all(&p)
            .map_err(|e| format!("Failed to create discussion directory {:?}: {}", p, e))?;
    }

    Ok(session_dir)
}

/// Atomically writes content to a target path via a temporary file and rename.
pub fn atomic_write_file(target: &Path, content: &[u8]) -> Result<(), String> {
    let parent = target
        .parent()
        .ok_or_else(|| format!("Target path {:?} has no parent directory", target))?;
    fs::create_dir_all(parent)
        .map_err(|e| format!("Failed to create parent directory {:?}: {}", parent, e))?;

    let tmp_name = format!(
        ".{}.tmp.{}",
        target
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("file"),
        now_ms()
    );
    let tmp_path = parent.join(tmp_name);

    {
        let mut f = File::create(&tmp_path)
            .map_err(|e| format!("Failed creating temp file {:?}: {}", tmp_path, e))?;
        f.write_all(content)
            .map_err(|e| format!("Failed writing temp file {:?}: {}", tmp_path, e))?;
        f.flush()
            .map_err(|e| format!("Failed flushing temp file {:?}: {}", tmp_path, e))?;
    }

    // Atomic rename (replaces existing file on Windows / POSIX)
    #[cfg(target_os = "windows")]
    {
        if target.exists() {
            let _ = fs::remove_file(target);
        }
    }

    fs::rename(&tmp_path, target).map_err(|e| {
        let _ = fs::remove_file(&tmp_path);
        format!(
            "Failed atomically renaming {:?} to {:?}: {}",
            tmp_path, target, e
        )
    })?;

    Ok(())
}

/// Serializes and atomically writes a data structure to JSON.
pub fn atomic_write_json<T: Serialize>(target: &Path, value: &T) -> Result<(), String> {
    let json_bytes = serde_json::to_vec_pretty(value)
        .map_err(|e| format!("JSON serialization error for {:?}: {}", target, e))?;
    atomic_write_file(target, &json_bytes)
}

/// Check if a process ID is currently running on the system.
pub fn is_pid_alive(pid: u32) -> bool {
    if pid == 0 {
        return false;
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        // Exact CSV second-column PID match without flashing a console window
        if let Ok(output) = Command::new("tasklist")
            .args(["/FI", &format!("PID eq {}", pid), "/FO", "CSV", "/NH"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
        {
            let text = String::from_utf8_lossy(&output.stdout);
            let needle = format!("\"{}\"", pid);
            return text
                .lines()
                .any(|line| line.split(',').nth(1).map(|col| col.trim()) == Some(needle.as_str()));
        }
        false
    }
    #[cfg(not(target_os = "windows"))]
    {
        Path::new(&format!("/proc/{}", pid)).exists()
    }
}

/// Returns `true` only if `.session.lock` exists and belongs to a different live OS process.
/// Automatically prunes stale locks left behind by dead/crashed processes.
pub fn has_live_external_lock(session_dir: &Path) -> bool {
    let lock_path = session_dir.join(".session.lock");
    if !lock_path.exists() {
        return false;
    }
    let my_pid = std::process::id();
    if let Ok(bytes) = fs::read(&lock_path) {
        if let Ok(lock_data) = serde_json::from_slice::<SessionLockData>(&bytes) {
            if lock_data.pid != my_pid && is_pid_alive(lock_data.pid) {
                return true;
            }
        }
    }
    let _ = fs::remove_file(&lock_path);
    false
}

/// Single-session file lock to prevent concurrent executions of the same session.
pub struct SessionLock {
    lock_path: PathBuf,
}

impl SessionLock {
    pub fn acquire(session_dir: &Path, session_id: &str) -> Result<Self, String> {
        let lock_path = session_dir.join(".session.lock");
        let my_pid = std::process::id();

        if lock_path.exists() {
            if let Ok(bytes) = fs::read(&lock_path) {
                if let Ok(lock_data) = serde_json::from_slice::<SessionLockData>(&bytes) {
                    if lock_data.pid != my_pid && is_pid_alive(lock_data.pid) {
                        return Err(format!(
                            "Discussion session '{}' is already active and locked by process PID {}.",
                            session_id, lock_data.pid
                        ));
                    } else {
                        // Stale lock from dead PID detected: self-healing prune
                        let _ = fs::remove_file(&lock_path);
                    }
                } else {
                    // Corrupted lock file: self-healing prune
                    let _ = fs::remove_file(&lock_path);
                }
            } else {
                let _ = fs::remove_file(&lock_path);
            }
        }

        let lock_data = SessionLockData {
            pid: my_pid,
            timestamp: now_ms(),
            session_id: session_id.to_string(),
        };

        atomic_write_json(&lock_path, &lock_data)?;

        Ok(Self { lock_path })
    }
}

impl Drop for SessionLock {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.lock_path);
    }
}

/// Appends a message to `transcript.jsonl` with immediate flush.
pub fn append_transcript_message(
    session_dir: &Path,
    msg: &DiscussionMessage,
) -> Result<(), String> {
    let transcript_path = session_dir.join("transcript.jsonl");
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&transcript_path)
        .map_err(|e| format!("Failed to open transcript {:?}: {}", transcript_path, e))?;

    let mut line =
        serde_json::to_string(msg).map_err(|e| format!("Failed to serialize message: {}", e))?;
    line.push('\n');

    file.write_all(line.as_bytes())
        .map_err(|e| format!("Failed writing transcript line: {}", e))?;
    file.flush()
        .map_err(|e| format!("Failed flushing transcript line: {}", e))?;

    Ok(())
}

/// Reads canonical transcript from `transcript.jsonl`, recovering from trailing partial writes.
pub fn read_transcript_with_recovery(
    session_dir: &Path,
) -> Result<(Vec<DiscussionMessage>, bool), String> {
    let transcript_path = session_dir.join("transcript.jsonl");
    if !transcript_path.exists() {
        return Ok((Vec::new(), false));
    }

    let file = File::open(&transcript_path)
        .map_err(|e| format!("Failed opening transcript {:?}: {}", transcript_path, e))?;
    let reader = BufReader::new(file);

    let mut messages = Vec::new();
    let mut partial_detected = false;
    let lines: Vec<String> = reader.lines().map_while(Result::ok).collect();

    for (idx, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        match serde_json::from_str::<DiscussionMessage>(trimmed) {
            Ok(msg) => messages.push(msg),
            Err(e) => {
                // If it's the last line, it is likely an interrupted trailing write
                if idx == lines.len() - 1 {
                    partial_detected = true;
                    eprintln!(
                        "[DiscussionStorage] Warning: Partial trailing JSONL line discarded in {:?}: {}",
                        transcript_path, e
                    );
                } else {
                    return Err(format!(
                        "Corrupted JSONL message at line {} in {:?}: {}",
                        idx + 1,
                        transcript_path,
                        e
                    ));
                }
            }
        }
    }

    Ok((messages, partial_detected))
}

/// Atomically saves discussion metadata to `metadata.json`.
pub fn save_metadata(session_dir: &Path, metadata: &DiscussionMetadata) -> Result<(), String> {
    let path = session_dir.join("metadata.json");
    atomic_write_json(&path, metadata)
}

/// Loads discussion metadata from `metadata.json`.
pub fn load_metadata(session_dir: &Path) -> Result<DiscussionMetadata, String> {
    let path = session_dir.join("metadata.json");
    let bytes = fs::read(&path).map_err(|e| format!("Failed reading {:?}: {}", path, e))?;
    serde_json::from_slice(&bytes).map_err(|e| format!("Failed parsing metadata {:?}: {}", path, e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::discussion::types::DiscussionMessageKind;

    #[test]
    fn test_atomic_write_and_read() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_test_{}", now_ms()));
        let target = temp_dir.join("test_data.json");

        #[derive(Serialize, Deserialize, PartialEq, Debug)]
        struct TestData {
            key: String,
            num: u32,
        }

        let original = TestData {
            key: "safe_write".to_string(),
            num: 42,
        };

        atomic_write_json(&target, &original).unwrap();
        assert!(target.exists());

        let read_bytes = fs::read(&target).unwrap();
        let loaded: TestData = serde_json::from_slice(&read_bytes).unwrap();
        assert_eq!(original, loaded);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_partial_jsonl_recovery() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_test_recovery_{}", now_ms()));
        fs::create_dir_all(&temp_dir).unwrap();

        let valid_msg = DiscussionMessage {
            id: "msg-1".to_string(),
            session_id: "s-1".to_string(),
            round_number: 1,
            turn_index: 0,
            author_agent_id: "agent-1".to_string(),
            author_role: "Architect".to_string(),
            author_provider: "claude-code".to_string(),
            message_kind: DiscussionMessageKind::InitialAnalysis,
            target_peer_ids: vec![],
            content: "Initial position proposal.".to_string(),
            timestamp: now_ms(),
            token_usage: None,
            duration_ms: 100,
            truncated: false,
            thinking_content: None,
            action_name: None,
            model_id: Some("claude-3-7-sonnet".to_string()),
            simulated: false,
            author_display_name: Some("Architect 1".to_string()),
        };

        append_transcript_message(&temp_dir, &valid_msg).unwrap();

        // Simulate interrupted trailing write
        let transcript_path = temp_dir.join("transcript.jsonl");
        let mut f = OpenOptions::new()
            .append(true)
            .open(&transcript_path)
            .unwrap();
        writeln!(
            f,
            "{{\"id\": \"msg-partial\", \"content\": \"incomplete write"
        )
        .unwrap();
        drop(f);

        let (msgs, partial_detected) = read_transcript_with_recovery(&temp_dir).unwrap();
        assert!(partial_detected);
        assert_eq!(msgs.len(), 1);
        assert_eq!(msgs[0].id, "msg-1");

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
