import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing route
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  createAnonClient: vi.fn(),
}));

vi.mock('@/lib/db/invites', () => ({
  inviteExists: vi.fn(),
  claimInvite: vi.fn(),
}));

import { POST } from './route';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createAnonClient } from '@/lib/db/client';
import { inviteExists, claimInvite } from '@/lib/db/invites';

const mockCookies = vi.mocked(cookies);
const mockCreateServerClient = vi.mocked(createServerClient);
const mockCreateAnonClient = vi.mocked(createAnonClient);
const mockInviteExists = vi.mocked(inviteExists);
const mockClaimInvite = vi.mocked(claimInvite);

describe('POST /api/auth/signup', () => {
  let mockSupabase: any;
  let mockAnonSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock cookie store
    mockCookies.mockResolvedValue({
      getAll: () => [],
      set: vi.fn(),
    } as any);

    // Mock anon client
    mockAnonSupabase = {};
    mockCreateAnonClient.mockReturnValue(mockAnonSupabase);

    // Mock supabase server client
    mockSupabase = {
      auth: {
        signUp: vi.fn(),
        signOut: vi.fn(),
      },
    };
    mockCreateServerClient.mockReturnValue(mockSupabase);

    // Set env vars
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  const createRequest = (body: any) => {
    return new Request('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  };

  it('returns 409 user_exists when signUp fails with status 422', async () => {
    const email = 'existing@example.com';
    const password = 'password123';
    const inviteCode = 'VALID-CODE';

    mockInviteExists.mockResolvedValue(true);
    mockSupabase.auth.signUp.mockResolvedValue({
      data: { user: null },
      error: {
        status: 422,
        message: 'User already registered',
      },
    });

    const response = await POST(createRequest({ email, password, inviteCode }));
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error.code).toBe('user_exists');
    expect(data.error.message).toBe('A user with this email already exists');
  });

  it('returns 409 user_exists when signUp fails with message containing "already registered"', async () => {
    const email = 'existing@example.com';
    const password = 'password123';
    const inviteCode = 'VALID-CODE';

    mockInviteExists.mockResolvedValue(true);
    mockSupabase.auth.signUp.mockResolvedValue({
      data: { user: null },
      error: {
        status: 400,
        message: 'User already registered in the system',
      },
    });

    const response = await POST(createRequest({ email, password, inviteCode }));
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error.code).toBe('user_exists');
    expect(data.error.message).toBe('A user with this email already exists');
  });

  it('returns 400 invalid_invite when claimInvite fails (race condition) and calls signOut', async () => {
    const email = 'new@example.com';
    const password = 'password123';
    const inviteCode = 'RACE-CODE';
    const userId = 'user-123';

    mockInviteExists.mockResolvedValue(true);
    mockSupabase.auth.signUp.mockResolvedValue({
      data: {
        user: { id: userId, email },
      },
      error: null,
    });
    mockClaimInvite.mockResolvedValue(false); // Race condition: invite lost
    mockSupabase.auth.signOut.mockResolvedValue({ error: null });

    const response = await POST(createRequest({ email, password, inviteCode }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('invalid_invite');
    expect(data.error.message).toBe('This invite code is no longer available');
    
    // Verify signOut was called (security-critical side effect)
    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
  });

  it('returns 201 on successful signup with valid invite', async () => {
    const email = 'new@example.com';
    const password = 'password123';
    const inviteCode = 'VALID-CODE';
    const userId = 'user-123';

    mockInviteExists.mockResolvedValue(true);
    mockSupabase.auth.signUp.mockResolvedValue({
      data: {
        user: { id: userId, email },
      },
      error: null,
    });
    mockClaimInvite.mockResolvedValue(true);

    const response = await POST(createRequest({ email, password, inviteCode }));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.user.id).toBe(userId);
    expect(data.user.email).toBe(email);
    expect(mockSupabase.auth.signOut).not.toHaveBeenCalled();
  });
});
