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
  createServerClient: vi.fn(),
}));

import { GET } from './route';
import { getSessionUser } from '@/lib/auth/session';
import { createServerClient } from '@/lib/db/client';

const mockGetSessionUser = vi.mocked(getSessionUser);
const mockCreateServerClient = vi.mocked(createServerClient);

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

    const response = await GET(request(), makeContext('resume-1'));
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
    mockCreateServerClient.mockResolvedValue(supa as any);

    const response = await GET(request(), makeContext('resume-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.resume.id).toBe('resume-1');
  });

  it('returns 404 not_found for an unknown id', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });

    // No generated_resumes configured → getResume returns null.
    const supa = createSupaStub();
    mockCreateServerClient.mockResolvedValue(supa as any);

    const response = await GET(request(), makeContext('nonexistent-id'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('not_found');
  });
});
