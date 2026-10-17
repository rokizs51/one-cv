import { NextResponse } from 'next/server';
import { createRouteClient } from '@/lib/db/client';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    // Create the Supabase server client with cookie handling
    const cookieStore = await cookies();
    const supabase = await createRouteClient(cookieStore);

    // Sign in the user
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return NextResponse.json(
        { error: { code: 'invalid_credentials', message: 'Invalid email or password' } },
        { status: 401 }
      );
    }

    if (!signInData.user) {
      return NextResponse.json(
        { error: { code: 'login_failed', message: 'Failed to sign in' } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        user: { 
          id: signInData.user.id, 
          email: signInData.user.email 
        } 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
