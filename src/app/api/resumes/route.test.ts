import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupaStub } from '@/test-helpers/supa-stub';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  createServerClient: vi.fn(),
}));

import { GET } from './route';
import { getSessionUser } from '@/lib/auth/session';
import { createServerClient } from '@/lib/db/client';

const mockGetSessionUser = vi.mocked(getSessionUser);
const mockCreateServerClient = vi.mocked(createServerClient);

describe('GET /api/resumes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetSessionUser.mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('unauthorized');
  });

  it('returns 200 with resume list on success', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });

    const supa = createSupaStub({
      from: {
        generated_resumes: {
          data: [
            {
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
          ],
          error: null,
        },
      },
    });
    mockCreateServerClient.mockResolvedValue(supa as any);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.resumes).toBeDefined();
    expect(Array.isArray(data.resumes)).toBe(true);
    expect(data.resumes.length).toBe(1);
  });
});
