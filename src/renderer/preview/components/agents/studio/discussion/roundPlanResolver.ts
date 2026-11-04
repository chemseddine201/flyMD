import {
  DiscussionConfig,
  DiscussionParticipant,
  DiscussionRoundPlan,
  DiscussionRoundSlot,
} from '../../../../../../shared/types';

export interface ResolvedRoundPlan {
  title: string;
  objective?: string;
  slots: DiscussionRoundSlot[];
}

/**
 * Resolves a round's slots and title byte-identically to Rust's
 * `DiscussionConfig::resolve_round_plan(round)` (src-tauri/src/discussion/types.rs:374).
 *
 * Supported modes:
 * - When `roundSchedule` is non-empty and `repeaterMode !== 'off'`:
 *   Matches exact round plan, or cycles through non-empty scheduled plans.
 * - When `repeaterMode === 'per_agent'` and `participants` is non-empty:
 *   Runs exactly 1 agent per round, cycling modulo participants.length.
 * - Fallback:
 *   Returns all participants as slots for this round.
 */
export function resolveRoundPlan(
  config: DiscussionConfig,
  round: number
): ResolvedRoundPlan {
  const defaultTitle =
    round === 1
      ? 'Round 1: Initial Discovery & Position Papers'
      : round === 2
      ? 'Round 2: Cross-Examination & Peer Scrutiny'
      : round === 3
      ? 'Round 3: Rebuttal, Trade-Off Analysis & Consensus Synthesis'
      : `Round ${round}: Deep Specialist Deliberation`;

  const mode = config.repeaterMode || 'auto';
  const schedule = config.roundSchedule || [];

  if (mode !== 'off' && schedule.length > 0) {
    let matchedPlan = schedule.find(
      (p) => p.roundNumber === round && (p.slots?.length ?? 0) > 0
    );
    if (!matchedPlan) {
      const nonEmpty = schedule.filter((p) => (p.slots?.length ?? 0) > 0);
      if (nonEmpty.length > 0) {
        const idx = Math.max(0, round - 1) % nonEmpty.length;
        matchedPlan = nonEmpty[idx];
      }
    }

    if (matchedPlan) {
      const title =
        matchedPlan.title && matchedPlan.title.trim()
          ? matchedPlan.title
          : defaultTitle;
      const seenIds = new Set<string>();
      const slots: DiscussionRoundSlot[] = (matchedPlan.slots || []).map(
        (slot, idx) => {
          const p = { ...slot.participant };
          if (!p.agentId || !p.agentId.trim()) {
            p.agentId = `slot-r${round}-${idx + 1}`;
          } else if (seenIds.has(p.agentId)) {
            p.agentId = `${p.agentId}-slot${idx + 1}`;
            seenIds.add(p.agentId);
          } else {
            seenIds.add(p.agentId);
          }
          const directive =
            slot.roundDirective && slot.roundDirective.trim()
              ? slot.roundDirective
              : matchedPlan!.objective && matchedPlan!.objective!.trim()
              ? matchedPlan!.objective
              : undefined;
          return {
            slotId: slot.slotId || `slot-r${round}-${idx + 1}`,
            participant: p,
            roundDirective: directive || '',
          };
        }
      );
      return { title, objective: matchedPlan.objective, slots };
    }
  } else if (mode === 'per_agent' && (config.participants?.length ?? 0) > 0) {
    const idx = Math.max(0, round - 1) % config.participants.length;
    const p = { ...config.participants[idx] };
    const directive =
      p.customQuery ||
      `Apply specialized domain experience as ${p.displayName}.`;
    const agentTitle = `Round ${round}: ${p.displayName} Deliberation`;
    return {
      title: agentTitle,
      objective: undefined,
      slots: [
        {
          slotId: `slot-r${round}-1`,
          participant: p,
          roundDirective: directive,
        },
      ],
    };
  }

  const fallbackSlots: DiscussionRoundSlot[] = (config.participants || []).map(
    (p, idx) => ({
      slotId: `slot-r${round}-${idx + 1}`,
      participant: { ...p },
      roundDirective: '',
    })
  );
  return { title: defaultTitle, objective: undefined, slots: fallbackSlots };
}

/**
 * Expands an implicit per_agent or fallback config into an explicit full roundSchedule
 * covering rounds 1..maxRounds.
 * This guarantees that rounds <= currentRound resolve to the exact same slots,
 * so the backend immutability guard will pass when adding/removing slots in upcoming rounds.
 */
export function expandFullRoundSchedule(
  config: DiscussionConfig,
  maxRounds: number
): DiscussionRoundPlan[] {
  const existingSchedule = config.roundSchedule || [];
  const plans: DiscussionRoundPlan[] = [];

  for (let r = 1; r <= maxRounds; r++) {
    const existing = existingSchedule.find(
      (p) => p.roundNumber === r && (p.slots?.length ?? 0) > 0
    );
    if (existing) {
      plans.push({
        ...existing,
        slots: (existing.slots || []).map((s) => ({
          ...s,
          participant: { ...s.participant },
        })),
      });
    } else {
      const resolved = resolveRoundPlan(config, r);
      plans.push({
        roundNumber: r,
        title: resolved.title,
        objective: resolved.objective || '',
        slots: resolved.slots.map((s) => ({
          ...s,
          participant: { ...s.participant },
        })),
      });
    }
  }

  return plans;
}

