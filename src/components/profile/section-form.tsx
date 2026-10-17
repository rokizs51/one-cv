'use client';

import { useState } from 'react';
import type { ItemType } from '@/lib/domain/types';
import { TYPE_FIELDS, TYPE_LABELS, formToPayload, type FormValues } from './fields';

interface SectionFormProps {
  type: ItemType;
  onCreate: (payload: Record<string, unknown>) => Promise<void>;
}

/**
 * Collapsed "Add …" row that expands into plain-language fields for one
 * entry of this section's type. Validation lives server-side (strict zod);
 * failures surface inline.
 */
export default function SectionForm({ type, onCreate }: SectionFormProps) {
  const defs = TYPE_FIELDS[type];
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<FormValues>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      await onCreate(formToPayload(defs, values));
      setValues({});
      setOpen(false);
    } catch {
      setError('Could not add this entry. Check the fields and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        Add {TYPE_LABELS[type].toLowerCase()}
      </button>
    );
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {defs.map((def) => (
          <div key={def.key} className={def.kind === 'textarea' || def.kind === 'lines' ? 'sm:col-span-2' : ''}>
            <label
              htmlFor={`add-${type}-${def.key}`}
              className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              {def.label}
            </label>
            {def.kind === 'textarea' || def.kind === 'lines' ? (
              <textarea
                id={`add-${type}-${def.key}`}
                rows={3}
                value={values[def.key] ?? ''}
                onChange={(e) => setValues((p) => ({ ...p, [def.key]: e.target.value }))}
                className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            ) : (
              <input
                id={`add-${type}-${def.key}`}
                type={def.kind === 'number' ? 'number' : 'text'}
                value={values[def.key] ?? ''}
                onChange={(e) => setValues((p) => ({ ...p, [def.key]: e.target.value }))}
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

      <div className="mt-3 flex gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? 'Adding…' : 'Add'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
