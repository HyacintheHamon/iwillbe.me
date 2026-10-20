-- iwillbe.me: private, user-owned daily practice. No public journal access.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name)<=80),
  north_star text not null default '' check (char_length(north_star)<=100),
  values text[] not null default '{}' check (cardinality(values)<=8),
  interests text[] not null default '{}' check (cardinality(interests)<=8),
  onboarded boolean not null default false,
  timezone text not null default 'UTC',
  morning_time text not null default '08:00' check (morning_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  evening_time text not null default '20:30' check (evening_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
create table public.intentions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  action text not null check (char_length(btrim(action)) between 1 and 500),
  value text not null check (char_length(value) between 1 and 80),
  person text not null default '' check (char_length(person)<=120),
  created_at timestamptz not null default now(),
  unique(user_id,day), unique(id,user_id)
);
create table public.check_ins (
  intention_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  outcome text not null check(outcome in ('yes','partly','not_yet')),
  reflection text not null default '' check(char_length(reflection)<=2000),
  created_at timestamptz not null default now(),
  foreign key (intention_id,user_id) references public.intentions(id,user_id) on delete cascade
);
create index check_ins_user_idx on public.check_ins(user_id);
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check(char_length(btrim(content)) between 1 and 1000),
  source text not null default 'Added by you' check(char_length(source)<=200),
  created_at timestamptz not null default now()
);
create index memories_user_idx on public.memories(user_id);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check(role in ('user','assistant')),
  content text not null check(char_length(content) between 1 and 6000),
  created_at timestamptz not null default now()
);
create index messages_user_time_idx on public.messages(user_id,created_at desc);
create table public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  requests integer not null default 0,
  primary key(user_id,window_start)
);

alter table public.profiles enable row level security;
alter table public.intentions enable row level security;
alter table public.check_ins enable row level security;
alter table public.memories enable row level security;
alter table public.messages enable row level security;
alter table public.ai_usage enable row level security;
revoke all on public.profiles,public.intentions,public.check_ins,public.memories,public.messages,public.ai_usage from anon,authenticated;
grant select,insert,update,delete on public.profiles,public.intentions,public.check_ins,public.memories to authenticated;
grant select,delete on public.messages to authenticated;
grant all on public.profiles,public.intentions,public.check_ins,public.memories,public.messages,public.ai_usage to service_role;
create policy own_profile on public.profiles for all to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
create policy own_intentions on public.intentions for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy own_check_ins on public.check_ins for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy own_memories on public.memories for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy own_messages_read on public.messages for select to authenticated using ((select auth.uid())=user_id);
create policy own_messages_delete on public.messages for delete to authenticated using ((select auth.uid())=user_id);

-- An intention cannot change its meaning once reflected upon.
create function public.protect_reflected_intention() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if (new.action,new.value,new.person,new.day) is distinct from (old.action,old.value,old.person,old.day)
     and exists(select 1 from public.check_ins where intention_id=old.id) then
    raise exception 'This intention already has a reflection.' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_reflected_intention() from public,anon,authenticated;
create trigger reflected_intention_guard before update on public.intentions for each row execute function public.protect_reflected_intention();

-- Atomic quota reservation, callable only by our authenticated server.
create function public.reserve_chloe_request(p_user_id uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare accepted integer;
begin
  insert into public.ai_usage(user_id,window_start,requests) values(p_user_id,date_trunc('hour',now()),1)
  on conflict(user_id,window_start) do update set requests=public.ai_usage.requests+1 where public.ai_usage.requests<30
  returning requests into accepted;
  return accepted is not null;
end;
$$;
revoke all on function public.reserve_chloe_request(uuid) from public,anon,authenticated;
grant execute on function public.reserve_chloe_request(uuid) to service_role;
