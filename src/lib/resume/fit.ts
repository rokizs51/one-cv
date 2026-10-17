import type { GenMode, JdExtraction, ProfileItem } from '@/lib/domain/types';
import { keywordScore, type ScoredItem } from './scoring';
import type { FitResultSnapshot } from './fit-types';

// Re-export FitResultSnapshot for Task 4 compatibility
export type { FitResultSnapshot } from './fit-types';

// Constants per brief
export const PAGE_UNITS: Record<1 | 2, number> = { 1: 78, 2: 156 };
export const MIN_SCORE = 2;
// Line budget reserved for the composed summary (rendered doc.summary, never
// scored): the prompt caps it at 3 lines; +1 slack for wrapping.
export const ENHANCE_SUMMARY_RESERVE_UNITS = 4;

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
 * Estimates the number of wrapped lines a ProfileItem will occupy.
 * Uses canonicalText length divided by chars-per-line heuristic.
 */
export function estimateLines(item: ProfileItem, width?: number): number {
  const charsPerLine = width ? Math.floor(width / 7) : CHARS_PER_LINE;
  const text = item.canonicalText;
  if (!text) return 1;
  
  // Split by newlines and count wrapped lines per paragraph
  const paragraphs = text.split('\n');
  let lines = 0;
  for (const p of paragraphs) {
    if (p.length === 0) {
      lines += 1; // empty line counts as 1
    } else {
      lines += Math.max(1, Math.ceil(p.length / charsPerLine));
    }
  }
  return lines;
}

/**
 * Fits scored items to page budget using the algorithm:
 * 1. Pinned items are NEVER cut; always in chosen
 * 2. Unpinned items with score < MIN_SCORE are cut with reason 'relevance'
 * 3. Remaining unpinned sorted by score desc, accumulated until budget exhausted
 * 4. Rest cut with reason 'space'
 * 5. If pinned alone exceeds the remaining budget → overflow: true
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
  
  // Remaining budget for unpinned items
  const remainingBudget = Math.max(0, budget - pinnedLines);
  
  // Relevance pass: cut unpinned items with score < MIN_SCORE
  const unpinnedAfterRelevance: ScoredItem[] = [];
  for (const s of unpinned) {
    if (s.score < MIN_SCORE) {
      cuts.push({ item: s, reason: 'relevance' });
    } else {
      unpinnedAfterRelevance.push(s);
    }
  }
  
  // Sort remaining unpinned by score desc
  unpinnedAfterRelevance.sort((a, b) => b.score - a.score);
  
  // Space pass: accumulate until budget exhausted
  let usedLines = pinnedLines;
  for (const s of unpinnedAfterRelevance) {
    const lines = estimateLines(s.item);
    if (usedLines + lines <= budget) {
      chosen.push(s);
      usedLines += lines;
    } else {
      cuts.push({ item: s, reason: 'space' });
    }
  }
  
  return { chosen, cuts, overflow };
}

/**
 * Scores a profile's items against a JD and fits them to the page, applying
 * the SAME summary-reserve rule the generation pipeline uses. Shared by
 * generateResume (Task 10) and the live-refit route (Task 13) so the two can
 * never drift on how much page space the summary consumes.
 *
 * - career_snapshot is excluded from scoring (it renders as doc.summary,
 *   never a section) — this keeps a pinned snapshot from being force-kept
 *   into sections and stops it double-counting page space.
 * - reserveUnits: as-is → the snapshot's own wrapped lines; enhance → the
 *   ≤3-line composed summary budget; no snapshot → 0 (never fabricated).
 *
 * `textOverrides` (itemId → edited text) let the refit route score proposed
 * edits before they're written to the profile.
 */
export function buildFit(
  items: ProfileItem[],
  jd: JdExtraction,
  pageLimit: 1 | 2,
  mode: GenMode,
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

  const reserveUnits = !snapshotItem
    ? 0
    : mode === 'as_is'
      ? estimateLines(snapshotItem)
      : ENHANCE_SUMMARY_RESERVE_UNITS;

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
