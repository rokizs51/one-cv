import { describe, it, expect } from 'vitest';
import { JSONParseError, TypeValidationError, NoObjectGeneratedError } from 'ai';
import { isSchemaParseError } from './client';

describe('isSchemaParseError', () => {
  it('returns true for JSONParseError', () => {
    const error = new JSONParseError({ text: 'invalid json', message: 'Parse failed' });
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
    const error = new NoObjectGeneratedError({ message: 'No object generated' });
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
