import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createRouteClient } from '@/lib/db/client';
import { getSessionUser } from '@/lib/auth/session';
import { getOrCreateProfile } from '@/lib/db/profiles';
import AppShell from '@/components/shell/app-shell';
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
    <AppShell email={user.email ?? undefined}>
      <main className="px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Settings</h1>
          <p className="mt-2 mb-8 text-sm text-mute">
            Your data belongs to you. Take it with you, or erase it completely.
          </p>
          <SettingsApp />
        </div>
      </main>
    </AppShell>
  );
}
