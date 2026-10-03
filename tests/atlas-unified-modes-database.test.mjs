import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
let PGlite;
try { ({ PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite")); } catch { /* Optional local PostgreSQL harness. */ }

const host = "00000000-0000-0000-0000-0000000000a1";
const migration = (file) => fs.readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8");

test("every Atlas mode can be stored, with race and duel state", { skip: !PGlite }, async () => {
  const db = new PGlite();
  // Minimal stand-ins for the Supabase roles, auth schema and realtime publication.
  await db.exec(`create schema auth; create role authenticated; create role anon; create role service_role;
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create table auth.users(id uuid primary key); insert into auth.users values ('${host}');
    create publication supabase_realtime;`);
  await db.exec(await migration("20260926150000_atlas_arena.sql"));
  await db.exec(await migration("20261013000000_atlas_party_modes.sql"));
  await db.exec(await migration("20261017000000_atlas_unified_modes.sql"));
  await db.exec(await migration("20261018000000_atlas_language_guesser.sql"));
  const modes = ["map_battle", "closest_wins", "higher_lower", "territory_battle", "flag_battle", "guess_country", "speed_run", "map_fill", "stat_ranking", "region_builder", "stat_detective", "country_guesser", "extreme_geography", "stat_battle", "language_guesser"];
  for (const [index, mode] of modes.entries()) {
    await db.exec(`insert into public.atlas_matches(room_code, mode, host_id, players, dataset_version, seed) values ('ROOM${String(index).padStart(2, "0")}', '${mode}', '${host}', '[{"id":"${host}"}]', 'v1', 'seed')`);
  }
  const { rows } = await db.query("select mode, state from public.atlas_matches order by room_code");
  assert.equal(rows.length, modes.length);
  assert.ok(rows.every((row) => JSON.stringify(row.state) === "{}"), "state defaults to an empty object");
  await db.exec(`update public.atlas_matches set state = '{"race":{"a":{"score":10,"done":true,"updatedAt":1}}}' where mode = 'speed_run'`);
  await assert.rejects(db.exec(`insert into public.atlas_matches(room_code, mode, host_id, players, dataset_version, seed) values ('CHESS1', 'chess', '${host}', '[]', 'v1', 'seed')`), /atlas_matches_mode_check/);
  await assert.rejects(db.exec(`update public.atlas_matches set state = '[]' where mode = 'map_fill'`), /check/);
  await db.close();
});
