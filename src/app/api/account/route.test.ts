import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupaStub } from '@/test-helpers/supa-stub';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
// GET calls connection() (request-time); stub it while keeping real NextResponse.
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, connection: vi.fn(async () => {}) };
});
vi.mock('@/lib/auth/session', () => ({ getSessionUser: vi.fn() }));
vi.mock('@/lib/db/client', () => ({ createRouteClient: vi.fn() }));

import { GET, DELETE } from './route';
import { getSessionUser } from '@/lib/auth/session';
import { createRouteClient } from '@/lib/db/client';

const mockGetSessionUser = vi.mocked(getSessionUser);
const mockCreateRouteClient = vi.mocked(createRouteClient);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/account (JSON export)', () => {
  it('returns 401 without a session', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it('returns all four stores keyed for the signed-in user', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 't@example.com' });
    const supa = createSupaStub({
      from: {
        profiles: { data: { id: 'p1', user_id: 'user-1', personal: { fullName: 'T', email: 't@example.com', phone: null, location: null, links: [] } }, error: null },
        profile_items: { data: [{ id: 'i1', profile_id: 'p1', type: 'skill', payload: { name: 'Go' }, canonical_text: 'Go', source: 'manual', provenance: [], pinned: false, position: 0 }], error: null },
        job_descriptions: { data: [], error: null },
        generated_resumes: { data: [], error: null },
      },
    });
    mockCreateRouteClient.mockResolvedValue(supa as never);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');

    const data = await res.json();
    expect(Object.keys(data).sort()).toEqual(
      ['exported_at', 'generated_resumes', 'job_descriptions', 'month', 'profile', 'profile_items'].sort()
    );
    expect(data.profile_items).toHaveLength(1);
    expect(data.month).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('DELETE /api/account', () => {
  it('returns 401 with zero DB calls when unauthenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    const supa = createSupaStub();
    mockCreateRouteClient.mockResolvedValue(supa as never);

    const res = await DELETE();
    expect(res.status).toBe(401);
    expect(supa.calls.from).toHaveLength(0);
    expect(supa.calls.rpc).toHaveLength(0);
  });

  it('calls the delete_current_user RPC once for a signed-in user', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 't@example.com' });
    const supa = createSupaStub({ rpc: { delete_current_user: { data: null, error: null } } });
    mockCreateRouteClient.mockResolvedValue(supa as never);

    const res = await DELETE();
    expect(res.status).toBe(200);
    const rpcCall = supa.calls.rpc.find((c) => c.fn === 'delete_current_user');
    expect(rpcCall).toBeDefined();
    expect(supa.calls.rpc.filter((c) => c.fn === 'delete_current_user')).toHaveLength(1);
  });

  it('surfaces a 500 (not a false 200) when the RPC errors', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 't@example.com' });
    const supa = createSupaStub({
      rpc: { delete_current_user: { data: null, error: { message: 'boom' } } },
    });
    mockCreateRouteClient.mockResolvedValue(supa as never);

    const res = await DELETE();
    expect(res.status).toBe(500);
  });
});
