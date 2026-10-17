'use client';

import { useState } from 'react';
import type { SuggestionState } from '@/lib/domain/types';

export interface SuggestionRow {
  state: SuggestionState;
  originalText: string;
}

const OUTCOME_LABEL: Record<'accepted' | 'rejected' | 'edited', string> = {
  accepted: 'Accepted',
  rejected: 'Rejected',
  edited: 'Edited',
};

/**
 * Accept / Edit / Reject every rewrite and the composed headline. Pending
 * rows block export until dispositioned; dispositions are final per
 * generation (reword your profile later from the profile editor, where
 * every accepted change keeps an undo).
 */
export default function SuggestionReview({
  rows,
  busy,
  onDisposition,
}: {
  rows: SuggestionRow[];
  busy: boolean;
  onDisposition: (suggestionId: string, status: 'accepted' | 'rejected' | 'edited', finalText?: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  if (rows.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No suggestions — this CV uses your own wording throughout.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {rows.map(({ state, originalText }) => {
        const { suggestion, status, finalText } = state;
        const isSummary = suggestion.kind === 'summary';

        return (
          <li key={suggestion.id} className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              {isSummary ? 'Headline summary' : 'Bullet rewrite'}
            </p>

            {/* The struck-through line is the CURRENT doc text: meaningful
                while pending (what the suggestion would replace) and for a
                reject (what stands). For accepted/edited rows the doc holds
                the applied wording — showing it struck-through would lie —
                so the outcome line below carries the text instead. */}
            {(status === 'pending' || status === 'rejected') && (
              <p className="mt-2 text-sm leading-6 text-zinc-500 line-through decoration-zinc-300 dark:text-zinc-500 dark:decoration-zinc-700">
                {originalText}
              </p>
            )}

            {status === 'pending' ? (
              <>
                {editingId === suggestion.id ? (
                  <div className="mt-2">
                    <textarea
                      rows={3}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={busy || !draft.trim()}
                        onClick={() => {
                          setEditingId(null);
                          onDisposition(suggestion.id, 'edited', draft.trim()).catch(() => {});
                        }}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-2 text-sm leading-6 text-zinc-900 dark:text-zinc-50">
                      {suggestion.newText}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{suggestion.basis}</p>
                    <div className="mt-3 flex gap-2">
                      {/* Accept is always clickable — the quiet path must never block the primary one */}
                      <button
                        type="button"
                        onClick={() => onDisposition(suggestion.id, 'accepted').catch(() => {})}
                        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(suggestion.id);
                          setDraft(suggestion.newText);
                        }}
                        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onDisposition(suggestion.id, 'rejected').catch(() => {})}
                        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-950"
                      >
                        Reject
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={
                    status === 'rejected'
                      ? 'rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                      : 'rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  }
                >
                  {OUTCOME_LABEL[status]}
                </span>
                {status !== 'rejected' && finalText && (
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{finalText}</span>
                )}
                {status === 'rejected' && (
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">your original wording stands</span>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
