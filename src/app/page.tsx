import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';

// Session-reading pages must block on the server so the guard can
// redirect before anything renders (cacheComponents sanctioned opt-out).
export const instant = false;

/**
 * Public landing page — "a calculator, not a carnival":
 * zinc neutrals, one accent reserved for the primary action, system fonts,
 * 8px rhythm, subtle borders, no gradients. Signed-in visitors are routed
 * straight to their dashboard.
 */
export default async function HomePage() {
  const user = await getSessionUser();
  if (user) redirect('/dashboard');

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-6">
        <span className="text-sm font-semibold tracking-tight">ResumeTailor</span>
        <nav className="flex items-center gap-6 text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/signup" className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-50">
            Create account
          </Link>
          <Link href="/login" className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-50">
            Sign in
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-4xl gap-12 px-6 pb-20 pt-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            Record your career once.
            <br />
            <span className="text-zinc-500 dark:text-zinc-400">Send a CV that fits every job.</span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Paste the job description. ResumeTailor picks what you&apos;ve actually done,
            puts it first, and fits it to one clean, ATS-readable page — in minutes,
            for every application.
          </p>
          <div className="mt-8 flex items-center gap-6">
            <Link
              href="/login"
              className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              New here? Create an account →
            </Link>
          </div>
          <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-500">
            Private by default. Your story is never sold, shared, or used to train anything.
          </p>
        </div>

        {/* Product truth: the keep/cut moment, rendered as the product itself */}
        <div
          aria-hidden
          className="rounded-md border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            This job wants
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {['React', 'TypeScript', 'design systems', 'GraphQL'].map((k) => (
              <span
                key={k}
                className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {k}
              </span>
            ))}
          </div>

          <div className="mt-6 border-t border-zinc-100 pt-6 dark:border-zinc-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Your CV, reordered
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                <span>Led design-system work across 4 product teams — React, TypeScript</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                <span>Migrated the checkout API to GraphQL, −38% latency</span>
              </li>
              <li className="flex items-start gap-2 text-zinc-400 line-through decoration-zinc-300 dark:text-zinc-600 dark:decoration-zinc-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                <span>Ran quarterly hardware inventory audits</span>
              </li>
            </ul>
            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
              Cut items are listed with the reason — nothing disappears silently.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto grid w-full max-w-4xl gap-8 px-6 py-16 sm:grid-cols-3">
          {[
            ['01', 'Record it once', 'Your experiences, projects and skills live in one structured profile — plain forms, no file to lose.'],
            ['02', 'Paste the job', 'We show what that employer actually wants, then choose and order what you have against it.'],
            ['03', 'Export the page', 'One A4 page, ATS-clean. Every suggested rewrite needs your accept before it can leave.'],
          ].map(([n, title, body]) => (
            <div key={n}>
              <p className="text-xs font-semibold tabular-nums text-zinc-400 dark:text-zinc-500">{n}</p>
              <h2 className="mt-2 text-base font-semibold tracking-tight">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Honesty strip + close */}
      <section className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-6 px-6 py-12">
          <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <li>As-is mode never touches your wording — it only chooses and orders.</li>
            <li>Nothing is invented. A CV can only say what your profile already proves.</li>
            <li>Every edit is reversible; every cut is explained.</li>
          </ul>
          <Link
            href="/login"
            className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Sign in
          </Link>
        </div>
      </section>

      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-6 text-xs text-zinc-500 dark:text-zinc-500">
          <span>ResumeTailor</span>
          <span>Your data belongs to you — export or delete it any time.</span>
        </div>
      </footer>
    </main>
  );
}
