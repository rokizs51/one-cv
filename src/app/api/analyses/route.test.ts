import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeGenAI } from '@/lib/ai/fake';
import { createSupaStub } from '@/test-helpers/supa-stub';
import { normalizeAnalysis, computeProfileFingerprint, requirementsOf } from '@/lib/match/analyze';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ getSessionUser: vi.fn() }));
vi.mock('@/lib/db/client', () => ({ createRouteClient: vi.fn() }));
vi.mock('@/lib/ai/client', () => ({ createGenAI: vi.fn() }));
vi.mock('@/lib/ai/env', () => ({ aiConfig: vi.fn(), estimateCostMicros: vi.fn(() => 100) }));

import { POST, GET } from './route';
import { getSessionUser } from '@/lib/auth/session';
import { createRouteClient } from '@/lib/db/client';
import { createGenAI } from '@/lib/ai/client';
import { aiConfig } from '@/lib/ai/env';

const mockGetSessionUser = vi.mocked(getSessionUser);
const mockCreateRouteClient = vi.mocked(createRouteClient);
const mockCreateGenAI = vi.mocked(createGenAI);
const mockAiConfig = vi.mocked(aiConfig);

const JD_ID = '11111111-1111-4111-8111-111111111111';

const jdRow = {
  id: JD_ID,
  owner: 'user-1',
  raw: 'Build backend services in Go. Senior level. Fintech domain.',
  extraction: {
    requiredSkills: ['Go'],
    preferredSkills: ['gRPC'],
    keywords: ['fintech'],
    seniority: 'senior',
    domain: 'fintech',
    tools: [],
    responsibilities: [],
  },
  created_at: '2026-10-18T00:00:00Z',
};

const itemsRows = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    profile_id: 'p1',
    type: 'experience',
    payload: { role: 'Backend Dev', company: 'Acme', start: '2022', end: '', bullets: ['Wrote Go services'] },
    canonical_text: 'Backend Dev — Acme (2022–present)\nWrote Go services',
    source: 'manual',
    provenance: [],
    pinned: false,
    position: 0,
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    profile_id: 'p1',
    type: 'career_snapshot',
    payload: { text: 'Backend engineer' },
    canonical_text: 'Backend engineer',
    source: 'manual',
    provenance: [],
    pinned: false,
    position: 1,
  },
];

function stubBase(extra: Record<string, { data: unknown; error: unknown }> = {}) {
  return createSupaStub({
    from: {
      profiles: {
        data: { id: 'p1', user_id: 'user-1', personal: { fullName: 'T', email: 't@example.com', phone: null, location: null, links: [] } },
        error: null,
      },
      profile_items: { data: itemsRows, error: null },
      job_descriptions: { data: jdRow, error: null },
      generation_quota: { data: { generations: 0, llm_cost_micros: 0 }, error: null },
      match_analyses: { data: null, error: null },
      ...extra,
    },
    rpc: { month_llm_cost: { data: 0, error: null } },
  });
}

const config = {
  provider: 'anthropic' as const,
  extractionModel: 'claude-sonnet-test',
  enhanceModel: 'claude-sonnet-test',
  monthlyCostCeilingMicros: 1_000_000,
};

function req(body: unknown, url = 'http://x/api/analyses') {
  return new Request(url, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
}

describe('POST /api/analyses', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 without a session', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    const res = await POST(req({ jdId: JD_ID }));
    expect(res.status).toBe(401);
  });

  it('400 on a malformed jdId', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 'a@b.co' });
    const res = await POST(req({ jdId: 'not-a-uuid' }));
    expect(res.status).toBe(400);
  });

  it('404 when the JD is absent or not the user’s (RLS read as missing)', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 'a@b.co' });
    mockAiConfig.mockReturnValue(config);
    mockCreateRouteClient.mockResolvedValue(
      createSupaStub({
        from: {
          job_descriptions: { data: null, error: { code: 'PGRST116', message: 'no rows' } },
        },
      }) as never
    );
    const res = await POST(req({ jdId: JD_ID }));
    expect(res.status).toBe(404);
  });

  it('429 when the generation quota is spent before any LLM call', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 'a@b.co' });
    mockAiConfig.mockReturnValue(config);
    const ai = makeFakeGenAI();
    mockCreateGenAI.mockReturnValue(ai);
    mockCreateRouteClient.mockResolvedValue(
      stubBase({ generation_quota: { data: { generations: 50, llm_cost_micros: 0 }, error: null } }) as never
    );
    const res = await POST(req({ jdId: JD_ID }));
    expect(res.status).toBe(429);
    expect(ai.calls.analyzeMatch.length).toBe(0);
  });

  it('joins an in-flight analysis instead of double-running (duplicate protection)', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 'a@b.co' });
    mockAiConfig.mockReturnValue(config);
    const ai = makeFakeGenAI();
    mockCreateGenAI.mockReturnValue(ai);
    mockCreateRouteClient.mockResolvedValue(
      stubBase({
        match_analyses: {
          data: {
            id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            owner: 'user-1',
            jd_id: JD_ID,
            status: 'running',
            result: null,
            error: null,
            profile_fingerprint: 'x',
            created_at: '2026-10-18T00:00:00Z',
            updated_at: '2026-10-18T00:00:00Z',
          },
          error: null,
        },
      }) as never
    );
    const res = await POST(req({ jdId: JD_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.duplicate).toBe(true);
    expect(ai.calls.analyzeMatch.length).toBe(0);
  });

  it('201 with a completed, normalized analysis on success', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 'a@b.co' });
    mockAiConfig.mockReturnValue(config);
    const ai = makeFakeGenAI({
      analyzeMatch: async (r) => ({
        matches: r.requirements.map((reqDef) =>
          reqDef.description === 'Go'
            ? {
                requirementId: reqDef.id,
                status: 'supported' as const,
                confidence: 'high' as const,
                evidenceRefs: [{ itemId: itemsRows[0].id, sourceType: 'experience' as const }],
                explanation: 'Your current Acme role states Go services.',
              }
            : {
                requirementId: reqDef.id,
                status: 'not_established' as const,
                confidence: 'high' as const,
                evidenceRefs: [],
                explanation: 'No record mentions gRPC.',
              }
        ),
      }),
    });
    mockCreateGenAI.mockReturnValue(ai);
    const supa = stubBase();
    mockCreateRouteClient.mockResolvedValue(supa as never);

    const res = await POST(req({ jdId: JD_ID }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.analysis.status).toBe('completed');
    expect(body.analysis.result.summary.totals.supported).toBe(1);
    expect(body.analysis.result.matches.every((m: { evidenceRefs: { itemId: string }[] }) =>
      m.evidenceRefs.every((e) => itemsRows.some((i) => i.id === e.itemId))
    )).toBe(true);
    expect(ai.calls.analyzeMatch.length).toBe(1);
    // career_snapshot never reaches the model as evidence
    expect(ai.calls.analyzeMatch[0].items.every((i) => i.type !== 'career_snapshot')).toBe(true);
    // fingerprint stored = live profile fingerprint
    expect(body.analysis.profileFingerprint).toBe(
      computeProfileFingerprint(itemsRows.map((i) => ({ id: i.id, canonicalText: i.canonical_text })))
    );
  });

  it('502 and a failed row when the model output stays unusable — never completed', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 'a@b.co' });
    mockAiConfig.mockReturnValue(config);
    const ai = makeFakeGenAI({
      analyzeMatch: async () => {
        throw new Error('Match analysis output invalid after retry');
      },
    });
    mockCreateGenAI.mockReturnValue(ai);
    mockCreateRouteClient.mockResolvedValue(stubBase() as never);

    const res = await POST(req({ jdId: JD_ID }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.analysis.status).toBe('failed');
    expect(body.analysis.result).toBe(null);
    expect(body.analysis.error).toContain('unusable');
  });

  it('GET ?jdId lists the analysis history', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 'a@b.co' });
    mockCreateRouteClient.mockResolvedValue(
      createSupaStub({
        from: {
          job_descriptions: { data: jdRow, error: null },
          match_analyses: {
            data: [
              {
                id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
                jd_id: JD_ID,
                status: 'completed',
                profile_fingerprint: 'x',
                created_at: '2026-10-18T00:00:00Z',
                updated_at: '2026-10-18T00:00:00Z',
              },
            ],
            error: null,
          },
        },
      }) as never
    );
    const res = await GET(new Request(`http://x/api/analyses?jdId=${JD_ID}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.analyses[0].status).toBe('completed');
  });
});

describe('GET/PATCH /api/analyses/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  function completedRow() {
    const requirements = requirementsOf(jdRow.extraction as never);
    const result = normalizeAnalysis(
      {
        matches: [
          {
            requirementId: requirements[0].id,
            status: 'needs_review',
            confidence: 'low',
            evidenceRefs: [{ itemId: itemsRows[0].id, sourceType: 'experience' }],
            explanation: 'Ambiguous — confirm?',
            followUpQuestion: 'Did that role run Go in production?',
          },
        ],
      },
      requirements,
      itemsRows.map((i) => ({ itemId: i.id, type: i.type as never }))
    );
    return {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      owner: 'user-1',
      jd_id: JD_ID,
      status: 'completed',
      result,
      error: null,
      profile_fingerprint: computeProfileFingerprint(
        itemsRows.map((i) => ({ id: i.id, canonicalText: i.canonical_text }))
      ),
      created_at: '2026-10-18T00:00:00Z',
      updated_at: '2026-10-18T00:00:00Z',
    };
  }

  it('GET marks a stale analysis after a profile edit', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 'a@b.co' });
    mockCreateRouteClient.mockResolvedValue(stubBase({ match_analyses: { data: completedRow(), error: null } }) as never);
    const { GET: getOne } = await import('./[id]/route');
    const res = await getOne(new Request('http://x'), { params: Promise.resolve({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }) });
    const body = await res.json();
    expect(body.stale).toBe(false);

    // edit a profile item's text → fingerprint differs → stale
    mockCreateRouteClient.mockResolvedValue(
      createSupaStub({
        from: {
          profiles: { data: { id: 'p1', user_id: 'user-1', personal: { fullName: 'T', email: 't@example.com', phone: null, location: null, links: [] } }, error: null },
          profile_items: { data: [{ ...itemsRows[0], canonical_text: 'Backend Dev — Acme (2022–present)\nWrote GO services and Kafka' }, itemsRows[1]], error: null },
          match_analyses: { data: completedRow(), error: null },
        },
      }) as never
    );
    const res2 = await getOne(new Request('http://x'), { params: Promise.resolve({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }) });
    expect((await res2.json()).stale).toBe(true);
  });

  it('GET 404s a foreign analysis (RLS PGRST116 → null)', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 'a@b.co' });
    mockCreateRouteClient.mockResolvedValue(
      createSupaStub({ from: { match_analyses: { data: null, error: { code: 'PGRST116' } } } }) as never
    );
    const { GET: getOne } = await import('./[id]/route');
    const res = await getOne(new Request('http://x'), { params: Promise.resolve({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }) });
    expect(res.status).toBe(404);
  });

  it('PATCH confirmation records the user verdict and recounts the summary', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 'a@b.co' });
    const prior = completedRow();
    mockCreateRouteClient.mockResolvedValue(stubBase({ match_analyses: { data: prior, error: null } }) as never);
    const { PATCH } = await import('./[id]/route');
    const reqDef = prior.result.requirements[0];
    const res = await PATCH(
      new Request('http://x', {
        method: 'PATCH',
        body: JSON.stringify({ requirementId: reqDef.id, status: 'supported', note: 'Yes, production Go at Acme.' }),
      }),
      { params: Promise.resolve({ id: prior.id }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const confirmed = body.analysis.result.matches.find((m: { requirementId: string }) => m.requirementId === reqDef.id);
    expect(confirmed.userConfirmation.status).toBe('supported');
    expect(confirmed.userConfirmation.note).toBe('Yes, production Go at Acme.');
    // summary recomputed: the confirmed one now counts as supported; the
    // three requirements the model skipped stay needs_review (silence ≠ gap)
    expect(body.analysis.result.summary.totals.supported).toBe(1);
    expect(body.analysis.result.summary.totals.needs_review).toBe(3);
  });

  it('PATCH refuses to click a not_established verdict into existence', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 'a@b.co' });
    const requirements = requirementsOf(jdRow.extraction as never);
    const result = normalizeAnalysis(
      {
        matches: requirements.map((r) => ({
          requirementId: r.id,
          status: (r.description === 'Go' ? 'supported' : 'not_established') as 'supported' | 'not_established',
          confidence: 'high' as const,
          evidenceRefs: r.description === 'Go' ? [{ itemId: itemsRows[0].id, sourceType: 'experience' as const }] : [],
          explanation: 'ok',
        })),
      },
      requirements,
      itemsRows.map((i) => ({ itemId: i.id, type: i.type as never }))
    );
    const row = { ...completedRow(), result };
    mockCreateRouteClient.mockResolvedValue(stubBase({ match_analyses: { data: row, error: null } }) as never);
    const { PATCH } = await import('./[id]/route');
    const unestablished = result.requirements.find((r) => r.description !== 'Go')!;
    const res = await PATCH(
      new Request('http://x', { method: 'PATCH', body: JSON.stringify({ requirementId: unestablished.id, status: 'supported' }) }),
      { params: Promise.resolve({ id: row.id }) }
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('cannot_confirm');
  });
});
