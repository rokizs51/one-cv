import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Hard-delete the CALLER's entire account. Delegates to the
 * delete_current_user() SECURITY DEFINER function (migration 0003), which
 * removes every owned row AND the auth.users account itself — so re-login
 * genuinely fails afterward. The app never holds the service key; the
 * definer function runs as postgres and scopes strictly to auth.uid().
 */
export async function deleteCurrentAccount(supa: SupabaseClient): Promise<void> {
  const { error } = await supa.rpc('delete_current_user');
  if (error) throw error;
}
