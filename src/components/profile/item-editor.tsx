'use client';

import { useState } from 'react';
import { PushPin, ArrowUUpLeft } from '@phosphor-icons/react';
import type { ProfileItem } from '@/lib/domain/types';
import { TYPE_FIELDS, payloadToForm, formToPayload, type FormValues } from './fields';
import Card from '@/components/ui/card';
import Chip from '@/components/ui/chip';
import { Button } from '@/components/ui/button';

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

const inputCls =
  'w-full  border border-line-2 bg-surface px-4 py-2 text-sm text-ink transition-colors placeholder:text-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';
const textareaCls =
  'w-full resize-y  border border-line-2 bg-surface px-4 py-3 text-sm text-ink transition-colors placeholder:text-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30';

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
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-ink">
          {item.canonicalText.split('\n')[0].slice(0, 60)}
        </span>
        {item.provenance.length > 0 && <Chip>Enhanced</Chip>}
        {item.pinned && (
          <Chip tone="amber">
            <PushPin aria-hidden size={11} weight="fill" />
            Pinned
          </Chip>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {defs.map((def) => (
          <div key={def.key} className={def.kind === 'textarea' || def.kind === 'lines' ? 'sm:col-span-2' : ''}>
            <label
              htmlFor={`item-${item.id}-${def.key}`}
              className="mb-1 block text-xs font-medium text-mute"
            >
              {def.label}
            </label>
            {def.kind === 'textarea' || def.kind === 'lines' ? (
              <textarea
                id={`item-${item.id}-${def.key}`}
                rows={def.kind === 'lines' ? 4 : 3}
                value={values[def.key] ?? ''}
                onChange={(e) => setValue(def.key, e.target.value)}
                className={textareaCls}
              />
            ) : (
              <input
                id={`item-${item.id}-${def.key}`}
                type={def.kind === 'number' ? 'number' : 'text'}
                value={values[def.key] ?? ''}
                onChange={(e) => setValue(def.key, e.target.value)}
                className={inputCls}
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div role="alert" className="mt-3  bg-wash-red px-3 py-2 text-sm text-tone-red">
          {error}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy || !dirty} onClick={() => run(() => onPatch({ payload: formToPayload(defs, values) }))}>
          Save
        </Button>

        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          aria-pressed={item.pinned}
          onClick={() => run(() => onPatch({ pinned: !item.pinned }))}
        >
          <PushPin aria-hidden size={14} weight={item.pinned ? 'fill' : 'regular'} />
          {item.pinned ? 'Unpin' : 'Pin'}
        </Button>

        {item.provenance.length > 0 && (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => run(() => onPatch({ revertText: true }))}
            title="Undo the accepted rewrite and restore the previous wording"
          >
            <ArrowUUpLeft aria-hidden size={14} />
            Revert wording
          </Button>
        )}

        {onDelete && (
          <Button
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={() => run(onDelete)}
            className="ml-auto"
          >
            Delete
          </Button>
        )}
      </div>
    </Card>
  );
}
