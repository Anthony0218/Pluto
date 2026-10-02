-- Preserve the original host/guest columns while adding ordered seats for
-- four-player Chess Custom rooms. Seat order matches the variant's team order.
alter table public.chess_custom_matches
  add column player_ids uuid[] not null default '{}'::uuid[];

update public.chess_custom_matches
set player_ids = case
  when guest_id is null then array[host_id]
  else array[host_id, guest_id]
end;

alter table public.chess_custom_matches
  add constraint chess_custom_matches_player_ids_check
  check (cardinality(player_ids) between 1 and 4 and player_ids[1] = host_id);
