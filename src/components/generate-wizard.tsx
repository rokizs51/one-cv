'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { JdChips } from '@/components/jd-chips';
import type { GenMode, JdExtraction } from '@/lib/domain/types';

const DRAFT_KEY = 'jd-draft';

type Step = 'paste' | 'configure';

/**
 * Plain-language copy for API error codes. The paste-JD route already returns
 * user-friendly messages (not_a_job_description, too_short); generation
 * returns developer-facing text for some codes, so we translate by code first
 * and fall back to the server message.
 */
function friendlyError(code: string | undefined, message: string | undefined): string {
  switch (code) {
    case 'quota':
      return "You've used all 50 resumes this month — the count resets next month.";
    case 'budget_exhausted':
      return 'AI rewrites are paused while this month\'s AI budget recovers. "As-is" still works.';
    case 'not_found':
      return 'That saved job description is missing. Paste it again and extract once more.';
    case 'invalid_request':
      return 'That request did not go through. Check the mode and page options and try again.';
    default:
      return message || 'Something went wrong. Please try again.';
  }
}

export default function GenerateWizard() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('paste');
  const [raw, setRaw] = useState('');
  const [jdId, setJdId] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<JdExtraction | null>(null);
  const [mode, setMode] = useState<GenMode>('as_is');
  const [pageLimit, setPageLimit] = useState<1 | 2>(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Recover the pasted JD after a login redirect (Review Focus 4).
  useEffect(() => {
    const draft = sessionStorage.getItem(DRAFT_KEY);
    if (draft) {
      setRaw(draft);
      sessionStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  const handleUnauthorized = () => {
    // Preserve what the user pasted, send them to log in, and let the
    // draft-recovery effect above restore it when they come back.
    sessionStorage.setItem(DRAFT_KEY, raw);
    router.push('/login');
  };

  const handleExtract = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/jds/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setError(friendlyError(data.error?.code, data.error?.message));
        return; // stay on step 1, no silent retry
      }

      setJdId(data.jdId);
      setExtraction(data.extraction);
      setStep('configure');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleGenerate = async () => {
    if (!jdId) return;
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/resumes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdId, mode, pageLimit }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await res.json();
      if (res.status === 201 && data.resume?.id) {
        router.push(`/resume/${data.resume.id}?new=1`);
        return;
      }

      setError(friendlyError(data.error?.code, data.error?.message));
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'paste') {
    return (
      <div className="space-y-4">
        <div>
          <label htmlFor="jd-raw" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Job description
          </label>
          <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">
            Paste the full posting here — requirements, responsibilities, everything.
          </p>
          <textarea
            id="jd-raw"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={12}
            required
            className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 font-sans text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-blue-400"
            placeholder="Senior engineer wanted. You will…"
          />
        </div>

        {error && (
          <div role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleExtract}
            disabled={busy || !raw.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            {busy ? 'Extracting…' : 'Extract'}
          </button>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            We only use what you paste — nothing is invented.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {extraction && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            What this job wants
          </h2>
          <JdChips extraction={extraction} />
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          How should we build it?
        </h2>
        <fieldset className="space-y-3">
          <legend className="sr-only">Generation mode</legend>
          <label className="flex items-start gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <input
              type="radio"
              name="mode"
              value="as_is"
              checked={mode === 'as_is'}
              onChange={() => setMode('as_is')}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">As-is</span>
              <span className="block text-sm text-zinc-500 dark:text-zinc-400">
                Your words, untouched. We only choose what stays and what the order is.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <input
              type="radio"
              name="mode"
              value="enhance"
              checked={mode === 'enhance'}
              onChange={() => setMode('enhance')}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">Enhance</span>
              <span className="block text-sm text-zinc-500 dark:text-zinc-400">
                We also suggest sharper wording for each line. You accept, edit, or reject every suggestion.
              </span>
            </span>
          </label>
        </fieldset>
      </section>

      <section>
        <label htmlFor="page-limit" className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Page limit
        </label>
        <select
          id="page-limit"
          value={String(pageLimit)}
          onChange={(e) => setPageLimit(e.target.value === '2' ? 2 : 1)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        >
          <option value="1">1 page (recommended)</option>
          <option value="2">2 pages</option>
        </select>
      </section>

      {error && (
        <div role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={busy}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          {busy ? 'Generating…' : 'Generate my CV'}
        </button>
        <button
          type="button"
          onClick={() => {
            setError('');
            setStep('paste');
          }}
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Edit the pasted text
        </button>
      </div>
    </div>
  );
}
