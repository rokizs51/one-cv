'use client';

import { useState } from 'react';
import { Check, PenNib, X } from '@phosphor-icons/react';
import type { SuggestionState } from '@/lib/domain/types';
import Card from '@/components/ui/card';
import Chip from '@/components/ui/chip';
import { Button } from '@/components/ui/button';

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
      <p className="rounded-2xl bg-wash-green px-4 py-3 text-sm text-tone-green">
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
          <li key={suggestion.id}>
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">
                {isSummary ? 'Headline summary' : 'Bullet rewrite'}
              </p>

              {/* The struck-through line is the CURRENT doc text: meaningful
                  while pending (what the suggestion would replace) and for a
                  reject (what stands). For accepted/edited rows the doc holds
                  the applied wording — showing it struck-through would lie —
                  so the outcome line below carries the text instead. */}
              {(status === 'pending' || status === 'rejected') && (
                <p className="mt-2 text-sm leading-6 text-mute line-through decoration-line-2">
                  {originalText}
                </p>
              )}

              {status === 'pending' ? (
                editingId === suggestion.id ? (
                  <div className="mt-3">
                    <textarea
                      rows={3}
                      aria-label="Suggested wording"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="w-full resize-y rounded-2xl border border-line-2 bg-surface px-4 py-3 text-sm text-ink transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        disabled={busy || !draft.trim()}
                        onClick={() => {
                          setEditingId(null);
                          onDisposition(suggestion.id, 'edited', draft.trim()).catch(() => {});
                        }}
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-2 text-sm leading-6 text-ink">{suggestion.newText}</p>
                    <p className="mt-1 text-xs text-mute">{suggestion.basis}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {/* Accept is always clickable — the quiet path must never block the primary one */}
                      <Button
                        size="sm"
                        onClick={() => onDisposition(suggestion.id, 'accepted').catch(() => {})}
                      >
                        <Check aria-hidden size={14} weight="bold" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(suggestion.id);
                          setDraft(suggestion.newText);
                        }}
                      >
                        <PenNib aria-hidden size={14} />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busy}
                        onClick={() => onDisposition(suggestion.id, 'rejected').catch(() => {})}
                      >
                        <X aria-hidden size={14} weight="bold" />
                        Reject
                      </Button>
                    </div>
                  </>
                )
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Chip tone={status === 'accepted' ? 'green' : status === 'edited' ? 'blue' : 'neutral'}>
                    {OUTCOME_LABEL[status]}
                  </Chip>
                  {status !== 'rejected' && finalText && (
                    <span className="text-sm text-ink">{finalText}</span>
                  )}
                  {status === 'rejected' && (
                    <span className="text-sm text-mute">your original wording stands</span>
                  )}
                </div>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
