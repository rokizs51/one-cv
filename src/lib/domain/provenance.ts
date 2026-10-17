import type { ProfileItem, ProvenanceEntry } from './types';

/**
 * Apply an acceptance of new text to a profile item.
 * Sets canonicalText to newText and pushes a provenance entry tracking the change.
 */
export function applyAccept(
  prev: ProfileItem,
  newText: string,
  fromResumeId: string,
  at: string
): ProfileItem {
  const provenanceEntry: ProvenanceEntry = {
    text: newText,
    originalText: prev.canonicalText,
    fromResumeId,
    at,
  };

  return {
    ...prev,
    canonicalText: newText,
    provenance: [...prev.provenance, provenanceEntry],
  };
}

/**
 * Revert the last provenance entry.
 * Pops the last entry and restores its originalText as canonicalText.
 * Returns the item unchanged if provenance is empty.
 */
export function revertLast(item: ProfileItem): ProfileItem {
  if (item.provenance.length === 0) {
    return item;
  }

  const lastEntry = item.provenance[item.provenance.length - 1];
  const newProvenance = item.provenance.slice(0, -1);

  return {
    ...item,
    canonicalText: lastEntry.originalText,
    provenance: newProvenance,
  };
}
