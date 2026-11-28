-- Monthly catalogue metrics contain only public mission IDs and aggregate counts.
-- Current analytics consent applies to every reported month, including past activity.
create index if not exists journey_privacy_latest
  on public.journey_entries(user_id,updated_at desc,id desc)
  where kind='preferences' and entry->>'title'='Privacy';
create index if not exists journey_mission_feedback_day
  on public.journey_entries((entry #>> '{meta,feedback_day}'),user_id)
  where kind='event' and entry->>'title'='Mission feedback';

create function private.mission_recommendation_metrics(p_month date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  month_end date;
  result jsonb;
begin
  -- Role membership, never user-editable JWT metadata, grants access. Keep this
  -- guard inside the privileged function as well as the function ACLs below.
  if coalesce(pg_catalog.current_setting('role',true),'') <> 'service_role'
     and session_user <> 'service_role' then
    raise exception 'Mission metrics require the service role.' using errcode='42501';
  end if;
  if p_month is null or not pg_catalog.isfinite(p_month)
     or extract(day from p_month) <> 1
     or extract(year from p_month) not between 1 and 9999 then
    raise exception 'Choose the first day of a valid report month.' using errcode='22023';
  end if;
  month_end := (p_month + interval '1 month')::date;

  with latest_privacy as materialized (
    select distinct on (e.user_id) e.user_id, e.entry #> '{meta,analytics}' as analytics
    from public.journey_entries e
    where e.kind='preferences' and e.entry->>'title'='Privacy'
    order by e.user_id,e.updated_at desc,e.id desc
  ), consented as materialized (
    select p.user_id from latest_privacy p where p.analytics='true'::jsonb
  ), feedback_days as (
    -- One count per person, mission, local day and action. Distinct surface IDs,
    -- retries and rerenders do not inflate these monthly counts.
    select distinct e.user_id, m.id as mission_id,
      e.entry #>> '{meta,feedback_day}' as feedback_day,
      e.entry #>> '{meta,outcome}' as outcome
    from public.journey_entries e
    join consented c on c.user_id=e.user_id
    join public.missions m on m.id=e.entry #>> '{meta,mission_id}' and m.user_id is null
    where e.kind='event' and e.entry->>'title'='Mission feedback'
      and e.entry #>> '{meta,outcome}' in ('shown','picked','passed')
      and e.entry #>> '{meta,feedback_day}' >= pg_catalog.to_char(p_month,'YYYY-MM-DD')
      and private.report_day(e.entry #>> '{meta,feedback_day}') < month_end
  ), feedback as (
    select f.mission_id,
      count(*) filter(where f.outcome='shown') as shown,
      count(*) filter(where f.outcome='picked') as picked,
      count(*) filter(where f.outcome='passed') as skipped
    from feedback_days f group by f.mission_id
  ), reflected_days as (
    select i.user_id,i.mission_id,i.day,
      bool_or(ci.outcome='yes') as done,
      bool_or(ci.energy='lit') as energy,
      bool_or(ci.energy='neutral') as neutral,
      bool_or(ci.energy='drained') as drained
    from public.intentions i
    join consented c on c.user_id=i.user_id
    join public.missions m on m.id=i.mission_id and m.user_id is null
    join public.check_ins ci on ci.intention_id=i.id and ci.user_id=i.user_id
    where i.day >= p_month and i.day < month_end
    group by i.user_id,i.mission_id,i.day
  ), reflections as (
    -- Energy describes the person's rating, independently of completion.
    select r.mission_id,
      count(*) filter(where r.done) as done,
      count(*) filter(where r.energy) as energy,
      count(*) filter(where r.neutral) as neutral,
      count(*) filter(where r.drained) as drained
    from reflected_days r group by r.mission_id
  )
  select pg_catalog.jsonb_build_object(
    'month', pg_catalog.to_char(p_month,'YYYY-MM'),
    'month_start',p_month,
    'month_end_exclusive',month_end,
    'missions',coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'mission_id',m.id,
      'shown',coalesce(f.shown,0),
      'picked',coalesce(f.picked,0),
      'done',coalesce(r.done,0),
      'energy',coalesce(r.energy,0),
      'neutral',coalesce(r.neutral,0),
      'drained',coalesce(r.drained,0),
      'skipped',coalesce(f.skipped,0)
    ) order by m.id),'[]'::jsonb)
  ) into result
  from public.missions m
  left join feedback f on f.mission_id=m.id
  left join reflections r on r.mission_id=m.id
  where m.user_id is null;
  return result;
end;
$$;
revoke all on function private.mission_recommendation_metrics(date)
  from public,anon,authenticated;
grant execute on function private.mission_recommendation_metrics(date) to service_role;

-- A single JSON value avoids the Data API row cap truncating this >1,000-row catalogue.
create function public.get_mission_recommendation_metrics(p_month date) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select private.mission_recommendation_metrics(p_month);
$$;
revoke all on function public.get_mission_recommendation_metrics(date)
  from public,anon,authenticated;
grant execute on function public.get_mission_recommendation_metrics(date) to service_role;

comment on function public.get_mission_recommendation_metrics(date) is
  'Service-only monthly aggregate counts by public mission ID. energy counts lit ratings independently of completion; current analytics opt-out excludes all historical months.';
