# FlyMD: Review Patch 2 (after Phases 0 to 4)

**Assigned to:** dev agent
**Base:** branch `advanced-agents`, commit `81e6151`
**Report:** update `TOKEN_CONTEXT_REPORT.md` (new section at the top, "Patch 2")
**Main task file:** `TOKEN_CONTEXT_TASKS.md` (all its rules still apply)

## 1. Why this patch exists

The review of commits `7ecc5cd` to `81e6151` found that the code mostly works, but some report claims are false. Tests pass: 93 Rust tests, typecheck and the round-plan test were re-run independently.

Problems found:

1. **Skipped stops.** The task said to stop after Phase 2, and again before the paid A/B. Phases 3 and 4 were done anyway. Phase 4 made the Debate Board the default for every new debate, although the board has never run against a real model.
2. **The dry-run "verification" checks nothing.** `scripts/ab_debate_harness.py` asserts on fixed values (`facts_kept = 15.2 / 16.0`, `lang_correct = True`). The report says "Passes all 6 criteria" and marks results as `observed`.
3. **The cost numbers are invented.** The harness assumes 8,600 against 5,200 input tokens and 60% cache hits. It prices old models (`claude-3-5-sonnet`, `gpt-4o`), not the ones FlyMD uses. It cannot make a real call: `--run-paid` only prints a line, and it demands a budget of at least $10 while the report asks for $5.
4. **README now states false numbers.** "~52% measured deliberation token reduction" is not measured. "71% smaller handoff reports via decision-brief.md" is wrong: 71% was the share of section 4 in one real report, measured during planning.
5. **The token budget still under-counts.** `stream_decoder.rs` sets `prompt_tokens = input_tokens` and `total_tokens = input + output`. Claude reports almost all input as cache writes and reads, so a real 17,014 token turn would count as about 6,000. The rule in the main task, section 0.3, says count fresh input + cache writes + output.
6. **Pipelines never use Token Saver.** Nothing in the UI or backend sets `tokenSaver` on `AgentTaskRequest`, so the Phase 2 pipeline savings never run. Task 0.1 asked for a global setting with an override per debate and per pipeline step. None exists.
7. **Lost task updates are possible.** `PreviewApp.tsx:181` merges a single task into `store.agentTasks` read from render state. Two updates before a re-render can overwrite each other. `FloatApp.tsx:26` ignores single-task updates, so its running count can go stale.

The owner also reported two UI bugs (parts C and D).

## 2. Rules

- Everything in `TOKEN_CONTEXT_TASKS.md` section 2 still applies.
- **The owner edits files by hand between rounds.** Never revert or overwrite those edits. If a file changed in a way you did not expect, keep it and report it.
- **Honest reports.** Write "observed" only for something you ran, and attach the evidence. A mock, a fixed value or an assumption is never evidence. Write "not run" otherwise.
- **Stop points are hard stops.** Do not start a later part because an earlier one went well.
- No paid model calls in this patch.
- Do not rebuild release binaries unless asked.

## 3. Work order

| Part | Work |
|---|---|
| A | Make defaults safe and claims true |
| B | Fix usage counting, the pipeline setting and task update merging |
| C | Light text on colored fills |
| D | Fetch-models errors |
| E | Real A/B harness, written but not run |

**Stop after E and report.**

---

## Part A: Safe defaults and true claims

1. Set new debates back to `contextMode: 'classic'` (`useNewDeliberationDraft.ts:849`). Keep all board code. Add a visible option in the New Deliberation modal: "Debate Board (experimental)", off by default.
2. Revert the three README number claims, in English and Arabic, to neutral wording with no numbers. Numbers come back only after a real A/B.
3. In the report, mark the Phase 3 and 4 results as "not verified with real models". Remove the dry-run "Passes all 6 criteria" claim and every invented cost figure.

**Done when:** a new debate starts in classic mode, the board option works when checked, and golden tests pass.

---

## Part B: Usage counting, pipeline setting, task updates

### B1. Real usage totals

In the Claude `result` handler (`agents/runner/stream_decoder.rs`):

- `prompt_tokens` = `input_tokens` + `cache_creation_input_tokens`. Cache reads stay in `cache_read_tokens`.
- `total_tokens` = fresh input + cache writes + output. Cache reads are not counted.
- Keep `cost_usd` from `total_cost_usd`.

Use the same rule for the HTTP and Ollama paths. Make sure the budget guard (`discussion/orchestrator.rs:879`) and the HUD (`quotaSlice.ts`) use this total.

**Test:** a unit test with a real Claude `result` line. Use the shape from a real Claude Code session log in `~/.claude/projects`, with real numbers. Assert the totals.

### B2. Token Saver for pipelines

- Add one global setting, Token Saver: Off, Standard (default) or Strict.
- New debates and new pipeline steps take it from there.
- Add an override in the pipeline step editor and the dispatch modal.
- Old tasks and sessions without the field stay `off`.

**Test:** a dispatched pipeline task carries `tokenSaver`, and its CLI arguments include the `--tools` list for its intent.

### B3. Task update merge

- `PreviewApp.tsx`: merge with the store's current state (`getState()` or a functional update), not render state.
- `FloatApp.tsx`: keep a task map so single-task updates also update the running count.

**Done when:** no update is lost when two single-task events arrive before a re-render. Test this in the real app, or with a small script that fires two events.

---

## Part C: Light text on colored fills (owner request)

**Owner rule:** any component with a solid, colored fill shows light text and light icons, in every theme and every state. Colored means blue, sky, indigo, violet, purple, fuchsia, pink, rose, red, orange, amber, yellow, lime, green, emerald, teal, cyan, and gradients made of them. States are normal, hover, active, selected, disabled and focus.

**Cause found:**

1. 27 classNames put dark text (`text-slate-950`) on a solid colored fill, for example `bg-sky-500 text-slate-950`. These are in 16 files under `src/renderer/preview/components/agents/`, including `AgentAccountsModal.tsx:378`, `AgentStudioSidebar.tsx:1153` and `DiscussionTopToolbar.tsx:155`. More may be built in template strings, which a simple search misses.
2. `src/renderer/styles/themes.css:504` lightens text only for a fixed list of shades (600 and 700 of a few hues), and only on `button`. Other hues, the 500 shades, badges, pills and `div` or `span` fills are missed.
3. The light-theme guards in `themes.css` (from about line 264) turn `text-slate-100` to `text-slate-400` dark everywhere, including inside colored fills.

**Fix:**

- Fix at the source. Every solid colored fill uses white text and white icons.
- For hues where white on 500 is hard to read (amber, yellow, lime, sky, cyan, orange, emerald, green, teal), move the fill to 600 or 700. White text must reach a contrast of 4.5:1, or 3:1 for bold text of 14px and larger.
- Replace the fixed list in `themes.css` with one rule that covers every solid colored fill, so a new component cannot miss it. Light-theme darkening rules must not apply inside a solid colored fill.
- Do not touch tinted pills (`/10`, `/15`, `/20` opacity). They keep dark text in light themes, as now.
- Add `npm run lint:contrast`, a Node script with no new dependency. It fails when a className has a solid colored fill and dark text. Run it in the report.

**Done when:**

- `lint:contrast` passes.
- Screenshots of the real app show no dark text on a colored fill, in all 10 themes, for these screens: Agents Studio, debate toolbar and sidebar, New Deliberation modal, debate settings modal, Agent Accounts modal, dispatch modal and pipeline recovery modal.
- Attach the screenshots or their paths to the report.

---

## Part D: Fetch-models errors (owner request)

**Owner rule:** when fetching models fails, the user sees an error message at the model selector.

**Cause found:**

- Backend: `fetch_live_agent_models` (`agents/discovery.rs:531`) returns a plain list. It ignores the exit code and stderr of `agy models`, and on any failure returns a built-in list as if it were live. `cmd_fetch_agent_models` (`agents/commands.rs:136`) is a sync command, so a slow CLI can freeze the app. There is no timeout.
- Frontend: `fetchAndCacheAgentModels` (`shared/constants/models.ts:359`) catches errors with `console.warn` and returns the built-in list.

**Fix:**

- Backend: return `{ models, source: "live" | "builtin", error: string | null }`.
  - Set `error` when the CLI is missing, exits non-zero (include the first useful stderr line), times out (20 seconds) or prints nothing usable.
  - Run the command async, or in `spawn_blocking`, so the UI never freezes.
  - Keep the Electron bridge (`src/preload/index.ts:175`) working with the new shape.
- Frontend: `fetchAndCacheAgentModels` returns that result and does not swallow errors. All three callers show a short red message under the select, with a Retry button:
  - `ModelEffortSideBySidePicker.tsx:95`
  - `PipelineRecoveryModal.tsx:128`
  - `DeliberationConfigInspectorModal.tsx:74`
- Message examples: "Could not load models: agy is not installed", or "Could not load models: agy exited with code 1: <stderr line>". When the built-in list is shown because of an error, say "Showing the built-in list".
- Keep the current selection and the previous list on error. Clear the message on success.

**Done when:**

- Rust tests with a fake CLI cover: missing binary, non-zero exit, timeout, empty output and success.
- In the real app, with the agy path in Agent Accounts set to a wrong file, the fetch button shows the error in all three places. Attach the evidence.

---

## Part E: Real A/B harness (write it, do not run paid calls)

Replace the fixed-value dry run with a harness that measures:

- It drives real debates through the same code FlyMD uses, in classic and board mode, on the same prompts and models. Use a small Rust test binary or command behind a flag, not a Python model of costs.
- It records provider-reported usage and cost for every turn.
- It scores facts kept with a fixed question set per debate, answered from what the next agent received. Use the method in the plan: 16 questions on the real fly12 debate.
- It records reply language, a "reported missing" check and the early stop result.
- `--dry-run` uses `MockProvider` only, and says plainly that its numbers are not results.
- The budget gate matches the approved amount and stops spending when the running cost reaches it.
- It prints a cost estimate based on real usage from the owner's logs, with the models FlyMD uses (Claude Opus 5.5, Sonnet 5.5, Gemini 4 Argon). Mark it as an estimate.

**Done when:** the harness runs end to end in dry-run mode, and the report gives the estimate. **Do not run paid calls.** The owner will decide the budget.

---

## 4. Checks before the report

- `cargo test --lib` in `src-tauri`
- `npm run typecheck`, `npm run test:round-plan`, `npm run lint:contrast`
- Golden tests unchanged in classic mode
- Real-app checks for parts B3, C and D, with evidence

## 5. Report

Use the format in `TOKEN_CONTEXT_TASKS.md` section 7. For each part, give what changed (file and line), the commands with real output, and evidence for every "observed". List anything not run, and why.
