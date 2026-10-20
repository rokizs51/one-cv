'use client';

import { useState } from 'react';

/**
 * The keep/cut moment as the hero's live object: pick a posting and the
 * recorded CV re-orders itself, with every set-aside item still visible
 * and explained. Sample data — swap with a real capture before launch.
 */
const JOBS = {
  frontend: {
    label: 'Frontend engineer',
    kept: [
      { text: 'Led the design-system rebuild across 4 product teams (React, TypeScript)', dot: 'bg-bar-blue' },
      { text: 'Shipped WCAG 2.2 AA on the patient portal', dot: 'bg-bar-teal' },
      { text: 'Migrated the checkout API to GraphQL, −38% latency', dot: 'bg-bar-pink' },
    ],
    cut: [{ text: 'Ran quarterly hardware inventory audits', reason: 'Unrelated to this posting' }],
  },
  platform: {
    label: 'Platform engineer',
    kept: [
      { text: 'Migrated the checkout API to GraphQL, −38% latency', dot: 'bg-bar-teal' },
      { text: 'Containerised 9 services on Kubernetes; cut build minutes 40%', dot: 'bg-bar-blue' },
      { text: 'Led the design-system rebuild across 4 product teams (React, TypeScript)', dot: 'bg-bar-pink' },
    ],
    cut: [{ text: 'Ran quarterly hardware inventory audits', reason: 'Unrelated to this posting' }],
  },
} as const;

type JobId = keyof typeof JOBS;

export default function TailorList() {
  const [job, setJob] = useState<JobId>('frontend');
  const { kept, cut } = JOBS[job];

  return (
    <div
      data-ui
      aria-label="Example: your CV reordered for a posting"
      className="rounded-2xl border border-line bg-surface p-5"
    >
      <p className="text-sm font-medium text-mute">Your CV, reordered for</p>
      <div role="group" aria-label="Choose a posting" className="mt-2.5 flex gap-2">
        {(Object.keys(JOBS) as JobId[]).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={job === id}
            onClick={() => setJob(id)}
            className={
              'rounded-full px-3.5 py-2 text-sm font-medium transition-colors active:scale-[0.97] ' +
              (job === id
                ? 'bg-primary text-on-primary'
                : 'bg-surface-2 text-ink hover:bg-line')
            }
          >
            {JOBS[id].label}
          </button>
        ))}
      </div>

      <ul key={job} className="mt-4 space-y-2.5">
        {kept.map((item, i) => (
          <li
            key={item.text}
            className="demo-rise flex items-start gap-2.5 text-sm leading-6 text-ink"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <span aria-hidden className={`mt-2.5 h-2 w-2 shrink-0 rounded-full ${item.dot}`} />
            {item.text}
          </li>
        ))}
        {cut.map((item, i) => (
          <li
            key={item.text}
            className="demo-rise flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm"
            style={{ animationDelay: `${(kept.length + i) * 80}ms` }}
          >
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-line-2" />
            <span className="text-mute line-through decoration-line-2">{item.text}</span>
            <span className="rounded-full bg-wash-coral px-2.5 py-0.5 text-xs font-medium text-tone-coral">
              Set aside: {item.reason}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-[13px] text-mute">
        {cut.length} item set aside, with the reason — nothing disappears silently.
      </p>
    </div>
  );
}
