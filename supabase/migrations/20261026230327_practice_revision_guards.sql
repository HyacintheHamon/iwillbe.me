-- Additive revisions preserve older clients and imports. New clients use an
-- equality predicate on revision for every update/delete and INSERT for creates.
alter table public.profiles add column revision integer not null default 1 check (revision > 0);
alter table public.intentions add column revision integer not null default 1 check (revision > 0);
alter table public.check_ins add column revision integer not null default 1 check (revision > 0);
alter table public.memories add column revision integer not null default 1 check (revision > 0);
alter table public.journey_entries add column revision integer not null default 1 check (revision > 0);

create function public.advance_practice_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  return new;
end;
$$;
revoke all on function public.advance_practice_revision() from public, anon, authenticated;
create trigger zz_profile_revision before update on public.profiles for each row execute function public.advance_practice_revision();
create trigger zz_intention_revision before update on public.intentions for each row execute function public.advance_practice_revision();
create trigger zz_check_in_revision before update on public.check_ins for each row execute function public.advance_practice_revision();
create trigger zz_memory_revision before update on public.memories for each row execute function public.advance_practice_revision();
create trigger zz_journey_revision before update on public.journey_entries for each row execute function public.advance_practice_revision();

-- Revision metadata is not a change to a reflected intention's meaning.
create or replace function public.protect_reflected_intention() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (to_jsonb(new)-array['updated_at','interest_id','value_id','revision'])
     is distinct from
     (to_jsonb(old)-array['updated_at','interest_id','value_id','revision'])
     and exists(select 1 from public.check_ins where intention_id=old.id) then
    raise exception 'This intention already has a reflection.' using errcode='23514';
  end if;
  return new;
end;
$$;

-- RLS, ownership predicates, grants and the import RPC remain unchanged.
-- Old clients still work, but only clients using revision predicates detect
-- edit conflicts. No row is replaced merely because its revision was absent.
