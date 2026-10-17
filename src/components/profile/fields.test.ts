import { describe, it, expect } from 'vitest';
import { TYPE_FIELDS, formToPayload, payloadToForm } from './fields';
import { ExperiencePayloadSchema, SkillPayloadSchema } from '@/lib/domain/schemas';
import { canonicalTextFor } from '@/lib/domain/canonical';

describe('formToPayload', () => {
  it('keeps an empty experience end as "" (current job) so the strict schema accepts it', () => {
    const defs = TYPE_FIELDS.experience;
    const payload = formToPayload(defs, {
      company: 'Acme',
      role: 'Dev',
      start: '2024',
      end: '', // the label literally says "leave empty if current"
      bullets: 'Shipped X',
    });

    const parsed = ExperiencePayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    expect(payload.end).toBe('');
    expect(payload.bullets).toEqual(['Shipped X']);
  });

  it('re-emitting an existing current-job payload keeps it valid (edit not bricked)', () => {
    const stored = { company: 'Acme', role: 'Dev', start: '2024', end: '', bullets: [] };
    const defs = TYPE_FIELDS.experience;
    const roundTripped = formToPayload(defs, payloadToForm(defs, stored));
    expect(ExperiencePayloadSchema.safeParse(roundTripped).success).toBe(true);
  });

  it('omits empty REQUIRED numbers instead of emitting NaN (which JSON-silently becomes null)', () => {
    const defs = TYPE_FIELDS.award;
    const payload = formToPayload(defs, { title: 'First', issuer: 'DevConf', year: '' });

    expect(Object.keys(payload)).not.toContain('year');
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload); // no NaN→null coercion
  });

  it('keeps empty optional text as "" — schema accepts, canonical text ignores it', () => {
    const defs = TYPE_FIELDS.skill;
    const payload = formToPayload(defs, { name: 'Go', level: '' });
    expect(SkillPayloadSchema.safeParse(payload).success).toBe(true);
    expect(payload.name).toBe('Go');
    expect(canonicalTextFor('skill', payload)).toBe('Go');
  });
});
