import { createBrowserClient as createBrowserSupabaseClient } from '@supabase/ssr';
import { createServerClient as createServerSupabaseClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Create a Supabase client for browser-side usage.
 * Reads environment variables lazily at call time.
 */
export function createBrowserClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createBrowserSupabaseClient(url, anonKey);
}

/**
 * Create a Supabase client for server-side usage (Next.js App Router).
 * Reads environment variables lazily at call time.
 * Requires cookies() to be passed for proper session management.
 */
export async function createServerClient(
  getAll: () => { name: string; value: string }[],
  setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => void
): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerSupabaseClient(url, anonKey, {
    cookies: {
      getAll,
      setAll,
    },
  });
}
