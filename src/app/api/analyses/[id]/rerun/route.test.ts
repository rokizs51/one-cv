import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeFakeGenAI } from '@/lib/ai/fake';
import { createSupaStub } from '@/test-helpers/supa-stub';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ getSessionUser: vi.fn() }));
vi.mock('@/lib/db/client', () => ({ createRouteClient: vi.fn() }));
vi.mock('@/lib/ai/client', () => ({ createGenAI: vi.fn() }));
vi.mock('@/lib/ai/env', () => ({ aiConfig: vi.fn(), estimateCostMicros: vi.fn(() => 100) }));

import { POST } from './route';
import { getSessionUser } from '@/lib/auth/session';
import { createRouteClient } from '@/lib/db/client';
import { createGenAI } from '@/lib/ai/client';
import { aiConfig } from '@/lib/ai/env';

const mockGetSessionUser = vi.mocked(getSessionUser);
const mockCreateRouteClient = vi.mocked(createRouteClient);
const mockCreateGenAI = vi.mocked(createGenAI);
const mockAiConfig = vi.mocked(aiConfig);

const JD_ID = '11111111-1111-4111-8111-111111111111';
const A_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function analysisRow(status: 'running' | 'completed') {
  return {
    id: A_ID,
    owner: 'user-1',
    jd_id: JD_ID,
    status,
    result: status === 'completed' ? {
      requirements: [], matches: [],
      summary: {
        totals: { requirements: 0, supported: 0, partial: 0, needs_review: 0, not_established: 0, not_applicable: 0 },
        byImportance: { mandatory: {}, preferred: {} },
        strongest: [], gaps: [], questions: [], adjustments: [],
      },
    } : null,
    error: null,
    profile_fingerprint: 'fp',
    created_at: '2026-10-18T00:00:00Z',
    updated_at: '2026-10-18T00:00:00Z',
  };
}

const stub = (status: 'running' | 'completed') => createSupaStub({
  from: {
    profiles: { data: { id: 'p1', user_id: 'user-1', personal: { fullName: 'T', email: 't@example.com', phone: null, location: null, links: [] } }, error: null },
    profile_items: { data: [], error: null },
    job_descriptions: {
      data: { id: JD_ID, owner: 'user-1', raw: 'x', extraction: { requiredSkills: [], preferredSkills: [], keywords: [], seniority: 'mid', domain: 'd', tools: [], responsibilities: [] }, created_at: '2026-10-18T00:00:00Z' },
      error: null,
    },
    generation_quota: { data: { generations: 0, llm_cost_micros: 0 }, error: null },
    match_analyses: { data: analysisRow(status), error: null },
  },
  rpc: { month_llm_cost: { data: 0, error: null } },
});

const ctx = { params: Promise.resolve({ id: A_ID }) };
const req = () => new Request(`http://x/api/analyses/${A_ID}/rerun`, { method: 'POST' });

describe('POST /api/analyses/[id]/rerun', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 without session', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    expect((await POST(req(), ctx)).status).toBe(401);
  });

  it('409 when an analysis for the same JD is already running', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 'a@b.co' });
    mockAiConfig.mockReturnValue({ provider: 'anthropic', extractionModel: 'm', enhanceModel: 'm', monthlyCostCeilingMicros: 1e6 });
    mockCreateRouteClient.mockResolvedValue(stub('running') as never);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('already_running');
  });

  it('starts a NEW analysis row against the current profile (snapshot semantics)', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 'a@b.co' });
    mockAiConfig.mockReturnValue({ provider: 'anthropic', extractionModel: 'm', enhanceModel: 'm', monthlyCostCeilingMicros: 1e6 });
    const ai = makeFakeGenAI();
    mockCreateGenAI.mockReturnValue(ai);
    // prior row is 'completed' — the getRunningForJd read must ignore it
    const supa = stub('completed');
    mockCreateRouteClient.mockResolvedValue(supa as never);

    const res = await POST(req(), ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.analysis.status).toBe('completed');
    expect(ai.calls.analyzeMatch.length).toBe(1);
    // a fresh insert happened on match_analyses
    expect(supa.calls.from.some((c) => c.table === 'match_analyses' && c.method === 'insert')).toBe(true);
  });
});
