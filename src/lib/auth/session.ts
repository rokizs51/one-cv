import { cookies } from 'next/headers';
import { createRouteClient } from '@/lib/db/client';

/**
 * Get the current authenticated user from the session.
 * Returns { id, email } if authenticated, null otherwise.
 * Uses cookies() from next/headers to read the session.
 */
export async function getSessionUser(): Promise<{ id: string; email: string } | null> {
  const cookieStore = await cookies();

  const supabase = await createRouteClient(cookieStore);

  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }

  return { id: user.id, email: user.email! };
}
