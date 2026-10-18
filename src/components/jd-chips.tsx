import type { JdExtraction } from '@/lib/domain/types';
import Chip, { type Tone } from '@/components/ui/chip';

// Thematic color per JD category — vibrant text on a pastel wash.
const SECTION_TONE: Record<string, Tone> = {
  Required: 'coral',
  Preferred: 'violet',
  Tools: 'teal',
  Keywords: 'blue',
};

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
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-mute">
        {label}:
      </span>
      {chipsToShow.map((item, idx) => (
        <Chip key={`${label}-${idx}`} tone={SECTION_TONE[label] ?? 'neutral'}>
          {item}
        </Chip>
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
        <Chip tone="neutral" className="border border-line">
          +{renderedChips.overflow}
        </Chip>
      )}
    </div>
  );
}
