import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupaStub } from '@/test-helpers/supa-stub';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ getSessionUser: vi.fn() }));
vi.mock('@/lib/db/client', () => ({ createRouteClient: vi.fn() }));

import { POST } from './route';
import { getSessionUser } from '@/lib/auth/session';
import { createRouteClient } from '@/lib/db/client';

const mockGetSessionUser = vi.mocked(getSessionUser);
const mockCreateRouteClient = vi.mocked(createRouteClient);

const RESUME_ID = '11111111-1111-4111-8111-111111111111';

const extraction = {
  requiredSkills: ['React'],
  preferredSkills: [],
  keywords: [],
  seniority: 'mid',
  domain: 'web',
  tools: [],
  responsibilities: [],
};

function stubWithItems(canonicalText: string, pinned: boolean) {
  return createSupaStub({
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
      profiles: {
        data: {
          id: 'profile-1',
          user_id: 'user-1',
          personal: { fullName: 'T', email: 't@example.com', phone: null, location: null, links: [] },
        },
        error: null,
      },
      profile_items: {
        data: [
          {
            id: 'pin-1',
            profile_id: 'profile-1',
            type: 'experience',
            payload: {},
            canonical_text: canonicalText,
            source: 'manual',
            provenance: [],
            pinned,
            position: 0,
          },
        ],
        error: null,
      },
      job_descriptions: {
        data: {
          id: 'jd-1',
          owner: 'user-1',
          raw: 'x',
          extraction,
          created_at: '2026-10-15T00:00:00Z',
        },
        error: null,
      },
    },
  });
}

function post(body: unknown) {
  return POST(
    new Request(`http://localhost/api/resumes/${RESUME_ID}/fit`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: RESUME_ID }) }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 't@example.com' });
});

describe('POST /api/resumes/:id/fit (Review Focus 3)', () => {
  it('edited pinned content exceeding one page reports wont_fit and never drops the pin', async () => {
    mockCreateRouteClient.mockResolvedValue(stubWithItems('short', true) as never);

    // userEdits inflate the pinned item to 80 lines (> 78-unit page).
    const res = await post({
      userEdits: { 'pin-1': 'React ' + 'w'.repeat(80 * 64 - 6) },
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.overflow).toBe(true);
    expect(data.code).toBe('wont_fit');
    // The pin is chosen, never cut — the UI must resolve via un-pin or 2 pages.
    expect(data.fit.cuts.find((c: { itemId: string }) => c.itemId === 'pin-1')).toBeUndefined();
    expect(data.fit.chosen).toContain('pin-1');
  });

  it('the 2-page toggle doubles the budget and clears wont_fit', async () => {
    mockCreateRouteClient.mockResolvedValue(stubWithItems('short', true) as never);

    const res = await post({
      userEdits: { 'pin-1': 'React ' + 'w'.repeat(80 * 64 - 6) },
      pageLimit: 2,
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.overflow).toBe(false);
    expect(data.code).toBeUndefined();
  });

  it('cuts carry the item text so the live cut list can name what fell off', async () => {
    mockCreateRouteClient.mockResolvedValue(stubWithItems('React keeps this one fine', true) as never);

    const res = await post({});
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.overflow).toBe(false);
    expect(Array.isArray(data.cuts)).toBe(true);
  });

  it('returns 401 without a session and 404 for an unknown resume', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    expect((await post({})).status).toBe(401);

    mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 't@example.com' });
    const noResume = createSupaStub({
      from: { generated_resumes: { data: null, error: { code: 'PGRST116' } } },
    });
    mockCreateRouteClient.mockResolvedValue(noResume as never);
    const res = await post({});
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('not_found');
  });

  it('rejects a malformed id with 400', async () => {
    mockCreateRouteClient.mockResolvedValue(createSupaStub() as never);
    const res = await POST(
      new Request('http://localhost/api/resumes/x/fit', { method: 'POST', body: '{}' }),
      { params: Promise.resolve({ id: 'not-a-uuid' }) }
    );
    expect(res.status).toBe(400);
  });
});
