-- ============================================================
-- Test account: mid-level software engineer
-- ============================================================
-- Login:    seed.midlevel@example.com / SeedPass123!
-- Contents: one auth user, one profile, a full profile (experience,
--           projects, education, certification, skills, award, languages)
--           and one job description with a ready-made extraction, so the
--           generate flow can be tested without spending an AI call on
--           JD extraction.
--
-- Requires migration 0005_item_certifications.sql (the certification item).
--
-- How to run (this project uses the anon key only — there is no
-- service-role key in the app, so seed from a privileged SQL session):
--   • Supabase dashboard → SQL Editor → paste this file → Run, or
--   • psql "$SUPABASE_DB_URL" -f supabase/seed.sql
--     (the direct/pooler connection string, NOT the anon key)
--
-- Idempotent: re-running deletes and recreates ONLY this seed account.
-- The delete cascades to its profile, items, JDs, resumes and analyses.
-- ============================================================

begin;

delete from auth.users
where id = 'a0000000-0000-4000-8000-000000000001'
   or email = 'seed.midlevel@example.com';

-- ---- auth user + email identity (password login works immediately) ----
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated',
  'seed.midlevel@example.com',
  extensions.crypt('P@ssw0rd', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Avery Chen"}',
  now(), now(),
  '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values (
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  jsonb_build_object(
    'sub', 'a0000000-0000-4000-8000-000000000001',
    'email', 'seed.midlevel@example.com',
    'email_verified', true
  ),
  'email', now(), now(), now()
);

-- ---- profile ----
insert into public.profiles (id, user_id, personal) values (
  'a0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000001',
  '{
    "fullName": "Avery Chen",
    "email": "seed.midlevel@example.com",
    "phone": "+1 416 555 0142",
    "location": "Toronto, Canada",
    "links": ["github.com/averychen-dev", "linkedin.com/in/averychen-dev"]
  }'::jsonb
);

-- ---- profile items ----
-- canonical_text values are exactly what canonicalTextFor() derives; IDs are
-- fixed so a resume/JD link in other test data can reference them.
insert into public.profile_items
  (id, profile_id, type, payload, canonical_text, source, provenance, pinned, position)
values
  -- career summary (renders as the CV headline)
  (
    'a0000000-0000-4000-8000-000000000010',
    'a0000000-0000-4000-8000-000000000002',
    'career_snapshot',
    '{"text":"Mid-level software engineer with 5 years building web applications in TypeScript and Python. Strong in React, Node.js, PostgreSQL and AWS, with a habit of owning features end to end from design through production support."}',
    'Mid-level software engineer with 5 years building web applications in TypeScript and Python. Strong in React, Node.js, PostgreSQL and AWS, with a habit of owning features end to end from design through production support.',
    'manual', '[]'::jsonb, false, 0
  ),

  -- most recent role (pinned: never cut, even on a one-page CV)
  (
    'a0000000-0000-4000-8000-000000000011',
    'a0000000-0000-4000-8000-000000000002',
    'experience',
    '{
      "company": "Northwind Logistics",
      "role": "Software Engineer",
      "start": "2022-04",
      "end": "",
      "location": "Toronto, Canada",
      "employmentType": "Full-time",
      "bullets": [
        "Designed and shipped a React + TypeScript dispatch dashboard used by 120 daily dispatchers, replacing three spreadsheets.",
        "Reduced API p95 latency from 480 ms to 210 ms by adding PostgreSQL indexes and batching N+1 queries in the Node.js service.",
        "Built CI checks and Playwright smoke tests that cut release regressions by roughly 30%.",
        "Mentored two junior engineers and led weekly code review sessions."
      ],
      "technologies": ["TypeScript", "React", "Node.js", "PostgreSQL", "AWS", "Docker", "Playwright"]
    }'::jsonb,
    'Software Engineer — Northwind Logistics (Apr 2022–present)
Designed and shipped a React + TypeScript dispatch dashboard used by 120 daily dispatchers, replacing three spreadsheets.
Reduced API p95 latency from 480 ms to 210 ms by adding PostgreSQL indexes and batching N+1 queries in the Node.js service.
Built CI checks and Playwright smoke tests that cut release regressions by roughly 30%.
Mentored two junior engineers and led weekly code review sessions.',
    'manual', '[]'::jsonb, true, 0
  ),

  -- previous role
  (
    'a0000000-0000-4000-8000-000000000012',
    'a0000000-0000-4000-8000-000000000002',
    'experience',
    '{
      "company": "Lumen Health",
      "role": "Junior Software Engineer",
      "start": "2019-07",
      "end": "2022-03",
      "location": "Toronto, Canada",
      "employmentType": "Full-time",
      "bullets": [
        "Migrated a Django reporting module to a Python service with Celery workers, handling 15k nightly jobs.",
        "Implemented role-based access control and audit logging for patient-facing APIs.",
        "Wrote data validation scripts that reduced support tickets for malformed imports by 40%."
      ],
      "technologies": ["Python", "Django", "Celery", "PostgreSQL", "Redis", "Docker"]
    }'::jsonb,
    'Junior Software Engineer — Lumen Health (Jul 2019–Mar 2022)
Migrated a Django reporting module to a Python service with Celery workers, handling 15k nightly jobs.
Implemented role-based access control and audit logging for patient-facing APIs.
Wrote data validation scripts that reduced support tickets for malformed imports by 40%.',
    'manual', '[]'::jsonb, false, 1
  ),

  -- projects
  (
    'a0000000-0000-4000-8000-000000000020',
    'a0000000-0000-4000-8000-000000000002',
    'project',
    '{
      "name": "RouteLens",
      "description": "Open-source delivery route visualizer for small fleets",
      "tech": ["TypeScript", "React", "MapLibre", "Node.js"]
    }'::jsonb,
    'RouteLens — Open-source delivery route visualizer for small fleets (TypeScript, React, MapLibre, Node.js)',
    'manual', '[]'::jsonb, false, 0
  ),
  (
    'a0000000-0000-4000-8000-000000000021',
    'a0000000-0000-4000-8000-000000000002',
    'project',
    '{
      "name": "LedgerLite",
      "description": "Small double-entry bookkeeping API built with Go and PostgreSQL",
      "tech": ["Go", "PostgreSQL", "Docker"]
    }'::jsonb,
    'LedgerLite — Small double-entry bookkeeping API built with Go and PostgreSQL (Go, PostgreSQL, Docker)',
    'manual', '[]'::jsonb, false, 1
  ),

  -- education
  (
    'a0000000-0000-4000-8000-000000000030',
    'a0000000-0000-4000-8000-000000000002',
    'education',
    '{"school":"University of Toronto","degree":"BSc","field":"Computer Science","startYear":2015,"endYear":2019}',
    'BSc Computer Science — University of Toronto (2015–2019)',
    'manual', '[]'::jsonb, false, 0
  ),

  -- certification
  (
    'a0000000-0000-4000-8000-000000000040',
    'a0000000-0000-4000-8000-000000000002',
    'certification',
    '{"name":"AWS Certified Developer – Associate","issuer":"Amazon Web Services","year":2023}',
    'AWS Certified Developer – Associate — Amazon Web Services (2023)',
    'manual', '[]'::jsonb, false, 0
  ),

  -- award
  (
    'a0000000-0000-4000-8000-000000000050',
    'a0000000-0000-4000-8000-000000000002',
    'award',
    '{"title":"Hackathon Winner","issuer":"Northwind Internal Hack Week","year":2023}',
    'Hackathon Winner — Northwind Internal Hack Week (2023)',
    'manual', '[]'::jsonb, false, 0
  ),

  -- skills, grouped with the fixed presentation taxonomy
  ('a0000000-0000-4000-8000-000000000060', 'a0000000-0000-4000-8000-000000000002', 'skill',
   '{"name":"TypeScript","level":"Advanced","category":"Programming languages"}',
   'TypeScript (Advanced)', 'manual', '[]'::jsonb, false, 0),
  ('a0000000-0000-4000-8000-000000000061', 'a0000000-0000-4000-8000-000000000002', 'skill',
   '{"name":"Python","level":"Advanced","category":"Programming languages"}',
   'Python (Advanced)', 'manual', '[]'::jsonb, false, 1),
  ('a0000000-0000-4000-8000-000000000062', 'a0000000-0000-4000-8000-000000000002', 'skill',
   '{"name":"Go","level":"Intermediate","category":"Programming languages"}',
   'Go (Intermediate)', 'manual', '[]'::jsonb, false, 2),
  ('a0000000-0000-4000-8000-000000000063', 'a0000000-0000-4000-8000-000000000002', 'skill',
   '{"name":"SQL","category":"Programming languages"}',
   'SQL', 'manual', '[]'::jsonb, false, 3),
  ('a0000000-0000-4000-8000-000000000064', 'a0000000-0000-4000-8000-000000000002', 'skill',
   '{"name":"Node.js","category":"Backend / frameworks"}',
   'Node.js', 'manual', '[]'::jsonb, false, 4),
  ('a0000000-0000-4000-8000-000000000065', 'a0000000-0000-4000-8000-000000000002', 'skill',
   '{"name":"Express","category":"Backend / frameworks"}',
   'Express', 'manual', '[]'::jsonb, false, 5),
  ('a0000000-0000-4000-8000-000000000066', 'a0000000-0000-4000-8000-000000000002', 'skill',
   '{"name":"Django","category":"Backend / frameworks"}',
   'Django', 'manual', '[]'::jsonb, false, 6),
  ('a0000000-0000-4000-8000-000000000067', 'a0000000-0000-4000-8000-000000000002', 'skill',
   '{"name":"React","level":"Advanced","category":"Frontend"}',
   'React (Advanced)', 'manual', '[]'::jsonb, false, 7),
  ('a0000000-0000-4000-8000-000000000068', 'a0000000-0000-4000-8000-000000000002', 'skill',
   '{"name":"Next.js","category":"Frontend"}',
   'Next.js', 'manual', '[]'::jsonb, false, 8),
  ('a0000000-0000-4000-8000-000000000069', 'a0000000-0000-4000-8000-000000000002', 'skill',
   '{"name":"PostgreSQL","category":"Databases"}',
   'PostgreSQL', 'manual', '[]'::jsonb, false, 9),
  ('a0000000-0000-4000-8000-00000000006a', 'a0000000-0000-4000-8000-000000000002', 'skill',
   '{"name":"Redis","category":"Databases"}',
   'Redis', 'manual', '[]'::jsonb, false, 10),
  ('a0000000-0000-4000-8000-00000000006b', 'a0000000-0000-4000-8000-000000000002', 'skill',
   '{"name":"AWS","category":"Cloud / DevOps / infrastructure"}',
   'AWS', 'manual', '[]'::jsonb, false, 11),
  ('a0000000-0000-4000-8000-00000000006c', 'a0000000-0000-4000-8000-000000000002', 'skill',
   '{"name":"Docker","category":"Cloud / DevOps / infrastructure"}',
   'Docker', 'manual', '[]'::jsonb, false, 12),
  ('a0000000-0000-4000-8000-00000000006d', 'a0000000-0000-4000-8000-000000000002', 'skill',
   '{"name":"GitHub Actions","category":"Cloud / DevOps / infrastructure"}',
   'GitHub Actions', 'manual', '[]'::jsonb, false, 13),
  ('a0000000-0000-4000-8000-00000000006e', 'a0000000-0000-4000-8000-000000000002', 'skill',
   '{"name":"Vitest","category":"Testing"}',
   'Vitest', 'manual', '[]'::jsonb, false, 14),
  ('a0000000-0000-4000-8000-00000000006f', 'a0000000-0000-4000-8000-000000000002', 'skill',
   '{"name":"Playwright","category":"Testing"}',
   'Playwright', 'manual', '[]'::jsonb, false, 15),
  ('a0000000-0000-4000-8000-000000000070', 'a0000000-0000-4000-8000-000000000002', 'skill',
   '{"name":"pytest","category":"Testing"}',
   'pytest', 'manual', '[]'::jsonb, false, 16),
  ('a0000000-0000-4000-8000-000000000071', 'a0000000-0000-4000-8000-000000000002', 'skill',
   '{"name":"Git","category":"Tools / integrations"}',
   'Git', 'manual', '[]'::jsonb, false, 17),
  ('a0000000-0000-4000-8000-000000000072', 'a0000000-0000-4000-8000-000000000002', 'skill',
   '{"name":"Datadog","category":"Tools / integrations"}',
   'Datadog', 'manual', '[]'::jsonb, false, 18),

  -- languages
  ('a0000000-0000-4000-8000-000000000080', 'a0000000-0000-4000-8000-000000000002', 'language',
   '{"name":"English","level":"Native"}',
   'English (Native)', 'manual', '[]'::jsonb, false, 0),
  ('a0000000-0000-4000-8000-000000000081', 'a0000000-0000-4000-8000-000000000002', 'language',
   '{"name":"French","level":"Intermediate"}',
   'French (Intermediate)', 'manual', '[]'::jsonb, false, 1);

-- ---- job description (mid-level full-stack/backend, logistics) ----
-- The extraction is pre-filled so Generate works without an AI extraction
-- call; requirement ids follow finalizeRequirements (req-<category>-<index>)
-- and every sourceExcerpt is verbatim from `raw`.
insert into public.job_descriptions (id, owner, raw, extraction) values (
  'a0000000-0000-4000-8000-0000000000f1',
  'a0000000-0000-4000-8000-000000000001',
  $jd$Mid-Level Software Engineer — Fleet Platform
Northwind Logistics · Toronto, Canada (Hybrid)

We are looking for a mid-level software engineer to join our fleet platform team. You will build and operate the services dispatchers, drivers and operations teams use every day.

What you'll do
- Build full-stack features in TypeScript, React and Node.js.
- Design and maintain PostgreSQL schemas and queries for high-volume dispatch data.
- Deploy and operate services on AWS using Docker and GitHub Actions.
- Add observability with structured logs, metrics and Datadog dashboards.
- Review code, write tests with Vitest and Playwright, and mentor junior engineers.

What we're looking for
- 3+ years of professional software engineering experience.
- Strong TypeScript and React skills for production web applications.
- Experience building backend APIs with Node.js.
- Solid SQL and PostgreSQL knowledge, including query performance tuning.
- Hands-on experience with AWS and containerized deployments using Docker.
- Familiarity with event-driven architecture and message queues.
- Strong communication skills and a habit of writing clear documentation.

Nice to have
- Experience with GraphQL.
- Familiarity with Kubernetes.
- Prior work in logistics or supply-chain software.$jd$,
  $json${
    "requiredSkills": ["TypeScript", "React", "Node.js", "PostgreSQL", "AWS", "SQL"],
    "preferredSkills": ["GraphQL", "Kubernetes", "Docker", "event-driven architecture"],
    "keywords": ["dispatch", "fleet", "observability", "CI/CD", "code review", "logistics"],
    "seniority": "mid",
    "domain": "logistics software",
    "tools": ["GitHub Actions", "Docker", "Datadog", "Vitest", "Playwright"],
    "responsibilities": [
      "Build full-stack features in TypeScript, React and Node.js",
      "Design and maintain PostgreSQL schemas and queries for high-volume dispatch data",
      "Deploy and operate services on AWS using Docker and GitHub Actions",
      "Add observability with structured logs, metrics and Datadog dashboards",
      "Review code, write tests and mentor junior engineers"
    ],
    "requirements": [
      {
        "id": "req-experience-0",
        "description": "3+ years of professional software engineering experience",
        "category": "experience",
        "importance": "mandatory",
        "aliases": ["three years"],
        "sourceExcerpt": "3+ years of professional software engineering experience"
      },
      {
        "id": "req-technical_skill-1",
        "description": "Strong TypeScript and React skills for production web applications",
        "category": "technical_skill",
        "importance": "mandatory",
        "aliases": ["TypeScript", "React"],
        "sourceExcerpt": "Strong TypeScript and React skills for production web applications"
      },
      {
        "id": "req-technical_skill-2",
        "description": "Experience building backend APIs with Node.js",
        "category": "technical_skill",
        "importance": "mandatory",
        "aliases": ["Node.js", "backend APIs"],
        "sourceExcerpt": "Experience building backend APIs with Node.js"
      },
      {
        "id": "req-technical_skill-3",
        "description": "Solid SQL and PostgreSQL knowledge, including query performance tuning",
        "category": "technical_skill",
        "importance": "mandatory",
        "aliases": ["PostgreSQL", "SQL"],
        "sourceExcerpt": "Solid SQL and PostgreSQL knowledge, including query performance tuning"
      },
      {
        "id": "req-technical_skill-4",
        "description": "Hands-on experience with AWS and containerized deployments using Docker",
        "category": "technical_skill",
        "importance": "mandatory",
        "aliases": ["AWS", "Docker"],
        "sourceExcerpt": "Hands-on experience with AWS and containerized deployments using Docker"
      },
      {
        "id": "req-domain_knowledge-5",
        "description": "Familiarity with event-driven architecture and message queues",
        "category": "domain_knowledge",
        "importance": "preferred",
        "aliases": ["event-driven", "message queues"],
        "sourceExcerpt": "Familiarity with event-driven architecture and message queues"
      },
      {
        "id": "req-communication-6",
        "description": "Strong communication skills and a habit of writing clear documentation",
        "category": "communication",
        "importance": "mandatory",
        "aliases": [],
        "sourceExcerpt": "Strong communication skills and a habit of writing clear documentation"
      },
      {
        "id": "req-technical_skill-7",
        "description": "Experience with GraphQL",
        "category": "technical_skill",
        "importance": "preferred",
        "aliases": ["GraphQL"],
        "sourceExcerpt": "Experience with GraphQL"
      },
      {
        "id": "req-technical_skill-8",
        "description": "Familiarity with Kubernetes",
        "category": "technical_skill",
        "importance": "preferred",
        "aliases": ["Kubernetes"],
        "sourceExcerpt": "Familiarity with Kubernetes"
      },
      {
        "id": "req-domain_knowledge-9",
        "description": "Prior work in logistics or supply-chain software",
        "category": "domain_knowledge",
        "importance": "preferred",
        "aliases": ["logistics", "supply chain"],
        "sourceExcerpt": "Prior work in logistics or supply-chain software"
      }
    ]
  }$json$::jsonb
);

commit;

-- ---- verification (the editor shows this result) ----
select
  u.email,
  p.id as profile_id,
  (select count(*) from public.profile_items i where i.profile_id = p.id) as profile_items,
  (select count(*) from public.job_descriptions j where j.owner = u.id) as job_descriptions
from auth.users u
join public.profiles p on p.user_id = u.id
where u.id = 'a0000000-0000-4000-8000-000000000001';