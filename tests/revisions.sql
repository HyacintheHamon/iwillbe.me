begin;
insert into auth.users(id,aud,role) values
  ('44444444-4444-4444-8444-444444444444','authenticated','authenticated'),
  ('55555555-5555-4555-8555-555555555555','authenticated','authenticated');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',true);
insert into public.profiles(id,display_name) values('44444444-4444-4444-8444-444444444444','Original');
insert into public.journey_entries(id,user_id,kind,entry) values(
  '66666666-6666-4666-8666-666666666666','44444444-4444-4444-8444-444444444444','story',
  '{"id":"66666666-6666-4666-8666-666666666666","kind":"story","title":"A story","body":"Original"}');
do $$ declare affected integer; begin
  update public.profiles set display_name='From the first device'
    where id='44444444-4444-4444-8444-444444444444' and revision=1;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Initial CAS update failed'; end if;
  update public.profiles set display_name='Stale overwrite'
    where id='44444444-4444-4444-8444-444444444444' and revision=1;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Stale profile overwrote current data'; end if;
  if not exists(select 1 from public.profiles where display_name='From the first device' and revision=2) then
    raise exception 'Revision did not advance or saved content changed';
  end if;
  update public.journey_entries set entry=jsonb_set(entry,'{body}','"Newer story"')
    where id='66666666-6666-4666-8666-666666666666' and revision=1;
  delete from public.journey_entries where id='66666666-6666-4666-8666-666666666666' and revision=1;
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'Stale delete removed a newer story'; end if;
  -- An old client update still advances revisions, so a new client detects it.
  update public.profiles set display_name='Legacy client update' where id='44444444-4444-4444-8444-444444444444';
  if not exists(select 1 from public.profiles where revision=3) then raise exception 'Legacy update not versioned'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}',true);
do $$ begin
  update public.profiles set display_name='Cross owner' where id='44444444-4444-4444-8444-444444444444' and revision=3;
  if found then raise exception 'Cross-owner revision update permitted'; end if;
  if exists(select 1 from public.journey_entries where id='66666666-6666-4666-8666-666666666666') then
    raise exception 'Cross-owner revision read permitted';
  end if;
end $$;
reset role;
select 'PASS: atomic stale edit/delete guards, legacy revision increments and unchanged owner isolation' result;
rollback;
