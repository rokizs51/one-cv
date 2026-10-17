import { NextResponse, connection } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteClient } from '@/lib/db/client';
import { getSessionUser } from '@/lib/auth/session';
import { listResumes } from '@/lib/db/resumes';

export async function GET() {
  // This reads the session cookie, so it's request-only: terminate any build
  // prerender here (before the try/catch) rather than letting Next's
  // prerender-termination signal be caught and logged as a 500.
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

    const cookieStore = await cookies();
    const supabase = await createRouteClient(cookieStore);

    const resumes = await listResumes(supabase, user.id);
    return NextResponse.json({ resumes }, { status: 200 });
  } catch (error) {
    console.error('Resume list error:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
