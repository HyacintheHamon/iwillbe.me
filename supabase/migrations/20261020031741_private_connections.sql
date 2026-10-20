-- Only the function exposes a bounded, explicitly shared projection via unguessable tokens.
create table public.shared_invitations (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 token_hash text not null unique, kind text not null check(kind in ('comet','friend','coach')),
 sender_name text not null check(char_length(sender_name)<=80), message text not null check(char_length(message)<=1000),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '30 days'
);
create index invitations_owner on public.shared_invitations(user_id,created_at);
alter table public.shared_invitations enable row level security;
revoke all on public.shared_invitations from anon,authenticated;
grant select,delete on public.shared_invitations to authenticated;
grant all on public.shared_invitations to service_role;
create policy invitation_owner on public.shared_invitations for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create table public.friend_suggestions (
 id uuid primary key default gen_random_uuid(), invitation_id uuid not null references public.shared_invitations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, nonce uuid not null, content text not null check(char_length(content) between 1 and 500), created_at timestamptz not null default now(), unique(invitation_id,nonce)
);
create index suggestions_owner on public.friend_suggestions(user_id);
alter table public.friend_suggestions enable row level security;
revoke all on public.friend_suggestions from anon,authenticated;
grant select,delete on public.friend_suggestions to authenticated;
grant all on public.friend_suggestions to service_role;
create policy suggestion_owner on public.friend_suggestions for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create function public.submit_friend_suggestion(p_hash text,p_nonce uuid,p_content text) returns void language plpgsql security invoker set search_path='' as $$
declare inv public.shared_invitations;
begin
 select * into inv from public.shared_invitations where token_hash=p_hash and kind='friend' and expires_at>now() for update;
 if inv.id is null then raise exception 'Invitation unavailable'; end if;
 if (select count(*) from public.friend_suggestions where invitation_id=inv.id)>=10 then raise exception 'This invitation has enough replies';end if;
 insert into public.friend_suggestions(invitation_id,user_id,nonce,content) values(inv.id,inv.user_id,p_nonce,p_content) on conflict do nothing;
end;
$$;
revoke all on function public.submit_friend_suggestion(text,uuid,text) from public,anon,authenticated;
grant execute on function public.submit_friend_suggestion(text,uuid,text) to service_role;
-- Sponsored access is administered server-side. No sponsor can query a member's practice.
create table public.sponsor_codes (code_hash text primary key, label text not null, seats integer not null check(seats>0),expires_at timestamptz not null);
alter table public.sponsor_codes enable row level security;
revoke all on public.sponsor_codes from anon,authenticated;
grant all on public.sponsor_codes to service_role;
create table public.entitlements (user_id uuid primary key references auth.users(id) on delete cascade,source text not null,code_hash text references public.sponsor_codes(code_hash),expires_at timestamptz not null);
alter table public.entitlements enable row level security;
revoke all on public.entitlements from anon,authenticated;
grant select on public.entitlements to authenticated;
grant all on public.entitlements to service_role;
create index entitlements_code on public.entitlements(code_hash);
create policy entitlement_owner on public.entitlements for select to authenticated using((select auth.uid())=user_id);
create function public.redeem_sponsor_code(p_hash text,p_user uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare c public.sponsor_codes;
begin
 select * into c from public.sponsor_codes where code_hash=p_hash and expires_at>now() for update;
 if c.code_hash is null then return false;end if;
 if exists(select 1 from public.entitlements where user_id=p_user and code_hash=p_hash) then return true;end if;
 if (select count(*) from public.entitlements where code_hash=p_hash)>=c.seats then return false;end if;
 insert into public.entitlements(user_id,source,code_hash,expires_at) values(p_user,'sponsored',p_hash,c.expires_at) on conflict(user_id) do update set source='sponsored',code_hash=excluded.code_hash,expires_at=excluded.expires_at;
 return true;
end;
$$;
revoke all on function public.redeem_sponsor_code(text,uuid) from public,anon,authenticated;
grant execute on function public.redeem_sponsor_code(text,uuid) to service_role;
