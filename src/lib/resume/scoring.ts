import type { ItemType, JdExtraction, ProfileItem, ResumeSection, SectionId } from '@/lib/domain/types';

export interface ScoredItem {
  item: ProfileItem;
  score: number;
  matchedKeywords: string[];
  section: SectionId;
}

// Map item types to section IDs.
// NOTE: career_snapshot's section is 'summary', but orderSections never emits
// a summary section (see BASE_ORDER comment): the snapshot renders as the
// doc's top-level doc.summary, and orchestrate filters snapshot items out of
// the scored pipeline. Do NOT re-admit 'summary' to the section lists — that
// reintroduces the dual-appearance bug pinned by orchestrate's tests.
const TYPE_TO_SECTION: Record<ItemType, SectionId> = {
  career_snapshot: 'summary',
  education: 'education',
  experience: 'experience',
  project: 'projects',
  award: 'awards',
  skill: 'skills',
  language: 'languages',
};

/**
 * Maps a ProfileItem's type to its corresponding SectionId.
 */
export function sectionOf(item: ProfileItem): SectionId {
  return TYPE_TO_SECTION[item.type];
}

/**
 * Recursively extracts all string values from a payload object.
 * Used to search payload for keyword matches.
 */
function extractPayloadStrings(payload: Record<string, unknown>): string[] {
  const strings: string[] = [];

  function recurse(value: unknown): void {
    if (typeof value === 'string') {
      strings.push(value);
    } else if (Array.isArray(value)) {
      value.forEach(recurse);
    } else if (value !== null && typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach(recurse);
    }
  }

  recurse(payload);
  return strings;
}

/**
 * Checks if a keyword matches in text using word-boundary matching.
 * Case-insensitive. Returns true if the keyword appears as a whole word.
 */
function matchesKeyword(text: string, keyword: string): boolean {
  if (!text || !keyword) return false;
  // Escape special regex characters in keyword
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Use word boundaries to ensure whole-word matching
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(text);
}

/**
 * Which JD keywords a piece of text hits — the same word-boundary matcher
 * keywordScore uses, exposed for the "why this matched" panel so the UI and
 * the scoring can never disagree about what matched.
 */
export function matchedKeywords(text: string, jd: JdExtraction): string[] {
  const ordered = [...jd.requiredSkills, ...jd.tools, ...jd.preferredSkills, ...jd.keywords];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const kw of ordered) {
    if (!seen.has(kw) && matchesKeyword(text, kw)) {
      seen.add(kw);
      out.push(kw);
    }
  }
  return out;
}

/**
 * Scores a ProfileItem against a JdExtraction based on keyword matches.
 * - requiredSkills: weight 3
 * - tools: weight 2
 * - preferredSkills + keywords: weight 1
 * Searches canonicalText and all string values in payload.
 * Deduplicates matchedKeywords.
 */
export function keywordScore(item: ProfileItem, jd: JdExtraction): ScoredItem {
  // Build searchable text from canonicalText + payload strings
  const payloadStrings = extractPayloadStrings(item.payload);
  const searchText = [item.canonicalText, ...payloadStrings].join(' ');

  const matchedKeywords = new Set<string>();
  let score = 0;

  // Check requiredSkills (weight 3)
  for (const skill of jd.requiredSkills) {
    if (matchesKeyword(searchText, skill)) {
      score += 3;
      matchedKeywords.add(skill);
    }
  }

  // Check tools (weight 2)
  for (const tool of jd.tools) {
    if (matchesKeyword(searchText, tool)) {
      score += 2;
      matchedKeywords.add(tool);
    }
  }

  // Check preferredSkills + keywords (weight 1)
  for (const skill of jd.preferredSkills) {
    if (matchesKeyword(searchText, skill)) {
      score += 1;
      matchedKeywords.add(skill);
    }
  }

  for (const keyword of jd.keywords) {
    if (matchesKeyword(searchText, keyword)) {
      score += 1;
      matchedKeywords.add(keyword);
    }
  }

  return {
    item,
    score,
    matchedKeywords: Array.from(matchedKeywords),
    section: sectionOf(item),
  };
}

// Base order for sections. No 'summary' entry by design: the headline
// summary is doc.summary (rendered by the template separately), never a
// section — see TYPE_TO_SECTION note above.
const BASE_ORDER: SectionId[] = [
  'skills',
  'experience',
  'projects',
  'education',
  'awards',
  'languages',
];

// Early career order: education and projects before experience
const EARLY_CAREER_ORDER: SectionId[] = [
  'skills',
  'education',
  'projects',
  'experience',
  'awards',
  'languages',
];

/**
 * Orders sections based on scored items and early career flag.
 * - Base order: skills, experience, projects, education, awards, languages
 * - If earlyCareer: education and projects move before experience
 * - Empty sections are omitted; a 'summary' section is never emitted
 */
export function orderSections(
  items: ScoredItem[],
  opts: { earlyCareer: boolean },
): ResumeSection[] {
  // Determine which sections have items
  const sectionsWithItems = new Set(items.map((si) => si.section));

  // Choose order based on early career flag
  const order = opts.earlyCareer ? EARLY_CAREER_ORDER : BASE_ORDER;

  // Build sections in order, omitting empty ones
  const sections: ResumeSection[] = [];
  for (const sectionId of order) {
    if (sectionsWithItems.has(sectionId)) {
      // Filter items for this section
      const sectionItems = items
        .filter((si) => si.section === sectionId)
        .map((si) => ({
          sourceItemId: si.item.id,
          text: si.item.canonicalText,
          basis: 'scored',
        }));

      sections.push({
        id: sectionId,
        items: sectionItems,
      });
    }
  }

  return sections;
}

/**
 * Determines if a candidate is early career based on their profile items.
 * 
 * Per plan: early career if:
 * - NO experience item has (end absent OR end >= currentYear - 2), OR
 * - Any education item has graduation (endYear) within 3 years of today
 * 
 * Interpretation: ongoing or recent work = established career. Only when all work
 * ended >2 years ago (stale) or no experience exists, treat as education-first ordering.
 * Recent graduates override this — even with established work history, show education first.
 * 
 * This is a simple deterministic rule for section ordering.
 * Pass an explicit `now` (orchestrate passes deps.now) so the year boundary
 * is deterministic in tests; defaults to wall-clock.
 */
export function isEarlyCareer(items: ProfileItem[], now: Date = new Date()): boolean {
  const currentYear = now.getUTCFullYear();

  const experienceItems = items.filter((item) => item.type === 'experience');
  const educationItems = items.filter((item) => item.type === 'education');

  // Check if NO experience item has (end absent OR end >= currentYear - 2)
  // i.e., all experience items have: end present AND end < currentYear - 2
  // If no experience items, vacuously true → early career
  const allExperienceStale = experienceItems.every((item) => {
    const end = item.payload.end;
    // No end date means ongoing → not early career (this item violates the rule)
    if (!end) return false;

    // payload.end may be a numeric year or a numeric string; coerce to number.
    const endYear =
      typeof end === 'number' ? end : typeof end === 'string' ? parseInt(end, 10) : NaN;
    if (isNaN(endYear)) return false;

    // End year < current year - 2 means ended more than 2 years ago (stale)
    return endYear < currentYear - 2;
  });

  // Check if any education graduated within 3 years (endYear in education payload)
  const recentGraduate = educationItems.some((item) => {
    const gradYear = item.payload.endYear;
    if (!gradYear) return false;

    // payload.endYear may be a numeric year or a numeric string; coerce to number.
    const year =
      typeof gradYear === 'number'
        ? gradYear
        : typeof gradYear === 'string'
          ? parseInt(gradYear, 10)
          : NaN;
    if (isNaN(year)) return false;

    // Graduated within 3 years
    return year >= currentYear - 3;
  });

  // Early career if all experience is stale (or none exists) OR recent graduation
  return allExperienceStale || recentGraduate;
}
