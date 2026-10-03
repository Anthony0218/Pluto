-- Atlas Ranked uses the existing authoritative match table. Ratings and bans live in a
-- game-specific extension of the auth user, following chess_ratings, never in local storage.
alter table public.atlas_matches add column match_kind text not null default 'casual'
  check (match_kind in ('casual', 'ranked'));
alter table public.atlas_matches drop constraint atlas_matches_status_check;
alter table public.atlas_matches add constraint atlas_matches_status_check
  check (status in ('waiting', 'draft', 'ready', 'intermission', 'countdown', 'round_active', 'round_resolving', 'next_round', 'finished', 'cancelled'));

create table public.atlas_ranked_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rating double precision not null default 1500 check (rating between 100 and 10000),
  deviation double precision not null default 350 check (deviation > 0 and deviation < 1000),
  volatility double precision not null default 0.06 check (volatility > 0 and volatility < 2),
  matches_played integer not null default 0 check (matches_played >= 0),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  mode_bans text[] not null default '{}',
  last_opponent uuid,
  updated_at timestamptz not null default now(),
  check (cardinality(mode_bans) <= 3)
);
create table public.atlas_ranked_queue (
  user_id uuid primary key references auth.users(id) on delete cascade,
  player_name text not null,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  matched_code text,
  session_id uuid not null
);
create index atlas_ranked_queue_wait_idx on public.atlas_ranked_queue(joined_at) where matched_code is null;
create table public.atlas_ranked_queue_config (
  after_seconds integer primary key check (after_seconds >= 0),
  rating_radius integer not null check (rating_radius > 0)
);
insert into public.atlas_ranked_queue_config values (0,75),(10,125),(20,200);
create table public.atlas_ranked_results (
  match_id uuid primary key references public.atlas_matches(id) on delete cascade,
  player_a uuid not null references auth.users(id),
  player_b uuid not null references auth.users(id),
  score_a double precision not null,
  score_b double precision not null,
  before_a double precision not null,
  after_a double precision not null,
  before_b double precision not null,
  after_b double precision not null,
  completed_at timestamptz not null default now(),
  check (player_a <> player_b)
);
alter table public.atlas_ranked_profiles enable row level security;
alter table public.atlas_ranked_queue enable row level security;
alter table public.atlas_ranked_results enable row level security;
create policy "atlas own ranked profile" on public.atlas_ranked_profiles for select to authenticated using (user_id = auth.uid());
create policy "atlas own ranked result" on public.atlas_ranked_results for select to authenticated using (player_a = auth.uid() or player_b = auth.uid());
grant select on public.atlas_ranked_profiles, public.atlas_ranked_results to authenticated;
revoke insert, update, delete on public.atlas_ranked_profiles, public.atlas_ranked_queue, public.atlas_ranked_results from anon, authenticated;
grant all on public.atlas_ranked_profiles, public.atlas_ranked_queue, public.atlas_ranked_results to service_role;
revoke all on public.atlas_ranked_queue_config from public, anon, authenticated;
grant select, update on public.atlas_ranked_queue_config to service_role;

-- Called only by atlas-match after auth. One transaction serializes queue claims and
-- matches players first; their mode bans and three-game order are chosen after the match.
create function public.atlas_ranked_queue_action(p_user uuid, p_session uuid, p_op text, p_name text, p_modes text[], p_dataset text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare own public.atlas_ranked_queue%rowtype; candidate public.atlas_ranked_queue%rowtype;
  mine public.atlas_ranked_profiles%rowtype;
  code text;
begin
  if auth.role() <> 'service_role' then raise exception 'Service only'; end if;
  if p_op not in ('queue','status','leave') then raise exception 'Unknown queue operation'; end if;
  if cardinality(p_modes) = 0 then raise exception 'No Ranked modes'; end if;
  perform pg_advisory_xact_lock(hashtextextended('atlas-ranked-queue', 0));
  insert into public.atlas_ranked_profiles(user_id) values (p_user) on conflict do nothing;
  select * into mine from public.atlas_ranked_profiles where user_id = p_user;
  select * into own from public.atlas_ranked_queue where user_id = p_user;
  if p_op = 'leave' then
    if own.matched_code is not null and exists (select 1 from public.atlas_matches where room_code = own.matched_code and status not in ('finished','cancelled')) then
      return jsonb_build_object('status','matched','code',own.matched_code);
    end if;
    delete from public.atlas_ranked_queue where user_id = p_user and session_id = p_session and matched_code is null;
    return jsonb_build_object('status','idle');
  end if;
  if own.user_id is not null and own.matched_code is not null then
    if exists (select 1 from public.atlas_matches where room_code = own.matched_code and status not in ('finished','cancelled')) then
      return jsonb_build_object('status','matched','code',own.matched_code);
    end if;
    delete from public.atlas_ranked_queue where user_id = p_user;
    own := null;
  end if;
  if p_op = 'status' and (own.user_id is null or own.session_id <> p_session) then
    return jsonb_build_object('status','idle');
  end if;
  delete from public.atlas_ranked_queue where matched_code is null and last_seen_at < clock_timestamp() - interval '12 seconds';
  if own.user_id is null then
    insert into public.atlas_ranked_queue(user_id,player_name,session_id) values (p_user,left(coalesce(nullif(trim(p_name),''),'Player'),32),p_session);
  else
    update public.atlas_ranked_queue set last_seen_at = clock_timestamp(), session_id = p_session where user_id = p_user;
  end if;
  select * into own from public.atlas_ranked_queue where user_id = p_user;
  select q.* into candidate from public.atlas_ranked_queue q
    join public.atlas_ranked_profiles r on r.user_id = q.user_id
    where q.user_id <> p_user and q.matched_code is null and q.last_seen_at > clock_timestamp() - interval '12 seconds'
      and abs(r.rating - mine.rating) <= least(300,
        (select rating_radius from public.atlas_ranked_queue_config where after_seconds <= extract(epoch from clock_timestamp() - own.joined_at) order by after_seconds desc limit 1)
        + least(50,greatest(0,mine.deviation - 100) / 5))
      and abs(r.rating - mine.rating) <= least(300,
        (select rating_radius from public.atlas_ranked_queue_config where after_seconds <= extract(epoch from clock_timestamp() - q.joined_at) order by after_seconds desc limit 1)
        + least(50,greatest(0,r.deviation - 100) / 5))
    order by (coalesce(q.user_id = mine.last_opponent,false) or coalesce(r.last_opponent = p_user,false)), q.joined_at limit 1;
  if candidate.user_id is null then return jsonb_build_object('status','waiting'); end if;
  code := upper(substr(md5(gen_random_uuid()::text || clock_timestamp()::text),1,6));
  insert into public.atlas_matches(room_code,mode,host_id,players,status,dataset_version,seed,settings,scores,round_started_at,match_kind,state)
    values (code,p_modes[1],candidate.user_id,
      jsonb_build_array(jsonb_build_object('id',candidate.user_id,'name',candidate.player_name,'ready',false),jsonb_build_object('id',p_user,'name',own.player_name,'ready',false)),
      'draft',p_dataset,gen_random_uuid()::text,
      jsonb_build_object('rounds',10,
        'allowSteal',true,'difficulty','intermediate','maxPlayers',2),
      jsonb_build_object(candidate.user_id::text,0,p_user::text,0),null,'ranked',jsonb_build_object('ranked',jsonb_build_object('bans',jsonb_build_object(),'order',jsonb_build_array(),'gameIndex',0,'wins',jsonb_build_object(candidate.user_id::text,0,p_user::text,0),'results',jsonb_build_array())));
  update public.atlas_ranked_queue set matched_code = code where user_id in (p_user,candidate.user_id);
  return jsonb_build_object('status','matched','code',code);
end; $$;
revoke all on function public.atlas_ranked_queue_action(uuid,uuid,text,text,text[],text) from public, anon, authenticated;
grant execute on function public.atlas_ranked_queue_action(uuid,uuid,text,text,text[],text) to service_role;

-- The function reads the authoritative final match scores and applies both rating
-- updates together. A match_id can be rated only once; cancelled games are ineligible.
create function public.atlas_apply_ranked_result(p_match uuid, p_before_a jsonb, p_after_a jsonb, p_before_b jsonb, p_after_b jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare game public.atlas_matches%rowtype; a uuid; b uuid; ra public.atlas_ranked_profiles%rowtype; rb public.atlas_ranked_profiles%rowtype; sa double precision; sb double precision; result jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'Service only'; end if;
  select * into game from public.atlas_matches where id = p_match for update;
  if not found or game.match_kind <> 'ranked' or game.status <> 'finished' or jsonb_array_length(game.players) <> 2 then raise exception 'Match is not rateable'; end if;
  select to_jsonb(r) into result from public.atlas_ranked_results r where match_id = p_match;
  if result is not null then return result; end if;
  a := (game.players->0->>'id')::uuid; b := (game.players->1->>'id')::uuid;
  if a = b then raise exception 'Invalid players'; end if;
  sa := (game.scores->>a::text)::double precision; sb := (game.scores->>b::text)::double precision;
  if sa is null or sb is null then raise exception 'Missing scores'; end if;
  insert into public.atlas_ranked_profiles(user_id) values(a),(b) on conflict do nothing;
  perform 1 from public.atlas_ranked_profiles where user_id in (a,b) order by user_id for update;
  select * into ra from public.atlas_ranked_profiles where user_id = a;
  select * into rb from public.atlas_ranked_profiles where user_id = b;
  if ra.rating <> (p_before_a->>'rating')::double precision or ra.deviation <> (p_before_a->>'deviation')::double precision or ra.volatility <> (p_before_a->>'volatility')::double precision
    or rb.rating <> (p_before_b->>'rating')::double precision or rb.deviation <> (p_before_b->>'deviation')::double precision or rb.volatility <> (p_before_b->>'volatility')::double precision then
    raise exception 'STALE_RATING';
  end if;
  insert into public.atlas_ranked_results(match_id,player_a,player_b,score_a,score_b,before_a,after_a,before_b,after_b)
    values(p_match,a,b,sa,sb,ra.rating,(p_after_a->>'rating')::double precision,rb.rating,(p_after_b->>'rating')::double precision);
  update public.atlas_ranked_profiles set rating=(p_after_a->>'rating')::double precision,deviation=(p_after_a->>'deviation')::double precision,
    volatility=(p_after_a->>'volatility')::double precision,matches_played=matches_played+1,
    wins=wins+(sa>sb)::int,losses=losses+(sa<sb)::int,draws=draws+(sa=sb)::int,last_opponent=b,updated_at=now() where user_id=a;
  update public.atlas_ranked_profiles set rating=(p_after_b->>'rating')::double precision,deviation=(p_after_b->>'deviation')::double precision,
    volatility=(p_after_b->>'volatility')::double precision,matches_played=matches_played+1,
    wins=wins+(sb>sa)::int,losses=losses+(sb<sa)::int,draws=draws+(sa=sb)::int,last_opponent=a,updated_at=now() where user_id=b;
  select to_jsonb(r) into result from public.atlas_ranked_results r where match_id=p_match;
  return result;
end; $$;
revoke all on function public.atlas_apply_ranked_result(uuid,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.atlas_apply_ranked_result(uuid,jsonb,jsonb,jsonb,jsonb) to service_role;
