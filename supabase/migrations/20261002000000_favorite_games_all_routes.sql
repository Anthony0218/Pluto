-- Saving more than a few dashboard favorites failed with "Unknown game" whenever
-- a newer game (Pluto Party, Eat It, ...) was included, because the RPC kept its
-- own hard-coded route list. Validate the route shape instead of an allowlist so
-- new games never need a follow-up migration, and make sure eight slots are open.
alter table public.user_game_favorites drop constraint if exists user_game_favorites_slot_check;
alter table public.user_game_favorites add constraint user_game_favorites_slot_check check (slot between 1 and 8);

create or replace function public.set_favorite_games(p_routes text[]) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_routes is null or cardinality(p_routes) > 8 then raise exception 'Choose up to eight games'; end if;
  if exists (select 1 from unnest(p_routes) route where route is null or route !~ '^/games/[a-zA-Z0-9/-]+$') then
    raise exception 'Unknown game';
  end if;
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
revoke all on function public.set_favorite_games(text[]) from public, anon;
grant execute on function public.set_favorite_games(text[]) to authenticated;
