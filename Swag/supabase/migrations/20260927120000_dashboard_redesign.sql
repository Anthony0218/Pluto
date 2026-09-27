-- Ordered favorites remain in the existing table; a marker distinguishes
-- "never configured" from an intentionally empty selection on every device.
alter table public.user_game_favorites drop constraint user_game_favorites_slot_check;
alter table public.user_game_favorites add constraint user_game_favorites_slot_check check (slot between 1 and 6);
create table public.dashboard_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.dashboard_preferences enable row level security;
create policy "Own dashboard preferences" on public.dashboard_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert on public.dashboard_preferences to authenticated;
insert into public.dashboard_preferences (user_id) select distinct user_id from public.user_game_favorites;

create function public.get_favorite_games() returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.dashboard_preferences where user_id = auth.uid())
    and not exists (select 1 from public.user_game_favorites where user_id = auth.uid()) then
    return null;
  end if;
  return (select coalesce(jsonb_agg(game_route order by slot), '[]'::jsonb)
    from public.user_game_favorites where user_id = auth.uid());
end;
$$;

create or replace function public.set_favorite_games(p_routes text[]) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_routes is null or cardinality(p_routes) > 6 then raise exception 'Choose up to six games'; end if;
  if exists (select 1 from unnest(p_routes) route where route is null or route not in (
    '/games/chess', '/games/watten', '/games/schafkopf', '/games/chess/3dchess',
    '/games/go', '/games/shogi', '/games/natura', '/games/atlas-arena', '/games/medieval-kingdoms'
  )) then raise exception 'Unknown game'; end if;
  if (select count(distinct route) from unnest(p_routes) route) <> cardinality(p_routes) then
    raise exception 'Duplicate game';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  insert into public.dashboard_preferences (user_id) values (auth.uid()) on conflict do nothing;
  delete from public.user_game_favorites where user_id = auth.uid();
  insert into public.user_game_favorites (user_id, slot, game_route)
    select auth.uid(), ordinality::smallint, route from unnest(p_routes) with ordinality as t(route, ordinality);
end;
$$;
revoke all on function public.get_favorite_games(), public.set_favorite_games(text[]) from public, anon;
grant execute on function public.get_favorite_games(), public.set_favorite_games(text[]) to authenticated;

-- Extend the existing challenge catalog instead of introducing client-side selection.
alter table public.dashboard_challenges
  add column category text not null default 'explore' check (category in ('puzzle', 'learning', 'play', 'win', 'explore', 'social', 'variant')),
  add column route text not null default '/games',
  add column cta text not null default 'Choose a game';
insert into public.dashboard_challenges (id, category, title, description, target, route, cta) values
  ('puzzle-one', 'puzzle', 'Solve a chess puzzle', 'Find the best move in a puzzle from the library.', 1, '/games/chess/rules?tab=puzzles', 'Solve Challenge'),
  ('puzzle-three', 'puzzle', 'Solve three puzzles', 'Build your tactical vision with three library puzzles today.', 3, '/games/chess/rules?tab=puzzles', 'Solve Challenge'),
  ('learn-watten', 'learning', 'Discover a Watten rule', 'Open the rulebook and review the order of the cards.', 1, '/games/watten/rules', 'Learn Watten'),
  ('learn-schafkopf', 'learning', 'Discover the called ace', 'Open the Schafkopf rules and discover how partners are chosen.', 1, '/games/schafkopf?rules=open#rules', 'Learn Schafkopfen'),
  ('learn-chess', 'learning', 'Refresh your chess fundamentals', 'Open the chess rulebook and revisit a rule before your next game.', 1, '/games/chess/rules', 'Learn chess'),
  ('learn-go', 'learning', 'Discover liberties in Go', 'Open the Go rules and learn how connected groups survive.', 1, '/games/go/rules', 'Learn Go'),
  ('variant', 'variant', 'Explore a chess variant', 'Open the variant collection and discover a new way to play.', 1, '/games/chess/variants', 'Explore variants'),
  ('social-invite', 'social', 'Challenge a friend', 'Send a game room invitation through your friend chat today.', 1, '/friends', 'Choose a friend');

-- A resource visit is exploration, not proof of finishing a lesson or winning.
create table public.dashboard_resource_visits (
  user_id uuid not null references auth.users(id) on delete cascade,
  route text not null,
  visited_on date not null default (now() at time zone 'UTC')::date,
  primary key (user_id, route, visited_on)
);
alter table public.dashboard_resource_visits enable row level security;
create policy "Read own resource visits" on public.dashboard_resource_visits for select to authenticated using (user_id = auth.uid());
grant select on public.dashboard_resource_visits to authenticated;
create function public.record_dashboard_resource_visit(p_route text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.dashboard_challenges where route = p_route and category in ('learning', 'variant')) then
    raise exception 'Unknown resource';
  end if;
  insert into public.dashboard_resource_visits (user_id, route) values (auth.uid(), p_route) on conflict do nothing;
end;
$$;
revoke all on function public.record_dashboard_resource_visit(text) from public, anon;
grant execute on function public.record_dashboard_resource_visit(text) to authenticated;

-- Keep the existing streak/recent-activity behavior intact.
alter function public.get_dashboard_activity() rename to get_dashboard_activity_base;
create function public.get_dashboard_activity() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  today date := (now() at time zone 'UTC')::date;
  starts_at timestamptz := today::timestamp at time zone 'UTC';
  ends_at timestamptz := (today + 1)::timestamp at time zone 'UTC';
  result jsonb;
  chosen public.dashboard_challenges%rowtype;
  challenge_count integer;
  selected_index integer;
  progress integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  result := public.get_dashboard_activity_base();
  select count(*) into challenge_count from public.dashboard_challenges where active;
  if challenge_count = 0 then return jsonb_set(result, '{challenge}', 'null'::jsonb); end if;
  selected_index := (('x' || substr(md5(today::text || auth.uid()::text), 1, 8))::bit(32)::bigint % challenge_count)::integer;
  select * into chosen from public.dashboard_challenges where active order by id offset selected_index limit 1;
  if chosen.category = 'explore' then
    select count(*) into progress from public.dashboard_game_visits where user_id = auth.uid() and visited_on = today;
  elsif chosen.category in ('learning', 'variant') then
    select count(*) into progress from public.dashboard_resource_visits where user_id = auth.uid() and visited_on = today and route = chosen.route;
  elsif chosen.category = 'social' then
    select count(*) into progress from public.friend_messages where sender_id = auth.uid() and message_type = 'game_code' and created_at >= starts_at and created_at < ends_at;
  else
    -- Puzzle progress is read through the existing completion RPC in useDashboardData.
    -- Play/win types can be enabled once a daily results ledger exists.
    progress := null;
  end if;
  return jsonb_set(result, '{challenge}', jsonb_build_object(
    'id', chosen.id, 'category', chosen.category, 'title', chosen.title,
    'description', chosen.description, 'target', chosen.target, 'progress', progress,
    'route', chosen.route, 'cta', chosen.cta, 'expires_at', ends_at
  ));
end;
$$;
revoke all on function public.get_dashboard_activity() from public, anon;
grant execute on function public.get_dashboard_activity() to authenticated;

