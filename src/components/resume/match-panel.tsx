'use client';

import { Scan } from '@phosphor-icons/react';
import type { JdExtraction, ResumeDoc } from '@/lib/domain/types';
import { matchedKeywords } from '@/lib/resume/scoring';
import Chip from '@/components/ui/chip';
import { SectionHeading } from '@/components/ui/card';

export interface CutRow {
  itemId: string;
  reason: 'relevance' | 'space';
  text: string;
}

const REASON_LABEL: Record<CutRow['reason'], string> = {
  relevance: "Didn't match this job's keywords",
  space: "Didn't fit on the page. Higher-priority content was kept",
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
      <p className=" bg-wash-amber px-4 py-3 text-sm text-tone-amber">
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
    <div className="space-y-8">
      <section>
        <SectionHeading className="mb-3">Why this matched</SectionHeading>
        <ul className="space-y-4">
          {lines.map((line) => {
            const hits = matchedKeywords(line.text, extraction);
            return (
              <li key={line.key}>
                <p className="text-sm leading-6 text-ink">{line.text}</p>
                {hits.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {hits.map((k) => (
                      <Chip key={k} className="px-2 py-0.5">
                        <Scan aria-hidden size={11} />
                        {k}
                      </Chip>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-faint">kept as part of your story</p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <SectionHeading className="mb-3">Cut from this page</SectionHeading>
        {cuts.length === 0 ? (
          <p className="text-sm text-mute">Nothing was cut. Everything selected fits.</p>
        ) : (
          <ul className="space-y-4">
            {cuts.map((c) => (
              <li key={c.itemId} className=" bg-surface-2 px-4 py-3">
                <p className="text-sm leading-6 text-mute line-through decoration-line-2">
                  {c.text}
                </p>
                <p className="mt-1 text-xs text-faint">{REASON_LABEL[c.reason]}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
