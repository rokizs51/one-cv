import { generateText, JSONParseError, TypeValidationError, NoObjectGeneratedError } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type { GenAI, EnhanceRequest, SummaryRequest } from './types';
import { JdNotParseableError } from './types';
import { aiConfig } from './env';
import { JdExtractionSchema } from '@/lib/domain/schemas';
import type { JdExtraction, Suggestion } from '@/lib/domain/types';

/**
 * Checks if an error is a schema/parse error that should trigger retry.
 * Only AI-SDK schema validation and JSON parse errors qualify.
 */
export function isSchemaParseError(error: unknown): boolean {
  return (
    error instanceof JSONParseError ||
    error instanceof TypeValidationError ||
    error instanceof NoObjectGeneratedError
  );
}

/**
 * Prompt-instructed JSON + client-side parse/validate, returned through the
 * same error classes the retry classifier knows.
 *
 * Deliberately NOT generateObject (deprecated) and NOT Output.object(): both
 * compile to responseFormat:'json', which @ai-sdk/anthropic implements as a
 * forced tool call (tool_choice:'any') on models without native structured
 * output. Anthropic-compatible third-party endpoints (Qwen token plans) reject
 * forced tool use with 404 "Not support". Plain text + JSON instruction works
 * on any Anthropic-wire provider, which is the whole point of the swappable
 * single ai module.
 */
async function generateJson<T>(opts: {
  model: Parameters<typeof generateText>[0]['model'];
  prompt: string;
  schema: z.ZodType<T>;
}): Promise<T> {
  const result = await generateText({
    model: opts.model,
    prompt: `${opts.prompt}

Respond with ONLY a single valid JSON object - no prose, no markdown code fences, no trailing commentary.`,
  });

  const parsedResult = await safeParseJsonObject(result.text);
  if (!parsedResult.ok) {
    throw new JSONParseError({ text: result.text, cause: parsedResult.error });
  }

  const validated = opts.schema.safeParse(parsedResult.value);
  if (!validated.success) {
    throw new TypeValidationError({ value: parsedResult.value, cause: validated.error });
  }
  return validated.data;
}

/**
 * Models wrap JSON in prose or ``` fences often enough that slicing is part
 * of the contract: take the outermost {...} span, then parse strictly.
 */
async function safeParseJsonObject(text: string): Promise<{ ok: true; value: unknown } | { ok: false; error: Error }> {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('no JSON object found in response');
    return { ok: true, value: JSON.parse(text.slice(start, end + 1)) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

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
 * Experience items are "Role — Company (dates)\n• bullet…". A rewrite that
 * drops the title line would delete the header from the CV AND, on accept,
 * from the profile item (acceptText replaces the whole canonical text) — the
 * floating headerless paragraph bug. Prompt says keep it; this makes it
 * structural: if the model dropped or altered it, restore the original line.
 */
export function preserveHeaderLines<T extends { targetItemId: string; newText: string }>(
  suggestions: T[],
  items: { itemId: string; text: string }[]
): T[] {
  return suggestions.map((s) => {
    const lines = items.find((it) => it.itemId === s.targetItemId)?.text.split('\n') ?? [];
    const header = lines.length > 1 && !lines[0].trimStart().startsWith('•') ? lines[0] : null;
    if (!header || s.newText.split('\n')[0].trim() === header.trim()) return s;
    return { ...s, newText: `${header}\n${s.newText}` };
  });
}

/**
 * Creates the real GenAI provider via AI SDK.
 *
 * Both supported providers speak the Anthropic wire protocol (aiConfig()
 * gates AI_PROVIDER to 'anthropic' | 'qwen'): 'qwen' points the same client
 * at an Anthropic-compatible endpoint from a Qwen token plan, with
 * AI_BASE_URL + model IDs supplied by that plan.
 */
export function createGenAI(): GenAI {
  const config = aiConfig();

  const anthropic = createAnthropic({
    // AI_API_KEY is the provider-neutral name; ANTHROPIC_API_KEY kept as
    // the fallback so existing setups need no change.
    apiKey: process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY,
    // undefined → SDK default (api.anthropic.com). Custom bases must include
    // the version segment: the SDK appends "/messages" to baseURL.
    baseURL: config.baseUrl,
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

      // Retry once on schema/parse failure only
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return await generateJson({
            model: anthropic(config.extractionModel),
            schema: JdExtractionSchema,
            prompt,
          });
        } catch (error) {
          // Non-parse errors (network, auth, rate limit) re-throw immediately
          if (!isSchemaParseError(error)) {
            throw error;
          }
          lastError = error as Error;
          // Retry only if this was the first attempt
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
- An item may start with a title line ("Role — Company (dates)") followed by bullet lines that start with "•". Keep such title lines verbatim and rewrite only the bullet lines.
- Return a JSON object with a "suggestions" array

Each suggestion must have:
- itemId: the original item's ID
- newText: the enhanced bullet text
- basis: brief explanation of what was changed and why`;

      const result = await generateJson({
        model: anthropic(config.enhanceModel),
        schema: EnhanceResponseSchema,
        prompt,
      });

      return preserveHeaderLines(
        result.suggestions.map((s, i) => ({
          id: `suggestion-${i}`,
          targetItemId: s.itemId,
          kind: 'bullet' as const,
          newText: s.newText,
          basis: s.basis,
        })),
        items
      );
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

      const result = await generateText({
        model: anthropic(config.enhanceModel),
        prompt,
      });

      // Ensure max 3 lines
      const lines = result.text.split('\n').filter(Boolean).slice(0, 3);
      return lines.join('\n');
    },
  };
}
