# FlyMD v2.3.0 — Debate Convergence Early-Stop, Dynamic Subscription Agents, Dual-Theme Parity, and Multi-Engine Deliberation 🚀

**FlyMD v2.3.0** introduces a major milestone in autonomous multi-agent deliberations and studio engineering: automatic early convergence detection on successive equivalent summaries with zero wasted queries, live dynamic subscription-aware agent and model discovery, full dual-theme parity across all views and modals, clean untrimmed collapsible reports, and a flexible multi-engine round repeater with unlimited custom specialist roles.

---

## 🆕 Major New Features

### 1. Early Debate Convergence on Successive Summaries (Zero Wasted Queries)
- **Automatic Consensus Detection**:
  - Deliberation steps continuously analyze summary convergence using normalized token Dice similarity + UTF-8 character trigram Dice coefficients.
  - When two successive agents in the same round (or across consecutive round boundaries) reach equivalent summaries (`>= 0.82` similarity) with **zero newly opened disputes**, remaining turns in the round are skipped immediately.
  - If a debate reaches full consensus at Round 4 of a 10-round deliberation, Rounds 5 through 10 are completely skipped, saving the user from burning unnecessary queries, tokens, and time.
- **Skipped Turns & Escaped Steps Ledger**:
  - Full untrimmed details are captured for every executed step.
  - Escaped steps within a converged round are explicitly recorded as `SkippedConsensus` (0 queries).
  - Escaped subsequent rounds are recorded in `metadata.roundLedger` as `ignored_consensus` and displayed as **Duplicated / Ignored (Same as Round M Debate Round)**.

### 2. Dynamic Subscription-Aware Agent & Live Model Fetching
- **Zero Static Hardcoded Dropdowns**:
  - Cross-application elimination of static agent lists (`claude-code`, etc.).
  - Dynamically probes user-connected CLI binaries (`claude`, `agy`/`antigravity`, `opencode`, `codex`, `cursor`, `zcode`), HTTP endpoints, live Ollama models (`/api/tags`), and custom user agents.
- **1-Click Live Model Fetch & Subscription Filtering**:
  - Added a small **Fetch Models** (`RefreshCw`) button inside `ModelEffortSideBySidePicker` (both compact and expanded views) to query real available models from the selected agent's CLI (`agy models`, Claude settings, Ollama `/api/tags`).
  - Displays only valid subscription models (`gemini-4-argon`, `gemini-3.8-flash`, `claude-opus-5-5`, `claude-sonnet-5-5`, `gpt-oss-120b` for Antigravity) and normalizes legacy slugs in Rust (`cli_builder::normalize_antigravity_model_and_effort`) to prevent CLI exit code 1 errors.
- **Error Recovery Model Switcher**:
  - Added a **`Target Model:`** selector + **Fetch** button (`RefreshCw`) directly inside `PipelineRecoveryModal` next to `Target Agent`, and filtered `Reasoning Effort` to the selected model's supported effort levels.
  - Added a **"Change Model / Config"** action button to the failed deliberation banner in `DiscussionTimelineView` and enabled model/effort switching on the active failed round in `DeliberationConfigInspectorModal`.

### 3. Full Application Dual-Theme Parity & UI Elevation
- **Universal Theme Adaptation Across All 10 Themes**:
  - Pure Clean White (`clean-white`), GitHub Light (`light`), Warm Sepia (`sepia`), Dark, Tokyo Night, Catppuccin Macchiato, Dracula Dark, Cyberpunk Neon, High Contrast (WCAG AAA), and System Default.
  - Completely eradicated persistent dark islands: Agent Studio, Projects Tree Sidebar, Live Progress Inspector, Agent Composer, Agent Dock, and AI Translation Suite dynamically adapt to clean light backgrounds or selected theme palettes.
- **Immediate Visual Acknowledgment & Distinct Icons**:
  - Added an instant, non-blocking transition overlay badge (`Applying [Theme Name]...` with spinner) upon theme toggle.
  - Assigned distinct, intuitive Lucide icons for each of the 10 themes in the status toolbar.
- **Streamlined Top Studio Entry**:
  - Removed duplicate "Agents Studio (Hub)" button from the secondary toolbar, retaining the minimal top TabBar button.
  - Defaulted initial studio entrance directly to **Stage 1 (Debate)** rather than Stage 3 (Pipeline).

### 4. Untrimmed Collapsible Reports with Locked Ignored Rounds
- **Clean Untrimmed Markdown**:
  - Completely eliminates 3-line and 240-character arbitrary truncations in Section 4 of consensus reports.
  - Emits 100% full, untrimmed markdown documents.
- **Collapsed by Default with Seamless Expansion**:
  - Every executed debate round is rendered cleanly in a `<details>` disclosure card that is collapsed by default for executive readability, allowing users to expand any round to inspect the full transcript on demand.
- **Strictly Non-Expandable Ignored Rounds**:
  - Any round skipped due to early convergence is displayed as `Round N — Duplicated / Ignored (Same as Round M Debate Round)` and remains strictly non-expandable/locked, preventing visual clutter.

### 5. Multi-Engine Selection, Round Repeater & Specialist Roles Library
- **Multi-Engine Subscription Pool**:
  - Select multiple AI engines simultaneously for a deliberation (e.g. Claude + Gemini + DeepSeek + Ollama).
  - In Preset mode, selected engines are automatically rotated across participating agents.
- **Debate Round Repeater & Per-Round Splits**:
  - **Cycle Repeater Mode**: Define a repeating specialist cycle across all rounds until early convergence is reached.
  - **Per-Round Split Mode**: Choreograph each individual round with its own engine, model, reasoning effort, and specialist role.
  - **1-Click Auto-Distribute**: Automatically distributes selected subscription engines and specialist roles across round phases.
- **Unlimited Specialist Roles Library**:
  - Built-in specialist roles (Architect, Critic, Auditor, Implementer, Researcher, Performance Lead, UX Strategist) plus full UI CRUD for user-defined custom roles with experience profiles, inquiry directives, and bound custom skills.

### 6. Deliberation Lifecycle Recovery, Round Barrier Sync & In-Flight Configuration
- **Deterministic Failure Resumption & Healing**:
  - Automatically heals session state when an agent turn encounters a process crash, timeout, or rate-limit HTTP 429 without losing previous completed turns or committed ledger digests.
  - Displays a dedicated Failure Diagnostic Recovery Card in the timeline with a 1-click **"Resume & Retry Turn"** action that clears error flags and re-executes the failed turn.
- **Round-Level Barrier Synchronization**:
  - Added configurable `pauseAtRoundBoundary` toggle to pause deliberation automatically at the end of each round for human-in-the-loop audit before the next round begins.
  - Mid-round graceful pause allows active streaming turns to conclude cleanly before pausing.
- **Sidebar Details & In-Flight Future-Round Editor**:
  - Integrated a `<Sliders />` icon side-by-side with the delete session button in the deliberations sidebar.
  - Opens `DeliberationConfigInspectorModal` with strict immutability:
    - **Past & Active Rounds ($\le \text{currentRound}$)**: Strictly locked and read-only.
    - **Upcoming Rounds ($> \text{currentRound}$)**: Fully editable when paused/failed to swap models, change reasoning effort tiers (`L`/`M`/`H`/`X`), add/remove specialist participants, or adjust directives.
    - Guarded with `UnsavedChangesModal` to prevent accidental loss of edits.

### 7. Non-Blocking IPC, Strict Validation & App-Wide Confirmation Guards
- **Lockless Discussion Pause & Cancel IPC**:
  - Replaced Tokio orchestrator mutex bottlenecks with atomic `AtomicBool` flags (`SessionControls`).
  - Discussion pause and cancel requests respond instantaneously (< 1ms) without blocking Tauri IPC or the streaming UI.
- **Unified Deliberation Proposal & Target Objectives**:
  - Joined the proposal, query, and target objectives into a unified, clean input area.
  - Removed initial required text and error highlights on modal open, keeping inputs clean with launch button guards.
- **Comprehensive Confirmation Dialogs**:
  - Added modal confirmation safeguards before deleting custom roles, presets, custom pipeline actions, task sessions, agent profiles, or recent file history.
- **Full-Width Unsquished Timeline**:
  - Expanded timeline container to 100% full width, preventing narrow docking on wide displays.

### 8. Multi-File Reference Attachments & Deliberation Action Buttons Restoration
- **Tauri Bridge Synchronization**:
  - Added missing `getDiscussionConfig` and `updateDiscussionConfig` handlers to `bridge/tauri-bridge.js`.
  - Added resilient fallback synthesis in `useDiscussionStudioController.ts` and an immediate loading skeleton in `DeliberationConfigInspectorModal.tsx`, restoring instant reactivity to the sidebar debate settings button (`<Sliders />`) and the timeline banner's **"Change Model / Config"** and **"Modify Next Rounds"** buttons.
- **Multi-File Attachments (Up to 10 Files, All Allowed Extensions)**:
  - Enabled multi-file reference attachments across both **Deliberation Inception** (`NewDeliberationModal.tsx`) and **Live Human Intervention** (`CouncilInterventionBar.tsx`).
  - Supports all extensions (documents, markdown, scripts, code `.ts/.rs/.py`, configs `.json/.yml`, logs, and images).
  - Features extension-based category icons, formatted file sizes, 1-click removal pills, drag-and-drop dropzones, and strict 10-file maximum enforcement with user notifications.
  - Formats attached files directly into the proposal prompt and human intervention payloads so all council agents have immediate access to referenced code and documents.

### 9. Epistemic Token Conservation & Debate Board Engine
- **Debate Board Architecture**:
  - Implements shared epistemic invariant tracking across agents with structured status transitions and decision brief generation.
  - Context window optimization with sliding-window truncation and prefix-pinned cache control headers.
  - Prevents token bloat on long multi-round deliberations while retaining full decision provenance.
- **Auto Token Saver & Telemetry**:
  - Introduced configurable Token Saver modes (`aggressive`, `balanced`, `full`) with live Token Quota HUD.
  - Real-time token consumption breakdowns distinguishing prompt, completion, and reasoning tokens.
- **A/B Benchmark Harness**:
  - Integrated Rust-based offline and dry-run A/B verification harness (`ab_harness.rs`) against golden test fixtures.

### 10. Automated Contrast Compliance & Light-Theme Visual Elevation
- **Automated Contrast Linter (`npm run lint:contrast`)**:
  - Integrated automated AST/regex contrast verification enforcing WCAG AA compliance across all JSX/TSX components.
  - Guarantees zero contrast regressions across all 10 supported themes.
- **Toolbar & Action Buttons Parity**:
  - Fixed dark hover state collisions on formatting buttons (`MarkdownFormattingGroup.tsx`), action groups (`FileActionsGroup.tsx`), and export buttons (`ExportMenuButton.tsx`), ensuring clean, subtle hover backgrounds on light themes instead of solid black boxes.
  - Enforced pure white text and stroke on solid accent/colored buttons (`themes.css`), preventing theme text rules from darkening icons on active controls (such as the manual workflow execution hand button).

### 11. Custom Actions & Deliberation Roles Library Enhancements
- **Native OS File Dialog Export**:
  - Replaced browser blob auto-downloads with a native system save dialog (`window.electronAPI.saveFileDialog`), allowing users to choose the target file location when exporting presets and custom specialist roles to JSON.
- **Restore Defaults Confirmation Guard**:
  - Added a protective confirmation modal before resetting deliberation presets or roles back to factory defaults, preventing accidental loss of custom team configurations and prompt directives.
- **Streamlined Button Aesthetics**:
  - Removed redundant text labels where intuitive icons already communicate action intent (e.g. icon-only plus buttons).

---

## 📦 Production Executables & Cryptographic Hashes

| Executable | Architecture | Size | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| **`FlyMD_2.3.0_x64-portable-latest.exe`** | Windows x64 (Latest Native Standalone) | 16.4 MB | `92F51D72A997C37585C2BFEF7D9418FC8D97EAF5B4D34913A054AF2AB8C46E96` |
| **`FlyMD_2.3.0_x64-portable.exe`** | Windows x64 (Native Standalone) | 16.4 MB | `92F51D72A997C37585C2BFEF7D9418FC8D97EAF5B4D34913A054AF2AB8C46E96` |
| **`FlyMD-Portable-Latest.exe`** | Windows x64 (Electron Portable Latest) | 70.4 MB | `2838628F1C6DAA3325C1C622D6D59A9ED3AC200BC43FBAA8A8064D24C8A14DCA` |

---

## 🚦 Verification Summary

- **Rust Test Suite**: 105 passed, 0 failed, 1 ignored (`cargo test --lib`).
- **Round-Plan Parity**: 100% parity verified between Rust and TypeScript plan resolvers (`npm run test:round-plan`).
- **Contrast Linter**: 0 contrast violations across all components (`npm run lint:contrast`).
- **TypeScript Typecheck**: 0 compiler errors (`npm run typecheck`).
- **Production Bundler**: Vite + Electron + Tauri release builds compiled and verified.
