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

  it('shows inline error when submitting without invite code', async () => {
    render(<SignupForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    // Leave invite code empty

    fireEvent.click(submitButton);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/invite code is required/i)).toBeInTheDocument();
    });

    // Should NOT call the API
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('shows inline error when invite code is only whitespace', async () => {
    render(<SignupForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const inviteInput = screen.getByLabelText(/invite code/i);
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(inviteInput, { target: { value: '   ' } });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invite code is required/i)).toBeInTheDocument();
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('calls API when all fields are valid', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ user: { id: '1', email: 'test@example.com' } }),
    });

    render(<SignupForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const inviteInput = screen.getByLabelText(/invite code/i);
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(inviteInput, { target: { value: 'INVITE123' } });

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
            inviteCode: 'INVITE123',
          }),
        })
      );
    });
  });

  it('shows error message from API response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { code: 'invalid_invite', message: 'This invite code is already used.' } }),
    });

    render(<SignupForm />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const inviteInput = screen.getByLabelText(/invite code/i);
    const submitButton = screen.getByRole('button', { name: /sign up/i });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(inviteInput, { target: { value: 'USED123' } });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/this invite code is already used/i)).toBeInTheDocument();
    });
  });
});
