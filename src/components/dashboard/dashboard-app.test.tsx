import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import DashboardApp from './dashboard-app';
import type { ProfileItem } from '@/lib/domain/types';
import type { ResumeSummary } from '@/lib/db/resumes';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const item = (id: string, type: ProfileItem['type']): ProfileItem => ({
  id,
  profileId: 'p1',
  type,
  payload: {},
  canonicalText: type,
  source: 'manual',
  provenance: [],
  pinned: false,
  position: 0,
});

const resume: ResumeSummary = {
  id: 'cv-1',
  jdId: 'jd-1',
  mode: 'as_is',
  pageLimit: 1,
  createdAt: '2026-10-10T00:00:00Z',
};

function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

function serve(body: Record<string, unknown>) {
  mockFetch.mockImplementation((url: string) => Promise.resolve(response(200, body[url])));
}

const okBody = {
  '/api/profile/items': { items: [item('i1', 'experience'), item('i2', 'skill')] },
  '/api/resumes': { resumes: [resume], quota: { used: 7, cap: 50 } },
  '/api/profile': {
    profile: {
      personal: { fullName: 'T', email: 't@example.com', phone: null, location: null, links: [] },
    },
  },
};

beforeEach(() => {
  mockFetch.mockReset();
  sessionStorage.clear();
  cleanup();
});

describe('DashboardApp', () => {
  it('reads quota from the server ledger, not the saved-CV count', async () => {
    serve(okBody);
    render(<DashboardApp />);

    expect(await screen.findByText('CVs saved')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/43 of 50 left/)).toBeInTheDocument();
  });

  it('counts personal details as a profile section', async () => {
    serve(okBody);
    render(<DashboardApp />);

    expect(await screen.findByText('33%')).toBeInTheDocument();
    expect(screen.getByText(/3\/9 sections/)).toBeInTheDocument();
    expect(screen.getByLabelText('Your details: complete')).toBeInTheDocument();
  });

  it('shows a loadable error instead of pretending the user is signed out', async () => {
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(
        url === '/api/resumes' ? response(500, {}) : response(200, okBody[url as keyof typeof okBody])
      )
    );
    render(<DashboardApp />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load your dashboard/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});