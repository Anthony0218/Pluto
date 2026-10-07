-- Run in the affected project's Supabase SQL editor.
-- Read-only: returns policy definitions, not user data.
select policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename in ('friend_requests', 'friendships')
order by tablename, cmd, policyname;
