// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupaStub } from '@/test-helpers/supa-stub';
import { pdfPageCount } from '@/lib/resume/render/render';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

// GET calls connection() to force request-time rendering; it throws outside
// a Next request scope, so stub it here while keeping real NextResponse.
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, connection: vi.fn(async () => {}) };
});

vi.mock('@/lib/auth/session', () => ({ getSessionUser: vi.fn() }));
vi.mock('@/lib/db/client', () => ({ createRouteClient: vi.fn() }));

import { GET } from './route';
import { getSessionUser } from '@/lib/auth/session';
import { createRouteClient } from '@/lib/db/client';

const mockGetSessionUser = vi.mocked(getSessionUser);
const mockCreateRouteClient = vi.mocked(createRouteClient);

const RESUME_ID = '11111111-1111-4111-8111-111111111111';

const doc = {
  header: { fullName: 'Test User', email: 't@example.com', phone: null, location: null, links: [] },
  summary: null,
  sections: [
    { id: 'experience', items: [{ sourceItemId: 'i1', text: 'Built things with React and TypeScript', basis: 'i1' }] },
  ],
};

const bulletSuggestion = {
  id: 'sug-1',
  targetItemId: 'i1',
  kind: 'bullet' as const,
  newText: 'Shipped things',
  basis: 'i1',
};

function stubWithStatuses(statuses: unknown[]) {
  return createSupaStub({
    from: {
      generated_resumes: {
        data: {
          id: RESUME_ID,
          owner: 'user-1',
          jd_id: 'jd-1',
          mode: 'enhance',
          page_limit: 1,
          doc,
          suggestions: [bulletSuggestion],
          statuses,
          user_edits: {},
          fit: { chosen: ['i1'], cuts: [], overflow: false },
          created_at: '2026-10-15T00:00:00Z',
          updated_at: '2026-10-15T00:00:00Z',
        },
        error: null,
      },
    },
  });
}

function get() {
  return GET(new Request(`http://localhost/api/resumes/${RESUME_ID}/pdf`), {
    params: Promise.resolve({ id: RESUME_ID }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 't@example.com' });
});

describe('GET /api/resumes/:id/pdf', () => {
  it('returns 409 pending_suggestions and NO bytes while a suggestion awaits disposition', async () => {
    mockCreateRouteClient.mockResolvedValue(
      stubWithStatuses([{ suggestion: bulletSuggestion, status: 'pending', finalText: null }]) as never
    );

    const res = await get();
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error.code).toBe('pending_suggestions');
    expect(data.error.message).toMatch(/1 pending suggestion/);
  });

  it('returns PDF bytes matching the stored page limit once everything is dispositioned', async () => {
    mockCreateRouteClient.mockResolvedValue(
      stubWithStatuses([{ suggestion: bulletSuggestion, status: 'accepted', finalText: 'Shipped things' }]) as never
    );

    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');

    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.byteLength).toBeGreaterThan(1000); // real PDF, not a stub
    expect(await pdfPageCount(bytes)).toBe(1); // one-page rule holds at export time
  });

  it('returns 401 without a session and 404 for an unknown resume', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    expect((await get()).status).toBe(401);

    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 't@example.com' });
    mockCreateRouteClient.mockResolvedValue(
      createSupaStub({ from: { generated_resumes: { data: null, error: { code: 'PGRST116' } } } }) as never
    );
    expect((await get()).status).toBe(404);
  });
});
