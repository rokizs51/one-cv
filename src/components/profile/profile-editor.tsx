'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ItemType, ProfileItem } from '@/lib/domain/types';
import ItemEditor from './item-editor';
import SectionForm from './section-form';
import { TYPE_LABELS } from './fields';

interface Personal {
  fullName: string;
  email: string;
  phone: string | null;
  location: string | null;
  links: string[];
}

// Editor groups in profile-building order (not CV order — ordering of CV
// sections is the fit engine's job).
const SECTION_ORDER: ItemType[] = [
  'career_snapshot',
  'experience',
  'project',
  'education',
  'skill',
  'award',
  'language',
];

export default function ProfileEditor() {
  const [items, setItems] = useState<ProfileItem[] | null>(null);
  const [personal, setPersonal] = useState<Personal | null>(null);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    const [pRes, iRes] = await Promise.all([
      fetch('/api/profile'),
      fetch('/api/profile/items'),
    ]);
    if (!pRes.ok || !iRes.ok) {
      setLoadError('Could not load your profile. Please sign in again.');
      return;
    }
    const pData = await pRes.json();
    const iData = await iRes.json();
    setPersonal(pData.profile.personal);
    setItems(iData.items);
  }, []);

  useEffect(() => {
    load().catch(() => setLoadError('Could not load your profile. Please sign in again.'));
  }, [load]);

  const patchItem = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/profile/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json())?.error?.message ?? 'save failed');
    await load();
  };

  const deleteItem = async (id: string) => {
    const res = await fetch(`/api/profile/items/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('delete failed');
    await load();
  };

  const createItem = async (type: ItemType, payload: Record<string, unknown>) => {
    const res = await fetch('/api/profile/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    });
    if (!res.ok) throw new Error((await res.json())?.error?.message ?? 'create failed');
    await load();
  };

  if (loadError) {
    return <p role="alert" className="text-sm text-red-600 dark:text-red-400">{loadError}</p>;
  }
  if (!items || !personal) {
    return <p className="text-sm text-zinc-500">Loading your profile…</p>;
  }

  const byType = (t: ItemType) => items.filter((i) => i.type === t);

  return (
    <div className="space-y-10">
      <PersonalSection personal={personal} onSaved={load} />

      {SECTION_ORDER.map((type) => {
        const sectionItems = byType(type);
        return (
          <section key={type}>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {TYPE_LABELS[type]}
            </h2>
            {type !== 'career_snapshot' && sectionItems.length === 0 && (
              <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
                Nothing here yet — add what applies to you.
              </p>
            )}
            {type === 'career_snapshot' && sectionItems.length === 0 && (
              <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
                One or two lines about who you are professionally. Your CV headline is built from this.
              </p>
            )}
            <div className="space-y-3">
              {sectionItems.map((item) => (
                <ItemEditor
                  key={item.id}
                  item={item}
                  onPatch={(body) => patchItem(item.id, body)}
                  onDelete={type === 'career_snapshot' && sectionItems.length === 1 ? undefined : () => deleteItem(item.id)}
                />
              ))}
            </div>
            {(type !== 'career_snapshot' || sectionItems.length === 0) && (
              <div className="mt-3">
                <SectionForm type={type} onCreate={(payload) => createItem(type, payload)} />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function PersonalSection({ personal, onSaved }: { personal: Personal; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({
    fullName: personal.fullName,
    email: personal.email,
    phone: personal.phone ?? '',
    location: personal.location ?? '',
    links: personal.links.join(', '),
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personal: {
            fullName: form.fullName,
            email: form.email,
            phone: form.phone || null,
            location: form.location || null,
            links: form.links.split(',').map((s) => s.trim()).filter(Boolean),
          },
        }),
      });
      if (!res.ok) {
        setError('Please enter at least your name and a valid email.');
        return;
      }
      setSaved(true);
      await onSaved();
    } catch {
      setError('Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof typeof form, label: string, type = 'text') => (
    <div>
      <label htmlFor={`personal-${key}`} className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </label>
      <input
        id={`personal-${key}`}
        type={type}
        value={form[key]}
        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />
    </div>
  );

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Your details
      </h2>
      <div className="grid grid-cols-1 gap-3 rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2">
        {field('fullName', 'Full name')}
        {field('email', 'Email', 'email')}
        {field('phone', 'Phone (optional)')}
        {field('location', 'Location (optional)')}
        <div className="sm:col-span-2">{field('links', 'Links, comma separated (GitHub, LinkedIn…)', 'text')}</div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
          {saved && <span className="text-sm text-green-700 dark:text-green-400">Saved.</span>}
          {error && <span role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</span>}
        </div>
      </div>
    </section>
  );
}
