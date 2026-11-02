# FlyMD v2.2.0 — Token Telemetry & Quota HUD, Custom Skills Injection, Smart Deliverable Naming, and Dual-Engine Architecture 🚀

**FlyMD v2.2.0** is a major stable release featuring real-time token telemetry with explicit reasoning token breakdowns, boundary-level quota governance guards, dynamic custom skills injection with an interactive tool isolation switch, context-aware multilingual deliverable naming, and subscription-aware side-by-side model and effort controls.

---

## 🆕 Major New Features

### 1. Token Usage Telemetry & Quota Governance HUD
- **Explicit Reasoning Token Measurement**:
  - Full telemetry separation: Prompt Tokens, Completion Tokens, and Reasoning/Thinking Tokens (Chain of Thought) across all CLI agents, HTTP providers, cognitive handoffs, and deliberation turns.
  - Transparent badges on every task and turn card showing exact token allocations (e.g. `12,450 tokens (🧠 3,200 reasoning)`).
- **Studio Token Quota HUD**:
  - Live status indicator with adaptive coloring:
    - **Sky (< 80%)**: Normal healthy burn rate.
    - **Amber (80% – 99%)**: Soft warning threshold.
    - **Rose (>= 100%)**: Quota cap breached.
  - Interactive popover with detailed Prompt vs Completion vs Reasoning metrics, workspace cumulative token counter, budget presets (Unlimited, 25k, 50k, 100k, 250k), and policy toggles.
- **Safe Boundary Quota Guards (Zero OS Process Manipulation)**:
  - Enforces budget caps safely at turn and step boundaries where markdown deliverables and ledgers have already been written to disk cleanly.
  - Pauses execution and provides an interactive step card to **Override Quota & Proceed** or adjust budgets without risking file truncation.

### 2. Custom Skills Injection & User Directory Linking
- **Configurable Skills Folder Linking**:
  - Point FlyMD deliberations to external directories containing `SKILL.md` or standalone markdown competencies.
  - Recursive directory scanner parsing YAML frontmatter tags, versions, descriptions, and replacement declarations.
- **Interactive Tool Isolation Switch**:
  - Dedicated toggle: *"Include Default Built-in Tool Skills alongside Custom Skills"*.
  - **Shared Mode**: Custom skills augment standard built-in competencies, overriding matching names or explicit `replaces` tags.
  - **Isolated Mode**: Deliberations run in strict domain isolation, omitting general built-in tools.
- **Precedence Hierarchy**:
  - `agent:` (0) > `custom:` (1) > `master:` (2) > `global:` (3).

### 3. Context-Aware Smart Deliverable File Naming
- **Semantic File Pattern**:
  - Replaces generic filenames (`IMPLEMENTATION_PLAN.md`, `final-report-v1.md`) with structured contextual slugs: `[Project]_[SubProject]_[Topic]_[Kind].md`.
- **Multilingual Arabic-to-English Transliteration**:
  - Translates Arabic semantic keywords and phonemes into clean, filesystem-safe ASCII slugs.
- **Anti-Collision Sequencing**:
  - Automatically appends `-v2.md`, `-v3.md` if an identically-named file already exists on disk.

### 4. Subscription-Aware Model Selection & Side-by-Side Effort Matrix
- **Tiered Model Catalog**:
  - Pre-configured catalogs for Claude (Pro/Team/Max), OpenAI, Gemini, DeepSeek, and local Ollama.
- **Side-by-Side Model & Effort Matrix**:
  - Integrated picker dynamically adapting available effort tiers (`low`, `medium`, `high`, `xhigh`, `max`) and thinking toggles according to the exact capabilities of the selected model.

---

## 🛠️ Architecture Hardening & Code Splitting

- **Full SRP Refactoring**:
  - Decomposed monolithic controllers into single-responsibility custom hooks and pure presenters.
  - Memoized $O(1)$ selectors and $O(\Delta)$ delta log streaming cursor.
- **UTF-8 Multibyte Crash Immunity**:
  - Safe slicing for multibyte Arabic UTF-8 strings ensuring zero panics across log tails, synthesis reports, and file names.
- **Dual Executable Releases**:
  - **FlyMD_2.2.0_x64-portable.exe**: Ultra-lightweight native Tauri v2 standalone executable (~15.7 MB).
  - **FlyMD Setup 2.2.0.exe**: Complete Windows NSIS installer (~70.7 MB).
  - **FlyMD 2.2.0.exe**: Standalone portable Electron executable (~70.3 MB).

---

## 📦 Binary Checksums (SHA-256)

```
0e863cfcc94304303ccaa7068fdff7e580c3e4256a74bad6c93af8d4aa6ef0e5 *FlyMD_2.2.0_x64-portable.exe
0e863cfcc94304303ccaa7068fdff7e580c3e4256a74bad6c93af8d4aa6ef0e5 *FlyMD_2.2.0_x64-portable-latest.exe
040a50520503cdc2054b4d2a22d5e2513e09e0ca8e8069c3fee99e1f51fcc4d0 *FlyMD 2.2.0.exe
1795509b5ae0a7768f0671697d7325a72ff24df41eb4b871624b36192069e543 *FlyMD Setup 2.2.0.exe
```
