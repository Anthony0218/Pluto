-- Ranked data is isolated from legacy profiles.rating. No client can mark a
-- room ranked or submit a rating change. The verified game service must opt in.
alter table public.chess_rooms add column match_kind text not null default 'casual'
  check (match_kind in ('casual', 'ranked'));
-- Version is a concurrency counter and may restart on rematch. Keep a separate
-- round number so each completed game in the same room has a stable rating key.
alter table public.chess_games add column ranked_round integer not null default 1
  check (ranked_round >= 1);
create table public.chess_ratings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rating integer not null default 1200 check (rating >= 100),
  peak_rating integer not null default 1200 check (peak_rating >= rating),
  rated_games integer not null default 0 check (rated_games >= 0),
  updated_at timestamptz not null default now()
);
create index chess_ratings_leaderboard_idx on public.chess_ratings(rating desc, rated_games desc, user_id);
create table public.ranked_chess_matches (
  source_id text primary key,
  room_id uuid not null references public.chess_rooms(id) on delete cascade,
  white_id uuid not null references auth.users(id) on delete cascade,
  black_id uuid not null references auth.users(id) on delete cascade,
  result text not null check (result in ('white', 'black', 'draw')),
  white_before integer not null,
  white_after integer not null,
  black_before integer not null,
  black_after integer not null,
  completed_at timestamptz not null default now(),
  check (white_id <> black_id)
);
create index ranked_chess_matches_white_idx on public.ranked_chess_matches(white_id, completed_at desc);
create index ranked_chess_matches_black_idx on public.ranked_chess_matches(black_id, completed_at desc);
alter table public.chess_ratings enable row level security;
alter table public.ranked_chess_matches enable row level security;
create policy "Read chess ratings" on public.chess_ratings for select to authenticated using (true);
create policy "Read own ranked matches" on public.ranked_chess_matches for select to authenticated
  using (white_id = auth.uid() or black_id = auth.uid());
grant select on public.chess_ratings, public.ranked_chess_matches to authenticated;
revoke insert, update, delete on public.chess_ratings, public.ranked_chess_matches from anon, authenticated;

-- Call only from a service that has independently validated the entire match.
-- The routine itself reads the stored result; it accepts no winner or delta.
create function public.apply_verified_ranked_chess_result(p_room_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare g public.chess_games%rowtype; w uuid; b uuid; wr public.chess_ratings%rowtype;
  br public.chess_ratings%rowtype; w_score numeric; b_score numeric;
  w_next integer; b_next integer; v_source text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_room_id::text, 0));
  if not exists (select 1 from public.chess_rooms where id = p_room_id and match_kind = 'ranked') then
    raise exception 'Not a ranked room';
  end if;
  select * into g from public.chess_games where room_id = p_room_id for update;
  if not found or g.status <> 'finished' or g.winner not in ('white','black','draw') then
    raise exception 'Ranked game is not eligible';
  end if;
  select user_id into w from public.chess_room_players where room_id = p_room_id and chosen_color = 'white';
  select user_id into b from public.chess_room_players where room_id = p_room_id and chosen_color = 'black';
  if w is null or b is null or w = b then raise exception 'Ranked game needs two players'; end if;
  v_source := p_room_id::text || ':' || g.ranked_round::text;
  if exists (select 1 from public.ranked_chess_matches where source_id = v_source) then return; end if;
  insert into public.chess_ratings(user_id) values (w), (b) on conflict do nothing;
  perform 1 from public.chess_ratings where user_id in (w,b) order by user_id for update;
  select * into wr from public.chess_ratings where user_id = w;
  select * into br from public.chess_ratings where user_id = b;
  w_score := case g.winner when 'white' then 1 when 'draw' then 0.5 else 0 end;
  b_score := 1 - w_score;
  w_next := greatest(100, round(wr.rating + (case when wr.rated_games < 20 then 32 else 20 end) *
    (w_score - 1 / (1 + power(10, (br.rating - wr.rating)::numeric / 400)))))::integer;
  b_next := greatest(100, round(br.rating + (case when br.rated_games < 20 then 32 else 20 end) *
    (b_score - 1 / (1 + power(10, (wr.rating - br.rating)::numeric / 400)))))::integer;
  insert into public.ranked_chess_matches(source_id, room_id, white_id, black_id, result,
    white_before, white_after, black_before, black_after)
    values (v_source, p_room_id, w, b, g.winner, wr.rating, w_next, br.rating, b_next);
  update public.chess_ratings set rating = w_next, peak_rating = greatest(peak_rating, w_next),
    rated_games = rated_games + 1, updated_at = now() where user_id = w;
  update public.chess_ratings set rating = b_next, peak_rating = greatest(peak_rating, b_next),
    rated_games = rated_games + 1, updated_at = now() where user_id = b;
end; $$;
revoke all on function public.apply_verified_ranked_chess_result(uuid) from public, anon, authenticated;
grant execute on function public.apply_verified_ranked_chess_result(uuid) to service_role;

create function public.get_chess_elo_leaderboard() returns table
  (rank bigint, user_id uuid, username text, avatar_id text, rating integer, rated_games integer)
language sql stable security invoker set search_path = '' as $$
  select row_number() over (order by r.rating desc, r.rated_games desc, r.user_id)::bigint,
    r.user_id, coalesce(p.display_name, p.username, 'Player')::text,
    p.avatar_id::text, r.rating, r.rated_games
  from public.chess_ratings r join public.profiles p on p.id = r.user_id
  where r.rated_games > 0
  order by r.rating desc, r.rated_games desc, r.user_id limit 10;
$$;
revoke all on function public.get_chess_elo_leaderboard() from public, anon;
grant execute on function public.get_chess_elo_leaderboard() to authenticated;
