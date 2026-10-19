import Link from 'next/link';
import { redirect } from 'next/navigation';
// SSR entry: the main barrel calls React.createContext at module scope, which
// fails during React Server Components evaluation.
import { Scissors } from '@phosphor-icons/react/ssr';
import { getSessionUser } from '@/lib/auth/session';

// Session-reading pages must block on the server so the guard can
// redirect before anything renders (cacheComponents sanctioned opt-out).
export const instant = false;

/**
 * Public landing page — soft minimalist SaaS: off-white ground, white cards
 * with thin lines, pastel gradient hero wash, one vibrant accent for the
 * primary action, heavy rounding. Signed-in visitors route straight to their
 * dashboard.
 */
export default async function HomePage() {
  const user = await getSessionUser();
  if (user) redirect('/dashboard');

  return (
    <main className="min-h-dvh bg-background text-ink">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
          <span
            aria-hidden
            className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-bar-blue to-bar-violet text-white"
          >
            <Scissors size={16} weight="bold" />
          </span>
          Sever
        </span>
        <nav aria-label="Public" className="flex items-center gap-3">
          <Link
            href="/signup"
            className="rounded-full px-4 py-2 text-sm font-medium text-mute transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-press active:scale-[0.97]"
          >
            Sign in
          </Link>
        </nav>
      </header>

      {/* Hero — pastel gradient banner */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-8 pt-8 sm:pt-12">
        <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-wash-blue via-surface to-wash-pink px-6 py-14 sm:px-12">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center rounded-full bg-surface px-3.5 py-1.5 text-xs font-medium text-mute ring-1 ring-line">
              Record once · tailor forever
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              Your career, recorded once.
              <br />
              <span className="text-mute">A CV that fits every job.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-base leading-7 text-mute">
              Paste the job description. Sever picks what you&apos;ve actually done,
              puts it first, and fits it to one clean, ATS-readable page — in minutes,
              for every application.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/login"
                className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-on-primary transition-all hover:bg-primary-press active:scale-[0.97]"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-full border border-line-2 bg-surface px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-surface-2 active:scale-[0.97]"
              >
                New here? Create an account
              </Link>
            </div>
            <p className="mt-6 text-xs text-mute">
              Private by default. Your story is never sold, shared, or used to train anything.
            </p>
          </div>
        </div>
      </section>

      {/* Product truth: the keep/cut moment, rendered as the product itself */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-16">
        <div
          aria-hidden
          className="mx-auto max-w-lg rounded-2xl border border-line bg-surface p-6"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
            This job wants
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {[
              ['React', 'bg-wash-blue text-tone-blue'],
              ['TypeScript', 'bg-wash-blue text-tone-blue'],
              ['design systems', 'bg-wash-violet text-tone-violet'],
              ['GraphQL', 'bg-wash-teal text-tone-teal'],
            ].map(([k, cls]) => (
              <span key={k} className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
                {k}
              </span>
            ))}
          </div>

          <div className="mt-6 border-t border-line pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
              Your CV, reordered
            </p>
            <ul className="mt-3 space-y-2.5 text-sm">
              <li className="flex items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-bar-blue" />
                <span>Led design-system work across 4 product teams — React, TypeScript</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-bar-teal" />
                <span>Migrated the checkout API to GraphQL, −38% latency</span>
              </li>
              <li className="flex items-start gap-2.5 text-mute line-through decoration-line-2">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-line-2" />
                <span>Ran quarterly hardware inventory audits</span>
              </li>
            </ul>
            <p className="mt-4 text-xs text-mute">
              Cut items are listed with the reason — nothing disappears silently.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section aria-label="How it works" className="bg-surface">
        <div className="mx-auto grid w-full max-w-5xl gap-4 px-6 py-16 sm:grid-cols-3">
          {[
            ['01', 'Record it once', 'Your experiences, projects and skills live in one structured profile — plain forms, no file to lose.', 'bg-wash-blue text-tone-blue'],
            ['02', 'Paste the job', 'We show what that employer actually wants, then choose and order what you have against it.', 'bg-wash-violet text-tone-violet'],
            ['03', 'Export the page', 'One A4 page, ATS-clean. Every suggested rewrite needs your accept before it can leave.', 'bg-wash-teal text-tone-teal'],
          ].map(([n, title, body, cls]) => (
            <div key={n} className="rounded-2xl border border-line bg-background p-6">
              <span className={`inline-flex size-9 items-center justify-center rounded-xl text-xs font-bold tabular-nums ${cls}`}>
                {n}
              </span>
              <h2 className="mt-4 text-base font-semibold tracking-tight">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-mute">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Honesty strip + close */}
      <section className="mx-auto w-full max-w-5xl px-4 py-12">
        <div className="rounded-3xl border border-line bg-gradient-to-br from-wash-teal via-surface to-wash-blue px-6 py-10 sm:px-10">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <ul className="space-y-2 text-sm text-ink">
              <li>As-is mode never touches your wording — it only chooses and orders.</li>
              <li>Nothing is invented. A CV can only say what your profile already proves.</li>
              <li>Every edit is reversible; every cut is explained.</li>
            </ul>
            <Link
              href="/login"
              className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-on-primary transition-all hover:bg-primary-press active:scale-[0.97]"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-6 py-6 text-xs text-mute">
        <span>Sever</span>
        <span>Your data belongs to you — export or delete it any time.</span>
      </footer>
    </main>
  );
}
