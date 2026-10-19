import { NextResponse, connection } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteClient } from '@/lib/db/client';
import { getSessionUser } from '@/lib/auth/session';
import { getOrCreateProfile } from '@/lib/db/profiles';
import { listItems } from '@/lib/db/items';
import { listJds } from '@/lib/db/jds';
import { listResumes } from '@/lib/db/resumes';
import { deleteCurrentAccount } from '@/lib/db/account';
import { monthKey } from '@/lib/db/quota';

/**
 * Settings backend (spec: deletion + JSON export ship in v1).
 * RLS makes every read/write here owner-scoped; DELETE delegates the full
 * cascade (incl. the auth account) to the delete_current_user RPC.
 */

async function guard() {
  const user = await getSessionUser();
  if (!user) {
    return { user: null, supabase: null };
  }
  const cookieStore = await cookies();
  const supabase = await createRouteClient(cookieStore);
  return { user, supabase };
}

export async function GET() {
  // Owner-scoped data read → request-only (see resumes/route.ts).
  await connection();
  try {
    const { user, supabase } = await guard();
    if (!user || !supabase) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const profile = await getOrCreateProfile(supabase, user.id);
    const [items, jds, resumes] = await Promise.all([
      listItems(supabase, profile.id),
      listJds(supabase, user.id),
      listResumes(supabase, user.id),
    ]);

    const body = {
      exported_at: new Date().toISOString(),
      month: monthKey(new Date()),
      profile: { id: profile.id, personal: profile.personal },
      profile_items: items,
      job_descriptions: jds,
      generated_resumes: resumes,
    };

    return new NextResponse(JSON.stringify(body, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="sever-export-${body.month}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Account export error:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const { user, supabase } = await guard();
    if (!user || !supabase) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // getSessionUser() above is the fresh getUser() check the plan requires —
    // it validates the JWT with the auth server, not just the cookie.
    await deleteCurrentAccount(supabase);
    await supabase.auth.signOut();

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('Account delete error:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
