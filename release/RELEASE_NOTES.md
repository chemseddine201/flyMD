# FlyMD v2.0.1 — Execution Guards, Custom Actions Library, Extendable Pipeline & Engine Fixes 🪶

**FlyMD v2.0.1** is a stabilization and workflow-expansion release for FlyMD v2. It delivers essential execution safeguards during active runs, user-defined custom pipeline actions, incremental extendable workflow resumption, and fixes for code generation settlement and canvas tag parsing.

---

## 🛠️ Bug Fixes & Stability Hardening

### 1. HTML Canvas Parser Boundary Hardening (`runner.rs`)
- Fixed regular expression parsing in `synthesize_logic_script_for_html` to require strict `<canvas[^>]*id="([^"]+)"` matching with tag boundary validation.
- Prevents non-canvas DOM nodes (e.g., `<header id="appHeader">`) from being falsely parsed as canvas elements, which previously caused `TypeError: canvas_appHeader.getContext is not a function` in synthesized companion scripts.

### 2. Workspace Companion Deliverable 0-Byte Overwrite Protection (`runner.rs`)
- Hardened `ensure_companion_assets_exist` to inspect existing workspace files (`app.js`, `styles.css`) on disk.
- If assets already exist with valid byte length (> 50 bytes), FlyMD preserves their implementation, never overwrites them with generic boilerplate stubs, and never falsely attributes them as newly touched files for unrelated tasks.

### 3. Non-Buffering CLI Streaming & NDJSON Decoding (`runner.rs`)
- Enhanced `agy.exe` process invocation with `--output-format stream-json` and a live NDJSON line reader loop.
- Thought traces and live model streaming tokens now bypass process buffer delays and stream directly to the FlyMD UI in real time.

### 4. Code-Task Settlement Detector Guard (`runner.rs`)
- Upgraded the multi-condition settlement detector so code-generating steps (`build` and `fix-bugs`) cannot terminate prematurely on markdown reports alone before at least one substantive code deliverable (`.js`, `.ts`, `.html`, `.css`, `.py`, `.rs`) has been modified on disk.

### 5. Cryptographic Workspace Modification Verification (`runner.rs`)
- Embedded FIPS 180-4 SHA-256 pre-execution and post-execution workspace digests in `fix-bugs`. If zero code files were modified on disk, the system surfaces a clear diagnostic rather than reporting false completion.

---

## 🆕 New Features & Workflow Improvements

### 1. Active Execution Guards (`AgentChatTimeline`)
- While an agent task or deliberation round is actively running, dangerous concurrent actions (`Paste External Output`, `Relay ->`, and the bottom Chat Composer) are automatically disabled with contextual status hints.
- Eliminates split-brain races, corrupted handoff packets, and accidental task interruptions.

### 2. User-Defined Custom Pipeline Actions Library (`CustomPipelineActionsModal`)
- Built an interactive modal dialog allowing developers to create, customize, duplicate, and persist reusable pipeline actions (e.g., `report`, `benchmark`, `security-audit`, `migrate`, `deploy`).
- Each custom action supports:
  - Custom title and action slug.
  - Dedicated icon keys (`FileText`, `CheckCircle2`, `Zap`, `Sparkles`, `ShieldCheck`, `Terminal`, `Search`, etc.).
  - Configurable Epistemic Policies:
    - **Fast Inherit** (`DirectInherit`): High-speed collaborative execution.
    - **Delta Verify** (`DeltaVerify`): Verification against verified disk digests.
    - **Blind Independent Audit** (`BlindIndependentAudit`): Upstream prose withheld, raw code inspection only.
    - **Ground Truth Rebuild** (`GroundTruthRebuild`): Full independent verification from disk.
  - System prompt overrides and default model temperature.

### 3. Incremental Extendable Pipeline Execution (`AgentStudioSidebar` & `AgentsControlCenter`)
- **Completed Step Lock**: Finished pipeline steps display an emerald `✓ DONE` badge and are protected against accidental modifications or deletion.
- **StickyNote Error Directives**: Click any step to open a popover and attach targeted error logs, bug reports, or guidance notes (`step_note`) without modifying the original prompt.
- **Smart Incremental Run**: Clicking "Run Pending Steps" begins from the first unfinished step without restarting already-settled steps from zero.
- **Non-Destructive Step Addition**: New actions added to a pipeline append gracefully without resetting previous outputs.

---

## 📦 Downloads & Assets (Latest Release)

| File | Description | Size | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| **`FlyMD Setup 2.0.1.exe`** | Windows NSIS Standalone Installer | **67.42 MB** | `d02ecfd02b978c10c9ed2332f05408c84f50f67ddcc4a531b3a192930b39f194` |
| **`FlyMD 2.0.1.exe`** | Windows Complete Portable Package | **67.10 MB** | `d772c8bcee599e28d678356f5e585776626fd78395b4cb3e04ee40476460f2e9` |
| **`FlyMD_2.0.1_x64-portable.exe`** | Ultra-Lightweight Tauri v2 Native Binary | **14.78 MB** | `a2e75d0b2300a6445a9dacd5f520e1edaf6602ad91a8ced2a6ed3a5a7358f975` |
| **`SHA256SUMS.txt`** | Checksum verification file | < 1 KB | — |

---

## 💻 System Requirements
- Windows 10 or Windows 11 (64-bit)
- WebView2 Runtime (pre-installed on Windows 10/11)
- ~35 MB RAM idle footprint
