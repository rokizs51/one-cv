import { NextResponse, connection } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteClient } from '@/lib/db/client';
import { getSessionUser } from '@/lib/auth/session';
import { getResume } from '@/lib/db/resumes';
import { renderResumePdf } from '@/lib/resume/render/render';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/resumes/:id/pdf
 * Renders the stored doc with the SAME @react-pdf component the on-screen
 * preview uses — what you see is what you submit. Hard anti-goal gate:
 * nothing exports while ANY suggestion is still pending. Exporting does not
 * consume generation quota.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Request-only (session read); see resumes/route.ts.
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
    const resume = await getResume(supabase, id);
    if (!resume) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Resume not found' } },
        { status: 404 }
      );
    }

    // Anti-goal gate: never export unaccepted suggestions.
    const pending = resume.statuses.filter((s) => s.status === 'pending');
    if (pending.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: 'pending_suggestions',
            message: `Accept, edit, or reject all ${pending.length} pending suggestion${pending.length === 1 ? '' : 's'} before exporting.`,
          },
        },
        { status: 409 }
      );
    }

    const bytes = await renderResumePdf(resume.doc, resume.pageLimit);

    return new NextResponse(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="resume-${id.slice(0, 8)}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Resume PDF export error:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
