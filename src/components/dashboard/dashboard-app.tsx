'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from '@phosphor-icons/react';
import VersionList from '@/components/dashboard/version-list';
import type { ItemType, ProfileItem } from '@/lib/domain/types';
import { TYPE_FIELDS, TYPE_LABELS } from '@/components/profile/fields';
import type { ResumeSummary } from '@/lib/db/resumes';
import Card, { SectionHeading } from '@/components/ui/card';
import Chip, { type Tone } from '@/components/ui/chip';
import Progress, { type BarColor } from '@/components/ui/progress';
import { SkeletonCard } from '@/components/ui/skeleton';
import { buttonCls } from '@/components/ui/button';

// Every section counts toward completeness — derived, not re-listed, so a
// new ItemType can't silently skip the panel (TYPE_FIELDS is Record<ItemType>).
const CHECKED_TYPES = Object.keys(TYPE_FIELDS) as ItemType[];

// Thematic color per profile section — the "multi-category metrics" palette.
const TYPE_TONE: Record<ItemType, { bar: BarColor; tone: Tone }> = {
  career_snapshot: { bar: 'blue', tone: 'blue' },
  experience: { bar: 'violet', tone: 'violet' },
  project: { bar: 'teal', tone: 'teal' },
  education: { bar: 'coral', tone: 'coral' },
  skill: { bar: 'pink', tone: 'pink' },
  award: { bar: 'amber', tone: 'amber' },
  language: { bar: 'green', tone: 'green' },
};

// A section's bar reads as "full" at a sane entry count (3 entries is plenty;
// beyond that the extra detail belongs in the profile, not the gauge).
const SECTION_TARGET = 3;

const MONTHLY_QUOTA = 50; // mirrors the server-side quota in the plan

export default function DashboardApp() {
  const router = useRouter();
  const [items, setItems] = useState<ProfileItem[] | null>(null);
  const [resumes, setResumes] = useState<ResumeSummary[] | null>(null);
  const [omnibox, setOmnibox] = useState('');

  useEffect(() => {
    Promise.all([fetch('/api/profile/items'), fetch('/api/resumes')])
      .then(async ([iRes, rRes]) => {
        if (iRes.ok) setItems((await iRes.json()).items);
        if (rRes.ok) setResumes((await rRes.json()).resumes);
        if (!iRes.ok || !rRes.ok) {
          // Expired/absent session on a protected surface: the proxy handles
          // page-level redirects, but direct API 401s need a nudge.
          window.location.href = '/login';
        }
      })
      .catch(() => {
        window.location.href = '/login';
      });
  }, []);

  const counts = useMemo(() => {
    if (!items || !resumes) return null;
    const filled = CHECKED_TYPES.filter((t) => items.some((i) => i.type === t));
    const now = new Date();
    const thisMonth = resumes.filter((r) => {
      const d = new Date(r.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    return {
      totalCvs: resumes.length,
      thisMonth,
      completeness: Math.round((filled.length / CHECKED_TYPES.length) * 100),
      filledCount: filled.length,
      byType: CHECKED_TYPES.map((t) => ({
        type: t,
        count: items.filter((i) => i.type === t).length,
      })),
    };
  }, [items, resumes]);

  if (!counts || !items || !resumes) {
    return (
      <main className="px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </main>
    );
  }

  const missing = counts.byType.filter((b) => b.count === 0);

  const startFromOmnibox = () => {
    if (!omnibox.trim()) return;
    // Same draft channel the wizard already restores after login redirects.
    sessionStorage.setItem('jd-draft', omnibox);
    router.push('/generate');
  };

  return (
    <main className="px-4 py-6 sm:px-8">
      <div className="mx-auto w-full max-w-4xl space-y-10">
        {/* Hero: pastel gradient wash with greeting + omnibox */}
        <section
          aria-label="Start a new CV"
          className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-wash-blue via-wash-violet to-wash-pink px-6 py-8 sm:px-8"
        >
          <div className="relative">
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Let&apos;s tailor your CV
            </h1>
            <p className="mt-1 text-sm text-mute">
              One profile, a CV for every job. Paste a posting and go.
            </p>

            {/* Omnibox — the embedded AI input pattern, wired to the wizard */}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <textarea
                aria-label="Paste a job description to start a new CV"
                value={omnibox}
                onChange={(e) => setOmnibox(e.target.value)}
                rows={2}
                placeholder="Paste a job description here…"
                className="min-h-12 flex-1 resize-none rounded-2xl border border-line bg-surface/80 px-4 py-3 text-sm text-ink placeholder:text-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={startFromOmnibox}
                disabled={!omnibox.trim()}
                className={buttonCls('primary', 'lg', 'shrink-0')}
              >
                <Plus aria-hidden size={18} weight="bold" />
                Build a CV
              </button>
            </div>
            <p className="mt-2 text-xs text-mute">
              We only use what you paste — nothing is invented.
            </p>
          </div>
        </section>

        {/* Key numbers */}
        <section aria-label="At a glance">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Card className="px-5 py-4">
              <p className="text-2xl font-bold tabular-nums text-ink">{counts.totalCvs}</p>
              <p className="mt-0.5 text-xs text-mute">CVs generated</p>
            </Card>
            <Card className="px-5 py-4">
              <p className="text-2xl font-bold tabular-nums text-ink">{counts.thisMonth}</p>
              <p className="mt-0.5 text-xs text-mute">
                this month · {MONTHLY_QUOTA - counts.thisMonth} of {MONTHLY_QUOTA} left
              </p>
            </Card>
            <Card className="col-span-2 px-5 py-4 sm:col-span-1">
              <p className="text-2xl font-bold tabular-nums text-ink">{counts.completeness}%</p>
              <p className="mt-0.5 text-xs text-mute">
                profile filled · {counts.filledCount}/{CHECKED_TYPES.length} sections
              </p>
            </Card>
          </div>
        </section>

        {/* Profile build-out: per-category progress bars */}
        <section aria-labelledby="profile-fill">
          <div className="mb-3 flex items-center justify-between gap-4">
            <SectionHeading id="profile-fill">Profile build-out</SectionHeading>
            <Link
              href="/profile"
              className="text-sm font-medium text-primary transition-colors hover:text-primary-press"
            >
              Edit profile →
            </Link>
          </div>
          <Card className="space-y-4 p-5">
            {counts.byType.map(({ type, count }) => (
              <div key={type}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <Chip tone={TYPE_TONE[type].tone}>{TYPE_LABELS[type]}</Chip>
                  <span className="text-xs tabular-nums text-mute">
                    {count === 0 ? 'empty' : `${count} ${count === 1 ? 'entry' : 'entries'}`}
                  </span>
                </div>
                <Progress
                  value={Math.min(count, SECTION_TARGET)}
                  max={SECTION_TARGET}
                  color={TYPE_TONE[type].bar}
                  label={`${TYPE_LABELS[type]}: ${count} entries`}
                />
              </div>
            ))}
          </Card>
          {missing.length > 0 && (
            <p className="mt-3 text-xs leading-5 text-mute">
              A CV draws from everything you record —{' '}
              <Link href="/profile" className="font-medium text-primary hover:underline">
                fill in {missing.map((m) => TYPE_LABELS[m.type].toLowerCase()).join(', ')}
              </Link>{' '}
              for stronger matches.
            </p>
          )}
        </section>

        {/* Generated CVs */}
        <section aria-labelledby="cv-list">
          <div className="mb-3 flex items-center justify-between gap-4">
            <SectionHeading id="cv-list">Generated CVs</SectionHeading>
            <Link
              href="/generate"
              className={buttonCls('primary', 'sm')}
            >
              <Plus aria-hidden size={16} weight="bold" />
              New tailored CV
            </Link>
          </div>
          <VersionList resumes={resumes} />
        </section>
      </div>
    </main>
  );
}
