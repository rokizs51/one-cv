import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import VersionList from './version-list';
import type { ResumeSummary } from '@/lib/db/resumes';

function summaries(n: number): ResumeSummary[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `cv-${i}`,
    jdId: 'jd-1',
    mode: 'as_is' as const,
    pageLimit: 1 as const,
    createdAt: new Date(2026, 9, 10 - i).toISOString(), // newest first, distinct dates
  }));
}

beforeEach(() => cleanup());

describe('VersionList', () => {
  it('shows 8 rows per page and pages through the rest', () => {
    render(<VersionList resumes={summaries(10)} onDelete={vi.fn()} />);

    expect(screen.getAllByRole('link')).toHaveLength(8);
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /previous/i })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /previous/i }));
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
  });

  it('hides pagination for short lists', () => {
    render(<VersionList resumes={summaries(3)} onDelete={vi.fn()} />);
    expect(screen.queryByText(/page 1 of/)).not.toBeInTheDocument();
  });

  it('delete needs an explicit confirm; cancel makes no call', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<VersionList resumes={summaries(2)} onDelete={onDelete} />);

    const trash = () => screen.getAllByRole('button', { name: /delete the cv from/i })[0];

    fireEvent.click(trash());
    expect(onDelete).not.toHaveBeenCalled(); // trash alone must not destroy

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(trash());
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
  });

  it('a failing delete surfaces an inline error and keeps the confirm row', async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error('offline'));
    render(<VersionList resumes={summaries(1)} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole('button', { name: /delete the cv from/i }));
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not delete/i);
  });
});
