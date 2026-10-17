import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import SuggestionReview from './suggestion-review';
import type { SuggestionState } from '@/lib/domain/types';

function state(overrides: Partial<SuggestionState> = {}): SuggestionState {
  return {
    suggestion: {
      id: 'sug-1',
      targetItemId: 'item-1',
      kind: 'bullet',
      newText: 'Suggested sharper wording',
      basis: 'item-1',
    },
    status: 'pending',
    finalText: null,
    ...overrides,
  };
}

const rows = [{ state: state(), originalText: 'Original bullet text' }];

beforeEach(() => cleanup());

describe('SuggestionReview', () => {
  it('pending suggestion shows Accept/Edit/Reject; Accept is never disabled, even while busy', () => {
    render(<SuggestionReview rows={rows} busy onDisposition={vi.fn()} />);

    screen.getByText('Original bullet text');
    const accept = screen.getByRole('button', { name: /^accept$/i });
    expect(accept).not.toBeDisabled(); // accept is always clickable
    screen.getByRole('button', { name: /^edit$/i });
    screen.getByRole('button', { name: /^reject$/i });
  });

  it('Accept calls onDisposition exactly once with the suggestion id', async () => {
    const onDisposition = vi.fn().mockResolvedValue(undefined);
    render(<SuggestionReview rows={rows} busy={false} onDisposition={onDisposition} />);

    fireEvent.click(screen.getByRole('button', { name: /^accept$/i }));

    await waitFor(() => expect(onDisposition).toHaveBeenCalledTimes(1));
    expect(onDisposition).toHaveBeenCalledWith('sug-1', 'accepted');
  });

  it('Reject sends only the id and rejected status (doc stays untouched by the server)', async () => {
    const onDisposition = vi.fn().mockResolvedValue(undefined);
    render(<SuggestionReview rows={rows} busy={false} onDisposition={onDisposition} />);

    fireEvent.click(screen.getByRole('button', { name: /^reject$/i }));

    await waitFor(() =>
      expect(onDisposition).toHaveBeenCalledWith('sug-1', 'rejected')
    );
    expect(onDisposition.mock.calls[0].length).toBeLessThanOrEqual(3);
  });

  it('Edit opens a prefilled textarea and Save sends the edited text', async () => {
    const onDisposition = vi.fn().mockResolvedValue(undefined);
    render(<SuggestionReview rows={rows} busy={false} onDisposition={onDisposition} />);

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    const box = (await screen.findByRole('textbox')) as HTMLTextAreaElement;
    expect(box.value).toBe('Suggested sharper wording'); // prefilled with the suggestion

    fireEvent.change(box, { target: { value: 'My own version' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(onDisposition).toHaveBeenCalledWith('sug-1', 'edited', 'My own version')
    );
  });

  it('dispositioned rows show their outcome and offer no actions (final per generation)', () => {
    const done = [{ state: state({ status: 'accepted' as const, finalText: 'Suggested sharper wording' }), originalText: 'Original bullet text' }];
    render(<SuggestionReview rows={done} busy={false} onDisposition={vi.fn()} />);

    screen.getByText(/accepted/i);
    screen.getByText('Suggested sharper wording');
    expect(screen.queryByRole('button', { name: /^accept$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^reject$/i })).not.toBeInTheDocument();
  });

  it('summary suggestions are labelled as the headline, not a bullet', () => {
    const summaryRow = [{
      state: state({
        suggestion: { id: 'summary-composed', targetItemId: 'snap-1', kind: 'summary' as const, newText: 'Composed headline', basis: 'snap' },
      }),
      originalText: 'My own career summary',
    }];
    render(<SuggestionReview rows={summaryRow} busy={false} onDisposition={vi.fn()} />);

    screen.getByText('Headline summary'); // not "Bullet rewrite"
    screen.getByText('My own career summary');
  });
});
