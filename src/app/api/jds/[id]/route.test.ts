import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupaStub } from '@/test-helpers/supa-stub';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ getSessionUser: vi.fn() }));
vi.mock('@/lib/db/client', () => ({ createRouteClient: vi.fn() }));

import { GET } from './route';
import { getSessionUser } from '@/lib/auth/session';
import { createRouteClient } from '@/lib/db/client';

const mockGetSessionUser = vi.mocked(getSessionUser);
const mockCreateRouteClient = vi.mocked(createRouteClient);

const ID = '11111111-1111-4111-8111-111111111111';
const ctx = { params: Promise.resolve({ id: ID }) };

const jdData = {
  id: ID,
  owner: 'user-1',
  raw: 'Big job description',
  extraction: {
    requiredSkills: ['Go'], preferredSkills: [], keywords: [],
    seniority: 'mid', domain: 'backend', tools: [], responsibilities: [],
  },
  created_at: '2026-10-18T00:00:00Z',
};

describe('GET /api/jds/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 without a session', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    expect((await GET(new Request('http://x'), ctx)).status).toBe(401);
  });

  it('404 for a foreign or missing JD (RLS surfaces PGRST116 as null)', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 'a@b.co' });
    mockCreateRouteClient.mockResolvedValue(
      createSupaStub({ from: { job_descriptions: { data: null, error: { code: 'PGRST116' } } } }) as never
    );
    expect((await GET(new Request('http://x'), ctx)).status).toBe(404);
  });

  it('200 with the JD for its owner', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 'a@b.co' });
    mockCreateRouteClient.mockResolvedValue(
      createSupaStub({ from: { job_descriptions: { data: jdData, error: null } } }) as never
    );
    const res = await GET(new Request('http://x'), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jd.extraction.requiredSkills).toEqual(['Go']);
  });
});
