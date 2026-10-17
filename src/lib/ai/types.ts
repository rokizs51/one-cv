import type { JdExtraction, Suggestion } from '@/lib/domain/types';

/**
 * GenAI provider interface — swappable backend for LLM operations.
 */
export interface GenAI {
  extractJd(jdText: string): Promise<JdExtraction>;
  enhance(req: EnhanceRequest): Promise<Suggestion[]>;
  composeSummary(req: SummaryRequest): Promise<string>;
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
