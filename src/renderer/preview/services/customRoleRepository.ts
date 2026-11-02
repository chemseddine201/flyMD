import { CustomRoleDefinition } from '../../../shared/types';

const CUSTOM_ROLES_STORAGE_KEY = 'flymd:custom-debate-roles-v1';

export const BUILTIN_SPECIALIST_ROLES: CustomRoleDefinition[] = [
  {
    id: 'role-architect',
    roleKey: 'architect',
    name: 'Principal Systems Architect',
    experienceProfile:
      '15+ years designing modular distributed & local-first software architectures, strict state machines, and backward-compatible data contracts.',
    defaultDirective:
      'Decompose domain boundaries, define explicit data contracts & invariants, and propose a scalable modular blueprint.',
    assignedSkillUris: [],
    avatarColor: '#38bdf8',
    isBuiltIn: true,
  },
  {
    id: 'role-critic',
    roleKey: 'critic',
    name: 'Adversarial Critic & Red-Teamer',
    experienceProfile:
      'Specialist in exposing hidden assumptions, single points of failure, over-engineering traps, race conditions, and real-world edge cases.',
    defaultDirective:
      'Stress-test peer proposals, challenge unverified assumptions, and expose concrete failure modes with actionable counter-proposals.',
    assignedSkillUris: [],
    avatarColor: '#ef4444',
    isBuiltIn: true,
  },
  {
    id: 'role-auditor',
    roleKey: 'auditor',
    name: 'Security & Compliance Auditor',
    experienceProfile:
      'Zero-trust security architect focused on sandboxing, credential safety, injection prevention, privacy boundaries, and auditability.',
    defaultDirective:
      'Audit trust boundaries, input validation, secret handling, and fail-safe recovery invariants.',
    assignedSkillUris: [],
    avatarColor: '#f59e0b',
    isBuiltIn: true,
  },
  {
    id: 'role-implementer',
    roleKey: 'implementer',
    name: 'Lead Implementation Engineer',
    experienceProfile:
      'Pragmatic staff engineer focused on clean Single-Responsibility code, sub-16ms UI responsiveness, type safety, and automated testability.',
    defaultDirective:
      'Translate architectural ideas into concrete, idiomatic module specifications, file boundaries, and verification tests.',
    assignedSkillUris: [],
    avatarColor: '#10b981',
    isBuiltIn: true,
  },
  {
    id: 'role-researcher',
    roleKey: 'researcher',
    name: 'Domain & Evidence Researcher',
    experienceProfile:
      'Analytical domain specialist evaluating empirical trade-offs, prior art, algorithmic complexity, and alternative solution spaces.',
    defaultDirective:
      'Compare alternative approaches quantitatively, evaluate complexity/cost trade-offs, and ground claims in verifiable evidence.',
    assignedSkillUris: [],
    avatarColor: '#a78bfa',
    isBuiltIn: true,
  },
  {
    id: 'role-performance',
    roleKey: 'Performance & Reliability Lead',
    name: 'Performance & Reliability Lead',
    experienceProfile:
      'Systems performance engineer specializing in memory footprint, O(1) lookup structures, concurrency bottlenecks, and token/latency efficiency.',
    defaultDirective:
      'Audit algorithmic complexity, memory allocations, I/O bottlenecks, and runtime resilience under heavy load.',
    assignedSkillUris: [],
    avatarColor: '#06b6d4',
    isBuiltIn: true,
  },
  {
    id: 'role-product-ux',
    roleKey: 'Product & UX Strategist',
    name: 'Product & UX Strategist',
    experienceProfile:
      'Product design & workflow Ergonomics specialist focused on user value, cognitive clarity, accessibility, and frictionless UX.',
    defaultDirective:
      'Evaluate end-user ergonomics, clarity of workflows, progressive disclosure, and measurable user value.',
    assignedSkillUris: [],
    avatarColor: '#f472b6',
    isBuiltIn: true,
  },
];

export function loadAllRoleDefinitions(): CustomRoleDefinition[] {
  try {
    const raw = localStorage.getItem(CUSTOM_ROLES_STORAGE_KEY);
    if (!raw) return BUILTIN_SPECIALIST_ROLES;
    const customList = JSON.parse(raw) as CustomRoleDefinition[];
    if (!Array.isArray(customList)) return BUILTIN_SPECIALIST_ROLES;
    return [
      ...BUILTIN_SPECIALIST_ROLES,
      ...customList.filter((r) => r && r.id && !r.isBuiltIn),
    ];
  } catch {
    return BUILTIN_SPECIALIST_ROLES;
  }
}

export function saveUserCustomRoles(allRoles: CustomRoleDefinition[]): void {
  try {
    const userOnly = allRoles.filter((r) => !r.isBuiltIn);
    localStorage.setItem(CUSTOM_ROLES_STORAGE_KEY, JSON.stringify(userOnly));
  } catch {
    // Ignore storage quota errors in restricted sandboxes
  }
}

