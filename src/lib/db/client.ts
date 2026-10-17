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

/**
 * Minimal structural view of next/headers' `await cookies()` result — enough
 * to bridge Supabase's cookie adapter to it without importing Next types here.
 */
export interface RouteCookieStore {
  getAll(): { name: string; value: string }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set(name: string, value: string, options?: any): void;
}

/**
 * THE cookie-session bootstrap for route handlers and server helpers.
 * The Supabase↔Next cookie bridge was previously copy-pasted into eight
 * files; this is now the single place session-refresh handling (and the
 * options-shape cast) lives. Use from any route handler:
 *
 *   const cookieStore = await cookies();
 *   const supabase = await createRouteClient(cookieStore);
 */
export async function createRouteClient(cookieStore: RouteCookieStore): Promise<SupabaseClient> {
  return createServerClient(
    () => cookieStore.getAll(),
    (cookiesToSet) => {
      for (const { name, value, options } of cookiesToSet) {
        cookieStore.set(name, value, options);
      }
    }
  );
}
