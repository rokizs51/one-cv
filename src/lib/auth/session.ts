import { cookies } from 'next/headers';
import { connection } from 'next/server';
import { createRouteClient } from '@/lib/db/client';

/**
 * Get the current authenticated user from the session.
 * Returns { id, email } if authenticated, null otherwise.
 * Uses cookies() from next/headers to read the session.
 *
 * connection() first: with Cache Components, `instant = false` skips
 * validation but does NOT prevent the prerender pass, and constructing the
 * Supabase client registers an onAuthStateChange listener whose detached
 * async init reads Date.now() — flagged as blocking-prerender-current-time.
 * Marking the render request-time before that happens is the sanctioned fix.
 */
export async function getSessionUser(): Promise<{ id: string; email: string } | null> {
  await connection();

  const cookieStore = await cookies();

  const supabase = await createRouteClient(cookieStore);

  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }

  return { id: user.id, email: user.email! };
}
