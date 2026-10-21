import type { ReactNode } from 'react';

/**
 * The one card shape: square, a paper surface a tone step off the page.
 * Borders are opt-in (`border` prop) — separation comes from the tone
 * difference first; a real product fragment (data-ui) may keep its own line.
 */
export default function Card({
  children,
  className = '',
  as: Tag = 'div',
  bg = 'bg-surface',
  border = '',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'aside';
  /** Surface overrides for tinted cards — pass utilities, not both className+here. */
  bg?: string;
  /** Any border-* utility; empty means no line, tone step does the work. */
  border?: string;
}) {
  return (
    <Tag className={`${border ? `border ${border}` : ''} ${bg} ${className}`}>
      {children}
    </Tag>
  );
}

export function SectionHeading({
  children,
  className = '',
  id,
  color = 'text-ink',
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  /** Any text-* utility; callers replace the default to recolor the label. */
  color?: string;
}) {
  return (
    <h2 id={id} className={`text-base font-semibold ${color} ${className}`}>
      {children}
    </h2>
  );
}
