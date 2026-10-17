'use client';

import { useState } from 'react';

/**
 * Quiet secondary action (never the accent — that's reserved for primary
 * actions per the UI direction). Posts to the logout route, which clears
 * the Supabase session cookies server-side, then lands on the public page.
 */
export default function SignOutButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const signOut = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (!res.ok) throw new Error('logout failed');
      window.location.href = '/';
    } catch {
      setError('Could not sign out. Try again.');
      setBusy(false);
    }
  };

  return (
    <span className="flex items-center gap-3">
      {error && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className="text-sm text-zinc-600 transition-colors hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
    </span>
  );
}
