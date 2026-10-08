-- The dashboard's Activity card. It only counts what the app already records for the signed-in account:
--   game    a completed game (user_game_results)
--   puzzle  a solved chess puzzle (chess_puzzle_completions)
--   explore a game opened (dashboard_game_visits: the day's last visit) or a lesson/variant page opened (dashboard_resource_visits)
-- Nothing is invented: time spent is not recorded, so the card counts events. Days are the caller's local days (p_tz);
-- resource visits only store a UTC date, so they keep that date and have no time of day.

create function public.get_activity_days(p_from date, p_to date, p_tz text default 'UTC')
returns table(day date, kind text, label text, n integer)
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_tz text := case when exists (select 1 from pg_catalog.pg_timezone_names z where z.name = p_tz) then p_tz else 'UTC' end;
  v_from timestamptz;
  v_to timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then raise exception 'Invalid range'; end if;
  v_from := p_from::timestamp at time zone v_tz;
  v_to := (p_to + 1)::timestamp at time zone v_tz;
  return query
    select (r.completed_at at time zone v_tz)::date, 'game'::text, r.game::text, count(*)::integer
      from public.user_game_results r
      where r.user_id = auth.uid() and r.completed_at >= v_from and r.completed_at < v_to
      group by 1, 3
    union all
    select (c.completed_at at time zone v_tz)::date, 'puzzle'::text, 'chess'::text, count(*)::integer
      from public.chess_puzzle_completions c
      where c.user_id = auth.uid() and c.completed_at >= v_from and c.completed_at < v_to
      group by 1
    union all
    select (v.last_visited_at at time zone v_tz)::date, 'explore'::text, v.game_route::text, count(*)::integer
      from public.dashboard_game_visits v
      where v.user_id = auth.uid() and v.last_visited_at >= v_from and v.last_visited_at < v_to
      group by 1, 3
    union all
    select x.visited_on, 'explore'::text, x.route::text, count(*)::integer
      from public.dashboard_resource_visits x
      where x.user_id = auth.uid() and x.visited_on between p_from and p_to
      group by 1, 3;
end;
$$;

-- One local day, event by event. `at` is null for events whose time of day is not recorded.
-- `detail` is the outcome for a game (win, loss, draw) and the mistake count for a puzzle.
create function public.get_activity_day(p_day date, p_tz text default 'UTC')
returns table(at timestamptz, kind text, label text, detail text)
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_tz text := case when exists (select 1 from pg_catalog.pg_timezone_names z where z.name = p_tz) then p_tz else 'UTC' end;
  v_from timestamptz;
  v_to timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_day is null then raise exception 'Invalid day'; end if;
  v_from := p_day::timestamp at time zone v_tz;
  v_to := (p_day + 1)::timestamp at time zone v_tz;
  return query
    select e.at, e.kind, e.label, e.detail from (
      select r.completed_at as at, 'game'::text as kind, r.game::text as label, r.outcome::text as detail
        from public.user_game_results r
        where r.user_id = auth.uid() and r.completed_at >= v_from and r.completed_at < v_to
      union all
      select c.completed_at, 'puzzle'::text, 'chess'::text, c.mistakes::text
        from public.chess_puzzle_completions c
        where c.user_id = auth.uid() and c.completed_at >= v_from and c.completed_at < v_to
      union all
      select v.last_visited_at, 'explore'::text, v.game_route::text, null::text
        from public.dashboard_game_visits v
        where v.user_id = auth.uid() and v.last_visited_at >= v_from and v.last_visited_at < v_to
      union all
      select null::timestamptz, 'explore'::text, x.route::text, null::text
        from public.dashboard_resource_visits x
        where x.user_id = auth.uid() and x.visited_on = p_day
    ) e
    order by e.at nulls last, e.kind, e.label
    limit 300;
end;
$$;

revoke all on function public.get_activity_days(date, date, text), public.get_activity_day(date, text) from public, anon;
grant execute on function public.get_activity_days(date, date, text), public.get_activity_day(date, text) to authenticated;
