-- Extend the existing dashboard_challenges catalog. Disabled entries document
-- future event contracts; only quests backed by persisted results are assigned.
alter table public.dashboard_challenges
  add column game text,
  add column difficulty text,
  add column player_mode text check (player_mode in ('singleplayer', 'multiplayer')),
  add column progress_type text not null default 'visit',
  add column slot text check (slot in ('general', 'chess', 'discovery'));

insert into public.dashboard_challenges
  (id, title, description, category, target, route, cta, game, difficulty, player_mode, progress_type, slot, active) values
('quest-01','Play a game','Finish a game today.','play',1,'/games','Choose a game',null,null,null,'game_completed','general',true),
('quest-02','Two games today','Complete two games today.','play',2,'/games','Choose a game',null,null,null,'game_completed','general',true),
('quest-03','Triple play','Complete three games today.','play',3,'/games','Choose a game',null,null,null,'game_completed','general',true),
('quest-04','Mix it up','Complete two different games today.','play',2,'/games','Explore games',null,null,null,'distinct_games','general',true),
('quest-05','Variety day','Complete three different games today.','play',3,'/games','Explore games',null,null,null,'distinct_games','general',true),
('quest-06','Welcome back','Try a game you have not played recently.','play',1,'/games','Explore games',null,null,null,'recent_game','general',false),
('quest-07','Play together','Complete a multiplayer game.','play',1,'/games','Find a game',null,null,'multiplayer','game_completed','general',true),
('quest-08','Double match','Complete two multiplayer games.','play',2,'/games','Find a game',null,null,'multiplayer','game_completed','general',true),
('quest-09','Solo session','Complete a singleplayer game.','play',1,'/games','Choose a game',null,null,'singleplayer','game_completed','general',false),
('quest-10','Play with a friend','Finish a game joined through a friend code.','social',1,'/friends','Invite a friend',null,null,'multiplayer','friend_game','general',false),
('quest-11','Visit Chess','Drop by the Chess section today.','explore',1,'/games/chess','Visit Chess','chess',null,null,'visit','discovery',true),
('quest-12','Discover Natura','Explore the Natura game page.','explore',1,'/games/natura','Discover Natura','natura',null,null,'visit','discovery',true),
('quest-13','Discover Atlas Arena','Explore Atlas Arena today.','explore',1,'/games/atlas-arena','Discover Atlas','atlas',null,null,'visit','discovery',true),
('quest-14','Discover Medieval Kingdoms','Visit the Medieval Kingdoms page.','explore',1,'/games/medieval-kingdoms','Discover Kingdoms','medieval',null,null,'visit','discovery',true),
('quest-15','Discover Schafkopfen','Explore the Schafkopfen page.','explore',1,'/games/schafkopf','Discover Schafkopfen','schafkopf',null,null,'visit','discovery',true),
('quest-16','Discover Watten','Explore the Watten page.','explore',1,'/games/watten','Discover Watten','watten',null,null,'visit','discovery',true),
('quest-17','A new mode','Play a mode you have not tried today.','play',1,'/games','Explore modes',null,null,null,'mode_played','general',false),
('quest-18','Finish what you start','Complete a game from start to finish.','play',1,'/games/chess/classic/multiplayer','Play Chess',null,null,'multiplayer','game_completed','general',true),
('quest-19','See you tomorrow','Continue your daily streak tomorrow.','play',1,'/dashboard','Your dashboard',null,null,null,'streak','general',false),
('quest-20','Both worlds','Complete a solo and multiplayer game today.','play',2,'/games','Choose a game',null,null,null,'mixed_modes','general',false),
('quest-21','Chess today','Complete a classic Chess match.','play',1,'/games/chess/classic/multiplayer','Play Chess','chess',null,'multiplayer','game_completed','chess',true),
('quest-22','Chess double','Complete two classic Chess matches.','play',2,'/games/chess/classic/multiplayer','Play Chess','chess',null,'multiplayer','game_completed','chess',true),
('quest-23','Chess victory','Win a classic Chess match.','win',1,'/games/chess/classic/multiplayer','Play Chess','chess',null,'multiplayer','game_won','chess',true),
('quest-24','Online Chess victory','Win a multiplayer Chess match.','win',1,'/games/chess/classic/multiplayer','Play Chess','chess',null,'multiplayer','game_won','chess',true),
('quest-25','Ranked debut','Play a ranked Chess match.','play',1,'/games/chess','Play Chess','chess',null,'multiplayer','ranked_completed','chess',false),
('quest-26','Ranked double','Complete two ranked Chess matches.','play',2,'/games/chess','Play Chess','chess',null,'multiplayer','ranked_completed','chess',false),
('quest-27','Ranked victory','Win a ranked Chess match.','win',1,'/games/chess','Play Chess','chess',null,'multiplayer','ranked_won','chess',false),
('quest-28','Friendly Chess','Play a Chess match with a friend.','social',1,'/friends','Invite a friend','chess',null,'multiplayer','friend_game','chess',false),
('quest-29','Give check','Deliver check in Chess.','play',1,'/games/chess','Play Chess','chess',null,null,'check','chess',false),
('quest-30','Checkmate!','Deliver checkmate in Chess.','win',1,'/games/chess','Play Chess','chess',null,null,'checkmate','chess',false),
('quest-31','Castle the king','Castle during a Chess match.','play',1,'/games/chess','Play Chess','chess',null,null,'castle','chess',false),
('quest-32','Capture five','Capture five pieces in a single Chess match.','play',5,'/games/chess','Play Chess','chess',null,null,'capture_in_match','chess',false),
('quest-33','Promotion day','Promote a pawn in Chess.','play',1,'/games/chess','Play Chess','chess',null,null,'promotion','chess',false),
('quest-34','Play it through','Complete a Chess match without resigning.','play',1,'/games/chess','Play Chess','chess',null,null,'non_resigned','chess',false),
('quest-35','Variant voyage','Complete one Chess variant.','variant',1,'/games/chess/variants','Explore variants','chess',null,null,'variant_completed','chess',false),
('quest-36','Variant sampler','Complete two different Chess variants.','variant',2,'/games/chess/variants','Explore variants','chess',null,null,'distinct_variants','chess',false),
('quest-37','Tectonic turn','Play Tectonic Chess.','variant',1,'/games/chess/variants','Play variant','chess',null,null,'tectonic','chess',false),
('quest-38','Spin the board','Play Chess Roulette.','variant',1,'/games/chess/variants','Play variant','chess',null,null,'roulette','chess',false),
('quest-39','Hot Potato','Play Hot Potato Chess.','variant',1,'/games/chess/variants','Play variant','chess',null,null,'hot_potato','chess',false),
('quest-40','Hold your ground','Play Chess Collapse.','variant',1,'/games/chess/variants','Play variant','chess',null,null,'collapse','chess',false),
('quest-41','Mutate!','Play Mutation Chess.','variant',1,'/games/chess/variants','Play variant','chess',null,null,'mutation','chess',false),
('quest-42','Market moves','Play Chess Market.','variant',1,'/games/chess/variants','Play variant','chess',null,null,'market','chess',false),
('quest-43','First puzzle','Solve a Chess puzzle.','puzzle',1,'/games/chess/puzzles','Solve puzzles','chess',null,'singleplayer','puzzle_completed','chess',true),
('quest-44','Puzzle trio','Solve three Chess puzzles.','puzzle',3,'/games/chess/puzzles','Solve puzzles','chess',null,'singleplayer','puzzle_completed','chess',true),
('quest-45','Puzzle five','Solve five Chess puzzles.','puzzle',5,'/games/chess/puzzles','Solve puzzles','chess',null,'singleplayer','puzzle_completed','chess',true),
('quest-46','Beginner practice','Solve three Beginner puzzles.','puzzle',3,'/games/chess/puzzles','Solve puzzles','chess','Beginner','singleplayer','puzzle_completed','chess',true),
('quest-47','Intermediate practice','Solve three Intermediate puzzles.','puzzle',3,'/games/chess/puzzles','Solve puzzles','chess','Intermediate','singleplayer','puzzle_completed','chess',true),
('quest-48','Advanced practice','Solve two Advanced puzzles.','puzzle',2,'/games/chess/puzzles','Solve puzzles','chess','Advanced','singleplayer','puzzle_completed','chess',true),
('quest-49','Really Hard solve','Solve a Really Hard puzzle.','puzzle',1,'/games/chess/puzzles','Solve puzzles','chess','Really Hard','singleplayer','puzzle_completed','chess',true),
('quest-50','Clean solutions','Solve three puzzles without a mistake.','puzzle',3,'/games/chess/puzzles','Solve puzzles','chess',null,'singleplayer','puzzle_perfect','chess',true),
('quest-51','Advanced precision','Solve an Advanced or Really Hard puzzle cleanly.','puzzle',1,'/games/chess/puzzles','Solve puzzles','chess','Advanced+','singleplayer','puzzle_perfect','chess',true),
('quest-52','Really Hard precision','Solve a Really Hard puzzle with zero mistakes.','puzzle',1,'/games/chess/puzzles','Solve puzzles','chess','Really Hard','singleplayer','puzzle_perfect','chess',true),
('quest-53','Puzzle explorer','Solve puzzles from two categories.','puzzle',2,'/games/chess/puzzles','Solve puzzles','chess',null,'singleplayer','puzzle_categories','chess',true),
('quest-54','Schafkopfen table','Finish a Schafkopfen round.','play',1,'/games/schafkopf','Play Schafkopfen','schafkopf',null,null,'game_completed','discovery',true),
('quest-55','Watten match','Finish a Watten match.','play',1,'/games/watten','Play Watten','watten',null,'multiplayer','game_completed','discovery',true),
('quest-56','Card game victory','Win online at Schafkopfen or Watten.','win',1,'/games','Choose a card game',null,null,'multiplayer','card_win','discovery',true),
('quest-57','Natura day','Complete a Natura game.','play',1,'/games/natura','Play Natura','natura',null,null,'game_completed','discovery',false),
('quest-58','Atlas expedition','Complete an Atlas Arena game.','play',1,'/games/atlas-arena','Play Atlas','atlas',null,null,'game_completed','discovery',false),
('quest-59','Kingdom campaign','Complete a Medieval Kingdoms game.','play',1,'/games/medieval-kingdoms','Play Kingdoms','medieval',null,null,'game_completed','discovery',false),
('quest-60','Beyond Chess','Win a multiplayer match outside Chess.','win',1,'/games','Choose a game',null,null,'multiplayer','non_chess_win','discovery',true);

create function public.get_daily_quests() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_today date := (now() at time zone 'UTC')::date; v_start timestamptz; v_end timestamptz; result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  v_start := v_today::timestamp at time zone 'UTC';
  v_end := (v_today + 1)::timestamp at time zone 'UTC';
  with chosen as (
    select distinct on (slot) c.* from public.dashboard_challenges c
    where c.active and c.id like 'quest-%' and c.slot is not null
    order by slot, md5(v_today::text || auth.uid()::text || c.id)
  ), scored as (
    select c.*,
      case
        when progress_type = 'visit' then (select count(*) from public.dashboard_game_visits v
          where v.user_id = auth.uid() and v.visited_on = v_today and v.game_route = c.route)
        when progress_type = 'distinct_games' then
          (select count(distinct r.game) from public.user_game_results r where r.user_id = auth.uid()
            and r.completed_at >= v_start and r.completed_at < v_end)
        when progress_type = 'puzzle_categories' then
          (select count(distinct p.category) from public.chess_puzzle_completions pc
            join public.chess_puzzles p on p.id = pc.puzzle_id
            where pc.user_id = auth.uid() and pc.completed_at >= v_start and pc.completed_at < v_end)
        when progress_type in ('puzzle_completed', 'puzzle_perfect') then
          (select count(*) from public.chess_puzzle_completions pc
            join public.chess_puzzles p on p.id = pc.puzzle_id
            where pc.user_id = auth.uid() and pc.completed_at >= v_start and pc.completed_at < v_end
              and (c.difficulty is null or p.difficulty = c.difficulty
                or (c.difficulty = 'Advanced+' and p.difficulty in ('Advanced', 'Really Hard')))
              and (c.progress_type <> 'puzzle_perfect' or pc.mistakes = 0))
        when progress_type in ('game_completed', 'game_won', 'card_win', 'non_chess_win') then
          (select count(*) from public.user_game_results r where r.user_id = auth.uid()
            and r.completed_at >= v_start and r.completed_at < v_end
            and (c.game is null or r.game = c.game)
            and (c.player_mode is null or (c.player_mode = 'multiplayer' and r.multiplayer))
            and (c.progress_type not in ('game_won','card_win','non_chess_win') or r.outcome = 'win')
            and (c.progress_type <> 'card_win' or r.game in ('schafkopf','watten'))
            and (c.progress_type <> 'non_chess_win' or r.game <> 'chess'))
        else null
      end progress
    from chosen c
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'category', category, 'title', title,
    'description', description, 'target', target, 'progress', progress,
    'route', route, 'cta', cta, 'expires_at', v_end, 'difficulty', difficulty,
    'progress_type', progress_type) order by case slot when 'general' then 1 when 'chess' then 2 else 3 end), '[]'::jsonb)
    into result from scored;
  return result;
end; $$;
revoke all on function public.get_daily_quests() from public, anon;
grant execute on function public.get_daily_quests() to authenticated;
