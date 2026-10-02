-- Bots occupy colors, not fake auth users. Only the host drives their moves.
alter table public.variant_rooms add column if not exists bot_colors text[] not null default '{}';
alter table public.variant_games add column if not exists bot_initial_state jsonb;
alter table public.variant_games add column if not exists bot_undo_snapshot jsonb;

create function public.start_four_player_with_bots(p_room_id uuid, p_bot_colors text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.variant_rooms; g public.variant_games; humans integer;
begin
  select * into r from public.variant_rooms where id = p_room_id for update;
  if auth.uid() is null or r.host_id is distinct from auth.uid() or r.variant <> 'four-player' then raise exception 'Only the host can configure bots'; end if;
  if r.status <> 'waiting' then raise exception 'Game already started'; end if;
  select count(*) into humans from public.variant_room_players where room_id = p_room_id;
  if cardinality(p_bot_colors) not between 1 and 3 or humans + cardinality(p_bot_colors) <> 4
    or (select count(distinct c) from unnest(p_bot_colors) c where c in ('red','blue','yellow','green')) <> cardinality(p_bot_colors)
    or exists(select 1 from public.variant_room_players where room_id = p_room_id and chosen_color::text = any(p_bot_colors)) then
    raise exception 'Fill each empty color exactly once';
  end if;
  select * into g from public.variant_games where room_id = p_room_id for update;
  if not found then raise exception 'Game not found'; end if;
  update public.variant_rooms set bot_colors = p_bot_colors, status = 'playing' where id = p_room_id;
  update public.variant_games set bot_initial_state = to_jsonb(state), status = 'playing', version = version + 1 where room_id = p_room_id;
end;
$$;

-- Existing clients already submit variant state. This endpoint additionally checks
-- membership, bot ownership, active color and optimistic version under row locks.
create function public.play_four_player_mixed_move(
  p_room_id uuid, p_from jsonb, p_to jsonb, p_notation text, p_new_state jsonb, p_expected_version integer
) returns void language plpgsql security definer set search_path = '' as $$
declare r public.variant_rooms; g public.variant_games; player_color text; patch jsonb;
begin
  select * into r from public.variant_rooms where id = p_room_id for update;
  select * into g from public.variant_games where room_id = p_room_id for update;
  if auth.uid() is null or r.variant <> 'four-player' or cardinality(r.bot_colors) = 0 then raise exception 'Invalid mixed room'; end if;
  select chosen_color::text into player_color from public.variant_room_players where room_id = p_room_id and user_id = auth.uid();
  if player_color is null then raise exception 'Not a room player'; end if;
  if g.status <> 'playing' or r.status <> 'playing' or g.version <> p_expected_version or g.undo_requested_by is not null then raise exception 'Game changed; refresh and retry'; end if;
  if g.state->>'turn' = any(r.bot_colors) then
    if r.host_id <> auth.uid() then raise exception 'Only the host controls bots'; end if;
  elsif g.state->>'turn' <> player_color then raise exception 'Not your turn'; end if;
  if jsonb_typeof(p_new_state->'board') is distinct from 'array' or jsonb_array_length(p_new_state->'board') <> 14
    or (p_new_state->>'moveCount')::integer is distinct from (g.state->>'moveCount')::integer + 1
    or p_new_state->'lastMove'->'from' is distinct from p_from or p_new_state->'lastMove'->'to' is distinct from p_to
    or p_new_state->'lastMove'->>'color' is distinct from g.state->>'turn' then raise exception 'Invalid move state'; end if;
  patch := jsonb_build_object(
    'state', p_new_state, 'moves', coalesce(to_jsonb(g.moves),'[]') || jsonb_build_array(p_notation),
    'state_history', coalesce(to_jsonb(g.state_history),'[]') || jsonb_build_array(p_new_state),
    'version', g.version + 1, 'status', case when p_new_state->>'winner' is null then 'playing' else 'finished' end,
    'winner', p_new_state->>'winner', 'end_reason', case when p_new_state->>'winner' is not null then 'last player standing' end,
    'last_action_user_id', auth.uid(), 'last_action_kind', case when g.state->>'turn' = any(r.bot_colors) then 'bot-move' else 'move' end);
  -- Keep the last human decision as the undo boundary, including subsequent bot replies.
  if not (g.state->>'turn' = any(r.bot_colors)) then
    patch := patch || jsonb_build_object('bot_undo_snapshot', jsonb_build_object('state',g.state,'moves',g.moves,'state_history',g.state_history,'user_id',auth.uid()));
  end if;
  g := jsonb_populate_record(g, patch);
  update public.variant_games set state=g.state, moves=g.moves, state_history=g.state_history, version=g.version,
    status=g.status, winner=g.winner, end_reason=g.end_reason, last_action_user_id=g.last_action_user_id,
    last_action_kind=g.last_action_kind, bot_undo_snapshot=g.bot_undo_snapshot where room_id=p_room_id;
  if g.status = 'finished' then update public.variant_rooms set status='finished' where id=p_room_id; end if;
end;
$$;

create function public.four_player_mixed_action(p_room_id uuid, p_action text, p_accept boolean default false, p_state jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.variant_rooms; g public.variant_games; player_color text; human_count integer; patch jsonb := '{}'; votes jsonb; ready jsonb;
begin
  select * into r from public.variant_rooms where id=p_room_id for update;
  select * into g from public.variant_games where room_id=p_room_id for update;
  select chosen_color::text into player_color from public.variant_room_players where room_id=p_room_id and user_id=auth.uid();
  if auth.uid() is null or player_color is null or r.variant <> 'four-player' or cardinality(r.bot_colors)=0 then raise exception 'Not a mixed room player'; end if;
  select count(*) into human_count from public.variant_room_players where room_id=p_room_id;
  if p_action = 'undo-request' then
    if g.status <> 'playing' or g.undo_requested_by is not null or g.bot_undo_snapshot->>'user_id' is distinct from auth.uid()::text then raise exception 'Undo unavailable'; end if;
    patch := jsonb_build_object('undo_requested_by',auth.uid(),'undo_requested_version',g.version,'undo_votes','[]'::jsonb);
    if human_count = 1 then patch := (g.bot_undo_snapshot - 'user_id') || jsonb_build_object('undo_requested_by',null,'bot_undo_snapshot',null,'last_action_kind','undo'); end if;
  elsif p_action = 'undo-response' then
    if g.undo_requested_by is null or g.undo_requested_by = auth.uid() then raise exception 'No request to answer'; end if;
    votes := coalesce(to_jsonb(g.undo_votes),'[]');
    if votes @> jsonb_build_array(auth.uid()) then raise exception 'Already voted'; end if;
    votes := votes || jsonb_build_array(auth.uid());
    if not p_accept then patch := jsonb_build_object('undo_requested_by',null,'undo_votes','[]'::jsonb);
    elsif jsonb_array_length(votes) >= human_count-1 then
      patch := (g.bot_undo_snapshot - 'user_id') || jsonb_build_object('undo_requested_by',null,'undo_votes','[]'::jsonb,'bot_undo_snapshot',null,'last_action_kind','undo');
    else patch := jsonb_build_object('undo_votes',votes); end if;
  elsif p_action = 'rematch' then
    if g.status <> 'finished' then raise exception 'Game has not finished'; end if;
    ready := coalesce(to_jsonb(g.rematch_ready),'[]');
    if not (ready @> jsonb_build_array(auth.uid())) then ready := ready || jsonb_build_array(auth.uid()); end if;
    patch := jsonb_build_object('rematch_ready',ready);
    if jsonb_array_length(ready) = human_count then
      patch := jsonb_build_object('state',g.bot_initial_state,'state_history',jsonb_build_array(g.bot_initial_state),'moves','[]'::jsonb,
        'status','playing','winner',null,'end_reason',null,'rematch_ready','[]'::jsonb,'undo_votes','[]'::jsonb,'undo_requested_by',null,'bot_undo_snapshot',null,'last_action_kind','rematch');
      update public.variant_rooms set status='playing' where id=p_room_id;
    end if;
  elsif p_action = 'resign' then
    if g.status <> 'playing' or g.undo_requested_by is not null or not (g.state->'activePlayers' ? player_color)
      or p_state->'activePlayers' ? player_color or jsonb_typeof(p_state->'board') is distinct from 'array' then raise exception 'Cannot resign'; end if;
    patch := jsonb_build_object('state',p_state,'state_history',coalesce(to_jsonb(g.state_history),'[]') || jsonb_build_array(p_state),
      'moves',coalesce(to_jsonb(g.moves),'[]') || jsonb_build_array(player_color || ' resigns'),
      'status',case when p_state->>'winner' is null then 'playing' else 'finished' end,'winner',p_state->>'winner',
      'last_action_kind','resign','bot_undo_snapshot',null);
  else raise exception 'Unknown action'; end if;
  g := jsonb_populate_record(g,patch || jsonb_build_object('version',g.version+1));
  update public.variant_games set state=g.state, state_history=g.state_history, moves=g.moves, status=g.status, winner=g.winner,
    end_reason=g.end_reason, version=g.version, undo_requested_by=g.undo_requested_by, undo_requested_version=g.undo_requested_version,
    undo_votes=g.undo_votes, rematch_ready=g.rematch_ready, bot_undo_snapshot=g.bot_undo_snapshot, last_action_kind=g.last_action_kind where room_id=p_room_id;
  if g.status = 'finished' then update public.variant_rooms set status='finished' where id=p_room_id; end if;
end;
$$;
revoke all on function public.start_four_player_with_bots(uuid,text[]) from public,anon;
revoke all on function public.play_four_player_mixed_move(uuid,jsonb,jsonb,text,jsonb,integer) from public,anon;
revoke all on function public.four_player_mixed_action(uuid,text,boolean,jsonb) from public,anon;
grant execute on function public.start_four_player_with_bots(uuid,text[]) to authenticated;
grant execute on function public.play_four_player_mixed_move(uuid,jsonb,jsonb,text,jsonb,integer) to authenticated;
grant execute on function public.four_player_mixed_action(uuid,text,boolean,jsonb) to authenticated;
