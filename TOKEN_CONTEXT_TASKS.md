# FlyMD: Debate Settings Fix, Token Cost and Shared Context

**Assigned to:** dev agent
**Base:** branch `advanced-agents`, commit `8546916`
**Report to write:** `TOKEN_CONTEXT_REPORT.md` in this folder
**Background plan:** https://claude.ai/artifact/3HydJiiAPcTkMzV7NPJpHM (private; everything you need is in this file)

## 1. Goal

1. Fix the debate settings bug that blocks the owner today (part B).
2. Lower token cost for users and give every agent a full view of the debate, without changing any current function.
3. Work in every language.

## 2. Rules

- **Keep all current behavior.** IPC payloads, Zustand store shape, statuses, state machines, events, reports and deliverables stay the same. Exception: the fixes in part B.
- **The old path stays byte-identical.** With `tokenSaver: off` and `contextMode: classic`, prompts, CLI arguments, transcripts and reports must match the golden files from part A.
- **A run keeps its mode.** Resume and retry use the mode the run started with. Old sessions load as `off` and `classic`.
- **New fields are optional.** Use `#[serde(default)]` in Rust and optional fields in TypeScript. Do not rename or remove fields.
- **Reuse what exists.** Reuse `<handoff_state>`, `record_scoped_memory`, `build_recall_pack`, `decisions.json`, `disagreements.json`, `peer_bus.json` and the stream decoder. Add no new dependency without asking.
- **Keep changes small.** Do not refactor unrelated code. Do not build anything this file does not ask for.
- **Logic must not depend on English words.** FlyMD's own instructions stay in English. Agent output uses the language of the user's proposal.
- **Git.** Stay on `advanced-agents`. Commit each finished part locally. Never pull, never push, never use or compare with `main`.
- **Owner's work.** `discussionAttachmentUtils.tsx` had an uncommitted owner change when this task was written. Do not revert it, and never edit `G:\xampp-httpdocs\fly13` or other real workspaces. Test on a copy.
- **Spending.** Do not run paid model calls beyond small smoke tests (under $1 in total) without the owner's approval. Report what you spend. Part 3.9 needs approval first.
- **If this file conflicts with the code, stop on that item and report it.** Line numbers are from `8546916`. Rust paths are under `src-tauri/src/`.

## 3. Work order

Do these in order. **Stop and write the report after part B, and again after phase 2.** Wait for the owner's approval before continuing.

| Part | Work | Stop for review |
|---|---|---|
| A | Golden tests | |
| B | Settings and model bugs | Yes |
| Phase 0 | Real usage and token counting | |
| Phase 1 | Performance | |
| Phase 2 | Cheaper calls | Yes |
| Phase 3 | Debate Board | Yes, before the paid A/B |
| Phase 4 | Defaults and README | |

---

## Part A: Golden tests (do first)

Capture today's behavior before changing anything, using the existing `MockProvider` runs.

- Save as test fixtures: assembled frames for each turn, CLI arguments per agent and intent, `transcript.jsonl`, the final report, and the event order.
- Normalize only timestamps and generated ids.
- Cover an Arabic scenario and an English scenario, in `per_agent` and repeater modes.
- Cover pause, resume, failed turn retry, round barrier pause and early convergence.

**Done when:** `cargo test` passes with the fixtures, and any change to the old path makes them fail.

---

## Part B: Bugs (owner priority)

### B1. Saving debate config has no effect

**What the owner sees:** open Config on a debate, change the model, save. The change does not apply and the same error returns. Example session: `G:\xampp-httpdocs\fly13\.flymd\discussions\disc-1793743338597`. Status `failed`, round 1, no messages. Its `config.json` still has the original models and an empty `roundSchedule`.

**Likely cause, traced in the code but not yet run. Confirm it with a failing test first.**

1. The session uses `repeaterMode: per_agent` with no schedule. In that mode `resolve_round_plan` runs one agent per round (`discussion/types.rs:432`).
2. The modal instead shows all participants in every round (`DeliberationConfigInspectorModal.tsx:496`).
3. On any edit, `handleUpdateSlot` (`:168`) creates a `roundSchedule` plan holding all participants.
4. A non-empty schedule takes priority in `resolve_round_plan` (`types.rs:384`), so round 1 now resolves to 3 agents, where it had 1.
5. The guard rejects it: "Cannot modify participants for Round 1" (`discussion/commands.rs:459`, `discussion/orchestrator.rs:411`). Nothing is written.
6. Editing round 2 or 3 fails too, because the fallback at `types.rs:389` gives round 1 another round's plan.

**Fix:**

- Add one TypeScript helper that resolves a round's slots exactly as `resolve_round_plan` does, including `per_agent`. The modal must display what will really run. Test the Rust and TypeScript versions against the same cases.
- Model or effort edit, `per_agent`, empty schedule: change that agent in `participants` only and do not create a schedule. Show a short note that this applies to every round this agent speaks in.
- Adding or removing a slot, `per_agent`: first write a full schedule for rounds 1 to `maxRounds` from today's resolved plan, then edit it. Past rounds must resolve the same, so the guard passes.
- Do not weaken the guard. Do not change `resolve_round_plan` for existing configs.
- Replace the stale defaults at `:257`: `providerId: 'ClaudeCode'` and `modelId: 'claude-3-7-sonnet'`. Use an available agent and its catalog default.
- A failed save must stay visible: keep the modal open and show the backend's error. After a successful save, reload the config from disk and show that.
- The modal shows `normalizeModelForAgent(...)`, which can differ from the saved `modelId`. When they differ, say the saved model is unavailable, so the screen never shows a model that will not run.

**Done when:**

- A new Rust test reproduces the rejection before the fix and passes after.
- On a copy of the fly13 session: change model and effort, save, reopen, and the values persist. `Resume & Retry` then sends the new model and effort (assert on `TurnRequest` with `MockProvider`).
- This works with the orchestrator in memory and with it not in memory (`commands.rs:413` and `:420`).
- Editing still works in repeater and per-round schedules. Executed rounds stay locked.

### B2. Antigravity model error stops the debate

**Error:** `invalid model selection (--model "gemini-4-argon" --effort "medium"): --effort is not supported for model "gemini-4-argon"`

**What is known:** the cause is not established. On agy 1.4.12 these all succeeded, including the same arguments run from the session's `.sandbox` folder: `--model gemini-4-argon --effort medium`, `gemini-4-argon-medium` with and without `--effort`, no model, `gemini-3.8-flash`, and `claude-sonnet-5-5`. So treat it as intermittent. `agy models` lists ids with the effort in the name, such as `gemini-4-argon-medium`. `normalize_antigravity_model_and_effort` (`agents/runner/cli_builder.rs`) strips that suffix.

**Fix:** in the debate provider and the pipeline runner, when agy exits with `invalid model selection`, retry once with the other form: `--model <base>-<effort>` and no `--effort`. The CLI rejects this before any model call. If the retry also fails, keep the failed state and show the error with the existing change-model action.

**Done when:** tests with a fake CLI script cover first form works, retry works, and both fail. Do not add other retries or remove the normalizer.

**Stop here. Write the report and wait for approval.**

---

## Phase 0: Real usage and token counting

### 0.1 Add a run setting

Add `tokenSaver: "off" | "standard" | "strict"` to `DiscussionConfig` and `AgentTaskRequest`. Missing means `off`. New runs default to `standard`, from a global setting with an override per debate and per pipeline step. Add `contextMode: "classic" | "board"` to `DiscussionConfig`. Missing means `classic`. New debates stay `classic` until phase 4.

### 0.2 Record real usage

Today pipeline tasks estimate tokens from the prompt, file path and reply text only (`agents/runner/handoff.rs:121`). A real debate turn of 17,014 tokens comes out as 4,946. Pipeline tasks show about 2,800 tokens, while real sessions have a median of 111,000 new tokens.

- Add optional fields to `TokenUsage` (`discussion/types.rs:111`): `cacheReadTokens`, `cacheWriteTokens`, `costUsd`, `basis` (`reported` or `estimated`).
- Pipeline: read `usage` and `total_cost_usd` from the Claude `result` event (`agents/runner/stream_decoder.rs:283`).
- Debates: move Claude turns to `--output-format stream-json --verbose --include-partial-messages` and reuse the decoder. Live streaming and stored text must look the same.
- HTTP: send `stream_options: {"include_usage": true}` when `tokenSaver` is on. If the provider rejects it, remove it and retry once. Read `prompt_tokens_details.cached_tokens` in `common/stream_parsers.rs`.
- Other CLIs: use real usage where the output provides it. Otherwise `basis: estimated`. Verify each CLI, do not assume.
- HUD: mark estimates with `~`. Show cached reads separately.

### 0.3 Budget meaning

Budget guards count **new tokens only**: fresh input + cache writes + output. Example, one fly3 session: 158,633 writes, 2,272,959 cached reads, 111,855 output. It counts as 270,000, not 2.5 million. Show the presets as 50k, 100k, 250k, 500k, 1M and Unlimited. Saved caps keep their values.

### 0.4 Count by script

Add one function that estimates tokens by Unicode script. Use it only for layout budgets when `tokenSaver` is on. The `off` path keeps 3.8. Provider-reported numbers remain the numbers shown to users.

Measured on one paragraph, so calibrate from real usage and write the final rates in the report:

| Script | Characters per token | Cost of same meaning vs English |
|---|---|---|
| English / Latin | 3.5 (French 2.6) | 1.00x (French 1.53x) |
| Cyrillic | 2.8 | 1.32x |
| Arabic | 1.5 | 1.88x |
| Chinese | 0.93 | 1.18x |

**Done when:** golden tests pass, and HUD numbers equal the CLI's reported usage in a small real run.

---

## Phase 1: Performance (no change to results, always on)

| Today | Where | Change |
|---|---|---|
| Whole response text copied for every output line | `agents/runner/mod.rs:322` | Copy only when a flush is due |
| All tasks with all logs cloned and sent up to 10 times a second | `store.rs:390`, `agents/runner/mod.rs:91` | Send the changed task and merge it in the UI store. The UI must show the same thing |
| Up to 64 files read and hashed every debate turn, plus 32 more for critics | `projects/cache.rs:519`, `discussion/epistemic.rs:85` | Check size and modified time first. Hash only what changed |
| Transcript parsed several times per turn | `discussion/orchestrator.rs:718`, `:809`, `discussion/memory.rs:481` | Keep it in memory. Re-read only if the file length changed |
| `MEMORY.md` read and rewritten per entry | `agents/checkpoint.rs:244` | Append |

**Done when:** golden tests stay byte-identical, the UI behaves the same, and the report gives before and after numbers for a long task.

---

## Phase 2: Cheaper calls (only when `tokenSaver` is on)

### 2.1 Claude debate turns: shared prefix in a system prompt file

Today Frame 0 is joined into one user message (`discussion/runner.rs:452`), so it is rewritten every turn and never read from cache. Measured: with `--system-prompt-file`, later turns read it from cache and a small test turn cost 50% less. Fixed context fell from about 4,000 to about 1,000 tokens.

- Write Frame 0 to a file in the session `.sandbox`. Pass it with `--system-prompt-file`. Send the rest on stdin. Debates only, where tools are already off (`--tools ""`).
- Strict also adds `--strict-mcp-config --disable-slash-commands --setting-sources project`.
- Never use `--bare`. It breaks subscription login.
- If a flag is rejected, rerun today's command.

### 2.2 Pipeline steps: only the tools each step needs

Measured start-up context: today about 40,000 tokens, with a tool list 12,200, plus the three strict flags 8,000. Add per-intent lists in `agents/runner/cli_builder.rs:140`:

| Intent | Tools |
|---|---|
| `build`, `fix-bugs`, `write-tests` | Read, Edit, Write, Grep, Glob, Bash, PowerShell |
| `refine-plan` | Same, plus WebFetch, WebSearch |
| `review`, `explain` | Read, Grep, Glob, Bash, PowerShell |

Add a "use all tools" switch per agent. Test on Windows with and without Git Bash. Report anything a step could no longer do.

### 2.3 Smaller pipeline handoffs (`agents/handoff_prompt.rs`)

- **Warm session:** when the spec hash matches the previous step in the same session, send only the new directive. New session or different hash: full body.
- **Debate report as input:** when the source is a Discussion Report, remove section 4, the raw rounds (71% of the fly12 report), and give the full report's path. The file on disk does not change. Section numbers inside the rounds can look like top-level headings, so cut by the report's own section markers and test on real reports.
- **Raw file slices:** agents with `Read` get paths and hashes, not 12,000 characters of slices. Agents without tools keep slices. The blind audit still requires reading raw files.
- **Metadata:** print target, source, intent, mode, workspace and role instructions once.
- **`MEMORY.md`:** drop "Dispatched" entries when reading. Keep the file format.
- **Spec scope:** leave `fix-bugs` and `write-tests` on the full spec for now. Report real handoff sizes so the owner can decide.

### 2.4 Local models

`discussion/runner.rs:742` sends no `num_ctx`. Ollama's documents give a 4k default below 24 GiB of VRAM. Set `num_ctx` from the prompt estimate plus room for output. Compare `prompt_eval_count` with the estimate and set `context_truncated` when it is clearly short. The documents do not say what is dropped, so test it and report.

### 2.5 Attachments

Up to 10 text files of up to 5 MB each join the proposal (`useNewDeliberationDraft.ts:777`) and repeat in every turn. A 2 MB log is about 570,000 tokens.

- Above 8,000 estimated tokens in total, warn and offer "Send index and start of each file" (default) or "Send everything".
- Show a note that agents receive only the file name of an attached image.
- Do the same for files attached during a debate, because the ledger copies that text in full (`discussion/memory.rs`).

### 2.6 Effort note

Keep medium as the default. In the picker, show that high costs about 1.4 times medium on debate turns (measured on 4 prompts). The user keeps the choice.

**Done when:** golden tests pass with `off`, cache reads appear from turn 2 in a small real debate, and a full debate and pipeline on a copy produce the same kind of deliverables.

**Stop here. Write the report and wait for approval.**

---

## Phase 3: Debate Board (only when `contextMode: board`)

### Why

Today's ledger keeps the first 10 bullet-like lines per agent (`discussion/memory.rs:377`), which is 25% of the text on real turns and 14% to 22% on the Arabic fly12 debate. Paragraphs, tables and later items are lost. Any agent's `lockedInvariants` is shown to others as "Locked Consensus Decisions (Do Not Re-Litigate)".

Test on the real fly12 debate, 16 fact questions:

| | Today's view | Board | Full text |
|---|---|---|---|
| Quiz input tokens | 4,761 | 5,456 | 12,518 |
| Facts answered of 16 | 3.5 | 15 | 16 |
| Replies in the debate's language | 0 of 2 | 2 of 2 | 1 of 2 |
| Next agent reported settled points as missing | Yes, both runs | Not in the run read | Not in the run read |

### 3.1 What each agent receives

| Layer | Content | Sent as |
|---|---|---|
| Topic card | Protocol, topic, proposal word for word, constraints, roster of exact ids, file index, language rule, project recall | Frozen for the whole debate |
| Debate board | Every claim with id and status | Frozen snapshot |
| Position cards | Each agent's latest stance only | Frozen snapshot |
| This agent's turn | Role, messages to it, directive, requested text, epistemic section | New text each turn |

Full turn text stays on disk and is sent only on request.

**Important:** new debates default to `per_agent`, with one agent per round. A snapshot shared by several agents can only be cached when a round has several agents on the same model. So: always keep the topic card in the system prompt file. Put the snapshot in the system prompt file only when a round has more than one agent on the same model. Otherwise send it first on stdin. Do not change the system prompt for each turn in `per_agent`, or every turn rewrites the cache.

### 3.2 State block

Extend the existing `<handoff_state>` JSON. It is already hidden from the UI stream, and unknown keys are ignored by the current parser. Keep the existing keys.

```json
{"position":"latest stance, about 60 words",
 "claims":[{"text":"one point, about 28 words, exact numbers","kind":"decision|risk|fact|question"}],
 "reacts":[{"id":"C3","stance":"agree|object|refine|withdraw","why":"about 15 words"}],
 "needs":["C3"]}
```

Limits: 8 claims, 8 reacts, about 400 tokens for the block. Measure limits with the script-aware count, because word limits fail in Chinese. The test used 12 claims and no limit on reacts, and the block reached 1,500 characters.

Turn instruction, tested wording: "Refer to board claims by id. Do not restate them. Write only what changes the board. Write in the language of the user's proposal."

Round 1 has an empty board, so the agent states its own position. Keep code, numbers and identifiers unchanged. Never apply these rules to plans, code, commits, translation or files on disk.

### 3.3 Board rules (new `discussion/board.rs`)

- FlyMD assigns ids (`C1`, `C2`, ...) in transcript order, so the board can be rebuilt the same way after a crash.
- Store updates per turn, keyed by message id, so resume and retry never apply one twice.
- **Status is computed.** An agent cannot declare consensus:
  - `agreed`: another agent agreed and nothing is open.
  - `uncontested`: every other participant has had a turn since the claim appeared, with no reaction.
  - `disputed`: an objection or refine is open. A `refine` that changes a value counts as open until another agent or the author accepts it. In the test, the keyboard step reversal stayed hidden as "uncontested" because it was only a refine.
  - `withdrawn`: its author withdrew it.
- The board holds only what agents wrote. The fixed fallback stances (`discussion/orchestrator.rs:903`, `:933`) must not run in board mode. They stay in classic.
- Later speakers in a round must not see same-round updates when a round has several agents. Apply updates when the round ends. This makes the barrier promised at `discussion/orchestrator.rs:758` true.
- **Tight budget:** the topic card and disputed claims are never cut. Agreed claims stay one line. Older position cards are dropped. Withdrawn claims keep only their id. Never drop the newest rounds first (`discussion/memory.rs:437`).
- **Bad block:** missing or invalid JSON falls back to a cleaned line filter for that agent's card, with no claims. The filter must ignore `---` and bare labels and keep the first paragraph. The turn still counts. Report the fallback rate.
- `needs`: send the source paragraph in that agent's next turn, up to about 1,500 tokens per turn.
- Roster: route messages by exact id. `projects/cache.rs:809` accepts ASCII names only, so `@المعلم` and custom roles are missed today.

### 3.4 Keep existing files fed

In board mode, `agreed` and `uncontested` claims go to `decisions.json`, with the status in the rationale. `disputed` claims go to `disagreements.json`. Do not record a single agent's `lockedInvariants` as a decision. The report's 12 sections and the UI must work unchanged. Full text stays in the transcript and report.

### 3.5 Early stop

Add a stop when a full cycle of participants adds no claim and changes no status. Keep the current 0.82 check. Record it through the existing convergence path, so the report and skipped-round handling work as they do now.

### 3.6 Decision brief and project memory

- At debate end, write `decision-brief.md`: goal, agreed decisions, open disputes, withdrawn options, risks, and the path to the full report. A pipeline started from this debate uses it in place of the report.
- Save agreed decisions with `record_scoped_memory`.
- New runs on that project get up to 300 tokens from `build_recall_pack` in the topic card, listed visibly and cleared by the existing memory reset. Today agents never receive this memory.

### 3.7 Invariants

`projects/cache.rs:939` keeps the first 16 invariants for the whole workspace forever, and new ones are dropped. In board mode and with `tokenSaver` on, tag each invariant with its run, show only the current run and its source debate, and keep the newest. Old files must still load.

### 3.8 Reasoning text

Stop printing the "Thinking Protocol" instruction (`discussion/memory.rs:565`) for models with native thinking, and keep it for local models. It was 29% of visible text at medium effort. Both `reasoning_extraction` safeguard failures seen were on prompts with this instruction, though the cause is not proven. Claude's thinking panel will be empty, so show a short note there.

### 3.9 A/B test (needs owner approval and a budget)

Write the harness first and give a cost estimate. Then wait. Run at least 10 real debates, 3 runs each, in English, Arabic and one more language, in `per_agent` and multi-agent rounds, on the same model and on different models.

**Passes only if:**

- Facts kept are at least 90%.
- Cost is no higher than classic.
- Language stays correct.
- Agents report no settled points as missing.
- Early stop makes no false stop.
- Pause, resume, failure, retry, config edit and all report sections work.

**Stop before the paid run and report.**

---

## Phase 4: Defaults and README (after the A/B passes)

- New debates default to `board`. Old sessions stay classic.
- Replace unmeasured README claims, such as "65%+ redundant tokens" and the prefix cache claim, with measured numbers.

---

## 4. Not in this task

Do not fix these. Report them if you touch nearby code:

- The denylist at `discussion/runner.rs:248` matches `.key`, so a prompt with `Object.keys` fails.
- The `cache_control` branch at `discussion/runner.rs:49` does nothing: `/chat/completions` does not support caching on Anthropic.
- Sending attached images to vision models.
- An Economy preset, a full text mode, a board panel in the UI, or bundling Caveman.

## 5. Expected results

These are estimates. Your job is to measure them, not to match them.

| Item | Estimate |
|---|---|
| Pipeline step, phase 2 | 15% to 25% less |
| Debate with several same-model agents in a round | About equal on short runs, about 20% less on long runs |
| `per_agent` or different-model debate | Near today's cost with a full view, possibly slightly more. Saving comes mainly from the cached topic card and the tighter state block |
| Effort high to medium | 29% less per debate turn |

Hidden thinking (37% of pipeline spend) and written code (16%) are largely unaffected. Do not claim savings you did not measure.

## 6. Checks before every report

- `cargo test` in `src-tauri`
- `npm run typecheck`
- Golden tests unchanged with `off` and `classic`
- UI checked in the real app on a copy of a workspace, in Arabic and English

## 7. Report format (`TOKEN_CONTEXT_REPORT.md`)

For each finished item:

- What changed, with file and line.
- Test command and its real output, including failures.
- Before and after numbers, marked `reported` or `estimated`.
- Anything skipped, changed from this file, or not verified, and why.
- Money spent on model calls.
- Decisions you need from the owner, in plain words, each with an example.
