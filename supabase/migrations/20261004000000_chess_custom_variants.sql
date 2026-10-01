-- Chess Custom: private cloud storage for a user's variants, and a public
-- community gallery of published snapshots with one up/down vote per user.
-- All writes go through validated security-definer functions.

create table public.chess_custom_variants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null check (char_length(client_id) between 1 and 80),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 600),
  board_size text not null check (board_size ~ '^[0-9]{1,2}x[0-9]{1,2}$'),
  piece_types integer not null default 0 check (piece_types between 0 and 200),
  schema_version integer not null check (schema_version between 1 and 1000),
  version integer not null default 1,
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 524288),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, client_id)
);
create index chess_custom_variants_owner_idx on public.chess_custom_variants(owner_id, updated_at desc);

create table public.chess_custom_published (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_client_id text not null check (char_length(source_client_id) between 1 and 80),
  author_name text not null check (char_length(author_name) between 1 and 60),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 600),
  board_size text not null check (board_size ~ '^[0-9]{1,2}x[0-9]{1,2}$'),
  piece_types integer not null default 0 check (piece_types between 0 and 200),
  schema_version integer not null check (schema_version between 1 and 1000),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 524288),
  play_count integer not null default 0,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, source_client_id)
);
create index chess_custom_published_recent_idx on public.chess_custom_published(published_at desc);

create table public.chess_custom_votes (
  published_id uuid not null references public.chess_custom_published(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (published_id, user_id)
);
create index chess_custom_votes_user_idx on public.chess_custom_votes(user_id);

alter table public.chess_custom_variants enable row level security;
alter table public.chess_custom_published enable row level security;
alter table public.chess_custom_votes enable row level security;
create policy "Own custom variants" on public.chess_custom_variants for select to authenticated using (owner_id = auth.uid());
create policy "Browse published custom variants" on public.chess_custom_published for select to anon, authenticated using (true);
create policy "Own custom variant votes" on public.chess_custom_votes for select to authenticated using (user_id = auth.uid());
grant select on public.chess_custom_variants, public.chess_custom_votes to authenticated;
grant select on public.chess_custom_published to anon, authenticated;
revoke insert, update, delete on public.chess_custom_variants, public.chess_custom_published, public.chess_custom_votes from anon, authenticated;

/* ---------------------------------------------------------- Own storage */

create function public.save_chess_custom_variant(
  p_client_id text, p_name text, p_description text, p_board_size text, p_piece_types integer, p_schema_version integer, p_data jsonb
) returns table (version integer, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in to save variants to your account'; end if;
  if not exists (select 1 from public.chess_custom_variants v where v.owner_id = auth.uid() and v.client_id = p_client_id)
     and (select count(*) from public.chess_custom_variants v where v.owner_id = auth.uid()) >= 200 then
    raise exception 'You can keep up to 200 variants — delete one first';
  end if;
  return query
  insert into public.chess_custom_variants as v (owner_id, client_id, name, description, board_size, piece_types, schema_version, data)
  values (auth.uid(), p_client_id, btrim(p_name), btrim(coalesce(p_description, '')), p_board_size, p_piece_types, p_schema_version, p_data)
  on conflict (owner_id, client_id) do update set
    name = excluded.name, description = excluded.description, board_size = excluded.board_size,
    piece_types = excluded.piece_types, schema_version = excluded.schema_version, data = excluded.data,
    version = v.version + 1, updated_at = now()
  returning v.version, v.updated_at;
end; $$;

create function public.delete_chess_custom_variant(p_client_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in to manage your variants'; end if;
  delete from public.chess_custom_variants where owner_id = auth.uid() and client_id = p_client_id;
end; $$;

/* ------------------------------------------------------------ Community */

create function public.publish_chess_custom_variant(
  p_client_id text, p_name text, p_description text, p_board_size text, p_piece_types integer, p_schema_version integer, p_data jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid; author text;
begin
  if auth.uid() is null then raise exception 'Sign in to publish variants'; end if;
  if not exists (select 1 from public.chess_custom_published p where p.owner_id = auth.uid() and p.source_client_id = p_client_id)
     and (select count(*) from public.chess_custom_published p where p.owner_id = auth.uid()) >= 50 then
    raise exception 'You can publish up to 50 variants — unpublish one first';
  end if;
  select left(coalesce(nullif(btrim(pr.display_name), ''), nullif(btrim(pr.username), ''), 'Player'), 60) into author
  from public.profiles pr where pr.id = auth.uid();
  insert into public.chess_custom_published as p (owner_id, source_client_id, author_name, name, description, board_size, piece_types, schema_version, data)
  values (auth.uid(), p_client_id, coalesce(author, 'Player'), btrim(p_name), btrim(coalesce(p_description, '')), p_board_size, p_piece_types, p_schema_version, p_data)
  on conflict (owner_id, source_client_id) do update set
    author_name = excluded.author_name, name = excluded.name, description = excluded.description, board_size = excluded.board_size,
    piece_types = excluded.piece_types, schema_version = excluded.schema_version, data = excluded.data, updated_at = now()
  returning p.id into result;
  return result;
end; $$;

create function public.unpublish_chess_custom_variant(p_published_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.chess_custom_published where id = p_published_id and owner_id = auth.uid();
  if not found then raise exception 'Only the author can unpublish this variant'; end if;
end; $$;

-- p_value: 1 = upvote, -1 = downvote, 0 = remove my vote. Returns the new totals.
create function public.vote_chess_custom_variant(p_published_id uuid, p_value integer)
returns table (upvotes integer, downvotes integer, my_vote integer)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in to vote'; end if;
  if p_value not in (-1, 0, 1) then raise exception 'Invalid vote'; end if;
  if not exists (select 1 from public.chess_custom_published where id = p_published_id) then raise exception 'Variant not found'; end if;
  if exists (select 1 from public.chess_custom_published where id = p_published_id and owner_id = auth.uid()) then
    raise exception 'You cannot vote on your own variant';
  end if;
  if p_value = 0 then
    delete from public.chess_custom_votes where published_id = p_published_id and user_id = auth.uid();
  else
    insert into public.chess_custom_votes(published_id, user_id, value) values (p_published_id, auth.uid(), p_value)
    on conflict (published_id, user_id) do update set value = excluded.value, created_at = now();
  end if;
  return query select
    count(*) filter (where v.value = 1)::integer,
    count(*) filter (where v.value = -1)::integer,
    coalesce(max(v.value) filter (where v.user_id = auth.uid()), 0)::integer
  from public.chess_custom_votes v where v.published_id = p_published_id;
end; $$;

create function public.record_chess_custom_play(p_published_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  update public.chess_custom_published set play_count = play_count + 1 where id = p_published_id;
end; $$;

-- Public gallery with vote totals; my_vote is 0 for visitors who are not signed in.
create function public.list_chess_custom_community(p_sort text default 'top', p_search text default '', p_limit integer default 24, p_offset integer default 0)
returns table (
  id uuid, owner_id uuid, author_name text, name text, description text, board_size text, piece_types integer,
  play_count integer, published_at timestamptz, upvotes integer, downvotes integer, score integer, my_vote integer
)
language sql stable security definer set search_path = '' as $$
  with totals as (
    select p.*,
      coalesce((select count(*) from public.chess_custom_votes v where v.published_id = p.id and v.value = 1), 0)::integer as ups,
      coalesce((select count(*) from public.chess_custom_votes v where v.published_id = p.id and v.value = -1), 0)::integer as downs,
      coalesce((select v.value from public.chess_custom_votes v where v.published_id = p.id and v.user_id = auth.uid()), 0)::integer as mine
    from public.chess_custom_published p
    where coalesce(p_search, '') = '' or p.name ilike '%' || p_search || '%' or p.description ilike '%' || p_search || '%' or p.author_name ilike '%' || p_search || '%'
  )
  select t.id, t.owner_id, t.author_name, t.name, t.description, t.board_size, t.piece_types, t.play_count, t.published_at,
    t.ups, t.downs, t.ups - t.downs, t.mine
  from totals t
  order by
    case when p_sort = 'new' then extract(epoch from t.published_at) when p_sort = 'played' then t.play_count else t.ups - t.downs end desc,
    t.published_at desc
  limit least(greatest(coalesce(p_limit, 24), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.save_chess_custom_variant(text,text,text,text,integer,integer,jsonb), public.delete_chess_custom_variant(text),
  public.publish_chess_custom_variant(text,text,text,text,integer,integer,jsonb), public.unpublish_chess_custom_variant(uuid),
  public.vote_chess_custom_variant(uuid,integer), public.record_chess_custom_play(uuid),
  public.list_chess_custom_community(text,text,integer,integer) from public, anon;
grant execute on function public.save_chess_custom_variant(text,text,text,text,integer,integer,jsonb), public.delete_chess_custom_variant(text),
  public.publish_chess_custom_variant(text,text,text,text,integer,integer,jsonb), public.unpublish_chess_custom_variant(uuid),
  public.vote_chess_custom_variant(uuid,integer), public.record_chess_custom_play(uuid) to authenticated;
grant execute on function public.list_chess_custom_community(text,text,integer,integer) to anon, authenticated;
