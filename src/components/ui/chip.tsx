import type { ReactNode } from 'react';

/**
 * Square flag, sentence case. Categorical meaning lives in the label text,
 * so the default tone is neutral; the red/amber/green tones are reserved
 * for functional status (error, warning, success) and flip with dark mode.
 */
export type Tone = 'neutral' | 'red' | 'amber' | 'green';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink',
  red: 'bg-wash-red text-tone-red',
  amber: 'bg-wash-amber text-tone-amber',
  green: 'bg-wash-green text-tone-green',
};

export default function Chip({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
