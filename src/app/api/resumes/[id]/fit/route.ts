import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteClient } from '@/lib/db/client';
import { getSessionUser } from '@/lib/auth/session';
import { getResume } from '@/lib/db/resumes';
import { refitFromDoc } from '@/lib/resume/refit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/resumes/:id/fit  { userEdits?: {itemId: text}, pageLimit?: 1|2 }
 * Advisory live recompute (Review Focus 3): re-scores and re-fits with the
 * caller's pending text edits applied, WITHOUT writing anything — persisted
 * recomputation happens inside PATCH dispositions. Pinned items are never
 * dropped; when they alone exceed the page (with the summary's reserved
 * lines counted), the response says so honestly via
 * { overflow: true, code: 'wont_fit' } and the UI offers un-pin / 2 pages.
 */
export async function POST(
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

    let body: { userEdits?: unknown; pageLimit?: unknown };
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const userEdits: Record<string, string> =
      body.userEdits && typeof body.userEdits === 'object' && !Array.isArray(body.userEdits)
        ? Object.fromEntries(
            Object.entries(body.userEdits as Record<string, unknown>)
              .filter(([, v]) => typeof v === 'string')
              .map(([k, v]) => [k, v as string])
          )
        : {};

    const cookieStore = await cookies();
    const supabase = await createRouteClient(cookieStore);

    const resume = await getResume(supabase, id);
    if (!resume) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Resume not found' } },
        { status: 404 }
      );
    }

    const pageLimit = body.pageLimit === 2 ? 2 : body.pageLimit === 1 ? 1 : resume.pageLimit;
    const outcome = await refitFromDoc(supabase, user.id, {
      doc: resume.doc,
      jdId: resume.jdId,
      pageLimit,
      userEdits,
    });
    if (!outcome) {
      return NextResponse.json(
        {
          error: {
            code: 'not_found',
            message: 'The job description behind this CV is gone, so matching cannot be recomputed.',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        fit: outcome.fit,
        cuts: outcome.cuts,
        overflow: outcome.overflow,
        ...(outcome.overflow ? { code: 'wont_fit' } : {}),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Resume refit error:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
