-- Pixel avatars grow from 16×16 to 32×32, and public profiles report the activity level
-- that decides the avatar border (bronze from level 10, silver from 20, gold from 30).

-- ---------------------------------------------------------------------------
-- New drawings are 'px2:' followed by 1,024 hex palette indices (32×32). Drawings saved
-- before this stay valid as 'px1:' + 256 digits. Postgres caps one repetition count at
-- 255, hence the nested groups.
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_avatar_id_format;
alter table public.profiles add constraint profiles_avatar_id_format check (
  avatar_id is null
  or avatar_id ~ '^[A-Za-z0-9_-]{1,40}$'
  or avatar_id ~ '^px1:([0-9a-f]{16}){16}$'
  or avatar_id ~ '^px2:([0-9a-f]{32}){32}$'
) not valid;

alter table public.profile_custom_avatars drop constraint if exists profile_custom_avatars_avatar_id_check;
alter table public.profile_custom_avatars add constraint profile_custom_avatars_avatar_id_check check (
  avatar_id ~ '^px1:([0-9a-f]{16}){16}$' or avatar_id ~ '^px2:([0-9a-f]{32}){32}$'
);

-- ---------------------------------------------------------------------------
-- The level is the one a player sees on their own profile: 100 XP per completed game,
-- 50 XP per completed puzzle, 1,000 XP per level. Only the level is public, not the counts.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_profile(p_user_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id,
    'username', p.username,
    'display_name', p.display_name,
    'avatar_id', p.avatar_id,
    'level', 1 + (
      (select count(*) from public.user_game_results r where r.user_id = p.id) * 100
      + (select count(*) from public.chess_puzzle_completions pc
         join public.chess_puzzles z on z.id = pc.puzzle_id where pc.user_id = p.id) * 50
    ) / 1000,
    'most_played', coalesce((
      select jsonb_agg(t.game order by t.games desc, t.game)
      from (
        select r.game, count(*) as games from public.user_game_results r
        where r.user_id = p.id group by r.game order by count(*) desc, r.game limit 3
      ) t), '[]'::jsonb),
    'chess_rating', (
      select jsonb_build_object('rating', c.rating, 'time_control', c.time_control)
      from public.chess_ratings c
      where c.user_id = p.id and c.rated_games > 0
      order by c.rating desc limit 1)
  )
  from public.profiles p where p.id = p_user_id;
$$;
