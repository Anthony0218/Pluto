-- Pluto Party counts toward the dashboard's Activity card. Opening the game is recorded like every other game's,
-- but record_dashboard_visit kept its own allowlist and rejected "/games/pluto-party" as an unknown game.
create or replace function public.record_dashboard_visit(p_game_route text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_game_route not in ('/games/eat-it','/games/atlas-arena','/games/go','/games/shogi','/games/chess',
    '/games/chess/3dchess','/games/watten','/games/schafkopf','/games/natura','/games/medieval-kingdoms','/games/pluto-party') then
    raise exception 'Unknown game';
  end if;
  insert into public.dashboard_game_visits(user_id, game_route) values (auth.uid(), p_game_route)
  on conflict (user_id, game_route, visited_on) do update set last_visited_at = now();
end; $$;
revoke all on function public.record_dashboard_visit(text) from public, anon;
grant execute on function public.record_dashboard_visit(text) to authenticated;
