/**
 * Flat horizontal progress bar — no gradient, no glow. Track is a quiet
 * surface-2 groove; fill is one of the saturated thematic colors. The
 * accessible value is carried by role="progressbar" + aria-value, and the
 * numeric label always sits beside the bar (color is never the only signal).
 */
export type BarColor = 'blue' | 'violet' | 'teal' | 'coral' | 'pink' | 'amber' | 'green' | 'red';

const FILL: Record<BarColor, string> = {
  blue: 'bg-bar-blue',
  violet: 'bg-bar-violet',
  teal: 'bg-bar-teal',
  coral: 'bg-bar-coral',
  pink: 'bg-bar-pink',
  amber: 'bg-bar-amber',
  green: 'bg-bar-green',
  red: 'bg-bar-red',
};

export default function Progress({
  value,
  max = 100,
  color = 'blue',
  label,
  className = '',
}: {
  value: number;
  max?: number;
  color?: BarColor;
  /** Visible context, e.g. "3 of 5 entries" — rendered by the caller beside the bar. */
  label?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(max, value));
  const pct = max === 0 ? 0 : Math.round((clamped / max) * 100);

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={`h-1.5 w-full overflow-hidden rounded-full bg-surface-2 ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${FILL[color]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
