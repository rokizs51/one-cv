'use client';

import type { JdExtraction, ResumeDoc } from '@/lib/domain/types';
import { matchedKeywords } from '@/lib/resume/scoring';

export interface CutRow {
  itemId: string;
  reason: 'relevance' | 'space';
  text: string;
}

const REASON_LABEL: Record<CutRow['reason'], string> = {
  relevance: "Didn't match this job's keywords",
  space: "Didn't fit on the page — higher-priority content was kept",
};

/**
 * "Why this matched": per line, the JD keywords it hits (same matcher the
 * scoring uses); plus the live cut list — every item that fell off, with
 * its reason. Cuts are always visible; nothing disappears silently.
 */
export default function MatchPanel({
  extraction,
  doc,
  cuts,
}: {
  extraction: JdExtraction | null;
  doc: ResumeDoc;
  cuts: CutRow[];
}) {
  if (!extraction) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        The job description behind this CV is gone, so matching details are unavailable.
      </p>
    );
  }

  const lines = [
    ...(doc.summary
      ? [{ key: 'summary', label: 'Headline summary', text: doc.summary }]
      : []),
    ...doc.sections.flatMap((s) =>
      s.items.map((i) => ({ key: `${s.id}-${i.sourceItemId}`, label: s.id, text: i.text }))
    ),
  ];

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Why this matched
        </h3>
        <ul className="space-y-3">
          {lines.map((line) => {
            const hits = matchedKeywords(line.text, extraction);
            return (
              <li key={line.key}>
                <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{line.text}</p>
                {hits.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {hits.map((k) => (
                      <span
                        key={k}
                        className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                    kept as part of your story
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Cut from this page
        </h3>
        {cuts.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Nothing was cut — everything selected fits.
          </p>
        ) : (
          <ul className="space-y-3">
            {cuts.map((c) => (
              <li key={c.itemId}>
                <p className="text-sm leading-6 text-zinc-400 line-through dark:text-zinc-600">
                  {c.text}
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{REASON_LABEL[c.reason]}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
