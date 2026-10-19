import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteClient } from '@/lib/db/client';
import { getSessionUser } from '@/lib/auth/session';
import { getJd } from '@/lib/db/jds';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/jds/:id — load a stored JD (deep-links into the wizard and the
 * analysis view need it). Ownership is the RLS story: foreign ids read null.
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
    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Job description not found' } },
        { status: 404 }
      );
    }

    const cookieStore = await cookies();
    const supabase = await createRouteClient(cookieStore);
    const jd = await getJd(supabase, id);
    if (!jd) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Job description not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ jd }, { status: 200 });
  } catch (error) {
    console.error('JD get error:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
