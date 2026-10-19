import type { JdExtraction, Suggestion } from '@/lib/domain/types';
import type { MatchAnalysisRequest, MatchAnalysisModelOutput } from '@/lib/match/match-types';

/**
 * GenAI provider interface — swappable backend for LLM operations.
 */
export interface SkillGroup {
  category: string;
  skills: string[];
}

export interface GenAI {
  extractJd(jdText: string): Promise<JdExtraction>;
  enhance(req: EnhanceRequest): Promise<Suggestion[]>;
  composeSummary(req: SummaryRequest): Promise<string>;
  // Presentation-only grouping of skill names for the CV's SKILLS section;
  // never writes back to the profile.
  groupSkills(names: string[]): Promise<SkillGroup[]>;
  // Requirement→evidence assessment. Output is post-validated by the
  // deterministic guards in lib/match/analyze — this method only produces it.
  analyzeMatch(req: MatchAnalysisRequest): Promise<MatchAnalysisModelOutput>;
}

/**
 * Request to enhance resume bullets for a specific job description.
 */
export interface EnhanceRequest {
  jd: JdExtraction;
  items: { itemId: string; text: string }[];
}

/**
 * Request to compose a professional summary from profile data.
 */
export interface SummaryRequest {
  jd: JdExtraction;
  snapshot: string;
  facts: string[];
}

/**
 * Thrown when job description parsing fails after retry.
 */
export class JdNotParseableError extends Error {
  constructor(message = 'Failed to parse job description after retry') {
    super(message);
    this.name = 'JdNotParseableError';
  }
}

/**
 * Thrown when the match-analysis model output stays unparseable after retry —
 * the analysis row is marked failed, never half-written as completed.
 */
export class AnalysisNotParseableError extends Error {
  constructor(message = 'Match analysis output invalid after retry') {
    super(message);
    this.name = 'AnalysisNotParseableError';
  }
}
