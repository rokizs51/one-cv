// Module-level flag to warn once per process about missing PRICING_JSON
let pricingWarned = false;

/**
 * Supported providers:
 * - 'anthropic'  — the Anthropic API (default)
 * - 'qwen'       — Anthropic-WIRE-COMPATIBLE endpoints serving Qwen models
 *   (e.g. Alibaba Cloud Model Studio token plans). Same request/response
 *   shape, different baseURL + key + model IDs — which is exactly the
 *   swap the spec's "provider-swappable single ai module" anticipated.
 *   Requires AI_BASE_URL.
 */
export type AIProvider = 'anthropic' | 'qwen';

const SUPPORTED_PROVIDERS: readonly string[] = ['anthropic', 'qwen'];

export interface AIConfig {
  provider: AIProvider;
  extractionModel: string;
  enhanceModel: string;
  monthlyCostCeilingMicros: number;
  /** Anthropic-wire-compatible endpoint override (qwen plans); undefined → SDK default. */
  baseUrl?: string;
}

/**
 * AI configuration from environment variables.
 * Throws if the provider is unsupported or required vars are missing.
 */
export function aiConfig(): AIConfig {
  const providerRaw = process.env.AI_PROVIDER ?? 'anthropic';
  if (!SUPPORTED_PROVIDERS.includes(providerRaw)) {
    throw new Error(
      `Unsupported AI_PROVIDER: ${providerRaw}. Supported: ${SUPPORTED_PROVIDERS.join(', ')}`
    );
  }
  const provider = providerRaw as AIProvider;

  const extractionModel = process.env.AI_MODEL_EXTRACTION;
  const enhanceModel = process.env.AI_MODEL_ENHANCE;
  const baseUrl = process.env.AI_BASE_URL;

  const missing: string[] = [];
  if (!extractionModel) missing.push('AI_MODEL_EXTRACTION');
  if (!enhanceModel) missing.push('AI_MODEL_ENHANCE');
  if (provider === 'qwen' && !baseUrl) missing.push('AI_BASE_URL');

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const monthlyCostCeilingMicros = Number(process.env.AI_MONTHLY_COST_MICROUSD_CEILING) || 2_000_000;

  return {
    provider,
    extractionModel: extractionModel!,
    enhanceModel: enhanceModel!,
    monthlyCostCeilingMicros,
    // undefined → the SDK's own default endpoint
    baseUrl,
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
