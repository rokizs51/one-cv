-- 0001_init.sql
-- ResumeTailor initial schema: profiles, profile_items, job_descriptions,
-- generated_resumes, invites, generation_quota.
-- Row Level Security enabled on all tables.

-- ============================================================
-- Utility function: auto-update `updated_at` on row UPDATE.
-- ============================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- profiles
-- One per auth user. personal: {full_name, email, phone, location, links[]}
-- ============================================================
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  personal jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy profiles_owner_all
  on public.profiles
  as permissive
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- profile_items
-- type must be one of the 7 ItemType values from Task 2.
-- source is optional (nullable); when present must be 'manual' | 'import'.
-- ============================================================
create table public.profile_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in (
    'career_snapshot',
    'education',
    'experience',
    'project',
    'award',
    'skill',
    'language'
  )),
  payload jsonb,
  canonical_text text not null default '',
  source text check (source in ('manual', 'import')),
  provenance jsonb default '[]'::jsonb,
  pinned boolean default false,
  position int default 0
);

create index profile_items_profile_id_idx on public.profile_items(profile_id);
create index profile_items_type_idx on public.profile_items(type);

alter table public.profile_items enable row level security;

create policy profile_items_owner_via_profile
  on public.profile_items
  as permissive
  for all
  to authenticated
  using (
    profile_id in (
      select id from public.profiles where user_id = auth.uid()
    )
  )
  with check (
    profile_id in (
      select id from public.profiles where user_id = auth.uid()
    )
  );

-- ============================================================
-- job_descriptions
-- ============================================================
create table public.job_descriptions (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  raw text,
  extraction jsonb,
  created_at timestamptz not null default now()
);

create index job_descriptions_owner_idx on public.job_descriptions(owner);

alter table public.job_descriptions enable row level security;

create policy job_descriptions_owner_all
  on public.job_descriptions
  as permissive
  for all
  to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

-- ============================================================
-- generated_resumes
-- mode: 'as_is' | 'enhance' (GenMode from Task 2).
-- ============================================================
create table public.generated_resumes (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  jd_id uuid references public.job_descriptions(id),
  mode text not null check (mode in ('as_is', 'enhance')),
  page_limit int not null default 1,
  doc jsonb,
  suggestions jsonb default '[]'::jsonb,
  statuses jsonb default '[]'::jsonb,
  user_edits jsonb default '{}'::jsonb,
  fit jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index generated_resumes_owner_idx on public.generated_resumes(owner);
create index generated_resumes_jd_id_idx on public.generated_resumes(jd_id);

create trigger generated_resumes_set_updated_at
  before update on public.generated_resumes
  for each row execute function public.set_updated_at();

alter table public.generated_resumes enable row level security;

create policy generated_resumes_owner_all
  on public.generated_resumes
  as permissive
  for all
  to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

-- ============================================================
-- invites
--
-- Three explicit policies:
--   1. invites_anon_insert  (role=anon)      — INSERT: required by the
--      signup flow, which runs before the user has an authenticated session
--      and needs to register/validate an invite code.
--   2. invites_anon_select  (role=anon)      — SELECT: allows checking if
--      an invite code exists during signup validation. Codes are 12-char
--      secrets; knowing one to check existence is the launch model.
--   3. invites_self_select  (role=authenticated) — SELECT: a signed-in user
--      may only read invite rows they themselves have claimed
--      (claimed_by = auth.uid()).
--   4. invites_claim_update (role=authenticated) — UPDATE: allows a signed-in
--      user to claim an unclaimed invite (claimed_by IS NULL) by setting
--      claimed_by to their own user ID.
--
-- No DELETE policies are defined; invite lifecycle is managed by the
-- service-role client (server-side at signup), not by end-user requests.
-- ============================================================
create table public.invites (
  code text primary key,
  email text,
  claimed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

alter table public.invites enable row level security;

create policy invites_anon_insert
  on public.invites
  as permissive
  for insert
  to anon
  with check (true);

create policy invites_anon_select
  on public.invites
  as permissive
  for select
  to anon
  using (true);

create policy invites_self_select
  on public.invites
  as permissive
  for select
  to authenticated
  using (claimed_by = auth.uid());

create policy invites_claim_update
  on public.invites
  as permissive
  for update
  to authenticated
  using (claimed_by is null)
  with check (claimed_by = auth.uid());

-- ============================================================
-- generation_quota
-- PK is (user_id, month); month format 'YYYY-MM'.
-- ============================================================
create table public.generation_quota (
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,
  generations int not null default 0,
  llm_cost_micros bigint not null default 0,
  primary key (user_id, month)
);

alter table public.generation_quota enable row level security;

create policy generation_quota_owner_all
  on public.generation_quota
  as permissive
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
