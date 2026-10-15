import type { SupabaseClient } from '@supabase/supabase-js';

export interface PersonalInfo {
  fullName: string;
  email: string;
  phone: string | null;
  location: string | null;
  links: string[];
}

export interface Profile {
  id: string;
  userId: string;
  personal: PersonalInfo;
}

/**
 * Get or create a profile for a user.
 * If no profile exists, creates one with default empty personal info.
 */
export async function getOrCreateProfile(
  supa: SupabaseClient,
  userId: string
): Promise<Profile> {
  const { data: existing } = await supa
    .from('profiles')
    .select('id, user_id, personal')
    .eq('user_id', userId)
    .single();

  if (existing) {
    const personal = existing.personal as Partial<PersonalInfo>;
    return {
      id: existing.id as string,
      userId: existing.user_id as string,
      personal: {
        fullName: personal.fullName ?? '',
        email: personal.email ?? '',
        phone: personal.phone ?? null,
        location: personal.location ?? null,
        links: personal.links ?? [],
      },
    };
  }

  const defaultPersonal: PersonalInfo = {
    fullName: '',
    email: '',
    phone: null,
    location: null,
    links: [],
  };

  const { data: created, error } = await supa
    .from('profiles')
    .insert({
      user_id: userId,
      personal: defaultPersonal,
    })
    .select('id, user_id, personal')
    .single();

  if (error) throw error;

  return {
    id: created.id as string,
    userId: created.user_id as string,
    personal: created.personal as PersonalInfo,
  };
}

/**
 * Update the personal info for a user's profile.
 */
export async function updatePersonal(
  supa: SupabaseClient,
  userId: string,
  p: PersonalInfo
): Promise<void> {
  await supa
    .from('profiles')
    .update({ personal: p })
    .eq('user_id', userId);
}
