'use client';

import Link from 'next/link';
import { FilePdf, ArrowUpRight } from '@phosphor-icons/react';
import type { ResumeSummary } from '@/lib/db/resumes';
import Card from '@/components/ui/card';
import Chip from '@/components/ui/chip';

const MODE_LABEL: Record<'as_is' | 'enhance', string> = {
  as_is: 'As-is',
  enhance: 'Enhanced',
};

/**
 * Every generated CV, newest first — tappable rounded cards with mode and
 * page-count chips, the PDF icon carrying the "downloadable doc" meaning so
 * color never has to. Empty state points straight at the one action that
 * fills it.
 */
export default function VersionList({ resumes }: { resumes: ResumeSummary[] }) {
  if (resumes.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <span
          aria-hidden
          className="flex size-12 items-center justify-center rounded-2xl bg-wash-blue text-tone-blue"
        >
          <FilePdf size={24} />
        </span>
        <p className="text-sm font-medium text-ink">No CVs yet</p>
        <p className="max-w-xs text-sm text-mute">
          Paste a job description and we&apos;ll build your first one from your profile.
        </p>
        <Link
          href="/generate"
          className="mt-1 rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-press active:scale-[0.97]"
        >
          Create your first CV
        </Link>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {resumes.map((r) => (
        <li key={r.id}>
          <Link
            href={`/resume/${r.id}`}
            className="group block cursor-pointer rounded-2xl border border-line bg-surface px-5 py-4 transition-all duration-150 hover:border-line-2 hover:bg-surface-2/60 active:scale-[0.995]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-wash-violet text-tone-violet"
                >
                  <FilePdf size={20} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">
                    {new Date(r.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <span className="mt-0.5 flex flex-wrap gap-1.5">
                    <Chip tone={r.mode === 'enhance' ? 'violet' : 'neutral'}>
                      {MODE_LABEL[r.mode]}
                    </Chip>
                    <Chip tone="neutral">{r.pageLimit === 2 ? '2 pages' : '1 page'}</Chip>
                  </span>
                </span>
              </div>
              <ArrowUpRight
                aria-hidden
                size={20}
                className="shrink-0 text-faint transition-colors group-hover:text-ink"
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
