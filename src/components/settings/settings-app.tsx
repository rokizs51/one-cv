'use client';

import { useState } from 'react';
import { DownloadSimple, Trash } from '@phosphor-icons/react';
import Card, { SectionHeading } from '@/components/ui/card';
import { Button, buttonCls } from '@/components/ui/button';

/**
 * Settings (spec v1): full JSON export and hard account deletion.
 * The destructive zone keeps its own semantic red wash, type-to-confirm,
 * and is spatially separated from the safe action above it.
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
    <div className="space-y-6">
      <Card className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <SectionHeading className="mb-1">Your data</SectionHeading>
          <p className="max-w-md text-sm leading-6 text-mute">
            Download everything youDownload everything you&apos;ve recorded — profile, job descriptions, and everyapos;ve recorded: profile, job descriptions, and every
            generated CV, as a JSON file.
          </p>
        </div>
        <a href="/api/account/export" className={buttonCls('secondary', 'lg', 'shrink-0')}>
          <DownloadSimple aria-hidden size={18} weight="bold" />
          Export my data (JSON)
        </a>
      </Card>

      <Card border="border-tone-red/30" bg="bg-wash-red/40" className="p-6">
        <div className="mb-2 flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center  bg-wash-red text-tone-red"
          >
            <Trash size={18} />
          </span>
          <SectionHeading color="text-tone-red">Delete account</SectionHeading>
        </div>
        <p className="mb-4 max-w-lg text-sm leading-6 text-mute">
          This permanently removes your profile, all recorded entries, saved job
          descriptions, and every generated CV, including your sign-in. It cannot be
          undone. Export first if you want a copy.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label htmlFor="delete-confirm" className="mb-1.5 block text-xs font-medium text-tone-red">
              Type DELETE to confirm
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              placeholder="DELETE"
              className="w-48  border border-tone-red/40 bg-surface px-4 py-2 text-sm text-ink transition-colors placeholder:text-faint focus:border-tone-red focus:outline-none focus:ring-2 focus:ring-tone-red/30"
            />
          </div>
          <Button
            variant="dangerSolid"
            disabled={!ready || busy}
            onClick={del}
          >
            <Trash aria-hidden size={16} />
            {busy ? 'Deleting…' : 'Delete my account'}
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-tone-red">
            {error}
          </p>
        )}
      </Card>
    </div>
  );
}
