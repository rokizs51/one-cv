import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteClient } from '@/lib/db/client';
import { getSessionUser } from '@/lib/auth/session';
import { getOrCreateProfile } from '@/lib/db/profiles';
import { listItems } from '@/lib/db/items';
import { getAnalysis, saveAnalysisResult } from '@/lib/db/analyses';
import { computeProfileFingerprint, rebuildSummary } from '@/lib/match/analyze';
import type { MatchStatus } from '@/lib/match/match-types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function notFound() {
  return NextResponse.json(
    { error: { code: 'not_found', message: 'Analysis not found' } },
    { status: 404 }
  );
}

/**
 * GET /api/analyses/:id — the persisted snapshot plus an honest `stale`
 * flag: results never silently masquerade as current after a profile edit.
 */
export async function GET(
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
    if (!UUID_RE.test(id)) return notFound();

    const cookieStore = await cookies();
    const supabase = await createRouteClient(cookieStore);
    const analysis = await getAnalysis(supabase, id); // RLS: foreign ids → null
    if (!analysis) return notFound();

    let stale = false;
    if (analysis.status === 'completed' && analysis.result) {
      const profile = await getOrCreateProfile(supabase, user.id);
      const items = await listItems(supabase, profile.id);
      stale = computeProfileFingerprint(items) !== analysis.profileFingerprint;
    }

    return NextResponse.json({ analysis, stale }, { status: 200 });
  } catch (error) {
    console.error('Analysis get error:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/analyses/:id {requirementId, status, note?}
 * The explicit user-confirmation workflow: a human can settle an ambiguous
 * machine verdict (needs_review/partial → supported) or mark a requirement
 * not applicable, with a note recorded inside the snapshot. It never touches
 * `not_established` — that verdict is corrected by adding profile evidence
 * and rerunning, not by clicking.
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
    if (!UUID_RE.test(id)) return notFound();

    let body: { requirementId?: unknown; status?: unknown; note?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const { requirementId, status, note } = body;
    if (typeof requirementId !== 'string' || requirementId.trim() === '') {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Field "requirementId" must be a non-empty string' } },
        { status: 400 }
      );
    }
    // Confirmations may only land on statuses a human can actually assert.
    const CONFIRMABLE: MatchStatus[] = ['supported', 'not_applicable'];
    if (!CONFIRMABLE.includes(status as MatchStatus)) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Field "status" must be "supported" or "not_applicable"' } },
        { status: 400 }
      );
    }
    if (note !== undefined && typeof note !== 'string') {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Field "note" must be a string' } },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = await createRouteClient(cookieStore);
    const analysis = await getAnalysis(supabase, id);
    if (!analysis) return notFound();
    if (analysis.status !== 'completed' || !analysis.result) {
      return NextResponse.json(
        { error: { code: 'not_completed', message: 'Only a completed analysis can be updated' } },
        { status: 409 }
      );
    }

    const result = analysis.result;
    const match = result.matches.find((m) => m.requirementId === requirementId);
    if (!match) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'That requirement is not part of this analysis' } },
        { status: 404 }
      );
    }
    if (match.status === 'not_established') {
      return NextResponse.json(
        {
          error: {
            code: 'cannot_confirm',
            message:
              'This profile shows no evidence for the requirement. Add the evidence to your profile and rerun the analysis — a click cannot invent it.',
          },
        },
        { status: 409 }
      );
    }

    const updatedMatches = result.matches.map((m) =>
      m.requirementId === requirementId
        ? {
            ...m,
            userConfirmation: {
              status: status as MatchStatus,
              note: typeof note === 'string' ? note.trim() : '',
              at: new Date().toISOString(),
            },
          }
        : m
    );

    const updated = {
      requirements: result.requirements,
      matches: updatedMatches,
      summary: rebuildSummary({ requirements: result.requirements, matches: updatedMatches, summary: result.summary }),
    };
    await saveAnalysisResult(supabase, id, updated);

    return NextResponse.json(
      { analysis: { ...analysis, result: updated }, stale: false },
      { status: 200 }
    );
  } catch (error) {
    console.error('Analysis patch error:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
