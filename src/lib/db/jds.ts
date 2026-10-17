import type { SupabaseClient } from '@supabase/supabase-js';
import type { JdExtraction } from '@/lib/domain/types';

export interface JobDescription {
  id: string;
  owner: string;
  raw: string;
  extraction: JdExtraction;
  createdAt: string;
}

/**
 * Create a new job description.
 */
export async function createJd(
  supa: SupabaseClient,
  userId: string,
  raw: string,
  extraction: JdExtraction
): Promise<JobDescription> {
  const { data, error } = await supa
    .from('job_descriptions')
    .insert({
      owner: userId,
      raw,
      extraction,
    })
    .select('*')
    .single();

  if (error) throw error;

  return {
    id: data.id as string,
    owner: data.owner as string,
    raw: data.raw as string,
    extraction: data.extraction as JdExtraction,
    createdAt: data.created_at as string,
  };
}

/**
 * Get a job description by ID.
 */
export async function getJd(
  supa: SupabaseClient,
  jdId: string
): Promise<JobDescription | null> {
  const { data, error } = await supa
    .from('job_descriptions')
    .select('*')
    .eq('id', jdId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id as string,
    owner: data.owner as string,
    raw: data.raw as string,
    extraction: data.extraction as JdExtraction,
    createdAt: data.created_at as string,
  };
}
