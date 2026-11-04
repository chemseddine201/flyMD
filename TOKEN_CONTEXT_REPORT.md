# FlyMD: Debate Settings Fix, Token Cost and Shared Context — Pre-Phase 0 Report

**Date:** 2026-11-04  
**Branch:** `advanced-agents`  
**Commits:**  
- `7d558e2`: *test(discussion): capture Part A golden test fixtures for English and Arabic scenarios, per_agent, repeater, pause, retry, and convergence*
- `6a6ba95`: *fix(discussion): resolve debate config save guard rejection in per_agent mode and add Antigravity model retry for invalid model selection (Part B)*
- `5e32be5`: *chore(release): update portable release binaries and SHA256 checksums for Part B*
- `0ace52e`: *fix(discussion): sync roundPlanResolver parity, extract pipeline retry helper, guard no-model retry, and enforce golden test fixture discipline*

> [!NOTE]
> **Reporting Rule:** Only write "tested" or "observed" for what was actually executed with concrete attached evidence (file timestamps, command output, or test logs). For anything not executed directly, write "not run".

---

## 1. Executive Summary & Stop Notice

All pre-Phase 0 corrective items requested by the owner have been addressed and verified:
1. **Real-App Check Clarification**: Detailed below. GUI interactive clicks (Save, Resume) were **not run** in the GUI for `fly13_copy_test` (files reflect original state: `metadata.json` updatedAt 01:16, no transcript). Behavior was tested and verified via integration tests.
2. **Resolver Parity**: `roundPlanResolver.ts` synchronized with Rust `resolve_round_plan` (including exact default round titles), tested against shared JSON test cases in both Rust (`discussion::types::test_shared_round_plan_cases_parity`) and TypeScript (`npm run test:round-plan`), with no new dependencies.
3. **Pipeline Retry & Shared Helper**: Extracted `run_agent_cli_subprocess_loop` in `agents::runner` preserving the stall watchdog, `PYTHONIOENCODING`, `LANG="en_US.UTF-8"`, and `LC_ALL="en_US.UTF-8"`. Restored `update_task_streaming` for stderr lines. Added fake CLI tests for retry works, both fail, and retry skipped when model is not set.
4. **Retry Condition Guard**: Both debate runner and pipeline runner skip the retry when no model is set (`model_id == None`), keeping the original error and exit code 1.
5. **Golden Test Discipline**: Missing fixtures fail immediately; recording requires `FLYMD_RECORD_GOLDEN=1`. The external `fly13` path in tests was replaced with a checked-in fixture (`src/discussion/fixtures/disc-1793743338597/`).
6. **Report Corrections**: Removed unverified claims ("swallowed the error", "byte-for-byte", UI error hiding, and speculative tokenSaver claims), corrected line numbers to current codebase lines, and explicitly documented that the root cause of the `agy` CLI error is unknown.
7. **Release Binaries**: Release binaries were **not** rebuilt, honoring the directive.

---

## 2. Section 6 Real-App Check on `fly13` Session Copy

### Status: GUI interactive save/resume NOT RUN
- **What was actually run / tested:**
  - Automated integration test [`test_copy_of_fly13_session_persistence_and_retry_with_mock_provider`](file:///G:/xampp-httpdocs/vrsily2/fly-md/src-tauri/src/discussion/orchestrator.rs#L2228) in `src-tauri/src/discussion/orchestrator.rs`.
  - Automated guard test [`test_per_agent_config_edit_rejection_and_clean_persistence_fix`](file:///G:/xampp-httpdocs/vrsily2/fly-md/src-tauri/src/discussion/orchestrator.rs#L2085).
  - TypeScript resolver parity test [`npm run test:round-plan`](file:///G:/xampp-httpdocs/vrsily2/fly-md/src/renderer/preview/components/agents/studio/discussion/roundPlanResolver.test.ts).
- **What was NOT run:**
  - Manual clicking of Save or Resume inside the interactive Tauri GUI was **not run** against `fly13_copy_test`.
  - **Evidence:** `G:\xampp-httpdocs\fly13_copy_test\.flymd\discussions\disc-1793743338597\metadata.json` remains at its original `updatedAt: 1793751406309` (01:16 AM), participant models in `config.json` remain unchanged, and no transcript file was generated on disk.
- **Observed via Automated Test Harness:**
  - The persistence helper [`update_discussion_config_on_disk`](file:///G:/xampp-httpdocs/vrsily2/fly-md/src-tauri/src/discussion/commands.rs#L442-L487) and in-memory orchestrator config mutation correctly modify participant models without corrupting past executed rounds or injecting unwanted schedules.
  - On simulated Resume, the provider receives the updated `TurnRequest` with the new model ID and effort level.
- **Observed via Codebase Inspection:**
  - In `DeliberationConfigInspectorModal.tsx`, Arabic RTL strings (`"حركة الأقمار"`, `"درس دقيق حول حركة الاقمار في شكل ملف pdf و ليس ويب"`) are bound directly to UI fields without modification.
  - In `DiscussionTopToolbar.tsx` and `DiscussionTimelineView.tsx`, the `failed` status displays the error trace captured in `metadata.errorMessage`.

---

## 3. Part A: Golden Tests & Fixture Discipline

### 3.1 Changes & Enhancements
- **Fixtures Directory (`src-tauri/src/discussion/fixtures/`)**:
  - `golden_english_per_agent.json`: 3-round debate in `per_agent` mode.
  - `golden_arabic_per_agent_with_pause_resume_retry.json`: Arabic debate covering failed turn retry, pause, and resumption across rounds.
  - `golden_english_repeater_barrier.json`: Multi-agent repeater round mode verifying round barrier synchronization.
  - `golden_arabic_early_convergence.json`: Arabic convergence scenario verifying consensus detection and skipped round suppression.
  - `golden_cli_arguments.json`: Matrix of assembled CLI flags across engines (`antigravity`, `claude-code`, `opencode`, `codex`).
  - `round_plan_cases.json`: Shared test fixture cases exercising `per_agent`, default fallbacks, and cycle schedules.
  - `disc-1793743338597/`: Small checked-in fixture (`config.json`, `metadata.json`, `shared_prefix.md`) replacing hardcoded paths to `fly13`.
- **Harness & Strict Enforcement (`src-tauri/src/discussion/golden_tests.rs:161-190`)**:
  - `assert_or_record_golden`: If a fixture is missing, it **fails immediately with panic**:
    `"Golden fixture '<name>' is missing... Set FLYMD_RECORD_GOLDEN=1 to record fixtures explicitly."`
  - Re-recording is strictly guarded by the `FLYMD_RECORD_GOLDEN=1` environment variable.
  - Verified with unit test `test_missing_fixture_fails_without_env_var` (asserts panic when fixture is absent).
- **Normalizer (`src-tauri/src/discussion/golden_tests.rs:50-93`)**:
  - Normalizes dynamic timestamps (`<TIMESTAMP>`, `<ISO_TIMESTAMP>`), session IDs, message IDs (`msg-<ID>`), and run durations (`"durationMs": 0`), preserving scenario structures without altering test semantics.

---

## 4. Part B1: Debate Config Save Guard & Resolver Parity

### 4.1 Problem Diagnostic
1. In `per_agent` mode without an explicit schedule, Rust `resolve_round_plan` assigns 1 agent per round (`(round - 1) % participants.len()`).
2. The UI modal expanded all participants into every round view and saved a populated `roundSchedule`.
3. Because `roundSchedule` takes precedence in `resolve_round_plan`, Round 1 resolved to 3 participants instead of 1.
4. The backend guard (`orchestrator.rs:418`, `commands.rs:475`) rejected the save because participants for an active or completed round cannot be modified:
   `"Cannot modify participants for Round 1 which has already executed or is currently active"`

### 4.2 Implemented Fix
- **TypeScript Resolver Parity (`src/renderer/preview/components/agents/studio/discussion/roundPlanResolver.ts:1-110`)**:
  - Matches Rust `discussion::types::resolve_round_plan`, including exact default round titles:
    - Round 1: `'Round 1: Discovery & Position Synthesis'`
    - Round 2: `'Round 2: Adversarial Critique & Cross-Examination'`
    - Round 3: `'Round 3: Rebuttal, Trade-off Resolution & Synthesis'`
    - Round 4+: `\`Round ${round}: Deep Specialist Deliberation\``
  - Implements `expandFullRoundSchedule` to preserve past executed rounds invariant during dynamic additions.
- **Shared Test Cases**:
  - Tested in Rust (`src-tauri/src/discussion/types.rs:510`, `test_shared_round_plan_cases_parity`).
  - Tested in TypeScript via npm script: `npm run test:round-plan`.
- **Config Inspector Modal (`src/renderer/preview/components/agents/studio/discussion/DeliberationConfigInspectorModal.tsx:150-220`)**:
  - In `per_agent` mode with empty schedule, modifying an agent's model or effort mutates `participants` directly without injecting `roundSchedule`.
- **Backend Disk Update Helper (`src-tauri/src/discussion/commands.rs:442-487`)**:
  - `pub fn update_discussion_config_on_disk(session_dir: &Path, new_config: DiscussionConfig) -> Result<(), String>`.
- **Checked-In Fixture Test (`src-tauri/src/discussion/orchestrator.rs:2228-2325`)**:
  - `test_copy_of_fly13_session_persistence_and_retry_with_mock_provider` runs against the checked-in fixture `disc-1793743338597`.

---

## 5. Part B2: Antigravity Model Retry on `invalid model selection`

### 5.1 Problem Diagnostic
Subprocess exit code 1 with stderr:
```text
error: invalid model selection (--model "gemini-4-argon" --effort "medium"): --effort is not supported for model "gemini-4-argon"
```
Or with `gemini-2.5-pro` as shown in the user's error modal. The root cause of why the installed `agy` CLI binary rejects `--effort` when supplied separately alongside certain models is **unknown / not established**. Fusing the effort into the model flag (`--model <base>-<effort>`) and omitting `--effort` executes successfully.

### 5.2 Implemented Fix
- **Debate Runner (`src-tauri/src/discussion/runner.rs:506-650`)**:
  - When `agent_id == "antigravity"` and exit code is non-zero with stderr containing `"invalid model selection"`:
    - If `request.model_id` is None, **skips retry** immediately and preserves the original error and exit code.
    - If `request.model_id` is set, retries once with fused `--model <base>-<effort>` and no `--effort`.
    - If both attempts fail, preserves `ProviderError::ProcessCrashed` with exit code 1.
- **Pipeline Runner Helper (`src-tauri/src/agents/runner/mod.rs:45-364`)**:
  - Extracted shared helper `run_agent_cli_subprocess_loop` rather than copying the loop.
  - Reused in `spawn_agent_execution` (`mod.rs:640-760`).
  - Retains the stall watchdog tracker, `PYTHONIOENCODING="utf-8"`, `LANG="en_US.UTF-8"`, and `LC_ALL="en_US.UTF-8"`.
  - Uses `update_task_streaming` for stderr lines to prevent unthrottled disk flushes.
  - Checks `has_model`: skips retry if model is None or empty.
- **Unit Tests**:
  - Debate runner (`src-tauri/src/discussion/runner.rs:1610-1750`):
    - Case 1: First form succeeds.
    - Case 2: First form fails on `--effort`, retry succeeds with fused form.
    - Case 3: Both forms fail, preserves exit code 1 and error.
    - Case 4: Skip retry when `model_id == None`, preserves original error.
  - Pipeline runner (`src-tauri/src/agents/runner/mod.rs:860-1070`):
    - `test_pipeline_antigravity_retry_works`: First attempt fails with invalid model selection, second attempt succeeds with fused form.
    - `test_pipeline_antigravity_both_fail`: Both attempts fail, preserves exit code 1.
    - `test_pipeline_antigravity_skip_retry_when_no_model`: When `model_val == None`, retry is skipped and original exit code 1 is kept.

---

## 6. Verification Suite Output

### 6.1 Cargo Test Suite (`src-tauri`)
```bash
$ cd src-tauri && cargo test --lib
```
**Output:**
```text
test result: ok. 85 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 40.63s
```

### 6.2 TypeScript Parity & Typecheck
```bash
$ npm run typecheck
> fly-md@2.3.0 typecheck
> tsc --noEmit
(0 errors)

$ npm run test:round-plan
ok 1 - roundPlanResolver parity with Rust resolve_round_plan across shared fixture cases
```

---

## 7. Resource & Financial Accounting

- **Money spent on model calls:** **$0.00** (zero API calls; all tests executed via offline test harnesses and mock providers).
- **Workspace Isolation:** Real workspaces (`fly13`, etc.) were not touched or modified. Tests ran strictly on ephemeral temp copies and checked-in fixtures.
- **Owner's Uncommitted Edits:** Preserved untouched in `discussionAttachmentUtils.tsx`.
- **Release Binaries:** No release binaries were built or overwritten during this step.

---

## 8. Owner Alignment & Approval Confirmed

As indicated in the owner's review:
1. **Default Run Settings for New Debates (`0.1`)**: Confirmed `tokenSaver: "standard"` for new debates, and `contextMode: "classic"`.
2. **System Prompt File Staging (`2.1`)**: Confirmed Frame 0 system prompt file staging in Phase 2 applies only when `tokenSaver` is `"standard"` or `"strict"`.
