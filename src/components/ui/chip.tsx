import type { ReactNode } from 'react';

/**
 * Pill chip in a pastel wash with a contrast-checked colored label. Tone is
 * thematic (category color); every tone also carries text, never color alone.
 * Wash/tone pairs are defined in globals.css and flip with dark mode.
 */
export type Tone = 'blue' | 'violet' | 'teal' | 'coral' | 'pink' | 'amber' | 'red' | 'green' | 'neutral';

const TONES: Record<Tone, string> = {
  blue: 'bg-wash-blue text-tone-blue',
  violet: 'bg-wash-violet text-tone-violet',
  teal: 'bg-wash-teal text-tone-teal',
  coral: 'bg-wash-coral text-tone-coral',
  pink: 'bg-wash-pink text-tone-pink',
  amber: 'bg-wash-amber text-tone-amber',
  red: 'bg-wash-red text-tone-red',
  green: 'bg-wash-green text-tone-green',
  neutral: 'bg-surface-2 text-mute',
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
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
