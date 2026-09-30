-- Three-player Watten displays the solo seat's score against the higher of
-- the two partner scores at match end. Record that same signed side margin.
create function public.record_watten_three_player_result() returns trigger
language plpgsql security definer set search_path = '' as $$
declare player record; v_solo integer; v_team integer; v_delta integer;
begin
  if new.phase = 'matchFinished' and old.phase is distinct from 'matchFinished'
    and new.trump_caller between 0 and 2 then
    v_solo := coalesce((new.match_scores->>new.trump_caller::text)::integer, 0);
    select max(coalesce((new.match_scores->>seat::text)::integer, 0)) into v_team
      from generate_series(0, 2) seat where seat <> new.trump_caller;
    v_team := coalesce(v_team, 0);
    for player in select user_id, seat from public.watten3_room_players where room_id = new.room_id loop
      v_delta := case when player.seat = new.trump_caller then v_solo - v_team else v_team - v_solo end;
      insert into public.user_game_results(game, source_id, user_id, outcome, multiplayer, score_difference)
      values ('watten', new.room_id::text || ':3:' || new.version::text, player.user_id,
        case when v_delta > 0 then 'win' when v_delta < 0 then 'loss' else 'draw' end, true, v_delta)
      on conflict do nothing;
    end loop;
  end if;
  return new;
end; $$;
create trigger record_watten_three_player_result_after_update after update on public.watten3_games
  for each row execute function public.record_watten_three_player_result();
