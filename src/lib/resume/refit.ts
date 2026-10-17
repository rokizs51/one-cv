import type { SupabaseClient } from '@supabase/supabase-js';
import type { JdExtraction, ResumeDoc } from '@/lib/domain/types';
import { getOrCreateProfile } from '@/lib/db/profiles';
import { listItems } from '@/lib/db/items';
import { getJd } from '@/lib/db/jds';
import { buildFit, snapshotOf, type FitResultSnapshot } from './fit';

export interface RefitOutcome {
  fit: FitResultSnapshot;
  cuts: { itemId: string; reason: 'relevance' | 'space'; text: string }[];
  overflow: boolean;
  extraction: JdExtraction | null;
}

/**
 * Recompute the fit for a resume's CURRENT doc — the single definition used
 * by both the advisory /fit route (live cut list, optional unsaved userEdits)
 * and PATCH dispositions (persisted). The doc's item texts override stored
 * canonicalText so scoring and budget match exactly what the page renders;
 * doc.summary's lines are reserved. Returns null when the underlying JD is
 * unreadable: the CV itself stays intact — matching detail is advisory.
 */
export async function refitFromDoc(
  supa: SupabaseClient,
  userId: string,
  opts: {
    doc: ResumeDoc;
    jdId: string;
    pageLimit: 1 | 2;
    userEdits?: Record<string, string>;
  }
): Promise<RefitOutcome | null> {
  const { doc, jdId, pageLimit, userEdits } = opts;

  // JD/reads are advisory here: a transient job_descriptions failure must
  // never 500 an otherwise-intact view/export flow.
  let jd: Awaited<ReturnType<typeof getJd>>;
  try {
    jd = await getJd(supa, jdId);
  } catch {
    return null;
  }
  if (!jd) return null;

  const profile = await getOrCreateProfile(supa, userId);
  const items = await listItems(supa, profile.id);

  const overrides: Record<string, string> = {};
  for (const section of doc.sections ?? []) {
    for (const item of section.items) overrides[item.sourceItemId] = item.text;
  }
  Object.assign(overrides, userEdits ?? {});

  const { fit } = buildFit(items, jd.extraction, pageLimit, doc.summary, overrides);
  return {
    fit: snapshotOf(fit),
    cuts: fit.cuts.map((c) => ({
      itemId: c.item.item.id,
      reason: c.reason,
      text: c.item.item.canonicalText,
    })),
    overflow: fit.overflow,
    extraction: jd.extraction,
  };
}
