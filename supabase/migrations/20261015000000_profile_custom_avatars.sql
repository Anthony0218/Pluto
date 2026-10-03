-- Preserve each custom avatar after the player selects a different one.
create table if not exists public.profile_custom_avatars (
  user_id uuid not null references public.profiles(id) on delete cascade,
  avatar_id text not null check (avatar_id ~ '^px1:([0-9a-f]{16}){16}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, avatar_id)
);

alter table public.profile_custom_avatars enable row level security;
grant select, insert on public.profile_custom_avatars to authenticated;

create policy "Players read their own custom avatars"
  on public.profile_custom_avatars for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Players save their own custom avatars"
  on public.profile_custom_avatars for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Existing profiles already contain one saved drawing; import it into the gallery.
insert into public.profile_custom_avatars(user_id, avatar_id)
select id, avatar_id from public.profiles
where avatar_id ~ '^px1:([0-9a-f]{16}){16}$'
on conflict do nothing;
