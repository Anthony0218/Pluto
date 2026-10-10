-- Personal nutrition logs stay in browser storage. Only explicitly shared recipes
-- reach the cloud, and only confirmed Pluto friends can receive a share.
create table public.nutrition_recipes (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  servings numeric not null check (servings > 0 and servings <= 100),
  foods jsonb not null check (jsonb_typeof(foods) = 'array' and jsonb_array_length(foods) between 1 and 50 and octet_length(foods::text) <= 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.nutrition_recipe_shares (
  recipe_id uuid not null references public.nutrition_recipes(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(recipe_id, recipient_id)
);
create index nutrition_recipes_owner_idx on public.nutrition_recipes(owner_id, updated_at desc);
create index nutrition_recipe_shares_recipient_idx on public.nutrition_recipe_shares(recipient_id, created_at desc);
alter table public.nutrition_recipes enable row level security;
alter table public.nutrition_recipe_shares enable row level security;
create policy nutrition_recipe_read on public.nutrition_recipes for select to authenticated using (
  owner_id = auth.uid() or exists (select 1 from public.nutrition_recipe_shares share where share.recipe_id = id and share.recipient_id = auth.uid())
);
create policy nutrition_recipe_create on public.nutrition_recipes for insert to authenticated with check (owner_id = auth.uid());
create policy nutrition_recipe_update on public.nutrition_recipes for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy nutrition_recipe_delete on public.nutrition_recipes for delete to authenticated using (owner_id = auth.uid());
create policy nutrition_share_read on public.nutrition_recipe_shares for select to authenticated using (recipient_id = auth.uid() or sender_id = auth.uid());
revoke insert, update, delete on public.nutrition_recipe_shares from anon, authenticated;
grant select, insert, update, delete on public.nutrition_recipes to authenticated;
grant select on public.nutrition_recipe_shares to authenticated;

create function public.nutrition_share_recipe(p_recipe uuid, p_username text) returns void
language plpgsql security definer set search_path = '' as $$
declare recipient uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_username is null or length(btrim(p_username)) not between 1 and 100 then raise exception 'Invalid recipient'; end if;
  perform 1 from public.nutrition_recipes where id = p_recipe and owner_id = auth.uid();
  if not found then raise exception 'Recipe unavailable'; end if;
  select id into recipient from public.profiles where lower(username) = lower(btrim(p_username));
  if recipient is null or recipient = auth.uid() then raise exception 'Recipient unavailable'; end if;
  if not exists (select 1 from public.friendships where (user_a = auth.uid() and user_b = recipient) or (user_b = auth.uid() and user_a = recipient)) then raise exception 'Recipes can only be shared with friends'; end if;
  insert into public.nutrition_recipe_shares(recipe_id, recipient_id, sender_id) values(p_recipe, recipient, auth.uid()) on conflict(recipe_id, recipient_id) do nothing;
end;
$$;
revoke all on function public.nutrition_share_recipe(uuid, text) from public, anon;
grant execute on function public.nutrition_share_recipe(uuid, text) to authenticated;
