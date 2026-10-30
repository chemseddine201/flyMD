# FlyMD v2.0 🪶

[English](#-english) • [العربية](#-العربية)

---

# 🇬🇧 English

> **Ultra-lightweight Tauri v2 + Rust Markdown Supervisor, Native Multi-Agent Studio, Evidence-Graded Debate Engine & Role-Aware Epistemic Cache Handoff Hub.**

[![Version: 2.0.1](https://img.shields.io/badge/Version-2.0.1-purple.svg)](CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Framework: Tauri v2](https://img.shields.io/badge/Runtime-Tauri_v2_(Rust)-orange.svg)](https://tauri.app)
[![Multi-Agent Studio](https://img.shields.io/badge/Multi--Agent-Studio_%26_Debate_Hub-6366f1.svg)](#-whats-new-in-flymd-v200)
[![RAM Usage: ~35 MB](https://img.shields.io/badge/Memory_Footprint-~35_MB_RAM-brightgreen.svg)](#-performance--footprint)

---

## 💡 The Problem & Why FlyMD Exists

Modern AI-assisted engineering relies on multiple coding agents and models (Claude Code, OpenAI Codex, Gemini CLI, Ollama local models, DeepSeek, Antigravity, Cursor), creating two major bottlenecks:
1. **IDE Tab Fatigue & Unsupervised Artifacts**: Agents continuously generate Markdown plans, RFCs, walkthroughs, and multi-file code deliverables across nested directories. Reading and tracking them inside your primary code editor fragments focus.
2. **High-Cost, Disconnected Multi-Agent Workflows**: Running multiple models sequentially or in debates normally forces every agent to re-scan the entire codebase from scratch (burning 65%+ redundant tokens) while blindly trusting upstream prose self-summaries ("everything works!") that let bugs slip past reviewers.

### The FlyMD v2.0 Solution
**FlyMD v2.0** combines a **zero-distraction side-screen workspace supervisor & Markdown studio** with a **native Rust Multi-Agent Deliberation & Pipeline Orchestrator**:
- **Supervise Any Workspace Live**: Watch `.md` documentation by default — or opt-in to supervise full codebases (`.ts`, `.rs`, `.py`, `.html`, `.css`, `.js`, `.json`, etc.) via the configurable **Extensions Picker**.
- **Orchestrate Heterogeneous Agents**: Run structured multi-round **Evidence-Graded Debates** and sequential **Plan → Build → Review → Fix Pipelines** across CLI agents, Ollama local models, and cloud APIs inside a native 3-pane studio.
- **Move Comprehension, Prevent Bias**: Share prefix-pinned KV caches and SHA-256 verified **Cognitive Handoff Packets** across models to slash latency and API cost, while enforcing **Blind Independent Audits** on `Critic` / `Review` roles so verification agents inspect raw code diffs and form independent conclusions first.

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
- **8 ثيمات مفتوحة المصدر وحزمة إمكانية الوصول البصرية** (WCAG AAA، خطوط عسر القراءة، تكبير 1.25x، تقليل الحركة).
- **الترجمة المحلية عبر Ollama والودجت الدائري العائم (140px)** لسحب وإفلات الملفات بسرعة.

---

## 🚀 التثبيت والبناء من المصدر

```bash
# استنساخ المستودع
git clone https://github.com/chemseddine201/flyMD.git
cd flyMD

# تثبيت الاعتماديات
npm install

# تشغيل اختبارات Rust (38 اختباراً آلياً)
cargo test --manifest-path src-tauri/Cargo.toml

# بناء النسخة الإنتاجية (ملف التثبيت + النسخة المحمولة)
npm run tauri:build
```

مخرجات البناء للإصدار الثاني:
- **نسخة التثبيت الرسمية (NSIS Installer)**: `src-tauri/target/release/bundle/nsis/FlyMD_2.0.0_x64-setup.exe`
- **النسخة المحمولة المباشرة (Portable)**: `src-tauri/target/release/fly-md-tauri.exe` (`FlyMD_2.0.0_x64-portable.exe`)

---

## 📄 الترخيص (License)

هذا المشروع مرخص بموجب **رخصة MIT (MIT License)** — حرية كاملة في الاستخدام والتعديل والتوزيع للأغراض الشخصية والتجارية. انظر ملف [LICENSE](LICENSE) والتغييرات المفصلة في [CHANGELOG.md](CHANGELOG.md).
