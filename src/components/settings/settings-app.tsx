'use client';

import { useState } from 'react';

/**
 * Settings (spec v1): full JSON export and hard account deletion.
 * The destructive action gets the muted warning tone + type-to-confirm —
 * never the accent color, which is reserved for primary actions.
 */
export default function SettingsApp() {
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ready = confirmText === 'DELETE';

  const del = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/account', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error?.message || 'Could not delete your account. Please try again.');
        return;
      }
      // The account no longer exists — leave the app entirely.
      window.location.href = '/';
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Your data
        </h2>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Download everything you&apos;ve recorded — profile, job descriptions, and every
          generated CV — as a JSON file.
        </p>
        <a
          href="/api/account/export"
          className="inline-block rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Export my data (JSON)
        </a>
      </section>

      <section className="rounded-md border border-red-200 bg-red-50/50 p-5 dark:border-red-900 dark:bg-red-950/30">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-red-700 dark:text-red-400">
          Delete account
        </h2>
        <p className="mb-4 text-sm leading-6 text-red-800/90 dark:text-red-300/90">
          This permanently removes your profile, all recorded entries, saved job
          descriptions, and every generated CV — including your sign-in. It cannot be
          undone. Export first if you want a copy.
        </p>
        <label htmlFor="delete-confirm" className="mb-1 block text-xs font-medium text-red-700 dark:text-red-400">
          Type DELETE to confirm
        </label>
        <input
          id="delete-confirm"
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoComplete="off"
          className="w-48 rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-red-900 dark:bg-zinc-900 dark:text-zinc-50"
          placeholder="DELETE"
        />
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>
        )}
        <button
          type="button"
            disabled={!ready || busy}
            onClick={del}
          className="mt-4 rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
        >
          {busy ? 'Deleting…' : 'Delete my account'}
        </button>
      </section>
    </div>
  );
}
