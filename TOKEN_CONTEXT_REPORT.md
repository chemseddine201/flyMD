# FlyMD: Debate Settings Fix, Token Cost and Shared Context — Part A & Part B Report

**Date:** 2026-11-04  
**Branch:** `advanced-agents`  
**Commits:**  
- `7d558e2`: *test(discussion): capture Part A golden test fixtures for English and Arabic scenarios, per_agent, repeater, pause, retry, and convergence*
- `6a6ba95`: *fix(discussion): resolve debate config save guard rejection in per_agent mode and add Antigravity model retry for invalid model selection (Part B)*
- `5e32be5`: *chore(release): update portable release binaries and SHA256 checksums for Part B*

---

## 1. Executive Summary & Stop Notice

In strict accordance with Section 3 and Section 7 of `TOKEN_CONTEXT_TASKS.md`, **Part A (Golden Tests)** and **Part B (Owner Bug Fixes: B1 Debate Config Save & B2 Antigravity Model Selection Retry)** are completely implemented, verified with 80/80 passing tests and full TypeScript typechecking, compiled into production portable executables, and committed locally to `advanced-agents`.

**STATUS: STOPPED.** We are paused here awaiting owner review and explicit approval before commencing Phase 0.

---

## 2. Part A: Golden Tests

### 2.1 Changes Made
- **Fixtures Directory (`src-tauri/src/discussion/fixtures/`)**:
  - `golden_english_per_agent.json`: Full 3-round debate in `per_agent` mode.
  - `golden_arabic_per_agent_with_pause_resume_retry.json`: Multibyte Arabic debate covering failed turn retry, pause, and resumption across rounds.
  - `golden_english_repeater_barrier.json`: Multi-agent repeater round mode verifying strict round barrier synchronization.
  - `golden_arabic_early_convergence.json`: Arabic convergence scenario verifying consensus detection and skipped round suppression.
  - `golden_cli_arguments.json`: Matrix of assembled CLI flags across engines (`antigravity`, `claude-code`, `ollama`) and roles.
- **Test Harness (`src-tauri/src/discussion/golden_tests.rs`)**:
  - `RecordingMockProvider`: Captures delivered `TurnRequest` and streaming frames without network overhead.
  - `normalize_golden_text`: Strict deterministic normalizer for timestamps (`<TIMESTAMP>`, `<ISO_TIMESTAMP>`), session IDs, message IDs (`msg-<ID>`), slot IDs (`slot-<ID>`), and run durations (`"durationMs": 0`), preserving prompt text, deliverables, markdown tables, and state blocks byte-for-byte.
- **Latency Optimization (`src-tauri/src/discussion/runner.rs:1056, 1162`)**:
  - Zero-latency bypass when `simulated_latency_ms == 0`, ensuring tests execute instantly without thread sleeps.

### 2.2 Test Verification & Output
```bash
$ cargo test --lib golden_tests
```
**Output:**
```text
running 5 tests
test discussion::golden_tests::test_golden_cli_arguments_matrix ... ok
test discussion::golden_tests::test_golden_english_scenario_per_agent ... ok
test discussion::golden_tests::test_golden_english_repeater_mode_with_round_barrier ... ok
test discussion::golden_tests::test_golden_arabic_scenario_per_agent_with_pause_resume_retry ... ok
test discussion::golden_tests::test_golden_arabic_early_convergence ... ok

test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 75 filtered out; finished in 63.88s
```

---

## 3. Part B1: Debate Config Save Guard Bug

### 3.1 Problem Traced
When editing a debate using `repeaterMode: per_agent` with an empty schedule (e.g., session `G:\xampp-httpdocs\fly13\.flymd\discussions\disc-1793743338597`):
1. In `per_agent` mode without schedule, Rust `resolve_round_plan` assigns 1 agent per round (`(round - 1) % participants.len()`).
2. The UI modal (`DeliberationConfigInspectorModal.tsx`) erroneously expanded all participants into every round view.
3. On save, `handleUpdateSlot` populated `roundSchedule` containing 3 participants for Round 1.
4. Because `roundSchedule` takes precedence in `resolve_round_plan`, Round 1 suddenly resolved to 3 participants instead of 1.
5. The orchestrator guard (`orchestrator.rs:411`, `commands.rs:459`) rejected the change:
   `"Cannot modify participants for Round 1 which has already executed or is currently active"`
6. The modal swallowed the error, disk files were never updated, and retrying re-ran the old configuration.

### 3.2 Implemented Fix
- **TypeScript Resolver (`src/renderer/preview/components/agents/studio/discussion/roundPlanResolver.ts`)**:
  - Implemented `resolveRoundPlan(roundNumber, config)` mirroring Rust `discussion::types::resolve_round_plan` byte-for-byte, correctly resolving `per_agent` slots.
  - Implemented `expandFullRoundSchedule(config)` to synthesize past resolved rounds before slot addition/removal so past executed rounds remain invariant.
- **Config Inspector Modal (`src/renderer/preview/components/agents/studio/discussion/DeliberationConfigInspectorModal.tsx`)**:
  - Lines 160–210: In `per_agent` mode with empty schedule, modifying an agent's model or effort mutates `participants` directly without injecting an unwanted `roundSchedule`.
  - Added notification note: *"Changes to @Agent will apply to every round where this agent speaks."*
  - Replaced stale defaults (`ClaudeCode` / `claude-3-7-sonnet`) with available provider defaults.
  - On IPC save error, retains modal open and displays the backend error message banner.
  - Surfaced warning when `savedModelId != normalizeModelForAgent(savedModelId)`.
- **Controller Disk Reload (`src/renderer/preview/components/agents/studio/discussion/useDiscussionStudioController.ts`)**:
  - Reloads config fresh from disk upon successful save so UI stays in sync.
- **Backend Disk Update Helper (`src-tauri/src/discussion/commands.rs:450-485`)**:
  - Exported `pub fn update_discussion_config_on_disk(session_dir: &Path, new_config: DiscussionConfig) -> Result<(), String>` enforcing invariant guards even when orchestrator is not resident in memory.

### 3.3 Test Reproduction and Verification
- **Rust In-Memory & Guard Test (`src-tauri/src/discussion/orchestrator.rs:2074-2225`)**:
  - `test_per_agent_config_edit_rejection_and_clean_persistence_fix`:
    - Reproduces rejection when old UI roundSchedule is submitted: confirms error contains `"Cannot modify participants for Round 1"`.
    - Confirms success when fixed `per_agent` payload mutates `participants` directly.
    - Confirms values persist to disk (`config.json`).
    - Confirms `TurnRequest` on subsequent retry carries updated model and effort.
    - Confirms disk persistence when orchestrator is not in memory via `update_discussion_config_on_disk`.
- **Real Session Copy Test (`src-tauri/src/discussion/orchestrator.rs:2227-2325`)**:
  - `test_copy_of_fly13_session_persistence_and_retry_with_mock_provider`:
    - Makes an isolated read-only copy of `G:\xampp-httpdocs\fly13\.flymd\discussions\disc-1793743338597` into a temporary directory (never touching the real fly13 folder).
    - Mutates participant 0 model from `gemini-4-argon` to `gemini-3.8-flash` via disk updater; confirms persistence.
    - Loads orchestrator in memory, mutates model to `gemini-2.5-pro` and effort to `high`; confirms in-memory update and disk save.
    - Simulates "Resume & Retry" and verifies `TurnRequest` sent to provider contains:
      - `model_id: Some("gemini-2.5-pro")`
      - `effort_level: Some("high")`
    - Verifies executed rounds remain strictly locked against tampering.

---

## 4. Part B2: Antigravity Model Retry on `invalid model selection`

### 4.1 Problem Diagnostic
Subprocess exit code 1 with error output:
```text
error: invalid model selection (--model "gemini-4-argon" --effort "medium"): --effort is not supported for model "gemini-4-argon"
```
Or with `gemini-2.5-pro` (as shown in user error modal screenshot). On some versions of `agy`, effort flags are rejected if supplied separately via `--effort` when the CLI expects the fused model identifier (e.g. `--model gemini-4-argon-medium` without `--effort`).

### 4.2 Implemented Fix
- **CLI Builder (`src-tauri/src/agents/runner/cli_builder.rs:218-270`)**:
  - Added `fuse_antigravity_effort` mode:
    - Builds `--model <base>-<effort>` and suppresses `--effort`.
- **Debate Runner (`src-tauri/src/discussion/runner.rs:350-410`)**:
  - In `CliProvider::execute_turn`, if `agent_id == "antigravity"` and command exits with `status.code() != 0` and stderr contains `"invalid model selection"`:
    - Logs warning and automatically re-executes turn once with fused `--model <base>-<effort>` and no `--effort`.
    - If retry fails, preserves `ProviderError::ProcessCrashed` with exit code 1 to surface the change-model UI modal.
- **Pipeline Runner (`src-tauri/src/agents/runner/mod.rs:280-360`)**:
  - Added automatic single retry with fused `--model <base>-<effort>` when `agent_id == "antigravity"` encounters `invalid model selection`.
- **Unit Test (`src-tauri/src/discussion/runner.rs:1360-1420`)**:
  - `test_antigravity_cli_invalid_model_selection_retry`:
    - Case 1: First form succeeds -> verified.
    - Case 2: First form fails on `--effort`, retry succeeds on fused form -> verified.
    - Case 3: Both forms fail -> verified returning `ProcessCrashed(1)`.

---

## 5. Full Suite Verification

### 5.1 Cargo Test Suite
```bash
$ cargo test --lib
```
**Output:**
```text
test result: ok. 80 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 64.03s
```

### 5.2 TypeScript Typecheck
```bash
$ npm run typecheck
```
**Output:**
```text
> fly-md@2.3.0 typecheck
> tsc --noEmit
(0 errors)
```

### 5.3 Golden File Parity
- All golden fixtures run with `tokenSaver: off` and `contextMode: classic` produced byte-identical transcripts, CLI arguments, and reports.

---

## 6. Portable Release Binaries & Checksums

Both portable production packages were compiled from the latest `advanced-agents` codebase:
- **Tauri Portable Executable:** `release\FlyMD_2.3.0_x64-portable-latest.exe` (16,124,416 bytes)
- **Electron Portable Executable:** `release\FlyMD-Portable-Latest.exe` (70,416,723 bytes)

### Checksums (`release\SHA256SUMS.txt`):
```text
9E473274F4DA1BE829BF2B232202C4BBD44A400F41A51075DDAB0D2A13B1E5A1  FlyMD_2.3.0_x64-portable.exe
9E473274F4DA1BE829BF2B232202C4BBD44A400F41A51075DDAB0D2A13B1E5A1  FlyMD_2.3.0_x64-portable-latest.exe
2497A7C29B22ADB12213EAF1C5992AB7430019570BE416C0BFF176815E446F61  FlyMD-Portable-Latest.exe
```

---

## 7. Resource & Financial Accounting

- **Money spent on model calls:** **$0.00**
  - All test scenarios were executed strictly using isolated temp workspaces, local test harnesses, fake CLI scripts, and `RecordingMockProvider`.
  - Zero paid API calls were triggered.
- **Workspace Isolation:**
  - `G:\xampp-httpdocs\fly13` was never modified. Tests operated exclusively on ephemeral temporary directories (`std::env::temp_dir()`).
  - Owner's uncommitted edit in `discussionAttachmentUtils.tsx` was preserved and left uncommitted.

---

## 8. Decisions Needed From the Owner Before Phase 0

Before proceeding to **Phase 0 (Real Usage and Token Counting)** and **Phase 1 (Performance)**:

1. **Default Run Setting for New Debates (`0.1`)**:
   - `tokenSaver`: Recommend `"standard"` for new debates, while defaulting to `"off"` when unspecified (preserving 100% backwards compatibility for all existing sessions on disk).
   - `contextMode`: Keep `"classic"` as requested until Phase 4.
   - *Example:* Starting a new debate from the Studio will use `standard` token saving, while loading `disc-1793743338597` continues in `off` / `classic`.
   - **Do you approve this default?**

2. **System Prompt File Staging for Debates (`2.1` in Phase 2 preview)**:
   - When using `--system-prompt-file` for Frame 0 in session `.sandbox`, should this be activated in Phase 2 only when `tokenSaver` is `"standard"` or `"strict"`? (Task document specifies: *"only when tokenSaver is on"*).
   - **Confirmed:** Existing `off` mode will continue sending Frame 0 byte-identical as a single message to match golden fixtures.

**Awaiting owner review and approval to proceed with Phase 0.**
