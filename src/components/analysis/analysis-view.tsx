'use client';

import { useState } from 'react';
import { ArrowRight, ArrowsClockwise, ShieldCheck } from '@phosphor-icons/react';
import Card, { SectionHeading } from '@/components/ui/card';
import Chip, { type Tone } from '@/components/ui/chip';
import { Button, buttonCls } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton';
import { TYPE_LABELS } from '@/components/profile/fields';
import type { MatchAnalysis } from '@/lib/db/analyses';
import type { MatchEntry, MatchStatus, RequirementRecord } from '@/lib/match/match-types';
import type { ItemType } from '@/lib/domain/types';

/**
 * Every state says something, color never says it alone. `not_established`
 * is worded as "not found in your profile" — the analysis measures recorded
 * evidence, never the person.
 */
const STATUS_META: Record<MatchStatus, { label: string; tone: Tone }> = {
  supported: { label: 'Supported', tone: 'green' },
  partial: { label: 'Partly supported', tone: 'amber' },
  needs_review: { label: 'Needs your review', tone: 'amber' },
  not_established: { label: 'Not in your profile', tone: 'neutral' },
  not_applicable: { label: 'Not applicable', tone: 'neutral' },
};

interface AnalysisViewProps {
  analysis: MatchAnalysis;
  stale: boolean;
  evidenceText: Record<string, { type: string; text: string }>;
}

export default function AnalysisView({ analysis: initial, stale: initialStale, evidenceText }: AnalysisViewProps) {
  const [analysis, setAnalysis] = useState(initial);
  const [stale, setStale] = useState(initialStale);
  const [busy, setBusy] = useState<'rerun' | string | null>(null); // 'rerun' or requirementId
  const [error, setError] = useState('');

  const rerun = async () => {
    setError('');
    setBusy('rerun');
    try {
      const res = await fetch(`/api/analyses/${analysis.id}/rerun`, { method: 'POST' });
      const data = await res.json();
      if (data.error?.message) {
        setError(data.error.message);
      } else if (data.analysis) {
        setAnalysis(data.analysis);
        setStale(false);
      }
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(null);
    }
  };

  const confirm = async (requirementId: string, status: 'supported' | 'not_applicable') => {
    setError('');
    setBusy(requirementId);
    try {
      const res = await fetch(`/api/analyses/${analysis.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirementId, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'That update did not go through.');
      } else {
        setAnalysis(data.analysis);
        setStale(data.stale ?? false);
      }
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(null);
    }
  };

  if (analysis.status === 'running') {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-ink">Match analysis</h1>
        <p className="text-sm text-mute" role="status">
          The analysis is still running. Reload this page in a moment to see the result.
        </p>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (analysis.status === 'failed' || !analysis.result) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-ink">Match analysis</h1>
        <div role="alert" className=" border border-line bg-wash-red px-4 py-3 text-sm text-tone-red">
          {analysis.error ?? 'The analysis failed.'}
        </div>
        <Button onClick={rerun} disabled={busy === 'rerun'}>
          <ArrowsClockwise aria-hidden size={18} weight="bold" />
          {busy === 'rerun' ? 'Rerunning…' : 'Rerun analysis'}
        </Button>
      </div>
    );
  }

  const { requirements, matches, summary } = analysis.result;
  const reqById = new Map(requirements.map((r) => [r.id, r]));
  const effective = (m: MatchEntry): MatchStatus => m.userConfirmation?.status ?? m.status;
  const byImportance = (want: 'mandatory' | 'preferred') =>
    matches.filter((m) => reqById.get(m.requirementId)?.importance === want);

  const countChips = (bucket: Record<string, number>) =>
    (Object.entries(STATUS_META) as [MatchStatus, { label: string; tone: Tone }][])
      .filter(([s]) => (bucket[s] ?? 0) > 0)
      .map(([s, meta]) => (
        <Chip key={s} tone={meta.tone}>
          {bucket[s]} {meta.label}
        </Chip>
      ));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Match analysis</h1>
        <p className="mt-2 text-sm text-mute">
          What this job asks for, checked against what your profile actually records.
          Nothing here is a verdict about you. Only about whatNothing here is a verdict about you — only about what&apos;s on file.apos;s on file.
        </p>
      </div>

      {stale && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3  border border-line bg-wash-amber px-4 py-3 text-sm text-tone-amber"
        >
          <span>Your profile changed since this analysis ran. These results are a snapshot of the old state.</span>
          <Button variant="soft" size="sm" onClick={rerun} disabled={busy === 'rerun'}>
            <ArrowsClockwise aria-hidden size={14} weight="bold" />
            Rerun now
          </Button>
        </div>
      )}

      <Card className="p-6">
        <SectionHeading className="mb-3">Summary</SectionHeading>
        <p className="text-sm text-ink">
          {summary.totals.requirements} requirements analyzed
        </p>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 font-medium text-mute">Mandatory</span>
            {countChips(summary.byImportance.mandatory)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 font-medium text-mute">Preferred</span>
            {countChips(summary.byImportance.preferred)}
          </div>
        </div>
        {summary.strongest.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-ink">Your strongest matches</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-mute">
              {summary.strongest.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        )}
        {summary.gaps.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-ink">Not established from your profile (mandatory)</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-mute">
              {summary.gaps.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {(['mandatory', 'preferred'] as const).map((importance) => {
        const list = byImportance(importance);
        if (list.length === 0) return null;
        return (
          <Card key={importance} className="p-6">
            <SectionHeading className="mb-4">
              {importance === 'mandatory' ? 'Mandatory requirements' : 'Preferred qualifications'}
            </SectionHeading>
            <ul className="space-y-5">
              {list.map((m) => {
                const req = reqById.get(m.requirementId) as RequirementRecord;
                const meta = STATUS_META[effective(m)];
                const confirmable =
                  !m.userConfirmation && (m.status === 'needs_review' || m.status === 'partial');
                return (
                  <li key={m.requirementId} className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink">{req.description}</span>
                      <Chip tone={meta.tone}>{meta.label}</Chip>
                      <span className="text-xs text-faint">assessment confidence: {m.confidence}</span>
                    </div>
                    {m.evidenceRefs.length > 0 && (
                      <ul className="space-y-1 pl-1">
                        {m.evidenceRefs.map((e) => {
                          const ev = evidenceText[e.itemId];
                          return (
                            <li key={e.itemId} className="text-sm text-mute">
                              <span className="font-medium text-ink">
                                {TYPE_LABELS[e.sourceType as ItemType] ?? e.sourceType}:
                              </span>{' '}
                              {ev ? ev.text.split('\n')[0] : <span className="italic">profile entry removed since the analysis</span>}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <p className="text-sm text-mute">{m.explanation}</p>
                    {m.followUpQuestion && (
                      <p className="text-sm font-medium text-ink">
                        <span className="font-medium">To confirm:</span> {m.followUpQuestion}
                      </p>
                    )}
                    {m.recommendation && (
                      <p className="text-sm text-mute">
                        <span className="font-medium text-ink">CV tip:</span> {m.recommendation}
                      </p>
                    )}
                    {m.userConfirmation && (
                      <p className="flex items-center gap-1.5 text-xs text-tone-green">
                        <ShieldCheck aria-hidden size={14} weight="bold" />
                        Confirmed by you{m.userConfirmation.note ? `: ${m.userConfirmation.note}` : ''}
                      </p>
                    )}
                    {confirmable && (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="soft" size="sm" onClick={() => confirm(m.requirementId, 'supported')} disabled={busy === m.requirementId}>
                          Confirm: I have this
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => confirm(m.requirementId, 'not_applicable')} disabled={busy === m.requirementId}>
                          Not applicable
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}

      {(summary.questions.length > 0 || summary.adjustments.length > 0) && (
        <Card className="p-6">
          <SectionHeading className="mb-3">Answers that would sharpen this</SectionHeading>
          {summary.questions.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-mute">
              {summary.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          )}
          {summary.adjustments.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-mute">
              {summary.adjustments.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {error && (
        <div role="alert" className=" border border-line bg-wash-red px-4 py-3 text-sm text-tone-red">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        {!stale && (
          <a
            href={`/generate?jdId=${analysis.jdId}&analysisId=${analysis.id}`}
            className={buttonCls('primary', 'lg')}
          >
            Generate tailored CV
            <ArrowRight aria-hidden size={18} weight="bold" />
          </a>
        )}
        <Button variant="secondary" onClick={rerun} disabled={busy === 'rerun'}>
          <ArrowsClockwise aria-hidden size={18} weight="bold" />
          {busy === 'rerun' ? 'Rerunning…' : 'Rerun analysis'}
        </Button>
      </div>
    </div>
  );
}
