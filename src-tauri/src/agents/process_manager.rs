//! Targeted Process Tree Manager for FlyMD Multi-Agent Studio.
//!
//! Strictly tracks the exact root PID spawned for each task ID and terminates
//! only that specific PID and its child process tree (e.g. `uvx`, `conhost`).
//! Guarantees that external `agy.exe` or `claude.exe` processes running on other
//! projects are NEVER touched.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Clone, Debug)]
pub struct TrackedProcess {
    pub task_id: String,
    pub root_pid: u32,
    pub target_agent: String,
    pub workspace_path: String,
    pub spawned_at: i64,
}

#[derive(Clone, Default)]
pub struct ProcessTreeManager {
    processes: Arc<Mutex<HashMap<String, TrackedProcess>>>,
}

impl ProcessTreeManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Register a newly spawned agent process for a specific task ID.
    pub fn register_task_process(
        &self,
        task_id: &str,
        root_pid: u32,
        target_agent: &str,
        workspace_path: &str,
    ) {
        if root_pid == 0 {
            return;
        }
        let mut map = self.processes.lock().unwrap_or_else(|e| e.into_inner());
        map.insert(
            task_id.to_string(),
            TrackedProcess {
                task_id: task_id.to_string(),
                root_pid,
                target_agent: target_agent.to_string(),
                workspace_path: workspace_path.to_string(),
                spawned_at: chrono_now_ms(),
            },
        );
    }

    /// Unregister a task process once it completes or terminates normally.
    pub fn unregister_task_process(&self, task_id: &str) {
        let mut map = self.processes.lock().unwrap_or_else(|e| e.into_inner());
        map.remove(task_id);
    }

    /// Get the tracked PID for a specific task.
    pub fn get_task_pid(&self, task_id: &str) -> Option<u32> {
        let map = self.processes.lock().unwrap_or_else(|e| e.into_inner());
        map.get(task_id).map(|p| p.root_pid)
    }

    /// Check if the tracked process for this task is still running.
    pub fn is_task_alive(&self, task_id: &str) -> bool {
        if let Some(pid) = self.get_task_pid(task_id) {
            is_pid_alive(pid)
        } else {
            false
        }
    }

    /// Strictly terminate ONLY the process tree belonging to this specific task ID.
    /// External processes running in other workspaces/terminals are 100% untouched.
    pub fn terminate_task_tree(&self, task_id: &str) -> bool {
        let tracked = {
            let mut map = self.processes.lock().unwrap_or_else(|e| e.into_inner());
            map.remove(task_id)
        };

        if let Some(proc) = tracked {
            if proc.root_pid > 0 {
                kill_process_tree(proc.root_pid);
                return true;
            }
        }
        false
    }

    /// Terminate ALL tracked FlyMD agent processes (invoked on application shutdown).
    /// Only processes registered in this manager will be terminated.
    pub fn terminate_all_flymd_tasks(&self) {
        let procs = {
            let mut map = self.processes.lock().unwrap_or_else(|e| e.into_inner());
            let all: Vec<TrackedProcess> = map.values().cloned().collect();
            map.clear();
            all
        };

        for p in procs {
            if p.root_pid > 0 {
                kill_process_tree(p.root_pid);
            }
        }
    }
}

/// Terminate a process tree starting at `root_pid`.
/// On Windows, `taskkill /PID <pid> /T /F` cleanly forces termination of the root
/// and all child subprocesses (`uvx`, `conhost`, `python`, etc.) without touching any sibling processes.
pub fn kill_process_tree(pid: u32) {
    if pid == 0 {
        return;
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;

        // CREATE_NO_WINDOW = 0x08000000
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .creation_flags(0x08000000)
            .output();
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;
        let _ = Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output();
    }
}

/// Check if a PID is alive on the operating system.
pub fn is_pid_alive(pid: u32) -> bool {
    if pid == 0 {
        return false;
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;

        if let Ok(output) = Command::new("tasklist")
            .args(["/FI", &format!("PID eq {}", pid), "/NH"])
            .creation_flags(0x08000000)
            .output()
        {
            let text = String::from_utf8_lossy(&output.stdout);
            return text.contains(&pid.to_string());
        }
        false
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;
        Command::new("kill")
            .args(["-0", &pid.to_string()])
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    }
}

fn chrono_now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
