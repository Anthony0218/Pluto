import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const read = (path) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8');
// Every state the client and the atlas-match function can put a room in.
const declared = (await read('src/games/atlas/multiplayer.ts')).match(/export type AtlasMatchStatus = ([^;]+);/)[1].match(/"[a-z_]+"/g).map((status) => status.slice(1, -1));

test('the database accepts every Atlas room state the function writes', async () => {
  const written = [...(await read('supabase/functions/atlas-match/index.ts')).matchAll(/match\.status *= *"([a-z_]+)"/g)].map((match) => match[1]);
  assert.ok(declared.length >= 10 && written.includes('intermission'));
  for (const status of written) assert.ok(declared.includes(status), status);

  const db = new PGlite();
  try {
    // The check as it was on the live table: the eight original states only.
    await db.exec(`create table public.atlas_matches(id serial primary key, status text not null default 'waiting',
      constraint atlas_matches_status_check check (status in ('waiting', 'ready', 'countdown', 'round_active', 'round_resolving', 'next_round', 'finished', 'cancelled')));
      insert into public.atlas_matches(status) values ('round_active'), ('cancelled');`);
    await assert.rejects(db.query(`update public.atlas_matches set status = 'intermission' where id = 1`), /atlas_matches_status_check/);
    await db.exec(await read('supabase/migrations/20261105000000_atlas_match_status_states.sql'));
    for (const status of declared) await db.query(`update public.atlas_matches set status = $1 where id = 1`, [status]);
    await assert.rejects(db.query(`update public.atlas_matches set status = 'paused' where id = 1`), /atlas_matches_status_check/);
  } finally { await db.close(); }
});
