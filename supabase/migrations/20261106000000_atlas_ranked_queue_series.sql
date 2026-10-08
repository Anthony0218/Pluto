-- Ranked Atlas matchmaking on the live project still ran an earlier version of this function:
-- it created a single game in the 'ready' state with a randomly chosen mode. The atlas-match
-- function and the client are built for the version below (identical to the one in
-- 20261019000000_atlas_ranked.sql, which was revised after it had been applied): a matched
-- pair starts in 'draft', picks mode bans, then plays a best-of-three series.
-- Signature and grants are unchanged.
create or replace function public.atlas_ranked_queue_action(p_user uuid, p_session uuid, p_op text, p_name text, p_modes text[], p_dataset text)
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
