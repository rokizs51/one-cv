import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing route
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

import { POST } from './route';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const mockCookies = vi.mocked(cookies);
const mockCreateServerClient = vi.mocked(createServerClient);

describe('POST /api/auth/login', () => {
  let mockSupabase: any;
  let mockCookieStore: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock cookie store
    mockCookieStore = {
      getAll: vi.fn(() => []),
      set: vi.fn(),
    };
    mockCookies.mockResolvedValue(mockCookieStore);

    // Mock supabase server client
    mockSupabase = {
      auth: {
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
      },
      from: vi.fn(),
    };
    mockCreateServerClient.mockReturnValue(mockSupabase);

    // Set env vars
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  const createRequest = (body: any) => {
    return new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  };

  it('returns 403 invite_required when user has no claimed invite and calls signOut', async () => {
    const email = 'user@example.com';
    const password = 'password123';
    const userId = 'user-123';

    // Mock successful sign in
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: userId, email },
        session: { access_token: 'token' },
      },
      error: null,
    });

    // Mock invites table query - no invite row found
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      }),
    });
    mockSupabase.from = mockFrom;
    mockSupabase.auth.signOut.mockResolvedValue({ error: null });

    const response = await POST(createRequest({ email, password }));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error.code).toBe('invite_required');
    expect(data.error.message).toBe('You need a valid invite to access this application');
    
    // Verify signOut was called (security-critical side effect)
    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    
    // Verify no session cookies were set
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });

  it('returns 200 when user has claimed invite', async () => {
    const email = 'user@example.com';
    const password = 'password123';
    const userId = 'user-123';

    // Mock successful sign in
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: userId, email },
        session: { access_token: 'token' },
      },
      error: null,
    });

    // Mock invites table query - invite row found
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { code: 'VALID-CODE' },
            error: null,
          }),
        }),
      }),
    });
    mockSupabase.from = mockFrom;

    const response = await POST(createRequest({ email, password }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.id).toBe(userId);
    expect(data.user.email).toBe(email);
    
    // Verify signOut was NOT called
    expect(mockSupabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('returns 401 invalid_credentials when sign in fails', async () => {
    const email = 'user@example.com';
    const password = 'wrongpassword';

    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });

    const response = await POST(createRequest({ email, password }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('invalid_credentials');
    expect(mockSupabase.auth.signOut).not.toHaveBeenCalled();
  });
});
