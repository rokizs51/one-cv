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

describe('fitToPage — relevance backfill', () => {
  it('fills leftover page with score < MIN_SCORE items instead of ending half-empty', () => {
    // 3 items: 2 high score, 1 low score (below MIN_SCORE=2)
    const high1 = itemWithLines('high1', 10);
    const high2 = itemWithLines('high2', 10);
    const low = makeScoreed(
      makeItem({ id: 'low', canonicalText: 'x'.repeat(64) }),
      1, // below MIN_SCORE
    );

    const result = fitToPage([high1, high2, low], 1);
    const chosenIds = result.chosen.map((s) => s.item.id);
    // ~58 units stay free after the high scorers — the low scorer backfills them
    expect(chosenIds).toContain('high1');
    expect(chosenIds).toContain('high2');
    expect(chosenIds).toContain('low');
    expect(result.cuts).toHaveLength(0);
  });

  it('cuts items with score < MIN_SCORE with reason relevance once keepers exhaust the page', () => {
    const k1 = itemWithLines('k1', 40);
    const k2 = itemWithLines('k2', 38); // keepers fill exactly 78/78 units
    const low = makeScoreed(
      makeItem({ id: 'low', canonicalText: 'x'.repeat(64) }),
      1,
    );

    const result = fitToPage([k1, k2, low], 1);
    expect(result.chosen.map((s) => s.item.id)).toEqual(['k1', 'k2']);
    const lowCut = result.cuts.find((c) => c.item.item.id === 'low');
    expect(lowCut?.reason).toBe('relevance');
  });

  it('keepers always win contested space over fillers', () => {
    const keeper = itemWithLines('k', 70); // fits, leaves 8 units
    const bigFiller = makeScoreed(makeItem({ id: 'big', canonicalText: 'x'.repeat(20 * 64) }), 1);
    const smallFiller = makeScoreed(makeItem({ id: 'small', canonicalText: 'x'.repeat(8 * 64) }), 0);

    const result = fitToPage([keeper, bigFiller, smallFiller], 1);
    const chosenIds = result.chosen.map((s) => s.item.id);
    expect(chosenIds).toContain('k');
    expect(chosenIds).toContain('small'); // first-fit into the 8-unit leftover
    expect(result.cuts.find((c) => c.item.item.id === 'big')?.reason).toBe('relevance');
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

  it('sets overflow=true with mixed pinned+unpinned when pinned exceeds budget', () => {
    // Pinned: 80 lines (> 78 budget), unpinned: 10 lines
    const pinned = itemWithLines('pinned', 80, true);
    pinned.item.pinned = true;
    pinned.score = 5;
    
    const unpinned = itemWithLines('unpinned', 10);
    unpinned.score = 10;

    const result = fitToPage([pinned, unpinned], 1);
    
    // overflow must be true
    expect(result.overflow).toBe(true);
    
    // pinned must be in chosen (never cut)
    const chosenIds = result.chosen.map((s) => s.item.id);
    expect(chosenIds).toContain('pinned');
    
    // unpinned must be in cuts with reason='space'
    const unpinnedCut = result.cuts.find((c) => c.item.item.id === 'unpinned');
    expect(unpinnedCut).toBeDefined();
    expect(unpinnedCut?.reason).toBe('space');
    
    // pinned must NOT be in cuts
    const pinnedCut = result.cuts.find((c) => c.item.item.id === 'pinned');
    expect(pinnedCut).toBeUndefined();
  });

  it('correctly labels cut reasons when pinned overflows', () => {
    // Pinned: 90 lines (overflow), unpinned with mixed scores
    const pinned = itemWithLines('pinned', 90, true);
    pinned.item.pinned = true;
    pinned.score = 5;
    
    const lowScore = makeScoreed(
      makeItem({ id: 'low', canonicalText: 'x'.repeat(640) }), // 10 lines
      1, // below MIN_SCORE
    );
    
    const highScore = itemWithLines('high', 10);
    highScore.score = 10;

    const result = fitToPage([pinned, lowScore, highScore], 1);
    
    // overflow must be true
    expect(result.overflow).toBe(true);
    
    // low score must be cut with reason='relevance'
    const lowCut = result.cuts.find((c) => c.item.item.id === 'low');
    expect(lowCut).toBeDefined();
    expect(lowCut?.reason).toBe('relevance');
    
    // high score must be cut with reason='space' (not relevance, since score >= MIN_SCORE)
    const highCut = result.cuts.find((c) => c.item.item.id === 'high');
    expect(highCut).toBeDefined();
    expect(highCut?.reason).toBe('space');
    
    // pinned must be in chosen
    expect(result.chosen.map((s) => s.item.id)).toContain('pinned');
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

describe('fitToPage — reservedUnits (summary page-space)', () => {
  it('reserves budget so content that would fill the raw page gets cut', () => {
    // A 70-line item fits a 78-unit page…
    const fits = fitToPage([itemWithLines('a', 70)], 1);
    expect(fits.cuts.filter((c) => c.reason === 'space')).toHaveLength(0);

    // …but not once 20 units are reserved for the rendered doc.summary.
    const reserved = fitToPage([itemWithLines('a', 70)], 1, 20);
    expect(reserved.cuts.filter((c) => c.reason === 'space').map((c) => c.item.item.id)).toContain('a');
  });

  it('pinned content that fits rawly overflows once the reservation makes it not fit', () => {
    const pinned = [itemWithLines('big', 75, true)];
    expect(fitToPage(pinned, 1).overflow).toBe(false);
    expect(fitToPage(pinned, 1, 10).overflow).toBe(true);
  });

  it('clamps: a reservation of the whole budget leaves zero room but never goes negative', () => {
    const small = itemWithLines('tiny', 2);
    const result = fitToPage([small], 1, PAGE_UNITS[1]);
    expect(result.cuts.some((c) => c.reason === 'space')).toBe(true);
  });
});
