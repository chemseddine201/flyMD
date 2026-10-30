import {
  AgentProfile,
  AgentTaskIntent,
  AgentPipelinePreset,
  CustomPipelineAction,
} from '../types/agents';

export const BUILTIN_AGENTS: AgentProfile[] = [
  {
    id: 'antigravity',
    name: 'Antigravity',
    shortName: 'Antigravity',
    vendor: 'Google DeepMind',
    description: 'Agentic coding IDE & workspace supervisor with deep reasoning and artifact generation.',
    accentColor: '#38bdf8',
    badgeBg: 'bg-sky-500/15 border-sky-500/40',
    badgeText: 'text-sky-300',
    binaryNames: ['agy', 'antigravity'],
    installed: false,
    authStatus: 'needs-login',
    tier: 'ide-workflow',
    loginCommand: 'agy auth login',
    webUrl: 'https://aistudio.google.com/prompts/new_chat',
    envKeyName: 'GEMINI_API_KEY',
    hasApiKey: false,
    artifactWatchPaths: ['.gemini/antigravity/brain', '.agent/workflows'],
    enabled: true,
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    shortName: 'Claude',
    vendor: 'Anthropic',
    description: 'Autonomous terminal & IDE coding agent powered by Claude Sonnet & Opus.',
    accentColor: '#fb923c',
    badgeBg: 'bg-orange-500/15 border-orange-500/40',
    badgeText: 'text-orange-300',
    binaryNames: ['claude', 'claude.cmd', 'claude.exe'],
    installed: false,
    authStatus: 'needs-login',
    tier: 'cli-pty',
    loginCommand: 'claude login',
    webUrl: 'https://claude.ai/new',
    envKeyName: 'ANTHROPIC_API_KEY',
    hasApiKey: false,
    artifactWatchPaths: ['.claude', '.claude/commands'],
    enabled: true,
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    shortName: 'OpenCode',
    vendor: 'OpenCode AI',
    description: 'Open-source terminal coding agent supporting multi-provider LLMs and fast execution.',
    accentColor: '#34d399',
    badgeBg: 'bg-emerald-500/15 border-emerald-500/40',
    badgeText: 'text-emerald-300',
    binaryNames: ['opencode', 'opencode.cmd', 'opencode.exe'],
    installed: false,
    authStatus: 'needs-login',
    tier: 'cli-pty',
    loginCommand: 'opencode auth login',
    webUrl: 'https://openrouter.ai/chat',
    envKeyName: 'OPENAI_API_KEY',
    hasApiKey: false,
    artifactWatchPaths: ['.opencode'],
    enabled: true,
  },
  {
    id: 'zcode',
    name: 'ZCode / Zed',
    shortName: 'ZCode',
    vendor: 'Zed Industries',
    description: 'High-performance multiplayer & AI-native code editor with inline assistant.',
    accentColor: '#a78bfa',
    badgeBg: 'bg-violet-500/15 border-violet-500/40',
    badgeText: 'text-violet-300',
    binaryNames: ['zcode', 'zed', 'zed.exe'],
    installed: false,
    authStatus: 'needs-login',
    tier: 'ide-workflow',
    loginCommand: 'zed --login',
    webUrl: 'https://zed.dev/account',
    envKeyName: 'ANTHROPIC_API_KEY',
    hasApiKey: false,
    artifactWatchPaths: ['.zed'],
    enabled: true,
  },
  {
    id: 'cursor',
    name: 'Cursor',
    shortName: 'Cursor',
    vendor: 'Anysphere',
    description: 'AI-first code editor with Composer multi-file agent and .cursor/rules workflows.',
    accentColor: '#60a5fa',
    badgeBg: 'bg-blue-500/15 border-blue-500/40',
    badgeText: 'text-blue-300',
    binaryNames: ['cursor', 'cursor.cmd', 'cursor.exe'],
    installed: false,
    authStatus: 'needs-login',
    tier: 'ide-workflow',
    loginCommand: 'cursor',
    webUrl: 'https://www.cursor.com/agents',
    envKeyName: 'OPENAI_API_KEY',
    hasApiKey: false,
    artifactWatchPaths: ['.cursor/rules'],
    enabled: true,
  },
  {
    id: 'codex',
    name: 'OpenAI Codex',
    shortName: 'Codex',
    vendor: 'OpenAI',
    description: 'Lightweight terminal coding agent from OpenAI for autonomous code synthesis & testing.',
    accentColor: '#f472b6',
    badgeBg: 'bg-pink-500/15 border-pink-500/40',
    badgeText: 'text-pink-300',
    binaryNames: ['codex', 'codex.cmd', 'codex.exe'],
    installed: false,
    authStatus: 'needs-login',
    tier: 'cli-pty',
    loginCommand: 'codex login',
    webUrl: 'https://chatgpt.com/',
    envKeyName: 'OPENAI_API_KEY',
    hasApiKey: false,
    artifactWatchPaths: ['.codex'],
    enabled: true,
  },
];

export interface IntentPresetMeta {
  id: AgentTaskIntent;
  title: string;
  nonDevLabel: string;
  description: string;
  promptTemplate: string;
  iconName: string;
}

export const AGENT_INTENT_PRESETS: IntentPresetMeta[] = [
  {
    id: 'build',
    title: 'Build & Implement Plan',
    nonDevLabel: 'Turn this plan into working code',
    description: 'Reads the Markdown specification and implements all unchecked tasks step-by-step.',
    promptTemplate:
      'Read the attached Markdown plan carefully. Implement all required code changes step-by-step in the workspace. When finished, write a completion summary report to `.flymd/reports/` describing what was built and verified.',
    iconName: 'Rocket',
  },
  {
    id: 'review',
    title: 'Review & Audit',
    nonDevLabel: 'Check for mistakes & improvements',
    description: 'Audits the plan or code changes for bugs, security risks, and missing edge cases.',
    promptTemplate:
      'Review this Markdown document and the corresponding workspace implementation. Identify any bugs, architectural issues, or missing edge cases, and write a clear audit report in Markdown.',
    iconName: 'ShieldCheck',
  },
  {
    id: 'fix-bugs',
    title: 'Fix Issues & Bugs',
    nonDevLabel: 'Find and fix the problem',
    description: 'Diagnoses the bug or issue described in the document and applies a verified fix.',
    promptTemplate:
      'Diagnose the issue or bug described in this Markdown file. Locate the root cause in the codebase, apply a clean fix, verify it compiles, and document the fix.',
    iconName: 'Wrench',
  },
  {
    id: 'refine-plan',
    title: 'Improve & Expand Plan',
    nonDevLabel: 'Make this plan clearer & better',
    description: 'Enhances the specification with step-by-step tasks, edge cases, and architecture diagrams.',
    promptTemplate:
      'Refine and expand this Markdown specification. Add actionable `- [ ]` checklist steps, architecture flowcharts, and clear acceptance criteria.',
    iconName: 'Sparkles',
  },
  {
    id: 'write-tests',
    title: 'Write & Run Tests',
    nonDevLabel: 'Test that everything works',
    description: 'Creates automated tests for the features described in the document and runs them.',
    promptTemplate:
      'Write comprehensive tests for the features described in this Markdown document, execute the test suite, and report the test results.',
    iconName: 'CheckCircle2',
  },
  {
    id: 'explain',
    title: 'Explain in Simple Words',
    nonDevLabel: 'Explain this without tech jargon',
    description: 'Creates a friendly, non-technical summary of what this document or code does.',
    promptTemplate:
      'Explain the contents and impact of this Markdown document in simple, clear, non-technical language with visual bullet points.',
    iconName: 'Lightbulb',
  },
  {
    id: 'custom',
    title: 'Custom Instructions',
    nonDevLabel: 'Write your own instructions',
    description: 'Send custom instructions alongside the Markdown file to the selected agent.',
    promptTemplate: '',
    iconName: 'MessageSquarePlus',
  },
];

export const BUILTIN_AGENT_PIPELINES: AgentPipelinePreset[] = [
  {
    id: 'plan-build-review',
    name: 'Plan → Build → Review Relay',
    description: 'Antigravity refines the plan, Claude Code builds it, and Codex reviews the result.',
    steps: [
      {
        agentId: 'antigravity',
        intent: 'refine-plan',
        label: '1. Refine Specification',
        requireConfirmation: true,
      },
      {
        agentId: 'claude-code',
        intent: 'build',
        label: '2. Implement Code',
        requireConfirmation: true,
      },
      {
        agentId: 'codex',
        intent: 'review',
        label: '3. QA Audit & Verification',
        requireConfirmation: false,
      },
    ],
  },
  {
    id: 'fast-build-test',
    name: 'OpenCode Build → Claude Audit',
    description: 'OpenCode implements the feature rapidly, then Claude Code audits and writes tests.',
    steps: [
      {
        agentId: 'opencode',
        intent: 'build',
        label: '1. Fast Implementation',
        requireConfirmation: true,
      },
      {
        agentId: 'claude-code',
        intent: 'write-tests',
        label: '2. Verify & Write Tests',
        requireConfirmation: false,
      },
    ],
  },
];

export const STARTER_CUSTOM_PIPELINE_ACTIONS: CustomPipelineAction[] = [
  {
    id: 'custom-action-report',
    name: 'Comprehensive Project & Delivery Report',
    shortLabel: 'Report',
    description:
      'Generates an executive completion report documenting architecture, created deliverables, checklist status, and remaining items.',
    promptTemplate:
      'Generate a comprehensive project & delivery summary report in Markdown. Detail the implemented components, file architecture, checklist invariants, and verification outcome. Write the deliverable directly to `PROJECT_REPORT.md` in the workspace.',
    outputFileHint: 'PROJECT_REPORT.md',
    epistemicPolicy: 'collaborative',
    iconKey: 'file-text',
    createdAt: 1730300000000,
    updatedAt: 1730300000000,
  },
  {
    id: 'custom-action-security-audit',
    name: 'Security & Vulnerability Audit',
    shortLabel: 'Sec Audit',
    description:
      'Inspects raw code for input sanitization, buffer safety, auth leakage, and injection vulnerabilities.',
    promptTemplate:
      'Perform a rigorous, adversarial security audit of the workspace code. Look for unhandled input boundaries, potential injection, secret leaks, and edge-case errors. Conclude with an independent résumé before proposing security mitigations.',
    outputFileHint: 'SECURITY_AUDIT.md',
    epistemicPolicy: 'independent-audit',
    iconKey: 'shield',
    createdAt: 1730300000000,
    updatedAt: 1730300000000,
  },
  {
    id: 'custom-action-api-docs',
    name: 'API & Developer Documentation',
    shortLabel: 'Docs',
    description:
      'Extracts DOM IDs, exported functions, and data schemas into a clean README or API reference.',
    promptTemplate:
      'Inspect the workspace code and generate clean developer documentation. Document the public functions, DOM structures, state machine events, and usage examples into `API_DOCUMENTATION.md`.',
    outputFileHint: 'API_DOCUMENTATION.md',
    epistemicPolicy: 'collaborative',
    iconKey: 'book-open',
    createdAt: 1730300000000,
    updatedAt: 1730300000000,
  },
];


