import { redirect } from 'next/navigation';
import GenerateWizard from '@/components/generate-wizard';
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
    <main className="min-h-screen bg-zinc-50 px-4 py-16 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            New tailored CV
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Paste a job description and we&apos;ll build a one-page CV from what
            you&apos;ve recorded in your profile.
          </p>
        </header>
        <GenerateWizard />
      </div>
    </main>
  );
}
