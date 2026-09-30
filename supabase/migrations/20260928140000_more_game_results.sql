-- These multiplayer rooms are mutated by server Edge Functions and have a
-- complete result in their stored state.
alter table public.user_game_results drop constraint user_game_results_game_check;
alter table public.user_game_results add constraint user_game_results_game_check
  check (game in ('chess', 'schafkopf', 'watten', 'atlas', 'go', 'shogi'));

create function public.record_atlas_result() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a text; b text; sa integer; sb integer;
begin
  if new.status = 'finished' and old.status is distinct from 'finished'
    and jsonb_array_length(new.players) = 2 then
    a := new.players->0->>'id'; b := new.players->1->>'id';
    sa := coalesce((new.scores->>a)::integer, 0);
    sb := coalesce((new.scores->>b)::integer, 0);
    insert into public.user_game_results(game, source_id, user_id, outcome, multiplayer, score_difference)
      values ('atlas', new.id::text || ':' || new.version::text, a::uuid,
        case when sa > sb then 'win' when sa < sb then 'loss' else 'draw' end, true, sa - sb),
        ('atlas', new.id::text || ':' || new.version::text, b::uuid,
        case when sb > sa then 'win' when sb < sa then 'loss' else 'draw' end, true, sb - sa)
      on conflict do nothing;
  end if;
  return new;
end; $$;
create trigger record_atlas_result_after_update after update on public.atlas_matches
  for each row execute function public.record_atlas_result();

create function public.record_strategy_result() returns trigger
language plpgsql security definer set search_path = '' as $$
declare player record; v_side text; v_winner text;
begin
  if new.game_state->>'status' = 'finished' and old.game_state->>'status' is distinct from 'finished'
    and jsonb_array_length(new.players) = 2 then
    v_winner := new.game_state->>'winner';
    if v_winner is null or v_winner not in ('black', 'white', 'draw') then return new; end if;
    for player in select ordinal, value->>'id' as user_id
      from jsonb_array_elements(new.players) with ordinality as p(value, ordinal) loop
      v_side := case when player.ordinal = 1 then 'black' else 'white' end;
      insert into public.user_game_results(game, source_id, user_id, outcome, multiplayer)
      values (new.game_type, new.id::text || ':' || new.version::text, player.user_id::uuid,
        case when v_winner = 'draw' then 'draw' when v_winner = v_side then 'win' else 'loss' end, true)
      on conflict do nothing;
    end loop;
  end if;
  return new;
end; $$;
create trigger record_strategy_result_after_update after update on public.strategy_matches
  for each row execute function public.record_strategy_result();

update public.dashboard_challenges set active = true where id = 'quest-58';
