-- Per-game leaderboards: top 10 by verified multiplayer wins.
-- user_game_results is readable only by its owner, so this aggregate runs as
-- definer and exposes nothing beyond public profile names and win counts.
create function public.get_game_wins_leaderboard(p_game text) returns table
  (rank bigint, user_id uuid, username text, avatar_id text, wins integer, games integer)
language sql stable security definer set search_path = '' as $$
  with totals as (
    select r.user_id,
      (count(*) filter (where r.outcome = 'win'))::integer as wins,
      count(*)::integer as games
    from public.user_game_results r
    where r.game = p_game and r.multiplayer
      and p_game in ('schafkopf', 'watten', 'atlas', 'go', 'shogi', 'eat-it')
    group by r.user_id
  )
  select row_number() over (order by t.wins desc, t.games asc, t.user_id)::bigint,
    t.user_id, coalesce(p.display_name, p.username, 'Player')::text,
    p.avatar_id::text, t.wins, t.games
  from totals t join public.profiles p on p.id = t.user_id
  where t.wins > 0
  order by t.wins desc, t.games asc, t.user_id limit 10;
$$;
revoke all on function public.get_game_wins_leaderboard(text) from public, anon;
grant execute on function public.get_game_wins_leaderboard(text) to authenticated;
