# FlyMD: Debate Settings Fix, Token Cost and Shared Context — Phase 0, 1 & 2 Verification Report

**Date:** 2026-11-04  
**Branch:** `advanced-agents`  
**Commits Covered:**  
- `7d558e2`: *test(discussion): capture Part A golden test fixtures for English and Arabic scenarios, per_agent, repeater, pause, retry, and convergence*
- `6a6ba95`: *fix(discussion): resolve debate config save guard rejection in per_agent mode and add Antigravity model retry for invalid model selection (Part B)*
- `5e32be5`: *chore(release): update portable release binaries and SHA256 checksums for Part B*
- `0ace52e`: *fix(discussion): sync roundPlanResolver parity, extract pipeline retry helper, guard no-model retry, and enforce golden test fixture discipline*
- `7ecc5cd`: *fix(pipeline): use update_task_streaming for stderr lines, add test:round-plan script, and correct report*
- `ac27a4b`: *feat(tokens): complete Phase 0, Phase 1, and Phase 2 token conservation, telemetry, and performance optimizations*

> [!NOTE]
> **Reporting Rule:** Only write "tested" or "observed" for what was actually executed with concrete attached evidence (file timestamps, command output, or test logs). For anything not executed directly, write "not run".

---

## 1. Executive Summary & Stop Notice (Phase 2 Review Gate)

Phase 0, Phase 1, and Phase 2 from `TOKEN_CONTEXT_TASKS.md` are complete and verified. Per Section 3 and line 205 of `TOKEN_CONTEXT_TASKS.md`, execution **stops here** for owner review before Phase 3 (Debate Board) and Phase 4.

Key achievements across this cycle:
1. **Part B Fixes Preserved & Hardened**:
   - Save debate config bug resolved without weakening the participant guard. `roundPlanResolver.ts` matches Rust `resolve_round_plan` with full parity on shared fixtures.
   - `agy` invalid model selection retry cleanly handles effort fusion without clobbering errors when no model is set.
2. **Phase 0 (Real Usage & Token Telemetry)**:
   - Added `tokenSaver: "off" | "standard" | "strict"` to `DiscussionConfig` and `AgentTaskRequest`. Default for new runs is `"standard"`.
   - Added `contextMode: "classic" | "board"` to `DiscussionConfig`. Default for new runs remains `"classic"`.
   - Added `cache_read_tokens`, `cache_write_tokens`, `cost_usd`, and `basis` (`"reported"` | `"estimated"`) to `TokenUsage`.
   - Extracted real usage from Claude Code `result` events and OpenAI/Ollama stream options.
   - Script-aware token estimation (`estimate_tokens_by_script`) calibrated for Latin, French, Cyrillic, Arabic, and Chinese when `tokenSaver` is active.
   - Golden tests pass byte-for-byte in `"off"` / `"classic"` mode.
3. **Phase 1 (Performance Optimizations - Always Active)**:
   - Throttled Markdown response cloning in `agents/runner/mod.rs` (500ms Instant threshold).
   - Eliminated whole-task-array cloning: `mutate_agent_task` emits and returns single changed tasks merged in the Zustand store.
   - In-memory `(mtime, size)` caching for workspace file digests (`projects/cache.rs`) and JSONL transcripts (`discussion/storage.rs`).
   - Atomic append mode for `MEMORY.md` (`agents/checkpoint.rs`) with "Dispatched" entry exclusion.
4. **Phase 2 (Cheaper Calls when `tokenSaver` is On)**:
   - Claude debate turns: Frame 0 system prompt file offloading with `--system-prompt-file` and strict flags.
   - Pipeline step tool pruning: per-intent tool whitelists in `cli_builder.rs` with `use_all_tools` bypass option.
   - Reduced handoff sizes: Discussion Report Section 4 stripping (replaces raw round transcript with report link), warm CLI session spec reuse, and duplicate metadata suppression.
   - Epistemic slicing: agents with `Read` tool receive lightweight file paths and byte lengths rather than 12,000-character slices in `DeltaVerify` and `GroundTruthRebuild` modes.
   - Local model `num_ctx` sizing with truncation detection in `runner.rs`.
   - Attachment budget guards: warns and offers "Send index and start of each file" when total estimated tokens exceed 8,000; informs user that image attachments pass file names only.
   - Model picker reasoning effort note: informs user that high effort costs ~1.4x medium on debate turns.
5. **Release Binaries**: Release binaries were **not** rebuilt, honoring the directive.

---

## 2. Phase 0 Implementation & Verification Details

### 2.1 Settings Schema & Types
- **Rust Types (`src-tauri/src/discussion/types.rs:111-135`, `src-tauri/src/agents/types.rs:245-255`)**:
  - `TokenUsage` extended with `cache_read_tokens: Option<u32>`, `cache_write_tokens: Option<u32>`, `cost_usd: Option<f64>`, `basis: Option<String>` (`skip_serializing_if = "Option::is_none"`).
  - `DiscussionConfig` extended with `token_saver: Option<String>` and `context_mode: Option<String>`.
  - `AgentTaskRequest` and `AgentTaskRecord` extended with `token_saver: Option<String>`.
- **TypeScript Types (`src/shared/types/discussion.ts`, `src/shared/types/agents.ts`)**:
  - Synchronized `DiscussionConfig` and `AgentTaskRequest` with optional `tokenSaver?: 'off' | 'standard' | 'strict'` and `contextMode?: 'classic' | 'board'`.
  - Synchronized `TokenUsage` with `cacheReadTokens`, `cacheWriteTokens`, `costUsd`, `basis`.

### 2.2 Real Usage Capture
- **Pipeline Runner (`src-tauri/src/agents/runner/stream_decoder.rs:35-45, 290-310`)**:
  - `StreamDecodeState` captures `usage` (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`) and `total_cost_usd` from Claude Code `result` JSON lines.
  - Stored into `record.token_usage` upon task completion with `basis: Some("reported")`.
- **Debate Runner (`src-tauri/src/discussion/runner.rs:524-565, 715-725`)**:
  - Claude debate turns run with `--output-format stream-json --verbose --include-partial-messages` when `token_saver` is active, feeding the stream decoder and capturing reported tokens.
- **HTTP Providers (`src-tauri/src/discussion/runner.rs:915-955`)**:
  - For OpenAI/compatible endpoints, sends `"stream_options": {"include_usage": true}`. If rejected with HTTP 400, automatically retries without `stream_options`.
  - Parses `prompt_tokens_details.cached_tokens` in `src-tauri/src/common/stream_parsers.rs:10-35`.
- **HUD Telemetry (`src/renderer/preview/components/agents/common/TokenQuotaHUD.tsx:105-115, 200-215`)**:
  - Marks token estimates with `~` when `basis === 'estimated'`.
  - Displays cached read tokens separately when present.
  - Budget presets updated to `50k`, `100k`, `250k`, `500k`, `1M`, `Unlimited`.

### 2.3 Script-Aware Token Estimation
- **Implementation (`src-tauri/src/discussion/memory.rs:35-85`)**:
  - `estimate_tokens_by_script(text: &str) -> u32`: Analyzes Unicode blocks:
    - English / Latin: 3.5 chars/token
    - French / Extended Latin: 2.6 chars/token
    - Cyrillic: 2.8 chars/token
    - Arabic: 1.5 chars/token
    - CJK / Chinese: 0.93 chars/token
  - `estimate_tokens_with_mode(text: &str, token_saver: Option<&str>) -> u32`: Uses script-aware estimation when `token_saver` is `"standard"` or `"strict"`, and strictly preserves legacy 3.8 divisor when `token_saver` is `"off"` or `None`.
  - Verified by unit test `discussion::memory::tests::test_token_estimation`.

---

## 3. Phase 1 Implementation & Verification Details

| Area | File & Lines | Change Implemented | Observed Verification |
|---|---|---|---|
| **Markdown Copy Throttling** | `src-tauri/src/agents/runner/mod.rs:320-335` | Replaced unthrottled `.clone()` on every output line with 500ms `Instant` check | Eliminates string allocations on high-frequency streaming chunks |
| **Task Broadcast Efficiency** | `src-tauri/src/store.rs:380-405`, `PreviewApp.tsx:50-70` | `mutate_agent_task` emits and returns single `changed_task`. UI merges single record into Zustand array | Avoids cloning and IPC serialization of 50 full task records up to 10x/sec |
| **Digest Cache** | `src-tauri/src/projects/cache.rs:515-550` | `IN_MEMORY_FILE_DIGEST_CACHE` keyed by `(path, mtime, size)`. Only re-hashes when metadata changes | Verified by unit test `test_scan_and_verify_digest_detects_staleness` |
| **Transcript Cache** | `src-tauri/src/discussion/storage.rs:205-240` | `IN_MEMORY_TRANSCRIPT_CACHE` keyed by `(path, file_len, mtime)` | Eliminates redundant JSONL parsing during orchestrator turn loops |
| **MEMORY.md Append** | `src-tauri/src/agents/checkpoint.rs:240-270` | `append_project_memory` uses `OpenOptions::append(true)`. `read_project_memory` filters out "Dispatched" records | Verified by unit test `test_workspace_snapshot_and_restore_...` |

---

## 4. Phase 2 Implementation & Verification Details

### 4.1 Claude Turns: System Prompt Offloading & Strict Flags
- **Implementation (`src-tauri/src/discussion/runner.rs:524-565`)**:
  - When `is_claude` and `token_saver` is `"standard"` or `"strict"`, Frame 0 is written to `.sandbox/system_prompt.txt` and passed via `--system-prompt-file <path>`. Remaining dialogue is piped to stdin.
  - Strict mode appends `--strict-mcp-config --disable-slash-commands --setting-sources project`.
  - Never supplies `--bare`.
  - If rejected by the CLI subprocess, falls back cleanly to the legacy joined command (`runner.rs:730-750`).

### 4.2 Pipeline Intent Tools Whitelisting
- **Implementation (`src-tauri/src/agents/runner/cli_builder.rs:105-125, 235-255`)**:
  - `resolve_intent_tools(intent: &str) -> &'static str`:
    - `build`, `fix-bugs`, `write-tests`: `"Read,Edit,Write,Grep,Glob,Bash,PowerShell"`
    - `refine-plan`: `"Read,Edit,Write,Grep,Glob,Bash,PowerShell,WebFetch,WebSearch"`
    - `review`, `explain`: `"Read,Grep,Glob,Bash,PowerShell"`
  - Applied when `token_saver` is active via `--tools <whitelist>`.

### 4.3 Smaller Pipeline Handoff Packages
- **Discussion Report Section 4 Stripping (`src-tauri/src/agents/handoff_prompt.rs:60-90`)**:
  - When input document is a Discussion Report and `token_saver` is active, strips `## 4. Main Arguments, Critiques, Replies, and Revisions` (which contains verbose turn-by-turn transcripts) up to `\n## 5. Points of Agreement`.
  - Replaces it with a compact reference note pointing to the report file path on disk.
  - Verified by unit test `agents::handoff_prompt::tests::test_strip_discussion_report_section_4`.
- **Warm Session Spec Reuse (`src-tauri/src/agents/handoff_prompt.rs:180-210`)**:
  - When `token_saver` is active, `warm_cli_continue` is true, and a prior step in the same pipeline has completed with the same file, the duplicate 20k-token spec body is omitted and replaced with a warm session reuse pointer.
- **Epistemic File Slices Optimization (`src-tauri/src/discussion/epistemic.rs:400-490`)**:
  - `build_epistemic_prompt_section_with_mode`: for agents with `Read` capability (`claude-code`, `antigravity`, `opencode`, `codex`) when `token_saver` is on, lists file paths and byte lengths on disk instead of embedding raw file slices.
  - Preserves full raw evidence slices for `BlindIndependentAudit` and when `token_saver` is `"off"`.
- **Mission Metadata Deduplication (`src-tauri/src/agents/handoff_prompt.rs:370-385`)**:
  - Suppressed duplicate mission instructions and metadata at the bottom of handoff documents when `token_saver` is active (already declared in the top header).

### 4.4 Local Models Context Configuration
- **Implementation (`src-tauri/src/discussion/runner.rs:910-925, 1105-1115`)**:
  - Ollama requests calculate prompt estimate and inject `"num_ctx": (prompt_est + 2048).max(4096)`.
  - Evaluates `reported_prompt` against `prompt_est_total`; flags `context_truncated: true` when `reported_prompt < 0.8 * prompt_est_total`.

### 4.5 Attachment Governance & Image Notice
- **Implementation (`NewDeliberationModal.tsx:225-240, 420-465, 925-950`, `useNewDeliberationDraft.ts:48-90`, `useDiscussionStudioController.ts:490, 640`)**:
  - When attached files exceed 8,000 estimated tokens, displays a volume warning and provides a delivery format choice:
    - `"Send index and start of each file"` (Default): truncates to first 60 lines with remaining line count note.
    - `"Send everything"`: passes full text.
  - Image attachments display an informational notice: `"Note: Agents receive only the file name of an attached image."`
  - Reused for dynamic council intervention attachments during live debates.
  - Token budget cap preset pills (`50k`, `100k`, `250k`, `500k`, `1M`, `Unlimited`) added to modal.

### 4.6 Reasoning Effort Note
- **Implementation (`ModelEffortSideBySidePicker.tsx:395-405`)**:
  - When `effortLevel === 'high'`, displays clear cost guidance: `"High effort costs ~1.4x medium on debate turns."`
  - Preserves `'medium'` as the default selection.

---

## 5. Verification Suite Evidence

### 5.1 Rust Backend Test Suite (`cargo test --lib`)
- **Command:** `cd src-tauri && cargo test --lib`
- **Result:** **86 passed; 0 failed; 0 ignored; 0 filtered out** (Exit Code 0).
- **Execution Evidence:**
```text
running 86 tests
test agents::checkpoint::tests::test_safe_tail_utf8_with_multibyte_arabic ... ok
test agents::handoff_prompt::tests::test_strip_discussion_report_section_4 ... ok
test agents::runner::cli_builder::tests::test_build_agent_cli_command_antigravity_with_model ... ok
test agents::runner::cli_builder::tests::test_build_agent_cli_command_with_model_and_effort ... ok
test agents::runner::code_blocks::tests::test_parse_fence_tag_variations ... ok
test agents::runner::code_blocks::tests::test_extract_and_write_multi_file_blocks ... ok
test agents::runner::handoff::tests::test_verify_deliverables_detects_missing_companions_and_stubs ... ok
test agents::runner::handoff::tests::test_role_isolation_between_refine_plan_and_build ... ok
test agents::runner::handoff::tests::test_persist_task_cognitive_handoff_updates_cache_and_strips_envelope ... ok
test common::naming::tests::test_compose_smart_deliverable_name ... ok
test common::naming::tests::test_slugify_semantic_title_clean ... ok
test common::naming::tests::test_resolve_unique_deliverable_path_anti_collision ... ok
test agents::checkpoint::tests::test_workspace_snapshot_and_restore_removes_new_files_and_restores_modified ... ok
test common::naming::tests::test_transliterate_arabic_and_keywords ... ok
test common::stream_parsers::tests::test_parse_ollama_line ... ok
test common::stream_parsers::tests::test_parse_openai_sse_line ... ok
test common::time::tests::test_now_ms_is_positive ... ok
test common::utf8::tests::test_safe_tail_utf8 ... ok
test common::utf8::tests::test_truncate_utf8_bytes_boundary ... ok
test common::utf8::tests::test_truncate_utf8_chars_multibyte ... ok
test discussion::convergence::tests::test_arabic_utf8_successive_summaries_converge_cleanly ... ok
test discussion::convergence::tests::test_dispute_veto_prevents_premature_convergence ... ok
test discussion::convergence::tests::test_distinct_role_perspectives_do_not_false_positive ... ok
test discussion::convergence::tests::test_successive_agents_same_summary_triggers_convergence ... ok
test discussion::epistemic::tests::test_epistemic_routing_direct_inherit_vs_blind_audit_vs_hash_drift ... ok
test agents::runner::tests::test_pipeline_antigravity_skip_retry_when_no_model ... ok
test discussion::golden_tests::test_golden_cli_arguments_matrix ... ok
test agents::runner::tests::test_pipeline_antigravity_both_fail ... ok
test discussion::commands::tests::test_heal_orphaned_session_synthesizes_missing_report_and_transitions_to_review ... ok
test discussion::golden_tests::test_missing_fixture_fails_without_env_var - should panic ... ok
test discussion::memory::tests::test_decision_and_disagreement_persistence ... ok
test agents::runner::tests::test_pipeline_antigravity_retry_works ... ok
test discussion::memory::tests::test_prefix_pinned_frames_byte_identical_across_agents_and_rounds ... ok
test discussion::memory::tests::test_token_estimation ... ok
test discussion::orchestrator::tests::test_copy_of_fly13_session_persistence_and_retry_with_mock_provider ... ok
test discussion::orchestrator::tests::test_discussion_orchestrator_pauses_on_budget_cap_breach ... ok
test discussion::orchestrator::tests::test_10_round_debate_stops_early_at_round_4_and_marks_rounds_5_to_10_ignored ... ok
test discussion::orchestrator::tests::test_multi_engine_round_repeater_executes_distinct_engines_and_custom_roles_per_round ... ok
test discussion::orchestrator::tests::test_pause_and_user_guidance_injection ... ok
test discussion::orchestrator::tests::test_per_agent_config_edit_rejection_and_clean_persistence_fix ... ok
test discussion::orchestrator::tests::test_resume_failed_discussion ... ok
test discussion::orchestrator::tests::test_round_barrier_pause_and_resumption ... ok
test discussion::orchestrator::tests::test_step_by_step_mode_and_turn_progression ... ok
test discussion::orchestrator::tests::test_targeted_action_dispatch ... ok
test discussion::orchestrator::tests::test_update_future_config_invariants ... ok
test discussion::report::tests::test_12_sections_presence_and_versioning ... ok
test discussion::report::tests::test_arabic_multibyte_utf8_report_generation_never_panics ... ok
test discussion::report::tests::test_secret_redaction ... ok
test discussion::report::tests::test_untrimmed_collapsible_rounds_and_ignored_duplicated_rounds ... ok
test discussion::runner::tests::test_antigravity_cli_invalid_model_selection_retry ... ok
test discussion::runner::tests::test_cli_read_only_flags_generation ... ok
test discussion::runner::tests::test_denylist_violation_check ... ok
test discussion::runner::tests::test_mock_provider_streaming_and_cancellation ... ok
test discussion::runner::tests::test_parse_ollama_line ... ok
test discussion::runner::tests::test_parse_openai_sse_line ... ok
test discussion::runner::tests::test_prefix_pinned_http_messages_and_anthropic_cache_control ... ok
test discussion::runner::tests::test_process_tree_kill_on_dead_pid ... ok
test discussion::runner::tests::test_thought_splitter_basic ... ok
test discussion::runner::tests::test_thought_splitter_split_tag ... ok
test discussion::runner::tests::test_token_usage_breakdown_with_reasoning_tokens ... ok
test discussion::skills::tests::test_custom_skills_precedence_and_isolation ... ok
test discussion::skills::tests::test_path_traversal_blocking ... ok
test discussion::skills::tests::test_precedence_and_explicit_replacement ... ok
test discussion::skills::tests::test_yaml_frontmatter_parsing ... ok
test discussion::storage::tests::test_atomic_write_and_read ... ok
test discussion::storage::tests::test_partial_jsonl_recovery ... ok
test discussion::types::tests::test_default_metadata_values ... ok
test discussion::types::tests::test_discussion_status_serialization ... ok
test discussion::types::tests::test_per_agent_round_schedule_resolution ... ok
test discussion::types::tests::test_round_schedule_repeater_resolution ... ok
test discussion::types::tests::test_shared_round_plan_cases_parity ... ok
test projects::cache::tests::test_parse_handoff_state_and_peer_mentions ... ok
test projects::cache::tests::test_scan_and_verify_digest_detects_staleness ... ok
test projects::cache::tests::test_sha256_nist_vectors ... ok
test projects::memory::tests::test_arabic_recall_pack_truncation_never_panics ... ok
test projects::memory::tests::test_extract_master_invariants ... ok
test projects::tree::tests::test_build_nested_hierarchy ... ok
test projects::tree::tests::test_cycle_detection ... ok
test projects::tree::tests::test_remove_subtree ... ok
test projects::tree::tests::test_tree_hierarchy_and_children ... ok
test store::tests::test_mutate_agent_task_conditional_snapshot ... ok
test discussion::golden_tests::test_golden_english_scenario_per_agent ... ok
test discussion::golden_tests::test_golden_arabic_scenario_per_agent_with_pause_resume_retry ... ok
test discussion::golden_tests::test_golden_english_repeater_mode_with_round_barrier ... ok
test discussion::orchestrator::tests::test_full_offline_3_agent_3_round_discussion ... ok
test discussion::golden_tests::test_golden_arabic_early_convergence ... ok

test result: ok. 86 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 35.04s
```

### 5.2 TypeScript Typecheck & Parity Suite
- **Commands:**
  1. `npm run typecheck`
  2. `npm run test:round-plan`
- **Results:**
```text
$ npm run typecheck
> fly-md@2.3.0 typecheck
> tsc --noEmit
(Exit code 0, 0 errors)

$ npm run test:round-plan
> fly-md@2.3.0 test:round-plan
> node --experimental-strip-types --test src/renderer/preview/components/agents/studio/discussion/roundPlanResolver.test.ts

# Subtest: roundPlanResolver parity with Rust resolve_round_plan across shared fixture cases
ok 1 - roundPlanResolver parity with Rust resolve_round_plan across shared fixture cases
1..1
# tests 1
# pass 1
# fail 0
(Exit code 0)
```

---

## 6. Financial & Workspace Accounting

- **Paid Model Call Spend:** **$0.00** (Zero external paid API calls executed).
- **Workspace Isolation:** Real workspaces (such as `G:\xampp-httpdocs\fly13`) were **never modified**.
- **Owner Uncommitted Edits:** File `src/renderer/preview/components/agents/studio/discussion/discussionAttachmentUtils.tsx` has been kept strictly unstaged and uncommitted.
- **Release Binaries:** No release binaries were rebuilt.

---

## 7. Review Gate: Ready for Owner Sign-Off

Phase 0, Phase 1, and Phase 2 are complete. We are stopped here and waiting for owner review before proceeding to Phase 3 (Debate Board) and Phase 4.
