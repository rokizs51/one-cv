'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import VersionList from '@/components/dashboard/version-list';
import type { ItemType, ProfileItem } from '@/lib/domain/types';
import { TYPE_FIELDS, TYPE_LABELS } from '@/components/profile/fields';
import type { ResumeSummary } from '@/lib/db/resumes';

// Every section counts toward completeness — derived, not re-listed, so a
// new ItemType can't silently skip the panel (TYPE_FIELDS is Record<ItemType>).
const CHECKED_TYPES = Object.keys(TYPE_FIELDS) as ItemType[];

export default function DashboardApp() {
  const [items, setItems] = useState<ProfileItem[] | null>(null);
  const [resumes, setResumes] = useState<ResumeSummary[] | null>(null);

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

  if (!items || !resumes) {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-16 dark:bg-zinc-950">
        <div className="mx-auto max-w-2xl text-sm text-zinc-500">Loading…</div>
      </main>
    );
  }

  const missing = CHECKED_TYPES.filter((t) => !items.some((i) => i.type === t));

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-16 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-2xl space-y-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Your CVs
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              One profile, a CV for every job.
            </p>
          </div>
          <Link
            href="/generate"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            New tailored CV
          </Link>
        </header>

        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Your profile
          </h2>
          {missing.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Every section has content —{' '}
              <Link href="/profile" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                review or refine it
              </Link>
              .
            </p>
          ) : (
            <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                A CV draws from everything you record. These are still empty:
              </p>
              <ul className="mb-3 flex flex-wrap gap-2">
                {missing.map((t) => (
                  <li
                    key={t}
                    className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {TYPE_LABELS[t]}
                  </li>
                ))}
              </ul>
              <Link
                href="/profile"
                className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Complete your profile →
              </Link>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Generated versions
          </h2>
          <VersionList resumes={resumes} />
        </section>
      </div>
    </main>
  );
}
