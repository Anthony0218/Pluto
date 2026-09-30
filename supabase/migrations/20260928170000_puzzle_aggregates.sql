-- Query saved completion records directly; the client list RPC can be capped.
create index if not exists chess_puzzle_completions_user_date_idx
  on public.chess_puzzle_completions(user_id, completed_at desc);
create index if not exists chess_puzzles_difficulty_id_idx
  on public.chess_puzzles(difficulty, id);

create function public.get_my_chess_puzzle_stats() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'completed', count(*),
    'perfect_really_hard', count(*) filter (where p.difficulty = 'Really Hard' and pc.mistakes = 0)
  )
  from public.chess_puzzle_completions pc
  join public.chess_puzzles p on p.id = pc.puzzle_id
  where pc.user_id = auth.uid();
$$;
revoke all on function public.get_my_chess_puzzle_stats() from public, anon;
grant execute on function public.get_my_chess_puzzle_stats() to authenticated;
