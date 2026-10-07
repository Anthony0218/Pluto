-- Bill ledgers use Pluto profiles/authentication and the community RPC/RLS pattern.
create table public.bill_groups (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 name text not null check (length(btrim(name)) between 1 and 100),
 currency text not null check (currency in ('EUR','USD','GBP','CHF')),
 expenses jsonb not null default '[]', repayments jsonb not null default '[]',
 revision integer not null default 0, created_at timestamptz not null default now()
);
create table public.bill_members (
 group_id uuid not null references public.bill_groups(id) on delete cascade,
 user_id uuid not null references auth.users(id), display_name text not null check(length(btrim(display_name)) between 1 and 100),
 primary key(group_id,user_id)
);
create table public.bill_invitations (
 id uuid primary key default gen_random_uuid(), group_id uuid not null references public.bill_groups(id) on delete cascade,
 recipient_id uuid not null references auth.users(id), sender_id uuid not null references auth.users(id),
 created_at timestamptz not null default now(), unique(group_id,recipient_id)
);
create index bill_members_user on public.bill_members(user_id);
create index bill_invitations_recipient on public.bill_invitations(recipient_id);
create function public.is_bill_member(p_group uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.bill_members where group_id=p_group and user_id=auth.uid());
$$;
alter table public.bill_groups enable row level security;
alter table public.bill_members enable row level security;
alter table public.bill_invitations enable row level security;
create policy bill_group_read on public.bill_groups for select to authenticated using(public.is_bill_member(id));
create policy bill_member_read on public.bill_members for select to authenticated using(public.is_bill_member(group_id));
create policy bill_invitation_read on public.bill_invitations for select to authenticated using(recipient_id=auth.uid() or sender_id=auth.uid());
grant select on public.bill_groups,public.bill_members,public.bill_invitations to authenticated;
revoke insert,update,delete on public.bill_groups,public.bill_members,public.bill_invitations from anon,authenticated;

create function public.bill_list() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('groups', coalesce((select jsonb_agg(jsonb_build_object(
 'id',g.id,'ownerId',g.owner_id,'name',g.name,'currency',g.currency,'revision',g.revision,'expenses',g.expenses,'repayments',g.repayments,
 'members',(select jsonb_agg(jsonb_build_object('id',m.user_id,'userId',m.user_id,'name',m.display_name) order by m.user_id) from public.bill_members m where m.group_id=g.id)) order by g.created_at)
 from public.bill_groups g where public.is_bill_member(g.id)), '[]'::jsonb),
 'invitations',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'groupId',g.id,'name',g.name,'currency',g.currency)) from public.bill_invitations i join public.bill_groups g on g.id=i.group_id where i.recipient_id=auth.uid()),'[]'::jsonb));
$$;
create function public.bill_create(p_name text,p_currency text,p_display_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'Sign in to create a group'; end if;
 if (select count(*) from public.bill_members where user_id=auth.uid()) >= 30 then raise exception 'Group limit reached'; end if;
 insert into public.bill_groups(owner_id,name,currency) values(auth.uid(),btrim(p_name),p_currency) returning id into result;
 insert into public.bill_members values(result,auth.uid(),btrim(p_display_name));
 return result;
end; $$;
create function public.bill_invite(p_group uuid,p_username text) returns void language plpgsql security definer set search_path='' as $$
declare recipient uuid;
begin
 perform 1 from public.bill_groups where id=p_group and owner_id=auth.uid() for update;
 if not found then raise exception 'Only the creator can invite users'; end if;
 select id into recipient from public.profiles where lower(username)=lower(btrim(p_username));
 if recipient is null then raise exception 'Pluto username not found'; end if;
 if exists(select 1 from public.bill_members where group_id=p_group and user_id=recipient) then raise exception 'This user is already a member'; end if;
 if (select count(*) from public.bill_members where group_id=p_group)+(select count(*) from public.bill_invitations where group_id=p_group)>=30 then raise exception 'Member limit reached'; end if;
 insert into public.bill_invitations(group_id,recipient_id,sender_id) values(p_group,recipient,auth.uid()) on conflict do nothing;
end; $$;
create function public.bill_accept(p_invitation uuid,p_display_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 select group_id into target from public.bill_invitations where id=p_invitation and recipient_id=auth.uid();
 if target is null then raise exception 'Invitation unavailable'; end if;
 perform 1 from public.bill_groups where id=target for update;
 if not exists(select 1 from public.bill_invitations where id=p_invitation and recipient_id=auth.uid()) then raise exception 'Invitation unavailable'; end if;
 if (select count(*) from public.bill_members where group_id=target)>=30 or (select count(*) from public.bill_members where user_id=auth.uid())>=30 then raise exception 'Member or group limit reached'; end if;
 insert into public.bill_members values(target,auth.uid(),btrim(p_display_name)) on conflict do nothing;
 delete from public.bill_invitations where id=p_invitation;
 update public.bill_groups set revision=revision+1 where id=target;
 return target;
end; $$;
create function public.bill_decline(p_invitation uuid) returns void language sql security definer set search_path='' as $$
 delete from public.bill_invitations where id=p_invitation and recipient_id=auth.uid();
$$;
create function public.bill_rename_member(p_group uuid,p_display_name text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.bill_groups where id=p_group and public.is_bill_member(id) for update;
 if not found then raise exception 'Join this group first'; end if;
 update public.bill_members set display_name=btrim(p_display_name) where group_id=p_group and user_id=auth.uid();
 update public.bill_groups set revision=revision+1 where id=p_group;
end; $$;
-- Monetary JSON is validated on the server, including membership, cents and tip breakdowns.
create function public.bill_cents(p_value jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(p_value)='number' and p_value::text ~ '^[0-9]+$' and length(p_value::text)<=10 and (p_value::text)::numeric<=2000000000,false);
$$;
create function public.bill_valid_date(p_value text) returns boolean language plpgsql immutable set search_path='' as $$
begin
 return p_value ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' and to_char(p_value::date,'YYYY-MM-DD')=p_value;
exception when others then return false;
end; $$;
create function public.bill_save_ledger(p_group uuid,p_revision integer,p_expenses jsonb,p_repayments jsonb) returns void language plpgsql security definer set search_path='' as $$
declare g public.bill_groups; item jsonb; share record; total numeric; members text[]; seen text[] := '{}';
begin
 select * into g from public.bill_groups where id=p_group and public.is_bill_member(id) for update;
 if not found then raise exception 'Join this group first'; end if;
 if g.revision<>p_revision then raise exception 'The group changed. Refresh and try again.'; end if;
 if p_expenses is null or p_repayments is null or jsonb_typeof(p_expenses)<>'array' or jsonb_typeof(p_repayments)<>'array' or jsonb_array_length(p_expenses)>500 or jsonb_array_length(p_repayments)>500 or octet_length(p_expenses::text)+octet_length(p_repayments::text)>2000000 then raise exception 'Ledger limit reached'; end if;
 select array_agg(user_id::text) into members from public.bill_members where group_id=p_group;
 for item in select value from jsonb_array_elements(p_expenses) loop
  if jsonb_typeof(item)<>'object' or coalesce(item->>'id','') !~ '^[a-zA-Z0-9-]{1,80}$' or item->>'id'=any(seen) or length(btrim(coalesce(item->>'title',''))) not between 1 and 100 or not coalesce(public.bill_valid_date(item->>'date'),false) or not coalesce(item->>'paidBy'=any(members),false) or not public.bill_cents(item->'amount') or (item->>'amount')::numeric=0 or jsonb_typeof(item->'shares') is distinct from 'object' then raise exception 'Invalid expense'; end if;
  seen := array_append(seen,item->>'id'); total:=0;
  for share in select * from jsonb_each(item->'shares') loop
   if not share.key=any(members) or not public.bill_cents(share.value) then raise exception 'Invalid share'; end if;
   total:=total+(share.value::text)::numeric;
  end loop;
  if total<>(item->>'amount')::numeric then raise exception 'Shares must add up to total'; end if;
  if item ? 'subtotal' then
   if not public.bill_cents(item->'subtotal') or not public.bill_cents(item->'tip') or (item->>'subtotal')::numeric+(item->>'tip')::numeric<>total or coalesce(item->>'splitMethod','') not in ('equal','custom') or coalesce(item->>'tipMethod','') not in ('equal','person') or jsonb_typeof(item->'billShares') is distinct from 'object' or jsonb_typeof(item->'tipShares') is distinct from 'object' then raise exception 'Invalid bill and tip'; end if;
   if (select array_agg(key order by key) from jsonb_each(item->'shares')) is distinct from (select array_agg(key order by key) from jsonb_each(item->'billShares')) or (select array_agg(key order by key) from jsonb_each(item->'shares')) is distinct from (select array_agg(key order by key) from jsonb_each(item->'tipShares')) then raise exception 'Invalid participants'; end if;
   if item->>'splitMethod'='equal' and (select max(value::text::numeric)-min(value::text::numeric) from jsonb_each(item->'billShares'))>1 then raise exception 'Bill must be split equally'; end if;
   if item->>'tipMethod'='equal' and (select max(value::text::numeric)-min(value::text::numeric) from jsonb_each(item->'tipShares'))>1 then raise exception 'Tip must be split equally'; end if;
   total:=0;
   for share in select * from jsonb_each(item->'shares') loop
    if not public.bill_cents(item->'billShares'->share.key) or not public.bill_cents(item->'tipShares'->share.key) or (item->'billShares'->>share.key)::numeric+(item->'tipShares'->>share.key)::numeric<>(share.value::text)::numeric then raise exception 'Invalid split'; end if;
    if item->>'tipMethod'='person' and share.key<>item->>'tipPayer' and (item->'tipShares'->>share.key)::numeric<>0 then raise exception 'Invalid tip payer'; end if;
    total:=total+(item->'billShares'->>share.key)::numeric;
   end loop;
   if total<>(item->>'subtotal')::numeric or item->>'tipMethod'='person' and not (item->'shares' ? coalesce(item->>'tipPayer','')) then raise exception 'Invalid subtotal or tip payer'; end if;
  end if;
 end loop;
 seen:='{}';
 for item in select value from jsonb_array_elements(p_repayments) loop
  if jsonb_typeof(item)<>'object' or coalesce(item->>'id','') !~ '^[a-zA-Z0-9-]{1,80}$' or item->>'id'=any(seen) or not coalesce(public.bill_valid_date(item->>'date'),false) or not coalesce(item->>'from'=any(members),false) or not coalesce(item->>'to'=any(members),false) or item->>'from'=item->>'to' or not public.bill_cents(item->'amount') or (item->>'amount')::numeric=0 then raise exception 'Invalid repayment'; end if;
  seen:=array_append(seen,item->>'id');
 end loop;
 update public.bill_groups set expenses=p_expenses,repayments=p_repayments,revision=revision+1 where id=p_group;
end; $$;
create function public.bill_delete(p_group uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 delete from public.bill_groups where id=p_group and owner_id=auth.uid();
 if not found then raise exception 'Only the creator can delete a group'; end if;
end; $$;
revoke all on function public.is_bill_member(uuid),public.bill_list(),public.bill_create(text,text,text),public.bill_invite(uuid,text),public.bill_accept(uuid,text),public.bill_decline(uuid),public.bill_rename_member(uuid,text),public.bill_save_ledger(uuid,integer,jsonb,jsonb),public.bill_delete(uuid),public.bill_cents(jsonb),public.bill_valid_date(text) from public,anon;
grant execute on function public.is_bill_member(uuid),public.bill_list(),public.bill_create(text,text,text),public.bill_invite(uuid,text),public.bill_accept(uuid,text),public.bill_decline(uuid),public.bill_rename_member(uuid,text),public.bill_save_ledger(uuid,integer,jsonb,jsonb),public.bill_delete(uuid) to authenticated;
