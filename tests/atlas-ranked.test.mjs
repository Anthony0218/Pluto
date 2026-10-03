import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ARENA_MODES } from "../src/games/atlas/modeCatalog.ts";
import { chooseRankedMode, chooseRankedSeries, getRankFromRating, maxModeBans, rankedModes, RANK_THRESHOLDS, sanitizeBans } from "../src/games/atlas/ranked.ts";
import { calculateMatchResult, INITIAL_RATING } from "../src/games/atlas/rankedRating.ts";

test("Glicko-2 rates a result from match one, with uncertainty governing movement", () => {
  const strong = { ...INITIAL_RATING, rating: 1800, deviation: 60, matchesPlayed: 30 };
  const weak = { ...INITIAL_RATING, rating: 1200, deviation: 60, matchesPlayed: 30 };
  const expected = calculateMatchResult(strong, weak, "a");
  const upset = calculateMatchResult(strong, weak, "b");
  const draw = calculateMatchResult(strong, weak, "draw");
  assert.ok(expected.a.rating > strong.rating && expected.b.rating < weak.rating);
  assert.ok(upset.a.rating < strong.rating && upset.b.rating > weak.rating);
  assert.ok(Math.abs(upset.a.rating - strong.rating) > Math.abs(expected.a.rating - strong.rating));
  assert.ok(draw.a.rating < strong.rating && draw.b.rating > weak.rating);
  const provisional = calculateMatchResult(INITIAL_RATING, strong, "a");
  assert.ok(Math.abs(provisional.a.rating - 1500) > Math.abs(expected.a.rating - strong.rating));
  assert.equal(provisional.a.matchesPlayed, 1);
  for (const pair of [expected, upset, draw, provisional]) for (const next of Object.values(pair)) {
    assert.ok(Number.isFinite(next.rating) && Number.isFinite(next.deviation) && Number.isFinite(next.volatility));
    assert.ok(next.deviation > 0 && next.volatility > 0);
  }
});

test("rank boundaries and catalog compatibility are centralized", () => {
  assert.equal(getRankFromRating(-100).displayName, "Bronze III");
  assert.equal(getRankFromRating(1499).displayName, "Gold II");
  assert.equal(getRankFromRating(1500).displayName, "Gold I");
  assert.equal(getRankFromRating(2199).displayName, "Diamond I");
  assert.equal(getRankFromRating(2200).displayName, "Master");
  assert.equal(getRankFromRating(2400).displayName, "Grandmaster");
  for (const threshold of RANK_THRESHOLDS.slice(1)) {
    const at = getRankFromRating(threshold.rating), below = getRankFromRating(threshold.rating - 1);
    assert.notEqual(at.displayName, below.displayName, `boundary at ${threshold.rating}`);
  }
  assert.equal(rankedModes().length, 15);
  assert.deepEqual(rankedModes().map((mode) => mode.online), ARENA_MODES.map((mode) => mode.online));
  assert.equal(ARENA_MODES.length, 15);
});

test("bans are bounded and combined bans select only eligible modes", () => {
  const ids = rankedModes().map((mode) => mode.online);
  assert.deepEqual(sanitizeBans([]), []);
  assert.deepEqual(sanitizeBans([ids[0]]), [ids[0]]);
  assert.deepEqual(sanitizeBans(ids.slice(0, 3)), ids.slice(0, 3));
  assert.equal(sanitizeBans(ids.slice(0, 4)).length, 3);
  assert.equal(maxModeBans(3), 0);
  assert.equal(maxModeBans(1), 0);
  const chosen = chooseRankedMode(ids, ids.slice(0, 3), ids.slice(3, 6), () => 0);
  assert.equal(chosen, ids[6]);
  assert.equal(chooseRankedMode(["a", "b"], ["a"], ["b"], () => 0), "a", "one-sided fallback precedes twice-banned modes");
  assert.equal(chooseRankedMode(["a"], ["a"], ["a"], () => 0), "a", "the smallest future catalog still produces a match");
  const series = chooseRankedSeries(ids, ids.slice(0, 3), ids.slice(3, 6), () => 0);
  assert.deepEqual(series, ids.slice(6, 9));
  assert.equal(new Set(series).size, 3);
  assert.throws(() => chooseRankedSeries(["a", "b"], [], []), /three unbanned/);
});

let PGlite;
try { ({ PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite")); } catch { /* Optional local SQL harness. */ }
const migration = (file) => readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8");
const A = "00000000-0000-0000-0000-0000000000a1", B = "00000000-0000-0000-0000-0000000000b2";

test("database queue creates one shared match and rating settlement is exactly once", { skip: !PGlite }, async () => {
  const db = new PGlite();
  await db.exec(`create schema auth; create role authenticated; create role anon; create role service_role;
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create function auth.role() returns text language sql stable as $$ select 'service_role'::text $$;
    create table auth.users(id uuid primary key); insert into auth.users values ('${A}'),('${B}');
    create publication supabase_realtime;`);
  for (const file of ["20260926150000_atlas_arena.sql", "20261013000000_atlas_party_modes.sql", "20261017000000_atlas_unified_modes.sql", "20261018000000_atlas_language_guesser.sql", "20261019000000_atlas_ranked.sql"]) await db.exec(await migration(file));
  await db.query("insert into public.atlas_ranked_profiles(user_id,mode_bans) values ($1,array['map_battle']),($2,array['flag_battle'])", [A, B]);
  await assert.rejects(db.query("update public.atlas_ranked_profiles set mode_bans=array['a','b','c','d'] where user_id=$1", [A]), /check/);
  const sessionA = "00000000-0000-0000-0000-000000000001", sessionB = "00000000-0000-0000-0000-000000000002";
  const queue = (user, session, op) => db.query("select public.atlas_ranked_queue_action($1::uuid,$2::uuid,$3,'Player',array['map_battle','flag_battle'],'v1') as result", [user, session, op]);
  assert.equal((await queue(A, sessionA, "queue")).rows[0].result.status, "waiting");
  const matched = (await queue(B, sessionB, "queue")).rows[0].result;
  assert.equal(matched.status, "matched");
  assert.equal((await queue(A, sessionA, "status")).rows[0].result.code, matched.code);
  assert.equal((await queue(A, sessionA, "leave")).rows[0].result.code, matched.code, "a queue cancellation cannot abandon an already matched game");
  const { rows: [match] } = await db.query("select * from public.atlas_matches where room_code=$1", [matched.code]);
  assert.equal(match.match_kind, "ranked");
  assert.equal(match.status, "draft");
  assert.deepEqual(match.state.ranked.order, []);
  assert.equal(match.players.length, 2);
  assert.ok(["map_battle", "flag_battle"].includes(match.mode));
  assert.equal((await db.query("select count(*)::int as count from public.atlas_matches")).rows[0].count, 1, "both clients share one room");
  await db.query("update public.atlas_matches set status='finished',scores=jsonb_build_object($1::text,9850,$2::text,8700) where id=$3", [A, B, match.id]);
  const after = calculateMatchResult(INITIAL_RATING, INITIAL_RATING, "a");
  const apply = () => db.query("select public.atlas_apply_ranked_result($1::uuid,$2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb) as result", [match.id, JSON.stringify(INITIAL_RATING), JSON.stringify(after.a), JSON.stringify(INITIAL_RATING), JSON.stringify(after.b)]);
  const first = (await apply()).rows[0].result, second = (await apply()).rows[0].result;
  assert.deepEqual(second, first);
  const { rows: profiles } = await db.query("select user_id,matches_played,wins,losses,draws from public.atlas_ranked_profiles order by user_id");
  assert.deepEqual(profiles.map((row) => row.matches_played), [1, 1]);
  assert.deepEqual(profiles.map((row) => [row.wins, row.losses, row.draws]), [[1, 0, 0], [0, 1, 0]]);
  await db.query("insert into public.atlas_matches(room_code,mode,host_id,players,status,dataset_version,seed,match_kind,scores) values ('DRAW01','flag_battle',$1::uuid,jsonb_build_array(jsonb_build_object('id',$1::text),jsonb_build_object('id',$2::text)),'finished','v1','seed2','ranked',jsonb_build_object($1::text,5,$2::text,5))", [A, B]);
  const { rows: [drawMatch] } = await db.query("select id from public.atlas_matches where room_code='DRAW01'");
  const drawAfter = calculateMatchResult(after.a, after.b, "draw");
  await db.query("select public.atlas_apply_ranked_result($1::uuid,$2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb)", [drawMatch.id, JSON.stringify(after.a), JSON.stringify(drawAfter.a), JSON.stringify(after.b), JSON.stringify(drawAfter.b)]);
  const { rows: drawProfiles } = await db.query("select matches_played,wins,losses,draws from public.atlas_ranked_profiles order by user_id");
  assert.deepEqual(drawProfiles.map((row) => [row.matches_played, row.wins, row.losses, row.draws]), [[2, 1, 0, 1], [2, 0, 1, 1]]);
  await db.query("insert into public.atlas_matches(room_code,mode,host_id,players,status,dataset_version,seed,match_kind) values ('CANCEL','map_battle',$1::uuid,jsonb_build_array(jsonb_build_object('id',$1::text),jsonb_build_object('id',$2::text)),'cancelled','v1','seed','ranked')", [A, B]);
  const { rows: [cancelled] } = await db.query("select id from public.atlas_matches where room_code='CANCEL'");
  await assert.rejects(db.query("select public.atlas_apply_ranked_result($1::uuid,$2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb)", [cancelled.id, JSON.stringify(INITIAL_RATING), JSON.stringify(after.a), JSON.stringify(INITIAL_RATING), JSON.stringify(after.b)]), /not rateable/);
  await db.query("update public.atlas_matches set status='cancelled' where id=$1", [match.id]);
  await assert.rejects(db.query("select public.atlas_apply_ranked_result($1::uuid,$2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb)", [match.id, JSON.stringify(INITIAL_RATING), JSON.stringify(after.a), JSON.stringify(INITIAL_RATING), JSON.stringify(after.b)]), /not rateable/);
  await db.close();
});
