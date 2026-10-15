import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Claim an invite code for a user.
 * Returns false if the code is unknown or already claimed.
 * Returns true if successfully claimed.
 */
export async function claimInvite(
  supa: SupabaseClient,
  code: string,
  userId: string
): Promise<boolean> {
  // First check if the invite exists and is unclaimed
  const { data: existing } = await supa
    .from('invites')
    .select('code, claimed_by')
    .eq('code', code)
    .single();

  if (!existing || existing.claimed_by !== null) {
    return false;
  }

  // Attempt to claim it
  const { error } = await supa
    .from('invites')
    .update({
      claimed_by: userId,
      claimed_at: new Date().toISOString(),
    })
    .eq('code', code);

  return !error;
}

/**
 * Check if an invite code exists (for signup validation).
 * This is a server-side function that uses an anon client.
 */
export async function inviteExists(code: string): Promise<boolean> {
  // This function needs to create its own anon client
  // We'll import it lazily to avoid circular dependencies
  const { createAnonClient } = await import('./client');
  const supa = createAnonClient();

  const { data } = await supa
    .from('invites')
    .select('code')
    .eq('code', code)
    .single();

  return !!data;
}
