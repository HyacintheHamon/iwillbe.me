-- Import integration checks run under real RLS. No rows survive the rollback.
begin;
insert into auth.users(id,aud,role) values
 ('33333333-3333-4333-8333-333333333333','authenticated','authenticated'),
 ('44444444-4444-4444-8444-444444444444','authenticated','authenticated');
insert into public.profiles(id,display_name) values ('33333333-3333-4333-8333-333333333333','Keep account profile');
insert into public.intentions(id,user_id,day,action,value) values
 ('33333333-aaaa-4333-8333-333333333333','33333333-3333-4333-8333-333333333333','2026-10-19','Keep account intention','Presence');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',true);
do $$
declare
 p jsonb := '{"profile":{"display_name":"Local profile","values":["Connection"],"interests":["Cooking"]},"intentions":[{"id":"33333333-bbbb-4333-8333-333333333333","day":"2026-10-18","action":"Cook together","value":"Connection","interest":"Cooking","person":"Sam"},{"id":"33333333-cccc-4333-8333-333333333333","day":"2026-10-19","action":"Conflicting local intention","value":"Kindness"}],"checkIns":[{"intention_id":"33333333-bbbb-4333-8333-333333333333","outcome":"yes","reflection":"A good moment"},{"intention_id":"33333333-cccc-4333-8333-333333333333","outcome":"partly"}],"memories":[{"id":"33333333-dddd-4333-8333-333333333333","content":"A fictional local note"}]}';
 result jsonb;
begin
 result := public.import_local_practice(p);
 if (result->>'imported')::int <> 1 or jsonb_array_length(result->'skipped_days') <> 1 then raise exception 'incorrect import result: %', result; end if;
 if (select count(*) from public.intentions) <> 2 then raise exception 'import lost or duplicated intentions'; end if;
 if (select count(*) from public.check_ins) <> 1 then raise exception 'conflicting reflection imported'; end if;
 if (select display_name from public.profiles) <> 'Keep account profile' then raise exception 'profile overwritten'; end if;
 if (select action from public.intentions where day='2026-10-19') <> 'Keep account intention' then raise exception 'account day overwritten'; end if;
 result := public.import_local_practice(p);
 if (result->>'imported')::int <> 0 or (select count(*) from public.memories) <> 1 then raise exception 'retry was not idempotent'; end if;
 begin
   perform public.import_local_practice('{"intentions":[{"id":"33333333-eeee-4333-8333-333333333333","day":"2026-10-17","action":"Must roll back","value":"Presence"}],"checkIns":[{"intention_id":"33333333-eeee-4333-8333-333333333333","outcome":"invalid"}]}');
   raise exception 'invalid reflection was accepted';
 exception when check_violation then null; end;
 if (select count(*) from public.intentions) <> 2 then raise exception 'partial import survived failed transaction'; end if;
 begin
   update public.intentions set interest='Reading' where id='33333333-bbbb-4333-8333-333333333333';
   raise exception 'reflected interest changed';
 exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',true);
do $$ begin
 if (select count(*) from public.intentions) <> 0 then raise exception 'cross-account read'; end if;
 perform public.import_local_practice('{"profile":{"display_name":"New account"},"checkIns":[{"intention_id":"33333333-bbbb-4333-8333-333333333333","outcome":"yes"}]}');
 if (select count(*) from public.check_ins) <> 0 then raise exception 'cross-account reflection import'; end if;
 if (select display_name from public.profiles) <> 'New account' then raise exception 'new profile not imported'; end if;
end $$;
set local role anon;
do $$ begin
 begin
   perform public.import_local_practice('{}');
   raise exception 'anonymous import allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: atomic import, conflict preservation, retry, profile continuity, reflected interest lock, RLS and anonymous denial' as result;
rollback;
