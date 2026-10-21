'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { buttonCls } from '@/components/ui/button';
import { useStage } from './stage-provider';
import { CLAUSES, STAGES, STAGE_NAMES, type RoleId } from './record-data';

/** The big line for the current stage; re-fades when the sheet re-sets. */
export function StageClause() {
  const { stage } = useStage();
  const c = CLAUSES[stage];
  return (
    <div key={stage} className="sheet-in">
      <p className="text-clause font-semibold leading-[1.06] tracking-tight">{c.line}</p>
      <p className="mt-3 max-w-[46ch] text-body leading-relaxed text-ink">{c.body}</p>
    </div>
  );
}

/** Real range input driving the sheet's stage; the names double as buttons. */
export function StageSlider() {
  const { stage, setStage } = useStage();
  const idx = STAGES.indexOf(stage);
  return (
    <div className="mt-8">
      <input
        type="range"
        aria-label="Stages of the tailor: from your record to the finished call"
        min={0}
        max={STAGES.length - 1}
        step={1}
        value={idx}
        onChange={(e) => setStage(STAGES[Number(e.target.value)])}
        className="stage-range"
      />
      <ol className="-mt-1 flex justify-between gap-2">
        {STAGES.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              aria-current={i === idx ? 'step' : undefined}
              onClick={() => setStage(s)}
              className={
                'py-2 text-note transition-colors ' +
                (i === idx ? 'font-semibold text-ink' : 'text-mute hover:text-ink')
              }
            >
              {STAGE_NAMES[s]}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The showcase index: names of the CVs this record produced. */
export function RoleIndex({ roles }: { roles: { id: RoleId; label: string }[] }) {
  const { role, pickRole } = useStage();
  return (
    <ul className="space-y-1">
      {roles.map(({ id, label }) => (
        <li key={id}>
          <button
            type="button"
            aria-current={id === role ? 'true' : undefined}
            onClick={() => pickRole(id)}
            className={
              'block w-full py-1.5 text-left text-clause leading-[1.08] tracking-tight transition-colors ' +
              (id === role ? 'font-semibold text-ink' : 'font-medium text-mute hover:text-ink')
            }
          >
            {label}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The first screen already open: paste the posting here and the text rides
 * with you into the wizard (same jd-draft channel the app uses after a
 * login redirect).
 */
export function CtaPaste() {
  const router = useRouter();
  const [raw, setRaw] = useState('');
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    if (raw.trim()) {
      try {
        sessionStorage.setItem('jd-draft', raw);
      } catch {
        /* private mode: the draft is simply not carried */
      }
    }
    router.push('/signup');
  };
  return (
    <form
      data-ui
      onSubmit={go}
      aria-label="Start a CV from a job description"
      className="w-[min(440px,100%)] bg-surface p-6"
    >
      <label htmlFor="cta-jd" className="block text-sm font-medium text-ink">
        Job description
      </label>
      <p className="mt-1 text-[13px] text-mute">Paste it whole. It comes with you to the new account.</p>
      <textarea
        id="cta-jd"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={6}
        placeholder="Senior engineer wanted. You will…"
        className="mt-3 w-full resize-y border border-line-2 bg-surface px-4 py-3 text-sm text-ink placeholder:text-faint transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <button type="submit" className={buttonCls('primary', 'lg', 'mt-4 w-full')}>
        Create account
      </button>
    </form>
  );
}
