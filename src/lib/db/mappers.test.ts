import { describe, it, expect } from 'vitest';
import { rowToProfileItem, profileItemToRow, type DbRow } from './mappers';
import type { ProfileItem } from '@/lib/domain/types';

describe('mappers', () => {
  describe('rowToProfileItem', () => {
    it('converts snake_case row to camelCase ProfileItem', () => {
      const row: DbRow = {
        id: 'item-123',
        profile_id: 'profile-456',
        type: 'experience',
        payload: { title: 'Engineer', company: 'Acme' },
        canonical_text: 'Worked on X',
        source: 'manual',
        provenance: [{ text: 'Updated', originalText: 'Old', fromResumeId: 'r1', at: '2026-10-15T10:00:00Z' }],
        pinned: true,
        position: 2,
      };

      const item = rowToProfileItem(row);

      expect(item.id).toBe('item-123');
      expect(item.profileId).toBe('profile-456');
      expect(item.type).toBe('experience');
      expect(item.payload).toEqual({ title: 'Engineer', company: 'Acme' });
      expect(item.canonicalText).toBe('Worked on X');
      expect(item.source).toBe('manual');
      expect(item.provenance).toEqual([{ text: 'Updated', originalText: 'Old', fromResumeId: 'r1', at: '2026-10-15T10:00:00Z' }]);
      expect(item.pinned).toBe(true);
      expect(item.position).toBe(2);
    });

    it('handles null source as "manual"', () => {
      const row: DbRow = {
        id: 'item-1',
        profile_id: 'profile-1',
        type: 'skill',
        payload: {},
        canonical_text: 'TypeScript',
        source: null,
        provenance: [],
        pinned: false,
        position: 0,
      };

      const item = rowToProfileItem(row);

      expect(item.source).toBe('manual');
    });

    it('handles empty provenance array', () => {
      const row: DbRow = {
        id: 'item-1',
        profile_id: 'profile-1',
        type: 'award',
        payload: {},
        canonical_text: 'Best Employee',
        source: 'import',
        provenance: [],
        pinned: false,
        position: 5,
      };

      const item = rowToProfileItem(row);

      expect(item.provenance).toEqual([]);
    });
  });

  describe('profileItemToRow', () => {
    it('converts camelCase ProfileItem to snake_case row', () => {
      const item: ProfileItem = {
        id: 'item-123',
        profileId: 'profile-456',
        type: 'experience',
        payload: { title: 'Engineer', company: 'Acme' },
        canonicalText: 'Worked on X',
        source: 'manual',
        provenance: [{ text: 'Updated', originalText: 'Old', fromResumeId: 'r1', at: '2026-10-15T10:00:00Z' }],
        pinned: true,
        position: 2,
      };

      const row = profileItemToRow(item);

      expect(row.id).toBe('item-123');
      expect(row.profile_id).toBe('profile-456');
      expect(row.type).toBe('experience');
      expect(row.payload).toEqual({ title: 'Engineer', company: 'Acme' });
      expect(row.canonical_text).toBe('Worked on X');
      expect(row.source).toBe('manual');
      expect(row.provenance).toEqual([{ text: 'Updated', originalText: 'Old', fromResumeId: 'r1', at: '2026-10-15T10:00:00Z' }]);
      expect(row.pinned).toBe(true);
      expect(row.position).toBe(2);
    });
  });

  describe('round-trip', () => {
    it('row → item → row preserves data', () => {
      const originalRow: DbRow = {
        id: 'item-abc',
        profile_id: 'profile-xyz',
        type: 'project',
        payload: { name: 'ResumTailor', tech: ['Next.js', 'TypeScript'] },
        canonical_text: 'Built a resume tool',
        source: 'manual',
        provenance: [
          { text: 'V2', originalText: 'V1', fromResumeId: 'r1', at: '2026-10-15T10:00:00Z' },
        ],
        pinned: false,
        position: 3,
      };

      const item = rowToProfileItem(originalRow);
      const roundTripRow = profileItemToRow(item);

      expect(roundTripRow).toEqual(originalRow);
    });

    it('item → row → item preserves data', () => {
      const originalItem: ProfileItem = {
        id: 'item-1',
        profileId: 'profile-1',
        type: 'education',
        payload: { degree: 'BS', school: 'MIT' },
        canonicalText: 'BS from MIT',
        source: 'import',
        provenance: [],
        pinned: true,
        position: 1,
      };

      const row = profileItemToRow(originalItem);
      const roundTripItem = rowToProfileItem(row);

      expect(roundTripItem).toEqual(originalItem);
    });
  });
});
