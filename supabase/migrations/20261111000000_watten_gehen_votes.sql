-- Gehen is answered by the whole opposing side: one vote to stay keeps the raise, but giving up
-- (gehen) needs a vote from every player of that side. Four players: both players of the
-- opposing team. Three players: both team players when the solo player raised; the solo
-- player alone when the team raised.
alter table public.watten_games add column if not exists bid_votes jsonb not null default '{}'::jsonb;
alter table public.watten3_games add column if not exists bid_votes jsonb not null default '{}'::jsonb;

create or replace function public.respond_watten_bid(p_room_id uuid, p_hold boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_seat integer;
  v_phase text;
  v_round_value integer;
  v_pending_team text;
  v_pending_value integer;
  v_my_team text;
  v_votes jsonb;
  v_gehen integer;
  v_result_phase text;
  v_team_a_score integer;
  v_team_b_score integer;
  v_match_winner text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select phase, round_value, pending_bid_team, pending_bid_value, bid_votes
  into v_phase, v_round_value, v_pending_team, v_pending_value, v_votes
  from public.watten_games
  where room_id = p_room_id
  for update;

  if not found then
    raise exception 'Game not found';
  end if;

  if v_phase <> 'bidPending' or v_pending_team is null or v_pending_value is null then
    raise exception 'No Gehen decision is pending';
  end if;

  select seat into v_seat
  from public.watten_room_players
  where room_id = p_room_id and user_id = v_user_id;

  if v_seat is null then
    raise exception 'You are not a player in this room';
  end if;

  v_my_team := case when mod(v_seat, 2) = 0 then 'team-a' else 'team-b' end;

  if v_my_team = v_pending_team then
    raise exception 'The opposing team must answer';
  end if;

  -- One vote to stay is enough.
  if p_hold then
    update public.watten_games
    set round_value = v_pending_value,
        last_bid_team = v_pending_team,
        pending_bid_team = null,
        pending_bid_value = null,
        bid_votes = '{}'::jsonb,
        phase = 'playing',
        version = version + 1,
        updated_at = now()
    where room_id = p_room_id;

    return jsonb_build_object('success', true, 'held', true, 'round_value', v_pending_value);
  end if;

  -- Giving up needs both players of the answering team.
  v_votes := coalesce(v_votes, '{}'::jsonb) || jsonb_build_object(v_seat::text, 'gehen');
  select count(*) into v_gehen from jsonb_each_text(v_votes) where value = 'gehen';

  if v_gehen < 2 then
    update public.watten_games
    set bid_votes = v_votes,
        version = version + 1,
        updated_at = now()
    where room_id = p_room_id;

    return jsonb_build_object('success', true, 'held', false, 'pending', true, 'gehen_votes', v_gehen);
  end if;

  -- The bidder gets the previously accepted value, not the proposed one.
  update public.watten_games
  set winner = v_pending_team,
      phase = 'roundFinished',
      round_end_reason = 'declined',
      played_cards = '[]'::jsonb,
      trick_winner_seat = null,
      pending_bid_team = null,
      pending_bid_value = null,
      bid_votes = '{}'::jsonb,
      version = version + 1,
      updated_at = now()
  where room_id = p_room_id
  returning phase, team_a_score, team_b_score, match_winner
  into v_result_phase, v_team_a_score, v_team_b_score, v_match_winner;

  return jsonb_build_object(
    'success', true,
    'held', false,
    'winner', v_pending_team,
    'points_awarded', v_round_value,
    'team_a_score', v_team_a_score,
    'team_b_score', v_team_b_score,
    'match_winner', v_match_winner,
    'phase', v_result_phase
  );
end;
$function$;

create or replace function public.respond_watten3_bid(p_room_id uuid, p_hold boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_game public.watten3_games%rowtype;
  v_seat integer;
  v_side text;
  v_votes jsonb;
  v_gehen integer;
  v_needed integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_game
  from public.watten3_games
  where room_id = p_room_id
  for update;

  if v_game.phase <> 'bidPending'
     or v_game.pending_bid_side is null
     or v_game.pending_bid_value is null then
    raise exception 'No Gehen decision is pending';
  end if;

  select seat into v_seat
  from public.watten3_room_players
  where room_id = p_room_id and user_id = v_user_id;

  if v_seat is null then
    raise exception 'You are not a player in this room';
  end if;

  v_side := case when v_seat = v_game.trump_caller then 'solo' else 'team' end;

  if v_side = v_game.pending_bid_side then
    raise exception 'The bidding side cannot answer its own raise';
  end if;

  -- One vote to stay is enough.
  if p_hold then
    update public.watten3_games
    set phase = 'playing',
        round_value = pending_bid_value,
        last_bid_side = pending_bid_side,
        pending_bid_side = null,
        pending_bid_value = null,
        bid_votes = '{}'::jsonb,
        version = version + 1,
        updated_at = now()
    where room_id = p_room_id;
    return;
  end if;

  -- The two team players answer a raise by the solo player together; the solo player answers alone.
  v_needed := case when v_game.pending_bid_side = 'solo' then 2 else 1 end;
  v_votes := coalesce(v_game.bid_votes, '{}'::jsonb) || jsonb_build_object(v_seat::text, 'gehen');
  select count(*) into v_gehen from jsonb_each_text(v_votes) where value = 'gehen';

  if v_gehen < v_needed then
    update public.watten3_games
    set bid_votes = v_votes,
        version = version + 1,
        updated_at = now()
    where room_id = p_room_id;
    return;
  end if;

  update public.watten3_games set bid_votes = '{}'::jsonb where room_id = p_room_id;
  perform public.watten3_award_side(p_room_id, v_game.pending_bid_side, v_game.round_value, 'declined');
end;
$function$;
