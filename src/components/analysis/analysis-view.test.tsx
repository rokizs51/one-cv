import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import AnalysisView from './analysis-view';
import type { MatchAnalysisResult } from '@/lib/match/match-types';
import type { MatchAnalysis } from '@/lib/db/analyses';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

const requirement: MatchAnalysisResult['requirements'][number] = {
  id: 'req-technical_skill-0',
  description: 'PostgreSQL',
  category: 'technical_skill',
  importance: 'mandatory',
  aliases: [],
  sourceExcerpt: 'deep PostgreSQL experience',
};

const result: MatchAnalysisResult = {
  requirements: [requirement],
  matches: [
    {
      requirementId: 'req-technical_skill-0',
      status: 'needs_review',
      confidence: 'low',
      evidenceRefs: [{ itemId: 'e1', sourceType: 'project' }],
      explanation: 'A personal project touches Postgres; employment is unclear.',
      followUpQuestion: 'Did you run Postgres in production?',
    },
  ],
  summary: {
    totals: { requirements: 1, supported: 0, partial: 0, needs_review: 1, not_established: 0, not_applicable: 0 },
    byImportance: { mandatory: { needs_review: 1 }, preferred: {} },
    strongest: [],
    gaps: ['PostgreSQL'],
    questions: ['Did you run Postgres in production?'],
    adjustments: [],
  },
};

const analysis: MatchAnalysis = {
  id: 'a-1',
  owner: 'u1',
  jdId: 'jd-1',
  status: 'completed',
  result,
  error: null,
  profileFingerprint: 'fp',
  createdAt: '2026-10-19T00:00:00Z',
  updatedAt: '2026-10-19T00:00:00Z',
};

const evidenceText = { e1: { type: 'project', text: 'Shop — side project (Postgres)' } };

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  cleanup();
});

describe('AnalysisView', () => {
  it('shows status, evidence, explanation, the follow-up question and no unsupported gap claim', () => {
    render(<AnalysisView analysis={analysis} stale={false} evidenceText={evidenceText} />);

    expect(screen.getAllByText('PostgreSQL').length).toBeGreaterThan(0);
    expect(screen.getByText('Needs your review')).toBeInTheDocument();
    // wording discipline: never "missing skill"
    expect(screen.queryByText(/missing skill/i)).not.toBeInTheDocument();
    expect(screen.getByText(/side project \(Postgres\)/)).toBeInTheDocument();
    // shown inline on the requirement AND in the summary's question list
    expect(screen.getAllByText(/Did you run Postgres in production\?/).length).toBeGreaterThanOrEqual(2);
  });

  it('confirmation PATCH records the user verdict and refreshes counts', async () => {
    const confirmed = {
      ...result,
      matches: [{ ...result.matches[0], userConfirmation: { status: 'supported', note: '', at: '2026-10-19T10:00:00Z' } }],
      summary: {
        ...result.summary,
        totals: { ...result.summary.totals, supported: 1, needs_review: 0 },
        byImportance: { mandatory: { supported: 1 }, preferred: {} },
      },
    };
    mockFetch.mockResolvedValue(jsonResponse(200, { analysis: { ...analysis, result: confirmed }, stale: false }));

    render(<AnalysisView analysis={analysis} stale={false} evidenceText={evidenceText} />);
    fireEvent.click(screen.getByRole('button', { name: /confirm — i have this/i }));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/analyses/a-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ requirementId: 'req-technical_skill-0', status: 'supported' }),
        })
      )
    );
    await screen.findByText('Supported');
    expect(screen.getByText(/confirmed by you/i)).toBeInTheDocument();
  });

  it('a stale analysis offers rerun and hides the generate action', () => {
    render(<AnalysisView analysis={analysis} stale={true} evidenceText={evidenceText} />);

    expect(screen.getByText(/profile changed since this analysis/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /generate tailored cv/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /rerun/i })[0]).toBeInTheDocument();
  });

  it('failed analysis shows the sanitized error and rerun', async () => {
    mockFetch.mockResolvedValue(jsonResponse(201, { analysis: { ...analysis, status: 'completed', error: null } }));
    render(
      <AnalysisView
        analysis={{ ...analysis, status: 'failed', result: null, error: 'Analysis failed: unusable model response.' }}
        stale={false}
        evidenceText={evidenceText}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('unusable model response');
    fireEvent.click(screen.getByRole('button', { name: /rerun analysis/i }));
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith('/api/analyses/a-1/rerun', expect.objectContaining({ method: 'POST' }))
    );
  });
});
