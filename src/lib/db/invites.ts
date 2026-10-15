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
  const { data, error } = await supa
    .from('invites')
    .update({
      claimed_by: userId,
      claimed_at: new Date().toISOString(),
    })
    .eq('code', code)
    .eq('claimed_by', null)
    .select('code');

  if (error) throw error;
  
  return data.length === 1;
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

  const { data, error } = await supa
    .from('invites')
    .select('code')
    .eq('code', code)
    .single();

  if (error) {
    // PGRST116 = no rows found, which means invite doesn't exist
    if (error.code === 'PGRST116') {
      return false;
    }
    throw error;
  }

  return !!data;
}
