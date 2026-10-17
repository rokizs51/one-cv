import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupaStub } from '@/test-helpers/supa-stub';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

// The GET handler calls connection() to force request-time rendering; it throws
// outside a Next request scope, so stub it here while keeping real NextResponse.
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, connection: vi.fn(async () => {}) };
});

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  createRouteClient: vi.fn(),
}));

import { GET, PATCH } from './route';
import { getSessionUser } from '@/lib/auth/session';
import { createRouteClient } from '@/lib/db/client';

const mockGetSessionUser = vi.mocked(getSessionUser);
const mockCreateRouteClient = vi.mocked(createRouteClient);

const RESUME_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';

function makeContext(id: string) {
  // Next 16: params is a Promise resolved by the router.
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/resumes/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const request = () => new Request('http://localhost:3000/api/resumes/resume-1');

  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const response = await GET(request(), makeContext(RESUME_ID));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('unauthorized');
  });

  it('returns 200 with the resume when found', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });

    const supa = createSupaStub({
      from: {
        generated_resumes: {
          data: {
            id: RESUME_ID,
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
    mockCreateRouteClient.mockResolvedValue(supa as any);

    const response = await GET(request(), makeContext(RESUME_ID));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.resume.id).toBe(RESUME_ID);
  });

  it('returns 400 invalid_request for a malformed (non-uuid) id', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });

    const response = await GET(request(), makeContext('totally-not-a-uuid'));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('invalid_request');
  });

  it('returns 404 not_found for an unknown id', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });

    // No generated_resumes configured → getResume returns null.
    const supa = createSupaStub();
    mockCreateRouteClient.mockResolvedValue(supa as any);

    const response = await GET(request(), makeContext(OTHER_ID));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('not_found');
  });
});

describe('PATCH /api/resumes/:id — suggestion disposition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });
  });

  const bullet = { id: 'sug-1', targetItemId: 'i1', kind: 'bullet' as const, newText: 'Sharper line', basis: 'i1' };
  function resumeStub() {
    return createSupaStub({
      from: {
        generated_resumes: {
          data: {
            id: RESUME_ID, owner: 'user-1', jd_id: 'jd-1', mode: 'enhance', page_limit: 1,
            doc: { header: { fullName: 'T', email: 't@e.com', phone: null, location: null, links: [] }, summary: null,
              sections: [{ id: 'experience', items: [{ sourceItemId: 'i1', text: 'Original line', basis: 'i1' }] }] },
            suggestions: [bullet],
            statuses: [{ suggestion: bullet, status: 'pending', finalText: null }],
            user_edits: {}, fit: { chosen: ['i1'], cuts: [], overflow: false },
            created_at: '2026-10-15T00:00:00Z', updated_at: '2026-10-15T00:00:00Z',
          },
          error: null,
        },
        profile_items: {
          data: { id: 'i1', profile_id: 'p1', type: 'experience', payload: {}, canonical_text: 'Original line', source: 'manual', provenance: [], pinned: false, position: 0 },
          error: null,
        },
      },
    });
  }

  const patchReq = (body: unknown) =>
    new Request('http://localhost/api/resumes/' + RESUME_ID, { method: 'PATCH', body: JSON.stringify(body) });

  it('accept writes the new text into the doc and compounds it into the profile with provenance', async () => {
    const supa = resumeStub();
    mockCreateRouteClient.mockResolvedValue(supa as never);

    const res = await PATCH(patchReq({ suggestionId: 'sug-1', status: 'accepted' }), makeContext(RESUME_ID));
    expect(res.status).toBe(200);

    // doc update + profile compounding both recorded
    const updates = supa.calls.from.filter((c) => c.method === 'update');
    const resumeUpdate = updates.find((c) => c.table === 'generated_resumes');
    expect(JSON.stringify(resumeUpdate?.args)).toContain('Sharper line');
    const profileUpdate = updates.find((c) => c.table === 'profile_items');
    expect(profileUpdate).toBeDefined();
    expect(JSON.stringify(profileUpdate?.args)).toContain('Original line'); // original preserved under provenance
  });

  it('reject keeps the original doc text and does not touch the profile', async () => {
    const supa = resumeStub();
    mockCreateRouteClient.mockResolvedValue(supa as never);

    const res = await PATCH(patchReq({ suggestionId: 'sug-1', status: 'rejected' }), makeContext(RESUME_ID));
    expect(res.status).toBe(200);
    expect(supa.calls.from.filter((c) => c.method === 'update' && c.table === 'profile_items')).toHaveLength(0);
  });

  it('second disposition on the same suggestion returns 409 already_dispositioned', async () => {
    const supa = createSupaStub({
      from: {
        generated_resumes: {
          data: {
            id: RESUME_ID, owner: 'user-1', jd_id: 'jd-1', mode: 'enhance', page_limit: 1,
            doc: { header: { fullName: 'T', email: 't@e.com', phone: null, location: null, links: [] }, summary: null, sections: [] },
            suggestions: [bullet],
            statuses: [{ suggestion: bullet, status: 'accepted', finalText: 'Sharper line' }],
            user_edits: {}, fit: { chosen: [], cuts: [], overflow: false },
            created_at: 'x', updated_at: 'x',
          },
          error: null,
        },
      },
    });
    mockCreateRouteClient.mockResolvedValue(supa as never);

    const res = await PATCH(patchReq({ suggestionId: 'sug-1', status: 'rejected' }), makeContext(RESUME_ID));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('already_dispositioned');
  });
});
