import type { ProfileItem } from '@/lib/domain/types';
import type { ScoredItem } from './scoring';
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
 * 5. If pinned alone exceeds PAGE_UNITS → overflow: true
 */
export function fitToPage(scored: ScoredItem[], pageLimit: 1 | 2): FitResult {
  const budget = PAGE_UNITS[pageLimit];
  
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
