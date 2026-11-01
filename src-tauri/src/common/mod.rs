//! Shared common utilities across backend subsystems.

pub mod process;
pub mod stream_parsers;
pub mod time;
pub mod utf8;

pub use process::{find_binary_on_system, get_user_home_dir, kill_process_tree};
pub use stream_parsers::{parse_ollama_line, parse_openai_sse_line, StreamDelta};
pub use time::now_ms;
pub use utf8::{safe_tail_utf8, truncate_utf8_bytes_boundary, truncate_utf8_chars};
