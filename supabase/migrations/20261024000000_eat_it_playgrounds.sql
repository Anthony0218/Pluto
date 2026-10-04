-- Public map ids are validated by the shared authority and this database constraint.
alter table public.eat_it_matches drop constraint if exists eat_it_matches_settings_check;
alter table public.eat_it_matches add constraint eat_it_matches_settings_check
  check (settings->>'map' in ('city','nature','candy','frozen') and (settings->>'count')::integer between 2 and 8);
