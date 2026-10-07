-- Run after the tool-push migration and Edge Function are deployed, and Vault
-- contains tool_push_url and tool_push_cron_secret (see docs/TOOL_NOTIFICATIONS.md).
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;
-- Re-running this file updates the named job rather than adding another worker.
select cron.schedule('pluto-tool-push','* * * * *',$job$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='tool_push_url' limit 1) || '/functions/v1/tool-push',
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='tool_push_cron_secret' limit 1)),
  body := '{"action":"dispatch"}'::jsonb,
  timeout_milliseconds := 20000
 ) where exists(select 1 from vault.decrypted_secrets where name='tool_push_url')
   and exists(select 1 from vault.decrypted_secrets where name='tool_push_cron_secret');
$job$);
