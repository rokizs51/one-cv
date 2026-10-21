/**
 * Flat progress bar — one ink fill in a tone-step groove. No gradient, no
 * glow, no categorical hues: the number beside the bar carries the meaning.
 * The accessible value is carried by role="progressbar" + aria-value.
 */
export default function Progress({
  value,
  max = 100,
  label,
  className = '',
}: {
  value: number;
  max?: number;
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
      className={`h-1.5 w-full overflow-hidden bg-surface-2 ${className}`}
    >
      <div
        className="h-full bg-bar transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
