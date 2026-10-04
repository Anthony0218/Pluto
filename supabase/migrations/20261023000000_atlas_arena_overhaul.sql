-- Private match rows contain seeds, answers, hidden hands and answer histories.
-- Participant snapshots are returned only by atlas-match after authorization.
drop policy if exists "atlas participants read" on public.atlas_matches;
revoke all on public.atlas_matches from anon, authenticated;
do $$ begin
  if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='atlas_matches') then
    alter publication supabase_realtime drop table public.atlas_matches;
  end if;
end $$;

-- Retire rooms from the old wire protocol without awarding a result. A distinct dataset revision
-- prevents old server/client bundles from creating new games during the coordinated rollout.
update public.atlas_matches set status='cancelled',state=coalesce(state,'{}'::jsonb)||'{"cancelReason":"Arena upgraded; start a new room."}'::jsonb,version=version+1
where status not in ('finished','cancelled');
alter table public.atlas_matches add constraint atlas_current_protocol check(dataset_version <> '2026-09') not valid;

create function public.atlas_certified_rating(p_rating double precision,p_deviation double precision,p_matches integer)
returns double precision language sql immutable set search_path='' as $$
  select least(case when p_rating>=1900 then p_rating-.5*greatest(0,p_deviation) else p_rating end,
    case when p_matches<14 then 1899 else 'Infinity'::float8 end,
    case when p_matches<20 then 2199 else 'Infinity'::float8 end,
    case when p_matches<30 then 2399 else 'Infinity'::float8 end);
$$;
revoke all on function public.atlas_certified_rating(double precision,double precision,integer) from public;
grant execute on function public.atlas_certified_rating(double precision,double precision,integer) to service_role;

drop function public.get_atlas_ranked_leaderboard(uuid[]);
create function public.get_atlas_ranked_leaderboard(p_user_ids uuid[] default null)
returns table(user_id uuid,username text,rating double precision,deviation double precision,matches_played integer,leaderboard_rank bigint)
language sql stable security definer set search_path=public as $$
  with ranked as (
    select r.user_id,row_number() over(order by public.atlas_certified_rating(r.rating,r.deviation,r.matches_played) desc,r.rating desc,r.user_id) position
    from atlas_ranked_profiles r where r.matches_played>=10
  ) select r.user_id,coalesce(p.display_name,p.username,'Explorer'),r.rating,r.deviation,r.matches_played,ranked.position
  from atlas_ranked_profiles r left join profiles p on p.id=r.user_id left join ranked on ranked.user_id=r.user_id
  where (p_user_ids is null and ranked.position is not null) or r.user_id=any(p_user_ids)
  order by ranked.position nulls last,r.user_id limit 100;
$$;
revoke all on function public.get_atlas_ranked_leaderboard(uuid[]) from public;
grant execute on function public.get_atlas_ranked_leaderboard(uuid[]) to anon,authenticated;

-- Calibration telemetry is server-generated and private. No public answer bank or client score writes.
create table public.atlas_question_attempts (
  match_id uuid not null references public.atlas_matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_key text not null, concept text not null, difficulty text not null,
  challenge_tier text not null default 'standard', correct boolean not null,
  response_ms integer not null check(response_ms>=0), points double precision not null,
  recorded_at timestamptz not null default now(), primary key(match_id,user_id,question_key)
);
alter table public.atlas_question_attempts enable row level security;
revoke all on public.atlas_question_attempts from anon,authenticated;
grant all on public.atlas_question_attempts to service_role;
create index atlas_question_attempts_concept_idx on public.atlas_question_attempts(concept,difficulty,challenge_tier);
create function public.atlas_capture_attempts() returns trigger language plpgsql security definer set search_path='' as $$
declare player record; attempt jsonb; entry jsonb; run jsonb; idx integer;
begin
  for player in select * from jsonb_each(coalesce(new.state->'race','{}'::jsonb)) loop
    run:=player.value;idx:=0;
    for attempt in select * from jsonb_array_elements(coalesce(run->'ledger','[]'::jsonb)) loop
      insert into public.atlas_question_attempts values(new.id,player.key::uuid,new.seed||':race:'||idx,
        coalesce(attempt->>'concept',new.mode),coalesce(new.settings->>'difficulty','intermediate'),coalesce(new.settings->>'challengeTier','standard'),
        (attempt->>'correct')::boolean,greatest(0,least(1800000,(attempt->>'elapsedMs')::integer)),(attempt->>'points')::float8,now()) on conflict do nothing;
      idx:=idx+1;
    end loop;
  end loop;
  for entry in select * from jsonb_array_elements(coalesce(new.submissions,'[]'::jsonb)) loop
    insert into public.atlas_question_attempts values(new.id,(entry->>'userId')::uuid,new.seed||':round:'||(entry->>'round')||':'||coalesce(entry->>'tip','0'),
      coalesce(entry->>'concept',new.mode),coalesce(new.settings->>'difficulty','intermediate'),coalesce(new.settings->>'challengeTier','standard'),
      (entry->>'correct')::boolean,greatest(0,least(1800000,coalesce((entry->>'elapsedMs')::integer,0))),0,now()) on conflict do nothing;
  end loop;
  for entry in select * from jsonb_array_elements(coalesce(new.state->'attempts','[]'::jsonb)) loop
    insert into public.atlas_question_attempts values(new.id,(entry->>'userId')::uuid,new.seed||':strategy:'||(entry->>'cycle'),
      entry->>'concept',coalesce(new.settings->>'difficulty','intermediate'),coalesce(new.settings->>'challengeTier','standard'),
      (entry->>'correct')::boolean,greatest(0,least(1800000,(entry->>'elapsedMs')::integer)),0,now()) on conflict do nothing;
  end loop;
  return new;
end $$;
revoke all on function public.atlas_capture_attempts() from public;
create trigger atlas_capture_attempts after insert or update on public.atlas_matches for each row execute function public.atlas_capture_attempts();
