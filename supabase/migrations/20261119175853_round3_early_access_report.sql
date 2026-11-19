-- Content-free early-access reporting. The only administrator is provisioned
-- separately by a trusted service; no personal administrator identifiers live here.
create table public.early_access_report_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.early_access_report_admins enable row level security;
revoke all on public.early_access_report_admins from public, anon, authenticated;
grant select on public.early_access_report_admins to authenticated;
grant all on public.early_access_report_admins to service_role;
create policy report_admin_self_read on public.early_access_report_admins
  for select to authenticated using ((select auth.uid()) = user_id);

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
create table private.early_access_report_settings (
  singleton boolean primary key default true check (singleton),
  instrumented_at timestamptz not null default now()
);
alter table private.early_access_report_settings enable row level security;
revoke all on private.early_access_report_settings from public, anon, authenticated;
grant all on private.early_access_report_settings to service_role;
insert into private.early_access_report_settings(singleton) values(true);

alter table public.product_events drop constraint product_events_event_check;
alter table public.product_events add constraint product_events_event_check
  check(event in (
    'session_started', 'activation', 'intention_saved', 'reflection_saved',
    'review_saved', 'ai_response', 'my_map_opened', 'future_me_opened',
    'sunday_review_opened'
  ));

-- Legacy JSON timestamps may be absent or malformed. One user's malformed
-- preference must never break the whole report or be returned as journal text.
create function private.report_timestamp(value text) returns timestamptz
language plpgsql stable strict security invoker set search_path = '' as $$
begin
  if value !~ '^\d{4}-\d{2}-\d{2}T' then return null; end if;
  return value::timestamptz;
exception when invalid_datetime_format or datetime_field_overflow
  or sqlstate '22009' then
  return null;
end;
$$;
create function private.report_day(value text) returns date
language plpgsql immutable strict security invoker set search_path = '' as $$
begin
  if value !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return value::date;
exception when invalid_datetime_format or datetime_field_overflow then
  return null;
end;
$$;
revoke all on function private.report_timestamp(text), private.report_day(text)
  from public, anon, authenticated;

create function private.early_access_report(p_week_start date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  instrumentation timestamptz;
  result jsonb;
begin
  -- This check is inside the privileged function, including direct SQL calls.
  -- User-editable JWT metadata is deliberately irrelevant to authorization.
  if caller is null or not exists (
    select 1 from public.early_access_report_admins a where a.user_id = caller
  ) then
    raise exception 'This report is available only to its administrator.'
      using errcode = '42501';
  end if;
  if p_week_start is null or extract(isodow from p_week_start) <> 1
     or p_week_start < date '2000-01-03' or p_week_start > current_date + 7 then
    raise exception 'Choose a Monday for the report week.' using errcode = '22023';
  end if;
  select instrumented_at into instrumentation
    from private.early_access_report_settings where singleton;

  with people as (
    select u.id, u.email::text, coalesce(p.display_name, '') as display_name,
      coalesce(p.onboarded, false) as onboarded,
      coalesce(p.joined_at, u.created_at) as joined_at,
      u.last_sign_in_at,
      case when exists (select 1 from pg_catalog.pg_timezone_names z where z.name = p.timezone)
        then p.timezone else 'UTC' end as timezone
    from auth.users u left join public.profiles p on p.id = u.id
    where u.created_at < (p_week_start + 8)::timestamp at time zone 'UTC'
  ), person_data as (
    select p.*,
      p_week_start::timestamp at time zone p.timezone as start_at,
      (p_week_start + 7)::timestamp at time zone p.timezone as end_at,
      coalesce(privacy.entry #>> '{meta,analytics}' = 'true', false) as analytics_enabled,
      greatest(instrumentation, privacy.updated_at) as collection_since,
      progress.entry #>> '{meta,onboarding_step}' as raw_onboarding_step,
      progress.entry #>> '{meta,cursor}' as raw_onboarding_cursor
    from people p
    left join lateral (
      select e.entry, e.updated_at from public.journey_entries e
      where e.user_id = p.id and e.kind = 'preferences' and e.entry ->> 'title' = 'Privacy'
      order by e.updated_at desc limit 1
    ) privacy on true
    left join lateral (
      select e.entry from public.journey_entries e
      where e.user_id = p.id and e.kind = 'preferences' and e.entry ->> 'title' = 'Onboarding progress'
      order by e.updated_at desc limit 1
    ) progress on true
  ), measured as (
    select p.*,
      case when not p.analytics_enabled or p.end_at <= p.collection_since then 'not_collected'
        when p.start_at < p.collection_since then 'partial' else 'collected' end as screen_metrics_status,
      focus.focus_days, focus.mornings_with_focus, focus.typed_focuses, focus.suggested_focuses,
      nights.night_checkins,
      screens.sunday_review_opened, screens.my_map_opened, screens.future_me_opened,
      activity.last_observed_at
    from person_data p
    left join lateral (
      select count(*)::int as focus_days,
        count(*) filter (where (i.created_at at time zone p.timezone)::time < time '17:00'
          and (i.created_at at time zone p.timezone)::date = i.day)::int as mornings_with_focus,
        count(*) filter (where i.source = 'typed' and i.mission_id is null)::int as typed_focuses,
        count(*) filter (where i.source = 'suggested' or i.mission_id is not null)::int as suggested_focuses
      from public.intentions i
      where i.user_id = p.id and i.day >= p_week_start and i.day < p_week_start + 7
    ) focus on true
    left join lateral (
      select count(distinct n.day)::int as night_checkins from (
        select (c.created_at at time zone p.timezone)::date as day
          from public.check_ins c where c.user_id = p.id
        union all
        select cs.day from public.checkin_summaries cs where cs.user_id = p.id
        union all
        select private.report_day(e.entry #>> '{meta,commitment_day}')
          from public.journey_entries e where e.user_id = p.id and e.kind = 'event'
            and e.entry ->> 'title' = 'Night check-in completed' and e.entry ->> 'state' = 'done'
        union all
        select (private.report_timestamp(e.entry #>> '{meta,last_check_in_at}') at time zone p.timezone)::date
          from public.journey_entries e where e.user_id = p.id and e.kind = 'preferences'
            and e.entry ->> 'title' = 'Check-in session'
      ) n where n.day >= p_week_start and n.day < p_week_start + 7
    ) nights on true
    left join lateral (
      select count(*) filter(where pe.event = 'sunday_review_opened')::int as sunday_review_opened,
        count(*) filter(where pe.event = 'my_map_opened')::int as my_map_opened,
        count(*) filter(where pe.event = 'future_me_opened')::int as future_me_opened
      from public.product_events pe
      where pe.user_id = p.id and pe.created_at >= greatest(p.start_at, p.collection_since)
        and pe.created_at < p.end_at
    ) screens on true
    left join lateral (
      select max(a.observed_at) as last_observed_at from (
        select p.last_sign_in_at as observed_at
        union all select i.created_at from public.intentions i where i.user_id = p.id
        union all select c.created_at from public.check_ins c where c.user_id = p.id
        union all select cs.created_at from public.checkin_summaries cs where cs.user_id = p.id
        union all select pe.created_at from public.product_events pe where pe.user_id = p.id
        union all select private.report_timestamp(e.entry ->> 'updated_at')
          from public.journey_entries e where e.user_id = p.id
        union all select private.report_timestamp(e.entry #>> '{meta,last_check_in_at}')
          from public.journey_entries e where e.user_id = p.id and e.kind = 'preferences'
            and e.entry ->> 'title' = 'Check-in session'
      ) a where a.observed_at < least(p.end_at, now())
    ) activity on true
  )
  select jsonb_build_object(
    'week_start', p_week_start,
    'week_end_exclusive', p_week_start + 7,
    'generated_at', now(),
    'instrumentation_started_at', instrumentation,
    'participants', coalesce(jsonb_agg(jsonb_build_object(
      'user_id', p.id,
      'display_name', p.display_name,
      'email', p.email,
      'timezone', p.timezone,
      'onboarding_complete', p.onboarded,
      'onboarding_step', case when p.onboarded then 'Completed'
        when p.raw_onboarding_step in (
          'Introduction', 'Strengths', 'Who comes to you', 'Ten priorities',
          'Three priorities to work on', 'Faith tradition', 'Childhood interests',
          'Quick picks', 'Something to grow into', 'People', 'Places',
          'Check-in anchors', 'First why', 'Starting point', 'Completed', 'In progress'
        ) then p.raw_onboarding_step else null end,
      'onboarding_cursor', case when p.raw_onboarding_step = 'Quick picks'
        and p.raw_onboarding_cursor ~ '^([0-9]|1[0-4])$' then p.raw_onboarding_cursor::int + 1 else null end,
      'focus_days', p.focus_days,
      'mornings_with_focus', p.mornings_with_focus,
      'typed_focuses', p.typed_focuses,
      'suggested_focuses', p.suggested_focuses,
      'night_checkins', case when p.night_checkins > 0 or p.start_at >= instrumentation then p.night_checkins else null end,
      'night_checkins_coverage', case when p.start_at >= instrumentation then 'collected' else 'observed' end,
      'sunday_review_opened', case when p.screen_metrics_status = 'not_collected' then null
        when p.screen_metrics_status = 'partial' and p.sunday_review_opened = 0 then null else p.sunday_review_opened end,
      'my_map_opened', case when p.screen_metrics_status = 'not_collected' then null
        when p.screen_metrics_status = 'partial' and p.my_map_opened = 0 then null else p.my_map_opened end,
      'future_me_opened', case when p.screen_metrics_status = 'not_collected' then null
        when p.screen_metrics_status = 'partial' and p.future_me_opened = 0 then null else p.future_me_opened end,
      'screen_metrics_status', p.screen_metrics_status,
      'screen_metrics_since', case when p.analytics_enabled then p.collection_since else null end,
      'last_active_day', (p.last_observed_at at time zone p.timezone)::date
    ) order by lower(p.display_name), lower(p.email), p.id), '[]'::jsonb)
  ) into result
  from measured p where p.joined_at < p.end_at;
  return result;
end;
$$;
revoke all on function private.early_access_report(date) from public, anon, authenticated;
grant execute on function private.early_access_report(date) to authenticated;

-- Only this invoker wrapper is exposed by the Data API. Its private target
-- always checks the caller against the service-managed allowlist before reading.
create function public.get_early_access_report(p_week_start date) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select private.early_access_report(p_week_start);
$$;
revoke all on function public.get_early_access_report(date) from public, anon, authenticated;
grant execute on function public.get_early_access_report(date) to authenticated;
