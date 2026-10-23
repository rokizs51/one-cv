import { NextResponse, connection } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteClient } from '@/lib/db/client';
import { getSessionUser } from '@/lib/auth/session';
import { getResume, updateResumeFields, deleteResume } from '@/lib/db/resumes';
import { getJd } from '@/lib/db/jds';
import { getItem, acceptText } from '@/lib/db/items';
import { preserveHeaderLines } from '@/lib/ai/client';
import { normalizeManualText, structureFromText } from '@/lib/domain/canonical';
import { refitFromDoc } from '@/lib/resume/refit';
import type { JdExtraction, ResumeDoc, SuggestionState } from '@/lib/domain/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TERMINAL = ['accepted', 'rejected', 'edited'] as const;

async function loadWithExtraction(supa: Awaited<ReturnType<typeof createRouteClient>>, resumeId: string) {
  // The resume itself is critical (errors propagate → 500); the extraction is
  // advisory panel data — a JD read failure must not 500 an intact CV.
  const resume = await getResume(supa, resumeId);
  if (!resume) return null;
  let extraction = null as JdExtraction | null;
  try {
    const jd = await getJd(supa, resume.jdId);
    extraction = jd?.extraction ?? null;
  } catch {
    extraction = null;
  }
  return { resume, extraction };
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
 * DELETE /api/resumes/:id — permanently remove this stored CV. The profile
 * items it drew from (and any accepted wording compounded into them) stay.
 */
export async function DELETE(
  _request: Request,
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

    const cookieStore = await cookies();
    const supabase = await createRouteClient(cookieStore);

    const resume = await getResume(supabase, id);
    if (!resume) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Resume not found' } },
        { status: 404 }
      );
    }

    await deleteResume(supabase, id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('Resume delete error:', error);
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
 *  - { suggestionId, status: 'accepted'|'rejected'|'edited', finalText? }  or
 *    { dispositions: [same shape, …] }         — one decision or the whole
 *      deferred review batch; a batch validates every entry before anything
 *      is written and lands in a single resume update.
 *      Accepted/rejected flip the suggestion's disposition; 'edited' requires
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

    let body: {
      suggestionId?: unknown;
      status?: unknown;
      finalText?: unknown;
      pageLimit?: unknown;
      dispositions?: unknown;
    };
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

    // --- suggestion disposition arm (single or batch) ---------------------
    if (body.dispositions !== undefined && !Array.isArray(body.dispositions)) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Field "dispositions" must be an array' } },
        { status: 400 }
      );
    }
    type Disposal = { suggestionId?: unknown; status?: unknown; finalText?: unknown };
    const disposals: Disposal[] = Array.isArray(body.dispositions)
      ? (body.dispositions as Disposal[])
      : body.suggestionId !== undefined || body.status !== undefined
        ? [{ suggestionId: body.suggestionId, status: body.status, finalText: body.finalText }]
        : [];
    // shortcut: cap matches the largest realistic suggestion count; raise if a
    // generation ever exceeds 50 suggestions.
    if (disposals.length > 50) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Send at most 50 dispositions per request' } },
        { status: 400 }
      );
    }

    if (disposals.length > 0) {
      const nextStatuses = [...resume.statuses];
      let nextDoc: ResumeDoc | null = null;
      const toCompound: { itemId: string; text: string }[] = [];

      // Stage every decision first: an invalid entry 4xx/409s before any
      // write, so one bad tap in the batch cannot half-apply the review.
      for (const d of disposals) {
        if (typeof d.suggestionId !== 'string' || typeof d.status !== 'string') {
          return NextResponse.json(
            { error: { code: 'invalid_request', message: 'Fields "suggestionId" and "status" are required together' } },
            { status: 400 }
          );
        }
        if (!(TERMINAL as readonly string[]).includes(d.status)) {
          return NextResponse.json(
            { error: { code: 'invalid_request', message: 'Unknown disposition status' } },
            { status: 400 }
          );
        }
        const status = d.status as (typeof TERMINAL)[number];

        const idx = nextStatuses.findIndex((s) => s.suggestion.id === d.suggestionId);
        if (idx === -1) {
          return NextResponse.json(
            { error: { code: 'not_found', message: 'Suggestion not found on this resume' } },
            { status: 404 }
          );
        }
        if (nextStatuses[idx].status !== 'pending') {
          // Processing is final per generation: never silently re-apply.
          // (Also rejects a suggestionId repeated inside this batch.)
          return NextResponse.json(
            { error: { code: 'already_dispositioned', message: 'That suggestion was already accepted, edited, or rejected' } },
            { status: 409 }
          );
        }

        const entry: SuggestionState = { ...nextStatuses[idx] };
        let applied: string | null = null;

        if (status === 'rejected') {
          entry.status = 'rejected';
          entry.finalText = null; // doc keeps the original wording
        } else {
          const text =
            status === 'edited'
              ? typeof d.finalText === 'string' && d.finalText.trim()
                ? d.finalText.trim()
                : null
              : entry.suggestion.newText;
          if (text === null) {
            return NextResponse.json(
              { error: { code: 'invalid_request', message: 'An edited suggestion needs new text' } },
              { status: 400 }
            );
          }
          entry.status = status;
          // One marker rule at this boundary too: accepted/edited wording is
          // stored bullet-marker-free and flows back into the profile item.
          entry.finalText = normalizeManualText(text);
          applied = entry.finalText;
        }

        if (applied !== null) {
          if (nextDoc === null) nextDoc = structuredClone(resume.doc);
          const sug = entry.suggestion;
          if (sug.kind === 'summary') {
            // CV-local headline text; the profile's own career snapshot is
            // deliberately NOT written (spec: "The snapshot itself is never
            // overwritten by composition").
            nextDoc.summary = applied;
          } else {
            let hit = false;
            for (const section of nextDoc.sections) {
              for (const item of section.items) {
                if (item.sourceItemId === sug.targetItemId) {
                  // Suggestions generated before the enhance header guard (or
                  // flattened by the model) can drop the "Role — Company
                  // (dates)" line — restore it from the doc's current text
                  // before it overwrites the CV and the profile item.
                  applied = preserveHeaderLines(
                    [{ targetItemId: sug.targetItemId, newText: applied }],
                    [{ itemId: sug.targetItemId, text: item.text }]
                  )[0].newText;
                  entry.finalText = applied;
                  item.text = applied;
                  // Keep the typed fields the PDF draws in sync with the
                  // accepted wording (the header line is restored above).
                  Object.assign(item, structureFromText(section.id, applied));
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
            if (status === 'accepted') toCompound.push({ itemId: sug.targetItemId, text: applied });
          }
        }

        nextStatuses[idx] = entry;
      }

      // Compounding asset: accepted bullet wording flows back into the
      // profile (original preserved under provenance, one-click revert).
      // The canonicalText guard makes accept near-idempotent: if the
      // resume-write below fails after these calls, a still-pending retry
      // lands the doc change WITHOUT double-compounding the provenance
      // chain (a duplicated {text:A, original:A} entry would silently
      // defeat the promised one-click revert).
      for (const c of toCompound) {
        const profileItem = await getItem(supabase, c.itemId);
        if (profileItem && profileItem.canonicalText !== c.text) {
          await acceptText(supabase, c.itemId, profileItem, c.text, id);
        }
      }

      if (nextDoc !== null) patch.doc = nextDoc;
      patch.statuses = nextStatuses;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Nothing to update was sent' } },
        { status: 400 }
      );
    }

    // Spec: "every edit re-runs the fit computation and updates the cut list
    // live." When a disposition changes the doc or the page limit flips,
    // recompute fit against the doc as it now reads and persist it, so the
    // stored snapshot, the banner, and a later reload all agree with the PDF.
    // Advisory: if the JD is unreadable we keep the prior stored fit rather
    // than failing the disposition.
    if (patch.doc !== undefined || patch.pageLimit !== undefined) {
      const refit = await refitFromDoc(supabase, user.id, {
        doc: (patch.doc as ResumeDoc) ?? resume.doc,
        jdId: resume.jdId,
        pageLimit: (patch.pageLimit as 1 | 2) ?? resume.pageLimit,
      });
      if (refit) patch.fit = refit.fit;
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
