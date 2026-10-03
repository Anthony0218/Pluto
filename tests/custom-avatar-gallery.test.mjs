import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { mergeCustomAvatars, readCustomAvatars, writeCustomAvatars } from "../src/components/social/customAvatars.ts";

const first = "px1:" + "a".repeat(256);
const second = "px1:" + "b".repeat(256);

test("avatar collections retain older drawings, discard invalid IDs, and isolate accounts", () => {
  const entries = new Map();
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
  writeCustomAvatars(storage, "alice", [first]);
  writeCustomAvatars(storage, "alice", mergeCustomAvatars([second], readCustomAvatars(storage, "alice"), [first, "m1", null]));
  assert.deepEqual(readCustomAvatars(storage, "alice"), [second, first]);
  assert.deepEqual(readCustomAvatars(storage, "bob"), []);
  // Selecting a preset must never replace the saved drawing collection.
  assert.deepEqual(mergeCustomAvatars(["m1"], readCustomAvatars(storage, "alice")), [second, first]);
  entries.set("custom-avatars:bob", "malformed JSON");
  assert.deepEqual(readCustomAvatars(storage, "bob"), []);
  entries.set("custom-avatars:bob", JSON.stringify({ avatar: first }));
  assert.deepEqual(readCustomAvatars(storage, "bob"), []);
  assert.deepEqual(readCustomAvatars({ getItem() { throw Error("unavailable"); } }, "alice"), []);
  assert.equal(writeCustomAvatars({ setItem() { throw Error("full"); } }, "alice", [first]), false);
});

test("avatar migration imports existing drawings and enforces ownership and format", async () => {
  const db = new PGlite();
  const alice = "00000000-0000-0000-0000-000000000001";
  const bob = "00000000-0000-0000-0000-000000000002";
  try {
    await db.exec(`create schema auth; create role authenticated;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
      grant usage on schema auth to authenticated;
      create table public.profiles(id uuid primary key, avatar_id text);`);
    await db.query("insert into profiles values ($1, $2), ($3, 'm1')", [alice, first, bob]);
    await db.exec(await fs.readFile(new URL("../supabase/migrations/20261015000000_profile_custom_avatars.sql", import.meta.url), "utf8"));
    assert.equal((await db.query("select * from profile_custom_avatars")).rows.length, 1);
    await db.query("select set_config('test.user_id', $1, false)", [alice]);
    await db.exec("set role authenticated");
    await db.query("insert into profile_custom_avatars(user_id, avatar_id) values ($1, $2) on conflict do nothing", [alice, second]);
    await db.query("insert into profile_custom_avatars(user_id, avatar_id) values ($1, $2) on conflict do nothing", [alice, first]);
    assert.equal((await db.query("select * from profile_custom_avatars")).rows.length, 2);
    await assert.rejects(db.query("insert into profile_custom_avatars(user_id, avatar_id) values ($1, $2)", [bob, second]));
    await assert.rejects(db.query("insert into profile_custom_avatars(user_id, avatar_id) values ($1, 'px1:abc')", [alice]));
    await db.query("select set_config('test.user_id', $1, false)", [bob]);
    assert.deepEqual((await db.query("select * from profile_custom_avatars")).rows, []);
    await db.query("insert into profile_custom_avatars(user_id, avatar_id) values ($1, $2)", [bob, second]);
    assert.equal((await db.query("select * from profile_custom_avatars")).rows.length, 1);
  } finally {
    await db.close();
  }
});
