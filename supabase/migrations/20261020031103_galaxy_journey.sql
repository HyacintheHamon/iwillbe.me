-- Preserve the original rows. Missing energy and value choice stay unknown.
alter table public.intentions drop constraint intentions_value_check;
alter table public.intentions add constraint intentions_value_check check (char_length(value)<=80);
alter table public.intentions add column planet text not null default 'Be' check (planet in ('Be','People','Causes','Passions','Grow','Surprise'));
alter table public.intentions add column kind text not null default 'action' check (kind in ('action','be'));
alter table public.intentions add column when_context text not null default '' check (char_length(when_context)<=200);
alter table public.intentions add column place text not null default '' check (char_length(place)<=120);
alter table public.intentions add column with_person text not null default '' check (char_length(with_person)<=120);
alter table public.check_ins add column energy text check (energy in ('lit','neutral','drained'));
alter table public.check_ins add column value_choice text check (value_choice in ('yes','not_sure','not_mine'));
create or replace function public.protect_reflected_intention() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if (to_jsonb(new)-'updated_at') is distinct from (to_jsonb(old)-'updated_at')
     and exists(select 1 from public.check_ins where intention_id=old.id) then
    raise exception 'This intention already has a reflection.' using errcode='23514';
  end if;
  return new;
end;
$$;
create table public.journey_entries (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('interest','value','strength','person','why','story','vision','review','question','backlog','preferences','event')),
 entry jsonb not null,
 updated_at timestamptz not null default now(),
 check (jsonb_typeof(entry)='object' and entry->>'id'=id::text and entry->>'kind'=kind),
 check (char_length(entry::text)<=18000 and char_length(entry->>'title')<=500 and char_length(entry->>'body')<=6000)
);
create unique index journey_review_period on public.journey_entries(user_id, (entry->'meta'->>'period')) where kind='review' and entry->'meta'->>'period' is not null;
create index journey_entries_owner_kind on public.journey_entries(user_id,kind);
alter table public.journey_entries enable row level security;
revoke all on public.journey_entries from anon,authenticated;
grant select,insert,update,delete on public.journey_entries to authenticated;
grant all on public.journey_entries to service_role;
create policy journey_owner on public.journey_entries for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
-- Stable entries for legacy labels, explicitly unconfirmed rather than invented discoveries.
insert into public.journey_entries(id,user_id,kind,entry)
select x.id,p.id,x.kind,jsonb_build_object('id',x.id,'kind',x.kind,'title',x.label,'body','','state','unconfirmed','source','Imported from your earlier practice','source_ids','[]'::jsonb,'meta','{}'::jsonb,'created_at',now(),'updated_at',now())
from public.profiles p cross join lateral (
 select gen_random_uuid() id, 'interest' kind, unnest(p.interests) label
 union all select gen_random_uuid(), 'value', unnest(p.values)
) x;
-- Interests captured by an earlier daily ritual also remain visible.
insert into public.journey_entries(id,user_id,kind,entry)
select x.id,x.user_id,x.kind,jsonb_build_object('id',x.id,'kind',x.kind,'title',x.label,'body','','state','unconfirmed','source','Imported from an earlier intention','source_ids','[]'::jsonb,'meta','{}'::jsonb,'created_at',now(),'updated_at',now())
from (select gen_random_uuid() id, user_id,kind,label from (
 select distinct user_id,'interest' kind,interest label from public.intentions where interest<>''
 union select distinct user_id,'interest',value from public.intentions where interest='' and value in ('Ceramics','Reading','Cooking','Nature','Music','Learning')
 union select distinct user_id,'value',value from public.intentions where value<>'' and value not in ('Ceramics','Reading','Cooking','Nature','Music','Learning')
) labels) x where not exists(select 1 from public.journey_entries e where e.user_id=x.user_id and e.kind=x.kind and e.entry->>'title'=x.label);
-- Extend the existing atomic import, preserving its no-overwrite behavior.
alter function public.import_local_practice(jsonb) rename to import_local_practice_v1;
create or replace function public.import_local_practice_v1(practice jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  owner uuid := auth.uid();
  p jsonb := coalesce(practice->'profile', '{}'::jsonb);
  imported integer;
  skipped jsonb;
begin
  if owner is null then raise exception 'Authentication required'; end if;
  insert into public.profiles(id, display_name, north_star, values, interests, onboarded, timezone, morning_time, evening_time)
  values(owner, coalesce(p->>'display_name',''), coalesce(p->>'north_star',''),
    array(select jsonb_array_elements_text(coalesce(p->'values','[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(p->'interests','[]'::jsonb))),
    coalesce((p->>'onboarded')::boolean,false), coalesce(p->>'timezone','UTC'),
    coalesce(p->>'morning_time','08:00'), coalesce(p->>'evening_time','20:30'))
  on conflict(id) do nothing;

  insert into public.intentions(id,user_id,day,action,value,person,interest,planet,kind,when_context,place,with_person,created_at)
  select i.id,owner,i.day,i.action,i.value,coalesce(i.person,''),coalesce(i.interest,''),coalesce(i.planet,'Be'),coalesce(i.kind,'action'),coalesce(i.when_context,''),coalesce(i.place,''),coalesce(i.with_person,''),coalesce(i.created_at,now())
  from jsonb_to_recordset(coalesce(practice->'intentions','[]'::jsonb))
    as i(id uuid,day date,action text,value text,person text,interest text,planet text,kind text,when_context text,place text,with_person text,created_at timestamptz)
  on conflict do nothing;
  get diagnostics imported = row_count;

  insert into public.check_ins(intention_id,user_id,outcome,reflection,energy,value_choice,created_at)
  select c.intention_id,owner,c.outcome,coalesce(c.reflection,''),c.energy,c.value_choice,coalesce(c.created_at,now())
  from jsonb_to_recordset(coalesce(practice->'checkIns','[]'::jsonb))
    as c(intention_id uuid,outcome text,reflection text,energy text,value_choice text,created_at timestamptz)
  join public.intentions i on i.id=c.intention_id and i.user_id=owner
  on conflict do nothing;

  insert into public.memories(id,user_id,content,source,created_at)
  select m.id,owner,m.content,coalesce(m.source,'Added by you'),coalesce(m.created_at,now())
  from jsonb_to_recordset(coalesce(practice->'memories','[]'::jsonb))
    as m(id uuid,content text,source text,created_at timestamptz)
  on conflict do nothing;

  select coalesce(jsonb_agg(i.day),'[]'::jsonb) into skipped
  from jsonb_to_recordset(coalesce(practice->'intentions','[]'::jsonb)) as i(id uuid,day date)
  join public.intentions a on a.user_id=owner and a.day=i.day and a.id<>i.id;
  return jsonb_build_object('imported',imported,'skipped_days',skipped);
end;
$$;

create function public.import_local_practice(practice jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; e jsonb; i jsonb; c jsonb;
begin
 result := public.import_local_practice_v1(practice);
 for e in select value from jsonb_array_elements(coalesce(practice->'entries','[]'::jsonb)) loop
   insert into public.journey_entries(id,user_id,kind,entry) values((e->>'id')::uuid,auth.uid(),e->>'kind',e) on conflict do nothing;
 end loop;
 return result;
end;
$$;
revoke all on function public.import_local_practice(jsonb) from public,anon;
grant execute on function public.import_local_practice(jsonb) to authenticated;
-- Content-free usage data; no journal text or answers.
create table public.product_events (
 id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete cascade,
 event text not null check(event in ('activation','intention_saved','reflection_saved','review_saved','ai_response')),
 duration_ms integer, input_tokens integer, output_tokens integer, created_at timestamptz default now()
);
alter table public.product_events enable row level security;
revoke all on public.product_events from anon,authenticated;
grant insert,select,delete on public.product_events to authenticated;
grant all on public.product_events to service_role;
create policy event_owner on public.product_events for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create index product_events_owner on public.product_events(user_id,created_at);
create table public.product_feedback (id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete cascade,content text not null check(char_length(content) between 1 and 2000),created_at timestamptz default now());
alter table public.product_feedback enable row level security;
revoke all on public.product_feedback from anon,authenticated;
grant insert,select,delete on public.product_feedback to authenticated;
grant all on public.product_feedback to service_role;
create policy feedback_owner on public.product_feedback for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create index feedback_owner_idx on public.product_feedback(user_id);
