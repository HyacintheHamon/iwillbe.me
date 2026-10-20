begin;
insert into auth.users(id,aud,role) values('11111111-1111-4111-8111-111111111111','authenticated','authenticated'),('22222222-2222-4222-8222-222222222222','authenticated','authenticated');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
select public.import_local_practice('{"profile":{},"intentions":[{"id":"11111111-aaaa-4111-8111-111111111111","day":"2026-10-19","action":"Try drawing","value":"","interest":"Drawing","planet":"Passions","when_context":"After lunch"}],"checkIns":[{"intention_id":"11111111-aaaa-4111-8111-111111111111","outcome":"yes","energy":"lit","value_choice":null}],"entries":[{"id":"33333333-3333-4333-8333-333333333333","kind":"interest","title":"Drawing","body":"","state":"spark","source":"Test","source_ids":[],"meta":{},"created_at":"2026-10-19T12:00:00Z","updated_at":"2026-10-19T12:00:00Z"}]}');
do $$ begin
 if (select energy from public.check_ins limit 1)<>'lit' then raise exception 'Energy lost during import';end if;
 if (select when_context from public.intentions limit 1)<>'After lunch' then raise exception 'Commitment details lost';end if;
 if (select count(*) from public.journey_entries)<>1 then raise exception 'Discovery lost';end if;
 begin
 update public.journey_entries set user_id='22222222-2222-4222-8222-222222222222';raise exception 'Owner reassignment allowed';
 exception when insufficient_privilege then null;end;
 begin
 update public.intentions set when_context='Different meaning';raise exception 'Reflected context mutable';
 exception when check_violation then null;end;
 begin
 perform public.redeem_sponsor_code('fake','22222222-2222-4222-8222-222222222222');raise exception 'Client can call privileged redemption';
 exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.journey_entries) then raise exception 'Private discovery visible cross-owner';end if;
 if exists(select 1 from public.check_ins) then raise exception 'Private energy visible cross-owner';end if;
 delete from public.journey_entries;if found then raise exception 'Cross-owner delete allowed';end if;
end $$;
set local role anon;
do $$ begin
 begin perform * from public.journey_entries;raise exception 'Anonymous journal access';exception when insufficient_privilege then null;end;
 begin perform * from public.shared_invitations;raise exception 'Anonymous invitation table access';exception when insufficient_privilege then null;end;
 begin perform public.submit_friend_suggestion('fake','11111111-1111-4111-8111-111111111111','test');raise exception 'Anonymous privileged function access';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS: new import fields, discovery ownership, immutable reflections, private invitations and entitlements' result;
rollback;
