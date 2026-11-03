import React, { useCallback, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Lock,
  SkipForward,
  CheckCircle2,
  ChevronsUpDown,
} from 'lucide-react';
import { markdownService } from '../../../../services/MarkdownService';
import { cleanDiscussionMarkdown } from '../../../../services/deliberationPresetRepository';

interface ParsedReportRound {
  roundNumber: number;
  title: string;
  metaSummary: string;
  isIgnored: boolean;
  convergedFromRound?: number;
  markdownBody: string;
}

interface ParsedReportStructure {
  beforeSection4Html: string;
  rounds: ParsedReportRound[];
  afterSection4Html: string;
}

function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]+>/g, '').trim();
}

function parseReportIntoCollapsibleSections(
  rawMarkdown: string
): ParsedReportStructure {
  const cleaned = cleanDiscussionMarkdown(rawMarkdown);
  const sec4HeaderRegex =
    /^##\s+4\.\s+Main Arguments,\s*Critiques,\s*Replies,\s*and Revisions\s*$/m;
  const sec4Match = sec4HeaderRegex.exec(cleaned);

  if (!sec4Match || sec4Match.index === undefined) {
    return {
      beforeSection4Html: markdownService.render(cleaned),
      rounds: [],
      afterSection4Html: '',
    };
  }

  const beforeSec4Md = cleaned.slice(0, sec4Match.index).trim();
  const fromSec4AfterHeader = cleaned.slice(
    sec4Match.index + sec4Match[0].length
  );

  // Locate Section 5 (`## 5. ...`) or next top-level `## ` heading
  const nextSecMatch = /^##\s+\d+\.\s+/m.exec(fromSec4AfterHeader);
  const sec4BodyMd =
    nextSecMatch && nextSecMatch.index !== undefined
      ? fromSec4AfterHeader.slice(0, nextSecMatch.index).trim()
      : fromSec4AfterHeader.trim();
  const afterSec4Md =
    nextSecMatch && nextSecMatch.index !== undefined
      ? fromSec4AfterHeader.slice(nextSecMatch.index).trim()
      : '';

  const rounds: ParsedReportRound[] = [];

  // 1. Parse structured round markers emitted by ReportGenerator (`<!-- flymd-round:N:executed -->` / `<!-- flymd-round:N:ignored:M -->`)
  const markerRegex =
    /<!--\s*flymd-round:(\d+):(executed|ignored)(?::(\d+))?\s*-->([\s\S]*?)<!--\s*\/flymd-round:\1\s*-->/g;
  let m: RegExpExecArray | null;
  while ((m = markerRegex.exec(sec4BodyMd)) !== null) {
    const roundNumber = parseInt(m[1], 10);
    const kind = m[2];
    const refRound = m[3] ? parseInt(m[3], 10) : Math.max(1, roundNumber - 1);
    const inner = m[4].trim();

    if (kind === 'ignored') {
      rounds.push({
        roundNumber,
        title: `Round ${roundNumber} — Duplicated / Ignored (Same as Round ${refRound} Debate Round)`,
        metaSummary: `Skipped to save queries • Converged in Round ${refRound}`,
        isIgnored: true,
        convergedFromRound: refRound,
        markdownBody: '',
      });
    } else {
      const summaryMatch = /<summary>([\s\S]*?)<\/summary>/i.exec(inner);
      const rawSummary = summaryMatch
        ? stripHtmlTags(summaryMatch[1])
        : `Round ${roundNumber} Deliberation Summary`;

      // Extract clean untrimmed Markdown inside `<details>...</details>`
      let bodyMd = inner;
      if (summaryMatch && summaryMatch.index !== undefined) {
        bodyMd = inner.slice(summaryMatch.index + summaryMatch[0].length);
      }
      bodyMd = bodyMd
        .replace(/^\s*<details[^>]*>/i, '')
        .replace(/<\/details>\s*$/i, '')
        .trim();

      const parenMatch = /\(([^)]+)\)\s*$/.exec(rawSummary);
      const metaSummary = parenMatch ? parenMatch[1] : 'Full untrimmed Markdown';
      const cleanTitle = parenMatch
        ? rawSummary.slice(0, parenMatch.index).trim()
        : rawSummary;

      rounds.push({
        roundNumber,
        title: cleanTitle,
        metaSummary,
        isIgnored: false,
        markdownBody: bodyMd,
      });
    }
  }

  // 2. Legacy fallback for older saved reports without `flymd-round` HTML markers
  if (rounds.length === 0 && sec4BodyMd) {
    const legacyParts = sec4BodyMd.split(/^###\s+Round\s+(\d+)\b([^\n]*)$/m);
    // legacyParts: [preamble, rNum1, titleRest1, body1, rNum2, titleRest2, body2, ...]
    for (let i = 1; i + 2 < legacyParts.length; i += 3) {
      const roundNumber = parseInt(legacyParts[i], 10);
      const titleSuffix = (legacyParts[i + 1] || '').trim();
      const body = (legacyParts[i + 2] || '').trim();
      const isIgnored = /ignored|duplicated/i.test(titleSuffix);
      rounds.push({
        roundNumber,
        title: `Round ${roundNumber} ${titleSuffix || 'Deliberation Summary'}`.trim(),
        metaSummary: isIgnored
          ? 'Skipped — Converged in previous round'
          : 'Click to expand round details',
        isIgnored,
        markdownBody: isIgnored ? '' : body,
      });
    }
  }

  return {
    beforeSection4Html: beforeSec4Md ? markdownService.render(beforeSec4Md) : '',
    rounds,
    afterSection4Html: afterSec4Md ? markdownService.render(afterSec4Md) : '',
  };
}

export interface CollapsibleReportRoundsViewProps {
  reportMarkdown: string;
  turnZoom: number;
}

export const CollapsibleReportRoundsView: React.FC<CollapsibleReportRoundsViewProps> =
  React.memo(({ reportMarkdown, turnZoom }) => {
    // Collapsed by default for ALL rounds (`{}`)
    const [expandedByRound, setExpandedByRound] = useState<
      Record<number, boolean>
    >({});

    const parsed = useMemo(
      () => parseReportIntoCollapsibleSections(reportMarkdown),
      [reportMarkdown]
    );

    const executedRounds = useMemo(
      () => parsed.rounds.filter((r) => !r.isIgnored),
      [parsed.rounds]
    );

    const anyExpanded = useMemo(
      () => executedRounds.some((r) => Boolean(expandedByRound[r.roundNumber])),
      [executedRounds, expandedByRound]
    );

    const handleToggleRound = useCallback(
      (roundNumber: number, isIgnored: boolean) => {
        if (isIgnored) return; // Ignored/duplicated rounds must remain strictly non-expanded
        setExpandedByRound((prev) => ({
          ...prev,
          [roundNumber]: !prev[roundNumber],
        }));
      },
      []
    );

    const handleToggleAllExecuted = useCallback(() => {
      if (anyExpanded) {
        setExpandedByRound({});
      } else {
        const next: Record<number, boolean> = {};
        for (const r of executedRounds) {
          next[r.roundNumber] = true;
        }
        setExpandedByRound(next);
      }
    }, [anyExpanded, executedRounds]);

    const fontStyle = useMemo(
      () => ({
        fontSize: `${(14 * turnZoom) / 100}px`,
        lineHeight: 1.65,
      }),
      [turnZoom]
    );

    return (
      <div className="space-y-6">
        {parsed.beforeSection4Html && (
          <div
            className="markdown-body text-slate-800 dark:text-slate-200 leading-relaxed transition-all"
            style={fontStyle}
            dangerouslySetInnerHTML={{ __html: parsed.beforeSection4Html }}
          />
        )}

        {parsed.rounds.length > 0 && (
          <section className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  4. Main Arguments, Critiques, Replies, and Revisions
                </h2>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  Full untrimmed Markdown for every executed debate round
                  (collapsed by default — click any executed round to expand).
                </p>
              </div>
              {executedRounds.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleAllExecuted}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold transition-colors"
                >
                  <ChevronsUpDown size={12} className="text-sky-500 dark:text-sky-400" />
                  <span>
                    {anyExpanded
                      ? 'Collapse All Rounds'
                      : 'Expand Executed Rounds'}
                  </span>
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {parsed.rounds.map((round) => {
                if (round.isIgnored) {
                  return (
                    <div
                      key={round.roundNumber}
                      aria-disabled="true"
                      title="This round was automatically skipped because successive agents already reached identical summary consensus in the previous round."
                      className="rounded-xl border border-amber-500/25 bg-amber-500/5 dark:bg-slate-950/60 px-4 py-3 flex flex-wrap items-center justify-between gap-2 opacity-75 select-none cursor-not-allowed"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Lock
                          size={14}
                          className="text-amber-500 dark:text-amber-400/80 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 flex-wrap">
                            <span>{round.title}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {round.metaSummary}
                          </div>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wide shrink-0">
                        <SkipForward size={10} />
                        Duplicated / Ignored
                      </span>
                    </div>
                  );
                }

                const isExpanded = Boolean(expandedByRound[round.roundNumber]);
                const roundHtml = isExpanded
                  ? markdownService.render(round.markdownBody)
                  : '';

                return (
                  <div
                    key={round.roundNumber}
                    className={`rounded-xl border transition-all overflow-hidden ${
                      isExpanded
                        ? 'border-sky-500/40 bg-white dark:bg-slate-950/80 shadow-md'
                        : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-950/45 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleRound(round.roundNumber, false)}
                      aria-expanded={isExpanded}
                      className="w-full px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-900/70 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isExpanded ? (
                          <ChevronDown
                            size={15}
                            className="text-sky-500 dark:text-sky-400 shrink-0"
                          />
                        ) : (
                          <ChevronRight
                            size={15}
                            className="text-slate-400 dark:text-slate-500 shrink-0"
                          />
                        )}
                        <CheckCircle2
                          size={14}
                          className="text-emerald-500 dark:text-emerald-400 shrink-0"
                        />
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {round.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/70 font-mono">
                          {round.metaSummary}
                        </span>
                        <span className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold">
                          {isExpanded ? 'Hide Details' : 'Read Full Markdown'}
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50">
                        <div
                          className="markdown-body w-full max-w-none text-slate-800 dark:text-slate-200 leading-relaxed"
                          style={fontStyle}
                          dangerouslySetInnerHTML={{ __html: roundHtml }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {parsed.afterSection4Html && (
          <div
            className="markdown-body text-slate-800 dark:text-slate-200 leading-relaxed pt-2 border-t border-slate-200 dark:border-slate-800/80 transition-all"
            style={fontStyle}
            dangerouslySetInnerHTML={{ __html: parsed.afterSection4Html }}
          />
        )}
      </div>
    );
  });

