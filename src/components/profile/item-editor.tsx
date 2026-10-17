'use client';

import { useState } from 'react';
import type { ProfileItem } from '@/lib/domain/types';
import { TYPE_FIELDS, payloadToForm, formToPayload, type FormValues } from './fields';

interface ItemEditorProps {
  item: ProfileItem;
  /**
   * Sends a PATCH body for this item. Only changed fields go up:
   * { payload } | { pinned } | { revertText: true } — never canonicalText
   * from the form (the server re-derives it; manual text edits are a
   * separate surface in the preview screen, Task 13).
   */
  onPatch: (body: Record<string, unknown>) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export default function ItemEditor({ item, onPatch, onDelete }: ItemEditorProps) {
  const defs = TYPE_FIELDS[item.type];
  const [values, setValues] = useState<FormValues>(() => payloadToForm(defs, item.payload));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const dirty = JSON.stringify(values) !== JSON.stringify(payloadToForm(defs, item.payload));

  const run = async (fn: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      // Surface the server's plain-language field hint when there is one
      // (e.g. "Please check these fields: end"); only mask truly unknown fails.
      setError(e instanceof Error && e.message ? e.message : 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const setValue = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }));

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {item.canonicalText.split('\n')[0].slice(0, 60)}
        </span>
        {item.provenance.length > 0 && (
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            Enhanced
          </span>
        )}
        {item.pinned && (
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            Pinned
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {defs.map((def) => (
          <div key={def.key} className={def.kind === 'textarea' || def.kind === 'lines' ? 'sm:col-span-2' : ''}>
            <label
              htmlFor={`item-${item.id}-${def.key}`}
              className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              {def.label}
            </label>
            {def.kind === 'textarea' || def.kind === 'lines' ? (
              <textarea
                id={`item-${item.id}-${def.key}`}
                rows={def.kind === 'lines' ? 4 : 3}
                value={values[def.key] ?? ''}
                onChange={(e) => setValue(def.key, e.target.value)}
                className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            ) : (
              <input
                id={`item-${item.id}-${def.key}`}
                type={def.kind === 'number' ? 'number' : 'text'}
                value={values[def.key] ?? ''}
                onChange={(e) => setValue(def.key, e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !dirty}
          onClick={() => run(() => onPatch({ payload: formToPayload(defs, values) }))}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>

        <button
          type="button"
          disabled={busy}
          aria-pressed={item.pinned}
          onClick={() => run(() => onPatch({ pinned: !item.pinned }))}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {item.pinned ? 'Unpin' : 'Pin'}
        </button>

        {item.provenance.length > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => onPatch({ revertText: true }))}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            title="Undo the accepted rewrite and restore the previous wording"
          >
            Revert wording
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(onDelete)}
            className="ml-auto rounded-md px-3 py-1.5 text-sm text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
