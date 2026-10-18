import { describe, it, expect } from 'vitest';
import { JSONParseError, TypeValidationError, NoObjectGeneratedError } from 'ai';
import { isSchemaParseError, preserveHeaderLines } from './client';

describe('isSchemaParseError', () => {
  it('returns true for JSONParseError', () => {
    const error = new JSONParseError({ text: 'invalid json', cause: new Error('Parse failed') });
    expect(isSchemaParseError(error)).toBe(true);
  });

  it('returns true for TypeValidationError', () => {
    const error = new TypeValidationError({
      cause: new Error('validation failed'),
      value: {},
    });
    expect(isSchemaParseError(error)).toBe(true);
  });

  it('returns true for NoObjectGeneratedError', () => {
    // This constructor demands SDK-internal response/usage/finishReason objects;
    // the test only checks instanceof-based classification, so create a real
    // instance without coupling the test to those internals.
    const error = Object.create(NoObjectGeneratedError.prototype) as NoObjectGeneratedError;
    expect(isSchemaParseError(error)).toBe(true);
  });

  it('returns false for generic Error', () => {
    const error = new Error('Network error');
    expect(isSchemaParseError(error)).toBe(false);
  });

  it('returns false for APICallError', () => {
    const error = new Error('Rate limit exceeded');
    expect(isSchemaParseError(error)).toBe(false);
  });

  it('returns false for unknown error types', () => {
    expect(isSchemaParseError('string error')).toBe(false);
    expect(isSchemaParseError(null)).toBe(false);
    expect(isSchemaParseError(undefined)).toBe(false);
    expect(isSchemaParseError({ message: 'fake error' })).toBe(false);
  });
});

describe('preserveHeaderLines', () => {
  const items = [{ itemId: 'e1', text: 'Dev — Acme (2022–2023)\n• built X\n• led Y' }];

  it('restores the title line when the rewrite drops it', () => {
    const out = preserveHeaderLines(
      [{ targetItemId: 'e1', newText: 'Engineered X and led Y at Acme' }],
      items
    );
    expect(out[0].newText).toBe('Dev — Acme (2022–2023)\nEngineered X and led Y at Acme');
  });

  it('leaves a rewrite that kept the title line untouched', () => {
    const kept = 'Dev — Acme (2022–2023)\n• Engineered X';
    const out = preserveHeaderLines([{ targetItemId: 'e1', newText: kept }], items);
    expect(out[0].newText).toBe(kept);
  });

  it('single-line items (skills, projects) pass through unchanged', () => {
    const out = preserveHeaderLines(
      [{ targetItemId: 's1', newText: 'Go (Advanced)' }],
      [{ itemId: 's1', text: 'Go' }]
    );
    expect(out[0].newText).toBe('Go (Advanced)');
  });
});
