'use client';

import { useState } from 'react';
import { SignOut } from '@phosphor-icons/react';

/**
 * The quiet exit. Posts to the logout route (which clears the Supabase
 * session cookies server-side), then leaves the app. Kept away from accent
 * colors — sign-out is never a "primary action". `nav` renders it as a
 * sidebar item; `inline` is the compact text link.
 */
export default function SignOutButton({
  variant = 'inline',
  compact = false,
  onNavigate,
}: {
  variant?: 'inline' | 'nav';
  /** Icon-only nav item for the collapsed sidebar; keeps an accessible name via title. */
  compact?: boolean;
  /** e.g. close the mobile drawer before the page leaves. */
  onNavigate?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const signOut = async () => {
    setError('');
    setBusy(true);
    onNavigate?.();
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (!res.ok) throw new Error('logout failed');
      window.location.href = '/';
    } catch {
      setError('Could not sign out. Try again.');
      setBusy(false);
    }
  };

  if (variant === 'nav') {
    return (
      <span className="flex flex-col gap-1">
        {error && (
          <span role="alert" className="px-3 text-xs text-tone-red">
            {error}
          </span>
        )}
        <button
          type="button"
          onClick={signOut}
          disabled={busy}
          title={compact ? 'Sign out' : undefined}
          aria-label={compact ? 'Sign out' : undefined}
          className={
            'flex min-h-10 w-full cursor-pointer items-center gap-3 border-l-[3px] border-transparent px-3 py-2 text-sm text-mute transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50' +
            (compact ? ' justify-center px-0' : '')
          }
        >
          <SignOut aria-hidden size={20} className="shrink-0" />
          {!compact && <span>{busy ? 'Signing out…' : 'Sign out'}</span>}
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-3">
      {error && <span role="alert" className="text-xs text-tone-red">{error}</span>}
      <button
        type="button"
        onClick={signOut}
        disabled={busy}
        className="min-h-9 cursor-pointer px-3 py-1.5 text-sm text-mute transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
      >
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
    </span>
  );
}
