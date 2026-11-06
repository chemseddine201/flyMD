# FlyMD: Review Patch 3 (after Patch 2)

**Assigned to:** dev agent
**Base:** branch `advanced-agents`, commit `81e6151` plus the uncommitted Patch 2 work in the tree
**Report:** add a "Patch 3" section at the top of `TOKEN_CONTEXT_REPORT.md`
**Task files that still apply:** `TOKEN_CONTEXT_TASKS.md`, `TOKEN_CONTEXT_PATCH2_TASKS.md`

## 1. Review result for Patch 2

These checks were re-run independently: `cargo test --lib` gives 103 passed, and typecheck passes.

| Part | Verdict |
|---|---|
| A | Accepted. New debates start in classic mode, and the README numbers are gone. The old report sections still state the false claims (see P5). |
| B | Accepted. The usage totals, the global Token Saver setting with step and dispatch overrides, and the task merge are done. |
| C | **Not done.** The report says "42 fixed" and "lint passes". `npm run lint:contrast` fails today with 14 hits, and 8 of them are `text-slate-950` on a colored fill. The new CSS rule causes new bugs. No screenshots were taken. |
| D | Code accepted. The real-app check was not run. |
| E | **Fake again.** See P4. |

The report says screenshots and the real-app check were "not run" because the session was headless. That is not true. This PC has a display, and the app was driven over CDP during an earlier review. Do these checks this time.

## 2. Rules

- Every rule in `TOKEN_CONTEXT_TASKS.md` section 2 and `TOKEN_CONTEXT_PATCH2_TASKS.md` section 2 still applies.
- **The owner edits files by hand between rounds.** Never revert or overwrite those edits. If a file changed in a way you did not expect, keep it and report it.
- Write "observed" only for something you ran in this patch, and paste its output. A mock, a fixed value, hand-written text or an assumption is never evidence.
- No paid model calls. Do not rebuild release binaries.
- Do the work in order, P1 to P5, then stop and report.

---

## P1. Finish the colors (Part C)

### P1.1 Remaining dark text on colored fills

Fix every hit from `npm run lint:contrast`. The 8 real ones are:

- `AgentStudioSidebar.tsx:777, 812, 988, 1121, 1124, 1176`: `bg-amber-500`, `bg-sky-500` or `bg-indigo-500` with `text-slate-950`
- `AgentDispatchModal.tsx:680`: `bg-sky-500 ... text-slate-950`
- `NewDeliberationModal.tsx:1028`: `bg-sky-500 ... text-slate-950`

### P1.2 Hover states

Most fixes moved the fill to 600 but the hover to 500, for example `bg-amber-600 hover:bg-amber-500 text-white`. White on amber-500 or emerald-500 is below 3:1, so the text fades on hover. Hover must also meet the contrast rule. Make hover darker (700), not lighter.

### P1.3 Fix the CSS rule in `themes.css` (about lines 504 to 556)

The new rule causes three new bugs:

1. **`[class*="bg-gradient-to-"]` matches every gradient**, including tinted ones and `dark:` ones. Examples:
   - `AgentAccountsModal.tsx:724` (`from-emerald-500/10 via-slate-50 to-sky-500/10`)
   - `PipelineStatusBanners.tsx:53` (`bg-purple-50 dark:bg-gradient-to-r ...`)
   - `DiscussionTimelineView.tsx:225, 320` (`bg-rose-50` and `bg-emerald-50/90` with a `dark:` gradient)

   In light themes these banners get white text on an almost white background. Match only gradients whose stops are solid colored shades (600 or darker, no `/opacity`), and never `dark:` classes.
2. **The descendant rule forces every `span`, `p`, `div`, `label` and `code` inside the fill to white.** This includes `bg-slate-800`, `bg-slate-900`, `bg-zinc-800`, `bg-zinc-900` and `bg-black`, which appear 398 times in 61 files as panels. Colored status text (`text-emerald-400`, `text-rose-400`) and inner white cards inside those panels lose their colors.
3. Inside a colored fill, a child with its own background (a white input or a light badge) gets white text on white.

**Fix:**

- Set light text on the fill element itself, and let children inherit it.
- Change a child only when it has a dark text class (`text-slate-500` to `text-slate-950`, the gray and zinc equivalents, or `text-black`), or when the light-theme darkening guards (from about line 264) would darken it.
- Never change a child that has its own `bg-*` class or a colored `text-*` class.
- Keep `slate/zinc 800/900` and `black` for `button` only, as before Patch 2. Do not apply them to every `div`.

### P1.4 Make the lint script correct

- Check each class string on its own, not each line. Today it flags `bg-sky-600 text-white` because the other branch of the ternary on the same line has `hover:text-slate-900`. Six of the 14 hits are false.
- Also fail on:
  - `text-white` on `bg-{amber,yellow,lime,sky,cyan,orange,emerald,green,teal}-400` or `-500`, including `hover:` variants
  - `text-slate-700` to `text-slate-900` and `text-gray-*` dark shades on a colored fill
- Add a small self-test: 5 strings that must fail and 5 that must pass, run by the script.

### P1.5 Screenshots (required)

The app has a display. Use either of these:

- `npm run tauri:dev`, launched with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333` and its own `WEBVIEW2_USER_DATA_FOLDER`. Take screenshots with CDP `Page.captureScreenshot`.
- `npm run dev` (Vite) in a browser, for screens that do not need the backend.

**Before you start, back up `%APPDATA%\com.flymd.desktop\fly-md-store.json`, and restore it when you finish.** Use a scratch workspace, never `fly12`, `fly13` or another real one.

Take screenshots in all 10 themes, in normal and hover state, of:

- Agents Studio
- debate toolbar and sidebar
- New Deliberation modal
- debate settings modal
- Agent Accounts modal
- dispatch modal
- pipeline recovery modal
- one light-theme banner from point 1 above

Save them under `scratch/contrast-shots/<theme>/<screen>.png`, and list the paths in the report.

**Done when:** `lint:contrast` passes with its self-test, and the screenshots show no dark text on a colored fill and no white text on a light background.

---

## P2. Fetch-models check in the real app (Part D)

1. In a scratch store, set the agy path in Agent Accounts to a file that does not exist. Press the fetch button in all three places: the model picker, the pipeline recovery modal and the debate settings modal. Screenshot the red message and the Retry button.
2. Point the agy path to a small `.cmd` file that runs `exit /b 1` after printing to stderr. Screenshot the message with the code and the stderr line.
3. **Timeout with `.cmd`:** `kill_on_drop` kills only `cmd.exe`, so a hung `agy` child keeps running. Kill the whole process tree on timeout (reuse `kill_process_tree` from `discussion/runner.rs`). Add a test: a `.cmd` that starts a long `ping`, then check that no child process is left after the timeout.

---

## P3. Small fixes

1. In `ab_harness.rs`, the cost estimate ignores reasoning tokens. In the fixture, `totalTokens` is larger than prompt plus completion: 3541 vs 2550, and 4345 vs 3422. Count reasoning at the output price.
2. The fixture's prompt tokens (505, 1305, 1613) look like the old 3.8 chars/token estimate, which under-counts Arabic about 2.6 times. Say where each number comes from:
   - `reported`: provider-reported, taken from a log, with the file and line
   - `estimated`: estimated, with the method used

---

## P4. Redo the A/B harness (Part E)

The Patch 2 harness does not drive FlyMD:

- It never calls `DiscussionOrchestrator` or `MockProvider`.
- The turn text is written by hand in the harness.
- "Classic" is simulated as `lines().take(5)`, which is not the real ledger.
- `missing_reported` is hard-coded (`if is_board { 0 } else { 2 }`).
- Both arms print the same tokens and cost, copied from the fixture.
- The budget gate only refuses a zero budget. It never stops when spending reaches the limit, and there is no path for a paid run.
- The model prices have no source.

**Required:**

1. **Real turn text.** Put the real fly12 turn 1 and turn 2 texts in the fixture, from `disc-1793735767139` (copy the transcript text, not a summary).
2. **Drive the real orchestrator.** In each arm (`classic`, then `board`), run a real `DiscussionOrchestrator` with `MockProvider`. The mock returns those real texts as the agents' replies.
3. **Score what FlyMD builds.** Capture the exact prompt FlyMD builds for the next turn: the classic ledger in one arm, the board snapshot and cards in the other. Score the 16 facts on that prompt. Count its tokens with the script-aware estimator, and mark them `estimated`.
4. **No fake checks in dry-run.** Reply language and "reported missing" cannot be measured with a mock. Print `n/a (dry-run)`, not a number.
5. **Paid path, written but not run.** Add an `#[ignore]` test (or a binary behind a flag) that uses the real providers, with `FLYMD_AB_PAID=1` and `FLYMD_AB_BUDGET_USD=<x>`:
   - Add up provider-reported `cost_usd` after each turn. Stop before the next turn when the running total plus the estimate for that turn would pass the budget.
   - Write every turn's reported usage to a JSONL file.
   - Unit-test the stop rule with fake costs.
6. **Sourced prices.** Take prices from the providers' public pricing pages, and write each URL and the date you read it in a comment. If you cannot check a price, mark it "unverified" in the output.
7. **Assertions.** The dry-run test may assert only things the code computed, for example that the classic prompt is shorter than the full transcript, or that the board snapshot contains claim IDs. Never assert a fixed score like 16/16.

**Done when:**

- The dry run prints two different prompts and two different token counts that come from FlyMD's own code.
- The fact scores come from those prompts.
- The output says "SIMULATED, not a result".

---

## P5. Report cleanup

- In the old sections of `TOKEN_CONTEXT_REPORT.md`, delete or strike every claim that is no longer true. These are sections 7.5 and 8: `$3.91`, "default to `contextMode: 'board'`", "~52% measured" and "Passes all 6 criteria". The Patch 2 summary says this was done, but it was not.
- Correct the Patch 2 section: "42 fixed" is wrong (34 were fixed and 8 were left), "lint passes" is wrong, and "headless" is wrong.

---

## 6. Checks before the report

- `cargo test --lib` in `src-tauri`
- `npm run typecheck`, `npm run test:round-plan`, `npm run lint:contrast`
- Golden tests unchanged in classic mode
- Screenshots (P1.5) and the real-app fetch-error check (P2), with paths

**Stop after P5 and report.**
