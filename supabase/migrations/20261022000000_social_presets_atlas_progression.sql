-- Clan chat uses the same four preset messages as friend chat.
create or replace function public.send_community_group_message(p_group_id uuid, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to chat'; end if;
  if not exists (select 1 from public.community_group_members where group_id = p_group_id and user_id = auth.uid()) then
    raise exception 'Join this clan first';
  end if;
  if p_body is null or btrim(p_body) not in ('Hey', 'You want to play?', 'Yes', 'No') then
    raise exception 'Choose a preset message';
  end if;
  if (select count(*) from public.community_group_messages
      where sender_id = auth.uid() and created_at > now() - interval '30 seconds') >= 10 then
    raise exception 'Slow down a little';
  end if;
  insert into public.community_group_messages (group_id, sender_id, body)
  values (p_group_id, auth.uid(), btrim(p_body)) returning id into result;
  return result;
end; $$;
revoke all on function public.send_community_group_message(uuid, text) from public, anon;
grant execute on function public.send_community_group_message(uuid, text) to authenticated;

-- Both competitors get the same challenge, derived from their mean pre-match rating.
create function public.atlas_ranked_match_difficulty() returns trigger
language plpgsql security definer set search_path = '' as $$
declare average_rating double precision; match_difficulty text;
begin
  if new.match_kind <> 'ranked' then return new; end if;
  select avg(coalesce(r.rating,1500)) into average_rating
  from jsonb_array_elements(new.players) p
  left join public.atlas_ranked_profiles r on r.user_id = (p->>'id')::uuid;
  match_difficulty := case when average_rating < 1300 then 'beginner'
    when average_rating < 1900 then 'intermediate' else 'expert' end;
  new.settings := coalesce(new.settings,'{}'::jsonb) || jsonb_build_object('difficulty',match_difficulty);
  return new;
end; $$;
revoke all on function public.atlas_ranked_match_difficulty() from public, anon, authenticated;
create trigger atlas_ranked_difficulty_before_insert before insert on public.atlas_matches
for each row execute function public.atlas_ranked_match_difficulty();
