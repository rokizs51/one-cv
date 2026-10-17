-- 0003_account_delete.sql
-- Hard account deletion (spec: private by default, deletion in v1). The app
-- deliberately never holds the service key, but a real delete must remove
-- the auth.users row or re-login would resurrect an empty account. A
-- SECURITY DEFINER function owned by postgres performs the full cascade in
-- one atomic pass; the caller's JWT only decides WHICH row (auth.uid()).
-- Sessions/refresh tokens cascade from auth.users inside GoTrue's schema.

create or replace function public.delete_current_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'authentication required';
  end if;

  delete from public.generated_resumes where owner = uid;
  delete from public.job_descriptions  where owner = uid;
  delete from public.generation_quota  where user_id = uid;
  delete from public.profiles          where user_id = uid;  -- items cascade via profile_id

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_current_user() from public;
revoke execute on function public.delete_current_user() from anon;
grant execute on function public.delete_current_user() to authenticated;
