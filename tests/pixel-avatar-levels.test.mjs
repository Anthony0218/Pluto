import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  blankPixelGrid, decodePixelAvatar, editablePixelGrid, encodePixelAvatar, floodFill, isPixelAvatarId,
  PIXEL_SIZE, pixelGridSize, pixelRuns, starterPixelGrid,
} from "../src/components/social/pixelAvatar.ts";
import { mergeCustomAvatars } from "../src/components/social/customAvatars.ts";
import { activityLevel, activityXp, avatarFrameFor, avatarFrameStyle, nextAvatarFrame } from "../src/components/social/avatarFrame.ts";

const migration = (file) => fs.readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8");
const small = "px1:" + "a".repeat(256);
const large = "px2:" + "b".repeat(1024);

test("new drawings are 32×32 and 16×16 drawings keep working", () => {
  assert.equal(PIXEL_SIZE, 32);
  const drawn = encodePixelAvatar(starterPixelGrid());
  assert.match(drawn, /^px2:[0-9a-f]{1024}$/);
  assert.ok(isPixelAvatarId(drawn) && isPixelAvatarId(small) && isPixelAvatarId(large));
  for (const bad of ["px2:" + "a".repeat(256), "px1:" + "a".repeat(1024), "px2:" + "g".repeat(1024), "px3:" + "a".repeat(1024), large + "0", null, undefined]) assert.equal(isPixelAvatarId(bad), false);
  assert.equal(pixelGridSize(decodePixelAvatar(small)), 16);
  assert.equal(pixelGridSize(decodePixelAvatar(large)), 32);
  assert.deepEqual(decodePixelAvatar(drawn), starterPixelGrid());
  assert.deepEqual(mergeCustomAvatars([large, small, "m1", "px2:short"]), [large, small]);
});

test("a 16×16 drawing opens in the editor with every pixel doubled", () => {
  const legacy = Array(256).fill(0);
  legacy[0] = 7; legacy[17] = 12; legacy[255] = 3;
  const grid = editablePixelGrid(legacy);
  assert.equal(grid.length, 1024);
  const at = (x, y) => grid[y * 32 + x];
  assert.deepEqual([at(0, 0), at(1, 0), at(0, 1), at(1, 1), at(2, 0), at(0, 2)], [7, 7, 7, 7, 0, 0]);
  assert.deepEqual([at(2, 2), at(3, 3), at(4, 2)], [12, 12, 0]);
  assert.deepEqual([at(30, 30), at(31, 31), at(29, 31)], [3, 3, 0]);
  assert.equal(grid.filter(Boolean).length, 12);
  const already = blankPixelGrid();
  assert.equal(editablePixelGrid(already), already, "a 32×32 grid is left alone");
});

test("drawing tools work across the whole 32×32 canvas", () => {
  const filled = floodFill(blankPixelGrid(), 0, 5);
  assert.equal(filled.filter((cell) => cell === 5).length, 1024);
  // A full-height wall in column 16 keeps a fill on its own side.
  const walled = blankPixelGrid();
  for (let y = 0; y < 32; y += 1) walled[y * 32 + 16] = 2;
  const half = floodFill(walled, 31, 9);
  assert.equal(half.filter((cell) => cell === 9).length, 15 * 32);
  assert.equal(half[0], 0);
});

test("a drawing renders as a few runs per row, not one shape per pixel", () => {
  assert.deepEqual(pixelRuns(blankPixelGrid()), []);
  const grid = blankPixelGrid();
  for (let x = 4; x < 10; x += 1) grid[32 + x] = 7;
  grid[32 + 10] = 3;
  grid[31 * 32 + 31] = 1;
  assert.deepEqual(pixelRuns(grid), [
    { x: 4, y: 1, width: 6, color: 7 }, { x: 10, y: 1, width: 1, color: 3 }, { x: 31, y: 31, width: 1, color: 1 },
  ]);
  const runs = pixelRuns(starterPixelGrid());
  assert.ok(runs.length < 200, `${runs.length} shapes`);
  assert.equal(runs.reduce((sum, run) => sum + run.width, 0), starterPixelGrid().filter(Boolean).length);
  // 16×16 drawings are measured on their own grid.
  assert.deepEqual(pixelRuns(decodePixelAvatar("px1:" + "0".repeat(255) + "4")), [{ x: 15, y: 15, width: 1, color: 4 }]);
});

test("avatar borders: bronze at level 10, silver at 20, gold at 30", () => {
  assert.equal(activityLevel(activityXp(0, null)), 1);
  assert.equal(activityLevel(activityXp(9, 1)), 1);
  assert.equal(activityLevel(activityXp(9, 2)), 2);
  assert.equal(activityLevel(activityXp(90, 0)), 10);
  assert.deepEqual([1, 9, 10, 19, 20, 29, 30, 75].map((level) => avatarFrameFor(level)?.id ?? null), [null, null, "bronze", "bronze", "silver", "silver", "gold", "gold"]);
  assert.deepEqual([1, 9, 10, 19, 20, 29, 30, 75].map((level) => nextAvatarFrame(level)?.level ?? null), [10, 10, 20, 20, 30, 30, null, null]);
  assert.equal(avatarFrameStyle(null, "#000"), undefined);
  assert.match(avatarFrameStyle(avatarFrameFor(30), "#121d3d").background, /#121d3d.*padding-box.*border-box/);
});

test("the database accepts both avatar sizes and reports the level on public profiles", async () => {
  const db = new PGlite();
  const alice = "00000000-0000-0000-0000-0000000000a1", bob = "00000000-0000-0000-0000-0000000000b2";
  try {
    await db.exec(`create schema auth; create role authenticated; create role anon;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id', true), '')::uuid $$;
      grant usage on schema auth to authenticated;
      create table public.profiles(id uuid primary key, username text, display_name text, avatar_id text,
        constraint profiles_avatar_id_format check (avatar_id is null or avatar_id ~ '^[A-Za-z0-9_-]{1,40}$' or avatar_id ~ '^px1:([0-9a-f]{16}){16}$'));
      create table public.user_game_results(game text, source_id text, user_id uuid, outcome text, multiplayer boolean);
      create table public.chess_ratings(user_id uuid, time_control text, rating int, rated_games int);
      create table public.chess_puzzles(id text primary key);
      create table public.chess_puzzle_completions(user_id uuid, puzzle_id text);
      insert into public.profiles(id, username, avatar_id) values ('${alice}', 'Alice', '${small}'), ('${bob}', 'Bob', 'm1');
      insert into public.chess_puzzles values ('p1'), ('p2');`);
    await db.exec(await migration("20261015000000_profile_custom_avatars.sql"));
    await assert.rejects(db.query("update public.profiles set avatar_id = $1 where id = $2", [large, alice]), /profiles_avatar_id_format/);
    await db.exec(await migration("20261104000000_pixel_avatars_32_levels.sql"));

    await db.query("update public.profiles set avatar_id = $1 where id = $2", [large, alice]);
    await db.query("insert into public.profile_custom_avatars(user_id, avatar_id) values ($1, $2)", [alice, large]);
    assert.equal((await db.query("select * from public.profile_custom_avatars where user_id = $1", [alice])).rows.length, 2, "the 16×16 drawing stays in the gallery");
    for (const bad of ["px2:" + "a".repeat(1023), "px2:" + "a".repeat(1025), "px2:" + "G".repeat(1024), "px1:" + "a".repeat(1024), "<script>"]) {
      await assert.rejects(db.query("update public.profiles set avatar_id = $1 where id = $2", [bad, alice]), /profiles_avatar_id_format/);
      await assert.rejects(db.query("insert into public.profile_custom_avatars(user_id, avatar_id) values ($1, $2)", [alice, bad]));
    }
    await db.query("update public.profiles set avatar_id = 'chess-fox' where id = $1", [alice]);
    await db.query("update public.profiles set avatar_id = $1 where id = $2", [small, alice]);

    const level = async (id) => (await db.query("select public.get_public_profile($1) as p", [id])).rows[0].p.level;
    assert.equal(await level(bob), 1);
    // 89 games and 2 puzzles are 9,000 XP: level 10, the first border.
    await db.query("insert into public.user_game_results(game, source_id, user_id, outcome, multiplayer) select 'chess', g::text, $1, 'win', true from generate_series(1, 89) g", [bob]);
    assert.equal(await level(bob), 9);
    await db.query("insert into public.chess_puzzle_completions values ($1, 'p1'), ($1, 'p2')", [bob]);
    assert.equal(await level(bob), 10);
    assert.equal(activityLevel(activityXp(89, 2)), 10, "the profile page computes the same level");
    assert.equal(await level(alice), 1, "another player's results do not count");
    const profile = (await db.query("select public.get_public_profile($1) as p", [bob])).rows[0].p;
    assert.deepEqual(Object.keys(profile).sort(), ["avatar_id", "chess_rating", "display_name", "id", "level", "most_played", "username"]);
  } finally { await db.close(); }
});
