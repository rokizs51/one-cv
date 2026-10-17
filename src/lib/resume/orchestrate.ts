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
import { estimateLines, fitToPage, snapshotOf } from '@/lib/resume/fit';
import { estimateCostMicros } from '@/lib/ai/env';

export interface OrchestrateDeps {
  supa: SupabaseClient;
  ai: GenAI;
  now: Date;
  user: { id: string; email: string };
  enhanceModel: string;
  monthlyCostCeilingMicros: number;
}

// Rough token model for one enhance generation (composeSummary + enhance
// combined), scaled to what is actually sent — a fixed 1000/500 assumption
// under-counts a full-page profile by 2-4x and would trip the global budget
// breaker only after real spend overshot the ceiling. Used solely for
// PRICING_JSON cost estimates; never shown to users as exact usage.
// Exported for tests.
export const ESTIMATE_PROMPT_OVERHEAD_TOKENS = 800; // system + JD context + instructions
export const ESTIMATE_CHARS_PER_TOKEN = 4;
export const ESTIMATE_OUTPUT_TOKENS_PER_BULLET = 80; // rewrite + basis per bullet
export const ESTIMATE_SUMMARY_OUTPUT_TOKENS = 150; // composed headline (≤3 lines)

// Line budget reserved for the composed summary (rendered doc.summary, never
// scored): the prompt caps it at 3 lines; +1 slack for wrapping.
export const ENHANCE_SUMMARY_RESERVE_UNITS = 4;

export function estimateEnhanceTokens(textChars: number, bulletCount: number): {
  input: number;
  output: number;
} {
  return {
    input: ESTIMATE_PROMPT_OVERHEAD_TOKENS + Math.ceil(textChars / ESTIMATE_CHARS_PER_TOKEN),
    output: ESTIMATE_SUMMARY_OUTPUT_TOKENS + bulletCount * ESTIMATE_OUTPUT_TOKENS_PER_BULLET,
  };
}

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

  // Single lookup shared by summary composition and the page-budget reserve.
  const snapshotItem = items.find((item) => item.type === 'career_snapshot') ?? null;

  // 5. Determine early career (deps.now-injected for determinism)
  const earlyCareer = isEarlyCareer(items, now);

  // 6. Order sections
  const sections = orderSections(scored, { earlyCareer });

  // 7. Fit to page, reserving budget for the rendered summary. The snapshot
  // is excluded from scoring (it renders as doc.summary, never a section), so
  // without this reservation its lines would go uncounted and a "fitting"
  // doc would silently spill onto page 2.
  const summaryReserveUnits =
    snapshotItem && mode === 'as_is'
      ? estimateLines(snapshotItem)
      : mode === 'enhance'
        ? ENHANCE_SUMMARY_RESERVE_UNITS
        : 0;
  const fitResult = fitToPage(scored, pageLimit, summaryReserveUnits);

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

  let enhanceTokens: { input: number; output: number } | null = null;

  if (mode === 'as_is') {
    // as-is: use career_snapshot verbatim (shared snapshotItem lookup)
    if (snapshotItem) {
      summary = snapshotItem.canonicalText;
    }
  } else {
    // enhance mode: call AI to compose summary
    const chosenItems = fitResult.chosen.map((s) => s.item);
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

    // Size the estimate to what we actually sent (shared by both calls'
    // prompts: the item texts + snapshot).
    const textChars =
      snapshotText.length +
      chosenItems.reduce((n, item) => n + item.canonicalText.length + 1, 0);
    enhanceTokens = estimateEnhanceTokens(textChars, chosenItems.length);
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

  // 9. Record quota + spend BEFORE persistence. In enhance mode the LLM money
  // is already spent by the time we get here; if saveResume then fails, the
  // spend and the generation count must still be on the books, or the global
  // budget guard under-counts and retries look cheaper than they are.
  const costMicros = enhanceTokens
    ? estimateCostMicros(deps.enhanceModel, enhanceTokens)
    : 0; // as-is runs zero LLM calls — record no spend
  await recordGeneration(supa, user.id, costMicros, now);

  // 10. Save resume
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

  return resume;
}
