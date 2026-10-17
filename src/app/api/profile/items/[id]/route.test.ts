import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupaStub } from '@/test-helpers/supa-stub';
import type { ProfileItem } from '@/lib/domain/types';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ getSessionUser: vi.fn() }));
vi.mock('@/lib/db/client', () => ({ createRouteClient: vi.fn() }));
vi.mock('@/lib/db/items', () => ({
  getItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  revertText: vi.fn(),
}));

import { PATCH, DELETE } from './route';
import { getSessionUser } from '@/lib/auth/session';
import { createRouteClient } from '@/lib/db/client';
import { getItem, updateItem, deleteItem, revertText } from '@/lib/db/items';

const mockGetSessionUser = vi.mocked(getSessionUser);
const mockCreateRouteClient = vi.mocked(createRouteClient);
const mockGetItem = vi.mocked(getItem);
const mockUpdateItem = vi.mocked(updateItem);
const mockDeleteItem = vi.mocked(deleteItem);
const mockRevertText = vi.mocked(revertText);

const ID = '11111111-1111-4111-8111-111111111111';

function storedItem(overrides: Partial<ProfileItem> = {}): ProfileItem {
  return {
    id: ID,
    profileId: 'profile-1',
    type: 'experience',
    payload: { company: 'Acme', role: 'Dev', start: '2022', end: '2025', bullets: ['Shipped X'] },
    canonicalText: 'Dev — Acme (2022–2025)\n• Shipped X',
    source: 'manual',
    provenance: [],
    pinned: false,
    position: 0,
    ...overrides,
  };
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

const req = (body: unknown) =>
  new Request('http://localhost/api/profile/items/' + ID, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSessionUser.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });
  mockCreateRouteClient.mockResolvedValue(createSupaStub() as never);
});

describe('PATCH /api/profile/items/:id', () => {
  it('returns 401 without a session', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    const res = await PATCH(req({ pinned: true }), makeContext(ID));
    expect(res.status).toBe(401);
  });

  it('returns 400 for a malformed id', async () => {
    const res = await PATCH(req({ pinned: true }), makeContext('not-a-uuid'));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('invalid_request');
  });

  it('returns 404 when the item does not exist (or is not the caller\'s)', async () => {
    mockGetItem.mockResolvedValue(null);
    const res = await PATCH(req({ pinned: true }), makeContext(ID));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('not_found');
  });

  it('revertText: true calls items.revertText with the stored item', async () => {
    const item = storedItem({
      provenance: [
        { text: 'v2', originalText: 'v1', fromResumeId: 'r1', at: '2026-10-01T00:00:00Z' },
        { text: 'v3', originalText: 'v2', fromResumeId: 'r2', at: '2026-10-02T00:00:00Z' },
      ],
    });
    mockGetItem.mockResolvedValue(item);
    const reverted = storedItem({ provenance: [item.provenance[0]] });
    mockRevertText.mockResolvedValue(reverted);

    const res = await PATCH(req({ revertText: true }), makeContext(ID));
    const data = await res.json();

    expect(revertText).toHaveBeenCalledTimes(1);
    expect(revertText).toHaveBeenCalledWith(expect.anything(), ID, item);
    expect(res.status).toBe(200);
    expect(data.item.provenance).toHaveLength(1);
    expect(mockUpdateItem).not.toHaveBeenCalled();
  });

  it('pinned toggle sends { pinned } alone — canonicalText untouched', async () => {
    mockGetItem.mockResolvedValue(storedItem());
    mockUpdateItem.mockResolvedValue(undefined);

    const res = await PATCH(req({ pinned: true }), makeContext(ID));

    expect(res.status).toBe(200);
    expect(updateItem).toHaveBeenCalledWith(
      expect.anything(),
      ID,
      expect.objectContaining({ pinned: true })
    );
    const patch = mockUpdateItem.mock.calls[0][2];
    expect(patch).not.toHaveProperty('canonicalText');
    expect(patch).not.toHaveProperty('payload');
  });

  it('payload edit re-derives canonicalText from the stored type', async () => {
    mockGetItem.mockResolvedValue(storedItem());

    const res = await PATCH(
      req({ payload: { company: 'Acme', role: 'Lead', start: '2022', end: '2025', bullets: ['Ran Y'] } }),
      makeContext(ID)
    );

    expect(res.status).toBe(200);
    const patch = mockUpdateItem.mock.calls[0][2];
    expect(patch.canonicalText).toBe('Lead — Acme (2022–2025)\n• Ran Y');
  });

  it('payload edit on an Enhanced item rebases the provenance chain', async () => {
    // Stale snapshots must not survive a content edit: a later Revert would
    // restore pre-edit text (silent destruction).
    mockGetItem.mockResolvedValue(
      storedItem({
        provenance: [
          { text: 'Dev — Acme (2022–2025)\n• Shipped X', originalText: 'original words', fromResumeId: 'r1', at: '2026-10-01T00:00:00Z' },
        ],
      })
    );

    const res = await PATCH(
      req({ payload: { company: 'Acme', role: 'Lead', start: '2022', end: '2025', bullets: ['Ran Y'] } }),
      makeContext(ID)
    );

    expect(res.status).toBe(200);
    const patch = mockUpdateItem.mock.calls[0][2];
    expect(patch.canonicalText).toBe('Lead — Acme (2022–2025)\n• Ran Y');
    expect(patch.provenance).toEqual([]);
  });

  it('explicit canonicalText wins over re-derivation (manual line edit)', async () => {
    mockGetItem.mockResolvedValue(storedItem({ type: 'skill' }));

    const res = await PATCH(
      req({ payload: { name: 'Go' }, canonicalText: 'My own wording of this skill' }),
      makeContext(ID)
    );

    expect(res.status).toBe(200);
    const patch = mockUpdateItem.mock.calls[0][2];
    expect(patch.canonicalText).toBe('My own wording of this skill');
  });

  it('rejects an invalid payload for the stored type with 400', async () => {
    mockGetItem.mockResolvedValue(storedItem({ type: 'skill' }));
    const res = await PATCH(req({ payload: { nope: 1 } }), makeContext(ID));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('invalid_payload');
    expect(mockUpdateItem).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/profile/items/:id', () => {
  const del = () =>
    DELETE(new Request('http://localhost/api/profile/items/' + ID, { method: 'DELETE' }), makeContext(ID));

  it('returns 401 without a session', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    expect((await del()).status).toBe(401);
  });

  it('deletes exactly once and returns 200', async () => {
    mockGetItem.mockResolvedValue(storedItem());
    mockDeleteItem.mockResolvedValue(undefined);

    const res = await del();
    expect(res.status).toBe(200);
    expect(deleteItem).toHaveBeenCalledTimes(1);
    expect(deleteItem).toHaveBeenCalledWith(expect.anything(), ID);
  });

  it('returns 404 for an unknown/foreign id without deleting', async () => {
    mockGetItem.mockResolvedValue(null);
    const res = await del();
    expect(res.status).toBe(404);
    expect(mockDeleteItem).not.toHaveBeenCalled();
  });

  it('refuses to delete the career snapshot (edit-only, server-enforced)', async () => {
    mockGetItem.mockResolvedValue(storedItem({ type: 'career_snapshot', payload: { text: 'Who I am' } }));

    const res = await del();
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('cannot_delete');
    expect(mockDeleteItem).not.toHaveBeenCalled();
  });
});
