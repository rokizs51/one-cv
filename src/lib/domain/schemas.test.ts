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

  it('ResumeDocSchema keeps typed entry fields and the certifications section', () => {
    const doc = {
      header: { fullName: 'T', email: 't.com', phone: null, location: null, links: [] },
      summary: null,
      sections: [
        {
          id: 'experience',
          items: [
            {
              sourceItemId: 'e1',
              text: 'Senior Engineer — Acme (Mar 2022–present)\nShipped X',
              basis: 'e1',
              header: { title: 'Senior Engineer', company: 'Acme', dates: 'Mar 2022–present' },
              bullets: ['Shipped X'],
              technologies: ['Go'],
            },
          ],
        },
        {
          id: 'certifications',
          items: [{ sourceItemId: 'c1', text: 'AWS SA — Amazon (2024)', basis: 'c1' }],
        },
      ],
    };
    const parsed = ResumeDocSchema.parse(doc);
    expect(parsed.sections[0].items[0].header?.title).toBe('Senior Engineer');
    expect(parsed.sections[0].items[0].bullets).toEqual(['Shipped X']);
    expect(parsed.sections[1].id).toBe('certifications');
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
