-- Annual birthday reminders reuse the account-scoped push delivery queue.
-- Apply after 20261024010000_tool_push_reminders.sql, then redeploy tool-push.
alter table public.tool_push_reminders add column annual jsonb;

create function public.tool_push_next_birthday(p_month integer,p_day integer,p_zone text,p_after timestamptz) returns timestamptz language plpgsql stable set search_path=public as $$
declare y integer; observed integer; result timestamptz;
begin
 if p_month is null or p_day is null or p_zone is null or p_after is null then raise exception 'Invalid annual schedule'; end if;
 perform make_date(2000,p_month,p_day); -- Validate February 29, reject impossible dates.
 y:=extract(year from p_after at time zone p_zone)::int;
 loop
  observed:=least(p_day,extract(day from (make_date(y,p_month,1)+interval '1 month - 1 day'))::int);
  result:=(make_date(y,p_month,observed)+time '09:00') at time zone p_zone;
  if result>p_after then return result; end if;
  y:=y+1;
 end loop;
end $$;

create function public.tool_push_set_birthday(p_user uuid,p_id text,p_title text,p_month integer,p_day integer,p_zone text,p_enabled boolean,p_revision bigint default 0) returns void language plpgsql security definer set search_path=public as $$
declare next_at timestamptz; schedule jsonb; existing public.tool_push_reminders;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if p_id not like 'birthday-%' then raise exception 'Invalid birthday identifier'; end if;
 select * into existing from tool_push_reminders where user_id=p_user and id=p_id;
 if existing.client_revision>p_revision then return; end if;
 schedule:=jsonb_build_object('month',p_month,'day',p_day,'zone',p_zone);
 next_at:=tool_push_next_birthday(p_month,p_day,p_zone,date_trunc('day',now() at time zone p_zone) at time zone p_zone);
 -- Keep the occurrence advanced by the scheduler when a person is renamed or re-uploaded.
 if existing.annual=schedule and existing.at>=next_at then next_at:=existing.at; end if;
 perform tool_push_set_reminder(p_user,p_id,p_title,next_at,p_enabled,p_revision);
 update tool_push_reminders set annual=schedule where user_id=p_user and id=p_id and client_revision=p_revision;
end $$;

-- The new return column lets the dispatcher choose the birthday label and destination.
drop function public.tool_push_claim(uuid);
create function public.tool_push_claim(p_user uuid default null) returns table(delivery_id uuid, device_id uuid, subscription jsonb, labels jsonb, title text, ack_token uuid, test boolean, attempts integer, birthday boolean) language plpgsql security definer set search_path=public as $$
#variable_conflict use_column
begin
 -- Advance annual reminders only after every enrolled device has finished this occurrence,
 -- or once its one-day delivery window has elapsed. This runs without an open browser.
 update tool_push_deliveries set status='failed',updated_at=now() where status in ('pending','sending') and (due_at<now()-interval '1 day' or (tool_push_deliveries.attempts>=3 and coalesce(lease_until,next_at)<=now()));
 update tool_push_reminders r set at=tool_push_next_birthday((r.annual->>'month')::int,(r.annual->>'day')::int,r.annual->>'zone',greatest(now(),r.at+interval '1 day')),updated_at=now()
 where r.enabled and r.annual is not null and r.at<=now() and (
   r.at<now()-interval '1 day' or (
     exists(select 1 from tool_push_deliveries j where j.user_id=r.user_id and j.reminder_id=r.id and j.due_at=r.at)
     and not exists(select 1 from tool_push_devices d where d.user_id=r.user_id and not exists(
       select 1 from tool_push_deliveries j where j.device_id=d.id and j.reminder_id=r.id and j.due_at=r.at and j.status in ('accepted','shown','clicked','failed')
     ))
   )
 );
 -- Retain diagnostic records for 30 days; expired one-shot reminders are never sent late.
 delete from tool_push_deliveries where created_at<now()-interval '30 days';
 delete from tool_push_reminders where (annual is null and at<now()-interval '30 days') or (not enabled and updated_at<now()-interval '30 days');
 insert into tool_push_deliveries(user_id,device_id,reminder_id,due_at,title)
 select r.user_id,d.id,r.id,r.at,r.title from tool_push_reminders r join tool_push_devices d on d.user_id=r.user_id
 where (p_user is null or r.user_id=p_user) and r.enabled and r.at<=now() and r.at>now()-interval '1 day'
 on conflict(device_id,reminder_id,due_at) do nothing;
 return query with candidates as (
 select j.id from tool_push_deliveries j where ((j.status='pending' and j.next_at<=now()) or (j.status='sending' and j.lease_until<=now())) and j.attempts<3 and (p_user is null or j.user_id=p_user)
 and (j.reminder_id is null or exists(select 1 from tool_push_reminders r where r.user_id=j.user_id and r.id=j.reminder_id and r.enabled and r.at=j.due_at))
 order by j.due_at limit 50 for update skip locked
 ), claimed as (
 update tool_push_deliveries j set status='sending',attempts=j.attempts+1,lease_until=now()+interval '2 minutes',updated_at=now() from candidates c where j.id=c.id returning j.*
 ) select j.id,d.id,d.subscription,d.labels,j.title,j.ack_token,j.reminder_id is null,j.attempts,j.reminder_id like 'birthday-%' from claimed j join tool_push_devices d on d.id=j.device_id;
end $$;

revoke all on function public.tool_push_next_birthday(integer,integer,text,timestamptz),public.tool_push_set_birthday(uuid,text,text,integer,integer,text,boolean,bigint),public.tool_push_claim(uuid) from public,anon,authenticated;
grant execute on function public.tool_push_next_birthday(integer,integer,text,timestamptz),public.tool_push_set_birthday(uuid,text,text,integer,integer,text,boolean,bigint),public.tool_push_claim(uuid) to service_role;
