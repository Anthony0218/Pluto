-- Atlas invitations travel through the established friend-message channel.
alter table public.friend_messages drop constraint if exists friend_message_lobby_route;
alter table public.friend_messages add constraint friend_message_lobby_route
  check (game_route is null or (message_type = 'game_code' and (
    (game = 'chess' and game_route ~ '^/games/chess/(classic|variants/[a-z0-9-]+)/multiplayer$')
    or (game = 'chess' and game_route = '/games/atlas-arena/multiplayer')
  )));
