import { NextResponse, connection } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteClient } from '@/lib/db/client';
import { getSessionUser } from '@/lib/auth/session';
import { getOrCreateProfile, updatePersonal } from '@/lib/db/profiles';
import type { PersonalInfo } from '@/lib/db/profiles';
import { PersonalInfoSchema } from '@/lib/domain/schemas';

export async function GET() {
  // Session read → request-only (see resumes/route.ts for rationale).
  await connection();
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const cookieStore = await cookies();
    const supabase = await createRouteClient(cookieStore);
    const profile = await getOrCreateProfile(supabase, user.id);

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    let body: { personal?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const parsed = PersonalInfoSchema.safeParse(body.personal);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'invalid_payload',
            message: 'Your name and a valid email are required. Phone and location are optional.',
          },
        },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = await createRouteClient(cookieStore);
    await updatePersonal(supabase, user.id, parsed.data as PersonalInfo);
    const profile = await getOrCreateProfile(supabase, user.id);

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
