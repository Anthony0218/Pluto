-- Same authenticated Edge Function / versioned room / Realtime pattern as Atlas.
create table public.eat_it_matches (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique check (room_code ~ '^[A-Z0-9]{6}$'),
  host_id uuid not null references auth.users(id) on delete cascade,
  players jsonb not null default '[]'::jsonb check (jsonb_typeof(players) = 'array' and jsonb_array_length(players) <= 8),
  settings jsonb not null check (settings->>'map' in ('city','nature') and (settings->>'count')::integer between 2 and 8),
  status text not null default 'waiting' check (status in ('waiting','playing','finished')),
  game_state jsonb,
  last_tick double precision not null,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.eat_it_matches enable row level security;
create policy "eat it participants read" on public.eat_it_matches for select to authenticated
  using (players @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text)));
revoke all on public.eat_it_matches from anon, authenticated;
grant select on public.eat_it_matches to authenticated;
grant all on public.eat_it_matches to service_role;
create index eat_it_matches_host_idx on public.eat_it_matches(host_id, created_at);
alter publication supabase_realtime add table public.eat_it_matches;

-- Reuse the immutable result ledger, including the existing profile aggregate RPC.
alter table public.user_game_results drop constraint user_game_results_game_check;
alter table public.user_game_results add constraint user_game_results_game_check
  check (game in ('chess','schafkopf','watten','atlas','go','shogi','eat-it'));
alter table public.user_game_results add column if not exists details jsonb not null default '{}'::jsonb;
create function public.record_eat_it_result() returns trigger
language plpgsql security definer set search_path = '' as $$
declare participant jsonb; player jsonb;
begin
  if new.status = 'finished' and old.status is distinct from 'finished' then
    for participant in select value from jsonb_array_elements(new.players) loop
      select value into player from jsonb_array_elements(new.game_state->'players') where value->>'id' = participant->>'id';
      if player is not null then
        insert into public.user_game_results(game, source_id, user_id, outcome, multiplayer, details)
          values ('eat-it', new.game_state->>'id', (participant->>'id')::uuid,
            case when new.game_state->>'winnerId' = participant->>'id' then 'win' else 'loss' end, true,
            jsonb_build_object('placement', player->'placement', 'mass', player->'mass', 'score', player->'score',
              'playersEaten', player->'playersEaten', 'foodEaten', player->'foodEaten', 'powerupsCollected', player->'powerupsCollected',
              'duration', new.game_state->'time', 'map', new.game_state->'map'))
          on conflict do nothing;
      end if;
    end loop;
  end if;
  return new;
end; $$;
create trigger record_eat_it_result_after_update after update on public.eat_it_matches
  for each row execute function public.record_eat_it_result();

-- Preserve the legacy friend-message game field; game_route determines the destination.
alter table public.friend_messages drop constraint if exists friend_message_lobby_route;
alter table public.friend_messages add constraint friend_message_lobby_route
  check (game_route is null or (message_type = 'game_code' and (
    (game = 'chess' and game_route ~ '^/games/chess/(classic|variants/[a-z0-9-]+)/multiplayer$')
    or (game = 'chess' and game_route in ('/games/chess/ranked','/games/atlas-arena/multiplayer','/games/eat-it/multiplayer'))
  )));

create or replace function public.record_dashboard_visit(p_game_route text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_game_route not in ('/games/eat-it','/games/atlas-arena','/games/go','/games/shogi','/games/chess',
    '/games/chess/3dchess','/games/watten','/games/schafkopf','/games/natura','/games/medieval-kingdoms') then
    raise exception 'Unknown game';
  end if;
  insert into public.dashboard_game_visits(user_id, game_route) values (auth.uid(), p_game_route)
  on conflict (user_id, game_route, visited_on) do update set last_visited_at = now();
end; $$;
revoke all on function public.record_dashboard_visit(text) from public, anon;
grant execute on function public.record_dashboard_visit(text) to authenticated;
