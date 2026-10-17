import { NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/db/client';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    // Create the Supabase server client with cookie handling
    const cookieStore = await cookies();
    const supabase = await createRouteClient(cookieStore);

    // Sign out the user
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Logout error:', error);
      return NextResponse.json(
        { error: { code: 'logout_failed', message: 'Failed to sign out' } },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true },
      { status: 200 }
    );
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
