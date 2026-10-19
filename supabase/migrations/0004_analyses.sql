-- 0004_analyses.sql
-- Job-Match Analysis: one row per analysis RUN. Results are immutable
-- snapshots (rerun = new row, profile_fingerprint detects staleness); the
-- requirement breakdown + evidence matches live in `result` jsonb, matching
-- the house style (doc/fit/extraction are all jsonb blobs).
-- The unique partial index on (jd_id) WHERE status='running' is the
-- duplicate-request guard: a retried POST can't start a second live analysis
-- for the same JD.

create table public.match_analyses (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  jd_id uuid not null references public.job_descriptions(id) on delete cascade,
  status text not null check (status in ('running', 'completed', 'failed')),
  result jsonb,
  error text,
  profile_fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index match_analyses_owner_idx on public.match_analyses(owner);
create index match_analyses_jd_id_idx on public.match_analyses(jd_id);
create unique index match_analyses_one_running_per_jd
  on public.match_analyses(jd_id) where status = 'running';

create trigger match_analyses_set_updated_at
  before update on public.match_analyses
  for each row execute function public.set_updated_at();

alter table public.match_analyses enable row level security;

create policy match_analyses_owner_all
  on public.match_analyses
  as permissive
  for all
  to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

-- Analysis ↔ resume link: additive, nullable. Old resumes keep working.
alter table public.generated_resumes
  add column analysis_id uuid references public.match_analyses(id) on delete set null;

create index generated_resumes_analysis_id_idx on public.generated_resumes(analysis_id);
