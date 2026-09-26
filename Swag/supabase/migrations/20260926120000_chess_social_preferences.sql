-- Room invites retain the variant lobby, while keeping existing chess/watten message types.
alter table public.friend_messages add column if not exists game_route text;
alter table public.friend_messages add constraint friend_message_lobby_route
  check (game_route is null or (game = 'chess' and message_type = 'game_code'
    and game_route ~ '^/games/chess/(classic|variants/[a-z0-9-]+)/multiplayer$'));

create table public.user_game_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  game_route text not null check (game_route ~ '^/games/[a-zA-Z0-9/-]+$'),
  primary key (user_id, slot),
  unique (user_id, game_route)
);
alter table public.user_game_favorites enable row level security;
create policy "Manage own favorite games" on public.user_game_favorites
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.user_game_favorites to authenticated;

create function public.set_favorite_games(p_routes text[]) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if cardinality(p_routes) > 3 then raise exception 'Choose up to three games'; end if;
  delete from public.user_game_favorites where user_id = auth.uid();
  insert into public.user_game_favorites (user_id, slot, game_route)
    select auth.uid(), ordinality::smallint, route from unnest(p_routes) with ordinality as t(route, ordinality);
end;
$$;
revoke all on function public.set_favorite_games(text[]) from public, anon;
grant execute on function public.set_favorite_games(text[]) to authenticated;
