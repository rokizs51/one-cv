import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createRouteClient } from '@/lib/db/client';
import { getSessionUser } from '@/lib/auth/session';
import { getOrCreateProfile } from '@/lib/db/profiles';
import TopBar from '@/components/top-bar';
import SettingsApp from '@/components/settings/settings-app';

// Session-reading page — must block server-side so the guard can redirect
// before anything renders (cacheComponents sanctioned opt-out).
export const instant = false;

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const cookieStore = await cookies();
  const supabase = await createRouteClient(cookieStore);
  await getOrCreateProfile(supabase, user.id); // fresh getUser() check: a deleted/invalid session surfaces here

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <TopBar />
      <main className="px-4 py-16">
        <div className="mx-auto w-full max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Settings
          </h1>
          <p className="mt-2 mb-8 text-sm text-zinc-600 dark:text-zinc-400">
            Your data belongs to you. Take it with you, or erase it completely.
          </p>
          <SettingsApp />
        </div>
      </main>
    </div>
  );
}
