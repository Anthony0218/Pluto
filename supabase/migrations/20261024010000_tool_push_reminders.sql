-- Browser-local tools remain local. Only opted-in task reminders and push devices are stored here.
create table public.tool_push_devices (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique, subscription jsonb not null, labels jsonb not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.tool_push_devices(user_id);
create table public.tool_push_test_limits (user_id uuid primary key references auth.users(id) on delete cascade, last_test_at timestamptz not null);
alter table public.tool_push_test_limits enable row level security;
revoke all on public.tool_push_test_limits from anon,authenticated;
grant all on public.tool_push_test_limits to service_role;
create table public.tool_push_reminders (
 user_id uuid not null references auth.users(id) on delete cascade, id text not null check(length(id) between 1 and 80),
 title text not null check(length(title) between 1 and 100), at timestamptz not null,
 enabled boolean not null default false, client_revision bigint not null default 0, updated_at timestamptz not null default now(), primary key(user_id,id)
);
create table public.tool_push_deliveries (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 device_id uuid not null references public.tool_push_devices(id) on delete cascade,
 reminder_id text, due_at timestamptz not null, title text not null,
 status text not null default 'pending' check(status in ('pending','sending','accepted','shown','clicked','failed')),
 attempts integer not null default 0, next_at timestamptz not null default now(), lease_until timestamptz,
 ack_token uuid not null unique default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(device_id, reminder_id, due_at)
);
create index on public.tool_push_deliveries(next_at) where status in ('pending','sending');
create index on public.tool_push_deliveries(user_id,created_at desc);
create index on public.tool_push_reminders(at) where enabled;
alter table public.tool_push_devices enable row level security;
alter table public.tool_push_reminders enable row level security;
alter table public.tool_push_deliveries enable row level security;
-- All operations pass authenticated identity through the Edge Function. No direct browser grants or public RPC access.
revoke all on public.tool_push_devices, public.tool_push_reminders, public.tool_push_deliveries from anon, authenticated;
grant all on public.tool_push_devices, public.tool_push_reminders, public.tool_push_deliveries to service_role;

create function public.tool_push_set_reminder(p_user uuid, p_id text, p_title text, p_at timestamptz, p_enabled boolean, p_revision bigint default 0) returns void language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if exists(select 1 from tool_push_reminders where user_id=p_user and id=p_id and client_revision>p_revision) then return; end if;
 if not p_enabled and not exists(select 1 from tool_push_reminders where user_id=p_user and id=p_id) then return; end if;
 if (select count(*) from tool_push_reminders where user_id=p_user and id<>p_id)>=2000 then raise exception 'Stored reminder limit'; end if;
 if p_enabled and (select count(*) from tool_push_reminders where user_id=p_user and enabled and id<>p_id)>=500 then raise exception 'Reminder limit'; end if;
 insert into tool_push_reminders(user_id,id,title,at,enabled,client_revision) values(p_user,p_id,p_title,p_at,p_enabled,p_revision)
 on conflict(user_id,id) do update set title=excluded.title,at=excluded.at,enabled=excluded.enabled,client_revision=excluded.client_revision,updated_at=now();
 -- Cancel queued work after completion, dismissal, deletion, or rescheduling. Already accepted push cannot be recalled.
 delete from tool_push_deliveries where user_id=p_user and reminder_id=p_id and status in ('pending','sending') and (not p_enabled or due_at<>p_at);
 update tool_push_deliveries set title=p_title where user_id=p_user and reminder_id=p_id and status='pending' and due_at=p_at;
end $$;
create function public.tool_push_test(p_user uuid, p_device uuid default null) returns void language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if not exists(select 1 from tool_push_devices where user_id=p_user and (p_device is null or id=p_device)) then raise exception 'Enroll a device first'; end if;
 if exists(select 1 from tool_push_test_limits where user_id=p_user and last_test_at>now()-interval '1 minute') then raise exception 'Wait one minute before another test'; end if;
 insert into tool_push_test_limits values(p_user,now()) on conflict(user_id) do update set last_test_at=now();
 insert into tool_push_deliveries(user_id,device_id,due_at,title) select p_user,id,now(),'test' from tool_push_devices where user_id=p_user and (p_device is null or id=p_device);
end $$;
create function public.tool_push_claim(p_user uuid default null) returns table(delivery_id uuid, device_id uuid, subscription jsonb, labels jsonb, title text, ack_token uuid, test boolean, attempts integer) language plpgsql security definer set search_path=public as $$
#variable_conflict use_column
begin
 -- Retain diagnostic records for 30 days; expired one-day reminders are never sent late.
 delete from tool_push_deliveries where created_at<now()-interval '30 days';
 delete from tool_push_reminders where at<now()-interval '30 days' or (not enabled and updated_at<now()-interval '30 days');
 update tool_push_deliveries set status='failed', updated_at=now() where status in ('pending','sending') and (due_at<now()-interval '1 day' or (tool_push_deliveries.attempts>=3 and coalesce(lease_until,next_at)<=now()));
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
 ) select j.id,d.id,d.subscription,d.labels,j.title,j.ack_token,j.reminder_id is null,j.attempts from claimed j join tool_push_devices d on d.id=j.device_id;
end $$;
create function public.tool_push_ack(p_token uuid,p_clicked boolean) returns boolean language plpgsql security definer set search_path=public as $$
declare changed uuid;
begin
 update tool_push_deliveries set status=case when p_clicked or status='clicked' then 'clicked' else 'shown' end,updated_at=now()
 where ack_token=p_token and status in ('sending','accepted','shown','clicked') returning id into changed;
 return changed is not null;
end $$;
revoke all on function public.tool_push_set_reminder(uuid,text,text,timestamptz,boolean,bigint), public.tool_push_test(uuid,uuid), public.tool_push_claim(uuid), public.tool_push_ack(uuid,boolean) from public, anon, authenticated;
grant execute on function public.tool_push_set_reminder(uuid,text,text,timestamptz,boolean,bigint), public.tool_push_test(uuid,uuid), public.tool_push_claim(uuid), public.tool_push_ack(uuid,boolean) to service_role;
create function public.tool_push_register(p_user uuid,p_subscription jsonb,p_labels jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare device uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if exists(select 1 from tool_push_devices where endpoint=p_subscription->>'endpoint' and user_id<>p_user) then raise exception 'This device needs a new subscription'; end if;
 if (select count(*) from tool_push_devices where user_id=p_user and endpoint<>p_subscription->>'endpoint')>=10 then raise exception 'Device limit'; end if;
 insert into tool_push_devices(user_id,endpoint,subscription,labels) values(p_user,p_subscription->>'endpoint',p_subscription,p_labels)
 on conflict(endpoint) do update set subscription=excluded.subscription,labels=excluded.labels,updated_at=now() returning id into device;
 return device;
end $$;
revoke all on function public.tool_push_register(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.tool_push_register(uuid,jsonb,jsonb) to service_role;
