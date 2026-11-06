//! Multi-Agent Studio & Autonomous Supervisor orchestration subsystem.
//!
//! Organized into cohesive Single-Responsibility submodules:
//! - `types`: Core data models and serialization structs
//! - `discovery`: System binary detection and agent credentials
//! - `auth_launcher`: Platform CLI login terminal and browser OAuth launchers
//! - `handoff_prompt`: Workspace resolution, git worktrees, and epistemic handoff assembly
//! - `orchestrator`: `AgentOrchestrator` task lifecycle and credential state coordinator
//! - `runner`: Subprocess CLI execution, stream decoding, watchdog, diagnostics, and handoff sync
//! - `checkpoint`: Safety restore points and project memory ledger
//! - `process_manager`: Child process tree registration and termination
//! - `verify`: Deterministic deliverable verification engine
//! - `commands`: Thin Tauri IPC command endpoints

pub mod auth_launcher;
pub mod checkpoint;
pub mod commands;
pub mod discovery;
pub mod handoff_prompt;
pub mod orchestrator;
pub mod process_manager;
pub mod runner;
pub mod types;
pub mod verify;

pub use auth_launcher::*;
pub use checkpoint::*;
pub use commands::*;
pub use discovery::*;
pub use handoff_prompt::*;
pub use orchestrator::*;
pub use process_manager::*;
pub use runner::*;
pub use types::*;
pub use verify::*;
