import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateResume, QuotaExceededError, GenerationUnavailableError } from './orchestrate';
import type { OrchestrateDeps, GenerateInput } from './orchestrate';
import { makeFakeGenAI } from '@/lib/ai/fake';
import { createSupaStub } from '@/test-helpers/supa-stub';
import type { ProfileItem, JdExtraction } from '@/lib/domain/types';
import type { PersonalInfo } from '@/lib/db/profiles';

function makeItem(overrides: Partial<ProfileItem> & { id: string; type: ProfileItem['type'] }): ProfileItem {
  return {
    profileId: 'profile-1',
    payload: {},
    canonicalText: '',
    source: 'manual',
    provenance: [],
    pinned: false,
    position: 0,
    ...overrides,
  };
}

function makeDeps(overrides?: Partial<OrchestrateDeps>): OrchestrateDeps {
  return {
    supa: createSupaStub(),
    ai: makeFakeGenAI(),
    now: new Date('2026-10-15'),
    user: { id: 'user-1', email: 'test@example.com' },
    enhanceModel: 'claude-sonnet-test',
    monthlyCostCeilingMicros: 1000000,
    ...overrides,
  };
}

const defaultExtraction: JdExtraction = {
  requiredSkills: ['TypeScript', 'React'],
  preferredSkills: ['Next.js'],
  keywords: ['frontend'],
  seniority: 'mid',
  domain: 'software',
  tools: ['VS Code'],
  responsibilities: ['Build UI'],
};

function configureSupaForGeneration(
  profileId: string,
  items: ProfileItem[],
  jdExtraction: JdExtraction,
  generations: number = 0
) {
  return createSupaStub({
    from: {
      profiles: {
        data: {
          id: profileId,
          user_id: 'user-1',
          personal: {
            fullName: 'Test User',
            email: 'test@example.com',
            phone: null,
            location: null,
            links: [],
          } as PersonalInfo,
        },
        error: null,
      },
      profile_items: {
        data: items.map((item) => ({
          id: item.id,
          profile_id: item.profileId,
          type: item.type,
          payload: item.payload,
          canonical_text: item.canonicalText,
          source: item.source,
          provenance: item.provenance,
          pinned: item.pinned,
          position: item.position,
        })),
        error: null,
      },
      job_descriptions: {
        data: {
          id: 'jd-1',
          owner: 'user-1',
          raw: 'Job description text',
          extraction: jdExtraction,
          created_at: '2026-10-15T00:00:00Z',
        },
        error: null,
      },
      generation_quota: {
        data: { generations, llm_cost_micros: 0 },
        error: null,
      },
      generated_resumes: {
        data: {
          id: 'resume-1',
          owner: 'user-1',
          jd_id: 'jd-1',
          mode: 'as_is',
          page_limit: 1,
          doc: {},
          suggestions: [],
          statuses: [],
          user_edits: {},
          fit: { chosen: [], cuts: [], overflow: false },
          created_at: '2026-10-15T00:00:00Z',
          updated_at: '2026-10-15T00:00:00Z',
        },
        error: null,
      },
    },
  });
}

describe('orchestrate.ts', () => {
  describe('as-is mode', () => {
    it('makes ZERO LLM calls and doc contains canonicalText verbatim', async () => {
      const ai = makeFakeGenAI();
      const items = [
        makeItem({
          id: 'item-1',
          type: 'experience',
          canonicalText: 'Built React apps with TypeScript',
        }),
      ];
      
      const supa = configureSupaForGeneration('profile-1', items, defaultExtraction);
      const deps = makeDeps({ supa, ai });
      const input: GenerateInput = {
        jdId: 'jd-1',
        mode: 'as_is',
        pageLimit: 1,
      };

      const result = await generateResume(deps, input);

      // Zero LLM calls
      expect(ai.calls.extractJd.length).toBe(0);
      expect(ai.calls.enhance.length).toBe(0);
      expect(ai.calls.composeSummary.length).toBe(0);

      // Doc contains canonicalText verbatim
      const expSection = result.doc.sections.find((s) => s.id === 'experience');
      expect(expSection).toBeDefined();
      expect(expSection!.items[0].text).toBe('Built React apps with TypeScript');
    });

    it('uses career_snapshot verbatim as summary when present', async () => {
      const ai = makeFakeGenAI();
      const items = [
        makeItem({
          id: 'snapshot-1',
          type: 'career_snapshot',
          canonicalText: 'Experienced frontend developer',
          payload: { text: 'Experienced frontend developer' },
        }),
      ];
      
      const supa = configureSupaForGeneration('profile-1', items, defaultExtraction);
      const deps = makeDeps({ supa, ai });
      const input: GenerateInput = {
        jdId: 'jd-1',
        mode: 'as_is',
        pageLimit: 1,
      };

      const result = await generateResume(deps, input);

      expect(result.doc.summary).toBe('Experienced frontend developer');
      expect(ai.calls.composeSummary.length).toBe(0);
    });

    it('pinned career_snapshot appears ONLY as summary, never as a section item', async () => {
      // The dual-appearance bug: a *pinned* snapshot would be force-kept by the
      // fit engine and surface in sections under the 'summary' id. The scored
      // pipeline now excludes career_snapshot entirely, so it appears once.
      const items = [
        makeItem({
          id: 'snapshot-1',
          type: 'career_snapshot',
          canonicalText: 'Backend engineer, 3 yrs fintech',
          payload: { text: 'Backend engineer, 3 yrs fintech' },
          pinned: true,
        }),
        makeItem({
          id: 'item-1',
          type: 'experience',
          canonicalText: 'Built React apps with TypeScript',
        }),
      ];

      const supa = configureSupaForGeneration('profile-1', items, defaultExtraction);
      const deps = makeDeps({ supa });
      const result = await generateResume(deps, {
        jdId: 'jd-1',
        mode: 'as_is',
        pageLimit: 1,
      });

      // Expressed exactly once, as the top-level summary.
      expect(result.doc.summary).toBe('Backend engineer, 3 yrs fintech');
      // Never as a section.
      const summarySection = result.doc.sections.find((s) => s.id === 'summary');
      expect(summarySection).toBeUndefined();
      const allSectionItemIds = result.doc.sections.flatMap((s) => s.items.map((i) => i.sourceItemId));
      expect(allSectionItemIds).not.toContain('snapshot-1');
    });

    it('omits summary section when career_snapshot missing', async () => {
      const items = [
        makeItem({
          id: 'item-1',
          type: 'experience',
          canonicalText: 'Built React apps',
        }),
      ];
      
      const supa = configureSupaForGeneration('profile-1', items, defaultExtraction);
      const deps = makeDeps({ supa });
      const input: GenerateInput = {
        jdId: 'jd-1',
        mode: 'as_is',
        pageLimit: 1,
      };

      const result = await generateResume(deps, input);

      expect(result.doc.summary).toBeNull();
    });

    it('omits awards section when no awards present', async () => {
      const items = [
        makeItem({
          id: 'item-1',
          type: 'experience',
          canonicalText: 'Built React apps',
        }),
      ];
      
      const supa = configureSupaForGeneration('profile-1', items, defaultExtraction);
      const deps = makeDeps({ supa });
      const input: GenerateInput = {
        jdId: 'jd-1',
        mode: 'as_is',
        pageLimit: 1,
      };

      const result = await generateResume(deps, input);

      const awardsSection = result.doc.sections.find((s) => s.id === 'awards');
      expect(awardsSection).toBeUndefined();
    });
  });

  describe('enhance mode', () => {
    it('calls ai.enhance and ai.composeSummary', async () => {
      const ai = makeFakeGenAI({
        enhance: async () => [
          {
            id: 'sug-1',
            targetItemId: 'item-1',
            kind: 'bullet',
            newText: 'Enhanced bullet text',
            basis: 'item-1',
          },
        ],
        composeSummary: async () => 'Enhanced summary',
      });
      
      const items = [
        makeItem({
          id: 'item-1',
          type: 'experience',
          canonicalText: 'Built React apps',
        }),
        makeItem({
          id: 'snapshot-1',
          type: 'career_snapshot',
          canonicalText: 'Original snapshot',
          payload: { text: 'Original snapshot' },
        }),
      ];
      
      const supa = configureSupaForGeneration('profile-1', items, defaultExtraction);
      const deps = makeDeps({ supa, ai });
      const input: GenerateInput = {
        jdId: 'jd-1',
        mode: 'enhance',
        pageLimit: 1,
      };

      const result = await generateResume(deps, input);

      expect(ai.calls.enhance.length).toBe(1);
      expect(ai.calls.composeSummary.length).toBe(1);
    });

    it('stores suggestions with status pending', async () => {
      const ai = makeFakeGenAI({
        enhance: async () => [
          {
            id: 'sug-1',
            targetItemId: 'item-1',
            kind: 'bullet',
            newText: 'Enhanced bullet',
            basis: 'item-1',
          },
        ],
      });
      
      const items = [
        makeItem({
          id: 'item-1',
          type: 'experience',
          canonicalText: 'Built React apps',
        }),
      ];
      
      const supa = configureSupaForGeneration('profile-1', items, defaultExtraction);
      const deps = makeDeps({ supa, ai });
      const input: GenerateInput = {
        jdId: 'jd-1',
        mode: 'enhance',
        pageLimit: 1,
      };

      const result = await generateResume(deps, input);

      expect(result.statuses.length).toBeGreaterThan(0);
      expect(result.statuses[0].status).toBe('pending');
    });

    it('doc contains original bullets only, not suggestions', async () => {
      const ai = makeFakeGenAI({
        enhance: async () => [
          {
            id: 'sug-1',
            targetItemId: 'item-1',
            kind: 'bullet',
            newText: 'Enhanced bullet text',
            basis: 'item-1',
          },
        ],
      });
      
      const items = [
        makeItem({
          id: 'item-1',
          type: 'experience',
          canonicalText: 'Original bullet text with TypeScript React',
        }),
      ];
      
      const supa = configureSupaForGeneration('profile-1', items, defaultExtraction);
      const deps = makeDeps({ supa, ai });
      const input: GenerateInput = {
        jdId: 'jd-1',
        mode: 'enhance',
        pageLimit: 1,
      };

      const result = await generateResume(deps, input);

      const expSection = result.doc.sections.find((s) => s.id === 'experience');
      expect(expSection).toBeDefined();
      expect(expSection!.items[0].text).toBe('Original bullet text with TypeScript React');
      expect(expSection!.items[0].text).not.toBe('Enhanced bullet text');
    });
  });

  describe('quota boundary', () => {
    it('allows 50th generation (at cap)', async () => {
      const items = [
        makeItem({
          id: 'item-1',
          type: 'experience',
          canonicalText: 'Built React apps',
        }),
      ];
      
      // 49 generations already used, so this is the 50th
      const supa = configureSupaForGeneration('profile-1', items, defaultExtraction, 49);
      const deps = makeDeps({ supa });
      const input: GenerateInput = {
        jdId: 'jd-1',
        mode: 'as_is',
        pageLimit: 1,
      };

      const result = await generateResume(deps, input);
      expect(result).toBeDefined();
    });

    it('throws QuotaExceededError on 51st generation BEFORE LLM call', async () => {
      const ai = makeFakeGenAI();
      const items = [
        makeItem({
          id: 'item-1',
          type: 'experience',
          canonicalText: 'Built React apps',
        }),
      ];
      
      // 50 generations already used, so this would be the 51st
      const supa = configureSupaForGeneration('profile-1', items, defaultExtraction, 50);
      const deps = makeDeps({ supa, ai });
      const input: GenerateInput = {
        jdId: 'jd-1',
        mode: 'enhance',
        pageLimit: 1,
      };

      await expect(generateResume(deps, input)).rejects.toThrow(QuotaExceededError);
      
      // Fake AI calls should be empty (quota check happens before LLM)
      expect(ai.calls.extractJd.length).toBe(0);
      expect(ai.calls.enhance.length).toBe(0);
      expect(ai.calls.composeSummary.length).toBe(0);
    });
  });

  describe('budget guard', () => {
    it('throws GenerationUnavailableError when budget exhausted in enhance mode', async () => {
      const ai = makeFakeGenAI();
      const items = [
        makeItem({
          id: 'item-1',
          type: 'experience',
          canonicalText: 'Built React apps',
        }),
      ];
      
      const supa = configureSupaForGeneration('profile-1', items, defaultExtraction);
      // Override rpc to simulate budget exceeded
      const budgetSupa = createSupaStub({
        from: {
          profiles: {
            data: {
              id: 'profile-1',
              user_id: 'user-1',
              personal: {
                fullName: 'Test User',
                email: 'test@example.com',
                phone: null,
                location: null,
                links: [],
              },
            },
            error: null,
          },
          profile_items: {
            data: items.map((item) => ({
              id: item.id,
              profile_id: item.profileId,
              type: item.type,
              payload: item.payload,
              canonical_text: item.canonicalText,
              source: item.source,
              provenance: item.provenance,
              pinned: item.pinned,
              position: item.position,
            })),
            error: null,
          },
          job_descriptions: {
            data: {
              id: 'jd-1',
              owner: 'user-1',
              raw: 'Job description',
              extraction: defaultExtraction,
              created_at: '2026-10-15T00:00:00Z',
            },
            error: null,
          },
          generation_quota: {
            data: { generations: 0, llm_cost_micros: 0 },
            error: null,
          },
        },
        rpc: {
          month_llm_cost: {
            data: 100000000, // 100M micros = $100, way over typical ceiling
            error: null,
          },
        },
      });
      
      const deps = makeDeps({ supa: budgetSupa, ai });
      const input: GenerateInput = {
        jdId: 'jd-1',
        mode: 'enhance',
        pageLimit: 1,
      };

      await expect(generateResume(deps, input)).rejects.toThrow(GenerationUnavailableError);
    });

    it('allows as-is mode even when budget exhausted', async () => {
      const items = [
        makeItem({
          id: 'item-1',
          type: 'experience',
          canonicalText: 'Built React apps',
        }),
      ];
      
      const budgetSupa = createSupaStub({
        from: {
          profiles: {
            data: {
              id: 'profile-1',
              user_id: 'user-1',
              personal: {
                fullName: 'Test User',
                email: 'test@example.com',
                phone: null,
                location: null,
                links: [],
              },
            },
            error: null,
          },
          profile_items: {
            data: items.map((item) => ({
              id: item.id,
              profile_id: item.profileId,
              type: item.type,
              payload: item.payload,
              canonical_text: item.canonicalText,
              source: item.source,
              provenance: item.provenance,
              pinned: item.pinned,
              position: item.position,
            })),
            error: null,
          },
          job_descriptions: {
            data: {
              id: 'jd-1',
              owner: 'user-1',
              raw: 'Job description',
              extraction: defaultExtraction,
              created_at: '2026-10-15T00:00:00Z',
            },
            error: null,
          },
          generation_quota: {
            data: { generations: 0, llm_cost_micros: 0 },
            error: null,
          },
          generated_resumes: {
            data: {
              id: 'resume-1',
              owner: 'user-1',
              jd_id: 'jd-1',
              mode: 'as_is',
              page_limit: 1,
              doc: {},
              suggestions: [],
              statuses: [],
              user_edits: {},
              fit: { chosen: [], cuts: [], overflow: false },
              created_at: '2026-10-15T00:00:00Z',
              updated_at: '2026-10-15T00:00:00Z',
            },
            error: null,
          },
        },
        rpc: {
          month_llm_cost: {
            data: 100000000,
            error: null,
          },
        },
      });
      
      const deps = makeDeps({ supa: budgetSupa });
      const input: GenerateInput = {
        jdId: 'jd-1',
        mode: 'as_is',
        pageLimit: 1,
      };

      const result = await generateResume(deps, input);
      expect(result).toBeDefined();
    });
  });

  describe('error cases', () => {
    it('throws when jdId not found', async () => {
      const supa = createSupaStub({
        from: {
          profiles: {
            data: {
              id: 'profile-1',
              user_id: 'user-1',
              personal: {
                fullName: 'Test User',
                email: 'test@example.com',
                phone: null,
                location: null,
                links: [],
              },
            },
            error: null,
          },
          profile_items: { data: [], error: null },
          job_descriptions: { data: null, error: { code: 'PGRST116' } },
        },
      });
      
      const deps = makeDeps({ supa });
      const input: GenerateInput = {
        jdId: 'nonexistent-jd',
        mode: 'as_is',
        pageLimit: 1,
      };

      await expect(generateResume(deps, input)).rejects.toThrow('not_found');
    });
  });

  describe('cost recording', () => {
    const savedPricing = process.env.PRICING_JSON;
    afterEach(() => {
      if (savedPricing === undefined) delete process.env.PRICING_JSON;
      else process.env.PRICING_JSON = savedPricing;
    });

    it('as-is records zero cost (no LLM ran)', async () => {
      const items = [
        makeItem({ id: 'item-1', type: 'experience', canonicalText: 'Built React apps with TypeScript' }),
      ];
      const supa = configureSupaForGeneration('profile-1', items, defaultExtraction);
      const deps = makeDeps({ supa });
      await generateResume(deps, { jdId: 'jd-1', mode: 'as_is', pageLimit: 1 });

      const upd = supa.calls.from.find(
        (c) => c.table === 'generation_quota' && c.method === 'update'
      );
      expect(upd?.args.llm_cost_micros).toBe(0);
    });

    it('enhance records cost estimated from deps.enhanceModel, not a hardcoded literal', async () => {
      // Pricing keyed by the injected model. If the code still used the old
      // hardcoded 'claude-3-5-sonnet-20241022', the lookup would miss → 0.
      process.env.PRICING_JSON = JSON.stringify({
        'claude-sonnet-test': { input: 3, output: 15 },
      });
      const items = [
        makeItem({ id: 'item-1', type: 'experience', canonicalText: 'Built React apps with TypeScript' }),
      ];
      const supa = configureSupaForGeneration('profile-1', items, defaultExtraction);
      const deps = makeDeps({ supa });
      await generateResume(deps, { jdId: 'jd-1', mode: 'enhance', pageLimit: 1 });

      const upd = supa.calls.from.find(
        (c) => c.table === 'generation_quota' && c.method === 'update'
      );
      // ESTIMATE_INPUT_TOKENS(1000)*3 + ESTIMATE_OUTPUT_TOKENS(500)*15 = 10500
      expect(upd?.args.llm_cost_micros).toBe(10500);
    });
  });
});
