import type { JdExtraction, ProfileItem } from '@/lib/domain/types';
import { keywordScore, type ScoredItem } from './scoring';
import type { FitResultSnapshot } from './fit-types';

// Re-export FitResultSnapshot for Task 4 compatibility
export type { FitResultSnapshot } from './fit-types';

// Constants per brief
export const PAGE_UNITS: Record<1 | 2, number> = { 1: 78, 2: 156 };
export const MIN_SCORE = 2;

// Character width at 10pt on A4 with margins (~450pt usable / 7pt per char)
const CHARS_PER_LINE = 64;

export interface Cut {
  item: ScoredItem;
  reason: 'relevance' | 'space';
}

export interface FitResult {
  chosen: ScoredItem[];
  cuts: Cut[];
  overflow: boolean;
}

/**
 * Wrapped-line estimate for raw text (the doc.summary channel is plain text
 * that never exists as a ProfileItem during refit).
 */
export function estimateTextLines(text: string, width?: number): number {
  const charsPerLine = width ? Math.floor(width / 7) : CHARS_PER_LINE;
  if (!text) return 1;

  const paragraphs = text.split('\n');
  let lines = 0;
  for (const p of paragraphs) {
    if (p.length === 0) {
      lines += 1;
    } else {
      lines += Math.max(1, Math.ceil(p.length / charsPerLine));
    }
  }
  return lines;
}

/**
 * Estimates the number of wrapped lines a ProfileItem will occupy.
 * Uses canonicalText length divided by chars-per-line heuristic.
 */
export function estimateLines(item: ProfileItem, width?: number): number {
  return estimateTextLines(item.canonicalText, width);
}

/**
 * Fits scored items to page budget using the algorithm:
 * 1. Pinned items are NEVER cut; always in chosen
 * 2. Unpinned items with score >= MIN_SCORE are chosen by score desc while
 *    they fit; the rest are cut with reason 'space'
 * 3. Items with score < MIN_SCORE backfill whatever page is left — a 1-page
 *    selection should fill the page instead of ending half-empty — and are
 *    cut with reason 'relevance' only when even the leftovers don't fit
 * 4. If pinned alone exceeds the remaining budget → overflow: true
 *
 * `reservedUnits` holds back line budget for content that renders on the page
 * but is deliberately not part of `scored` — namely doc.summary (the
 * career_snapshot is excluded from scoring so it can never appear twice).
 * Without the reservation the summary's rendered lines go uncounted and a
 * "fitting" doc silently spills to page 2.
 */
export function fitToPage(scored: ScoredItem[], pageLimit: 1 | 2, reservedUnits: number = 0): FitResult {
  const budget = Math.max(0, PAGE_UNITS[pageLimit] - Math.max(0, reservedUnits));
  
  // Separate pinned from unpinned
  const pinned: ScoredItem[] = [];
  const unpinned: ScoredItem[] = [];
  
  for (const s of scored) {
    if (s.item.pinned) {
      pinned.push(s);
    } else {
      unpinned.push(s);
    }
  }
  
  // All pinned items are chosen (never cut)
  const chosen: ScoredItem[] = [...pinned];
  const cuts: Cut[] = [];
  
  // Calculate lines used by pinned
  let pinnedLines = 0;
  for (const s of pinned) {
    pinnedLines += estimateLines(s.item);
  }
  
  // Check overflow
  const overflow = pinnedLines > budget;

  // Keepers (relevant enough to compete for space) vs fillers (below the
  // relevance bar — they only get whatever page is left).
  const keepers: ScoredItem[] = [];
  const fillers: ScoredItem[] = [];
  for (const s of unpinned) {
    (s.score >= MIN_SCORE ? keepers : fillers).push(s);
  }
  keepers.sort((a, b) => b.score - a.score);
  fillers.sort((a, b) => b.score - a.score);

  let usedLines = pinnedLines;
  const takeIfFits = (s: ScoredItem): boolean => {
    const lines = estimateLines(s.item);
    if (usedLines + lines <= budget) {
      chosen.push(s);
      usedLines += lines;
      return true;
    }
    return false;
  };

  // Space pass: keepers first, highest score wins.
  for (const s of keepers) {
    if (!takeIfFits(s)) cuts.push({ item: s, reason: 'space' });
  }

  // Backfill pass: fill the rest of the page rather than leaving it short.
  for (const s of fillers) {
    if (!takeIfFits(s)) cuts.push({ item: s, reason: 'relevance' });
  }

  return { chosen, cuts, overflow };
}

/**
 * Scores a profile's items against a JD and fits them to the page. Shared by
 * generateResume (Task 10), the live-refit route (Task 13), and disposition
 * recomputation, so the three can never drift on page-space accounting.
 *
 * - career_snapshot is excluded from scoring (it renders as doc.summary,
 *   never a section) — this keeps a pinned snapshot from being force-kept
 *   into sections and stops it double-counting page space.
 * - `summaryText` is the text ACTUALLY rendered as doc.summary right now
 *   (pre-disposition: the snapshot verbatim in both modes; post-accept: the
 *   composed/edited headline). Its lines are held back from the budget —
 *   a mode-based constant under-counted long snapshots (they silently
 *   pushed the CV to page 2 with no wont_fit signal).
 *
 * `textOverrides` (itemId → text) score proposed/current doc text ahead of
 * the stored canonicalText, so the panel matches the page a user sees.
 */
export function buildFit(
  items: ProfileItem[],
  jd: JdExtraction,
  pageLimit: 1 | 2,
  summaryText: string | null,
  textOverrides?: Record<string, string>
): { scored: ScoredItem[]; fit: FitResult; snapshotItem: ProfileItem | null } {
  const override = (item: ProfileItem): ProfileItem =>
    textOverrides && textOverrides[item.id] !== undefined
      ? { ...item, canonicalText: textOverrides[item.id] }
      : item;

  const snapshotItem =
    items.find((item) => item.type === 'career_snapshot') ?? null;

  const scored = items
    .filter((item) => item.type !== 'career_snapshot')
    .map((item) => keywordScore(override(item), jd));

  const reserveUnits = summaryText ? estimateTextLines(summaryText) : 0;

  const fit = fitToPage(scored, pageLimit, reserveUnits);
  return { scored, fit, snapshotItem };
}

/**
 * Converts FitResult to FitResultSnapshot shape for Task 4 compatibility.
 */
export function snapshotOf(f: FitResult): FitResultSnapshot {
  return {
    chosen: f.chosen.map((s) => s.item.id),
    cuts: f.cuts.map((c) => ({
      itemId: c.item.item.id,
      reason: c.reason,
    })),
    overflow: f.overflow,
  };
}
