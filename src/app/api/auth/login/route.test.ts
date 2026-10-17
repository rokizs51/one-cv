import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing route
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  createRouteClient: vi.fn(),
}));

import { POST } from './route';
import { cookies } from 'next/headers';
import { createRouteClient } from '@/lib/db/client';

const mockCookies = vi.mocked(cookies);
const mockCreateRouteClient = vi.mocked(createRouteClient);

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
    mockCreateRouteClient.mockReturnValue(mockSupabase);

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

  it('returns 400 invalid_request when email or password is missing', async () => {
    const response = await POST(createRequest({ email: 'user@example.com' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('invalid_request');
    expect(mockSupabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('returns 200 with the user on successful sign in', async () => {
    const email = 'user@example.com';
    const password = 'password123';
    const userId = 'user-123';

    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: {
        user: { id: userId, email },
        session: { access_token: 'token' },
      },
      error: null,
    });

    const response = await POST(createRequest({ email, password }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.id).toBe(userId);
    expect(data.user.email).toBe(email);
    // Plain email/password auth: no extra table access after sign-in
    expect(mockSupabase.from).not.toHaveBeenCalled();
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
