//! Multi-Agent Discussion System Subsystem
//!
//! Provides structured, bounded multi-agent debate and consensus synthesis.

pub mod memory;
pub mod orchestrator;
pub mod report;
pub mod runner;
pub mod skills;
pub mod storage;
pub mod types;

pub use memory::*;
pub use orchestrator::*;
pub use report::*;
pub use runner::*;
pub use skills::*;
pub use storage::*;
pub use types::*;
