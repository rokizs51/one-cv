import type { ItemType, JdExtraction, ProfileItem, ResumeSection, SectionId } from '@/lib/domain/types';

export interface ScoredItem {
  item: ProfileItem;
  score: number;
  matchedKeywords: string[];
  section: SectionId;
}

// Map item types to section IDs
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
 * career_snapshot maps to 'summary' per the brief.
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

// Base order for sections
const BASE_ORDER: SectionId[] = [
  'summary',
  'skills',
  'experience',
  'projects',
  'education',
  'awards',
  'languages',
];

// Early career order: education and projects before experience
const EARLY_CAREER_ORDER: SectionId[] = [
  'summary',
  'skills',
  'education',
  'projects',
  'experience',
  'awards',
  'languages',
];

/**
 * Orders sections based on scored items and early career flag.
 * - Base order: summary, skills, experience, projects, education, awards, languages
 * - If earlyCareer: education and projects move before experience
 * - Empty sections are omitted
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
 * Early career if:
 * - All experience items ended within last 2 years (end > currentYear - 2), OR
 * - Any education item has graduation within 3 years of today
 * 
 * Not early career if:
 * - Any experience item has no end date (ongoing), OR
 * - Any experience item ended 2 or more years ago (end <= currentYear - 2)
 *   (unless recent graduation overrides this)
 * 
 * This is a simple deterministic rule for section ordering.
 */
export function isEarlyCareer(items: ProfileItem[]): boolean {
  const currentYear = new Date().getFullYear();

  const experienceItems = items.filter((item) => item.type === 'experience');
  const educationItems = items.filter((item) => item.type === 'education');

  // Check if all experience ended within last 2 years (strictly: end > currentYear - 2)
  // If no experience items, this is vacuously true
  const allExperienceRecent = experienceItems.every((item) => {
    const end = item.payload.end;
    // No end date means ongoing, so not early career
    if (!end) return false;
    
    const endYear = typeof end === 'string' ? parseInt(end, 10) : end;
    if (isNaN(endYear)) return false;
    
    // End year > current year - 2 means ended within last 2 years
    return endYear > currentYear - 2;
  });

  // Check if any education graduated within 3 years
  const recentGraduate = educationItems.some((item) => {
    const gradYear = item.payload.graduation_year;
    if (!gradYear) return false;
    
    const year = typeof gradYear === 'string' ? parseInt(gradYear, 10) : gradYear;
    if (isNaN(year)) return false;
    
    // Graduated within 3 years
    return year >= currentYear - 3;
  });

  // Early career if all experience is recent OR recent graduation
  return allExperienceRecent || recentGraduate;
}
