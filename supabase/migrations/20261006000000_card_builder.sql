-- Card Builder: user-made card games for the 32-card deck.
--
-- card_games            one row per game (owner, name, slug, visibility)
-- card_game_versions    Version 1, 2, 3 … of a game's definition (JSONB). At most
--                       one open draft per game; published versions are immutable.
-- card_game_sessions    a match; always references one published version.
-- card_game_players     seats in a session.
--
-- Every write goes through the card-games edge function, which validates the
-- definition with the shared engine (allowlisted rule/effect/condition types
-- only) before touching these tables. Signed-in users can only read.

create table public.card_games (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  description text not null default '' check (char_length(description) <= 600),
  visibility text not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index card_games_owner_idx on public.card_games(owner_id, updated_at desc);
create index card_games_public_idx on public.card_games(updated_at desc) where visibility = 'public';

create table public.card_game_versions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.card_games(id) on delete cascade,
  version integer not null check (version between 1 and 100000),
  definition_json jsonb not null check (jsonb_typeof(definition_json) = 'object' and pg_column_size(definition_json) <= 262144),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (game_id, version),
  check ((status = 'published') = (published_at is not null))
);
create unique index card_game_versions_one_draft on public.card_game_versions(game_id) where status = 'draft';

create table public.card_game_sessions (
  id uuid primary key default gen_random_uuid(),
  game_version_id uuid not null references public.card_game_versions(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  state_json jsonb not null check (jsonb_typeof(state_json) = 'object' and pg_column_size(state_json) <= 524288),
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  revision integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index card_game_sessions_version_idx on public.card_game_sessions(game_version_id);

create table public.card_game_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.card_game_sessions(id) on delete cascade,
  -- null for bot seats
  user_id uuid references auth.users(id) on delete set null,
  seat integer not null check (seat between 0 and 9),
  status text not null default 'active' check (status in ('active', 'finished', 'eliminated', 'left')),
  unique (session_id, seat),
  unique (session_id, user_id)
);
create index card_game_players_user_idx on public.card_game_players(user_id);

/* ------------------------------------------------------------ Immutability */

-- A published version never changes (only its row may be read), and a version
-- never moves to another game or number. Draft → published is the one allowed
-- status change.
create function public.card_game_versions_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if old.status = 'published' then
      raise exception 'Published game version % is immutable; save a new draft instead', old.version;
    end if;
    if new.game_id <> old.game_id or new.version <> old.version then
      raise exception 'A version cannot change its game or number';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' and old.status = 'published' and exists (select 1 from public.card_games g where g.id = old.game_id) then
    raise exception 'Published game versions cannot be deleted';
  end if;
  return old;
end; $$;
create trigger card_game_versions_guard before update or delete on public.card_game_versions
  for each row execute function public.card_game_versions_guard();

-- Sessions only start from published (immutable) versions.
create function public.card_game_sessions_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.game_version_id <> old.game_version_id then
    raise exception 'A session cannot switch game versions';
  end if;
  if not exists (select 1 from public.card_game_versions v where v.id = new.game_version_id and v.status = 'published') then
    raise exception 'Sessions must use a published game version';
  end if;
  return new;
end; $$;
create trigger card_game_sessions_guard before insert or update on public.card_game_sessions
  for each row execute function public.card_game_sessions_guard();

/* ---------------------------------------------------------------- Access */

alter table public.card_games enable row level security;
alter table public.card_game_versions enable row level security;
alter table public.card_game_sessions enable row level security;
alter table public.card_game_players enable row level security;

create policy "Own or public card games" on public.card_games for select to anon, authenticated
  using (visibility = 'public' or owner_id = auth.uid());
create policy "Versions of readable card games" on public.card_game_versions for select to anon, authenticated
  using (exists (
    select 1 from public.card_games g where g.id = game_id
      and (g.owner_id = auth.uid() or (g.visibility = 'public' and status = 'published'))
  ));
-- Session state contains hidden cards, so players read their own redacted
-- view through the edge function; only seat lists are directly readable.
create policy "Own card game seats" on public.card_game_players for select to authenticated using (user_id = auth.uid());

grant select on public.card_games, public.card_game_versions to anon, authenticated;
grant select on public.card_game_players to authenticated;
revoke all on public.card_game_sessions from anon, authenticated;
revoke insert, update, delete on public.card_games, public.card_game_versions, public.card_game_players from anon, authenticated;
