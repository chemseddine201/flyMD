# FlyMD 🪶

[English](#-english) • [العربية](#-العربية)

---

# 🇬🇧 English

> **A dedicated, ultra-lightweight side-screen Markdown viewer, folder supervisor & reader for AI-assisted software development.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Framework: Tauri v2](https://img.shields.io/badge/Runtime-Tauri_v2_(Rust)-orange.svg)](https://tauri.app)
[![Installer Size: ~4 MB](https://img.shields.io/badge/Installer_Size-~4_MB-success.svg)](#-performance--footprint)
[![RAM Usage: ~30 MB](https://img.shields.io/badge/Memory_Footprint-~30_MB_RAM-brightgreen.svg)](#-performance--footprint)

---

## 💡 The Problem & Why FlyMD Was Created

When developing software alongside modern AI coding agents (such as Google DeepMind Antigravity, Claude Code, Cursor, Copilot Workspace, and autonomous coding agents), agents continuously generate and update Markdown documentation:
- Implementation plans & technical RFCs
- Task checklists & progress trackers
- Walkthroughs, experiment logs, and delivery reports
- Architecture diagrams and flowcharts

Opening and reading these markdown files **inside your primary IDE** introduces significant friction:
1. **Context Switching & Tab Fatigue**: You constantly flip between active code files (TypeScript, Rust, Python, Go) and markdown documentation tabs, cluttering your editor tab strip and fragmenting your focus.
2. **Hidden & Dispersed Files**: Agents frequently create files across various subdirectories (`.gemini/`, `docs/`, `brain/`, `.reports/`). Searching for, locating, and opening each newly generated file manually interrupts your programming flow.

### The Solution
**FlyMD** was built as a dedicated side-screen companion app to run on a **secondary monitor** or as a **floating desktop widget** alongside your IDE:
- **Dedicated Reading Canvas**: View, verify, and read AI plans and markdown reports on a separate screen without closing or switching your active code tabs.
- **Live Folder Supervision**: Point FlyMD at your workspace directory. Whenever an AI agent writes or modifies a markdown file anywhere in the project, FlyMD automatically captures it.
- **Background Auto-Open**: Newly created files are immediately opened in background tabs with a distinct pulsing green indicator dot without stealing your active keyboard focus.
- **5-Second Countdown Badge**: Interacting with either the sidebar file item or the tab header begins a 5-second countdown before clearing the green dot badge on both, giving you clear visual confirmation.
- **Zero Heavy Overhead**: Built with Tauri v2 (Rust + WebView2) to keep memory consumption ultra-low (~30 MB RAM), leaving your system resources completely free for your IDE, compiler, and local Docker containers.

---

## ✨ Key Features

### 1. Live Folder Supervision & Auto-Capture
- **Native File Watcher**: High-performance Rust watcher powered by `notify` recursively monitors the selected workspace for file creations and updates.
- **Automatic Background Tab Open**: Newly generated `.md` files appear in FlyMD instantly without user intervention or stealing focus from what you're actively reading.
- **5-Second Notification Badge**: Pulsing emerald indicators highlight new files on both the tab bar and the sidebar tree view, smoothly clearing 5 seconds after interaction.

### 2. Multi-Tab Workspace & Tab Management
- **Desktop Context Menu**: Right-click tabs to access **Close**, **Close Others**, **Close to the Right**, and **Close All**.
- **Confirmable Closure with "Do Not Ask Me Again"**: Prevents accidental closure of multiple tabs or tabs with unsaved edits; preferences can be remembered and reset in Settings.
- **IDE-Style Empty Workspace**: Closing all open tabs displays a welcoming empty workspace canvas with quick access cards:
  - **Open File** (`Ctrl + O`)
  - **Open Folder** (`Ctrl + Shift + O`)
  - **New File** (`Ctrl + N`)

### 3. Editor & Multi-View Modes
- **Three Viewing Modes**:
  - **WYSIWYG Mode**: Smooth live visual markdown editing.
  - **Split View**: Side-by-side CodeMirror 6 source editor with live markdown rendering and an interactive draggable divider.
  - **Preview Only**: Distraction-free reading view for long reports and plans.
- **Document Outline Navigation**: Jump to any heading with an interactive hierarchy outline panel.
- **Full Markdown Ecosystem**:
  - GitHub-Flavored Markdown (tables, checklists, autolinks).
  - Live KaTeX math rendering (inline `$E=mc^2$` and block `$$...$$`).
  - Native Mermaid diagram rendering (flowcharts, sequence diagrams, mindmaps, state diagrams).
  - Code syntax highlighting with one-click copy buttons.
  - RTL & Bidirectional text detection and toggle (`Ctrl+Shift+D`).

### 4. Interactive Flowchart Lightbox
- **Click to Inspect**: Click any Mermaid flowchart to open an interactive full-screen lightbox.
- **Smooth Zoom & Pan**: Zoom in/out via buttons or mouse wheel scroll, and drag to pan across large architecture maps.
- **Image Export**: Export and download any diagram directly as SVG or high-resolution PNG.

### 5. Preview Layout & Floating Font Zoom Pill
- **Floating Controls Pill**: Docked at the top right of the preview pane with one-click Zoom In (`+`), Zoom Out (`-`), and a live font size reset button (`15px`).
- **Layout Width Switcher**:
  - **Standard** (`896px` / `max-w-4xl`): Optimal for single-column reading with line-length eye tracking.
  - **Wide Balanced** (`1280px` / `max-w-7xl`): Ample horizontal space for code snippets, architecture flowcharts, and markdown tables.
  - **Full Width** (`100%` / unconstrained): Full-bleed layout across ultrawide monitors.

### 6. 8 Open-Source Design Themes
Full CSS token variable engine across editor and preview:
1. **GitHub Dark** (Default)
2. **GitHub Light**
3. **Tokyo Night** (Deep Indigo)
4. **Catppuccin Mocha** (Soft Pastel)
5. **Dracula Official** (Vampire Purple)
6. **Warm Sepia** (Eye Comfort Parchment)
7. **Cyberpunk Neon** (Yellow / Cyan)
8. **High Contrast** (WCAG AAA)

### 7. Visual Accessibility Suite
- **WCAG AAA High Contrast**: Maximum visual separation for low vision.
- **Dyslexia-Friendly Typography**: Applies OpenDyslexic typography, increased letter-spacing, and line-height.
- **Large Print Mode**: Automatically scales all typography and UI elements up by 1.25x.
- **Reduced Motion**: Disables transitions and animations across CodeMirror, Mermaid diagrams, and layout drawers.
- **Color-Blind Safe Badges**: Displays high-contrast text badges (`[NEW]`) alongside or replacing color-only dot indicators.

### 8. Local AI & LLM Engine
- Connects to local **Ollama** or custom OpenAI-compatible endpoints.
- Streamed inline markdown translation into Arabic, French, German, Spanish, and English.
- Real-time AI explanations and document summaries.

### 9. Floating Circular Drop Hub
- **Minimalist Circular Widget**: 140px glassmorphism circle for desktop workspaces.
- **Drop & View**: Drag-and-drop any markdown file onto the widget to open or focus FlyMD.
- **Always-on-Top Toggle**: Pin above other windows or let it rest in the background.

---

## 📊 Performance & Footprint

| Metric | Electron (Standard) | Electron (Optimized) | **FlyMD (Tauri v2)** |
|---|---|---|---|
| **Installer Size** | ~85 MB | ~65 MB | **~4.0 MB** |
| **Installed Binary** | ~170 MB | ~110 MB | **~6.0 MB** |
| **Idle Memory (RAM)** | ~180 MB | ~110 MB | **~28 - 35 MB** |
| **Cold Startup Time** | ~1.8s | ~1.2s | **< 280 ms** |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + O` | Open File Dialog |
| `Ctrl + Shift + O` | Open & Supervise Folder |
| `Ctrl + N` | New Document Tab |
| `Ctrl + W` | Close Active Tab |
| `Ctrl + S` | Save Current File |
| `Ctrl + Shift + S` | Save As Dialog |
| `Ctrl + B` | Toggle Project Explorer Sidebar |
| `Ctrl + T` | Open Translation / LLM Dialog |
| `Ctrl + Shift + D` | Toggle Text Direction (Auto / RTL / LTR) |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Rust toolchain](https://www.rust-lang.org/) (cargo & rustc v1.75+)
- On Windows: WebView2 Runtime (pre-installed on Windows 10 & 11)

### Development
```bash
# Clone the repository
git clone https://github.com/chemseddine201/flyMD.git
cd flyMD

# Install dependencies
npm install

# Run in development mode (Vite + Tauri)
npm run tauri:dev
```

### Production Build
```bash
# Build frontend and compile native release binary + installer
npm run tauri:build
```
The compiled installer will be located in:
`src-tauri/target/release/bundle/nsis/FlyMD_1.0.0_x64-setup.exe`

---

# 🇸🇦 العربية

> **عارض ومراقب مجلدات متطور، فائق الخفة وخاص بالشاشات الجانبية لقراءة وتحرير ملفات الـ Markdown أثناء التطوير البرمجي بالذكاء الاصطناعي.**

---

## 💡 المشكلة البرمجية والدافع وراء إنشاء FlyMD

خلال العمل والتطوير اليومي إلى جانب وكلاء ونماذج الذكاء الاصطناعي الحديثة (مثل Google DeepMind Antigravity، Claude Code، Cursor، و Copilot Workspace)، يقوم الوكلاء باستمرار بإنشاء وتحديث ملفات توثيق بصيغة Markdown:
- خطط العمل والمهام الهندسية (Implementation Plans & RFCs)
- قوائم المهام ومتابعة الإنجاز (Task Checklists)
- تقارير التسليم والاختبارات ومسارات التنفيذ (Walkthroughs & Delivery Reports)
- مخططات البنية التحتية والرسوم البيانية (Architecture Flowcharts)

فتح هذه الملفات وقراءتها **داخل بيئة التطوير الرئيسية (IDE)** يتسبب في مشاكل عملية واضحة:
1. **تشتيت التركيز وازدحام التبويبات (Tab Fatigue)**: التنقل المستمر بين ملفات الشيفرة البرمجية (TypeScript، Rust، Python، Go) وتبويبات التوثيق يؤدي إلى فوضى بصرية تشتت ذهن المبرمج وتفقده سياق العمل.
2. **صعوبة تتبع الملفات المحدثة**: ينشئ وكلاء الذكاء الاصطناعي ملفات داخل مجلدات فرعية مختلفة ومتفرقة (`.gemini/`, `docs/`, `brain/`). البحث اليدوي عن كل ملف جديد وتحديده لفتحه يقطع تسلسل البرمجة.

### الحل المبتكر
تم تصميم وتطوير تطبيق **FlyMD** ليكون حلاً مستقلاً يعمل على **شاشة ثانوية (Second Screen)** أو كـ **ودجت مكتبي عائم** بجانب بيئة التطوير:
- **مساحة قراءة مخصصة ومستقلة**: قراءة ومراجعة وتدقيق خطط الذكاء الاصطناعي وتقاريره على شاشة منفصلة تماماً دون إغلاق أو تبديل نوافذ الشيفرة البرمجية في محرر الكود.
- **مراقبة المجلدات الحية (Folder Supervision)**: توجيه FlyMD إلى مجلد المشروع؛ بمجرد قيام وكيل الذكاء الاصطناعي بإنشاء أو تعديل أي ملف Markdown، يلتقطه التطبيق فوراً.
- **الفتح التلقائي في الخلفية (Background Auto-Open)**: تُفتح الملفات الجديدة مباشرة في تبويبات خلفية مع نقطة خضراء نابضة مميزة، مع الحفاظ على التبويب والملف المفتوح حالياً دون سرقة تركيز لوحة المفاتيح أثناء كتابة الكود.
- **مؤقت اختفاء الشارة خلال 5 ثوانٍ**: بمجرد النقر على الملف في القائمة الجانبية أو على التبويب، يبدأ عداد زمني لمدة 5 ثوانٍ ثم تختفي النقطة الخضراء تلقائياً لتأكيد المشاهدة.
- **خفة مذهلة واستهلاك شبه معدوم للموارد**: مبني بالكامل بواسطة Tauri v2 ولغة Rust مع محرك WebView2، مما يحافظ على استهلاك ذاكرة فائق الخفة (~30 ميجابايت رام فقط)، تاركاً موارد الجهاز بالكامل للمحرر وحاويات Docker والمترجمات.

---

## ✨ أبرز مميزات التطبيق

### 1. المراقبة الحية والالتقاط التلقائي
- **مراقب ملفات مدمج بلغة Rust**: معتمد على مكتبة `notify` لمراقبة جميع التغييرات وإنشاء الملفات داخل المجلدات بشكل متكرر ولحظي.
- **فتح فوري بدون تشويش**: الملفات الجديدة تظهر مباشرة دون الحاجة لتدخل يدوي.
- **شارات بصرية ذكية**: تنبيهات خضراء نابضة تُميز الملفات الحديثة وتختفي بسلاسة بعد 5 ثوانٍ من التفاعل معها.

### 2. إدارة التبويبات المتقدمة ومساحة العمل
- **قائمة سياق سطح المكتب (Right-Click Context Menu)**: خيارات لإغلاق التبويب الحالي، أو إغلاق باقي التبويبات، أو إغلاق جميع التبويبات.
- **تأكيد الإغلاق مع خيار التذكر ("عدم السؤال مرة أخرى")**: لمنع فقدان البيانات أو الإغلاق العرضي للتبويبات غير المحفوظة، مع إمكانية إعادة التعيين من نافذة الإعدادات.
- **واجهة الترحيب الذكية عند خلو التبويبات**: شاشة نظيفة مستوحاة من بيئات التطوير الكبرى توفر وصولاً سريعاً:
  - فتح ملف (`Ctrl + O`)
  - فتح ومراقبة مجلد (`Ctrl + Shift + O`)
  - إنشاء ملف جديد (`Ctrl + N`)

### 3. أوضاع التحرير والعرض المتعددة
- **ثلاثة أوضاع عرض**:
  - **وضع المعاينة (Preview)**: قراءة مريحة بدون تشتيت للخطط والتقارير الطويلة.
  - **وضع العرض المقسم (Split View)**: محرر CodeMirror 6 إلى جانب المعاينة المباشرة مع شريط فاصل تفاعلي قابل للسحب والتكبير.
  - **وضع التحرير المرئي المباشر (WYSIWYG)**: تحرير وتنسيق بصري فوري وسلس.
- **مخطط هيكل الوثيقة (Document Outline)**: لوحة جانبية تسرد العناوين للانتقال السريع داخل المستندات الطويلة.
- **دعم متكامل وشامل لـ Markdown**:
  - جداول، قوائم مهام، وروابط تلقائية (GFM).
  - معادلات رياضية حية عبر KaTeX (المعادلات السطرية `$E=mc^2$` والمستقلة `$$...$$`).
  - مخططات ورسوم بيانية Mermaid حية (Flowcharts, Sequence Diagrams, Mindmaps).
  - تلوين الشيفرات البرمجية مع زر نسخ سريع للأكواد بضغطة واحدة.
  - دعم كامل للكتابة من اليمين إلى اليسار (RTL) والكشف التلقائي عن اللغة والاتجاه (`Ctrl+Shift+D`).

### 4. عارض المخططات الانسيابية التفاعلي (Mermaid Lightbox)
- **معاينة تفاعلية بضغطة زر**: النقر على أي رسم بياني أو مخطط لفتحه في نافذة تكبير كاملة الشاشة.
- **تكبير وتحريك سلس**: إمكانية التكبير والتصغير عبر عجلة الفأرة والتحريك بالسحب لمراجعة المخططات الضخمة والمعقدة.
- **تصدير الصور**: حفظ وتنزيل أي رسم بياني فوراً بصيغة متجهية SVG أو صورة فائقة الدقة PNG.

### 5. التحكم في عرض الصفحة وتكبير الخط العائم
- **زر تحكم عائم**: مثبت أعلى يمين منطقة المعاينة للتكبير والتصغير وتعديل حجم الخط بضغطة واحدة مع زر لإعادة الضبط على 15px.
- **التبديل بين أبعاد العرض**:
  - **العرض القياسي (Standard - 896px)**: مثالي لراحة العين أثناء قراءة المقالات والخطط الفردية.
  - **العرض الواسع المتوازن (Wide - 1280px)**: يوفر مساحة أفقية مريحة للجداول الكبيرة ومخططات البنية التحتية.
  - **العرض الكامل (Full Width - 100%)**: ملء الشاشة بالكامل للشاشات العريضة.

### 6. ثمانية ثيمات برمجية مفتوحة المصدر
نظام ألوان متكامل مبني على متغيرات CSS Semantic Tokens:
1. **GitHub Dark** (الداكن الافتراضي)
2. **GitHub Light** (الفاتح الأنيق)
3. **Tokyo Night** (النيلي الهادئ)
4. **Catppuccin Mocha** (الباستيل الناعم)
5. **Dracula Official** (البنفسجي البرمجي)
6. **Warm Sepia** (الورق الكلاسيكي المريح للعين)
7. **Cyberpunk Neon** (ألوان النيون المستقبلية)
8. **High Contrast** (عالي التباين المتوافق مع معايير WCAG AAA)

### 7. حزمة إمكانية الوصول لذوي الاحتياجات البصرية
- **وضع التباين العالي (WCAG AAA)**: تباين بصري نقي يسهل القراءة لضعاف البصر.
- **خطوط مخصصة لعسر القراءة (Dyslexia-Friendly)**: تفعيل خطوط متباعدة ومصممة خصيصاً للقراءة السلسة.
- **وضع الطباعة الكبيرة (Large Print)**: تكبير واجهة المستخدم والخطوط بنسبة 1.25x تلقائياً.
- **تقليل الحركة (Reduced Motion)**: إيقاف الرسوم المتحركة والتأثيرات الحركية لمن يعانون من حساسية الحركة.
- **علامات آمنة لعمى الألوان (Color-Blind Safe)**: عرض نص صريح `[NEW]` بجانب أو بدلاً من مجرد اللون الأخضر لتوضيح الملفات الجديدة.

### 8. الذكاء الاصطناعي المحلي والترجمة الفورية
- ربط مباشر مع محرك **Ollama** المحلي أو خوادم OpenAI المتوافقة.
- ترجمة متدفقة فورية للوثائق والتقارير إلى العربية والإنجليزية والفرنسية والألمانية بدون إرسال بيانات إلى السحابة.
- تلخيص وشرح المستندات البرمجية محلياً بأمان وخصوصية تامة.

### 9. الودجت الدائري العائم لسطح المكتب
- **ودجت دائري زجاجي أنيق (140px)**.
- **سحب وإفلات سريع**: إسقاط أي ملف Markdown فوق الودجت لفتحه فوراً في التطبيق.
- **تثبيت دائم (Always-on-Top)**: تثبيت الودجت فوق النوافذ أو تركه في الخلفية لسرعة الوصول.

---

## 📊 مقارنة الأداء واستهلاك الموارد

| المعيار | Electron (التقليدي) | Electron (المحسن) | **FlyMD (Tauri v2 + Rust)** |
|---|---|---|---|
| **حجم ملف التثبيت** | ~85 ميجابايت | ~65 ميجابايت | **~4.0 ميجابايت** |
| **حجم التطبيق المثبت** | ~170 ميجابايت | ~110 ميجابايت | **~6.0 ميجابايت** |
| **استهلاك الذاكرة (RAM)** | ~180 ميجابايت | ~110 ميجابايت | **~28 - 35 ميجابايت** |
| **سرعة التشغيل الأولى** | ~1.8 ثانية | ~1.2 ثانية | **أقل من 280 مللي ثانية** |

---

## ⌨️ اختصارات لوحة المفاتيح

| الاختصار | الوظيفة |
|---|---|
| `Ctrl + O` | فتح نافذة اختيار ملف |
| `Ctrl + Shift + O` | فتح ومراقبة مجلد بالكامل |
| `Ctrl + N` | إنشاء تبويب / مستند جديد |
| `Ctrl + W` | إغلاق التبويب الحالي |
| `Ctrl + S` | حفظ التعديلات في الملف الحالي |
| `Ctrl + Shift + S` | حفظ باسم جديد |
| `Ctrl + B` | إظهار / إخفاء القائمة الجانبية للمشروع |
| `Ctrl + T` | فتح نافذة الترجمة والذكاء الاصطناعي |
| `Ctrl + Shift + D` | تبديل اتجاه النص (تلقائي / من اليمين لليسار / من اليسار لليمين) |

---

## 🚀 التثبيت والتشغيل والتطوير

### المتطلبات الأساسية
- [Node.js](https://nodejs.org/) (الإصدار 18 أو أحدث)
- [Rust toolchain](https://www.rust-lang.org/) (cargo & rustc الإصدار 1.75 فما فوق)
- في بيئة Windows: محرك WebView2 Runtime (مدمج افتراضياً في Windows 10 و 11)

### خطوات التشغيل والتطوير
```bash
# استنساخ المستودع
git clone https://github.com/chemseddine201/flyMD.git
cd flyMD

# تثبيت المكتبات البرمجية
npm install

# تشغيل بيئة التطوير المباشرة (Vite + Tauri)
npm run tauri:dev
```

### بناء النسخة الإنتاجية
```bash
# بناء الواجهة وتجميع ملف التشغيل والتثبيت
npm run tauri:build
```
ملف التثبيت النهائي سيكون متوفراً في المسار:
`src-tauri/target/release/bundle/nsis/FlyMD_1.0.0_x64-setup.exe`

---

## 📄 الترخيص (License)

هذا المشروع مرخص بموجب **رخصة MIT (MIT License)** — وهي رخصة حرة ومفتوحة المصدر بالكامل تمنحك الحرية المطلقة في الاستخدام، والتعديل، والتوزيع، والاستخدام التجاري أو الشخصي بدون أي قيود. انظر ملف [LICENSE](LICENSE) لمزيد من التفاصيل.
