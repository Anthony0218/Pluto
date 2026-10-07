-- Fourth hardening pass: profiles for signed-in players only, two unused room lookups,
-- and private Realtime channels for the features that broadcast or track presence.

-- ---------------------------------------------------------------------------
-- Profiles (name, avatar, rating) were readable with only the public key, so anyone
-- could list every player without an account. Every page that shows a profile already
-- requires sign-in, and the public leaderboards go through their own functions. The
-- "profiles readable by authenticated users" policy stays.
-- ---------------------------------------------------------------------------
drop policy if exists "Profiles are publicly readable" on public.profiles;
revoke all on public.profiles from anon;

-- ---------------------------------------------------------------------------
-- Room lookups the client no longer calls. Any signed-in player holding a Watten room
-- code or id could read that table's status, seat count and cards left per seat.
-- play_watten3_card and perform_watten3_abheben still use the card count internally.
-- ---------------------------------------------------------------------------
revoke execute on function public.get_watten_room_info(text) from public, anon, authenticated;
revoke execute on function public.watten3_cards_remaining(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime Broadcast and Presence ran on public channels: whoever knew a topic name could
-- listen and send with only the public key. The client now opens these topics as private
-- channels, which Realtime authorises against the policies below.
--   watten4-deal-<room id>, watten3-deal-<room id>   players at that table
--   atlas-<room code>                                players in that arena
--   natura-v2:<room code>                            any signed-in player (the room lives in
--                                                    the host's browser; packets are encrypted)
-- Every other topic is refused. postgres_changes subscriptions are not affected: they are
-- filtered by each table's own row-level security.
-- ---------------------------------------------------------------------------
create function public.can_use_realtime_topic(p_topic text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and case
    when p_topic ~ '^watten4-deal-[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      then public.is_watten_room_member(substr(p_topic, 14)::uuid)
    when p_topic ~ '^watten3-deal-[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      then public.is_watten3_room_member(substr(p_topic, 14)::uuid)
    when p_topic ~ '^atlas-[A-Z0-9]{6}$'
      then exists (
        select 1 from public.atlas_matches m
        where m.room_code = substr(p_topic, 7)
          and m.players @> jsonb_build_array(jsonb_build_object('id', auth.uid()::text)))
    when p_topic ~ '^natura-v2:[A-Z2-9]{6}$' then true
    else false
  end;
$$;
revoke all on function public.can_use_realtime_topic(text) from public, anon;
grant execute on function public.can_use_realtime_topic(text) to authenticated;

drop policy if exists "Room players receive room broadcasts" on realtime.messages;
drop policy if exists "Room players send room broadcasts" on realtime.messages;
create policy "Room players receive room broadcasts" on realtime.messages for select to authenticated
  using (extension in ('broadcast', 'presence') and public.can_use_realtime_topic(realtime.topic()));
create policy "Room players send room broadcasts" on realtime.messages for insert to authenticated
  with check (extension in ('broadcast', 'presence') and public.can_use_realtime_topic(realtime.topic()));
