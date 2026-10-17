// Module-level flag to warn once per process about missing PRICING_JSON
let pricingWarned = false;

/**
 * AI configuration from environment variables.
 * Throws if required model IDs are missing.
 */
export function aiConfig() {
  const provider = process.env.AI_PROVIDER ?? 'anthropic';
  const extractionModel = process.env.AI_MODEL_EXTRACTION;
  const enhanceModel = process.env.AI_MODEL_ENHANCE;

  const missing: string[] = [];
  if (!extractionModel) missing.push('AI_MODEL_EXTRACTION');
  if (!enhanceModel) missing.push('AI_MODEL_ENHANCE');

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const monthlyCostCeilingUsd = Number(process.env.MONTHLY_COST_CEILING_USD) || 10;
  const monthlyCostCeilingMicros = monthlyCostCeilingUsd * 1_000_000;

  return {
    provider,
    extractionModel: extractionModel!,
    enhanceModel: enhanceModel!,
    monthlyCostCeilingMicros,
  };
}

/**
 * Estimate cost in micros (millionths of a USD cent).
 * Reads PRICING_JSON env: {"<model>": {"input": usdPerMTok, "output": usdPerMTok}}
 * Returns 0 and warns once if PRICING_JSON is missing.
 * Returns 0 if model not found in pricing table.
 */
export function estimateCostMicros(
  model: string,
  tokens: { input: number; output: number }
): number {
  const pricingJson = process.env.PRICING_JSON;

  if (!pricingJson) {
    if (!pricingWarned) {
      console.warn('PRICING_JSON environment variable is not set; cost estimates will be 0');
      pricingWarned = true;
    }
    return 0;
  }

  try {
    const pricing = JSON.parse(pricingJson);
    const modelPricing = pricing[model];

    if (!modelPricing) {
      return 0;
    }

    // price is USD per million tokens
    // cost_micros = tokens * price (since tokens/1M * price * 1M = tokens * price)
    const inputCost = tokens.input * modelPricing.input;
    const outputCost = tokens.output * modelPricing.output;

    return Math.round(inputCost + outputCost);
  } catch (error) {
    return 0;
  }
}
