//! Multi-Agent Discussion System Subsystem
//!
//! Provides structured, bounded multi-agent debate and consensus synthesis.

pub mod board;
pub mod commands;
pub mod convergence;
pub mod epistemic;
pub mod manager;
pub mod memory;
pub mod orchestrator;
pub mod provider_registry;
pub mod report;
pub mod runner;
pub mod skills;
pub mod storage;
pub mod types;

pub mod ab_harness;

#[cfg(test)]
pub mod golden_tests;

pub use board::*;
pub use commands::*;
pub use convergence::*;
pub use epistemic::*;
pub use manager::*;
pub use memory::*;
pub use orchestrator::*;
pub use provider_registry::*;
pub use report::*;
pub use runner::*;
pub use skills::*;
pub use storage::*;
pub use types::*;
