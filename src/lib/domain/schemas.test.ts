import { describe, it, expect } from 'vitest';
import { JdExtractionSchema, ResumeDocSchema, SkillPayloadSchema } from './schemas';

describe('backward compatibility of storage-boundary schemas', () => {
  it('parses legacy extractions written before the requirements field existed', () => {
    const legacy = {
      requiredSkills: ['Go'],
      preferredSkills: [],
      keywords: ['api'],
      seniority: 'mid',
      domain: 'backend',
      tools: [],
      responsibilities: [],
    };
    expect(JdExtractionSchema.parse(legacy).requirements).toBeUndefined();
  });

  const base = {
    requiredSkills: ['Go'],
    preferredSkills: [],
    keywords: [],
    seniority: 'mid',
    domain: 'backend',
    tools: [],
    responsibilities: [],
  };

  it('parses new extractions carrying requirements, and rejects invented keys', () => {
    const parsed = JdExtractionSchema.parse({
      ...base,
      requirements: [
        { description: 'Go', category: 'technical_skill', importance: 'mandatory', aliases: ['golang'], sourceExcerpt: null },
      ],
    });
    expect(parsed.requirements![0].id).toBeUndefined(); // ids assigned by finalizeRequirements
    expect(() => JdExtractionSchema.parse({ ...base, bogus: 1 })).toThrow();
  });

  it('ResumeDocSchema accepts the shape orchestrate writes (category optional)', () => {
    const doc = {
      header: { fullName: 'T', email: 't.com', phone: null, location: null, links: [] },
      summary: null,
      sections: [
        {
          id: 'skills',
          items: [
            { sourceItemId: 's1', text: 'Go', basis: 's1' },
            { sourceItemId: 's2', text: 'Rust', basis: 's2', category: 'Languages' },
          ],
        },
      ],
    };
    expect(ResumeDocSchema.parse(doc).sections[0].items[1].category).toBe('Languages');
  });

  it('ResumeDocSchema rejects structurally broken docs loudly', () => {
    expect(() =>
      ResumeDocSchema.parse({ header: {}, summary: null, sections: [] })
    ).toThrow();
    expect(() =>
      ResumeDocSchema.parse({
        header: { fullName: 'T', email: 't', phone: null, location: null, links: [] },
        summary: null,
        sections: [{ id: 'gossip', items: [] }],
      })
    ).toThrow();
  });

  it('skill payloads from before the category field still validate', () => {
    expect(SkillPayloadSchema.parse({ name: 'Go' }).category).toBeUndefined();
  });
});
