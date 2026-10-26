-- Optional, self-provided attribution. Existing replies remain unnamed.
alter table public.friend_suggestions
  add column friend_name text,
  add constraint friend_suggestions_name_check check (
    friend_name is null or (
      char_length(friend_name) between 1 and 80
      and friend_name = btrim(friend_name)
      and friend_name !~ '[[:cntrl:]]'
    )
  );

-- A distinct name preserves the original three-argument RPC and avoids
-- PostgREST overload ambiguity for clients already using it.
create function public.submit_named_friend_suggestion(
  p_hash text,
  p_nonce uuid,
  p_content text,
  p_friend_name text
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  inv public.shared_invitations;
  normalized_name text := nullif(btrim(p_friend_name), '');
begin
  if p_nonce is null or p_content is null
     or char_length(btrim(p_content)) not between 1 and 500
     or (p_friend_name is not null and (
       char_length(p_friend_name) > 80 or p_friend_name ~ '[[:cntrl:]]'
     )) then
    raise exception 'Invalid suggestion or friend name' using errcode = '22023';
  end if;

  -- Serialize submissions to an invitation so the reply bound is atomic.
  select * into inv from public.shared_invitations
  where token_hash = p_hash and kind = 'friend' and expires_at > now()
  for update;
  if inv.id is null then
    raise exception 'Invitation unavailable';
  end if;

  -- A retry never changes the first reply or its attribution, even at capacity.
  if exists (
    select 1 from public.friend_suggestions
    where invitation_id = inv.id and nonce = p_nonce
  ) then return; end if;

  if (select count(*) from public.friend_suggestions where invitation_id = inv.id) >= 10 then
    raise exception 'This invitation has enough replies';
  end if;

  insert into public.friend_suggestions(invitation_id, user_id, nonce, content, friend_name)
  values(inv.id, inv.user_id, p_nonce, btrim(p_content), normalized_name);
end;
$$;

-- Only the authenticated Edge Function may submit a token-based public reply.
-- Owner SELECT/DELETE permissions and existing RLS policies are unchanged.
revoke all on function public.submit_named_friend_suggestion(text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_named_friend_suggestion(text, uuid, text, text)
  to service_role;
