import type { JdExtraction } from '@/lib/domain/types';

interface ChipProps {
  label: string;
  items: string[];
  maxChips: number;
  renderedChips: { count: number; overflow: number };
}

function ChipSection({ label, items, maxChips, renderedChips }: ChipProps) {
  const remaining = maxChips - renderedChips.count;
  const chipsToShow = items.slice(0, Math.max(0, remaining));
  
  if (chipsToShow.length === 0) {
    return null;
  }

  renderedChips.count += chipsToShow.length;

  return (
    <div className="flex flex-wrap gap-2">
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mr-1">
        {label}:
      </span>
      {chipsToShow.map((item, idx) => (
        <span
          key={`${label}-${idx}`}
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

interface JdChipsProps {
  extraction: JdExtraction;
}

export function JdChips({ extraction }: JdChipsProps) {
  const MAX_CHIPS = 24;
  const renderedChips = { count: 0, overflow: 0 };

  const sections = [
    { label: 'Required', items: extraction.requiredSkills },
    { label: 'Preferred', items: extraction.preferredSkills },
    { label: 'Tools', items: extraction.tools },
    { label: 'Keywords', items: extraction.keywords },
  ];

  const totalChips = sections.reduce((sum, s) => sum + s.items.length, 0);
  renderedChips.overflow = Math.max(0, totalChips - MAX_CHIPS);

  return (
    <div className="space-y-2">
      {sections.map((section) => (
        <ChipSection
          key={section.label}
          label={section.label}
          items={section.items}
          maxChips={MAX_CHIPS}
          renderedChips={renderedChips}
        />
      ))}
      {renderedChips.overflow > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
          +{renderedChips.overflow}
        </span>
      )}
    </div>
  );
}
