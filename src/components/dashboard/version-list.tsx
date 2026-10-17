'use client';

interface ResumeRow {
  id: string;
  mode: 'as_is' | 'enhance';
  pageLimit: 1 | 2;
  jdId: string;
  createdAt: string;
}

const MODE_LABEL: Record<'as_is' | 'enhance', string> = {
  as_is: 'As-is',
  enhance: 'Enhanced',
};

/**
 * Every generated CV, newest first — the "transactions list" of the UI
 * direction: quiet rows, date + mode + page count, link to open it.
 * (The /resume/[id] screen lands with Task 13; until then rows 404.)
 */
export default function VersionList({ resumes }: { resumes: ResumeRow[] }) {
  if (resumes.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No CVs yet. Paste a job description to build your first one.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
      {resumes.map((r) => (
        <li key={r.id}>
          <a
            href={`/resume/${r.id}`}
            className="flex items-baseline justify-between px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {new Date(r.createdAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {MODE_LABEL[r.mode]} · {r.pageLimit === 2 ? '2 pages' : '1 page'}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
