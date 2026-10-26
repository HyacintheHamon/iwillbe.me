-- Run after named_friend_suggestions. All fixtures are rolled back.
begin;
insert into auth.users(id,aud,role) values
  ('44444444-4444-4444-8444-444444444444','authenticated','authenticated'),
  ('55555555-5555-4555-8555-555555555555','authenticated','authenticated');
insert into public.shared_invitations(id,user_id,token_hash,kind,sender_name,message)
values('66666666-6666-4666-8666-666666666666',
  '44444444-4444-4444-8444-444444444444',repeat('a',64),'friend','QA','What would I love?');

set local role service_role;
select public.submit_named_friend_suggestion(repeat('a',64),
  '77777777-7777-4777-8777-777777777777','  Try sketching walks  ','  Alex  ');
select public.submit_named_friend_suggestion(repeat('a',64),
  '77777777-7777-4777-8777-777777777777','A changed retry','Different name');
select public.submit_friend_suggestion(repeat('a',64),
  '88888888-8888-4888-8888-888888888888','An old-client suggestion');
select public.submit_named_friend_suggestion(repeat('a',64),
  '99999999-9999-4999-8999-999999999999','An unnamed suggestion','   ');
do $$ begin
  if not exists(select 1 from public.friend_suggestions
    where nonce='77777777-7777-4777-8777-777777777777'
    and friend_name='Alex' and content='Try sketching walks') then
    raise exception 'Name normalization or immutable retry failed';
  end if;
  if exists(select 1 from public.friend_suggestions
    where nonce in ('88888888-8888-4888-8888-888888888888','99999999-9999-4999-8999-999999999999')
    and friend_name is not null) then
    raise exception 'Unnamed or old-client reply gained a name';
  end if;
  begin
    perform public.submit_named_friend_suggestion(repeat('a',64),gen_random_uuid(),'Idea',repeat('x',81));
    raise exception 'Long friend name was accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.submit_named_friend_suggestion(repeat('a',64),gen_random_uuid(),'Idea','Alex'||chr(10)||'Someone');
    raise exception 'Control characters were accepted';
  exception when invalid_parameter_value then null; end;
end $$;

select public.submit_named_friend_suggestion(repeat('a',64),gen_random_uuid(),'Another idea',null)
from generate_series(1,7);
-- The same submission still succeeds after the invitation reaches its bound.
select public.submit_named_friend_suggestion(repeat('a',64),
  '77777777-7777-4777-8777-777777777777','Ignored retry','Ignored');
do $$ begin
  if (select count(*) from public.friend_suggestions where invitation_id='66666666-6666-4666-8666-666666666666') <> 10 then
    raise exception 'Replies were duplicated';
  end if;
  begin
    perform public.submit_named_friend_suggestion(repeat('a',64),gen_random_uuid(),'An excess reply',null);
    raise exception 'Reply limit was not enforced';
  exception when raise_exception then
    if sqlerrm <> 'This invitation has enough replies' then raise; end if;
  end;
end $$;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}',true);
do $$ begin
  if not exists(select 1 from public.friend_suggestions where friend_name='Alex') then
    raise exception 'Owner cannot read friend attribution';
  end if;
  begin
    perform public.submit_named_friend_suggestion(repeat('a',64),gen_random_uuid(),'Untrusted direct reply','Someone');
    raise exception 'Authenticated client can call the privileged RPC';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}',true);
do $$ begin
  if exists(select 1 from public.friend_suggestions where invitation_id='66666666-6666-4666-8666-666666666666') then
    raise exception 'Another owner can read a private suggestion or name';
  end if;
  delete from public.friend_suggestions where invitation_id='66666666-6666-4666-8666-666666666666';
  if found then raise exception 'Another owner can delete a private suggestion'; end if;
end $$;

set local role anon;
do $$ begin
  begin
    perform * from public.friend_suggestions;
    raise exception 'Anonymous suggestion-table access';
  exception when insufficient_privilege then null; end;
  begin
    perform public.submit_named_friend_suggestion(repeat('a',64),gen_random_uuid(),'Anonymous direct reply','Someone');
    raise exception 'Anonymous direct RPC access';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: optional friend attribution, legacy RPC, idempotent replies, limits and owner privacy' result;
rollback;
