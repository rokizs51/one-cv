import { describe, it, expect, vi, beforeEach } from 'vitest';

const redirectCalls: string[] = [];

vi.mock('next/navigation', () => ({
  redirect: (url: string): never => {
    redirectCalls.push(url);
    throw new Error('NEXT_REDIRECT'); // Next's real redirect throws to unwind
  },
}));

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn(),
}));

import { getSessionUser } from '@/lib/auth/session';
import HomePage from './page';
import LoginPage from './login/page';
import SignupPage from './signup/page';
import DashboardPage from './dashboard/page';
import ProfilePage from './profile/page';
import GeneratePage from './generate/page';

const mockGetSessionUser = vi.mocked(getSessionUser);

async function settle(fn: () => Promise<unknown>) {
  try {
    await fn();
    return 'rendered';
  } catch (e) {
    if ((e as Error).message === 'NEXT_REDIRECT') return 'redirected';
    throw e;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  redirectCalls.length = 0;
});

describe('authenticated pages redirect anonymous visitors to /login', () => {
  it.each([
    ['dashboard', () => DashboardPage()],
    ['profile', () => ProfilePage()],
    ['generate', () => GeneratePage({ searchParams: Promise.resolve({}) })],
  ])('%s guards the session', async (_name, page) => {
    mockGetSessionUser.mockResolvedValue(null);
    expect(await settle(page)).toBe('redirected');
    expect(redirectCalls).toEqual(['/login']);
  });

  it('renders for a signed-in user', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', email: 'u@example.com' });
    expect(await settle(() => DashboardPage())).toBe('rendered');
    expect(await settle(() => ProfilePage())).toBe('rendered');
    expect(await settle(() => GeneratePage({ searchParams: Promise.resolve({}) }))).toBe('rendered');
    expect(redirectCalls).toEqual([]);
  });
});

describe('auth pages redirect signed-in users to the dashboard', () => {
  it.each([
    ['login', () => LoginPage()],
    ['signup', () => SignupPage()],
  ])('%s bounces an existing session', async (_name, page) => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', email: 'u@example.com' });
    expect(await settle(page)).toBe('redirected');
    expect(redirectCalls).toEqual(['/dashboard']);
  });

  it('renders the forms for anonymous visitors', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    expect(await settle(() => LoginPage())).toBe('rendered');
    expect(await settle(() => SignupPage())).toBe('rendered');
  });
});

describe('landing page', () => {
  it('is public: anonymous visitors get the product intro', async () => {
    mockGetSessionUser.mockResolvedValue(null);
    expect(await settle(() => HomePage())).toBe('rendered');
    expect(redirectCalls).toEqual([]);
  });

  it('sends signed-in visitors to their dashboard', async () => {
    mockGetSessionUser.mockResolvedValue({ id: 'u1', email: 'u@example.com' });
    expect(await settle(() => HomePage())).toBe('redirected');
    expect(redirectCalls).toEqual(['/dashboard']);
  });
});
