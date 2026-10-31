# FlyMD Strategic Roadmap: Next Initiatives & Architecture Hardening 🗺️

This roadmap documents the next four major milestones to be executed systematically in upcoming work sessions. Each initiative is defined with clear technical boundaries, target design patterns, and architectural invariants to ensure 100% functional preservation without regressions.

---

## 📌 Initiative 1: Full System Refactor & Code Splitting (Zero Functional Regression)

### Core Objective
Decompose monolithic backend (`runner.rs`, `commands.rs`) and frontend (`AgentsControlCenter.tsx`, `DiscussionStudio.tsx`, `AgentStudioSidebar.tsx`) files into clean, decoupled, single-responsibility modules following best design patterns while preserving all existing behaviors, IPC contracts, and state machines.

### Key Technical Strategies
1. **Backend Modularization (`src-tauri/src/agents/`)**:
   - **Strategy Pattern** for Model Providers: Clean adapter traits (`ProviderAdapter`) for CLI agents (`claude`, `codex`, `gemini`), Ollama, and Cloud HTTP.
   - **Settlement Guard Domain**: Extract settlement detectors, digest verifiers, and asset companion generators into dedicated pure functions (`verify.rs` / `settlement.rs`).
   - **Process Supervisor Layer**: Isolate PID tree tracking, heartbeat telemetry, and cancellation tokens into a reusable `ProcessManager`.
2. **Frontend Modularization (`src/renderer/preview/components/agents/`)**:
   - Extract stateful business logic into dedicated custom hooks (`usePipelineExecution`, `useDebateStream`, `useProjectMemory`).
   - Split view components into atomic presentational components and compound container components.
3. **Strict Invariant**: Zero changes to user-facing UI behavior, Zustand store signatures, or IPC payloads during refactoring.

---

## 📌 Initiative 2: Custom Skills Injection & User Directory Linking

### Core Objective
Enable users to inject custom skills into agent deliberations and pipelines by pointing to arbitrary directories, accompanied by an interactive modal to decide whether shared default tool skills are included or isolated.

### Key Capabilities
1. **Configurable Directory Pointer**:
   - Native folder picker to select custom skills repositories (e.g. `~/.my-skills`, workspace `.flymd/skills/`, or corporate shared folders).
2. **Interactive Inclusion Prompt Dialog**:
   - User prompt modal asking: *"Do you want to include the default built-in tool skills alongside your custom skills?"*
   - Default-checked or remembered preference per workspace/project.
3. **Canonical Skill Resolution Engine**:
   - Deep URI resolution (`file://`, `workspace://`, `builtin://`).
   - Conflict resolution rules where custom skills can selectively override built-in skills with identical names.

---

## 📌 Initiative 3: Process Monitor, Active Process Control Center & Token Quota Guards

### Core Objective
Provide full visibility into all spawned child processes, background workers, and CLI sessions with interactive controls to inspect, throttle, or terminate them safely, combined with real-time per-process token telemetry and configurable token quota circuit-breakers.

### Key Capabilities
1. **Process Inspection Table**:
   - Live list of active processes: PID, command line invoked, parent session ID, CPU %, RAM footprint, and running duration.
   - Real-time stdout/stderr log stream viewer with live tailing.
2. **Real-Time Token Consumption Telemetry**:
   - Live per-process and per-step token counter: Prompt Tokens, Completion Tokens, Reasoning/Thinking Tokens, and Total Tokens.
   - Per-task cost estimation based on model provider pricing tables.
3. **Configurable Token Quota Guards & Circuit-Breaker**:
   - **Per-Task & Per-Session Budgets**: Set hard or soft token caps per pipeline step or debate session.
   - **Pre-Breach Warning Thresholds**: Visual alert at 80% quota consumption.
   - **Safe Circuit-Breaker**: Automatically pause the process when the quota limit is reached to prevent runaway loops and unexpected API expenditures, with a human-in-the-loop modal to extend budget or gracefully settle.
4. **Process Lifecycle Controls**:
   - **Terminate PID Tree**: Target Windows child-process trees cleanly using PID scoping to eliminate orphan tasks without touching main application processes.
   - **Pause/Resume Signal Handling**: Temporarily freeze processes during human-in-the-loop inspection.
   - **Lock & Stale Worker Cleanup**: Surface and clear stale `.session.lock` or orphan background tasks with one click.

---

## 📌 Initiative 4: Context-Aware Smart Deliverable File Naming

### Core Objective
Replace generic output filenames (e.g., `plan.md`, `report.md`) with context-aware, collision-free filenames derived from project title, sub-project name, task prompt, or translated English slugs.

### Key Capabilities
1. **Context-Aware Composition**:
   - Pattern: `[ProjectName]_[SubProject]_[SemanticTitleSlug]_[Date/Version].md`
   - Example: `Fly10_LightPhysics_TheoryAndApplication_ConsensusReport_20261031.md`
2. **Automatic Multilingual Translation & Slugification**:
   - When a project or prompt uses Arabic or non-ASCII text (e.g. `"تطور مفهوم الضوء في الفيزياء"`), generate a clean, readable transliterated or translated English slug alongside safe UTF-8 document metadata.
3. **Anti-Collision & Version Preservation**:
   - Automatic version indexing (`-v1`, `-v2`, `-v3`) if a file with the same title already exists in the folder, eliminating accidental file clobbering.

---

## 📋 Execution Order for Next Phase

| Order | Initiative | Impact | Risk Level |
| :---: | :--- | :--- | :---: |
| **Step 1** | **System Refactor & Code Splitting** | High Maintainability & Code Quality | Very Low (100% Invariant Parity) |
| **Step 2** | **Context-Aware Smart Plan Naming** | Immediate Organization & File Safety | Very Low |
| **Step 3** | **Custom Skills Injection & Directory Linking** | Extensibility & Customization | Low |
| **Step 4** | **Process Monitor & Control Center** | Complete Transparency & System Control | Medium |

