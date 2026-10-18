'use client';

import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { DownloadSimple, Lock } from '@phosphor-icons/react';
import type { GeneratedResume } from '@/lib/db/resumes';
import type { JdExtraction } from '@/lib/domain/types';
import SuggestionReview, { type SuggestionRow } from './suggestion-review';
import MatchPanel, { type CutRow } from './match-panel';
import Card, { SectionHeading } from '@/components/ui/card';
import Chip from '@/components/ui/chip';
import { buttonCls } from '@/components/ui/button';

// react-pdf's viewer is browser-only machinery — lazy-load it behind a
// Suspense fallback so the server render never touches it.
const Preview = lazy(() => import('./preview'));

/**
 * The preview screen (spec screen #4): the rendered CV as the single source
 * component, the suggestion dispositions gating export, the honest
 * "won't fit" banner with its 2-page escape hatch, and the live match/cut
 * panel. All mutation goes through the PATCH/fit routes — the client never
 * edits the stored doc directly.
 */
export default function ResumeEditor({
  resume: initialResume,
  extraction: initialExtraction,
}: {
  resume: GeneratedResume;
  extraction: JdExtraction | null;
}) {
  const [resume, setResume] = useState(initialResume);
  const [extraction, setExtraction] = useState(initialExtraction);
  // Cut list is advisory: populated by the first refit call below.
  const [cuts, setCuts] = useState<CutRow[]>([]);
  const [overflow, setOverflow] = useState(resume.fit.overflow);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const docTextFor = useCallback(
    (itemId: string): string => {
      for (const section of resume.doc.sections) {
        for (const item of section.items) {
          if (item.sourceItemId === itemId) return item.text;
        }
      }
      return '';
    },
    [resume]
  );

  const refit = useCallback(
    async (current: GeneratedResume) => {
      try {
        const userEdits: Record<string, string> = {};
        for (const s of current.statuses) {
          if ((s.status === 'accepted' || s.status === 'edited') && s.suggestion.kind === 'bullet' && s.finalText) {
            userEdits[s.suggestion.targetItemId] = s.finalText;
          }
        }
        const res = await fetch(`/api/resumes/${current.id}/fit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEdits }),
        });
        if (res.ok) {
          const data = await res.json();
          setCuts(data.cuts ?? []);
          setOverflow(!!data.overflow);
        }
      } catch {
        // Live cut list is advisory; a failed recompute keeps the last known state.
      }
    },
    []
  );

  useEffect(() => {
    refit(resume).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resync = useCallback(async () => {
    const res = await fetch(`/api/resumes/${resume.id}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.resume) {
        setResume(data.resume);
        setExtraction(data.extraction ?? null);
        await refit(data.resume);
      }
    }
  }, [resume.id, refit]);

  const applyResponse = async (res: Response): Promise<void> => {
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error?.message || 'That change did not go through. Please try again.');
      // 409 already_dispositioned (lost race / stale tab) means the SERVER has
      // newer truth than this client — pull it so the "N waiting" badge and the
      // Download gate stop showing a pending state that no longer exists.
      if (res.status === 409) await resync();
      return;
    }
    setError('');
    if (data?.resume) {
      setResume(data.resume);
      if (data.extraction !== undefined) setExtraction(data.extraction);
      await refit(data.resume);
    }
  };

  const disposition = async (
    suggestionId: string,
    status: 'accepted' | 'rejected' | 'edited',
    finalText?: string
  ) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/resumes/${resume.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId, status, ...(finalText ? { finalText } : {}) }),
      });
      await applyResponse(res);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const changePageLimit = async (pageLimit: 1 | 2) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/resumes/${resume.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageLimit }),
      });
      await applyResponse(res);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  };

  const pending = resume.statuses.filter((s) => s.status === 'pending').length;

  const rows: SuggestionRow[] = resume.statuses.map((state) => ({
    state,
    originalText:
      state.suggestion.kind === 'summary'
        ? resume.doc.summary ?? ''
        : docTextFor(state.suggestion.targetItemId),
  }));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="sticky top-6">
          <Suspense
            fallback={
              <div className="flex h-[70vh] items-center justify-center rounded-2xl border border-line bg-surface text-sm text-mute">
                Rendering the page…
              </div>
            }
          >
            <Preview doc={resume.doc} pageLimit={resume.pageLimit} />
          </Suspense>
        </div>

        {overflow && (
          <div
            role="alert"
            className="mt-4 rounded-2xl bg-wash-amber p-4 text-sm text-tone-amber"
          >
            <p className="font-medium">
              Pinned content alone is more than {resume.pageLimit === 2 ? 'two pages' : 'one page'}.
            </p>
            <p className="mt-1">
              Nothing was dropped to make it fit — un-pin something on your profile
              {resume.pageLimit === 1 ? ', or switch to two pages.' : '.'}
            </p>
            <div className="mt-3 flex gap-2">
              {resume.pageLimit === 1 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => changePageLimit(2)}
                  className={buttonCls('secondary', 'sm')}
                >
                  Use two pages
                </button>
              )}
              {resume.pageLimit === 2 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => changePageLimit(1)}
                  className={buttonCls('secondary', 'sm')}
                >
                  Back to one page
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <aside className="space-y-8">
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <SectionHeading>Suggestions</SectionHeading>
            {pending > 0 && (
              <Chip tone="amber">{pending} waiting</Chip>
            )}
          </div>
          <SuggestionReview rows={rows} busy={busy} onDisposition={disposition} />
        </section>

        <Card className="p-5">
          <SectionHeading className="mb-3">Download</SectionHeading>
          {pending === 0 ? (
            <a
              href={`/api/resumes/${resume.id}/pdf`}
              className={buttonCls('primary', 'lg')}
            >
              <DownloadSimple aria-hidden size={18} weight="bold" />
              Download PDF
            </a>
          ) : (
            <div>
              <span
                aria-disabled="true"
                className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-5 py-2.5 text-sm font-medium text-faint"
              >
                <Lock aria-hidden size={15} />
                Download PDF
              </span>
              <p className="mt-2 text-xs leading-5 text-mute">
                Decide every suggestion ({pending} left) before exporting — the PDF only ever
                contains wording you approved.
              </p>
            </div>
          )}
        </Card>

        {error && (
          <div role="alert" className="rounded-2xl bg-wash-red px-4 py-3 text-sm text-tone-red">
            {error}
          </div>
        )}

        <section>
          <MatchPanel extraction={extraction} doc={resume.doc} cuts={cuts} />
        </section>
      </aside>
    </div>
  );
}
