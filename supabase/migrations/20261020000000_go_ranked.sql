-- Go cannot share Chess position/clock tables (their triggers interpret FEN).
-- Reuse the queue lease registry, mutex, Elo formula and tier/leaderboard order.
create table public.go_ranked_time_controls (
  id text primary key check(id in ('blitz','normal')),
  initial_ms double precision not null check(initial_ms > 0),
  byo_yomi_periods integer not null check(byo_yomi_periods > 0),
  byo_yomi_ms double precision not null check(byo_yomi_ms > 0),
  board_size integer not null default 9 check(board_size = 9),
  komi numeric not null default 6.5
);
insert into public.go_ranked_time_controls(id,initial_ms,byo_yomi_periods,byo_yomi_ms) values ('blitz',30000,5,10000),('normal',300000,5,30000);
-- Values are mirrored by src/games/go/ranked/config.ts; contract-tested.
grant select on public.go_ranked_time_controls to authenticated;
create table public.go_ratings (
  user_id uuid references auth.users(id) on delete cascade,
  time_control text references public.go_ranked_time_controls(id),
  rating integer not null default 1200 check(rating >= 100),
  rated_games integer not null default 0,
  peak_rating integer not null default 1200,
  wins integer not null default 0, losses integer not null default 0, draws integer not null default 0,
  updated_at timestamptz not null default now(), primary key(user_id,time_control)
);
create index go_ratings_leaderboard_idx on public.go_ratings(time_control,rating desc,rated_games desc,user_id) where rated_games > 0;
insert into public.go_ratings(user_id,time_control) select u.id,c.id from auth.users u cross join public.go_ranked_time_controls c;
create function public.create_default_go_ratings() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.go_ratings(user_id,time_control) select new.id,c.id from public.go_ranked_time_controls c on conflict do nothing;
  return new;
end; $$;
create trigger default_go_ratings after insert on auth.users for each row execute function public.create_default_go_ratings();
revoke all on function public.create_default_go_ratings() from public,anon,authenticated;
create table public.go_ranked_games (
  id uuid primary key default gen_random_uuid(), code text not null unique,
  black_id uuid not null references auth.users(id), white_id uuid not null references auth.users(id),
  time_control text not null references public.go_ranked_time_controls(id),
  state jsonb not null, version integer not null default 0,
  status text not null default 'ready' check(status in ('ready','playing','finished','abandoned')),
  ready_users uuid[] not null default '{}',
  black_time_ms double precision not null check(black_time_ms >= 0), white_time_ms double precision not null check(white_time_ms >= 0),
  byo_yomi_ms double precision not null check(byo_yomi_ms > 0),
  black_period_ms double precision not null check(black_period_ms >= 0), white_period_ms double precision not null check(white_period_ms >= 0),
  black_periods_remaining integer not null check(black_periods_remaining >= 0), white_periods_remaining integer not null check(white_periods_remaining >= 0),
  clock_started_at timestamptz, winner text check(winner in ('black','white','draw')),
  end_reason text, created_at timestamptz not null default clock_timestamp(), completed_at timestamptz,
  check(black_id <> white_id)
);
create index go_ranked_games_black_active_idx on public.go_ranked_games(black_id) where status in ('ready','playing');
create index go_ranked_games_white_active_idx on public.go_ranked_games(white_id) where status in ('ready','playing');
create table public.ranked_go_queue (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid not null references public.ranked_chess_queue_sessions(id) on delete cascade,
  time_control text not null references public.go_ranked_time_controls(id),
  rating integer not null, joined_at timestamptz not null default clock_timestamp(),
  last_seen_at timestamptz not null default clock_timestamp()
);
create index ranked_go_queue_mode_idx on public.ranked_go_queue(time_control,joined_at);
create table public.ranked_go_matches (
  game_id uuid primary key references public.go_ranked_games(id),
  black_id uuid not null references auth.users(id), white_id uuid not null references auth.users(id),
  time_control text not null references public.go_ranked_time_controls(id), result text not null,
  black_before integer not null, black_after integer not null,
  white_before integer not null, white_after integer not null, created_at timestamptz not null default now()
);
alter table public.go_ratings enable row level security;
alter table public.go_ranked_games enable row level security;
alter table public.ranked_go_queue enable row level security;
alter table public.ranked_go_matches enable row level security;
alter table public.go_ranked_time_controls enable row level security;
create policy "Go ratings are public to players" on public.go_ratings for select to authenticated using(true);
create policy "Go clock configuration" on public.go_ranked_time_controls for select to authenticated using(true);
create policy "Go participants read their games" on public.go_ranked_games for select to authenticated using(auth.uid() in (black_id,white_id));
create policy "Go participants read rating results" on public.ranked_go_matches for select to authenticated using(auth.uid() in (black_id,white_id));
grant select on public.go_ratings,public.go_ranked_games,public.ranked_go_matches to authenticated;
grant all on public.go_ratings,public.go_ranked_games,public.ranked_go_queue,public.ranked_go_matches,public.go_ranked_time_controls to service_role;

-- Same eligible population and deterministic tie-break as Chess, full pagination.
create function public.get_go_elo_leaderboard(p_time_control text default 'normal',p_limit integer default 50,p_offset integer default 0)
returns table(rank bigint,user_id uuid,username text,avatar_id text,rating integer,rated_games integer)
language sql stable security definer set search_path='' as $$
  select row_number() over(order by r.rating desc,r.rated_games desc,r.user_id),r.user_id,
    coalesce(p.display_name,p.username,'Player')::text,p.avatar_id::text,r.rating,r.rated_games
  from public.go_ratings r join public.profiles p on p.id=r.user_id
  where r.time_control=p_time_control and r.rated_games>0
  order by r.rating desc,r.rated_games desc,r.user_id limit greatest(1,least(p_limit,100)) offset greatest(0,p_offset);
$$;
-- Count predecessors with the same indexed ordering instead of fetching every user.
create function public.get_go_ranked_profile(p_user_id uuid)
returns table(time_control text,rating integer,rated_games integer,peak_rating integer,wins integer,losses integer,draws integer,leaderboard_rank bigint)
language sql stable security definer set search_path='' as $$
  select c.id,coalesce(r.rating,1200),coalesce(r.rated_games,0),coalesce(r.peak_rating,1200),
    coalesce(r.wins,0),coalesce(r.losses,0),coalesce(r.draws,0),
    case when r.rated_games>0 and exists(select 1 from public.profiles where id=p_user_id) then
      1+(select count(*) from public.go_ratings x join public.profiles p on p.id=x.user_id
        where x.time_control=c.id and x.rated_games>0 and
          (x.rating>r.rating or (x.rating=r.rating and x.rated_games>r.rated_games) or
          (x.rating=r.rating and x.rated_games=r.rated_games and x.user_id<r.user_id))) else null end
  from public.go_ranked_time_controls c left join public.go_ratings r on r.time_control=c.id and r.user_id=p_user_id;
$$;
revoke all on function public.get_go_elo_leaderboard(text,integer,integer),public.get_go_ranked_profile(uuid) from public,anon;
grant execute on function public.get_go_elo_leaderboard(text,integer,integer),public.get_go_ranked_profile(uuid) to authenticated;

create function public.apply_verified_ranked_go_result(p_game_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare g public.go_ranked_games%rowtype; b public.go_ratings%rowtype; w public.go_ratings%rowtype;
  bs numeric; bn integer; wn integer;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service only'; end if;
  select * into g from public.go_ranked_games where id=p_game_id for update;
  if g.status<>'finished' or g.winner is null then return; end if;
  if exists(select 1 from public.ranked_go_matches where game_id=g.id) then return; end if;
  insert into public.go_ratings(user_id,time_control) values(g.black_id,g.time_control),(g.white_id,g.time_control) on conflict do nothing;
  perform 1 from public.go_ratings where user_id in(g.black_id,g.white_id) and time_control=g.time_control order by user_id for update;
  select * into b from public.go_ratings where user_id=g.black_id and time_control=g.time_control;
  select * into w from public.go_ratings where user_id=g.white_id and time_control=g.time_control;
  bs:=case g.winner when 'black' then 1 when 'draw' then 0.5 else 0 end;
  bn:=greatest(100,round(b.rating+(case when b.rated_games<20 then 32 else 20 end)*(bs-1/(1+power(10,(w.rating-b.rating)::numeric/400)))))::integer;
  wn:=greatest(100,round(w.rating+(case when w.rated_games<20 then 32 else 20 end)*(1-bs-1/(1+power(10,(b.rating-w.rating)::numeric/400)))))::integer;
  insert into public.ranked_go_matches(game_id,black_id,white_id,time_control,result,black_before,black_after,white_before,white_after)
    values(g.id,g.black_id,g.white_id,g.time_control,g.winner,b.rating,bn,w.rating,wn);
  update public.go_ratings set rating=bn,peak_rating=greatest(peak_rating,bn),rated_games=rated_games+1,
    wins=wins+(bs=1)::int,losses=losses+(bs=0)::int,draws=draws+(bs=0.5)::int,updated_at=now()
    where user_id=g.black_id and time_control=g.time_control;
  update public.go_ratings set rating=wn,peak_rating=greatest(peak_rating,wn),rated_games=rated_games+1,
    wins=wins+(bs=0)::int,losses=losses+(bs=1)::int,draws=draws+(bs=0.5)::int,updated_at=now()
    where user_id=g.white_id and time_control=g.time_control;
  insert into public.user_game_results(game,source_id,user_id,outcome,multiplayer,details)
  select 'go',g.id::text,p.id,case when g.winner='draw' then 'draw' when g.winner=p.color then 'win' else 'loss' end,true,
    jsonb_build_object('ranked',true,'code',g.code,'time_control',g.time_control,'black_id',g.black_id,'white_id',g.white_id,
      'black_name',coalesce((select coalesce(display_name,username) from public.profiles where id=g.black_id),'Player'),
      'white_name',coalesce((select coalesce(display_name,username) from public.profiles where id=g.white_id),'Player'),
      'review_available',jsonb_array_length(g.state->'moveHistory')>0,
      'result',g.winner,'reason',g.end_reason,'board_size',g.state->'boardSize','komi',g.state->'komi',
      'rating_before',p.before,'rating_after',p.after)
  from (values(g.black_id,'black',b.rating,bn),(g.white_id,'white',w.rating,wn)) p(id,color,before,after)
  on conflict do nothing;
end; $$;

-- Pure Japanese byo-yomi projection. Each elapsed period is lost; a legal move
-- resets only the current period. Boundaries expire at zero, including the last.
-- Written locally from the timing rules, without third-party clock code.
create function public.go_ranked_clock(p_main_ms double precision,p_period_ms double precision,p_periods integer,p_byo_yomi_ms double precision,p_elapsed_ms double precision)
returns table(main_ms double precision,period_ms double precision,periods_remaining integer,expired boolean)
language sql immutable set search_path='' as $$
  with elapsed as (
    select greatest(0,p_elapsed_ms) as ms
  ), consumed as (
    select ms, greatest(0,ms-p_main_ms) as overtime,
      case when ms<p_main_ms or ms-p_main_ms<p_period_ms then 0
        else least(p_periods,1+floor((ms-p_main_ms-p_period_ms)/p_byo_yomi_ms))::integer end as lost
    from elapsed
  )
  select greatest(0,p_main_ms-ms),
    case when ms<p_main_ms then p_period_ms when lost>=p_periods then 0
      when lost=0 then p_period_ms-overtime else p_byo_yomi_ms-(overtime-p_period_ms-(lost-1)*p_byo_yomi_ms) end,
    p_periods-lost, ms>=p_main_ms and lost>=p_periods from consumed;
$$;
revoke all on function public.go_ranked_clock(double precision,double precision,integer,double precision,double precision) from public,anon,authenticated;
grant execute on function public.go_ranked_clock(double precision,double precision,integer,double precision,double precision) to service_role;

-- All clock/result changes and Elo settlement occur in one locked transaction.
create function public.go_ranked_action(p_game_id uuid,p_user uuid,p_op text default 'snapshot',p_version integer default null,p_state jsonb default null,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.go_ranked_games%rowtype; stamp timestamptz:=clock_timestamp(); side text; ticking record;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service only'; end if;
  select * into g from public.go_ranked_games where id=p_game_id for update;
  stamp:=clock_timestamp(); -- Sample after the lock, including time spent waiting.
  if not found or p_user is null or p_user not in(g.black_id,g.white_id) then raise exception 'Game not found'; end if;
  if p_op not in('snapshot','ready','move','resign','abandon') then raise exception 'Unknown game operation'; end if;
  if g.status='ready' then
    if stamp>g.created_at+interval '30 seconds' or p_op='abandon' then
      g.status:='abandoned'; g.end_reason:='abandoned before start'; g.completed_at:=stamp; g.version:=g.version+1;
    elsif p_op='ready' then
      if not p_user=any(g.ready_users) then g.ready_users:=array_append(g.ready_users,p_user); end if;
      if cardinality(g.ready_users)=2 then g.status:='playing';g.clock_started_at:=stamp;g.version:=g.version+1; end if;
    end if;
  elsif g.status='playing' then
    side:=g.state->>'currentPlayer';
    select * into ticking from public.go_ranked_clock(
      case side when 'black' then g.black_time_ms else g.white_time_ms end,
      case side when 'black' then g.black_period_ms else g.white_period_ms end,
      case side when 'black' then g.black_periods_remaining else g.white_periods_remaining end,
      g.byo_yomi_ms,extract(epoch from stamp-g.clock_started_at)*1000);
    if ticking.expired then
      g.status:='finished';g.winner:=case side when 'black' then 'white' else 'black' end;
      g.end_reason:='timeout';g.version:=g.version+1;
      if side='black' then g.black_time_ms:=0;g.black_period_ms:=0;g.black_periods_remaining:=0;
        else g.white_time_ms:=0;g.white_period_ms:=0;g.white_periods_remaining:=0; end if;
    elsif p_op in('move','resign') then
      if p_version is distinct from g.version then raise exception 'Stale position. Refresh the board.'; end if;
      if p_op='move' and p_user<>(case side when 'black' then g.black_id else g.white_id end) then raise exception 'Not your turn'; end if;
      if side='black' then
        g.black_time_ms:=ticking.main_ms;g.black_periods_remaining:=ticking.periods_remaining;
        g.black_period_ms:=case when p_op='move' then g.byo_yomi_ms else ticking.period_ms end;
      else
        g.white_time_ms:=ticking.main_ms;g.white_periods_remaining:=ticking.periods_remaining;
        g.white_period_ms:=case when p_op='move' then g.byo_yomi_ms else ticking.period_ms end;
      end if;
      if p_op='resign' then
        g.status:='finished';g.winner:=case p_user when g.black_id then 'white' else 'black' end;g.end_reason:='resignation';
      else
        if p_state is null or coalesce(p_state->>'status','') not in('playing','finished') or p_state->>'boardSize' is distinct from g.state->>'boardSize' or p_state->>'komi' is distinct from g.state->>'komi' then raise exception 'Invalid verified state'; end if;
        g.state:=p_state;
        if p_state->>'status'='finished' then
          if coalesce(p_state->>'winner','') not in('black','white','draw') then raise exception 'Invalid result'; end if;
          g.status:='finished';g.winner:=p_state->>'winner';g.end_reason:=p_reason;
        end if;
      end if;
      g.version:=g.version+1;g.clock_started_at:=stamp;
    end if;
  end if;
  if g.status='finished' then
    g.state:=g.state||jsonb_build_object('status','finished','winner',g.winner,'result',case when g.winner='draw' then 'Jigo / draw' when g.end_reason in('timeout','resignation') then g.winner||' wins by '||g.end_reason else coalesce(g.state->>'result',g.winner||' wins by score') end);
    g.clock_started_at:=null;g.completed_at:=coalesce(g.completed_at,stamp);
  end if;
  update public.go_ranked_games set state=g.state,status=g.status,winner=g.winner,end_reason=g.end_reason,version=g.version,
    ready_users=g.ready_users,black_time_ms=g.black_time_ms,white_time_ms=g.white_time_ms,
    black_period_ms=g.black_period_ms,white_period_ms=g.white_period_ms,
    black_periods_remaining=g.black_periods_remaining,white_periods_remaining=g.white_periods_remaining,
    clock_started_at=g.clock_started_at,completed_at=g.completed_at where id=g.id;
  if g.status='finished' then perform public.apply_verified_ranked_go_result(g.id); end if;
  return jsonb_build_object('game',to_jsonb(g),'serverNow',clock_timestamp(),'result',(select to_jsonb(r) from public.ranked_go_matches r where game_id=g.id));
end; $$;

create function public.go_ranked_queue_action(p_user uuid,p_session uuid,p_op text,p_name text default 'Player',p_time_control text default 'normal',p_initial_state jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare own public.ranked_go_queue%rowtype; candidate public.ranked_go_queue%rowtype; g public.go_ranked_games%rowtype;
  v_rating integer; control public.go_ranked_time_controls%rowtype; black uuid; white uuid; selected_mode text;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service only'; end if;
  if p_op not in('queue','queueStatus','leaveQueue') then raise exception 'Unknown queue operation'; end if;
  perform pg_advisory_xact_lock(hashtextextended('ranked-queue',0));
  if not exists(select 1 from public.go_ranked_time_controls where id=p_time_control) then raise exception 'Unknown time control'; end if;
  insert into public.ranked_chess_queue_sessions(id,user_id,active) values(p_session,p_user,p_op<>'leaveQueue') on conflict do nothing;
  if not exists(select 1 from public.ranked_chess_queue_sessions where id=p_session and user_id=p_user) then raise exception 'Invalid queue session'; end if;
  if p_op='leaveQueue' then
    update public.ranked_chess_queue_sessions set active=false,touched_at=clock_timestamp() where id=p_session;
    delete from public.ranked_go_queue where user_id=p_user and session_id=p_session;
    return jsonb_build_object('status','idle');
  end if;
  if not exists(select 1 from public.ranked_chess_queue_sessions where id=p_session and active) then return jsonb_build_object('status','idle'); end if;
  update public.ranked_chess_queue_sessions set touched_at=clock_timestamp() where id=p_session;
  -- Recover live matches even when the handoff request was lost.
  select * into g from public.go_ranked_games where p_user in(black_id,white_id) and status in('ready','playing') order by created_at limit 1;
  if found then
    perform public.go_ranked_action(g.id,p_user,'snapshot');
    if exists(select 1 from public.go_ranked_games where id=g.id and status in('ready','playing')) then
      return jsonb_build_object('status','matched','code',g.code,'timeControl',g.time_control);
    end if;
  end if;
  delete from public.ranked_go_queue where last_seen_at<clock_timestamp()-interval '12 seconds';
  if exists(select 1 from public.ranked_chess_queue where user_id=p_user and claimed_by is null and last_seen_at>=clock_timestamp()-interval '12 seconds') or
    exists(select 1 from public.chess_rooms r join public.chess_room_players p on p.room_id=r.id join public.chess_games c on c.room_id=r.id where p.user_id=p_user and r.match_kind='ranked' and c.status='playing') then
    if p_op='queueStatus' then return jsonb_build_object('status','idle'); end if;
    raise exception 'Leave your Chess ranked queue or finish its match first';
  end if;
  select * into own from public.ranked_go_queue where user_id=p_user;
  if own.user_id is null and p_op='queueStatus' then return jsonb_build_object('status','idle'); end if;
  if own.session_id is distinct from p_session and own.user_id is not null then
    if p_op='queueStatus' then return jsonb_build_object('status','idle'); end if;
    update public.ranked_chess_queue_sessions set active=false where id=own.session_id;
  end if;
  selected_mode:=case when p_op='queueStatus' then own.time_control else p_time_control end;
  select * into control from public.go_ranked_time_controls where id=selected_mode;
  select coalesce((select rating from public.go_ratings where user_id=p_user and time_control=selected_mode),1200) into v_rating;
  select q.* into candidate from public.ranked_go_queue q join public.ranked_chess_queue_sessions s on s.id=q.session_id and s.active
    where q.user_id<>p_user and q.time_control=selected_mode and q.last_seen_at>=clock_timestamp()-interval '12 seconds'
    and abs(q.rating-v_rating)<=250+floor(extract(epoch from clock_timestamp()-q.joined_at)/60)*100 order by q.joined_at,q.user_id limit 1;
  if candidate.user_id is not null then
    if p_initial_state is null or p_initial_state->>'boardSize' is distinct from control.board_size::text or p_initial_state->>'komi' is distinct from control.komi::text then raise exception 'Invalid initial state'; end if;
    black:=case when random()<0.5 then p_user else candidate.user_id end;
    white:=case when black=p_user then candidate.user_id else p_user end;
    insert into public.go_ranked_games(code,black_id,white_id,time_control,state,black_time_ms,white_time_ms,byo_yomi_ms,black_period_ms,white_period_ms,black_periods_remaining,white_periods_remaining)
      values(upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),black,white,selected_mode,p_initial_state,control.initial_ms,control.initial_ms,
        control.byo_yomi_ms,control.byo_yomi_ms,control.byo_yomi_ms,control.byo_yomi_periods,control.byo_yomi_periods) returning * into g;
    delete from public.ranked_go_queue where user_id in(p_user,candidate.user_id);
    return jsonb_build_object('status','matched','code',g.code,'timeControl',selected_mode);
  end if;
  insert into public.ranked_go_queue(user_id,session_id,time_control,rating) values(p_user,p_session,selected_mode,v_rating)
    on conflict(user_id) do update set session_id=excluded.session_id,time_control=excluded.time_control,rating=excluded.rating,last_seen_at=clock_timestamp(),
      joined_at=case when ranked_go_queue.time_control<>excluded.time_control then clock_timestamp() else ranked_go_queue.joined_at end;
  return jsonb_build_object('status','waiting','timeControl',selected_mode);
end; $$;

-- Keep Chess's implementation intact; add the cross-game exclusion under its mutex.
alter function public.ranked_queue_action(uuid,uuid,text,text,text) rename to ranked_chess_queue_action;
create function public.ranked_queue_action(p_user uuid,p_session uuid,p_op text,p_name text default 'Player',p_time_control text default 'rapid')
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service only'; end if;
  perform pg_advisory_xact_lock(hashtextextended('ranked-queue',0));
  if p_op<>'leaveQueue' and (exists(select 1 from public.ranked_go_queue where user_id=p_user and last_seen_at>=clock_timestamp()-interval '12 seconds') or
    exists(select 1 from public.go_ranked_games where p_user in(black_id,white_id) and status in('ready','playing'))) then
    if p_op='queueStatus' then return jsonb_build_object('status','idle'); end if;
    raise exception 'Leave your Go ranked queue or finish its match first';
  end if;
  return public.ranked_chess_queue_action(p_user,p_session,p_op,p_name,p_time_control);
end; $$;
-- The renamed implementation is private to the wrapper.
revoke execute on function public.ranked_chess_queue_action(uuid,uuid,text,text,text) from service_role;

create function public.maintain_ranked_go() returns void language plpgsql security definer set search_path='' as $$
declare g record; previous_role text;
begin
  previous_role:=current_setting('request.jwt.claim.role',true);
  perform set_config('request.jwt.claim.role','service_role',true);
  delete from public.ranked_go_queue where last_seen_at<clock_timestamp()-interval '12 seconds';
  for g in select id,black_id from public.go_ranked_games where status in('ready','playing') loop
    perform public.go_ranked_action(g.id,g.black_id,'snapshot');
  end loop;
  perform set_config('request.jwt.claim.role',coalesce(previous_role,''),true);
end; $$;
revoke all on function public.apply_verified_ranked_go_result(uuid),public.go_ranked_action(uuid,uuid,text,integer,jsonb,text),
  public.go_ranked_queue_action(uuid,uuid,text,text,text,jsonb),public.ranked_queue_action(uuid,uuid,text,text,text),public.maintain_ranked_go() from public,anon,authenticated;
grant execute on function public.apply_verified_ranked_go_result(uuid),public.go_ranked_action(uuid,uuid,text,integer,jsonb,text),
  public.go_ranked_queue_action(uuid,uuid,text,text,text,jsonb),public.ranked_queue_action(uuid,uuid,text,text,text),public.maintain_ranked_go() to service_role;
-- pg_cron is already installed by the Chess lifecycle migration.
select cron.schedule('ranked-go-maintenance','10 seconds',$cron$select public.maintain_ranked_go()$cron$);
