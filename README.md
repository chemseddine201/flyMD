# FlyMD v2.3 🪶

[English](#-english) • [العربية](#-العربية)

---

# 🇬🇧 English

> **Ultra-lightweight Tauri v2 + Rust Markdown Supervisor, Native Multi-Agent Studio, Evidence-Graded Debate Engine & Role-Aware Epistemic Cache Handoff Hub.**

[![Version: 2.3.0](https://img.shields.io/badge/Version-2.3.0-purple.svg)](CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Framework: Tauri v2](https://img.shields.io/badge/Runtime-Tauri_v2_(Rust)-orange.svg)](https://tauri.app)
[![Multi-Agent Studio](https://img.shields.io/badge/Multi--Agent-Studio_%26_Debate_Hub-6366f1.svg)](#-whats-new-in-flymd-v210)
[![RAM Usage: ~35 MB](https://img.shields.io/badge/Memory_Footprint-~35_MB_RAM-brightgreen.svg)](#-performance--footprint)

---

## 💡 The Problem & Why FlyMD Exists

Modern AI-assisted engineering relies on multiple coding agents and models (Claude Code, OpenAI Codex, Gemini CLI, Ollama local models, DeepSeek, Antigravity, Cursor), creating two major bottlenecks:
1. **IDE Tab Fatigue & Unsupervised Artifacts**: Agents continuously generate Markdown plans, RFCs, walkthroughs, and multi-file code deliverables across nested directories. Reading and tracking them inside your primary code editor fragments focus.
2. **High-Cost, Disconnected Multi-Agent Workflows**: Running multiple models sequentially or in debates normally forces every agent to re-scan the entire codebase from scratch (burning 65%+ redundant tokens) while blindly trusting upstream prose self-summaries ("everything works!") that let bugs slip past reviewers.

### The FlyMD v2.1 Solution
**FlyMD v2.1** combines a **zero-distraction side-screen workspace supervisor & Markdown studio** with a **native Rust Multi-Agent Deliberation & Pipeline Orchestrator**:
- **Supervise Any Workspace Live**: Watch `.md` documentation by default — or opt-in to supervise full codebases (`.ts`, `.rs`, `.py`, `.html`, `.css`, `.js`, `.json`, etc.) via the configurable **Extensions Picker**.
- **Orchestrate Heterogeneous Agents**: Run structured multi-round **Evidence-Graded Debates** and sequential **Plan → Build → Review → Fix Pipelines** across CLI agents, Ollama local models, and cloud APIs inside a native 3-pane studio.
- **Move Comprehension, Prevent Bias**: Share prefix-pinned KV caches and SHA-256 verified **Cognitive Handoff Packets** across models to slash latency and API cost, while enforcing **Blind Independent Audits** on `Critic` / `Review` roles so verification agents inspect raw code diffs and form independent conclusions first.

---

## 🚀 What's New in FlyMD v2.3.0 (Stable)

### 1. Early Debate Convergence on Successive Summaries (Zero Wasted Queries)
- **Automatic Consensus Detection**: Detects equivalent summaries (`>= 0.82` similarity) between successive agents in a round or across round boundaries with zero newly opened disputes, immediately skipping remaining turns in the round and all subsequent scheduled rounds.
- **Skipped Turns & Escaped Steps Ledger**: Full untrimmed details captured for every executed step. Escaped steps within a converged round are recorded as `SkippedConsensus` (0 queries), and remaining rounds are locked as Duplicated / Ignored.

### 2. Dynamic Subscription-Aware Agent & Model Discovery
- **Zero Static Hardcoded Dropdowns**: Dynamically probes connected CLI agents (`claude`, `agy`, `opencode`, `codex`, `cursor`, `zcode`), HTTP endpoints, live Ollama models, and custom user agents.
- **Subscription Entitlement Filtering**: Automatically respects user subscription tiers (`Pro`, `Advanced`, `Plus`, `Team`, `Local`) from credentials to unlock corresponding frontier models and reasoning effort ceilings.

### 3. Untrimmed Collapsible Reports with Locked Ignored Rounds
- **Clean Untrimmed Markdown**: Consensus reports render 100% full, untrimmed markdown with zero 3-line or 240-char truncation limits.
- **Collapsed by Default with Seamless Expansion**: Executed rounds render in clean disclosure cards collapsed by default for executive readability, expandable on click; ignored rounds remain strictly locked.

### 4. Multi-Engine Selection, Round Repeater & Specialist Roles Library
- **Multi-Engine Subscription Pool**: Select multiple AI engines simultaneously to debate collaboratively, rotated automatically across participating agents.
- **Debate Round Repeater & Per-Round Splits**: Cycle repeater mode and per-round split mode with 1-click auto-distribution of engines and roles.
- **Unlimited Specialist Roles Library**: Built-in specialist roles plus full UI CRUD for user-defined custom roles with experience profiles, directives, and custom skill bindings.

### 5. Full Dual-Theme Parity & UI Elevation
- **Universal Theme Adaptation Across All 10 Themes**: Pure Clean White (`clean-white`), GitHub Light (`light`), Warm Sepia (`sepia`), Dark, Tokyo Night, Catppuccin Macchiato, Dracula Dark, Cyberpunk Neon, High Contrast (WCAG AAA), and System Default.
- **Zero Dark Islands**: Agent Studio, Projects Tree, Live Progress Inspector, Chat Composer, Bottom Dock, and AI Translation Suite dynamically adopt pure clean white or dark theme palettes without hardcoded dark background locks.
- **Immediate Theme Transition Indicator**: Responsive floating badge (`Applying [Theme Name]...` with spinner) provides instantaneous feedback on theme toggle alongside distinct Lucide icons for every theme.

### 6. Streamlined Studio Navigation & Deliberation Focus
- **Minimal Top Studio Controller**: Eliminated the redundant secondary toolbar button, keeping a single streamlined button on the top window title bar.
- **Default Stage 1 (Debate) Focus**: Initial studio entrance automatically opens focused directly on Multi-Agent Deliberation & Debate rather than the pipeline executor.

### 7. Deliberation Lifecycle: Failure Recovery, Round Pause/Resume & In-Flight Configuration
- **Deterministic Healing & Resumption**: Automatically heals sessions on turn failures (CLI crash, timeout, rate limit 429) without discarding completed rounds; surfaces a prominent **"Resume & Retry Turn"** action card to re-execute the failed turn.
- **Round-Level Barrier Synchronization**: Configurable `pauseAtRoundBoundary` toggle to pause deliberation cleanly after each round for human audit of consensus and dispute ledgers.
- **Sidebar Details & In-Flight Future-Round Editor**: Side-by-side inspect icon in the deliberation sidebar opens the configuration inspector. Historical and active rounds ($\le \text{currentRound}$) remain strictly immutable, while upcoming rounds ($> \text{currentRound}$) allow swapping models, adjusting reasoning effort, and modifying directives when paused or failed, guarded by the Unsaved Changes alert.

---

## 🚀 What's New in FlyMD v2.2.0 (Stable)

### 1. Token Usage Telemetry & Quota Governance HUD
- **Explicit Reasoning Token Telemetry**: Real-time breakdown of Prompt, Completion, and Reasoning/Thinking tokens across every agent task, cognitive handoff, and deliberation turn card.
- **Studio Token Quota HUD**: Status indicator with adaptive threshold coloring (Sky < 80%, Amber 80–99%, Rose >= 100%), session budget presets (Unlimited, 25k, 50k, 100k, 250k), and boundary pause policy toggles.
- **Safe Boundary Quota Guards**: Safe pause at step/turn boundaries when budgets are exceeded, allowing users to override and continue without risking mid-write file truncation or using OS process monitors.

### 2. Custom Skills Injection & Tool Isolation Switch
- **Connect Arbitrary Skills Folders**: Point FlyMD deliberations to external directories containing `SKILL.md` or standalone markdown competencies.
- **Interactive Tool Isolation Switch**: Choose between Shared Mode (custom skills augment built-ins) and Isolated Mode (strict domain isolation).

### 3. Context-Aware Smart Deliverable File Naming
- **Semantic Auto-Naming**: Generates structured deliverable filenames `[Project]_[SubProject]_[Topic]_[Kind].md` replacing generic plan/report names.
- **Multilingual Arabic-to-English Transliteration**: Translates Arabic project and topic titles into clean, filesystem-safe ASCII slugs with collision-free `-v2.md`, `-v3.md` sequencing.

### 4. Subscription-Aware Model Selection & Dynamic Effort Matrix
- **Tiered Model Catalog**: Tailored presets for Claude (Pro/Team/Max), OpenAI, Gemini, DeepSeek, and local Ollama catalogs.
- **Side-by-Side Model & Effort Matrix**: Dynamic UI adapting available effort levels (`low`, `medium`, `high`, `xhigh`, `max`) and thinking toggles according to the exact model selected.

---

## 🛠️ Previous Features in FlyMD v2.1.0

### 1. Per-Agent Reasoning Effort & Thinking Controls
- **Granular Effort Levels**: Choose `low`, `medium`, or `high` reasoning effort per pipeline step, per debate participant, and direct agent dispatch. Save tokens on simple generation tasks or deploy high-intensity reasoning for complex architecture and debugging.
- **Thinking Mode Toggle**: Dedicated switch to enable or disable chain-of-thought (thinking) tokens across supported reasoning models (DeepSeek R1, Claude 3.7 Sonnet, Gemini 2.0 Flash Thinking).
- **Safe Fallback & Auto-Recovery**: Models or providers lacking custom reasoning effort gracefully default to `medium`. If an API endpoint returns an unsupported parameter error, FlyMD automatically strips the parameter and retries seamlessly without user intervention or workflow failure.

### 2. Interactive Workspace Memory Reset & File Tabs Management
- **Full Control Memory Reset Dialog**: Comprehensive modal dialog with default-checked options allowing users to selectively clear:
  - Active multi-agent debate sessions & transcripts.
  - 12-section evidence reports and synthesis markdown files.
  - Pipeline execution state and step run history.
  - Cross-model cognitive handoffs, SHA-256 digests, and cached index envelopes.
- **Smart Tab Cleanup**: Automatically identifies and closes workspace editor tabs associated with cleared discussions and reports.

### 3. Interactive Project & Sub-Project Deletion Modal
- **Granular Deletion Modals**: Safely delete projects or sub-projects with default-checked options to purge associated `.flymd` memory, cognitive caches, logs, and transcripts, with an optional toggle for deleting physical workspace files.

### 4. Multi-Agent Deliberation Lifecycle Safeguards
- **Sequence-Guarded Store Synchronization (`activeSyncSequence`)**: Eliminates race conditions and UI freezes (such as staying stuck on `RUNNING` in Phase 3 while backend is complete) by discarding out-of-order IPC responses during rapid token streaming.
- **In-Memory Supervisor Eviction**: The Rust supervisor (`commands.rs`) promptly releases terminal sessions (`AwaitingReview`, `Completed`, `Failed`, `Cancelled`) from memory, preventing memory leaks and stale state locks.
- **Reconciliation Heartbeat Guard**: Active 2.5s heartbeat timer in `DiscussionStudio.tsx` ensures the UI is 100% synchronized with on-disk state even if push events are lagged or dropped.
- **Settlement Detector & Deliverable Verification Hardening**: Code generation tasks (`build`, `fix-bugs`) verify on-disk code modifications prior to task settlement, preventing 0-byte overwrites and stub deliverables.

---

## 🆕 What's New in FlyMD v2.0.0

### 1. Native 3-Pane Multi-Agent Studio & Autonomous Pipeline (`AgentsControlCenter`)
- **IDE-Grade 3-Pane Layout**:
  - **Collapsible & Closable Projects Sidebar**: Navigate Master Projects and nested Sub-Projects like a native IDE explorer.
  - **Workflow Pipeline & Chat Composer**: Multi-step repeatable workflow bar with icon-driven controls, 3-row auto-expanding prompt composer, image attachments, `Enter` for newline / `Ctrl + Enter` to dispatch, and custom roles/actions library.
  - **Resizable Live Progress & Action Logs Inspector**: Drag-resizable inspector displaying Antigravity-style grouped action accordions, live file creation/modification badges, active heartbeat telemetry, and non-blocking concurrent CLI stream logs.
- **Auto & Manual Step Orchestration**:
  - Chain `plan` → `build` → `review` → `fix-bugs` → `explain` (or custom steps) across different models per step.
  - Visual execution states: pulsing indicator on the active step, emerald badges on completed steps, and strict pipeline state guards preventing accidental edits, deletions, or resets while running (with confirmation prompts when resetting paused/cancelled steps).
- **Universal Provider Discovery & WebAuth**:
  - Auto-discovers installed CLI tools (`claude-code`, `codex`, `gemini-cli`, `aider`, and custom CLI binaries), local `Ollama` models, and OpenAI / Anthropic / DeepSeek HTTP endpoints, plus built-in System-Browser WebAuth & CLI console login helpers.
- **Process Tree Safety & Deliverable Settlement**:
  - Targeted Windows child process-tree termination (`taskkill /T /F` strictly scoped to spawned child PIDs), self-healing workspace locks, dynamic file-diff tracking, and companion web deliverable verification (`HTML` + `CSS` + `JS`) eliminating premature process kills and pipeline stalls.

### 2. Multi-Agent Deliberation & Evidence-Graded Debate Studio
- **Role-Divergent Multi-Round State Machine**:
  - Run structured multi-round debates across specialized personas (`Moderator`, `Architect`, `Implementer`, `Critic`, `Auditor`, `DomainExpert`, plus custom roles) with Preset Engine selectors, Thinking Mode, active TCP provider health checks, graceful turn error recovery, and per-turn zoom scaling.
  - **Human-in-the-Loop Steering**: Pause, resume, or inject targeted `@Role` probes mid-deliberation without losing round state.
- **12-Section Evidence-Graded Final Report Synthesizer**:
  - Synthesizes multi-agent deliberations into versioned, secret-redacted 12-section Markdown reports covering executive summary, architectural consensus, trade-off matrices, risk registries, disputed claims, and actionable implementation blueprints.
- **Closed-Loop Lifecycle & Bidirectional Recycling**:
  - Send any Debate Final Report directly into the **Studio Pipeline** for autonomous code implementation with one click, and recycle Pipeline execution results or review findings back into follow-up Deliberation rounds.
- **Canonical Skills Manager**:
  - Loads workspace and global agent skills with canonical URI resolution, precedence overrides, and strict read-only workspace sandboxing during debate turns.

### 3. Multi-Agent Cache Mobility, Peer Messaging Bus & Role-Aware Epistemic Handoff
FlyMD v2.0 introduces a 3-tier Rust architecture (`projects/cache.rs`, `discussion/epistemic.rs`, `discussion/memory.rs`) to maximize inter-agent communication bandwidth while minimizing token cost and confirmation bias:

| Tier | Mechanism | Impact |
| :--- | :--- | :--- |
| **Tier 1: Prefix-Pinned Hardware KV Cache** | Pins 100% shared immutable protocol + workspace SHA-256 index at Token 0 (`shared_prefix.md`), appends frozen round ledgers (`round_{r}_ledger.md`), emits Anthropic `cache_control: {"type": "ephemeral"}`, and holds Ollama VRAM slots warm via `"keep_alive": "15m"`. | **~65% fewer prompt tokens**, up to **85% lower cached API cost**, and **8x–15x faster local Ollama TTFT**. |
| **Tier 2: Cross-Model Cognitive Handoff Packet** | Persists `.flymd/cache/cognitive_state.json` containing FIPS 180-4 SHA-256 file hashes, line counts, DOM `#id` contracts, exported code symbols, locked architectural invariants, and a Direct `@Role` Peer Messaging Bus (`peer_bus.json`). | Heterogeneous models (`Claude` ↔ `Ollama` ↔ `Codex` ↔ `Gemini`) inherit structured workspace comprehension without redundant repo re-scans. |
| **Tier 3: Role-Aware Epistemic Router** | Routes `Implementer` / `build` / `explain` via **`DirectInherit` / `DeltaVerify`** (plus consecutive `claude-code -c` warm session reuse with stateless `-p` fallback), while forcing **`BlindIndependentAudit` / `GroundTruthRebuild`** on `Critic` / `Auditor` / `review` / `fix-bugs` or any of 5 drift/dispute triggers. | Reviewers receive raw disk code slices **without** upstream subjective prose self-summaries and must emit `<independent_resume>` before rendering judgment. |

### 4. Hierarchical Projects Tree & Dual-Layer Memory (`.flymd/`)
- **Master Projects & Sub-Projects**: Structure complex initiatives into hierarchical project trees. Automatically defaults to your currently opened workspace folder or CWD (with an optional native folder picker) and initializes project storage safely on disk.
- **Dual-Layer Persistent Memory**: Combines workspace-wide memory with scoped project memory (`MEMORY.md`, task checkpoints, and cognitive state cache), hardened with UTF-8 multi-byte character-boundary slicing (safe for Arabic/RTL and CJK text) and one-click **Clear Memory & Cache**.

### 5. Configurable Multi-Extension Workspace Supervision
- **Interactive Extensions Picker**: Choose which file extensions FlyMD supervises whenever you open a folder (`Ctrl + Shift + O`) or at any time inside **Settings**.
- **Markdown-First Default, Full-Stack Ready**: Defaults to `.md` / `.markdown` to keep side-screen reading clean, with instant presets and custom chips for Web, Backend, Data, and Systems files (`.html`, `.css`, `.js`, `.ts`, `.tsx`, `.json`, `.py`, `.rs`, `.php`, `.sql`, `.yaml`, `.toml`, etc.) synced live to the native Rust `notify` watcher.

---

## ✨ Core Foundation Features (v1 + v2)

### 1. Live Folder Supervision & Auto-Capture
- **Native Rust File Watcher (`notify`)**: Recursively monitors supervised extensions across your workspace in real time.
- **Zero-Focus-Steal Background Tabs**: Newly generated files open automatically in background tabs with a pulsing emerald badge that clears 5 seconds after interaction.

### 2. Multi-Tab Workspace & Rich Editor Modes
- **Desktop Tab Context Menu**: Close, Close Others, Close to the Right, and Close All with optional "Do Not Ask Me Again" confirmation.
- **Three Viewing Modes**: **Preview Only**, **Split View** (CodeMirror 6 + draggable live preview), and **WYSIWYG Mode**, plus an interactive **Document Outline** drawer.
- **Full Markdown Ecosystem**: GitHub-Flavored Markdown, KaTeX math (`$E=mc^2$` and `$$...$$`), Mermaid diagrams, syntax-highlighted code blocks with copy buttons, and automatic/manual RTL & LTR toggle (`Ctrl + Shift + D`).

### 3. Interactive Flowchart Lightbox, Zoom Pill & Width Switcher
- Click any Mermaid diagram for full-screen pan/zoom inspection and one-click **SVG / High-Res PNG export**.
- Floating preview controls pill (`+` / `-` / `15px` reset) and layout width switcher (**Standard 896px**, **Wide 1280px**, **Full Width 100%**).

### 4. 8 Open-Source Themes, Accessibility Suite & Floating Drop Hub
- **8 Themes**: GitHub Dark, GitHub Light, Tokyo Night, Catppuccin Mocha, Dracula Official, Warm Sepia, Cyberpunk Neon, and WCAG AAA High Contrast.
- **Accessibility Suite**: Dyslexia-friendly typography, 1.25x Large Print mode, Reduced Motion, and Color-Blind Safe `[NEW]` badges.
- **Local AI Translation & Floating Circular Drop Hub**: Streamed multi-language translation (Arabic, English, French, German, Spanish) via Ollama/OpenAI endpoints, plus a 140px Always-on-Top desktop drop widget.

---

## 📊 Performance & Footprint

| Metric | Electron (Standard) | Electron (Optimized) | **FlyMD v2.0 (Tauri v2 + Rust)** |
|---|---|---|---|
| **NSIS Installer Size** | ~85 MB | ~65 MB | **~5.4 MB** |
| **Portable Standalone Binary** | ~170 MB | ~110 MB | **~14.8 MB** |
| **Idle Memory (RAM)** | ~180 MB | ~110 MB | **~30 - 38 MB** |
| **Cold Startup Time** | ~1.8s | ~1.2s | **< 280 ms** |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + O` | Open File Dialog |
| `Ctrl + Shift + O` | Open Folder & Configure Supervised Extensions |
| `Ctrl + N` | New Document Tab |
| `Ctrl + W` | Close Active Tab |
| `Ctrl + S` | Save Current File |
| `Ctrl + Shift + S` | Save As Dialog |
| `Ctrl + B` | Toggle Project Explorer Sidebar |
| `Ctrl + T` | Open Translation / LLM Dialog |
| `Ctrl + Shift + D` | Toggle Text Direction (Auto / RTL / LTR) |

---

## 🚀 Getting Started & Building From Source

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Rust toolchain](https://www.rust-lang.org/) (`cargo` & `rustc` v1.75+)
- Windows 10 / 11 (64-bit) with WebView2 Runtime (pre-installed)

### Development & Tests
```bash
# Clone the repository
git clone https://github.com/chemseddine201/flyMD.git
cd flyMD

# Install dependencies
npm install

# Run Rust backend test suite (38 unit & integration tests)
cargo test --manifest-path src-tauri/Cargo.toml

# Run in development mode (Vite + Tauri)
npm run tauri:dev
```

### Production Build (Installer + Portable)
```bash
# Build frontend and compile native release binary + Windows NSIS installer
npm run tauri:build
```
Compiled release artifacts:
- **Installable Setup**: `src-tauri/target/release/bundle/nsis/FlyMD_2.0.0_x64-setup.exe`
- **Portable Executable**: `src-tauri/target/release/fly-md-tauri.exe` (`FlyMD_2.0.0_x64-portable.exe`)

---

# 🇸🇦 العربية

> **منصة سطح مكتب فائقة الخفة مبنية بـ Tauri v2 + Rust لمراقبة المشاريع وعرض ملفات Markdown، مدعومة باستوديو الوكلاء المتعددين (Multi-Agent Studio)، ومحرك المناظرات الهندسية، ونظام نقل الذاكرة المعرفية الذكي بين النماذج.**

---

## 💡 المشكلة البرمجية وما يقدمه الإصدار الثاني FlyMD v2.0

أثناء تطوير البرمجيات الحديثة بالاعتماد على عدة وكلاء ونماذج ذكاء اصطناعي (مثل Claude Code، Codex، Gemini CLI، نماذج Ollama المحلية، وAntigravity)، يواجه المطور تحديين رئيسيين:
1. **تشتت التركيز وتراكم الملفات داخل محرر الأكواد**: كثرة ملفات التخطيط والتقارير والملفات البرمجية المولدة تجعل متابعتها داخل بيئة التطوير الرئيسية مرهقة ومشتتة للانتباه.
2. **ارتفاع التكلفة وضعف التواصل بين النماذج المتعددة**: تشغيل عدة نماذج بالتتابع في خط عمل (Pipeline) أو في مناظرة (Debate) يجبر كل نموذج عادةً على إعادة قراءة جميع ملفات المشروع من الصفر (مما يهدر أكثر من 65% من التوكنز والوقت)، أو يجعله يثق ثقة عمياء في ملخصات الوكيل السابق دون تدقيق فعلي للشيفرة البرمجية.

### الحل المتكامل في FlyMD v2.0
يجمع **FlyMD v2.0** بين خفة عارض ومراقب الملفات الجانبي وبين **غرفة عمليات متكاملة لإدارة وتنسيق وكلاء الذكاء الاصطناعي**:
- **مراقبة حية قابلة للتخصيص**: مراقبة ملفات `.md` افتراضياً بدون تشويش، مع منتقي امتدادات مرن يسمح بمراقبة ملفات الكود الكاملة (`.html`, `.css`, `.js`, `.ts`, `.rs`, `.py`, `.php` وغيرها).
- **تناغم كامل بين الوكلاء المحليين والسحابيين**: إدارة جلسات المناظرات الهندسية متعددة الجولات وخطوط التنفيذ التلقائية أو اليدوية (`Plan → Build → Review → Fix`) عبر واجهة احترافية ثلاثية الألواح.
- **نقل الفهم المعرفي ومنع الانحياز التأكيدي**: مشاركة ذاكرة الـ KV Cache وحزم الفهم الموثقة ببصمات `SHA-256` بين النماذج المختلفة لتقليل التكلفة وتسريع الاستجابة، مع فرض **المراجعة المستقلة العمياء (Blind Independent Audit)** على وكلاء التدقيق والمراجعة لقراءة الكود الفعلي واستنتاج خلاصتهم بأنفسهم.

---

## 🚀 الجديد في الإصدار FlyMD v2.1.0 (النسخة المستقرة)

### 1. التحكم الدقيق في جهد التفكير ووضع التفكير العميق (Reasoning Effort & Thinking Controls)
- **مستويات الجهد المخصصة**: اختيار مستوى الجهد (`low`, `medium`, `high`) لكل خطوة في خط العمل، ولكل مشارك في المناظرة، وعند إرسال التوجيهات المباشرة، مما يتيح توفير التوكنز في المهام البسيطة أو استدعاء كامل طاقة التفكير في المهام المعقدة.
- **تبديل وضع التفكير (Thinking Mode)**: زر مخصص لتفعيل أو تعطيل سلاسل الأفكار التفكيرية للنماذج الداعمة (مثل DeepSeek R1 وClaude 3.7 Sonnet وGemini 2.0 Flash Thinking).
- **الرجوع الآمن والتعافي التلقائي**: النماذج التي لا تدعم معلمات الجهد تعود تلقائياً وبأمان إلى الخيار المتوسط `medium`. وإذا رفض المزود أي معلمة تفكير، يتعامل النظام تلقائياً مع الخطأ ويعيد المحاولة بسلاسة بدون توقف خط العمل.

### 2. نافذة تفاعلية شاملة لمسح الذاكرة وإدارة التبويبات المفتوحة
- **مسح ذكي بخيارات متعددة**: نافذة تفاعلية تتيح للمستخدم تحديد ما يرغب في تنظيفه بخيارات مفعلة افتراضياً:
  - جلسات وسجلات المناظرات الجارية والتاريخية.
  - تقارير الأدلة النهائية المكونة من 12 قسماً.
  - سجل وحالات تنفيذ خط العمل (Pipeline).
  - حزم التسليم المعرفي (Cognitive Handoff) وبصمات SHA-256 وذاكرة الفهارس.
- **إغلاق تلقائي للتبويبات المرتبطة**: يتعرف النظام تلقائياً على تبويبات المحرر المفتوحة التابعة للجلسات والتقارير الممسوحة ويغلقها فوراً للحفاظ على ترتيب مساحة العمل.

### 3. نافذة تفاعلية لحذف المشاريع والمشاريع الفرعية
- نافذة حذف آمنة مزودة بخيارات محددة مسبقاً لتنظيف ذاكرة `.flymd` المخصصة للمشروع، وسجلات التتبع، والملفات المؤقتة، مع خيار إضافي لحذف الملفات المادية من القرص.

### 4. حماية وتثبيت دورة حياة المناظرات المتعددة
- **مزامنة الحالة المتسلسلة والمحمية (`activeSyncSequence`)**: القضاء التام على مشكلة تجمد الواجهة في المرحلة الثالثة أثناء التدفق الكثيف لتوكنز التفكير، وتجاهل أي استجابات قديمة تصل بترتيب غير متزامن.
- **تنظيف المشرف في الذاكرة**: إخلاء فوري للجلسات المكتملة أو الملغاة أو الفاشلة من جدول الذاكرة المشترك في Rust.
- **مراقب نبضات ذاتي الإصلاح (Reconciliation Heartbeat)**: مؤقت فحص دوري كل 2.5 ثانية يضمن التطابق التام 100% بين الواجهة والقرص حتى لو تأخرت أو فُقدت أحداث الـ IPC.
- **التحقق المشفر من تعديل الملفات البرمجية**: منع التوقف المبكر وضمان تعديل ملفات الكود الحقيقية قبل اعتبار خطوات البناء والإصلاح مكتملة.

---

## 🆕 أبرز الإضافات والمميزات الجديدة في الإصدار FlyMD v2.0.0

### 1. استوديو الوكلاء المتعددين وخطوط العمل الذكية (Multi-Agent Studio & Pipeline)
- **تصميم ثلاثي الألواح قابل للتخصيص**:
  - **شجرة مشاريع جانبية قابلة للطي والإغلاق**: إدارة المشاريع الرئيسية والفرعية بمرونة تامة.
  - **لوحة خطوات العمل ومؤلف المحادثة المتقدم**: أزرار خطوات أيقونية واضحة، صندوق إدخال ثلاثي الأسطر يدعم إرفاق الصور، وإضافة أدوار وإجراءات مخصصة.
  - **لوحة التقدم الحي وسجلات العمليات القابلة لتغيير الحجم**: سحب الفاصل يميناً أو يساراً لمتابعة سجلات التنفيذ اللحظية، والملفات المنشأة أو المعدلة، ونبضات النشاط الحية.
- **التنفيذ التلقائي واليدوي المحمي**:
  - ربط خطوات التخطيط والبناء والمراجعة وإصلاح الأخطاء عبر نماذج مختلفة، مع مؤشرات لونية نابضة للخطوة الجارية، وعلامات خضراء للمكتملة، وقفل ذكي يمنع الحذف أو التعديل العرضي أثناء التشغيل إلا بعد الإيقاف المؤقت أو الإلغاء.
- **اكتشاف شامل للوكلاء وتسجيل دخول WebAuth**:
  - دعم وكلاء سطر الأوامر (`claude-code`, `codex`, `gemini-cli`, `aider`) ونماذج `Ollama` المحلية وواجهات OpenAI / Anthropic / DeepSeek، مع دعم المصادقة السريعة عبر المتصفح.
- **إدارة آمنة للعمليات وضمان اكتمال ملفات الكود**:
  - إغلاق دقيق لشجرة العمليات الفرعية في ويندوز دون المساس بالعمليات الأخرى، وأقفال ذاتية الإصلاح، وضمان توليد الملفات البرمجية المتكاملة (`HTML` + `CSS` + `JS`) ومنع التوقف عند 92%.

### 2. استوديو المناظرات الهندسية والتقارير المحكّمة بالأدلة (Debate Studio)
- **مناظرات متعددة الجولات والأدوار**:
  - إدارة نقاشات معمقة بين أدوار متخصصة (`Moderator`, `Architect`, `Implementer`, `Critic`, `Auditor`, `DomainExpert`) مع دعم وضع التفكير العميق (Thinking Mode)، وفحص اتصال المزودين عبر TCP، وتوجيه أسئلة مباشرة `@Role` أثناء الجلسة.
- **مُركّب التقارير النهائية المكون من 12 قسماً**:
  - توليد تقارير معمارية مفصلة ومؤرشفة بالإصدارات مع إخفاء تلقائي للمفاتيح السرية، تشمل القرارات المتفق عليها، مصفوفة المخاطر، نقاط الخلاف، وخطة التنفيذ.
- **دورة حياة مغلقة وإعادة تدوير ثنائية الاتجاه**:
  - تحويل مخرجات المناظرة مباشرة إلى خط تنفيذ برمجي في الاستوديو بضغطة زر، أو إعادة إرسال نتائج التنفيذ والمراجعة إلى جولة مناظرة جديدة.

### 3. نقل الذاكرة المعرفية والتوجيه الإبستمولوجي حسب الدور (3-Tier Cache & Epistemic Handoff)
يقدم الإصدار الثاني بنية ثلاثية الطبقات لتعزيز التواصل بين النماذج وتقليل التكلفة:
1. **الطبقة الأولى — تثبيت بادئة ذاكرة الـ KV Cache**: تثبيت السياق المشترك وفهرس الملفات في بداية التوكنز (`Token 0`) مع سجلات جولات مجمدة، وتفعيل `cache_control` لـ Anthropic و`keep_alive: "15m"` لـ Ollama، مما يوفر **نحو 65% من التوكنز** ويسرّع استجابة النماذج المحلية **8 إلى 15 ضعفاً**.
2. **الطبقة الثانية — حزمة التسليم المعرفي العابرة للنماذج (`CognitiveHandoffPacket`)**: حفظ حالة الفهم الموثقة ببصمات `SHA-256` والرموز البرمجية وعقود واجهة `DOM` وقناة الرسائل المباشرة `@Role` داخل `.flymd/cache/cognitive_state.json` لنقل الفهم فوراً من نموذج لآخر دون إعادة مسح المجلدات.
3. **الطبقة الثالثة — الموجّه الإبستمولوجي والمراجعة المستقلة العمياء**:
   - أدوار البناء والتنفيذ (`Implementer` / `build`) ترث الفهم الموثق مباشرة مع دعم استمرار جلسة `claude-code -c` لتوفير الوقت والتكلفة.
   - أدوار النقد والتدقيق وإصلاح الأخطاء (`Critic` / `Auditor` / `review` / `fix-bugs`) أو عند تغير بصمة أي ملف على القرص تُجبر تلقائياً على **المراجعة المستقلة العمياء (`BlindIndependentAudit`)**: حيث تُحجب الملخصات الإنشائية للوكيل السابق وتُحقن مقاطع الكود الحقيقية من القرص مباشرة ليكوّن المراجع استنتاجه المستقل `<independent_resume>` بنفسه قبل إصدار الحكم.

### 4. شجرة المشاريع الهرمية والذاكرة المزدوجة الآمنة
- **مشاريع رئيسية وفرعية**: تنظيم العمل في شجرة مشاريع متداخلة تعتمد تلقائياً على المجلد المفتوح حالياً (مع منتقي مجلدات مدمج) دون الحاجة لإدخال المسارات يدوياً.
- **ذاكرة مزدوجة آمنة للغة العربية (`UTF-8 Safe`)**: ذاكرة عامة للمساحة وذاكرة خاصة لكل مشروع داخل `.flymd/` مع معالجة دقيقة لحدود محارف UTF-8 متعددة البايتات، وزر مسح شامل للذاكرة والكاش.

### 5. منتقي امتدادات الملفات المراقبة (Supervised Extensions Picker)
- إمكانية تحديد أنواع الملفات المسموح بمراقبتها عند فتح أي مجلد (`Ctrl + Shift + O`) أو من لوحة **الإعدادات (Settings)**.
- الوضع الافتراضي يقتصر على `.md` للتركيز على الوثائق، مع إمكانية تفعيل مجموعات جاهزة أو امتدادات مخصصة لملفات البرمجة والويب والبيانات بتزامن فوري مع مراقب الملفات في Rust.

---

## ✨ المميزات الأساسية المتكاملة (الإصدار الأول + الثاني)
- **المراقبة الحية والفتح التلقائي في الخلفية** مع شارة خضراء نابضة تختفي بعد 5 ثوانٍ من التفاعل.
- **ثلاثة أوضاع تحرير وعرض**: المعاينة (Preview)، العرض المقسم (Split View مع CodeMirror 6)، والتحرير المرئي (WYSIWYG)، مع دعم معادلات KaTeX ومخططات Mermaid والاتجاه التلقائي للعربية (`Ctrl + Shift + D`).
- **عارض مخططات Mermaid التفاعلي** بملء الشاشة مع التصدير المباشر إلى SVG و PNG.
- **10 ثيمات مفتوحة المصدر مع تماثل لوني كامل** (Clean White, Light, Sepia, Dark, Tokyo Night, Catppuccin, Dracula, Cyberpunk, High Contrast WCAG AAA) واستجابة فورية لمؤشر التبديل مع تركيز تلقائي على مرحلة المناظرة.
- **الترجمة المحلية عبر Ollama والودجت الدائري العائم (140px)** لسحب وإفلات الملفات بسرعة.

---

## 🚀 التثبيت والبناء من المصدر

```bash
# استنساخ المستودع
git clone https://github.com/chemseddine201/flyMD.git
cd flyMD

# تثبيت الاعتماديات
npm install

# تشغيل اختبارات Rust (69 اختباراً آلياً)
cargo test --manifest-path src-tauri/Cargo.toml

# بناء النسخة الإنتاجية (ملف التثبيت + النسخة المحمولة)
npm run tauri:build
```

مخرجات البناء للإصدار 2.3.0:
- **نسخة التثبيت الرسمية (NSIS Installer)**: `release/FlyMD Setup 2.3.0.exe`
- **النسخة المحمولة المباشرة (Portable)**: `release/FlyMD_2.3.0_x64-portable-latest.exe` (`FlyMD_2.3.0_x64-portable.exe`)

---

## 📄 الترخيص (License)

هذا المشروع مرخص بموجب **رخصة MIT (MIT License)** — حرية كاملة في الاستخدام والتعديل والتوزيع للأغراض الشخصية والتجارية. انظر ملف [LICENSE](LICENSE) والتغييرات المفصلة في [CHANGELOG.md](CHANGELOG.md).
