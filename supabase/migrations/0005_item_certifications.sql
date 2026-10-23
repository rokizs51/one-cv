-- Certification becomes its own profile item type (and CV section).
-- The inline check from 0001 is auto-named profile_items_type_check.
alter table public.profile_items drop constraint if exists profile_items_type_check;

alter table public.profile_items add constraint profile_items_type_check check (type in (
  'career_snapshot',
  'education',
  'experience',
  'project',
  'certification',
  'award',
  'skill',
  'language'
));