import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
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
      // Check if user already exists - primary check via status code (422 = Unprocessable Entity)
      // Secondary check via message text as belt-and-braces fallback
      const isUserExists = signUpError.status === 422 ||
        signUpError.message?.includes('already registered') ||
        signUpError.message?.includes('User already registered');

      if (isUserExists) {
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
