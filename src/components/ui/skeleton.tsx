/**
 * Skeleton blocks for loads longer than a blink — reserved layout space so
 * nothing jumps when real content lands (CLS). Decoration only: aria-hidden.
 */
export default function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-2xl bg-surface-2 ${className}`}
    />
  );
}

export function SkeletonCard() {
  return (
    <div aria-hidden className="rounded-2xl border border-line bg-surface p-5">
      <Skeleton className="mb-3 h-4 w-1/3" />
      <Skeleton className="mb-2 h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}
