/**
 * The logo is the wordmark: Literata (the document face) with a pencil-red
 * full stop. No icon tile — the type is the mark, and the period is the only
 * graphic gesture. Set in serif deliberately: brand, not app chrome.
 */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-serif font-semibold tracking-tight ${className}`}>
      Sever
      <span aria-hidden className="text-primary">
        .
      </span>
    </span>
  );
}

/** Compact mark for the collapsed sidebar and app icon: the first letter. */
export function Monogram({ className = '' }: { className?: string }) {
  return (
    <span className={`font-serif font-semibold tracking-tight ${className}`}>
      S
      <span aria-hidden className="text-primary">
        .
      </span>
    </span>
  );
}