-- Versioned Roulette endpoint accepts retained-turn FENs for king bonus turns.
-- Like the other variant endpoints, clients resolve the seeded variant engine;
-- the server owns membership, whose turn it is, optimistic versions and undo.
create function public.play_roulette_move_v2(
  p_room_id uuid, p_from text, p_to text, p_move_san text, p_new_fen text,
  p_new_state jsonb, p_expected_version integer, p_is_finished boolean,
  p_winner text, p_end_reason text
) returns void language plpgsql security definer set search_path = '' as $$
declare r public.variant_rooms; g public.variant_games; player_color text; mover text; event jsonb; patch jsonb;
begin
  select * into r from public.variant_rooms where id=p_room_id for update;
  select * into g from public.variant_games where room_id=p_room_id for update;
  select chosen_color::text into player_color from public.variant_room_players where room_id=p_room_id and user_id=auth.uid();
  if auth.uid() is null or player_color is null or r.variant <> 'roulette' then raise exception 'Not a Roulette player'; end if;
  mover := case player_color when 'white' then 'w' when 'black' then 'b' else null end;
  if mover is null or split_part(g.fen,' ',2) <> mover then raise exception 'Not your turn'; end if;
  if g.status <> 'playing' or r.status <> 'playing' or g.version <> p_expected_version or g.undo_requested_by is not null then raise exception 'Game changed; refresh and retry'; end if;
  if p_from !~ '^[a-h][1-8]$' or p_to !~ '^[a-h][1-8]$' or split_part(p_new_fen,' ',2) not in ('w','b')
    or jsonb_typeof(p_new_state->'records') is distinct from 'array'
    or jsonb_array_length(p_new_state->'records') <> jsonb_array_length(coalesce(g.state->'records','[]'))+1
    or p_new_state->'records'->-1->>'fenBefore' is distinct from g.fen
    or p_new_state->'records'->-1->>'fenAfter' is distinct from p_new_fen
    or p_new_state->'records'->-1->>'color' is distinct from mover
    or p_new_state->'records'->-1->>'from' is distinct from p_from
    or p_new_state->'records'->-1->>'to' is distinct from p_to then raise exception 'Invalid Roulette move'; end if;
  event := p_new_state->'records'->-1->'portalEvent';
  if split_part(p_new_fen,' ',2)=mover and (event->>'result' is distinct from 'extra-turn' or event->>'piece' is distinct from 'k') then
    raise exception 'Only a king lucky-square bonus retains the turn';
  end if;
  if p_new_state->'portalState'->>'loser' is not null and
    (not p_is_finished or p_winner is distinct from case p_new_state->'portalState'->>'loser' when 'w' then 'black' else 'white' end) then
    raise exception 'King card must finish the game';
  end if;
  patch := jsonb_build_object('undo_previous_fen',g.fen,'undo_previous_state',g.state,
    'undo_previous_last_from',g.last_move_from,'undo_previous_last_to',g.last_move_to,
    'fen',p_new_fen,'state',p_new_state,'moves',coalesce(to_jsonb(g.moves),'[]') || jsonb_build_array(p_move_san),
    'last_move_from',p_from,'last_move_to',p_to,'version',g.version+1,
    'status',case when p_is_finished then 'finished' else 'playing' end,
    'winner',case when p_is_finished then p_winner end,'end_reason',case when p_is_finished then p_end_reason end,
    'last_action_user_id',auth.uid(),'last_action_kind','move');
  g := jsonb_populate_record(g,patch);
  update public.variant_games set fen=g.fen,state=g.state,moves=g.moves,last_move_from=g.last_move_from,last_move_to=g.last_move_to,
    version=g.version,status=g.status,winner=g.winner,end_reason=g.end_reason,
    undo_previous_fen=g.undo_previous_fen,undo_previous_state=g.undo_previous_state,
    undo_previous_last_from=g.undo_previous_last_from,undo_previous_last_to=g.undo_previous_last_to,
    last_action_user_id=g.last_action_user_id,last_action_kind=g.last_action_kind where room_id=p_room_id;
  if p_is_finished then update public.variant_rooms set status='finished' where id=p_room_id; end if;
end;
$$;
revoke all on function public.play_roulette_move_v2(uuid,text,text,text,text,jsonb,integer,boolean,text,text) from public,anon;
grant execute on function public.play_roulette_move_v2(uuid,text,text,text,text,jsonb,integer,boolean,text,text) to authenticated;
