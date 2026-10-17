import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupaStub } from '@/test-helpers/supa-stub';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

// GET calls connection() to force request-time rendering; it throws outside
// a Next request scope, so stub it here while keeping real NextResponse.
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, connection: vi.fn(async () => {}) };
});
vi.mock('@/lib/auth/session', () => ({ getSessionUser: vi.fn() }));
vi.mock('@/lib/db/client', () => ({ createRouteClient: vi.fn() }));

import { GET, PATCH } from './route';
import { getSessionUser } from '@/lib/auth/session';
import { createRouteClient } from '@/lib/db/client';

const mockGetSessionUser = vi.mocked(getSessionUser);
const mockCreateRouteClient = vi.mocked(createRouteClient);

const profileRow = {
  data: {
    id: 'profile-1',
    user_id: 'user-1',
    personal: { fullName: 'Test User', email: 'test@example.com', phone: null, location: null, links: [] },
  },
  error: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });
});

describe('GET /api/profile', () => {
  it('returns 401 without a session', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it('returns the profile', async () => {
    mockCreateRouteClient.mockResolvedValue(
      createSupaStub({ from: { profiles: profileRow } }) as never
    );
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.profile.personal.fullName).toBe('Test User');
  });
});

describe('PATCH /api/profile', () => {
  const patch = (body: unknown) =>
    new Request('http://localhost/api/profile', { method: 'PATCH', body: JSON.stringify(body) });

  it('updates personal info', async () => {
    const supa = createSupaStub({ from: { profiles: profileRow } });
    mockCreateRouteClient.mockResolvedValue(supa as never);

    const res = await PATCH(
      patch({
        personal: {
          fullName: 'Roki ZS',
          email: 'roki@example.com',
          phone: '+8801700000000',
          location: 'Dhaka',
          links: ['github.com/rokizs51'],
        },
      })
    );

    expect(res.status).toBe(200);
    const upd = supa.calls.from.find((c) => c.table === 'profiles' && c.method === 'update');
    expect(upd?.args).toMatchObject({
      personal: { fullName: 'Roki ZS', email: 'roki@example.com', links: ['github.com/rokizs51'] },
    });
  });

  it('rejects invalid personal info with 400', async () => {
    mockCreateRouteClient.mockResolvedValue(createSupaStub() as never);

    const res = await PATCH(patch({ personal: { fullName: '', email: 'not-an-email' } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('invalid_payload');
  });

  it('returns 401 without a session', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    expect((await PATCH(patch({ personal: {} }))).status).toBe(401);
  });
});
