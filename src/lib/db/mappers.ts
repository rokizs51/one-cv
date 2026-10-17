import type { ProfileItem, ItemType } from '@/lib/domain/types';

export type DbRow = Record<string, unknown>;

/**
 * Convert a database row (snake_case) to a ProfileItem (camelCase).
 */
export function rowToProfileItem(r: DbRow): ProfileItem {
  return {
    id: r.id as string,
    profileId: r.profile_id as string,
    type: r.type as ItemType,
    payload: (r.payload ?? {}) as Record<string, unknown>,
    canonicalText: r.canonical_text as string,
    source: (r.source as 'manual' | 'import' | null) ?? 'manual',
    provenance: (r.provenance ?? []) as ProfileItem['provenance'],
    pinned: (r.pinned as boolean) ?? false,
    position: (r.position as number) ?? 0,
  };
}

/**
 * Convert a ProfileItem (camelCase) to a database row (snake_case).
 */
export function profileItemToRow(i: ProfileItem): DbRow {
  return {
    id: i.id,
    profile_id: i.profileId,
    type: i.type,
    payload: i.payload,
    canonical_text: i.canonicalText,
    source: i.source,
    provenance: i.provenance,
    pinned: i.pinned,
    position: i.position,
  };
}
