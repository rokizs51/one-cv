import Link from 'next/link';
import { redirect } from 'next/navigation';
// SSR entry: the main barrel calls React.createContext at module scope, which
// fails during React Server Components evaluation.
import { Scissors } from '@phosphor-icons/react/ssr';
import { getSessionUser } from '@/lib/auth/session';
import TailorList from '@/components/landing/tailor-list';
import Reveal from '@/components/landing/reveal';

// Session-reading pages must block on the server so the guard can
// redirect before anything renders (cacheComponents sanctioned opt-out).
export const instant = false;

// Category tones as in components/jd-chips.tsx, except Preferred: violet reads
// as a generic AI accent on marketing pages, so this demo uses the pink slot.
const WANTS = [
  { label: 'Required', tone: 'bg-wash-coral text-tone-coral', items: ['React', 'TypeScript'] },
  { label: 'Preferred', tone: 'bg-wash-pink text-tone-pink', items: ['design systems', 'accessibility'] },
  { label: 'Tools', tone: 'bg-wash-teal text-tone-teal', items: ['GraphQL', 'Figma'] },
  { label: 'Keywords', tone: 'bg-wash-blue text-tone-blue', items: ['component library', 'WCAG'] },
];

/**
 * Public landing — the product's own keep/cut moment is the hero (live,
 * right column); everything else proves it: what a posting resolves to,
 * a rewrite awaiting accept, and the one honest A4 page it produces.
 */
export default async function HomePage() {
  const user = await getSessionUser();
  if (user) redirect('/dashboard');

  return (
    <main className="bg-background text-ink">
      {/* Entrance styles only apply once JS is confirmed (see globals.css). */}
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      <Reveal />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
          <span
            aria-hidden
            className="flex size-8 items-center justify-center rounded-lg bg-primary text-white"
          >
            <Scissors size={16} weight="bold" />
          </span>
          Sever
        </span>
        <nav aria-label="Public" className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-mute transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-press active:scale-[0.97]"
          >
            Create account
          </Link>
        </nav>
      </header>

      {/* Hero: the claim on the left, the proof doing its job on the right. */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 pb-24 pt-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16 lg:pt-16">
        <div>
          <h1 className="reveal max-w-[14ch] text-[40px] font-bold leading-[1.04] tracking-tight sm:text-6xl lg:max-w-none lg:text-[68px]">
            Record once. <span className="lg:block">Tailor forever.</span>
          </h1>
          <p className="reveal mt-6 max-w-[55ch] text-lg leading-8 text-ink">
            Paste a job description and Sever reorders your CV around what that
            employer actually wants — one clean, ATS-readable page built only
            from what you have recorded.
          </p>
          <div className="reveal mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              href="/signup"
              className="rounded-full bg-primary px-7 py-3.5 text-base font-medium text-on-primary transition-colors hover:bg-primary-press active:scale-[0.97]"
            >
              Create an account
            </Link>
            <Link
              href="/login"
              className="text-base font-medium text-primary underline-offset-4 transition-colors hover:text-primary-press hover:underline"
            >
              Already have one? Sign in
            </Link>
          </div>
          <p className="reveal mt-7 text-[13px] text-mute">
            Private by default. Your story is never sold, shared, or used to train anything.
          </p>
        </div>
        <div className="reveal">
          <TailorList />
        </div>
      </section>

      {/* What the posting resolves to. */}
      <section className="bg-wash-blue">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-24 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="reveal text-3xl font-bold leading-tight tracking-tight">
              It reads the posting, not a template.
            </h2>
            <p className="reveal mt-5 max-w-[58ch] text-base leading-7 text-ink">
              Every job description is taken apart into what is required, what
              is preferred, the tools named, and the words that carry weight —
              then matched against the items in your profile, each one linked
              back to where you recorded it.
            </p>
            <p className="reveal mt-4 max-w-[58ch] text-base leading-7 text-ink">
              A CV can only say what your profile already proves. Sever never
              invents an experience to fill a gap.
            </p>
          </div>
          <div
            data-ui
            aria-label="Example: a job posting parsed into requirements"
            className="reveal rounded-2xl border border-line bg-surface p-5"
          >
            <p className="text-sm font-medium text-mute">This posting asks for</p>
            <ul className="mt-3 space-y-3">
              {WANTS.map((row) => (
                <li key={row.label} className="flex flex-wrap items-center gap-2">
                  <span className="w-[72px] shrink-0 text-[13px] font-medium text-mute">
                    {row.label}
                  </span>
                  {row.items.map((item) => (
                    <span
                      key={item}
                      className={`rounded-full px-2.5 py-1 text-[13px] font-medium ${row.tone}`}
                    >
                      {item}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[13px] text-mute">
              Matched against 31 recorded items in your profile.
            </p>
          </div>
        </div>
      </section>

      {/* The human-in-the-loop rule. */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-24 lg:grid-cols-2 lg:gap-16">
        <div className="reveal order-2 lg:order-1" data-ui aria-label="Example: a suggested rewrite awaiting your decision">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-sm font-medium text-mute">Suggested rewrite</p>
            <p className="mt-3 text-sm text-mute line-through decoration-line-2">
              Worked on the design system
            </p>
            <p className="mt-1.5 text-[15px] font-medium text-ink">
              Led the design-system rebuild across 4 product teams (React, TypeScript)
            </p>
            <p className="mt-2 text-[13px] text-mute">
              From your Meridian Health record · 2022–present
            </p>
            <div className="mt-4 flex gap-2">
              <span className="cursor-default rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary">
                Accept
              </span>
              <span className="cursor-default rounded-full border border-line-2 bg-surface px-4 py-2 text-sm font-medium text-ink">
                Not now
              </span>
            </div>
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <h2 className="reveal text-3xl font-bold leading-tight tracking-tight">
            Nothing changes without you.
          </h2>
          <p className="reveal mt-5 max-w-[58ch] text-base leading-7 text-ink">
            A sharper sentence never arrives on its own. Rewrites are proposals
            with their source attached — accept one and it lands in the draft;
            refuse it and your words stand untouched.
          </p>
          <p className="reveal mt-4 max-w-[58ch] text-base leading-7 text-mute">
            Every cut item stays listed with the reason, every decision is
            reversible, and as-is mode chooses and orders without ever
            touching your wording.
          </p>
        </div>
      </section>

      {/* The output itself. */}
      <section className="bg-wash-teal">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-24 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-16">
          <div>
            <h2 className="reveal text-3xl font-bold leading-tight tracking-tight">
              One page. The honest one.
            </h2>
            <ul className="reveal mt-6 max-w-[55ch] space-y-3 text-base leading-7 text-ink">
              <li>As-is mode never touches your wording — it only chooses and orders.</li>
              <li>Nothing is invented. A CV can only say what your profile already proves.</li>
              <li>Every edit is reversible; every cut is explained.</li>
            </ul>
            <div className="reveal mt-8">
              <Link
                href="/signup"
                className="rounded-full bg-primary px-7 py-3.5 text-base font-medium text-on-primary transition-colors hover:bg-primary-press active:scale-[0.97]"
              >
                Create an account
              </Link>
            </div>
          </div>
          <div
            data-ui
            aria-label="Example: the exported CV page"
            className="reveal paper-breathe mx-auto h-[560px] w-full max-w-[480px] overflow-hidden rounded-xl border border-line bg-surface px-8 py-7"
          >
            <p className="text-[22px] font-bold tracking-tight text-ink">Alex Moreau</p>
            <p className="text-[15px] text-mute">Senior frontend engineer</p>
            <p className="mt-1 text-[13px] text-mute">Berlin · alex.moreau@mail.dev · +49 · 6 yrs</p>
            <p className="mt-5 text-[15px] font-semibold text-ink">Experience</p>
            <p className="mt-2.5 flex justify-between gap-3 text-[14px] font-medium text-ink">
              Meridian Health — Design systems
              <span className="shrink-0 font-normal text-mute">2022–present</span>
            </p>
            <ul className="mt-1.5 space-y-1 text-[13px] leading-5 text-ink">
              <li>Led the design-system rebuild across 4 product teams (React, TypeScript)</li>
              <li>Shipped WCAG 2.2 AA on the patient portal</li>
            </ul>
            <p className="mt-4 flex justify-between gap-3 text-[14px] font-medium text-ink">
              Northline Studio — Checkout &amp; platform
              <span className="shrink-0 font-normal text-mute">2019–2022</span>
            </p>
            <ul className="mt-1.5 space-y-1 text-[13px] leading-5 text-ink">
              <li>Migrated the checkout API to GraphQL, −38% latency</li>
              <li>Containerised 9 services; cut build minutes 40%</li>
            </ul>
            <p className="mt-4 text-[15px] font-semibold text-ink">Skills</p>
            <p className="mt-1.5 text-[13px] leading-5 text-ink">
              React · TypeScript · GraphQL · design systems · accessibility (WCAG)
            </p>
            <p className="mt-4 text-[15px] font-semibold text-ink">Education</p>
            <p className="mt-1.5 text-[13px] text-ink">
              BSc Computer Science — Technical University Berlin
            </p>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-8 text-sm text-mute">
        <span className="font-medium text-ink">Sever</span>
        <span>Your data belongs to you — export or delete it any time.</span>
      </footer>
    </main>
  );
}
