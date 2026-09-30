-- Dashboard activity uses UTC days. A visit is exploration, not a game win.
create table public.dashboard_game_visits (
  user_id uuid not null references auth.users(id) on delete cascade,
  game_route text not null,
  visited_on date not null default (now() at time zone 'UTC')::date,
  last_visited_at timestamptz not null default now(),
  primary key (user_id, game_route, visited_on)
);
alter table public.dashboard_game_visits enable row level security;
create policy "Read own game visits" on public.dashboard_game_visits
  for select to authenticated using (user_id = auth.uid());

create table public.dashboard_challenges (
  id text primary key,
  title text not null,
  description text not null,
  target integer not null check (target > 0),
  active boolean not null default true
);
alter table public.dashboard_challenges enable row level security;
create policy "Read daily challenges" on public.dashboard_challenges
  for select to authenticated using (active);
insert into public.dashboard_challenges (id, title, description, target)
values ('explore', 'Explore 2 games', 'Visit two different games today. Resets at midnight UTC.', 2);

create table public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);
alter table public.user_presence enable row level security;
create policy "Read own and friends presence" on public.user_presence
  for select to authenticated using (
    user_id = auth.uid() or exists (
      select 1 from public.friendships f
      where (f.user_a = auth.uid() and f.user_b = user_presence.user_id)
         or (f.user_b = auth.uid() and f.user_a = user_presence.user_id)
    )
  );

create function public.dashboard_heartbeat() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.user_presence (user_id, last_seen_at) values (auth.uid(), now())
  on conflict (user_id) do update set last_seen_at = excluded.last_seen_at;
end;
$$;

create function public.record_dashboard_visit(p_game_route text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_game_route not in ('/games/chess', '/games/chess/3dchess', '/games/watten',
    '/games/schafkopf', '/games/natura', '/games/medieval-kingdoms') then
    raise exception 'Unknown game';
  end if;
  insert into public.dashboard_game_visits (user_id, game_route)
  values (auth.uid(), p_game_route)
  on conflict (user_id, game_route, visited_on)
  do update set last_visited_at = now();
end;
$$;

create function public.get_dashboard_activity() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  today date := (now() at time zone 'UTC')::date;
  day_cursor date;
  streak integer := 0;
  recent jsonb;
  challenge jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  day_cursor := today;
  if not exists (select 1 from public.dashboard_game_visits where user_id = auth.uid() and visited_on = today) then
    day_cursor := today - 1;
  end if;
  while exists (select 1 from public.dashboard_game_visits where user_id = auth.uid() and visited_on = day_cursor) loop
    streak := streak + 1;
    day_cursor := day_cursor - 1;
  end loop;
  select coalesce(jsonb_agg(r order by r.last_visited_at desc), '[]'::jsonb) into recent
  from (select game_route, max(last_visited_at) as last_visited_at
    from public.dashboard_game_visits where user_id = auth.uid()
    group by game_route order by max(last_visited_at) desc limit 6) r;
  select jsonb_build_object('title', title, 'description', description, 'target', target,
    'progress', (select count(*) from public.dashboard_game_visits where user_id = auth.uid() and visited_on = today),
    'expires_at', ((today + 1)::timestamp at time zone 'UTC')) into challenge
  from public.dashboard_challenges where id = 'explore' and active;
  return jsonb_build_object('streak', streak, 'recent_games', recent, 'challenge', challenge);
end;
$$;

grant select on public.dashboard_game_visits, public.dashboard_challenges, public.user_presence to authenticated;
revoke all on function public.dashboard_heartbeat(), public.record_dashboard_visit(text), public.get_dashboard_activity() from public, anon;
grant execute on function public.dashboard_heartbeat(), public.record_dashboard_visit(text), public.get_dashboard_activity() to authenticated;
