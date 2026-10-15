import { describe, it, expect } from 'vitest';
import { applyAccept, revertLast } from './provenance';
import type { ProfileItem } from './types';

export function makeItem(overrides: Partial<ProfileItem> = {}): ProfileItem {
  return {
    id: 'item-1',
    profileId: 'profile-1',
    type: 'experience',
    payload: {},
    canonicalText: 'Original text',
    source: 'manual',
    provenance: [],
    pinned: false,
    position: 0,
    ...overrides,
  };
}

describe('provenance', () => {
  describe('applyAccept', () => {
    it('keeps chain: two accepts produce 2 entries', () => {
      const item1 = makeItem({ canonicalText: 'First version' });
      const item2 = applyAccept(item1, 'Second version', 'resume-1', '2026-10-15T10:00:00Z');
      const item3 = applyAccept(item2, 'Third version', 'resume-2', '2026-10-15T11:00:00Z');

      expect(item3.provenance).toHaveLength(2);
      expect(item3.canonicalText).toBe('Third version');
    });

    it('originalText of 2nd accept = text of 1st accept', () => {
      const item1 = makeItem({ canonicalText: 'Original' });
      const item2 = applyAccept(item1, 'First edit', 'resume-1', '2026-10-15T10:00:00Z');
      const item3 = applyAccept(item2, 'Second edit', 'resume-2', '2026-10-15T11:00:00Z');

      expect(item3.provenance[1].originalText).toBe('First edit');
      expect(item3.provenance[0].text).toBe('First edit');
    });

    it('sets canonicalText to newText', () => {
      const item = makeItem({ canonicalText: 'Old' });
      const result = applyAccept(item, 'New', 'resume-1', '2026-10-15T10:00:00Z');

      expect(result.canonicalText).toBe('New');
    });

    it('pushes provenance entry with correct fields', () => {
      const item = makeItem({ canonicalText: 'Original', provenance: [] });
      const result = applyAccept(item, 'Updated', 'resume-123', '2026-10-15T10:00:00Z');

      expect(result.provenance).toHaveLength(1);
      expect(result.provenance[0]).toEqual({
        text: 'Updated',
        originalText: 'Original',
        fromResumeId: 'resume-123',
        at: '2026-10-15T10:00:00Z',
      });
    });
  });

  describe('revertLast', () => {
    it('restores and pops the last provenance entry', () => {
      const item = makeItem({
        canonicalText: 'Current',
        provenance: [
          { text: 'First edit', originalText: 'Original', fromResumeId: 'r1', at: 't1' },
          { text: 'Second edit', originalText: 'First edit', fromResumeId: 'r2', at: 't2' },
        ],
      });

      const result = revertLast(item);

      expect(result.provenance).toHaveLength(1);
      expect(result.canonicalText).toBe('First edit');
      expect(result.provenance[0].text).toBe('First edit');
    });

    it('reverts to originalText when only one entry', () => {
      const item = makeItem({
        canonicalText: 'Edited',
        provenance: [
          { text: 'Edited', originalText: 'Original', fromResumeId: 'r1', at: 't1' },
        ],
      });

      const result = revertLast(item);

      expect(result.provenance).toHaveLength(0);
      expect(result.canonicalText).toBe('Original');
    });

    it('returns item unchanged if provenance is empty', () => {
      const item = makeItem({
        canonicalText: 'Stable',
        provenance: [],
      });

      const result = revertLast(item);

      expect(result).toEqual(item);
      expect(result.canonicalText).toBe('Stable');
      expect(result.provenance).toHaveLength(0);
    });
  });
});
