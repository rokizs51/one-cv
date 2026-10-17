import { NextResponse, connection } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteClient } from '@/lib/db/client';
import { getSessionUser } from '@/lib/auth/session';
import { getOrCreateProfile } from '@/lib/db/profiles';
import { listItems, createItem } from '@/lib/db/items';
import { PAYLOAD_SCHEMAS, ITEM_TYPES } from '@/lib/domain/schemas';
import { canonicalTextFor } from '@/lib/domain/canonical';
import type { ItemType } from '@/lib/domain/types';

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
    const items = await listItems(supabase, profile.id);

    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    console.error('Profile items fetch error:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    let body: { type?: unknown; payload?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const { type, payload } = body;
    if (typeof type !== 'string' || !(ITEM_TYPES as string[]).includes(type)) {
      return NextResponse.json(
        { error: { code: 'invalid_type', message: 'Unknown entry type' } },
        { status: 400 }
      );
    }

    const parsed = PAYLOAD_SCHEMAS[type as ItemType].safeParse(payload ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'invalid_payload',
            message: 'Some fields are missing or in the wrong format. Check the form and try again.',
          },
        },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = await createRouteClient(cookieStore);
    const profile = await getOrCreateProfile(supabase, user.id);
    const item = await createItem(supabase, profile.id, {
      type: type as ItemType,
      payload: parsed.data,
      canonicalText: canonicalTextFor(type as ItemType, parsed.data),
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Profile item create error:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
