import type { SupabaseClient } from '@supabase/supabase-js';
import type { GenAI } from '@/lib/ai/types';
import type {
  GenMode,
  ProfileItem,
  ResumeDoc,
  ResumeHeader,
  ResumeSection,
  ResumeDocItem,
  Suggestion,
  SuggestionState,
} from '@/lib/domain/types';
import type { GeneratedResume } from '@/lib/db/resumes';
import type { FitResultSnapshot } from '@/lib/resume/fit-types';
import { getOrCreateProfile } from '@/lib/db/profiles';
import { listItems } from '@/lib/db/items';
import { getJd } from '@/lib/db/jds';
import { saveResume } from '@/lib/db/resumes';
import { currentUsage, recordGeneration, GENERATIONS_CAP, globalLlmCost, monthKey } from '@/lib/db/quota';
import { keywordScore, isEarlyCareer, orderSections } from '@/lib/resume/scoring';
import type { ScoredItem } from '@/lib/resume/scoring';
import { fitToPage, snapshotOf } from '@/lib/resume/fit';
import { estimateCostMicros } from '@/lib/ai/env';

export interface OrchestrateDeps {
  supa: SupabaseClient;
  ai: GenAI;
  now: Date;
  user: { id: string; email: string };
  enhanceModel: string;
  monthlyCostCeilingMicros: number;
}

// Rough token budget for one enhance generation (composeSummary + enhance
// combined); used only to estimate cost against PRICING_JSON, never reported
// to the user as exact usage.
const ESTIMATE_INPUT_TOKENS = 1000;
const ESTIMATE_OUTPUT_TOKENS = 500;

export interface GenerateInput {
  jdId: string;
  mode: GenMode;
  pageLimit: 1 | 2;
}

export class QuotaExceededError extends Error {
  constructor() {
    super('Monthly generation quota exceeded');
    this.name = 'QuotaExceededError';
  }
}

export class GenerationUnavailableError extends Error {
  constructor(reason: 'budget') {
    super(`Generation unavailable: ${reason}`);
    this.name = 'GenerationUnavailableError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export async function generateResume(
  deps: OrchestrateDeps,
  input: GenerateInput
): Promise<GeneratedResume> {
  const { supa, ai, now, user } = deps;
  const { jdId, mode, pageLimit } = input;

  // 1. Check quota BEFORE any LLM call
  const usage = await currentUsage(supa, user.id, now);
  if (usage.generations >= GENERATIONS_CAP) {
    throw new QuotaExceededError();
  }

  // 2. Load profile, items, JD
  const profile = await getOrCreateProfile(supa, user.id);
  const items = await listItems(supa, profile.id);
  const jd = await getJd(supa, jdId);
  if (!jd) {
    throw new NotFoundError('not_found');
  }

  // 3. For enhance mode, check budget before LLM calls
  if (mode === 'enhance') {
    const currentMonth = monthKey(now);
    const currentCost = await globalLlmCost(supa, currentMonth);
    if (currentCost >= deps.monthlyCostCeilingMicros) {
      throw new GenerationUnavailableError('budget');
    }
  }

  // 4. Score items, EXCLUDING career_snapshot. The snapshot is rendered as the
  // doc's top-level summary (doc.summary), never as a section item. Filtering
  // here — not just at doc build — keeps a *pinned* snapshot from being forced
  // back into sections by the fit engine, scopes enhance/facts to real bullets,
  // and stops the snapshot from double-counting page space.
  const scored: ScoredItem[] = items
    .filter((item) => item.type !== 'career_snapshot')
    .map((item) => keywordScore(item, jd.extraction));

  // 5. Determine early career
  const earlyCareer = isEarlyCareer(items);

  // 6. Order sections
  const sections = orderSections(scored, { earlyCareer });

  // 7. Fit to page
  const fitResult = fitToPage(scored, pageLimit);

  // 8. Build ResumeDoc
  const header: ResumeHeader = {
    fullName: profile.personal.fullName,
    email: profile.personal.email,
    phone: profile.personal.phone,
    location: profile.personal.location,
    links: profile.personal.links,
  };

  let summary: string | null = null;
  const suggestions: Suggestion[] = [];
  const statuses: SuggestionState[] = [];

  if (mode === 'as_is') {
    // as-is: use career_snapshot verbatim
    const snapshotItem = items.find((item) => item.type === 'career_snapshot');
    if (snapshotItem) {
      summary = snapshotItem.canonicalText;
    }
  } else {
    // enhance mode: call AI to compose summary
    const chosenItems = fitResult.chosen.map((s) => s.item);
    const snapshotItem = items.find((item) => item.type === 'career_snapshot');
    const snapshotText = snapshotItem?.canonicalText || '';
    const facts = chosenItems.map((item) => item.canonicalText);
    
    summary = await ai.composeSummary({
      jd: jd.extraction,
      snapshot: snapshotText,
      facts,
    });

    // Call ai.enhance for chosen bullets
    const enhanceSuggestions = await ai.enhance({
      jd: jd.extraction,
      items: chosenItems.map((item) => ({ itemId: item.id, text: item.canonicalText })),
    });

    for (const sug of enhanceSuggestions) {
      suggestions.push(sug);
      statuses.push({
        suggestion: sug,
        status: 'pending',
        finalText: null,
      });
    }
  }

  // Build sections with only chosen items and override basis to source profile item id
  const chosenItemIds = new Set(fitResult.chosen.map((s) => s.item.id));
  const docSections: ResumeSection[] = sections
    .map((section) => ({
      ...section,
      items: section.items
        .filter((item) => chosenItemIds.has(item.sourceItemId))
        .map((item) => ({
          ...item,
          basis: item.sourceItemId, // Override basis to source profile item id
        })),
    }))
    .filter((section) => section.items.length > 0);

  const doc: ResumeDoc = {
    header,
    summary,
    sections: docSections,
  };

  // 9. Save resume
  const fit: FitResultSnapshot = snapshotOf(fitResult);
  const resume = await saveResume(supa, user.id, {
    jdId,
    mode,
    pageLimit,
    doc,
    suggestions,
    statuses,
    userEdits: {},
    fit,
  });

  // 10. Record generation
  const costMicros = mode === 'enhance'
    ? estimateCostMicros(deps.enhanceModel, {
        input: ESTIMATE_INPUT_TOKENS,
        output: ESTIMATE_OUTPUT_TOKENS,
      })
    : 0; // as-is runs zero LLM calls — record no spend
  await recordGeneration(supa, user.id, costMicros, now);

  return resume;
}
