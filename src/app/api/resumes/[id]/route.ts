import { NextResponse, connection } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/db/client';
import { getSessionUser } from '@/lib/auth/session';
import { getResume } from '@/lib/db/resumes';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Session-cookie read is request-only; stop build prerender here (before the
  // try/catch) so Next's prerender-termination signal isn't caught as a 500.
  await connection();
  try {
    // 1. Session check
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { id } = await params;

    const cookieStore = await cookies();
    const supabase = await createServerClient(
      () => cookieStore.getAll().map(c => ({ name: c.name, value: c.value })),
      (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options as any);
        });
      }
    );

    // RLS scopes reads to the session user; a foreign/nonexistent id both yield null → 404
    const resume = await getResume(supabase, id);

    if (!resume) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Resume not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ resume }, { status: 200 });
  } catch (error) {
    console.error('Resume retrieval error:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
