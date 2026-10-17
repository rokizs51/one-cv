import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/db/client';

/**
 * Get the current authenticated user from the session.
 * Returns { id, email } if authenticated, null otherwise.
 * Uses cookies() from next/headers to read the session.
 */
export async function getSessionUser(): Promise<{ id: string; email: string } | null> {
  const cookieStore = await cookies();
  
  const supabase = await createServerClient(
    () => cookieStore.getAll().map(c => ({ name: c.name, value: c.value })),
    (cookiesToSet) => {
      cookiesToSet.forEach(({ name, value, options }) => {
        cookieStore.set(name, value, options as any);
      });
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }

  return { id: user.id, email: user.email! };
}
