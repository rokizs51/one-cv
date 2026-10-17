import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import SignOutButton from './sign-out-button';

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  cleanup();
  // window.location.href is read-only in jsdom; replace it wholesale so the
  // navigation (`window.location.href = '/'`) is observable rather than throwing.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { href: '' },
  });
});

describe('SignOutButton', () => {
  it('posts to the logout route and navigates to the landing page', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });

    render(<SignOutButton />);
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
    );
    await waitFor(() => expect(window.location.href).toBe('/'));
  });

  it('shows an inline error and does not navigate when logout fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });

    render(<SignOutButton />);
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not sign out/i);
    expect(window.location.href).toBe('');
  });
});
