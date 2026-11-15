-- Server-only reservation; advisory lock serializes all moment types for an owner.
create function public.reserve_chloe_moment(p_user_id uuid,p_type text,p_session text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 if exists(select 1 from public.chloe_moments where user_id=p_user_id and (session_id=p_session or (type=p_type and asked_at>now()-interval '7 days'))) then return null; end if;
 insert into public.chloe_moments(user_id,type,session_id) values(p_user_id,p_type,p_session) returning to_jsonb(chloe_moments.*) into result;
 return result;
end;$$;
revoke execute on function public.reserve_chloe_moment(uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_chloe_moment(uuid,text,text) to service_role;

-- Replacing today's already-reflected focus preserves its full story in an event.
-- Expected revision prevents a stale device from archiving a newer focus.
create function public.replace_daily_focus(p_id uuid,p_revision integer,p_focus jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare focus public.intentions; reflection public.check_ins; event_id uuid:=gen_random_uuid(); replacement public.intentions;
begin
 select * into focus from public.intentions where id=p_id and user_id=(select auth.uid()) and revision=p_revision for update;
 if focus.id is null then raise exception 'Your focus changed. Reload before replacing it.' using errcode='40001'; end if;
 if focus.day<>(now() at time zone (select timezone from public.profiles where id=auth.uid()))::date then raise exception 'Only today can be replaced.'; end if;
 select * into reflection from public.check_ins where intention_id=focus.id and user_id=auth.uid();
 if reflection.intention_id is not null then
   insert into public.journey_entries(id,user_id,kind,entry) values(event_id,auth.uid(),'event',jsonb_build_object('id',event_id,'kind','event','title',focus.action,'body',reflection.reflection,'state','replaced','source','Earlier focus','source_ids',jsonb_build_array(focus.id),'created_at',now(),'updated_at',now(),'meta',jsonb_build_object('focus',to_jsonb(focus),'reflection',to_jsonb(reflection))));
   delete from public.check_ins where intention_id=focus.id and user_id=auth.uid();
 end if;
 replacement:=jsonb_populate_record(focus,p_focus);
 update public.intentions set action=replacement.action,value=replacement.value,person=replacement.person,interest=replacement.interest,interest_id=replacement.interest_id,value_id=replacement.value_id,source=replacement.source,level=replacement.level,type=replacement.type,mission_id=replacement.mission_id,mission_step=replacement.mission_step,someday_item_id=replacement.someday_item_id,place=replacement.place,when_context=replacement.when_context,for_me=replacement.for_me,for_whom=replacement.for_whom where id=focus.id returning * into replacement;
 return to_jsonb(replacement);
end;$$;
revoke execute on function public.replace_daily_focus(uuid,integer,jsonb) from public,anon;
grant execute on function public.replace_daily_focus(uuid,integer,jsonb) to authenticated;
