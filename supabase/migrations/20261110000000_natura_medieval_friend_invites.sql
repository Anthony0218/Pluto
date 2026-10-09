-- Friend invites can point at Natura and Medieval Kingdoms rooms. Their rooms are not rows
-- the database can look up (Natura runs on a relay, Medieval Kingdoms in its own match
-- function), so the invite carries the lobby route and room code and nothing else.
alter table public.friend_messages drop constraint if exists friend_message_lobby_route;
alter table public.friend_messages add constraint friend_message_lobby_route check (
  game_route is null or (message_type='game_code' and (
    (game='chess' and (game_route ~ '^/games/chess/(classic|variants/[a-z0-9-]+)/multiplayer$'
      or game_route in ('/games/chess/ranked','/games/atlas-arena/multiplayer','/games/eat-it/multiplayer','/games/go/multiplayer','/games/shogi/multiplayer','/games/schafkopf/multiplayer','/chess-custom/play/multiplayer','/games/card-builder/room','/games/pluto-party','/games/natura','/games/medieval-kingdoms')))
    or (game='watten' and game_route in ('/games/watten/multiplayer','/games/watten/multiplayer/3','/games/watten/multiplayer/4'))
  ))
);
