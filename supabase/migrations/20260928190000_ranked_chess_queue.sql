-- The ranked Edge Function owns queue entries. Clients can only enter through
-- the authenticated function, which verifies both players before joining.
create table public.ranked_chess_queue (
  user_id uuid primary key references auth.users(id) on delete cascade,
  room_code text not null,
  rating integer not null,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz
);
create index ranked_chess_queue_waiting_idx on public.ranked_chess_queue(joined_at)
  where claimed_by is null;
alter table public.ranked_chess_queue enable row level security;
revoke all on public.ranked_chess_queue from anon, authenticated;
grant select, insert, update, delete on public.ranked_chess_queue to service_role;
