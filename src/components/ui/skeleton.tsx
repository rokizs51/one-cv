/**
 * Skeleton blocks for loads longer than a blink — reserved layout space so
 * nothing jumps when real content lands (CLS). Decoration only: aria-hidden.
 */
export default function Skeleton({ className = '' }: { className?: string }) {
  const skel = `animate-pulse bg-surface-2 ${className}`; // taste-skill-ignore: standard skeleton affordance
  return <div aria-hidden className={skel} />;
}

export function SkeletonCard() {
  return (
    <div aria-hidden className="bg-surface p-5">
      <Skeleton className="mb-3 h-4 w-1/3" />
      <Skeleton className="mb-2 h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}
