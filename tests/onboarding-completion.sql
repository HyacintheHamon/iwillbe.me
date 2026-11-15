-- Exercise the actual final onboarding write as an authenticated owner.
-- All fixtures are transaction-local: no account, email or answer survives.
begin;
select set_config('test.onboarding_owner', gen_random_uuid()::text, true);
select set_config('test.onboarding_other', gen_random_uuid()::text, true);
insert into auth.users(id) values
  (current_setting('test.onboarding_owner')::uuid),
  (current_setting('test.onboarding_other')::uuid);
insert into public.profiles(id, values) values
  (current_setting('test.onboarding_owner')::uuid,
   array['kind','loving','a good friend','there for family','loyal','respectful','fair','good with people']),
  (current_setting('test.onboarding_other')::uuid, '{}');
insert into public.journey_entries(id,user_id,kind,entry) values
  (gen_random_uuid(), current_setting('test.onboarding_owner')::uuid, 'story',
   '{"kind":"story","title":"Earlier onboarding answer","body":"Keep this answer"}');
select set_config('request.jwt.claim.sub', current_setting('test.onboarding_owner'), true);
select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('test.onboarding_owner'), 'role', 'authenticated'
)::text, true);
set local role authenticated;
do $$
declare
  owner_id uuid := current_setting('test.onboarding_owner')::uuid;
  other_id uuid := current_setting('test.onboarding_other')::uuid;
  priorities text[] := array['kind','loving','a good friend','there for family','loyal',
    'respectful','fair','good with people','a team player','a leader'];
  answers jsonb;
  expected integer := 1;
  affected integer;
  failed_constraint text;
begin
  -- Go to Today, partially skipped answers, and skipping all baseline questions.
  foreach answers in array array['[0,10,9]'::jsonb, '[null,7,null]'::jsonb, '[null,null,null]'::jsonb] loop
    update public.profiles set values=priorities, baseline_answers=answers, onboarded=true
      where id=owner_id and revision=expected;
    get diagnostics affected=row_count;
    if affected<>1 then raise exception 'Final onboarding save did not update its owner'; end if;
    expected := expected + 1;
    if not exists(select 1 from public.profiles where id=owner_id
      and values=priorities and baseline_answers=answers and onboarded and revision=expected) then
      raise exception 'Onboarding answers or priorities were lost';
    end if;
  end loop;
  if not exists(select 1 from public.journey_entries where user_id=owner_id
    and entry->>'body'='Keep this answer') then
    raise exception 'Earlier onboarding answer was lost';
  end if;
  -- Keep a bounded array and verify a rejected save cannot change saved answers.
  begin
    update public.profiles set values=array_append(priorities, 'forgiving') where id=owner_id;
    raise exception 'An eleventh priority was accepted';
  exception when check_violation then
    get stacked diagnostics failed_constraint=constraint_name;
    if failed_constraint<>'profiles_values_check' then raise; end if;
  end;
  if not exists(select 1 from public.profiles where id=owner_id
    and values=priorities and revision=expected and onboarded) then
    raise exception 'Rejected write changed saved onboarding';
  end if;
  update public.profiles set onboarded=false where id=owner_id and revision=1;
  if found then raise exception 'A stale save overwrote completed onboarding'; end if;
  update public.profiles set values=priorities, onboarded=true where id=other_id;
  if found then raise exception 'An owner changed another account'; end if;
  if exists(select 1 from public.profiles where id=other_id) then
    raise exception 'An owner read another account';
  end if;
end;
$$;
rollback;
select 'PASS: ten priorities, answered/skipped baseline, prior answers, bounds, revisions and owner isolation' as result;
