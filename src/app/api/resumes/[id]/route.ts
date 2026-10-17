import { NextResponse, connection } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteClient } from '@/lib/db/client';
import { getSessionUser } from '@/lib/auth/session';
import { getResume, updateResumeFields } from '@/lib/db/resumes';
import { getJd } from '@/lib/db/jds';
import { getItem, acceptText } from '@/lib/db/items';
import type { ResumeDoc, SuggestionState } from '@/lib/domain/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TERMINAL = ['accepted', 'rejected', 'edited'] as const;

async function loadWithExtraction(supa: Awaited<ReturnType<typeof createRouteClient>>, resumeId: string) {
  const resume = await getResume(supa, resumeId);
  if (!resume) return null;
  const jd = await getJd(supa, resume.jdId);
  return { resume, extraction: jd?.extraction ?? null };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Session-cookie read is request-only; stop build prerender before the
  // try/catch (see resumes/route.ts).
  await connection();
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Resume id must be a valid identifier' } },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = await createRouteClient(cookieStore);

    // RLS scopes reads to the session user; foreign/nonexistent ids → 404.
    // Extraction ships along for the "why this matched" panel.
    const payload = await loadWithExtraction(supabase, id);
    if (!payload) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Resume not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error('Resume retrieval error:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/resumes/:id
 * Body (either arm, or both):
 *  - { pageLimit: 1 | 2 }                      — the honest "won't fit" escape hatch
 *  - { suggestionId, status: 'accepted'|'rejected'|'edited', finalText? }
 *      accepted/rejected flip the suggestion's disposition; 'edited' requires
 *      finalText. Accepted/edited text enters the doc AND — for BULLET
 *      suggestions only — flows into the profile as canonical wording with
 *      provenance (compounding asset). A composed SUMMARY is accepted wording
 *      for THIS CV only: the spec forbids composition from overwriting the
 *      user's own career snapshot.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Resume id must be a valid identifier' } },
        { status: 400 }
      );
    }

    let body: { suggestionId?: unknown; status?: unknown; finalText?: unknown; pageLimit?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = await createRouteClient(cookieStore);

    const resume = await getResume(supabase, id);
    if (!resume) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Resume not found' } },
        { status: 404 }
      );
    }

    const patch: Parameters<typeof updateResumeFields>[2] = {};

    // --- page-limit arm -------------------------------------------------
    if (body.pageLimit !== undefined) {
      if (body.pageLimit !== 1 && body.pageLimit !== 2) {
        return NextResponse.json(
          { error: { code: 'invalid_request', message: 'Field "pageLimit" must be 1 or 2' } },
          { status: 400 }
        );
      }
      patch.pageLimit = body.pageLimit;
    }

    // --- suggestion disposition arm --------------------------------------
    if (body.suggestionId !== undefined || body.status !== undefined) {
      if (typeof body.suggestionId !== 'string' || typeof body.status !== 'string') {
        return NextResponse.json(
          { error: { code: 'invalid_request', message: 'Fields "suggestionId" and "status" are required together' } },
          { status: 400 }
        );
      }
      if (!(TERMINAL as readonly string[]).includes(body.status)) {
        return NextResponse.json(
          { error: { code: 'invalid_request', message: 'Unknown disposition status' } },
          { status: 400 }
        );
      }
      const status = body.status as (typeof TERMINAL)[number];

      const idx = resume.statuses.findIndex((s) => s.suggestion.id === body.suggestionId);
      if (idx === -1) {
        return NextResponse.json(
          { error: { code: 'not_found', message: 'Suggestion not found on this resume' } },
          { status: 404 }
        );
      }
      if (resume.statuses[idx].status !== 'pending') {
        // Processing is final per generation: never silently re-apply.
        return NextResponse.json(
          { error: { code: 'already_dispositioned', message: 'That suggestion was already accepted, edited, or rejected' } },
          { status: 409 }
        );
      }

      const entry: SuggestionState = { ...resume.statuses[idx] };
      let applied: string | null = null;

      if (status === 'rejected') {
        entry.status = 'rejected';
        entry.finalText = null; // doc keeps the original wording
      } else {
        const text =
          status === 'edited'
            ? typeof body.finalText === 'string' && body.finalText.trim()
              ? body.finalText.trim()
              : null
            : entry.suggestion.newText;
        if (text === null) {
          return NextResponse.json(
            { error: { code: 'invalid_request', message: 'An edited suggestion needs new text' } },
            { status: 400 }
          );
        }
        entry.status = status;
        entry.finalText = text;
        applied = text;
      }

      if (applied !== null) {
        const doc: ResumeDoc = structuredClone(resume.doc);
        const sug = entry.suggestion;
        if (sug.kind === 'summary') {
          // CV-local headline text; the profile's own career snapshot is
          // deliberately NOT written (spec: "The snapshot itself is never
          // overwritten by composition").
          doc.summary = applied;
        } else {
          let hit = false;
          for (const section of doc.sections) {
            for (const item of section.items) {
              if (item.sourceItemId === sug.targetItemId) {
                item.text = applied;
                hit = true;
              }
            }
          }
          if (!hit) {
            return NextResponse.json(
              { error: { code: 'not_found', message: 'The suggested line is no longer in this CV' } },
              { status: 409 }
            );
          }
        }
        patch.doc = doc;

        // Compounding asset: accepted bullet wording flows back into the
        // profile (original preserved under provenance, one-click revert).
        if (status === 'accepted' && sug.kind === 'bullet') {
          const profileItem = await getItem(supabase, sug.targetItemId);
          if (profileItem) {
            await acceptText(supabase, sug.targetItemId, profileItem, applied, id);
          }
        }
      }

      const nextStatuses = [...resume.statuses];
      nextStatuses[idx] = entry;
      patch.statuses = nextStatuses;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Nothing to update was sent' } },
        { status: 400 }
      );
    }

    await updateResumeFields(supabase, id, patch);
    const payload = await loadWithExtraction(supabase, id);
    if (!payload) {
      // Saved moments ago under our own session; vanishing mid-request is a
      // server-side anomaly, not the user's 404.
      return NextResponse.json(
        { error: { code: 'internal_error', message: 'An unexpected error occurred' } },
        { status: 500 }
      );
    }
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error('Resume update error:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
