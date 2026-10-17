import { describe, it, expect } from 'vitest';
import { JSONParseError, TypeValidationError, NoObjectGeneratedError } from 'ai';
import { isSchemaParseError } from './client';

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
