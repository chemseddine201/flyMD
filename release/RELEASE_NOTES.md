# FlyMD v2.1.0 — Per-Agent Effort & Thinking Controls, Interactive Memory Cleanup, and Deliberation Lifecycle Hardening 🚀

**FlyMD v2.1.0** is a major stable release introducing granular per-agent reasoning effort and thinking mode controls, interactive workspace memory reset and project deletion dialogs with configurable checkboxes, and extensive lifecycle hardening for multi-agent deliberations and autonomous pipelines.

---

## 🆕 Major New Features

### 1. Granular Per-Agent Reasoning Effort & Thinking Controls
- **Flexible Effort Selectors (`low`, `medium`, `high`)**:
  - Control reasoning token budgets across pipeline steps, deliberation participants, and direct agent dispatches.
  - Optimize token expenditure: use `low` effort for formatting and mechanical translation, `medium` for routine code generation, and `high` for deep architectural refactoring or security auditing.
- **Thinking Mode (Chain-of-Thought) Toggle**:
  - Enable or disable full thinking visibility on supported reasoning models (DeepSeek R1, Claude 3.7 Sonnet, Gemini 2.0 Flash Thinking).
- **Safe Fallback & Automatic Error Recovery**:
  - Automatically defaults to `medium` when interacting with models or providers that lack custom reasoning effort parameters.
  - If a provider endpoint rejects unsupported reasoning parameters, FlyMD automatically strips the reasoning configuration and retries seamlessly without failing the step.

### 2. Interactive Workspace Memory Reset Modal
- **Fine-Grained Reset Dialog**:
  - Provides an intuitive modal with default-checked checkboxes allowing users to selectively clear:
    - Active multi-agent debate sessions & historical transcripts.
    - 12-section evidence reports and synthesis markdown deliverables.
    - Pipeline execution state and step run history.
    - Cross-model cognitive handoffs, SHA-256 digests, and cached index envelopes.
- **Automated Tab Lifecycle Management**:
  - Automatically identifies and closes workspace editor tabs associated with cleared discussions and reports.

### 3. Interactive Project & Sub-Project Deletion Modal
- **Granular Deletion Controls**:
  - Dedicated interactive modal for deleting projects and nested sub-projects.
  - Default-checked checkboxes for removing associated `.flymd` memory, cognitive caches, logs, and transcripts, with an optional toggle for deleting physical workspace files.

---

## 🛠️ Deliberation & Pipeline Lifecycle Hardening

### 1. Multi-Agent Deliberation Lifecycle & Stalling Elimination
- **Phase 3 Stalling Root-Cause Fix**:
  - Resolved visual desynchronization where deliberations settled on disk but remained locked in `RUNNING` status on the main header.
- **Sequence-Guarded Store Synchronization (`activeSyncSequence`)**:
  - Replaced uncoordinated parallel IPC calls with an atomic sequence guard that automatically discards out-of-order promise resolutions during intense model token streaming.
- **In-Memory Supervisor Eviction**:
  - `spawn_supervised_discussion_run` now promptly evicts terminal sessions (`AwaitingReview`, `Completed`, `Failed`, `Cancelled`) from `active_map`, preventing memory leaks and stale state locks.
- **Reconciliation Heartbeat Guard**:
  - Added an active 2.5-second heartbeat timer in `DiscussionStudio.tsx` to verify backend metadata while running, ensuring 100% UI alignment even if an IPC push event is delayed or dropped.

### 2. Pipeline Execution Guards & Companion Asset Protection
- **Settlement Detector Code-File Guard**:
  - Requires substantive code file modifications on disk before settling code-generating steps (`build` and `fix-bugs`), preventing tasks from terminating prematurely on markdown reports alone.
- **Companion Asset Overwrite Protection**:
  - Existing code files (`app.js`, `styles.css`) are preserved and never overwritten with generic stubs.
- **Cryptographic Workspace Verification**:
  - Embedded FIPS 180-4 SHA-256 pre-execution and post-execution workspace digests in `fix-bugs` to verify genuine alterations on disk.

---

## 📦 Downloads & Assets (v2.1.0 Stable)

| File | Description | Size | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| **`FlyMD_2.1.0_x64-portable.exe`** | Ultra-Lightweight Tauri v2 Native Binary | **14.90 MB** | `1b60a7e8f2aeb00cd01a64b2bc056f10c32b7d121b5b97cf0532cd86b83a462f` |
| **`FlyMD_2.1.0_x64-portable-latest.exe`** | Latest Portable Release Shortcut | **14.90 MB** | `1b60a7e8f2aeb00cd01a64b2bc056f10c32b7d121b5b97cf0532cd86b83a462f` |
| **`SHA256SUMS.txt`** | Checksum verification file | < 1 KB | `1b60a7e8f2aeb00cd01a64b2bc056f10c32b7d121b5b97cf0532cd86b83a462f` |

---

## 💻 System Requirements
- Windows 10 or Windows 11 (64-bit)
- WebView2 Runtime (pre-installed on Windows 10/11)
- ~35 MB RAM idle footprint
