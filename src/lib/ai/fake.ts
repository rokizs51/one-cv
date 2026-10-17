import type { GenAI, EnhanceRequest, SummaryRequest } from './types';
import type { JdExtraction, Suggestion } from '@/lib/domain/types';

/**
 * Call recorder for fake GenAI - tracks all invocations for test assertions.
 */
export interface FakeGenAICalls {
  extractJd: string[];
  enhance: EnhanceRequest[];
  composeSummary: SummaryRequest[];
}

/**
 * Fake GenAI with call recording for testing.
 */
export interface FakeGenAI extends GenAI {
  calls: FakeGenAICalls;
}

/**
 * Default extraction result for tests.
 */
const defaultExtraction: JdExtraction = {
  requiredSkills: ['TypeScript', 'React'],
  preferredSkills: ['Next.js'],
  keywords: ['frontend', 'web development'],
  seniority: 'mid',
  domain: 'software',
  tools: ['VS Code', 'Git'],
  responsibilities: ['Build UI components', 'Write tests'],
};

/**
 * Creates a fake GenAI provider for testing.
 * Records all calls and returns configurable responses.
 */
export function makeFakeGenAI(overrides?: Partial<GenAI>): FakeGenAI {
  const calls: FakeGenAICalls = {
    extractJd: [],
    enhance: [],
    composeSummary: [],
  };

  return {
    calls,

    async extractJd(jdText: string): Promise<JdExtraction> {
      calls.extractJd.push(jdText);
      if (overrides?.extractJd) {
        return overrides.extractJd(jdText);
      }
      return defaultExtraction;
    },

    async enhance(req: EnhanceRequest): Promise<Suggestion[]> {
      calls.enhance.push(req);
      if (overrides?.enhance) {
        return overrides.enhance(req);
      }
      // Return empty suggestions by default
      return [];
    },

    async composeSummary(req: SummaryRequest): Promise<string> {
      calls.composeSummary.push(req);
      if (overrides?.composeSummary) {
        return overrides.composeSummary(req);
      }
      return 'Test summary';
    },
  };
}
