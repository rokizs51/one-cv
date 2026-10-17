import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import SignupForm from './signup-form';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('SignupForm', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    cleanup(); // Clean up DOM between tests
  });

  it('renders only email and password — no invite field', () => {
    render(<SignupForm />);

    screen.getByLabelText(/email/i);
    screen.getByLabelText(/password/i);
    expect(screen.queryByLabelText(/invite/i)).not.toBeInTheDocument();
  });

  it('calls API with email and password only', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ user: { id: '1', email: 'test@example.com' } }),
    });

    render(<SignupForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/signup',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123',
          }),
        })
      );
    });
  });

  it('shows error message from API response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { code: 'user_exists', message: 'A user with this email already exists' } }),
    });

    render(<SignupForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(emailInput, { target: { value: 'taken@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/a user with this email already exists/i)).toBeInTheDocument();
    });
  });
});
