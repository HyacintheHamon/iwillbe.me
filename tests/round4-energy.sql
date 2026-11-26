-- Regression coverage: energy is an explicit observation, not proof of completion.
-- Runs inside the local database verification and rolls all fixtures back.
begin;
insert into auth.users(id) values
  ('a4000000-0000-4000-8000-000000000001'),
  ('a4000000-0000-4000-8000-000000000002');
insert into public.profiles(id) values
  ('a4000000-0000-4000-8000-000000000001'),
  ('a4000000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','a4000000-0000-4000-8000-000000000001',true);
do $$
declare
  result text;
  feeling text;
  focus uuid;
  day_offset integer := 0;
  affected integer;
begin
  foreach result in array array['yes','partly','not_yet'] loop
    foreach feeling in array array['lit','neutral','drained'] loop
      focus := gen_random_uuid();
      day_offset := day_offset + 1;
      insert into public.intentions(id,user_id,day,action,value)
        values(focus,auth.uid(),current_date-day_offset,'A priority focus without an interest','kind');
      insert into public.check_ins(intention_id,user_id,outcome,reflection,energy)
        values(focus,auth.uid(),result,'My explicit answer',feeling);
      if not exists(select 1 from public.check_ins where intention_id=focus and outcome=result and energy=feeling) then
        raise exception 'Explicit energy lost for outcome % / feeling %',result,feeling;
      end if;
    end loop;
  end loop;
  -- Updating a not-yet focus keeps CAS protection and the explicit energy.
  update public.check_ins set energy='neutral' where intention_id=focus and revision=1;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Initial energy CAS update failed'; end if;
  if not exists(select 1 from public.check_ins where intention_id=focus and outcome='not_yet' and energy='neutral' and revision=2) then
    raise exception 'Energy edit changed outcome or failed to advance revision';
  end if;
  update public.check_ins set energy='lit' where intention_id=focus and revision=1;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Stale energy update overwrote current data'; end if;
  begin
    update public.check_ins set energy='happy' where intention_id=focus;
    raise exception 'Invalid energy accepted';
  exception when check_violation then null;
  end;
end $$;

-- Importing a guest priority-only focus also keeps a not-yet energy answer.
select public.import_local_practice(jsonb_build_object(
  'intentions',jsonb_build_array(
    jsonb_build_object('id','a4000000-0000-4000-8000-000000000003','day',current_date-30,'action','An imported priority focus','value','kind'),
    jsonb_build_object('id','a4000000-0000-4000-8000-000000000004','day',current_date-31,'action','An unanswered feeling','value','patient')
  ),
  'checkIns',jsonb_build_array(
    jsonb_build_object('intention_id','a4000000-0000-4000-8000-000000000003','outcome','not_yet','energy','drained'),
    jsonb_build_object('intention_id','a4000000-0000-4000-8000-000000000004','outcome','yes')
  )
));
do $$ begin
  if not exists(select 1 from public.check_ins where intention_id='a4000000-0000-4000-8000-000000000003' and outcome='not_yet' and energy='drained') then
    raise exception 'Explicit energy lost during guest import';
  end if;
  if not exists(select 1 from public.check_ins where intention_id='a4000000-0000-4000-8000-000000000004' and energy is null) then
    raise exception 'Missing energy was inferred during guest import';
  end if;
end $$;

select set_config('request.jwt.claim.sub','a4000000-0000-4000-8000-000000000002',true);
do $$ begin
  if exists(select 1 from public.check_ins where user_id='a4000000-0000-4000-8000-000000000001') then
    raise exception 'Another account can read private energy';
  end if;
  update public.check_ins set energy='lit' where intention_id='a4000000-0000-4000-8000-000000000003' and revision=1;
  if found then raise exception 'Another account can overwrite energy'; end if;
end $$;
reset role;
rollback;
