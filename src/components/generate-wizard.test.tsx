import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import GenerateWizard from './generate-wizard';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const validJd =
  'We are hiring a Senior Frontend Engineer. Required: React, TypeScript, Next.js. ' +
  'You will build our design system and ship customer-facing features every week.';

const sampleExtraction = {
  requiredSkills: ['React', 'TypeScript'],
  preferredSkills: ['Next.js'],
  keywords: ['design system'],
  seniority: 'senior',
  domain: 'frontend',
  tools: ['Figma'],
  responsibilities: ['Build the design system'],
};

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

beforeEach(() => {
  mockPush.mockReset();
  mockFetch.mockReset();
  sessionStorage.clear();
  cleanup();
});

describe('step 1 — paste JD', () => {
  it('renders the JD textarea and Extract action', () => {
    render(<GenerateWizard />);
    screen.getByLabelText(/job description/i);
    screen.getByRole('button', { name: /extract/i });
  });

  it('restores a saved draft after being bounced to login (Review Focus 4)', async () => {
    sessionStorage.setItem('jd-draft', 'my previously pasted job description text');
    render(<GenerateWizard />);
    const box = (await screen.findByLabelText(/job description/i)) as HTMLTextAreaElement;
    await waitFor(() => expect(box.value).toBe('my previously pasted job description text'));
  });
});

describe('extract step', () => {
  it('moves to configure step with chips, mode choice and page limit on success', async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, { jdId: 'jd-1', extraction: sampleExtraction }));

    render(<GenerateWizard />);
    fireEvent.change(screen.getByLabelText(/job description/i), { target: { value: validJd } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/jds/extract', expect.anything()));
    expect(await screen.findByText(/React/)).toBeInTheDocument();
    screen.getByRole('radio', { name: /as-is/i });
    screen.getByRole('radio', { name: /enhance/i });
    screen.getByLabelText(/page limit/i);
    screen.getByRole('button', { name: /generate/i });
  });

  it('shows the returned message for a junk JD and stays on step 1', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(400, {
        error: { code: 'not_a_job_description', message: 'This does not look like a job description. Try pasting the full posting.' },
      })
    );

    render(<GenerateWizard />);
    fireEvent.change(screen.getByLabelText(/job description/i), { target: { value: 'asdf meme spam' } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));

    expect(await screen.findByText(/does not look like a job description/i)).toBeInTheDocument();
    // Still on step 1: textarea present, no mode radios
    screen.getByLabelText(/job description/i);
    expect(screen.queryByRole('radio', { name: /enhance/i })).not.toBeInTheDocument();
  });

  it('saves the draft and redirects to login on 401 (extract)', async () => {
    mockFetch.mockResolvedValue(jsonResponse(401, { error: { code: 'unauthorized', message: 'Authentication required' } }));

    render(<GenerateWizard />);
    fireEvent.change(screen.getByLabelText(/job description/i), { target: { value: validJd } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'));
    expect(sessionStorage.getItem('jd-draft')).toBe(validJd);
  });
});

describe('generate step', () => {
  async function toConfigureStep() {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { jdId: 'jd-1', extraction: sampleExtraction }));
    render(<GenerateWizard />);
    fireEvent.change(screen.getByLabelText(/job description/i), { target: { value: validJd } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));
    await screen.findByRole('button', { name: /generate/i });
    mockFetch.mockReset();
  }

  it('pushes to the resume page with the new id on success (as-is default)', async () => {
    await toConfigureStep();
    mockFetch.mockResolvedValue(jsonResponse(201, { resume: { id: 'resume-1' } }));

    fireEvent.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/resume/resume-1?new=1'));
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/resumes/generate',
      expect.objectContaining({
        body: JSON.stringify({ jdId: 'jd-1', mode: 'as_is', pageLimit: 1, analysisId: null }),
      })
    );
  });

  it('sends the chosen mode and page limit', async () => {
    await toConfigureStep();
    fireEvent.click(screen.getByRole('radio', { name: /enhance/i }));
    fireEvent.change(screen.getByLabelText(/page limit/i), { target: { value: '2' } });
    mockFetch.mockResolvedValue(jsonResponse(201, { resume: { id: 'resume-2' } }));

    fireEvent.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/resumes/generate',
        expect.objectContaining({
          body: JSON.stringify({ jdId: 'jd-1', mode: 'enhance', pageLimit: 2, analysisId: null }),
        })
      )
    );
  });

  it('shows an honest inline quota message on 429, no silent retry', async () => {
    await toConfigureStep();
    mockFetch.mockResolvedValue(jsonResponse(429, { error: { code: 'quota', message: 'Monthly generation quota exceeded' } }));

    fireEvent.click(screen.getByRole('button', { name: /generate/i }));

    expect(await screen.findByText(/50 resumes this month/i)).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('saves the draft and redirects to login on 401 (generate)', async () => {
    await toConfigureStep();
    mockFetch.mockResolvedValue(jsonResponse(401, { error: { code: 'unauthorized', message: 'Authentication required' } }));

    fireEvent.click(screen.getByRole('button', { name: /generate/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'));
    expect(sessionStorage.getItem('jd-draft')).toBe(validJd);
  });
});

describe('match analysis integration', () => {
  async function toConfigureStep() {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { jdId: 'jd-1', extraction: sampleExtraction }));
    render(<GenerateWizard />);
    fireEvent.change(screen.getByLabelText(/job description/i), { target: { value: validJd } });
    fireEvent.click(screen.getByRole('button', { name: /extract/i }));
    await screen.findByRole('button', { name: /generate my cv/i });
    mockFetch.mockReset();
  }

  it('"Analyze the match first" creates the analysis and navigates to it', async () => {
    await toConfigureStep();
    mockFetch.mockResolvedValue(
      jsonResponse(201, { analysis: { id: 'a-9', status: 'completed' } })
    );

    fireEvent.click(screen.getByRole('button', { name: /analyze the match first/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      '/api/analyses',
      expect.objectContaining({ body: JSON.stringify({ jdId: 'jd-1' }) })
    ));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/analysis/a-9'));
  });

  it('deep link with jdId+analysisId loads the stored JD and passes the analysis to generate', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(200, { jd: { id: 'jd-7', raw: 'stored jd text', extraction: sampleExtraction } })
    );
    render(<GenerateWizard initialJdId="jd-7" initialAnalysisId="a-3" />);

    await screen.findByRole('button', { name: /generate my cv/i });
    expect(screen.getByText(/tailoring to your match analysis/i)).toBeInTheDocument();

    mockFetch.mockResolvedValue(jsonResponse(201, { resume: { id: 'resume-9' } }));
    fireEvent.click(screen.getByRole('button', { name: /generate my cv/i }));
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/resumes/generate',
        expect.objectContaining({
          body: JSON.stringify({ jdId: 'jd-7', mode: 'as_is', pageLimit: 1, analysisId: 'a-3' }),
        })
      )
    );
  });
});
