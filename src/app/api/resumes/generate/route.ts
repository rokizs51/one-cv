import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/db/client';
import { getSessionUser } from '@/lib/auth/session';
import { createGenAI } from '@/lib/ai/client';
import { aiConfig } from '@/lib/ai/env';
import { generateResume, QuotaExceededError, GenerationUnavailableError, NotFoundError } from '@/lib/resume/orchestrate';
import type { GenMode } from '@/lib/domain/types';

export async function POST(request: Request) {
  try {
    // 1. Session check
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: 'unauthorized', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Parse request body
    let body: { jdId?: string; mode?: string; pageLimit?: number };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const { jdId, mode, pageLimit } = body;
    
    // Validate required fields
    if (!jdId || typeof jdId !== 'string') {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Field "jdId" must be a string' } },
        { status: 400 }
      );
    }
    
    if (!mode || (mode !== 'as_is' && mode !== 'enhance')) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Field "mode" must be "as_is" or "enhance"' } },
        { status: 400 }
      );
    }
    
    if (!pageLimit || (pageLimit !== 1 && pageLimit !== 2)) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Field "pageLimit" must be 1 or 2' } },
        { status: 400 }
      );
    }

    // Create Supabase client
    const cookieStore = await cookies();
    const supabase = await createServerClient(
      () => cookieStore.getAll().map(c => ({ name: c.name, value: c.value })),
      (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options as any);
        });
      }
    );

    // Create GenAI client
    const genAI = createGenAI();

    // Call orchestrate function
    const config = aiConfig();
    const resume = await generateResume(
      {
        supa: supabase,
        ai: genAI,
        now: new Date(),
        user,
        enhanceModel: config.enhanceModel,
        monthlyCostCeilingMicros: config.monthlyCostCeilingMicros,
      },
      {
        jdId,
        mode: mode as GenMode,
        pageLimit: pageLimit as 1 | 2,
      }
    );

    // Success
    return NextResponse.json({ resume }, { status: 201 });
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return NextResponse.json(
        { error: { code: 'quota', message: error.message } },
        { status: 429 }
      );
    }
    
    if (error instanceof GenerationUnavailableError) {
      return NextResponse.json(
        { error: { code: 'budget_exhausted', message: error.message } },
        { status: 400 }
      );
    }
    
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: { code: 'not_found', message: error.message } },
        { status: 404 }
      );
    }
    
    console.error('Resume generation error:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
