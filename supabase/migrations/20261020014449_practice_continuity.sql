-- Optional, explicitly chosen activity; existing intentions keep their meaning.
alter table public.intentions add column interest text not null default '' check (char_length(interest)<=80);
create or replace function public.protect_reflected_intention() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if (new.action,new.value,new.person,new.day,new.interest) is distinct from (old.action,old.value,old.person,old.day,old.interest)
     and exists(select 1 from public.check_ins where intention_id=old.id) then
    raise exception 'This intention already has a reflection.' using errcode='23514';
  end if;
  return new;
end;
$$;

-- One transaction, caller's RLS, no overwrites, safe to retry after a lost response.
create function public.import_local_practice(practice jsonb) returns jsonb
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

  insert into public.intentions(id,user_id,day,action,value,person,interest,created_at)
  select i.id,owner,i.day,i.action,i.value,coalesce(i.person,''),coalesce(i.interest,''),coalesce(i.created_at,now())
  from jsonb_to_recordset(coalesce(practice->'intentions','[]'::jsonb))
    as i(id uuid,day date,action text,value text,person text,interest text,created_at timestamptz)
  on conflict do nothing;
  get diagnostics imported = row_count;

  insert into public.check_ins(intention_id,user_id,outcome,reflection,created_at)
  select c.intention_id,owner,c.outcome,coalesce(c.reflection,''),coalesce(c.created_at,now())
  from jsonb_to_recordset(coalesce(practice->'checkIns','[]'::jsonb))
    as c(intention_id uuid,outcome text,reflection text,created_at timestamptz)
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
revoke all on function public.import_local_practice(jsonb) from public,anon;
grant execute on function public.import_local_practice(jsonb) to authenticated;
