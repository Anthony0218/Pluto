-- Local classic chess earns activity XP without changing verified match statistics.
-- A saved game's session survives reloads; repeated completion/undo cannot add XP twice.
create table public.local_chess_xp (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  mode text not null check (mode in ('singleplayer', 'hotseat')),
  coach_used boolean not null default false,
  xp integer generated always as (case when coach_used then 50 else 100 end) stored,
  completed_at timestamptz not null default now(),
  primary key (user_id, session_id)
);
alter table public.local_chess_xp enable row level security;
create policy "Read own local chess XP" on public.local_chess_xp for select to authenticated using (user_id = auth.uid());
grant select on public.local_chess_xp to authenticated;
revoke insert, update, delete on public.local_chess_xp from anon, authenticated;

alter table public.games add column xp_session_id uuid;
alter table public.games add column coach_used boolean not null default false;

create function public.claim_local_chess_xp(p_session_id uuid, p_mode text, p_coach_used boolean) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_xp integer;
begin
  if v_user is null then raise exception 'Sign in to earn XP'; end if;
  if p_session_id is null or p_mode is null or p_mode not in ('singleplayer', 'hotseat') or p_coach_used is null then
    raise exception 'Invalid chess XP session';
  end if;
  insert into public.local_chess_xp(user_id, session_id, mode, coach_used)
    values (v_user, p_session_id, p_mode, p_coach_used)
    on conflict (user_id, session_id) do update
      set coach_used = public.local_chess_xp.coach_used or excluded.coach_used
    returning xp into v_xp;
  return v_xp;
end; $$;
revoke all on function public.claim_local_chess_xp(uuid, text, boolean) from public, anon;
grant execute on function public.claim_local_chess_xp(uuid, text, boolean) to authenticated;

create or replace function public.get_my_game_stats() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'general', jsonb_build_object('games_played', count(*), 'wins', count(*) filter (where outcome = 'win'),
      'local_chess_xp', (select coalesce(sum(xp), 0) from public.local_chess_xp where user_id = auth.uid())),
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

create or replace function public.get_public_profile(p_user_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_id', p.avatar_id,
    'level', 1 + (
      (select count(*) from public.user_game_results r where r.user_id = p.id) * 100
      + (select count(*) from public.chess_puzzle_completions pc
         join public.chess_puzzles z on z.id = pc.puzzle_id where pc.user_id = p.id) * 50
      + (select coalesce(sum(xp), 0) from public.local_chess_xp where user_id = p.id)
    ) / 1000,
    'most_played', coalesce((
      select jsonb_agg(t.game order by t.games desc, t.game) from (
        select r.game, count(*) as games from public.user_game_results r
        where r.user_id = p.id group by r.game order by count(*) desc, r.game limit 3
      ) t), '[]'::jsonb),
    'chess_rating', (
      select jsonb_build_object('rating', c.rating, 'time_control', c.time_control)
      from public.chess_ratings c where c.user_id = p.id and c.rated_games > 0
      order by c.rating desc limit 1)
  ) from public.profiles p where p.id = p_user_id;
$$;
