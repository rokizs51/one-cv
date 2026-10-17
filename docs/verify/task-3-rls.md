# Task 3 — RLS manual verification checklist

Owner-operated. Do not run until the Supabase project exists and the migration has been applied.

## 1. Project setup

- [ ] Create a free Supabase project (note the project URL and anon/service-role keys).
- [ ] Copy the URL + both keys into `.env.local` (file is gitignored).
- [ ] Apply BOTH migrations in order (0002 grants the app roles table
  privileges — without it every API call 403s with 42501, RLS policies
  notwithstanding):
  - via CLI: `supabase link --project-ref <ref>` then `supabase db push`, OR
  - by pasting `supabase/migrations/0001_init.sql` then
    `supabase/migrations/0002_grants.sql` into the Supabase SQL editor, running each.
- [ ] Confirm in the dashboard that all 5 tables exist (`profiles`, `profile_items`, `job_descriptions`, `generated_resumes`, `generation_quota`).

## 2. Invite seeding — REMOVED

The invite-gated launch model was dropped 2026-10-17 by owner decision
(open email signup instead). The `invites` table is no longer part of the
schema; skip this section.

## 3. Create disposable test users

In the Supabase dashboard, Authentication → Users → Add user, create two email/password users:

- User A: e.g. `a@example.com` / password.
- User B: e.g. `b@example.com` / password.

Note their UUIDs from the dashboard (the `id` column of `auth.users`).

## 4. RLS checks

For each check, open the Supabase SQL editor, use the "Run as role" dropdown (or impersonate user), and execute the snippet. Record pass/fail.

### 4.1 As user A, SELECT own profile

```sql
-- Impersonate user A.
insert into public.profiles (user_id) values ('<UUID-A>') returning id, user_id;
select id, user_id, personal from public.profiles where user_id = '<UUID-A>';
```

**Expected:** SELECT returns exactly 1 row.

**Result:**

### 4.2 As user A, SELECT user B's profile_items

```sql
-- With A's profile from 4.1, insert some item first (as A).
insert into public.profile_items (profile_id, type, canonical_text)
  values ((select id from public.profiles where user_id = '<UUID-A>'), 'skill', 'sql');

-- Now as user B, try to read A's items:
select count(*) from public.profile_items
  where profile_id = (select id from public.profiles where user_id = '<UUID-A>');
```

**Expected:** returns `count = 0` (0 rows — RLS hides them; this is NOT an error).

**Result:**

### 4.3 As user A, INSERT profile with user_id = B

```sql
insert into public.profiles (user_id) values ('<UUID-B>');
```

**Expected:** insert fails with a row-level security violation (or 0 rows inserted — policy `with check` rejects).

**Result:**

## 5. Sign-off

- [ ] All three checks returned the expected outcomes.
- [ ] Owner confirms Task 3 is ready for Task 4 (repository layer).
