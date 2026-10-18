import { redirect } from 'next/navigation';
import ProfileEditor from '@/components/profile/profile-editor';
import AppShell from '@/components/shell/app-shell';
import { getSessionUser } from '@/lib/auth/session';

// Session-reading pages must block on the server so the guard can
// redirect before anything renders (cacheComponents sanctioned opt-out).
export const instant = false;

export default async function ProfilePage() {
  // Page-level guard (defense-in-depth alongside the proxy).
  const user = await getSessionUser();
  if (!user) redirect('/login');

  return (
    <AppShell email={user.email ?? undefined}>
      <main className="px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-ink">Your profile</h1>
          <p className="mt-2 text-sm text-mute">
            Record your story once — every CV is drawn from this. Nothing here is ever
            changed silently: accepted rewrites stay marked with an undo option.
          </p>
          <div className="mt-8">
            <ProfileEditor />
          </div>
        </div>
      </main>
    </AppShell>
  );
}
