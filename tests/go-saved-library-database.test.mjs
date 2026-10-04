import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("saved Go games are private to their account and reject mismatched records", async () => {
  const db = new PGlite();
  const alice = "00000000-0000-4000-8000-000000000001";
  const bob = "00000000-0000-4000-8000-000000000002";
  try {
    await db.exec(`create role authenticated; create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      insert into auth.users values ('${alice}'), ('${bob}');`);
    await db.exec(readFileSync(new URL("../supabase/migrations/20261021010000_go_saved_games.sql", import.meta.url), "utf8"));
    const id = "10000000-0000-4000-8000-000000000001";
    await db.query("insert into go_saved_games (id,user_id,saved_at,record) values ($1,$2,now(),$3)", [id, alice, { id, ownerId: alice, game: {} }]);
    await assert.rejects(db.query("insert into go_saved_games (id,user_id,saved_at,record) values (gen_random_uuid(),$1,now(),$2)", [alice, { id, ownerId: bob }]), /check constraint/);
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${bob}', false);`);
    assert.equal((await db.query("select count(*)::int n from go_saved_games")).rows[0].n, 0);
    assert.equal((await db.query("delete from go_saved_games where id=$1 returning id", [id])).rows.length, 0);
    await db.exec(`select set_config('request.jwt.claim.sub', '${alice}', false);`);
    assert.equal((await db.query("select count(*)::int n from go_saved_games")).rows[0].n, 1);
    assert.equal((await db.query("delete from go_saved_games where id=$1 returning id", [id])).rows.length, 1);
  } finally { await db.close(); }
});
