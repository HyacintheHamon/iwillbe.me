alter table public.journey_entries add constraint journey_entry_owner_unique unique(id,user_id);
alter table public.intentions add column interest_id uuid, add column value_id uuid;
alter table public.intentions add constraint intention_interest_owner foreign key(interest_id,user_id) references public.journey_entries(id,user_id) on delete set null(interest_id);
alter table public.intentions add constraint intention_value_owner foreign key(value_id,user_id) references public.journey_entries(id,user_id) on delete set null(value_id);
create index intention_interest on public.intentions(interest_id,user_id);
create index intention_value on public.intentions(value_id,user_id);
-- Link historic labels without changing their contents or inventing outcomes.
-- Identity removal does not rewrite the historical label or reflected action.
create or replace function public.protect_reflected_intention() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if (to_jsonb(new)-array['updated_at','interest_id','value_id']) is distinct from (to_jsonb(old)-array['updated_at','interest_id','value_id'])
 and exists(select 1 from public.check_ins where intention_id=old.id) then raise exception 'This intention already has a reflection.' using errcode='23514';end if;return new;
end;
$$;
update public.intentions i set interest_id=(select e.id from public.journey_entries e where e.user_id=i.user_id and e.kind='interest' and e.entry->>'title'=i.interest limit 1),
 value_id=(select e.id from public.journey_entries e where e.user_id=i.user_id and e.kind='value' and e.entry->>'title'=i.value limit 1);
alter table public.product_events drop constraint product_events_event_check;
alter table public.product_events add constraint product_events_event_check check(event in ('session_started','activation','intention_saved','reflection_saved','review_saved','ai_response'));
