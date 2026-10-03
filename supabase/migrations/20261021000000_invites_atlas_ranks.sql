-- Keep existing clocks in active matches intact; these presets apply to new games.
-- Older deployments may predate the byo-yomi configuration columns.
alter table public.go_ranked_time_controls
  add column if not exists byo_yomi_periods integer not null default 5 check (byo_yomi_periods > 0),
  add column if not exists byo_yomi_ms double precision not null default 30000 check (byo_yomi_ms > 0);
update public.go_ranked_time_controls set initial_ms=30000, byo_yomi_periods=5, byo_yomi_ms=10000 where id='blitz';
update public.go_ranked_time_controls set initial_ms=300000, byo_yomi_periods=5, byo_yomi_ms=30000 where id='normal';

create function public.get_atlas_ranked_leaderboard(p_user_ids uuid[] default null)
returns table(user_id uuid, username text, rating double precision, matches_played integer, leaderboard_rank bigint)
language sql stable security definer set search_path=public as $$
  with ranked as (
    select r.user_id, row_number() over(order by r.rating desc, r.matches_played desc, r.user_id) as position
    from atlas_ranked_profiles r where r.matches_played > 0
  )
  select r.user_id, coalesce(p.display_name,p.username,'Explorer'), r.rating, r.matches_played, ranked.position
  from atlas_ranked_profiles r left join profiles p on p.id=r.user_id left join ranked on ranked.user_id=r.user_id
  where (p_user_ids is null and ranked.position is not null) or r.user_id=any(p_user_ids)
  order by ranked.position nulls last, r.user_id limit 100;
$$;
revoke all on function public.get_atlas_ranked_leaderboard(uuid[]) from public;
grant execute on function public.get_atlas_ranked_leaderboard(uuid[]) to anon, authenticated;

-- Metadata only. Every game still validates membership and seats in its own join routine.
-- A code can collide across games: return all matches so the UI never silently chooses the wrong game.
create function public.resolve_game_invite(p_code text)
returns table(game_route text, mode text)
language plpgsql stable security definer set search_path=public as $$
declare c text:=upper(btrim(p_code));
begin
  if auth.uid() is null then raise exception 'Sign in to join a room.'; end if;
  if c !~ '^[A-Z0-9]{6}$' then raise exception 'Enter a six-character room code.'; end if;
  return query
    select '/games/chess/classic/multiplayer', 'classic'
    from chess_rooms r where r.code=c and not exists(select 1 from ranked_chess_matches m where m.room_id=r.id)
    union all select '/games/chess/variants/'||(case r.variant when 'four-player' then '4-players' when 'king-of-the-hill' then 'kingofthehill' else r.variant end)||'/multiplayer', r.variant from variant_rooms r where r.code=c
    union all select '/games/watten/multiplayer/4', 'four-player' from watten_rooms r where r.code=c
    union all select '/games/watten/multiplayer/3', 'three-player' from watten3_rooms r where r.code=c
    union all select '/games/schafkopf/multiplayer', 'Schafkopf' from schafkopf_rooms r where r.code=c
    union all select '/games/'||r.game_type||'/multiplayer', r.game_type from strategy_matches r where r.room_code=c
    union all select '/games/atlas-arena/multiplayer', r.mode from atlas_matches r where r.room_code=c and r.match_kind='casual' and r.status <> 'cancelled'
    union all select '/games/eat-it/multiplayer', 'Eat It' from eat_it_matches r where r.room_code=c
    union all select '/chess-custom/play/multiplayer', 'Custom Chess' from chess_custom_matches r where r.code=c
    union all select '/games/card-builder/room', 'Card Builder' from card_game_sessions r where r.code=c;
end;
$$;
revoke all on function public.resolve_game_invite(text) from public;
grant execute on function public.resolve_game_invite(text) to authenticated;

alter table public.friend_messages drop constraint if exists friend_message_lobby_route;
alter table public.friend_messages add constraint friend_message_lobby_route check (
  game_route is null or (message_type='game_code' and (
    (game='chess' and (game_route ~ '^/games/chess/(classic|variants/[a-z0-9-]+)/multiplayer$'
      or game_route in ('/games/chess/ranked','/games/atlas-arena/multiplayer','/games/eat-it/multiplayer','/games/go/multiplayer','/games/shogi/multiplayer','/games/schafkopf/multiplayer','/chess-custom/play/multiplayer','/games/card-builder/room','/games/pluto-party')))
    or (game='watten' and game_route in ('/games/watten/multiplayer','/games/watten/multiplayer/3','/games/watten/multiplayer/4'))
  ))
);
