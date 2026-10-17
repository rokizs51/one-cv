import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/headers before importing session
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

// Mock the Supabase client
vi.mock('@/lib/db/client', () => ({
  createServerClient: vi.fn(),
}));

import { getSessionUser } from './session';
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/db/client';

const mockCookies = vi.mocked(cookies);
const mockCreateServerClient = vi.mocked(createServerClient);

describe('getSessionUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no cookie header is present', async () => {
    // Mock cookies() to return empty array
    mockCookies.mockResolvedValue({
      getAll: () => [],
      set: vi.fn(),
    } as any);

    // Even with no cookies, we still create a client and call getUser
    const mockGetUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null });
    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: mockGetUser },
    } as any);

    const result = await getSessionUser();
    expect(result).toBeNull();
  });

  it('returns null when getUser() returns no user', async () => {
    const mockGetUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null });
    
    mockCookies.mockResolvedValue({
      getAll: () => [{ name: 'sb-test-auth-token', value: 'token' }],
      set: vi.fn(),
    } as any);
    
    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: mockGetUser },
    } as any);

    const result = await getSessionUser();
    expect(result).toBeNull();
  });

  it('returns user id and email when authenticated', async () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' };
    const mockGetUser = vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null });
    
    mockCookies.mockResolvedValue({
      getAll: () => [{ name: 'sb-test-auth-token', value: 'token' }],
      set: vi.fn(),
    } as any);
    
    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: mockGetUser },
    } as any);

    const result = await getSessionUser();
    expect(result).toEqual({ id: 'user-123', email: 'test@example.com' });
  });

  it('returns null when getUser() throws an error', async () => {
    const mockGetUser = vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('Invalid token') });
    
    mockCookies.mockResolvedValue({
      getAll: () => [{ name: 'sb-test-auth-token', value: 'token' }],
      set: vi.fn(),
    } as any);
    
    mockCreateServerClient.mockResolvedValue({
      auth: { getUser: mockGetUser },
    } as any);

    const result = await getSessionUser();
    expect(result).toBeNull();
  });
});
