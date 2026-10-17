import { describe, expect, it } from 'vitest';
import type { ProfileItem } from '@/lib/domain/types';
import type { ScoredItem } from './scoring';
import { fitToPage, snapshotOf, estimateLines, PAGE_UNITS, MIN_SCORE } from './fit';

// Helper to build a ProfileItem with controlled text length
function makeItem(overrides: Partial<ProfileItem> & { id: string }): ProfileItem {
  return {
    profileId: 'p1',
    type: 'experience',
    payload: {},
    canonicalText: '',
    source: 'manual',
    provenance: [],
    pinned: false,
    position: 0,
    ...overrides,
  };
}

// Helper to build a ScoredItem with explicit line estimate
function makeScoreed(
  item: ProfileItem,
  score: number,
  section: ScoredItem['section'] = 'experience',
): ScoredItem {
  return { item, score, matchedKeywords: [], section };
}

// Use a long canonicalText so estimateLines returns a predictable number
// Each 'x' char contributes to line count. We'll use items with specific text lengths.
// For tests that care about exact line counts, we create text of known length.
function itemWithLines(id: string, lines: number, pinned = false): ScoredItem {
  // We need to know how estimateLines maps text to lines.
  // Use a single long line of known character count.
  // At default width 450 and ~7pt per char = ~64 chars/line.
  // To get exactly N lines, use N*64 chars (one long paragraph).
  const charsPerLine = 64;
  const text = 'x'.repeat(lines * charsPerLine);
  const item = makeItem({ id, canonicalText: text, pinned });
  return makeScoreed(item, 5);
}

describe('PAGE_UNITS and MIN_SCORE constants', () => {
  it('PAGE_UNITS[1] = 78, PAGE_UNITS[2] = 156', () => {
    expect(PAGE_UNITS[1]).toBe(78);
    expect(PAGE_UNITS[2]).toBe(156);
  });

  it('MIN_SCORE = 2', () => {
    expect(MIN_SCORE).toBe(2);
  });
});

describe('estimateLines', () => {
  it('returns at least 1 for any non-empty item', () => {
    const item = makeItem({ id: 'a', canonicalText: 'Hello world' });
    expect(estimateLines(item)).toBeGreaterThanOrEqual(1);
  });

  it('returns more lines for longer text', () => {
    const short = makeItem({ id: 'a', canonicalText: 'Short' });
    const long = makeItem({ id: 'b', canonicalText: 'x'.repeat(500) });
    expect(estimateLines(long)).toBeGreaterThan(estimateLines(short));
  });
});

describe('fitToPage — relevance cuts', () => {
  it('cuts items with score < MIN_SCORE even when space is available', () => {
    // 3 items: 2 high score, 1 low score (below MIN_SCORE=2)
    const high1 = itemWithLines('high1', 10);
    const high2 = itemWithLines('high2', 10);
    const low = makeScoreed(
      makeItem({ id: 'low', canonicalText: 'x'.repeat(64) }),
      1, // below MIN_SCORE
    );

    const result = fitToPage([high1, high2, low], 1);
    const cutIds = result.cuts.map((c) => c.item.item.id);
    expect(cutIds).toContain('low');
    // Chosen should only contain high scorers
    expect(result.chosen.map((s) => s.item.id)).toContain('high1');
    expect(result.chosen.map((s) => s.item.id)).toContain('high2');
    expect(result.chosen.map((s) => s.item.id)).not.toContain('low');
    // Reason must be 'relevance'
    const lowCut = result.cuts.find((c) => c.item.item.id === 'low');
    expect(lowCut?.reason).toBe('relevance');
  });

  it('does not cut items with score >= MIN_SCORE for relevance', () => {
    const item = itemWithLines('a', 10);
    item.item.pinned = false;
    // Score = 2 = MIN_SCORE → should NOT be cut for relevance
    const scored = makeScoreed(item.item, 2);
    // Override the canonicalText to control lines
    const result = fitToPage([scored], 1);
    expect(result.chosen.map((s) => s.item.id)).toContain('a');
    expect(result.cuts.find((c) => c.item.item.id === 'a')?.reason).not.toBe('relevance');
  });
});

describe('fitToPage — space cuts', () => {
  it('keeps higher-scoring items when space is limited', () => {
    // Fill up the page with high-scoring items, then one more must be cut
    // PAGE_UNITS[1] = 78 lines
    const aBase = itemWithLines('a', 40); // 40 lines
    const bBase = itemWithLines('b', 40); // 40 lines → total 80 > 78, so one must go
    // a has higher score; b has lower score
    const scoredA: ScoredItem = { ...aBase, score: 10 };
    const scoredB: ScoredItem = { ...bBase, score: 3 };

    const result = fitToPage([scoredA, scoredB], 1);
    const chosenIds = result.chosen.map((s) => s.item.id);
    expect(chosenIds).toContain('a');
    // b should be cut for space
    const bCut = result.cuts.find((c) => c.item.item.id === 'b');
    expect(bCut).toBeDefined();
    expect(bCut?.reason).toBe('space');
  });
});

describe('fitToPage — pinned items', () => {
  it('pinned items never appear in cuts', () => {
    const pinned = itemWithLines('p1', 70, true);
    pinned.item.pinned = true;
    pinned.score = 1; // even low score → pinned not cut for relevance
    const unpinned = itemWithLines('u1', 10);
    unpinned.score = 10;

    const result = fitToPage([pinned, unpinned], 1);
    const cutIds = result.cuts.map((c) => c.item.item.id);
    expect(cutIds).not.toContain('p1');
    expect(result.chosen.map((s) => s.item.id)).toContain('p1');
  });

  it('sets overflow=true when pinned alone exceeds PAGE_UNITS[1]', () => {
    const pinned = itemWithLines('p1', 80, true); // 80 > 78
    pinned.item.pinned = true;
    pinned.score = 5;

    const result = fitToPage([pinned], 1);
    expect(result.overflow).toBe(true);
    expect(result.chosen.map((s) => s.item.id)).toContain('p1');
    // pinned not in cuts
    const cutIds = result.cuts.map((c) => c.item.item.id);
    expect(cutIds).not.toContain('p1');
  });

  it('does not set overflow when pinned fits within budget', () => {
    const pinned = itemWithLines('p1', 40, true);
    pinned.item.pinned = true;
    pinned.score = 5;

    const result = fitToPage([pinned], 1);
    expect(result.overflow).toBe(false);
  });
});

describe('fitToPage — 2-page toggle', () => {
  it('doubles budget when pageLimit=2', () => {
    // Items that fit in 2 pages but not 1
    // PAGE_UNITS[2] = 156
    const items: ScoredItem[] = [];
    for (let i = 0; i < 10; i++) {
      items.push(itemWithLines(`item${i}`, 15)); // 10 * 15 = 150 lines
    }

    const result1 = fitToPage(items, 1);
    const result2 = fitToPage(items, 2);

    // With 1 page (78 lines), not all fit; with 2 pages (156 lines), all fit
    expect(result2.chosen.length).toBeGreaterThanOrEqual(result1.chosen.length);
    expect(result2.chosen.length).toBe(10); // all fit in 2 pages
    expect(result1.chosen.length).toBeLessThan(10); // not all fit in 1 page
  });
});

describe('snapshotOf', () => {
  it('returns FitResultSnapshot with correct shape', () => {
    const item = itemWithLines('a', 10);
    const result = fitToPage([item], 1);
    const snap = snapshotOf(result);
    expect(snap).toHaveProperty('chosen');
    expect(snap).toHaveProperty('cuts');
    expect(snap).toHaveProperty('overflow');
    expect(Array.isArray(snap.chosen)).toBe(true);
    expect(Array.isArray(snap.cuts)).toBe(true);
    // chosen is string[] of item ids
    expect(typeof snap.chosen[0]).toBe('string');
    // cuts have itemId and reason
    if (snap.cuts.length > 0) {
      expect(typeof snap.cuts[0].itemId).toBe('string');
      expect(['relevance', 'space']).toContain(snap.cuts[0].reason);
    }
  });
});
