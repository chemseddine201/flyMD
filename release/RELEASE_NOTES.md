# FlyMD v2.3.0 — Debate Convergence Early-Stop, Dynamic Subscription Agents, Collapsible Clean Reports, and Multi-Engine Round Repeater 🚀

**FlyMD v2.3.0** introduces a revolutionary leap in autonomous multi-agent deliberations: automatic early convergence detection on successive equivalent summaries with zero wasted queries, live dynamic subscription-aware agent and model discovery, clean untrimmed collapsible reports, and a flexible multi-engine round repeater with unlimited custom specialist roles.

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

### 3. Untrimmed Collapsible Reports with Locked Ignored Rounds
- **Clean Untrimmed Markdown**:
  - Completely eliminates 3-line and 240-character arbitrary truncations in Section 4 of consensus reports.
  - Emits 100% full, untrimmed markdown documents.
- **Collapsed by Default with Seamless Expansion**:
  - Every executed debate round is rendered cleanly in a `<details>` disclosure card that is collapsed by default for executive readability, allowing users to expand any round to inspect the full transcript on demand.
- **Strictly Non-Expandable Ignored Rounds**:
  - Any round skipped due to early convergence is displayed as `Round N — Duplicated / Ignored (Same as Round M Debate Round)` and remains strictly non-expandable/locked, preventing visual clutter.

### 4. Multi-Engine Selection, Round Repeater & Specialist Roles Library
- **Multi-Engine Subscription Pool**:
  - Select multiple AI engines simultaneously for a deliberation (e.g. Claude + Gemini + DeepSeek + Ollama).
  - In Preset mode, selected engines are automatically rotated across participating agents.
- **Debate Round Repeater & Per-Round Splits**:
  - **Cycle Repeater Mode**: Define a repeating specialist cycle across all rounds until early convergence is reached.
  - **Per-Round Split Mode**: Choreograph each individual round with its own engine, model, reasoning effort, and specialist role.
  - **1-Click Auto-Distribute**: Automatically distributes selected subscription engines and specialist roles across round phases.
- **Unlimited Specialist Roles Library**:
  - Built-in specialist roles (Architect, Critic, Auditor, Implementer, Researcher, Performance Lead, UX Strategist) plus full UI CRUD for user-defined custom roles with experience profiles, inquiry directives, and bound custom skills.

---

## 📦 Production Executables & Cryptographic Hashes

| Executable | Architecture | Size | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| **`FlyMD_2.3.0_x64-portable.exe`** | Windows x64 (Native Standalone) | ~15.8 MB | `9ad8911681cafd07b02ccfcbc24db4e78c272cdc4d15523201bc6d5cf5b0a8cf` |
| **`FlyMD_2.3.0_x64-portable-latest.exe`** | Windows x64 (Portable Symlink) | ~15.8 MB | `9ad8911681cafd07b02ccfcbc24db4e78c272cdc4d15523201bc6d5cf5b0a8cf` |
| **`FlyMD 2.3.0.exe`** | Windows x64 (Electron Portable) | ~70.3 MB | `28c3a572afd9f3c8372ea5cc69daabd887adb93266132ec4bded0a3ae033fc3f` |
| **`FlyMD Setup 2.3.0.exe`** | Windows x64 (NSIS Installer) | ~70.7 MB | `859adbb7890324da3f5f706da0b0aec4a45a339352a6511781baf11e53ac2c87` |

---

## 🚦 Verification Summary

- **Rust Test Suite**: 68/68 passed (0 failed, including 10-round early convergence test and multi-engine repeater test).
- **Rust Clippy**: 0 warnings (`-D warnings` cleanly satisfied).
- **TypeScript**: 0 compiler errors (`tsc --noEmit`).
- **Production Bundler**: Vite + Electron + Tauri builds completed successfully.
