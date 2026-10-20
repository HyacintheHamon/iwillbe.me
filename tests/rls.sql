-- Transactional integration check: no users, email or journal rows survive.
begin;
insert into auth.users(id, aud, role) values
 ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated'),
 ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated');
insert into public.profiles(id,display_name) values
 ('11111111-1111-4111-8111-111111111111','Test A'),
 ('22222222-2222-4222-8222-222222222222','Test B');
insert into public.intentions(id,user_id,day,action,value) values
 ('11111111-aaaa-4111-8111-111111111111','11111111-1111-4111-8111-111111111111',current_date,'Test action A','Kindness'),
 ('22222222-aaaa-4222-8222-222222222222','22222222-2222-4222-8222-222222222222',current_date,'Test action B','Curiosity');
insert into public.memories(user_id,content) values
 ('11111111-1111-4111-8111-111111111111','Test memory A'),
 ('22222222-2222-4222-8222-222222222222','Test memory B');
insert into public.messages(user_id,role,content) values
 ('11111111-1111-4111-8111-111111111111','user','Test message A'),
 ('22222222-2222-4222-8222-222222222222','user','Test message B');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
do $$ begin
 if (select count(*) from public.profiles) <> 1 then raise exception 'profile isolation failed'; end if;
 if (select count(*) from public.intentions) <> 1 then raise exception 'intention isolation failed'; end if;
 if (select count(*) from public.memories) <> 1 then raise exception 'memory isolation failed'; end if;
 if (select count(*) from public.messages) <> 1 then raise exception 'message isolation failed'; end if;
 update public.profiles set display_name='Must not change' where id='22222222-2222-4222-8222-222222222222';
 if found then raise exception 'cross-user update allowed'; end if;
 begin
   insert into public.memories(user_id,content) values('22222222-2222-4222-8222-222222222222','Forbidden');
   raise exception 'cross-user insert allowed';
 exception when insufficient_privilege then null; end;
 begin
   insert into public.check_ins(intention_id,user_id,outcome) values('22222222-aaaa-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','yes');
   raise exception 'cross-owner reflection allowed';
 exception when foreign_key_violation then null; end;
 begin
   insert into public.messages(user_id,role,content) values('11111111-1111-4111-8111-111111111111','assistant','Forged');
   raise exception 'forged assistant message allowed';
 exception when insufficient_privilege then null; end;
 begin
   perform public.reserve_chloe_request('11111111-1111-4111-8111-111111111111');
   raise exception 'client quota RPC allowed';
 exception when insufficient_privilege then null; end;
 insert into public.check_ins(intention_id,user_id,outcome) values('11111111-aaaa-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','yes');
 begin
   update public.intentions set action='Changed after reflection' where id='11111111-aaaa-4111-8111-111111111111';
   raise exception 'reflected intention changed';
 exception when check_violation then null; end;
end $$;
set local role anon;
do $$ begin
 begin
   perform * from public.intentions;
   raise exception 'anonymous journal access allowed';
 exception when insufficient_privilege then null; end;
end $$;
set local role service_role;
do $$ begin
 for i in 1..30 loop
   if not public.reserve_chloe_request('11111111-1111-4111-8111-111111111111') then raise exception 'quota rejected early'; end if;
 end loop;
 if public.reserve_chloe_request('11111111-1111-4111-8111-111111111111') then raise exception 'quota exceeded'; end if;
end $$;
reset role;
select 'PASS: ownership, writes, reflection integrity, anonymous access, quota' as result;
rollback;
