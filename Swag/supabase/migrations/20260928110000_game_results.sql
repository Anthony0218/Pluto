-- Immutable per-player results. A finished source/version can be processed once.
create table public.user_game_results (
  game text not null check (game in ('chess', 'schafkopf', 'watten')),
  source_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  outcome text not null check (outcome in ('win', 'loss', 'draw')),
  multiplayer boolean not null,
  score_difference integer not null default 0,
  completed_at timestamptz not null default now(),
  primary key (game, source_id, user_id)
);
create index user_game_results_user_idx on public.user_game_results(user_id, game, completed_at desc);
alter table public.user_game_results enable row level security;
create policy "Read own game results" on public.user_game_results for select to authenticated using (user_id = auth.uid());
grant select on public.user_game_results to authenticated;
revoke insert, update, delete on public.user_game_results from anon, authenticated;

create function public.record_classic_chess_result() returns trigger
language plpgsql security definer set search_path = '' as $$
declare player record; v_color text;
begin
  if new.status = 'finished' and old.status is distinct from 'finished' and new.winner in ('white', 'black', 'draw') then
    for player in select user_id, chosen_color from public.chess_room_players where room_id = new.room_id loop
      v_color := player.chosen_color;
      if v_color in ('white', 'black') then
        insert into public.user_game_results(game, source_id, user_id, outcome, multiplayer)
        values ('chess', new.room_id::text || ':' || new.version::text, player.user_id,
          case when new.winner = 'draw' then 'draw' when new.winner = v_color then 'win' else 'loss' end, true)
        on conflict do nothing;
      end if;
    end loop;
  end if;
  return new;
end; $$;
create trigger record_classic_chess_result_after_update after update on public.chess_games
  for each row execute function public.record_classic_chess_result();

-- Schafkopfen uses the engine's actual RoundRecord.deltas, including bonuses,
-- penalties, and multipliers. One finished round is one completed game here.
create function public.record_schafkopf_result() returns trigger
language plpgsql security definer set search_path = '' as $$
declare seat integer; v_player_id text; v_delta integer; v_round text; v_humans integer;
begin
  if new.game->>'phase' = 'finished' and old.game->>'phase' is distinct from 'finished'
    and jsonb_typeof(new.game->'result'->'deltas') = 'array' then
    v_round := coalesce(new.game->>'round', new.version::text);
    select count(*) into v_humans from jsonb_array_elements(new.players) p where p->>'id' !~ '^bot:';
    for seat in 0..3 loop
      v_player_id := new.players->seat->>'id';
      if v_player_id is not null and v_player_id !~ '^bot:' then
        v_delta := (new.game->'result'->'deltas'->>seat)::integer;
        insert into public.user_game_results(game, source_id, user_id, outcome, multiplayer, score_difference)
        values ('schafkopf', new.id::text || ':' || v_round, v_player_id::uuid,
          case when v_delta > 0 then 'win' when v_delta < 0 then 'loss' else 'draw' end,
          v_humans > 1, v_delta)
        on conflict do nothing;
      end if;
    end loop;
  end if;
  return new;
end; $$;
create trigger record_schafkopf_result_after_update after update on public.schafkopf_rooms
  for each row execute function public.record_schafkopf_result();

-- Four-player Watten seats 0/2 are Team A and 1/3 are Team B.
-- Score difference is the final team score minus the opposing final team score.
create function public.record_watten_result() returns trigger
language plpgsql security definer set search_path = '' as $$
declare player record; v_team text; v_delta integer;
begin
  if new.phase = 'matchFinished' and old.phase is distinct from 'matchFinished'
    and new.match_winner in ('team-a', 'team-b') then
    for player in select user_id, seat from public.watten_room_players where room_id = new.room_id loop
      v_team := case when player.seat % 2 = 0 then 'team-a' else 'team-b' end;
      v_delta := case when v_team = 'team-a' then new.team_a_score - new.team_b_score
        else new.team_b_score - new.team_a_score end;
      insert into public.user_game_results(game, source_id, user_id, outcome, multiplayer, score_difference)
      values ('watten', new.room_id::text || ':' || new.version::text, player.user_id,
        case when new.match_winner = v_team then 'win' else 'loss' end, true, v_delta)
      on conflict do nothing;
    end loop;
  end if;
  return new;
end; $$;
create trigger record_watten_result_after_update after update on public.watten_games
  for each row execute function public.record_watten_result();

-- Profiles consume one server aggregate; client pages never increment stats.
create function public.get_my_game_stats() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'general', jsonb_build_object('games_played', count(*), 'wins', count(*) filter (where outcome = 'win')),
    'games', coalesce((select jsonb_object_agg(game, data) from (
      select game, jsonb_build_object('games_played', count(*),
        'multiplayer_games', count(*) filter (where multiplayer),
        'multiplayer_wins', count(*) filter (where multiplayer and outcome = 'win'),
        'wins', count(*) filter (where outcome = 'win'),
        'draws', count(*) filter (where outcome = 'draw'),
        'score_difference', sum(score_difference)) data
      from public.user_game_results where user_id = auth.uid() group by game
    ) grouped), '{}'::jsonb)
  ) from public.user_game_results where user_id = auth.uid();
$$;
revoke all on function public.get_my_game_stats() from public, anon;
grant execute on function public.get_my_game_stats() to authenticated;
