import { generateObject, generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type { GenAI, EnhanceRequest, SummaryRequest } from './types';
import { JdNotParseableError } from './types';
import { aiConfig } from './env';
import { JdExtractionSchema } from '@/lib/domain/schemas';
import type { JdExtraction, Suggestion } from '@/lib/domain/types';

/**
 * Schema for enhance response - array of suggestions.
 */
const EnhanceResponseSchema = z.object({
  suggestions: z.array(
    z.object({
      itemId: z.string(),
      newText: z.string(),
      basis: z.string(),
    })
  ),
});

/**
 * Creates the real GenAI provider using Anthropic via AI SDK.
 * Throws if AI_PROVIDER is not 'anthropic' (v1 YAGNI gate).
 */
export function createGenAI(): GenAI {
  const config = aiConfig();

  if (config.provider !== 'anthropic') {
    throw new Error(
      `Unsupported AI_PROVIDER: ${config.provider}. Only 'anthropic' is supported in v1.`
    );
  }

  const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  return {
    async extractJd(jdText: string): Promise<JdExtraction> {
      const prompt = `Extract structured information from this job description. 
Only extract facts explicitly stated. Do not infer or assume anything.

Job Description:
${jdText}

Return a JSON object with these fields:
- requiredSkills: array of strings (must-have skills)
- preferredSkills: array of strings (nice-to-have skills)
- keywords: array of strings (domain terms, technologies, concepts)
- seniority: string (e.g., "junior", "mid", "senior", "lead")
- domain: string (industry or field)
- tools: array of strings (software, frameworks, platforms)
- responsibilities: array of strings (key duties)`;

      let lastError: Error | null = null;

      // Retry once on schema failure
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await generateObject({
            model: anthropic(config.extractionModel),
            schema: JdExtractionSchema,
            prompt,
          });

          return result.object;
        } catch (error) {
          lastError = error as Error;
          // Retry on schema/parse failures
          if (attempt === 0) {
            continue;
          }
        }
      }

      throw new JdNotParseableError(
        `Failed to parse job description after retry: ${lastError?.message}`
      );
    },

    async enhance(req: EnhanceRequest): Promise<Suggestion[]> {
      const { jd, items } = req;

      const jdContext = `
Required Skills: ${jd.requiredSkills.join(', ')}
Preferred Skills: ${jd.preferredSkills.join(', ')}
Keywords: ${jd.keywords.join(', ')}
Domain: ${jd.domain}
Seniority: ${jd.seniority}`;

      const itemsText = items
        .map((item, i) => `${i + 1}. [${item.itemId}] ${item.text}`)
        .join('\n');

      const prompt = `You are a resume enhancement assistant. Rewrite the provided resume bullets to better align with this job description.

Job Description Context:
${jdContext}

Resume Bullets to Enhance:
${itemsText}

Instructions:
- Rewrite each bullet to use vocabulary and keywords from the job description
- Only use facts from the original text - do NOT invent new information
- Preserve the core meaning and achievements
- Make the language more impactful and relevant to the target role
- Return a JSON object with a "suggestions" array

Each suggestion must have:
- itemId: the original item's ID
- newText: the enhanced bullet text
- basis: brief explanation of what was changed and why`;

      try {
        const result = await generateObject({
          model: anthropic(config.enhanceModel),
          schema: EnhanceResponseSchema,
          prompt,
        });

        return result.object.suggestions.map((s, i) => ({
          id: `suggestion-${i}`,
          targetItemId: s.itemId,
          kind: 'bullet' as const,
          newText: s.newText,
          basis: s.basis,
        }));
      } catch (error) {
        // Enhance failures return empty suggestions (non-critical)
        console.warn('Enhance failed:', error);
        return [];
      }
    },

    async composeSummary(req: SummaryRequest): Promise<string> {
      const { jd, snapshot, facts } = req;

      const jdContext = `
Target Role: ${jd.domain} (${jd.seniority} level)
Key Skills: ${jd.requiredSkills.slice(0, 5).join(', ')}
Keywords: ${jd.keywords.slice(0, 5).join(', ')}`;

      const factsText = facts.length > 0 ? facts.join('; ') : 'No additional facts provided';

      const prompt = `Compose a professional summary (3 lines maximum) for a resume.

Candidate Snapshot:
${snapshot}

Key Facts:
${factsText}

Target Job Context:
${jdContext}

Instructions:
- Write exactly 3 lines or fewer
- Use only information from the snapshot and facts provided
- Tailor the language to match the target job
- Be concise and impactful
- Do NOT invent information not present in the inputs`;

      try {
        const result = await generateText({
          model: anthropic(config.enhanceModel),
          prompt,
        });

        // Ensure max 3 lines
        const lines = result.text.split('\n').filter(Boolean).slice(0, 3);
        return lines.join('\n');
      } catch (error) {
        console.warn('composeSummary failed:', error);
        return 'Professional summary unavailable.';
      }
    },
  };
}
