import type { SupabaseClient } from '@supabase/supabase-js';
import type { ResumeDoc, Suggestion, SuggestionState, GenMode } from '@/lib/domain/types';
import type { FitResultSnapshot } from '@/lib/resume/fit-types';

export interface ResumeFields {
  jdId: string;
  mode: GenMode;
  pageLimit: 1 | 2;
  doc: ResumeDoc;
  suggestions: Suggestion[];
  statuses: SuggestionState[];
  userEdits: Record<string, string>;
  fit: FitResultSnapshot;
}

export interface GeneratedResume extends ResumeFields {
  id: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Save a new generated resume.
 */
export async function saveResume(
  supa: SupabaseClient,
  userId: string,
  input: {
    jdId: string;
    mode: GenMode;
    pageLimit: 1 | 2;
    doc: ResumeDoc;
    suggestions: Suggestion[];
    statuses: SuggestionState[];
    userEdits: Record<string, string>;
    fit: FitResultSnapshot;
  }
): Promise<GeneratedResume> {
  const { data, error } = await supa
    .from('generated_resumes')
    .insert({
      owner: userId,
      jd_id: input.jdId,
      mode: input.mode,
      page_limit: input.pageLimit,
      doc: input.doc,
      suggestions: input.suggestions,
      statuses: input.statuses,
      user_edits: input.userEdits,
      fit: input.fit,
    })
    .select('*')
    .single();

  if (error) throw error;

  return {
    id: data.id as string,
    owner: data.owner as string,
    jdId: data.jd_id as string,
    mode: data.mode as GenMode,
    pageLimit: data.page_limit as 1 | 2,
    doc: data.doc as ResumeDoc,
    suggestions: data.suggestions as Suggestion[],
    statuses: data.statuses as SuggestionState[],
    userEdits: data.user_edits as Record<string, string>,
    fit: data.fit as FitResultSnapshot,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

/**
 * Update fields on a generated resume.
 */
export async function updateResumeFields(
  supa: SupabaseClient,
  resumeId: string,
  patch: Partial<ResumeFields>
): Promise<void> {
  const row: Record<string, unknown> = {};

  if (patch.jdId !== undefined) row.jd_id = patch.jdId;
  if (patch.mode !== undefined) row.mode = patch.mode;
  if (patch.pageLimit !== undefined) row.page_limit = patch.pageLimit;
  if (patch.doc !== undefined) row.doc = patch.doc;
  if (patch.suggestions !== undefined) row.suggestions = patch.suggestions;
  if (patch.statuses !== undefined) row.statuses = patch.statuses;
  if (patch.userEdits !== undefined) row.user_edits = patch.userEdits;
  if (patch.fit !== undefined) row.fit = patch.fit;

  await supa.from('generated_resumes').update(row).eq('id', resumeId);
}

/**
 * List all resumes for a user.
 */
export async function listResumes(
  supa: SupabaseClient,
  userId: string
): Promise<GeneratedResume[]> {
  const { data, error } = await supa
    .from('generated_resumes')
    .select('*')
    .eq('owner', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id as string,
    owner: row.owner as string,
    jdId: row.jd_id as string,
    mode: row.mode as GenMode,
    pageLimit: row.page_limit as 1 | 2,
    doc: row.doc as ResumeDoc,
    suggestions: row.suggestions as Suggestion[],
    statuses: row.statuses as SuggestionState[],
    userEdits: row.user_edits as Record<string, string>,
    fit: row.fit as FitResultSnapshot,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));
}

/**
 * Get a resume by ID.
 */
export async function getResume(
  supa: SupabaseClient,
  resumeId: string
): Promise<GeneratedResume | null> {
  const { data, error } = await supa
    .from('generated_resumes')
    .select('*')
    .eq('id', resumeId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id as string,
    owner: data.owner as string,
    jdId: data.jd_id as string,
    mode: data.mode as GenMode,
    pageLimit: data.page_limit as 1 | 2,
    doc: data.doc as ResumeDoc,
    suggestions: data.suggestions as Suggestion[],
    statuses: data.statuses as SuggestionState[],
    userEdits: data.user_edits as Record<string, string>,
    fit: data.fit as FitResultSnapshot,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}
