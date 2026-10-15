import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProfileItem, ItemType } from '@/lib/domain/types';
import { applyAccept, revertLast } from '@/lib/domain/provenance';
import { rowToProfileItem, profileItemToRow } from './mappers';

/**
 * List all profile items for a profile.
 */
export async function listItems(
  supa: SupabaseClient,
  profileId: string
): Promise<ProfileItem[]> {
  const { data, error } = await supa
    .from('profile_items')
    .select('*')
    .eq('profile_id', profileId)
    .order('position', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(rowToProfileItem);
}

/**
 * Create a new profile item.
 */
export async function createItem(
  supa: SupabaseClient,
  profileId: string,
  input: {
    type: ItemType;
    payload: Record<string, unknown>;
    canonicalText: string;
    position?: number;
  }
): Promise<ProfileItem> {
  const { data, error } = await supa
    .from('profile_items')
    .insert({
      profile_id: profileId,
      type: input.type,
      payload: input.payload,
      canonical_text: input.canonicalText,
      position: input.position ?? 0,
    })
    .select('*')
    .single();

  if (error) throw error;
  return rowToProfileItem(data);
}

/**
 * Update a profile item. Null values in patch are treated as no-change.
 */
export async function updateItem(
  supa: SupabaseClient,
  itemId: string,
  patch: Partial<Pick<ProfileItem, 'payload' | 'canonicalText' | 'pinned' | 'position'>>
): Promise<void> {
  const row: Record<string, unknown> = {};

  if (patch.payload !== undefined) row.payload = patch.payload;
  if (patch.canonicalText !== undefined) row.canonical_text = patch.canonicalText;
  if (patch.pinned !== undefined) row.pinned = patch.pinned;
  if (patch.position !== undefined) row.position = patch.position;

  await supa.from('profile_items').update(row).eq('id', itemId);
}

/**
 * Accept new text for a profile item.
 * Uses applyAccept from provenance.ts to compute the new state,
 * then writes canonical_text and provenance to the database.
 */
export async function acceptText(
  supa: SupabaseClient,
  itemId: string,
  item: ProfileItem,
  newText: string,
  fromResumeId: string
): Promise<ProfileItem> {
  const at = new Date().toISOString();
  const updated = applyAccept(item, newText, fromResumeId, at);

  await supa
    .from('profile_items')
    .update({
      canonical_text: updated.canonicalText,
      provenance: updated.provenance,
    })
    .eq('id', itemId);

  return updated;
}

/**
 * Revert the last text change for a profile item.
 * Uses revertLast from provenance.ts to compute the new state,
 * then writes canonical_text and provenance to the database.
 */
export async function revertText(
  supa: SupabaseClient,
  itemId: string,
  item: ProfileItem
): Promise<ProfileItem> {
  const updated = revertLast(item);

  await supa
    .from('profile_items')
    .update({
      canonical_text: updated.canonicalText,
      provenance: updated.provenance,
    })
    .eq('id', itemId);

  return updated;
}
