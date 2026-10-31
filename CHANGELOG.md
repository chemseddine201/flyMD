# Changelog

All notable changes to **FlyMD** are documented in this file.

## [2.1.0] - 2026-10-31

### Added
- **Per-Agent Reasoning Effort & Thinking Controls**:
  - Introduced granular effort controls (`low`, `medium`, `high`) across pipeline steps, debate participants, and direct agent dispatch, allowing users to save tokens on routine tasks or leverage maximum reasoning capacity when tackling complex problems.
  - Per-agent toggle for Thinking Mode (chain of thought), compatible with DeepSeek R1, Claude, and Gemini thinking models.
  - Transparent `medium` fallback for models and providers that do not natively support custom effort tiers.
  - Automatic error recovery: if a provider endpoint rejects unsupported reasoning parameters, FlyMD automatically strips the reasoning configuration and retries seamlessly without failing the step.
- **Interactive Workspace Memory Reset Modal**:
  - Comprehensive "Clear Workspace & Memory" interactive dialog with default-checked options allowing users to selectively clear:
    - Active multi-agent debate sessions & historical transcripts.
    - 12-section evidence reports and synthesis artifacts.
    - Pipeline execution state and step run history.
    - Cross-model cognitive handoffs, SHA-256 digests, and cached index envelopes.
    - Automatically closes any workspace tabs related to cleared sessions.
- **Interactive Project & Sub-Project Deletion Modal**:
  - Safe, granular deletion dialog for projects and sub-projects with default-checked options to clean associated `.flymd` memory, cognitive caches, logs, and transcripts, with an optional toggle for deleting physical workspace files.

### Fixed
- **Multi-Agent Deliberation Lifecycle & Stalling Elimination (`commands.rs`, `discussionSlice.ts`, `DiscussionStudio.tsx`)**:
  - Eliminated Phase 3 visual freezes where completed deliberations remained locked in `RUNNING` status on the main header while the left sidebar displayed `AWAITING REVIEW`.
  - **Sequence-Guarded Store Synchronization (`activeSyncSequence`)**: Replaced uncoordinated parallel Tauri IPC promises with an atomic sequence guard that automatically discards out-of-order responses during intense model token streaming.
  - **In-Memory Supervisor Retention Fix**: `spawn_supervised_discussion_run` now promptly evicts terminal sessions (`AwaitingReview`, `Completed`, `Failed`, `Cancelled`) from `active_map`, preventing memory leaks and stale state locks.
  - **Reconciliation Heartbeat Guard**: Added an active 2.5-second heartbeat timer that continuously verifies backend settlement while `isRunning = true`, guaranteeing 100% UI alignment even if an IPC push event is delayed or dropped.
- **Pipeline Premature Settlement & Deliverable Guard Hardening (`runner.rs`)**:
  - Enforced strict requirement that code-modifying steps (`build`, `fix-bugs`) verify on-disk code modifications prior to task settlement.
  - Strengthened SHA-256 delta digests to prevent false positives and stub generation.

---

## [2.0.1] - 2026-10-30

### Fixed
- **HTML Canvas Parser Tag Boundary (`runner.rs`)**: Resolved regex tag boundary in `synthesize_logic_script_for_html` ensuring only genuine `<canvas ... id="...">` tags are bound to 2D rendering contexts, preventing non-canvas tags like `<header id="appHeader">` from producing `canvas_appHeader.getContext('2d')` runtime crashes.
- **Companion Deliverable 0-Byte Overwrite Protection (`runner.rs`)**: Hardened `ensure_companion_assets_exist` so existing code files (`app.js`, `styles.css`) on disk are preserved, never overwritten with generic stubs, and never falsely claimed as created by the current task.
- **CLI Non-Buffering NDJSON Streaming (`runner.rs`)**: Configured `agy.exe` with `--output-format stream-json` and a live NDJSON line reader, ensuring thought traces and live streaming tokens reach the UI immediately without buffering.
- **Settlement Detector Code-File Guard (`runner.rs`)**: Upgraded settlement detector conditions to require `code_files_touched > 0` before settling code tasks (`build` and `fix-bugs`), preventing tasks from terminating prematurely on markdown reports alone before files are written.
- **Cryptographic Workspace Pre/Post Verification (`runner.rs`)**: Added SHA-256 workspace digest verification before and after `fix-bugs` tasks, guaranteeing genuine file alterations on disk.

### Added
- **Active Execution Guards (`AgentChatTimeline`)**: Automatically disables `Paste External Output`, `Relay ->`, and the bottom Chat Composer while an agent task or deliberation round is in progress, preventing split-brain states and accidental race conditions.
- **Custom User-Defined Pipeline Actions Library (`CustomPipelineActionsModal`)**: Full modal dialog enabling users to create, customize, and persist reusable pipeline actions (e.g., `report`, `benchmark`, `security-audit`, `deploy`) with custom icons, epistemic policies (`Fast Inherit`, `Delta Verify`, `Blind Independent Audit`, `Ground Truth Rebuild`), and system prompt overrides.
- **Extendable & Incremental Workflow Execution (`AgentStudioSidebar` & `AgentsControlCenter`)**:
  - Completed pipeline steps are locked with an emerald `✓ DONE` badge and protected against unintended changes.
  - Interactive `StickyNote` popover to attach bug fixes, error logs, and user directives directly to individual steps.
  - Smart "Run Pending Steps" begins execution from the first pending step without resetting already-finished work.
  - Non-destructive step appending allows adding new steps to extend the pipeline dynamically.

---

## [2.0.0] - 2026-10-30

### Added
- **Multi-Agent Studio & Autonomous Pipeline (`AgentsControlCenter`)**:
  - Native 3-pane IDE-style workspace featuring a collapsible/closable Hierarchical Projects Sidebar, central Workflow Step Repeater & 3-row auto-growing Chat Composer (with image attachments), and a drag-resizable Live Progress & Action Logs Inspector.
  - Configurable multi-step pipelines (`plan`, `build`, `review`, `fix-bugs`, `explain`, plus custom actions & roles) supporting both **Auto** and **Manual** execution modes.
  - Universal agent discovery & execution across local CLI agents (`claude-code`, `codex`, `gemini-cli`, `aider`, custom CLI binaries), local `Ollama` models, and OpenAI / Anthropic / DeepSeek HTTP APIs, plus System-Browser Free-Tier WebAuth & CLI console login helpers.
- **Multi-Agent Deliberation & Evidence-Graded Debate Studio (`src-tauri/src/discussion/`)**:
  - Multi-round role-divergent deliberation state machine (`Moderator`, `Architect`, `Implementer`, `Critic`, `Auditor`, `DomainExpert`, and custom roles) with Preset Engine selectors, Thinking Mode, human-in-the-loop `@Role` targeted probes, pause/resume recovery, and turn-level font zoom scaling.
  - **12-Section Evidence-Graded Final Report Synthesizer** with versioned report persistence, automatic secret redaction, consensus ledgers, risk matrices, and disputed-claim tracking.
  - **Closed-Loop Lifecycle & Bidirectional Recycling** between Debate Final Reports and Studio Pipeline execution steps.
  - **Canonical Skills Manager** with workspace/global URI resolution, precedence overrides, and strict read-only deliberation sandboxing.
- **Tier 1–3 Multi-Agent Cache Mobility, Peer Messaging Bus & Role-Aware Epistemic Handoff**:
  - **Tier 1 — Prefix-Pinned Hardware KV Caching** (`discussion/memory.rs`, `discussion/runner.rs`): Byte-identical Token-0 shared system/workspace prefix (`shared_prefix.md`), append-only frozen round ledgers (`round_{r}_ledger.md`), Anthropic `cache_control: {"type": "ephemeral"}` breakpoints, and Ollama `"keep_alive": "15m"` warm VRAM slot retention.
  - **Tier 2 — Cross-Model Semantic State Envelope** (`projects/cache.rs`): `.flymd/cache/cognitive_state.json` (`CognitiveHandoffPacket`) storing FIPS 180-4 SHA-256 file digests, line counts, DOM `#id` contracts, exported symbols, locked invariants, and a Direct `@Role` Peer Messaging Bus (`peer_bus.json`).
  - **Tier 3 — Role-Aware Epistemic Router** (`discussion/epistemic.rs`): `DirectInherit` / `DeltaVerify` routing (plus consecutive `claude-code -c` warm session reuse with stateless `-p` fallback) for collaborative roles (`Implementer`, `build`, `explain`), and automatic **`BlindIndependentAudit` / `GroundTruthRebuild`** (raw disk slices, withheld upstream prose self-summaries, blocked biased CLI continuation, mandatory `<independent_resume>`) for `Critic`, `Auditor`, `review`, `fix-bugs`, or any of 5 drift/dispute triggers.
- **Hierarchical Projects Tree & Dual-Layer Memory (`src-tauri/src/projects/`)**:
  - Master Projects and nested Sub-Projects with automatic active-directory / CWD detection, native folder picker, and safe disk initialization.
  - Dual-layer global + project `.flymd/` memory journals (`MEMORY.md`, checkpoints, cognitive cache) with UTF-8 char-boundary safety and one-click **Clear Memory & Cache**.
- **Configurable Multi-Extension Workspace Supervision**:
  - Interactive **Supervised File Extensions Picker** modal when opening folders (`Ctrl + Shift + O`) and inside **Settings**, defaulting to `.md` / `.markdown` with preset groups and custom extensions synchronized live with the Rust `notify` watcher.

### Fixed
- Eliminated CLI pipeline hangs at 92% and premature child process termination via non-blocking concurrent stdout/stderr pipes, active heartbeat telemetry, targeted Windows child-PID tree termination, and companion deliverable verification (`HTML` + `CSS` + `JS`).
- Fixed multi-model HTTP/Ollama participant collisions in `build_provider_map` by keying provider instances via `provider_id::model_id` and loading persisted `config.json` during `cmd_resume_discussion`.
- Fixed UTF-8 multi-byte character slicing panics across report synthesis (`truncate_utf8_chars` in `discussion/report.rs`), project memory recall (`projects/memory.rs`), and checkpoint logs (`safe_tail_utf8` in `agents/checkpoint.rs`) for Arabic/RTL, CJK, and emoji content.
- Eliminated whole-app background crash aborts (`0xc0000409`) by switching `[profile.release]` to `panic = "unwind"`, installing a diagnostic `panic-recovery.log` hook, supervising background discussion/agent tasks via `tokio::spawn` `JoinHandle` & `catch_unwind`, making all `Mutex` locks poison-immune, and auto-healing orphaned/interrupted debate sessions on disk.
- Added active pipeline state guards locking active workflow steps against accidental deletion, clearing, or mid-run edits without explicit pause/cancel confirmation.

---

## [1.0.0] - 2026-10-26

### Added
- Initial release of **FlyMD** built on Tauri v2 + Rust:
  - Live recursive `.md` folder supervision with background tab auto-open and 5-second pulsing emerald badge.
  - Multi-tab workspace with Preview, Split View (CodeMirror 6), WYSIWYG mode, and Document Outline.
  - Full GFM, KaTeX math, Mermaid diagrams with full-screen zoom/pan lightbox & SVG/PNG export, and RTL/LTR toggle.
  - 8 open-source themes, WCAG AAA accessibility suite, local Ollama streaming translation, and 140px Floating Circular Drop Hub.

