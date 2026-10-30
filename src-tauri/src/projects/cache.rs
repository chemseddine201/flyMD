//! Cross-Model Semantic State Envelope (`CognitiveHandoffPacket`) & SHA-256 Workspace Digest Cache.
//!
//! Enables Agent 1 (e.g. Architect / Claude) to transfer verified file comprehension, DOM/symbol
//! contracts, locked invariants, and targeted `@Role` peer directives directly to Agent 2
//! (e.g. Implementer / Gemini / DeepSeek / Ollama) without redundant file re-scans, while
//! providing cryptographic SHA-256 staleness verification so stale files are deterministically re-read.

use crate::discussion::storage::atomic_write_json;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

pub const COGNITIVE_CACHE_SCHEMA_VERSION: u32 = 1;

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

// ============================================================================
// Pure FIPS 180-4 SHA-256 Implementation (Zero external crate dependency)
// ============================================================================

const K256: [u32; 64] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/// Computes standard lowercase hexadecimal FIPS 180-4 SHA-256 digest of `data`.
pub fn sha256_hex(data: &[u8]) -> String {
    let mut h: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];

    let bit_len = (data.len() as u64).wrapping_mul(8);
    let mut padded = Vec::with_capacity(((data.len() + 9 + 63) / 64) * 64);
    padded.extend_from_slice(data);
    padded.push(0x80);
    while (padded.len() % 64) != 56 {
        padded.push(0x00);
    }
    padded.extend_from_slice(&bit_len.to_be_bytes());

    for chunk in padded.chunks_exact(64) {
        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([
                chunk[i * 4],
                chunk[i * 4 + 1],
                chunk[i * 4 + 2],
                chunk[i * 4 + 3],
            ]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16]
                .wrapping_add(s0)
                .wrapping_add(w[i - 7])
                .wrapping_add(s1);
        }

        let mut a = h[0];
        let mut b = h[1];
        let mut c = h[2];
        let mut d = h[3];
        let mut e = h[4];
        let mut f = h[5];
        let mut g = h[6];
        let mut hh = h[7];

        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let temp1 = hh
                .wrapping_add(s1)
                .wrapping_add(ch)
                .wrapping_add(K256[i])
                .wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let temp2 = s0.wrapping_add(maj);

            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(temp1);
            d = c;
            c = b;
            b = a;
            a = temp1.wrapping_add(temp2);
        }

        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
        h[5] = h[5].wrapping_add(f);
        h[6] = h[6].wrapping_add(g);
        h[7] = h[7].wrapping_add(hh);
    }

    format!(
        "{:08x}{:08x}{:08x}{:08x}{:08x}{:08x}{:08x}{:08x}",
        h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7]
    )
}

// ============================================================================
// Data Structures for Cross-Model Semantic State Transfer
// ============================================================================

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, Default)]
pub struct WorkspaceFileDigest {
    #[serde(rename = "relPath")]
    pub rel_path: String,
    pub sha256: String,
    pub lines: usize,
    pub bytes: u64,
    #[serde(rename = "domContracts", default)]
    pub dom_contracts: Vec<String>,
    #[serde(rename = "exportedSymbols", default)]
    pub exported_symbols: Vec<String>,
    #[serde(default)]
    pub summary: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, Default)]
pub struct PeerDirectMessage {
    #[serde(rename = "fromAgent")]
    pub from_agent: String,
    #[serde(rename = "fromRole")]
    pub from_role: String,
    #[serde(rename = "toTarget")]
    pub to_target: String,
    #[serde(default = "default_peer_msg_kind")]
    pub kind: String,
    pub message: String,
}

fn default_peer_msg_kind() -> String {
    "directive".to_string()
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct CognitiveHandoffPacket {
    #[serde(rename = "schemaVersion", default = "default_schema_version")]
    pub schema_version: u32,
    #[serde(rename = "updatedAt", default)]
    pub updated_at: i64,
    #[serde(rename = "producerAgent", default)]
    pub producer_agent: String,
    #[serde(rename = "producerRole", default)]
    pub producer_role: String,
    #[serde(rename = "pipelineId", default, skip_serializing_if = "Option::is_none")]
    pub pipeline_id: Option<String>,
    #[serde(rename = "stepOrRound", default)]
    pub step_or_round: u32,
    #[serde(default = "default_confidence")]
    pub confidence: String,
    #[serde(rename = "originalContractHash", default, skip_serializing_if = "Option::is_none")]
    pub original_contract_hash: Option<String>,
    #[serde(rename = "originalContractExcerpt", default, skip_serializing_if = "Option::is_none")]
    pub original_contract_excerpt: Option<String>,
    #[serde(rename = "workspaceDigest", default)]
    pub workspace_digest: BTreeMap<String, WorkspaceFileDigest>,
    #[serde(rename = "lockedInvariants", default)]
    pub locked_invariants: Vec<String>,
    #[serde(rename = "activeDisputes", default)]
    pub active_disputes: Vec<String>,
    #[serde(rename = "unverifiedAssumptions", default)]
    pub unverified_assumptions: Vec<String>,
    #[serde(rename = "independentResumes", default)]
    pub independent_resumes: BTreeMap<String, String>,
    #[serde(rename = "peerMessages", default)]
    pub peer_messages: Vec<PeerDirectMessage>,
    #[serde(rename = "lastCliAgentId", default, skip_serializing_if = "Option::is_none")]
    pub last_cli_agent_id: Option<String>,
    #[serde(rename = "lastCliCompletedAt", default, skip_serializing_if = "Option::is_none")]
    pub last_cli_completed_at: Option<i64>,
}

fn default_schema_version() -> u32 {
    COGNITIVE_CACHE_SCHEMA_VERSION
}

fn default_confidence() -> String {
    "high".to_string()
}

/// Result of comparing cached `WorkspaceFileDigest` hashes against actual disk files.
#[derive(Debug, Clone, Default)]
pub struct DigestVerificationReport {
    pub unchanged_files: Vec<String>,
    pub stale_or_modified_files: Vec<String>,
    pub new_unindexed_files: Vec<String>,
    pub deleted_files: Vec<String>,
}

impl DigestVerificationReport {
    pub fn has_drift(&self) -> bool {
        !self.stale_or_modified_files.is_empty()
            || !self.new_unindexed_files.is_empty()
            || !self.deleted_files.is_empty()
    }
}

/// Extracted structured output from an agent's Markdown response (via `<handoff_state>` JSON or deterministic Markdown cues).
#[derive(Debug, Clone, Default)]
pub struct ParsedAgentCognitiveOutput {
    pub clean_markdown: String,
    pub confidence: Option<String>,
    pub locked_invariants: Vec<String>,
    pub active_disputes: Vec<String>,
    pub unverified_assumptions: Vec<String>,
    pub independent_resume: Option<String>,
    pub peer_messages: Vec<PeerDirectMessage>,
}

// ============================================================================
// Workspace Scanner & Symbol / DOM Contract Extractor
// ============================================================================

fn is_indexable_source_file(path: &Path) -> bool {
    let Some(ext) = path.extension().and_then(|e| e.to_str()) else {
        return false;
    };
    matches!(
        ext.to_ascii_lowercase().as_str(),
        "html"
            | "htm"
            | "css"
            | "scss"
            | "js"
            | "mjs"
            | "cjs"
            | "jsx"
            | "ts"
            | "tsx"
            | "json"
            | "md"
            | "markdown"
            | "rs"
            | "py"
            | "php"
            | "sql"
            | "toml"
            | "yaml"
            | "yml"
    )
}

fn should_skip_dir(dir_name: &str) -> bool {
    dir_name.starts_with('.')
        || matches!(
            dir_name,
            "node_modules" | "target" | "dist" | "release" | "vendor" | "build" | "__pycache__"
        )
}

/// Extracts DOM IDs (`#id`), top-level symbols/exports, and a 1-line structural summary from source text.
pub fn extract_file_contracts_and_symbols(
    rel_path: &str,
    content: &str,
) -> (Vec<String>, Vec<String>, String) {
    let ext = Path::new(rel_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    let mut dom_contracts: Vec<String> = Vec::new();
    let mut symbols: Vec<String> = Vec::new();
    let mut first_heading_or_title: Option<String> = None;

    // Extract DOM id="..." or getElementById('...')
    for marker in ["id=\"", "id='", "getElementById(\"", "getElementById('"] {
        let mut rest = content;
        while let Some(pos) = rest.find(marker) {
            let after = &rest[pos + marker.len()..];
            let end = after
                .find(|c: char| c == '"' || c == '\'' || c.is_whitespace())
                .unwrap_or(0);
            if end > 0 && end <= 48 {
                let candidate = &after[..end];
                if candidate
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
                {
                    let formatted = format!("#{}", candidate);
                    if !dom_contracts.contains(&formatted) && dom_contracts.len() < 18 {
                        dom_contracts.push(formatted);
                    }
                }
            }
            if end + marker.len() < rest.len() {
                rest = &after[end..];
            } else {
                break;
            }
        }
    }

    for line in content.lines() {
        let t = line.trim();
        if t.is_empty() {
            continue;
        }

        if first_heading_or_title.is_none() {
            if let Some(t_start) = t.find("<title>") {
                if let Some(t_end) = t[t_start + 7..].find("</title>") {
                    let title = t[t_start + 7..t_start + 7 + t_end].trim();
                    if !title.is_empty() {
                        first_heading_or_title = Some(title.to_string());
                    }
                }
            } else if (ext == "md" || ext == "markdown") && t.starts_with('#') {
                let h = t.trim_start_matches('#').trim();
                if !h.is_empty() {
                    first_heading_or_title = Some(h.to_string());
                }
            }
        }

        if symbols.len() >= 16 {
            continue;
        }

        match ext.as_str() {
            "js" | "mjs" | "cjs" | "jsx" | "ts" | "tsx" => {
                for prefix in [
                    "export async function ",
                    "export function ",
                    "async function ",
                    "function ",
                    "export class ",
                    "class ",
                    "export const ",
                    "export interface ",
                    "export type ",
                ] {
                    if let Some(rest) = t.strip_prefix(prefix) {
                        let name: String = rest
                            .chars()
                            .take_while(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '$')
                            .collect();
                        if !name.is_empty() && !symbols.contains(&name) {
                            symbols.push(name);
                        }
                        break;
                    }
                }
            }
            "rs" => {
                for prefix in [
                    "pub async fn ",
                    "pub fn ",
                    "pub struct ",
                    "pub enum ",
                    "pub trait ",
                ] {
                    if let Some(rest) = t.strip_prefix(prefix) {
                        let name: String = rest
                            .chars()
                            .take_while(|c| c.is_ascii_alphanumeric() || *c == '_')
                            .collect();
                        if !name.is_empty() && !symbols.contains(&name) {
                            symbols.push(name);
                        }
                        break;
                    }
                }
            }
            "py" => {
                for prefix in ["async def ", "def ", "class "] {
                    if let Some(rest) = t.strip_prefix(prefix) {
                        let name: String = rest
                            .chars()
                            .take_while(|c| c.is_ascii_alphanumeric() || *c == '_')
                            .collect();
                        if !name.is_empty() && !symbols.contains(&name) {
                            symbols.push(name);
                        }
                        break;
                    }
                }
            }
            "css" | "scss" => {
                if (t.starts_with('.') || t.starts_with('#') || t.starts_with(":root"))
                    && t.contains('{')
                {
                    let sel = t.split('{').next().unwrap_or("").trim();
                    if !sel.is_empty() && sel.len() <= 36 && !symbols.contains(&sel.to_string()) {
                        symbols.push(sel.to_string());
                    }
                }
            }
            "md" | "markdown" => {
                if t.starts_with("## ") || t.starts_with("### ") {
                    let h = t.trim_start_matches('#').trim();
                    if !h.is_empty() && h.len() <= 60 && !symbols.contains(&h.to_string()) {
                        symbols.push(h.to_string());
                    }
                }
            }
            _ => {}
        }
    }

    let summary = if let Some(title) = first_heading_or_title {
        format!("{} ({})", title, ext.to_uppercase())
    } else if !dom_contracts.is_empty() {
        format!(
            "{} module binding {} DOM node(s)",
            ext.to_uppercase(),
            dom_contracts.len()
        )
    } else if !symbols.is_empty() {
        format!(
            "{} module exporting {}",
            ext.to_uppercase(),
            symbols.iter().take(4).cloned().collect::<Vec<_>>().join(", ")
        )
    } else {
        format!("{} workspace asset", ext.to_uppercase())
    };

    (dom_contracts, symbols, summary)
}

/// Scans up to `max_files` indexable source files in `workspace_path` and builds a deterministic SHA-256 map.
pub fn scan_workspace_digest(
    workspace_path: &Path,
    max_files: usize,
) -> BTreeMap<String, WorkspaceFileDigest> {
    let mut map = BTreeMap::new();
    if !workspace_path.exists() || !workspace_path.is_dir() {
        return map;
    }

    fn walk(
        dir: &Path,
        base: &Path,
        max_files: usize,
        out: &mut BTreeMap<String, WorkspaceFileDigest>,
    ) {
        if out.len() >= max_files {
            return;
        }
        let Ok(entries) = fs::read_dir(dir) else {
            return;
        };
        let mut sorted: Vec<_> = entries.flatten().collect();
        sorted.sort_by_key(|e| e.file_name());

        for entry in sorted {
            if out.len() >= max_files {
                break;
            }
            let path = entry.path();
            let fname = path.file_name().unwrap_or_default().to_string_lossy();
            if path.is_dir() {
                if !should_skip_dir(&fname) {
                    walk(&path, base, max_files, out);
                }
            } else if path.is_file() && is_indexable_source_file(&path) {
                let Ok(meta) = path.metadata() else { continue };
                if meta.len() > 512 * 1024 {
                    continue;
                }
                let Ok(bytes) = fs::read(&path) else { continue };
                let Ok(rel) = path.strip_prefix(base) else {
                    continue;
                };
                let rel_norm = rel.to_string_lossy().replace('\\', "/");
                let sha = sha256_hex(&bytes);
                let text = String::from_utf8_lossy(&bytes);
                let line_count = text.lines().count();
                let (dom_contracts, exported_symbols, summary) =
                    extract_file_contracts_and_symbols(&rel_norm, &text);

                out.insert(
                    rel_norm.clone(),
                    WorkspaceFileDigest {
                        rel_path: rel_norm,
                        sha256: sha,
                        lines: line_count,
                        bytes: meta.len(),
                        dom_contracts,
                        exported_symbols,
                        summary,
                    },
                );
            }
        }
    }

    walk(workspace_path, workspace_path, max_files, &mut map);
    map
}

/// Cryptographically verifies cached file hashes against current disk files (< 1ms for typical projects).
pub fn verify_cached_digests(
    workspace_path: &Path,
    cached: &BTreeMap<String, WorkspaceFileDigest>,
) -> DigestVerificationReport {
    let live = scan_workspace_digest(workspace_path, 64);
    let mut report = DigestVerificationReport::default();

    for (rel, live_digest) in &live {
        match cached.get(rel) {
            Some(prev) if prev.sha256 == live_digest.sha256 => {
                report.unchanged_files.push(rel.clone());
            }
            Some(_) => {
                report.stale_or_modified_files.push(rel.clone());
            }
            None => {
                report.new_unindexed_files.push(rel.clone());
            }
        }
    }

    for rel in cached.keys() {
        if !live.contains_key(rel) {
            report.deleted_files.push(rel.clone());
        }
    }

    report
}

/// Reads targeted source excerpts (bounded lines) for specific files that require verification or blind audit.
pub fn read_targeted_file_slices(
    workspace_path: &Path,
    rel_paths: &[String],
    max_lines_per_file: usize,
    max_total_chars: usize,
) -> String {
    let mut out = String::new();
    for rel in rel_paths {
        if out.len() >= max_total_chars {
            break;
        }
        let full_path = workspace_path.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR));
        if !full_path.is_file() {
            continue;
        }
        let Ok(content) = fs::read_to_string(&full_path) else {
            continue;
        };
        let total_lines = content.lines().count();
        let preview: String = content
            .lines()
            .take(max_lines_per_file)
            .collect::<Vec<_>>()
            .join("\n");
        out.push_str(&format!(
            "#### Raw Disk Slice: `{}` ({} total lines)\n```\n{}\n```\n",
            rel, total_lines, preview
        ));
        if total_lines > max_lines_per_file {
            out.push_str(&format!(
                "> *(Showing first {} of {} lines; inspect `{}` on disk if deeper lines are needed.)*\n\n",
                max_lines_per_file, total_lines, rel
            ));
        } else {
            out.push('\n');
        }
    }
    out
}

// ============================================================================
// Persistence (.flymd/cache/cognitive_state.json)
// ============================================================================

pub fn cognitive_cache_path(workspace_path: &Path) -> std::path::PathBuf {
    workspace_path
        .join(".flymd")
        .join("cache")
        .join("cognitive_state.json")
}

pub fn load_cognitive_packet(workspace_path: &Path) -> Option<CognitiveHandoffPacket> {
    let path = cognitive_cache_path(workspace_path);
    if !path.exists() {
        return None;
    }
    let bytes = fs::read(&path).ok()?;
    serde_json::from_slice::<CognitiveHandoffPacket>(&bytes).ok()
}

pub fn save_cognitive_packet(
    workspace_path: &Path,
    packet: &CognitiveHandoffPacket,
) -> Result<(), String> {
    let path = cognitive_cache_path(workspace_path);
    atomic_write_json(&path, packet)
}

/// Formats a compact (~150–300 token) Markdown digest of the verified `CognitiveHandoffPacket`.
pub fn format_compact_digest_markdown(
    packet: &CognitiveHandoffPacket,
    include_upstream_claims: bool,
) -> String {
    let mut s = String::new();
    s.push_str(&format!(
        "### Verified Cross-Model Cognitive Cache (Last Updated by `{}` / `{}`)\n",
        if packet.producer_agent.is_empty() {
            "workspace-indexer"
        } else {
            &packet.producer_agent
        },
        if packet.producer_role.is_empty() {
            "System"
        } else {
            &packet.producer_role
        }
    ));

    if !packet.workspace_digest.is_empty() {
        s.push_str("| File | SHA-256 (short) | Lines | Verified Contracts & Exported Symbols |\n");
        s.push_str("| :--- | :--- | :--- | :--- |\n");
        for (rel, d) in packet.workspace_digest.iter().take(24) {
            let short_sha = &d.sha256[..d.sha256.len().min(10)];
            let mut contracts: Vec<String> = Vec::new();
            for dom in d.dom_contracts.iter().take(6) {
                contracts.push(format!("`{}`", dom));
            }
            for sym in d.exported_symbols.iter().take(6) {
                contracts.push(format!("`{}`", sym));
            }
            let detail = if contracts.is_empty() {
                d.summary.clone()
            } else {
                format!("{} — {}", d.summary, contracts.join(", "))
            };
            s.push_str(&format!(
                "| `{}` | `{}` | {} | {} |\n",
                rel, short_sha, d.lines, detail
            ));
        }
        s.push('\n');
    }

    if include_upstream_claims {
        if !packet.locked_invariants.is_empty() {
            s.push_str("**Locked Architectural Invariants**:\n");
            for inv in packet.locked_invariants.iter().take(8) {
                s.push_str(&format!("- {}\n", inv));
            }
            s.push('\n');
        }
        if !packet.unverified_assumptions.is_empty() {
            s.push_str("**Unverified Assumptions Flagged Upstream**:\n");
            for a in packet.unverified_assumptions.iter().take(5) {
                s.push_str(&format!("- {}\n", a));
            }
            s.push('\n');
        }
    }

    s
}

// ============================================================================
// Structured `<handoff_state>` + `<independent_resume>` + `@Role` Parser
// ============================================================================

#[derive(Deserialize, Default)]
struct RawHandoffJson {
    #[serde(default)]
    confidence: Option<String>,
    #[serde(default, alias = "lockedInvariants")]
    locked_invariants: Vec<String>,
    #[serde(default, alias = "activeDisputes")]
    active_disputes: Vec<String>,
    #[serde(default, alias = "unverifiedAssumptions")]
    unverified_assumptions: Vec<String>,
    #[serde(default, alias = "independentResume")]
    independent_resume: Option<String>,
    #[serde(default, alias = "peerMessages")]
    peer_messages: Vec<RawPeerMsgJson>,
}

#[derive(Deserialize, Default)]
struct RawPeerMsgJson {
    #[serde(default, alias = "toRole", alias = "to_role", alias = "to")]
    to_target: String,
    #[serde(default)]
    kind: Option<String>,
    #[serde(default, alias = "directive", alias = "question")]
    message: String,
}

fn extract_tag_block(text: &str, open_tag: &str, close_tag: &str) -> Option<(String, String)> {
    let lower = text.to_ascii_lowercase();
    let start = lower.find(&open_tag.to_ascii_lowercase())?;
    let content_start = start + open_tag.len();
    let rel_end = lower[content_start..].find(&close_tag.to_ascii_lowercase())?;
    let content_end = content_start + rel_end;
    let extracted = text[content_start..content_end].trim().to_string();

    let mut remaining = String::with_capacity(text.len());
    remaining.push_str(&text[..start]);
    remaining.push_str(&text[content_end + close_tag.len()..]);
    Some((extracted, remaining.trim().to_string()))
}

/// Parses `<handoff_state>` JSON blocks, `<independent_resume>` blocks, and Markdown `@Role` /
/// invariant / dispute cues from an agent's output. Strips raw `<handoff_state>` machine JSON
/// from `clean_markdown` so UI transcripts stay clean and readable.
pub fn parse_handoff_blocks_from_markdown(
    markdown: &str,
    author_agent: &str,
    author_role: &str,
) -> ParsedAgentCognitiveOutput {
    let mut out = ParsedAgentCognitiveOutput {
        clean_markdown: markdown.trim().to_string(),
        ..Default::default()
    };

    // 1. Extract optional `<handoff_state>...</handoff_state>` JSON envelope
    if let Some((raw_block, stripped_md)) =
        extract_tag_block(&out.clean_markdown, "<handoff_state>", "</handoff_state>")
    {
        out.clean_markdown = stripped_md;
        let json_candidate = raw_block
            .trim()
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();
        if let Ok(parsed) = serde_json::from_str::<RawHandoffJson>(json_candidate) {
            out.confidence = parsed.confidence;
            out.locked_invariants.extend(parsed.locked_invariants);
            out.active_disputes.extend(parsed.active_disputes);
            out.unverified_assumptions
                .extend(parsed.unverified_assumptions);
            if let Some(res) = parsed.independent_resume.filter(|s| !s.trim().is_empty()) {
                out.independent_resume = Some(res.trim().to_string());
            }
            for pm in parsed.peer_messages {
                if !pm.to_target.trim().is_empty() && !pm.message.trim().is_empty() {
                    out.peer_messages.push(PeerDirectMessage {
                        from_agent: author_agent.to_string(),
                        from_role: author_role.to_string(),
                        to_target: pm.to_target.trim().trim_start_matches('@').to_string(),
                        kind: pm.kind.unwrap_or_else(|| "directive".to_string()),
                        message: pm.message.trim().to_string(),
                    });
                }
            }
        }
    }

    // 2. Extract `<independent_resume>...</independent_resume>` (keep a clean readable callout in markdown)
    if let Some((resume_text, _)) =
        extract_tag_block(&out.clean_markdown, "<independent_resume>", "</independent_resume>")
    {
        if !resume_text.is_empty() && out.independent_resume.is_none() {
            out.independent_resume = Some(resume_text);
        }
    }

    // 3. Deterministic Markdown fallback cues (`@Architect:`, `@Implementer:`, `**Core Invariant**:`, `**Active Dispute**:`, etc.)
    let known_targets = [
        "architect",
        "implementer",
        "critic",
        "auditor",
        "researcher",
        "claude-code",
        "antigravity",
        "gemini-antigravity",
        "deepseek",
        "ollama",
    ];

    for line in out.clean_markdown.lines() {
        let trimmed = line
            .trim()
            .trim_start_matches(|c: char| c == '-' || c == '*' || c == '>')
            .trim();
        if trimmed.is_empty() {
            continue;
        }
        let lower = trimmed.to_ascii_lowercase();

        // Check `@Role:` or `To @Role:` direct peer mentions
        if let Some(at_pos) = trimmed.find('@') {
            if at_pos <= 6 {
                let after_at = &trimmed[at_pos + 1..];
                let target_token: String = after_at
                    .chars()
                    .take_while(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
                    .collect();
                let target_low = target_token.to_ascii_lowercase();
                if known_targets.contains(&target_low.as_str()) {
                    let msg_body = after_at[target_token.len()..]
                        .trim_start_matches(|c: char| c == ':' || c == '-' || c == ')' || c == ']')
                        .trim();
                    if msg_body.len() >= 10
                        && !out
                            .peer_messages
                            .iter()
                            .any(|m| m.message == msg_body)
                    {
                        let kind = if msg_body.ends_with('?') {
                            "question"
                        } else {
                            "directive"
                        };
                        out.peer_messages.push(PeerDirectMessage {
                            from_agent: author_agent.to_string(),
                            from_role: author_role.to_string(),
                            to_target: target_token,
                            kind: kind.to_string(),
                            message: msg_body.to_string(),
                        });
                    }
                }
            }
        }

        // Check invariant / consensus markers
        for marker in [
            "**core invariant**:",
            "**state invariants**:",
            "**consensus reached**:",
            "**agreed technical specification**:",
            "**firm stance**:",
            "locked invariant:",
        ] {
            if let Some(pos) = lower.find(marker) {
                let val = trimmed[pos + marker.len()..].trim();
                if val.len() >= 10
                    && out.locked_invariants.len() < 8
                    && !out.locked_invariants.iter().any(|x| x == val)
                {
                    out.locked_invariants.push(val.to_string());
                }
            }
        }

        // Check dispute markers
        for marker in [
            "**active dispute**:",
            "**active trade-off under dispute**:",
            "**identified trade-off**:",
            "disputed topic:",
        ] {
            if let Some(pos) = lower.find(marker) {
                let val = trimmed[pos + marker.len()..].trim();
                if val.len() >= 10
                    && out.active_disputes.len() < 6
                    && !out.active_disputes.iter().any(|x| x == val)
                {
                    out.active_disputes.push(val.to_string());
                }
            }
        }

        // Check unverified assumption markers
        for marker in ["**unverified assumption**:", "unverified assumption:"] {
            if let Some(pos) = lower.find(marker) {
                let val = trimmed[pos + marker.len()..].trim();
                if val.len() >= 10
                    && out.unverified_assumptions.len() < 6
                    && !out.unverified_assumptions.iter().any(|x| x == val)
                {
                    out.unverified_assumptions.push(val.to_string());
                }
            }
        }
    }

    out
}

/// Merges an agent's completed turn/task output + live disk SHA-256 scan into `.flymd/cache/cognitive_state.json`.
pub fn update_workspace_cognitive_cache(
    workspace_path: &Path,
    producer_agent: &str,
    producer_role: &str,
    pipeline_id: Option<&str>,
    step_or_round: u32,
    original_contract: Option<&str>,
    agent_output_markdown: &str,
    used_cli_agent_id: Option<&str>,
) -> CognitiveHandoffPacket {
    let mut packet = load_cognitive_packet(workspace_path).unwrap_or_default();
    let parsed = parse_handoff_blocks_from_markdown(
        agent_output_markdown,
        producer_agent,
        producer_role,
    );

    packet.schema_version = COGNITIVE_CACHE_SCHEMA_VERSION;
    packet.updated_at = now_ms();
    packet.producer_agent = producer_agent.to_string();
    packet.producer_role = producer_role.to_string();
    if let Some(pid) = pipeline_id {
        if packet.pipeline_id.as_deref() != Some(pid) {
            // Reset transient peer messages & disputes when starting a brand-new pipeline run
            packet.peer_messages.clear();
            packet.active_disputes.clear();
            packet.independent_resumes.clear();
        }
        packet.pipeline_id = Some(pid.to_string());
    }
    packet.step_or_round = step_or_round;
    packet.confidence = parsed.confidence.unwrap_or_else(|| "high".to_string());

    if let Some(contract) = original_contract.map(str::trim).filter(|s| !s.is_empty()) {
        let contract_sha = sha256_hex(contract.as_bytes());
        if packet.original_contract_hash.is_none() || step_or_round <= 1 {
            packet.original_contract_hash = Some(contract_sha);
            let excerpt: String = contract.chars().take(1800).collect();
            packet.original_contract_excerpt = Some(excerpt);
        }
    }

    // Refresh live SHA-256 + symbol digest from workspace disk
    packet.workspace_digest = scan_workspace_digest(workspace_path, 48);

    for inv in parsed.locked_invariants {
        if !packet.locked_invariants.contains(&inv) && packet.locked_invariants.len() < 16 {
            packet.locked_invariants.push(inv);
        }
    }
    if !parsed.active_disputes.is_empty() {
        packet.active_disputes = parsed.active_disputes;
    }
    packet.unverified_assumptions = parsed.unverified_assumptions;

    if let Some(resume) = parsed.independent_resume {
        packet
            .independent_resumes
            .insert(format!("{}:{}", producer_role, producer_agent), resume);
    }

    if !parsed.peer_messages.is_empty() {
        // Keep most recent 12 peer messages across turns
        packet.peer_messages.extend(parsed.peer_messages);
        if packet.peer_messages.len() > 12 {
            let drain_count = packet.peer_messages.len() - 12;
            packet.peer_messages.drain(0..drain_count);
        }
    }

    if let Some(cli_id) = used_cli_agent_id {
        packet.last_cli_agent_id = Some(cli_id.to_string());
        packet.last_cli_completed_at = Some(now_ms());
    }

    let _ = save_cognitive_packet(workspace_path, &packet);
    packet
}

/// Filters `peer_messages` addressed to a given role or agent ID.
pub fn filter_peer_messages_for_agent<'a>(
    messages: &'a [PeerDirectMessage],
    agent_id: &str,
    role_name: &str,
) -> Vec<&'a PeerDirectMessage> {
    let agent_low = agent_id.to_ascii_lowercase();
    let role_low = role_name.to_ascii_lowercase();
    messages
        .iter()
        .filter(|m| {
            let t = m.to_target.to_ascii_lowercase();
            t == "all"
                || t == agent_low
                || t == role_low
                || (role_low == "review" && (t == "critic" || t == "auditor" || t == "reviewer"))
                || (role_low == "build" && (t == "implementer" || t == "builder"))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sha256_nist_vectors() {
        assert_eq!(
            sha256_hex(b""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn test_scan_and_verify_digest_detects_staleness() {
        let temp_dir = std::env::temp_dir().join(format!("flymd_cache_test_{}", now_ms()));
        fs::create_dir_all(&temp_dir).unwrap();

        fs::write(
            temp_dir.join("index.html"),
            r#"<!DOCTYPE html><html><head><title>Lab</title></head><body><canvas id="simCanvas"></canvas><button id="runBtn">Run</button></body></html>"#,
        )
        .unwrap();
        fs::write(
            temp_dir.join("app.js"),
            "export function initLab() {}\nfunction stepPhysics(dt) {}\n",
        )
        .unwrap();

        let initial = scan_workspace_digest(&temp_dir, 32);
        assert_eq!(initial.len(), 2);
        let html_digest = initial.get("index.html").unwrap();
        assert!(html_digest.dom_contracts.contains(&"#simCanvas".to_string()));
        assert!(html_digest.dom_contracts.contains(&"#runBtn".to_string()));

        let js_digest = initial.get("app.js").unwrap();
        assert!(js_digest.exported_symbols.contains(&"initLab".to_string()));
        assert!(js_digest.exported_symbols.contains(&"stepPhysics".to_string()));

        // Verify unchanged
        let rep1 = verify_cached_digests(&temp_dir, &initial);
        assert!(!rep1.has_drift());
        assert_eq!(rep1.unchanged_files.len(), 2);

        // Modify app.js and verify SHA-256 drift detection
        fs::write(
            temp_dir.join("app.js"),
            "export function initLab() { console.log('modified'); }\n",
        )
        .unwrap();
        let rep2 = verify_cached_digests(&temp_dir, &initial);
        assert!(rep2.has_drift());
        assert_eq!(rep2.stale_or_modified_files, vec!["app.js".to_string()]);
        assert_eq!(rep2.unchanged_files, vec!["index.html".to_string()]);

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_parse_handoff_state_and_peer_mentions() {
        let md = r#"
### Architectural Proposal
- **Core Invariant**: State transitions must remain deterministic and side-effect free.
- @Implementer: Bind event handlers strictly to `#simCanvas` and `#runBtn` without re-scanning HTML.

<independent_resume>
Verified raw HTML and JS contracts independently; 2 DOM nodes present.
</independent_resume>

<handoff_state>
{
  "confidence": "high",
  "lockedInvariants": ["60 FPS requestAnimationFrame loop"],
  "unverifiedAssumptions": ["Canvas DPI scaling on retina screens"],
  "peerMessages": [
    { "toRole": "Critic", "kind": "question", "message": "Check numerical stability when dt > 50ms?" }
  ]
}
</handoff_state>
"#;

        let parsed = parse_handoff_blocks_from_markdown(md, "claude-code", "Architect");
        assert!(!parsed.clean_markdown.contains("<handoff_state>"));
        assert_eq!(parsed.confidence.as_deref(), Some("high"));
        assert_eq!(parsed.locked_invariants.len(), 2);
        assert_eq!(parsed.unverified_assumptions.len(), 1);
        assert!(parsed.independent_resume.is_some());
        assert_eq!(parsed.peer_messages.len(), 2);
    }
}
