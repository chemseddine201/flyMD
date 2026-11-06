import React from 'react';
import {
  Award,
  CheckCircle,
  Pause,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { DiscussionStatus } from '../../../shared/types';

export const DISCUSSION_AVATAR_PALETTE = [
  '#38bdf8',
  '#818cf8',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#06b6d4',
  '#ec4899',
  '#a855f7',
];

export interface RoundMetadataEntry {
  round: number;
  title: string;
  desc: string;
}

export const ROUND_METADATA: RoundMetadataEntry[] = [
  {
    round: 1,
    title: 'Phase 1: Independent Position Papers',
    desc: 'Each agent presents isolated analysis grounded in role evidence.',
  },
  {
    round: 2,
    title: 'Phase 2: Peer Cross-Examination & Critiques',
    desc: 'Models critique opposing claims, expose edge cases, and challenge assumptions.',
  },
  {
    round: 3,
    title: 'Phase 3: Rebuttal & Consensus Synthesis',
    desc: 'Agents revise stances, document concessions, and record unresolved trade-offs.',
  },
];

export const ROUND_METADATA_BY_NUMBER = new Map<number, RoundMetadataEntry>(
  ROUND_METADATA.map((entry) => [entry.round, entry])
);

export const calculateThinkingSteps = (thinking?: string): number => {
  if (!thinking) return 0;
  const stepMatches = thinking.match(
    /(?:step\s*\d+|invariant|\d+\.|\bfirst\b|\bsecond\b|\bfinally\b)/gi
  );
  return Math.max(
    1,
    stepMatches ? stepMatches.length : Math.ceil(thinking.length / 250)
  );
};

export const getMessageSnippet = (content: string): string => {
  if (!content) return 'Deliberation completed.';
  const clean = content
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/```[\s\S]*?```/g, '[Code]')
    .replace(/\n+/g, ' ')
    .trim();
  return clean.length > 150 ? `${clean.slice(0, 147)}...` : clean;
};

export const getRoleBadgeStyle = (role: string): string => {
  const r = (role || '').toLowerCase();
  if (r.includes('architect')) {
    return 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30';
  }
  if (r.includes('critic') || r.includes('adversar')) {
    return 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30';
  }
  if (r.includes('audit')) {
    return 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30';
  }
  if (r.includes('implement')) {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
  }
  if (r.includes('user') || r.includes('human')) {
    return 'bg-teal-500/15 text-teal-800 dark:text-teal-200 border-teal-500/40';
  }
  return 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30';
};

export const renderDiscussionStatusBadge = (
  status?: DiscussionStatus
): React.ReactNode => {
  switch (status) {
    case 'running':
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-ping" />
          RUNNING
        </span>
      );
    case 'awaiting_review':
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 flex items-center gap-1">
          <Award size={10} />
          AWAITING REVIEW
        </span>
      );
    case 'completed':
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
          <CheckCircle size={10} />
          COMPLETED
        </span>
      );
    case 'paused':
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
          <Pause size={10} />
          PAUSED
        </span>
      );
    case 'failed':
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 flex items-center gap-1">
          <AlertTriangle size={10} />
          FAILED
        </span>
      );
    case 'cancelled':
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 flex items-center gap-1">
          <XCircle size={10} />
          CANCELLED
        </span>
      );
    case 'interrupted':
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/15 text-orange-800 dark:text-orange-300 border border-orange-500/30 flex items-center gap-1">
          <AlertTriangle size={10} />
          INTERRUPTED
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
          {status || 'IDLE'}
        </span>
      );
  }
};

