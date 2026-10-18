import { redirect } from 'next/navigation';
import GenerateWizard from '@/components/generate-wizard';
import AppShell from '@/components/shell/app-shell';
import { getSessionUser } from '@/lib/auth/session';

// Session-reading pages must block on the server so the guard can
// redirect before anything renders (cacheComponents sanctioned opt-out).
export const instant = false;

export default async function GeneratePage() {
  // Page-level guard (defense-in-depth alongside the proxy): this screen and
  // its APIs are private by default.
  const user = await getSessionUser();
  if (!user) redirect('/login');

  return (
    <AppShell email={user.email ?? undefined}>
      <main className="px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-ink">New tailored CV</h1>
          <p className="mt-2 text-sm text-mute">
            Paste a job description and we&apos;ll build a one-page CV from what
            you&apos;ve recorded in your profile.
          </p>
          <div className="mt-8">
            <GenerateWizard />
          </div>
        </div>
      </main>
    </AppShell>
  );
}
