-- Additive JSON detail fields preserve historical rows and the immutable ledger.
create or replace function public.record_eat_it_result() returns trigger
language plpgsql security definer set search_path = '' as $$
declare participant jsonb; player jsonb;
begin
  if new.status = 'finished' and old.status is distinct from 'finished' then
    for participant in select value from jsonb_array_elements(new.players) loop
      select value into player from jsonb_array_elements(new.game_state->'players') where value->>'id' = participant->>'id';
      if player is not null then
        insert into public.user_game_results(game, source_id, user_id, outcome, multiplayer, details)
        values ('eat-it', new.game_state->>'id', (participant->>'id')::uuid,
          case when new.game_state->>'winnerId' = participant->>'id' then 'win'
            when new.game_state->>'result' = 'tie' and coalesce(new.game_state->'tiedIds', '[]'::jsonb) ? (participant->>'id') then 'draw' else 'loss' end,
          true, jsonb_build_object('placement', player->'placement', 'mass', player->'mass', 'score', player->'score',
            'playersEaten', player->'playersEaten', 'foodEaten', player->'foodEaten', 'powerupsCollected', player->'powerupsCollected',
            'duration', new.game_state->'time', 'map', new.game_state->'map', 'schemaVersion', 3,
            'settings', coalesce(new.game_state->'settings', '{}'::jsonb), 'startingLives', case when new.game_state->'settings'->>'livesEnabled' = 'false' then 1 else 3 end,
            'stats', coalesce(player->'stats', '{}'::jsonb), 'lives', player->'lives', 'result', new.game_state->'result',
            'winnerId', new.game_state->'winnerId', 'hell', new.game_state->'hell' is not null,
            'timeline', coalesce(new.game_state->'timeline', '[]'::jsonb))) on conflict do nothing;
      end if;
    end loop;
  end if;
  return new;
end; $$;
