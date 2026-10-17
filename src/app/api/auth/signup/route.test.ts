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

describe('POST /api/auth/signup', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock cookie store
    mockCookies.mockResolvedValue({
      getAll: () => [],
      set: vi.fn(),
    } as any);

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

  it('returns 400 invalid_request when email or password is missing', async () => {
    const response = await POST(createRequest({ email: 'a@example.com' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('invalid_request');
    expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
  });

  it('returns 409 user_exists when signUp fails with status 422', async () => {
    const email = 'existing@example.com';
    const password = 'password123';

    mockSupabase.auth.signUp.mockResolvedValue({
      data: { user: null },
      error: {
        status: 422,
        message: 'User already registered',
      },
    });

    const response = await POST(createRequest({ email, password }));
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error.code).toBe('user_exists');
    expect(data.error.message).toBe('A user with this email already exists');
  });

  it('returns 409 user_exists when signUp fails with message containing "already registered"', async () => {
    const email = 'existing@example.com';
    const password = 'password123';

    mockSupabase.auth.signUp.mockResolvedValue({
      data: { user: null },
      error: {
        status: 400,
        message: 'User already registered in the system',
      },
    });

    const response = await POST(createRequest({ email, password }));
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error.code).toBe('user_exists');
    expect(data.error.message).toBe('A user with this email already exists');
  });

  it('returns 201 on successful signup', async () => {
    const email = 'new@example.com';
    const password = 'password123';
    const userId = 'user-123';

    mockSupabase.auth.signUp.mockResolvedValue({
      data: {
        user: { id: userId, email },
      },
      error: null,
    });

    const response = await POST(createRequest({ email, password }));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.user.id).toBe(userId);
    expect(data.user.email).toBe(email);
    expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({ email, password });
  });
});
