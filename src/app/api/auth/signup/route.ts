import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAnonClient } from '@/lib/db/client';
import { inviteExists, claimInvite } from '@/lib/db/invites';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, inviteCode } = body;

    // Validate required fields
    if (!email || !password || !inviteCode) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    // Check if invite code exists and is unclaimed
    const anonSupa = createAnonClient();
    const inviteValid = await inviteExists(inviteCode);
    
    if (!inviteValid) {
      return NextResponse.json(
        { error: { code: 'invalid_invite', message: 'This invite code is invalid or already used' } },
        { status: 400 }
      );
    }

    // Create the Supabase server client with cookie handling
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Sign up the user
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      // Check if user already exists
      if (signUpError.message?.includes('already registered') || 
          signUpError.message?.includes('User already registered')) {
        return NextResponse.json(
          { error: { code: 'user_exists', message: 'A user with this email already exists' } },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: { code: 'signup_failed', message: signUpError.message } },
        { status: 400 }
      );
    }

    if (!signUpData.user) {
      return NextResponse.json(
        { error: { code: 'signup_failed', message: 'Failed to create user' } },
        { status: 400 }
      );
    }

    // Try to claim the invite
    const claimed = await claimInvite(anonSupa, inviteCode, signUpData.user.id);
    
    if (!claimed) {
      // Race condition: invite was claimed between our check and now
      // Sign out the user and return error
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: { code: 'invalid_invite', message: 'This invite code is no longer available' } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        user: { 
          id: signUpData.user.id, 
          email: signUpData.user.email 
        } 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
