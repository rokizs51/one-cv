import type { ReactNode } from 'react';

/**
 * The one card shape: white surface on the off-white page, thin gray line,
 * generous radius, no shadow. `wash` renders a soft pastel variant for
 * highlighted regions.
 */
export default function Card({
  children,
  className = '',
  as: Tag = 'div',
  bg = 'bg-surface',
  border = 'border-line',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'aside';
  /** Surface overrides for tinted cards — pass utilities, not both className+here. */
  bg?: string;
  border?: string;
}) {
  return (
    <Tag className={`rounded-2xl border ${border} ${bg} ${className}`}>
      {children}
    </Tag>
  );
}

export function SectionHeading({
  children,
  className = '',
  id,
  color = 'text-mute',
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  /** Any text-* utility; callers replace the default to recolor the label. */
  color?: string;
}) {
  return (
    <h2 id={id} className={`text-xs font-semibold uppercase tracking-[0.08em] ${color} ${className}`}>
      {children}
    </h2>
  );
}
