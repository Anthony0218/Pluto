-- Each private room is a saved game day. The authoritative game JSON stays server only.
alter table public.schafkopf_rooms
  add column title text not null default 'Spieltag' check (char_length(title) between 1 and 60),
  add column ai_difficulty text not null default 'normal' check (ai_difficulty in ('beginner', 'normal', 'pro'));

create table public.schafkopf_room_hidden (
  room_id uuid not null references public.schafkopf_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (room_id, user_id)
);
alter table public.schafkopf_room_hidden enable row level security;
revoke all on table public.schafkopf_room_hidden from anon, authenticated;
grant all on table public.schafkopf_room_hidden to service_role;
create index schafkopf_room_hidden_user_idx on public.schafkopf_room_hidden(user_id);
