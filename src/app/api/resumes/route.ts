import { NextResponse, connection } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteClient } from '@/lib/db/client';
import { getSessionUser } from '@/lib/auth/session';
import { listResumes, toSummary } from '@/lib/db/resumes';
import { currentUsage, GENERATIONS_CAP } from '@/lib/db/quota';

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

    const [resumes, usage] = await Promise.all([
      listResumes(supabase, user.id),
      currentUsage(supabase, user.id),
    ]);
    // Summaries only: full docs belong to the by-id endpoint (see ResumeSummary).
    // Quota rides along so the dashboard shows the server's ledger — deleting a
    // CV does not refund a generation, and the month boundary is UTC.
    return NextResponse.json(
      {
        resumes: resumes.map(toSummary),
        quota: { used: usage.generations, cap: GENERATIONS_CAP },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Resume list error:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
