-- Stable catalog keys share vote totals across Pluto and Community tabs.
-- Published custom variants keep their existing votes and RPCs.
create table public.chess_vote_catalog (id text primary key);
insert into public.chess_vote_catalog(id) values
 ('pluto-builtin-complete-chaos'), ('pluto-builtin-four-player'),
 ('pluto-builtin-draft'), ('pluto-builtin-mirror'), ('pluto-builtin-fog-of-war'),
 ('pluto-builtin-tectonic'), ('pluto-builtin-roulette'), ('pluto-builtin-hotpotato'),
 ('pluto-builtin-collapse'), ('pluto-builtin-mutation'), ('pluto-builtin-boss'),
 ('pluto-builtin-capitalism'), ('pluto-builtin-3d-chess'), ('pluto-chaos-chess'),
 ('pluto-team-chess'), ('pluto-team-chess-long'), ('pluto-builtin-volumeSphere'),
 ('pluto-builtin-king-of-the-hill'), ('pluto-builtin-randomstart'),
 ('pluto-builtin-three-lives'), ('pluto-builtin-horror');

create table public.chess_catalog_votes (
 variant_id text not null references public.chess_vote_catalog(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 value smallint not null check(value in (-1, 1)),
 primary key(variant_id, user_id)
);
create index chess_catalog_votes_user_idx on public.chess_catalog_votes(user_id);
alter table public.chess_vote_catalog enable row level security;
alter table public.chess_catalog_votes enable row level security;
revoke all on public.chess_vote_catalog, public.chess_catalog_votes from anon, authenticated;

create function public.list_chess_catalog_votes()
returns table(variant_id text, upvotes integer, downvotes integer, my_vote integer)
language sql stable security definer set search_path = '' as $$
 select c.id, count(*) filter(where v.value=1)::integer,
 count(*) filter(where v.value=-1)::integer,
 coalesce(max(v.value) filter(where v.user_id=auth.uid()),0)::integer
 from public.chess_vote_catalog c left join public.chess_catalog_votes v on v.variant_id=c.id
 group by c.id;
$$;

create function public.vote_chess_catalog_variant(p_variant_id text, p_value integer)
returns table(upvotes integer, downvotes integer, my_vote integer)
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Sign in to vote'; end if;
 if p_value is null or p_value not in (-1,0,1) then raise exception 'Invalid vote'; end if;
 -- Serialize writes per variant so each returned count includes earlier votes.
 perform 1 from public.chess_vote_catalog where id=p_variant_id for update;
 if not found then raise exception 'Variant not found'; end if;
 if p_value=0 then
  delete from public.chess_catalog_votes where variant_id=p_variant_id and user_id=auth.uid();
 else
  insert into public.chess_catalog_votes(variant_id,user_id,value) values(p_variant_id,auth.uid(),p_value)
  on conflict(variant_id,user_id) do update set value=excluded.value;
 end if;
 return query select count(*) filter(where v.value=1)::integer,
 count(*) filter(where v.value=-1)::integer,
 coalesce(max(v.value) filter(where v.user_id=auth.uid()),0)::integer
 from public.chess_catalog_votes v where v.variant_id=p_variant_id;
end;
$$;
revoke all on function public.list_chess_catalog_votes(), public.vote_chess_catalog_variant(text,integer) from public;
grant execute on function public.list_chess_catalog_votes() to anon, authenticated;
grant execute on function public.vote_chess_catalog_variant(text,integer) to authenticated;
