import { describe, it, expect, beforeEach, vi } from 'vitest';
import { aiConfig, estimateCostMicros } from './env';

describe('aiConfig', () => {
  beforeEach(() => {
    // Clear env before each test
    delete process.env.AI_PROVIDER;
    delete process.env.AI_MODEL_EXTRACTION;
    delete process.env.AI_MODEL_ENHANCE;
    delete process.env.AI_MONTHLY_COST_MICROUSD_CEILING;
  });

  it('throws when required env vars are missing', () => {
    expect(() => aiConfig()).toThrowError(/AI_MODEL_EXTRACTION/);
    expect(() => aiConfig()).toThrowError(/AI_MODEL_ENHANCE/);
  });

  it('returns config when required vars are set', () => {
    process.env.AI_MODEL_EXTRACTION = 'claude-3-haiku-20240307';
    process.env.AI_MODEL_ENHANCE = 'claude-3-5-sonnet-20241022';

    const config = aiConfig();

    expect(config.provider).toBe('anthropic');
    expect(config.extractionModel).toBe('claude-3-haiku-20240307');
    expect(config.enhanceModel).toBe('claude-3-5-sonnet-20241022');
    expect(typeof config.monthlyCostCeilingMicros).toBe('number');
  });

  it('uses default monthly cost ceiling when not set', () => {
    process.env.AI_MODEL_EXTRACTION = 'claude-3-haiku-20240307';
    process.env.AI_MODEL_ENHANCE = 'claude-3-5-sonnet-20241022';

    const config = aiConfig();

    // Default is 2,000,000 micros (2 USD)
    expect(config.monthlyCostCeilingMicros).toBe(2_000_000);
  });

  it('respects AI_MONTHLY_COST_MICROUSD_CEILING when set', () => {
    process.env.AI_MODEL_EXTRACTION = 'claude-3-haiku-20240307';
    process.env.AI_MODEL_ENHANCE = 'claude-3-5-sonnet-20241022';
    process.env.AI_MONTHLY_COST_MICROUSD_CEILING = '5000000';

    const config = aiConfig();

    // 5,000,000 micros (5 USD)
    expect(config.monthlyCostCeilingMicros).toBe(5_000_000);
  });
});

describe('estimateCostMicros', () => {
  beforeEach(() => {
    delete process.env.PRICING_JSON;
  });

  it('returns 0 and warns when PRICING_JSON is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const cost = estimateCostMicros('claude-3-haiku-20240307', { input: 1000, output: 500 });

    expect(cost).toBe(0);
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toMatch(/PRICING_JSON/);

    warnSpy.mockRestore();
  });

  it('returns >0 when PRICING_JSON is set and model exists', () => {
    const pricing = {
      'claude-3-haiku-20240307': {
        input: 0.25, // USD per million tokens
        output: 1.25,
      },
    };
    process.env.PRICING_JSON = JSON.stringify(pricing);

    const cost = estimateCostMicros('claude-3-haiku-20240307', { input: 1_000_000, output: 1_000_000 });

    // 1M input * 0.25 USD/MTok = 0.25 USD = 250,000 micros
    // 1M output * 1.25 USD/MTok = 1.25 USD = 1,250,000 micros
    // Total = 1,500,000 micros
    expect(cost).toBe(1_500_000);
  });

  it('returns 0 when model not in pricing table', () => {
    const pricing = {
      'claude-3-haiku-20240307': {
        input: 0.25,
        output: 1.25,
      },
    };
    process.env.PRICING_JSON = JSON.stringify(pricing);

    const cost = estimateCostMicros('unknown-model', { input: 1000, output: 500 });

    expect(cost).toBe(0);
  });
});
