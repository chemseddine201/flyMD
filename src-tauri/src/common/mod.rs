//! Shared common utilities across backend subsystems.

pub mod naming;
pub mod process;
pub mod stream_parsers;
pub mod time;
pub mod utf8;

pub use naming::{
    compose_smart_deliverable_name, resolve_unique_deliverable_path, slugify_semantic_title,
    transliterate_arabic_to_ascii, DeliverableNamingContext,
};
pub use process::{find_binary_on_system, get_user_home_dir, is_pid_alive, kill_process_tree};
pub use stream_parsers::{parse_ollama_line, parse_openai_sse_line, StreamDelta};
pub use time::now_ms;
pub use utf8::{safe_tail_utf8, truncate_utf8_bytes_boundary, truncate_utf8_chars};
