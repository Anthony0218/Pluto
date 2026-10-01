import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
let PGlite;
try { ({ PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite")); } catch { /* Optional local PostgreSQL harness. */ }

const alice = "00000000-0000-0000-0000-00000000000a";
const bob = "00000000-0000-0000-0000-00000000000b";
const carol = "00000000-0000-0000-0000-00000000000c";
const dave = "00000000-0000-0000-0000-00000000000d";
const data = (name) => JSON.stringify({ schemaVersion: 1, name, board: { width: 8, height: 8, cells: [] }, pieces: [{ id: "king", name: "King" }] });

async function setup() {
  const db = new PGlite();
  await db.exec(`create schema auth; create role authenticated; create role anon;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
  create table auth.users(id uuid primary key);
  create table public.profiles(id uuid primary key, username text, display_name text);
  grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
  insert into auth.users values ('${alice}'), ('${bob}'), ('${carol}');
  insert into public.profiles values ('${alice}', 'alice', 'Alice the Bold'), ('${bob}', 'bob', null);`);
  await db.exec(await fs.readFile(new URL("../supabase/migrations/20261004000000_chess_custom_variants.sql", import.meta.url), "utf8"));
  const as = async (user, role = "authenticated") => {
    await db.exec("reset role");
    await db.query("select set_config('test.user_id',$1,false)", [user ?? ""]);
    await db.exec(`set role ${role}`);
  };
  return { db, as };
}

const save = (db, clientId, name) =>
  db.query("select * from save_chess_custom_variant($1,$2,$3,$4,$5,$6,$7::jsonb)", [clientId, name, "desc", "8x8", 6, 1, data(name)]);
const publish = (db, clientId, name, description = "A fun one") =>
  db.query("select publish_chess_custom_variant($1,$2,$3,$4,$5,$6,$7::jsonb) as id", [clientId, name, description, "8x8", 6, 1, data(name)]);

test("four-player room migration preserves existing host and guest seats", { skip: !PGlite }, async () => {
  const db = new PGlite();
  await db.exec(`create schema auth; create role authenticated; create role anon;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${alice}'), ('${bob}'), ('${carol}'), ('${dave}');`);
  await db.exec(await fs.readFile(new URL("../supabase/migrations/20261005000000_chess_custom_matches.sql", import.meta.url), "utf8"));
  await db.query("insert into chess_custom_matches(id,code,host_id,guest_id,variant_id,schema_version,revision,configuration_hash,variant,state) values ($1,'ABCDEF',$2,$3,'test',1,1,repeat('a',64),'{}','{}')", ["00000000-0000-0000-0000-000000000101", alice, bob]);
  await db.query("insert into chess_custom_matches(id,code,host_id,variant_id,schema_version,revision,configuration_hash,variant,state) values ($1,'ABCDFG',$2,'test',1,1,repeat('a',64),'{}','{}')", ["00000000-0000-0000-0000-000000000102", carol]);
  await db.exec(await fs.readFile(new URL("../supabase/migrations/20261011000000_chess_custom_four_player_matches.sql", import.meta.url), "utf8"));
  const rows = (await db.query("select code,player_ids from chess_custom_matches order by code")).rows;
  assert.deepEqual(rows, [{ code: "ABCDEF", player_ids: [alice, bob] }, { code: "ABCDFG", player_ids: [carol] }]);
  await db.query("update chess_custom_matches set player_ids = array[$1,$2,$3,$4]::uuid[] where code = 'ABCDFG'", [carol, alice, bob, dave]);
  assert.deepEqual((await db.query("select player_ids from chess_custom_matches where code = 'ABCDFG'")).rows[0].player_ids, [carol, alice, bob, dave]);
  await assert.rejects(db.query("update chess_custom_matches set player_ids = array[$1,$2,$3,$1,$2]::uuid[] where code = 'ABCDEF'", [alice, bob, carol]));
});

test("variants are private, versioned and only writable through the RPCs", { skip: !PGlite }, async () => {
  const { db, as } = await setup();
  await as(alice);
  assert.equal((await save(db, "variant-1", "Portal Kingdom")).rows[0].version, 1);
  assert.equal((await save(db, "variant-1", "Portal Kingdom II")).rows[0].version, 2);
  assert.deepEqual((await db.query("select name, version from chess_custom_variants")).rows, [{ name: "Portal Kingdom II", version: 2 }]);
  await assert.rejects(db.query(`insert into chess_custom_variants(owner_id, client_id, name, board_size, schema_version, data) values ('${alice}','x','x','8x8',1,'{}')`));

  await as(bob);
  assert.equal((await db.query("select count(*)::int as n from chess_custom_variants")).rows[0].n, 0, "Bob cannot read Alice's variants");
  await db.query("select delete_chess_custom_variant('variant-1')");
  await as(alice);
  assert.equal((await db.query("select count(*)::int as n from chess_custom_variants")).rows[0].n, 1, "Bob's delete did not touch Alice's row");
  await db.query("select delete_chess_custom_variant('variant-1')");
  assert.equal((await db.query("select count(*)::int as n from chess_custom_variants")).rows[0].n, 0);

  await as(null, "anon");
  await assert.rejects(save(db, "variant-2", "Nope"));
});

test("community: publish, browse anonymously, vote once per user, unpublish", { skip: !PGlite }, async () => {
  const { db, as } = await setup();
  await as(alice);
  const portal = (await publish(db, "variant-1", "Portal Kingdom")).rows[0].id;
  await as(bob);
  const ring = (await publish(db, "variant-9", "Ring Wars", "Holes everywhere")).rows[0].id;
  assert.equal((await db.query("select author_name from chess_custom_published where id = $1", [ring])).rows[0].author_name, "bob");

  await assert.rejects(db.query("select * from vote_chess_custom_variant($1, 1)", [ring]), /own variant/);
  assert.deepEqual((await db.query("select * from vote_chess_custom_variant($1, 1)", [portal])).rows[0], { upvotes: 1, downvotes: 0, my_vote: 1 });
  assert.deepEqual((await db.query("select * from vote_chess_custom_variant($1, -1)", [portal])).rows[0], { upvotes: 0, downvotes: 1, my_vote: -1 }, "changing a vote replaces it");
  await as(carol);
  await db.query("select * from vote_chess_custom_variant($1, 1)", [ring]);
  await db.query("select * from vote_chess_custom_variant($1, 0)", [portal]);
  await assert.rejects(db.query("select * from vote_chess_custom_variant($1, 5)", [ring]));

  await as(null, "anon");
  const top = (await db.query("select name, author_name, score, my_vote from list_chess_custom_community('top', '', 10, 0)")).rows;
  assert.deepEqual(top, [
    { name: "Ring Wars", author_name: "bob", score: 1, my_vote: 0 },
    { name: "Portal Kingdom", author_name: "Alice the Bold", score: -1, my_vote: 0 },
  ]);
  assert.equal((await db.query("select count(*)::int as n from list_chess_custom_community('top', 'holes', 10, 0)")).rows[0].n, 1, "search matches descriptions");
  assert.ok((await db.query("select data from chess_custom_published where id = $1", [portal])).rows[0].data.name, "anyone can load a published variant to play");
  await assert.rejects(db.query("select * from vote_chess_custom_variant($1, 1)", [portal]), /permission denied|Sign in/, "visitors must sign in to vote");

  await as(bob);
  await assert.rejects(db.query("select unpublish_chess_custom_variant($1)", [portal]), /Only the author/);
  await as(alice);
  await publish(db, "variant-1", "Portal Kingdom", "Updated pitch");
  assert.equal((await db.query("select count(*)::int as n from chess_custom_published")).rows[0].n, 2, "republishing updates in place");
  await db.query("select unpublish_chess_custom_variant($1)", [portal]);
  assert.equal((await db.query("select count(*)::int as n from chess_custom_votes")).rows[0].n, 0, "Alice sees no votes of her own");
  assert.equal((await db.query("select count(*)::int as n from list_chess_custom_community('new', '', 10, 0)")).rows[0].n, 1);
});
