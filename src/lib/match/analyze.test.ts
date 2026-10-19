import { describe, it, expect } from 'vitest';
import { computeProfileFingerprint, normalizeAnalysis, requirementsOf } from './analyze';
import type { RequirementRecord } from './match-types';
import type { JdExtraction } from '@/lib/domain/types';

function req(over: Partial<RequirementRecord> & { id: string }): RequirementRecord {
  return {
    description: `desc ${over.id}`,
    category: 'technical_skill',
    importance: 'mandatory',
    aliases: [],
    sourceExcerpt: null,
    ...over,
  };
}

const items = [
  { itemId: 'e1', type: 'experience' as const },
  { itemId: 'p1', type: 'project' as const },
  { itemId: 's1', type: 'skill' as const },
];

describe('normalizeAnalysis — the no-invention enforcement', () => {
  it('① a requirement supported by explicit, existing evidence stays supported', () => {
    const requirements = [req({ id: 'req-technical_skill-0' })];
    const out = normalizeAnalysis(
      {
        matches: [
          {
            requirementId: 'req-technical_skill-0',
            status: 'supported',
            confidence: 'high',
            evidenceRefs: [{ itemId: 'e1', sourceType: 'experience' }],
            explanation: 'Role at Acme states this directly.',
          },
        ],
      },
      requirements,
      items
    );
    expect(out.matches[0].status).toBe('supported');
    expect(out.matches[0].evidenceRefs).toHaveLength(1);
  });

  it('② a personal project never establishes professional experience', () => {
    const requirements = [req({ id: 'req-experience-0', category: 'experience' })];
    const out = normalizeAnalysis(
      {
        matches: [
          {
            requirementId: 'req-experience-0',
            status: 'supported',
            confidence: 'medium',
            evidenceRefs: [{ itemId: 'p1', sourceType: 'project' }],
            explanation: 'A project shows similar work.',
          },
        ],
      },
      requirements,
      items
    );
    expect(out.matches[0].status).toBe('needs_review');
  });

  it('③ missing evidence is "not_established" — and never dressed as absence of skill', () => {
    const requirements = [req({ id: 'req-technical_skill-0' })];
    const out = normalizeAnalysis(
      {
        matches: [
          {
            requirementId: 'req-technical_skill-0',
            status: 'not_established',
            confidence: 'high',
            // refs the model wrongly attached are stripped
            evidenceRefs: [{ itemId: 's1', sourceType: 'skill' }],
            explanation: 'No profile record mentions Kafka.',
          },
        ],
      },
      requirements,
      items
    );
    expect(out.matches[0].status).toBe('not_established');
    expect(out.matches[0].evidenceRefs).toHaveLength(0);
  });

  it('③b a requirement the model skipped is needs_review, not a gap claim', () => {
    const requirements = [req({ id: 'req-a' }), req({ id: 'req-b' })];
    const out = normalizeAnalysis(
      {
        matches: [
          {
            requirementId: 'req-a',
            status: 'supported',
            confidence: 'high',
            evidenceRefs: [{ itemId: 'e1', sourceType: 'experience' }],
            explanation: 'Covered.',
          },
        ],
      },
      requirements,
      items
    );
    const skipped = out.matches.find((m) => m.requirementId === 'req-b')!;
    expect(skipped.status).toBe('needs_review');
    expect(out.summary.totals.needs_review).toBe(1);
  });

  it('④ thin evidence stays partial — the pipeline never promotes on its own', () => {
    const requirements = [req({ id: 'req-technical_skill-0' })];
    const out = normalizeAnalysis(
      {
        matches: [
          {
            requirementId: 'req-technical_skill-0',
            status: 'partial',
            confidence: 'low',
            evidenceRefs: [{ itemId: 's1', sourceType: 'skill' }],
            explanation: 'A skill entry names it but nothing demonstrates depth.',
          },
        ],
      },
      requirements,
      items
    );
    expect(out.matches[0].status).toBe('partial');
  });

  it('refs to items that do not exist are dropped; supported on a hallucinated ref demotes', () => {
    const requirements = [req({ id: 'req-x' })];
    const out = normalizeAnalysis(
      {
        matches: [
          {
            requirementId: 'req-x',
            status: 'supported',
            confidence: 'high',
            evidenceRefs: [
              { itemId: 'ghost', sourceType: 'experience' },
              { itemId: 'e1', sourceType: 'experience' },
            ],
            explanation: 'Real and fake evidence cited.',
          },
        ],
      },
      requirements,
      items
    );
    expect(out.matches[0].evidenceRefs.map((r) => r.itemId)).toEqual(['e1']);
    expect(out.matches[0].status).toBe('supported');
  });

  it('duplicate matches for one requirement: first is kept, second ignored', () => {
    const requirements = [req({ id: 'req-dup' })];
    const out = normalizeAnalysis(
      {
        matches: [
          {
            requirementId: 'req-dup',
            status: 'partial',
            confidence: 'low',
            evidenceRefs: [],
            explanation: 'first',
          },
          {
            requirementId: 'req-dup',
            status: 'supported',
            confidence: 'high',
            evidenceRefs: [{ itemId: 'e1', sourceType: 'experience' }],
            explanation: 'second tries to override',
          },
        ],
      },
      requirements,
      items
    );
    expect(out.matches).toHaveLength(1);
    expect(out.matches[0].status).toBe('partial');
  });

  it('summary counts are recomputed from final statuses and split by importance', () => {
    const requirements = [
      req({ id: 'a', importance: 'mandatory' }),
      req({ id: 'b', importance: 'preferred' }),
    ];
    const out = normalizeAnalysis(
      {
        matches: [
          {
            requirementId: 'a',
            status: 'supported',
            confidence: 'high',
            evidenceRefs: [{ itemId: 'e1', sourceType: 'experience' }],
            explanation: 'ok',
          },
          {
            requirementId: 'b',
            status: 'partial',
            confidence: 'medium',
            evidenceRefs: [{ itemId: 's1', sourceType: 'skill' }],
            explanation: 'meh',
          },
        ],
      },
      requirements,
      items
    );
    expect(out.summary.totals).toEqual({
      requirements: 2,
      supported: 1,
      partial: 1,
      needs_review: 0,
      not_established: 0,
      not_applicable: 0,
    });
    expect(out.summary.byImportance.mandatory.supported).toBe(1);
    expect(out.summary.strongest).toEqual(['desc a']);
    expect(out.summary.gaps).toEqual([]); // preferred partial is not a "gap"
  });
});

describe('requirementsOf', () => {
  const legacy: JdExtraction = {
    requiredSkills: ['Go'],
    preferredSkills: ['Elixir'],
    keywords: ['fintech'],
    seniority: 'senior',
    domain: 'backend',
    tools: ['Kubernetes'],
    responsibilities: ['Own services'],
  };

  it('derives traceable records for legacy extractions, weighting mandatory vs preferred', () => {
    const reqs = requirementsOf(legacy);
    expect(reqs.find((r) => r.description === 'Go')!.importance).toBe('mandatory');
    expect(reqs.find((r) => r.description === 'Elixir')!.importance).toBe('preferred');
    expect(reqs.find((r) => r.description === 'senior')!.category).toBe('seniority');
    expect(reqs.every((r) => r.id && r.sourceExcerpt === null)).toBe(true);
  });

  it('passes finalized requirements through, ids intact', () => {
    const withReqs: JdExtraction = {
      ...legacy,
      requirements: [
        { id: 'req-technical_skill-0', description: 'Go', category: 'technical_skill', importance: 'mandatory', aliases: [], sourceExcerpt: 'Go experience' },
      ],
    };
    const reqs = requirementsOf(withReqs);
    expect(reqs[0].id).toBe('req-technical_skill-0');
    expect(reqs[0].sourceExcerpt).toBe('Go experience');
  });
});

describe('computeProfileFingerprint', () => {
  it('is order-insensitive but text-sensitive', () => {
    const a = computeProfileFingerprint([
      { id: '1', canonicalText: 'Go' },
      { id: '2', canonicalText: 'Rust' },
    ]);
    const b = computeProfileFingerprint([
      { id: '2', canonicalText: 'Rust' },
      { id: '1', canonicalText: 'Go' },
    ]);
    const c = computeProfileFingerprint([
      { id: '1', canonicalText: 'Go (expert)' },
      { id: '2', canonicalText: 'Rust' },
    ]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('item removal changes it', () => {
    const two = computeProfileFingerprint([
      { id: '1', canonicalText: 'Go' },
      { id: '2', canonicalText: 'Rust' },
    ]);
    const one = computeProfileFingerprint([{ id: '1', canonicalText: 'Go' }]);
    expect(two).not.toBe(one);
  });
});

import { enrichmentFromAnalysis } from './analyze';

describe('enrichmentFromAnalysis', () => {
  it('folds technical-skill requirement terms and aliases into the keyword pool', () => {
    const extraction = {
      requiredSkills: [], preferredSkills: [], keywords: ['fintech'],
      seniority: 'mid', domain: 'd', tools: [], responsibilities: [],
    };
    const enriched = enrichmentFromAnalysis(extraction, {
      requirements: [
        { id: 'a', description: 'PostgreSQL', category: 'technical_skill', importance: 'mandatory', aliases: ['postgres', 'Postgres SQL'], sourceExcerpt: null },
        { id: 'b', description: 'Own services end-to-end', category: 'responsibility', importance: 'mandatory', aliases: [], sourceExcerpt: null },
      ],
    });
    expect(enriched.keywords).toEqual(['fintech', 'PostgreSQL', 'postgres', 'Postgres SQL']);
    expect(enriched.requiredSkills).toEqual([]); // extraction itself untouched besides keywords
  });

  it('is identity when there are no technical requirements', () => {
    const extraction = {
      requiredSkills: ['Go'], preferredSkills: [], keywords: [],
      seniority: 'mid', domain: 'd', tools: [], responsibilities: [],
    };
    expect(enrichmentFromAnalysis(extraction, { requirements: [] })).toBe(extraction);
  });
});
