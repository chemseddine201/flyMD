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

### 2. Dynamic Subscription-Aware Agent & Model Fetching
- **Zero Static Hardcoded Dropdowns**:
  - Cross-application elimination of static agent lists (`claude-code`, etc.).
  - Dynamically probes user-connected CLI binaries (`claude`, `agy`/`antigravity`, `opencode`, `codex`, `cursor`, `zcode`), HTTP endpoints, live Ollama models (`/api/tags`), and custom user agents.
- **Subscription Entitlement Filtering**:
  - Automatically respects user subscription tiers (`Pro`, `Advanced`, `Plus`, `Team`, `Local`) from credentials to unlock corresponding frontier models and reasoning effort ceilings.
  - Integrated 1-click **Refresh Subscriptions** button and direct link to Manage Logins.

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

---

## 📦 Production Executables & Cryptographic Hashes

| Executable | Architecture | Size | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| **`FlyMD_2.3.0_x64-portable-latest.exe`** | Windows x64 (Latest Native Standalone) | ~15.9 MB | `695F1A7EC5A46E06C500F7538DCA581B848038774198D0BD34C035666D8406F8` |
| **`FlyMD_2.3.0_x64-portable.exe`** | Windows x64 (Native Standalone) | ~15.9 MB | `695F1A7EC5A46E06C500F7538DCA581B848038774198D0BD34C035666D8406F8` |
| **`FlyMD-Portable-Latest.exe`** | Windows x64 (Electron Portable Latest) | ~70.4 MB | `C764198A3C045993F0BB94015050A170E2633992185E19B4047D77C2A5889410` |
| **`FlyMD 2.3.0.exe`** | Windows x64 (Electron Portable) | ~70.4 MB | `C764198A3C045993F0BB94015050A170E2633992185E19B4047D77C2A5889410` |
| **`FlyMD Setup 2.3.0.exe`** | Windows x64 (NSIS Installer) | ~70.7 MB | `77A78C5503460E364FF8456CD4FBD4E750EC7DC4697F6FA4DA0452E2B8D4367A` |

---

## 🚦 Verification Summary

- **Rust Test Suite**: 72/72 passed (0 failed, including round barrier pause, resume failed discussion, and in-flight config immutability invariants).
- **TypeScript**: 0 compiler errors (`tsc --noEmit`).
- **Production Bundler**: Vite + Electron + Tauri release builds completed successfully.
