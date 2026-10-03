import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { plutoCommunityCatalog } from '../src/games/chess/custom/library/communityCatalog.ts';
import { createCommunityService } from '../src/games/chess/custom/storage/communityService.ts';

const alice = '00000000-0000-0000-0000-00000000000a';
const bob = '00000000-0000-0000-0000-00000000000b';
test('all catalog variants persist, replace and remove votes with authenticated access', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create schema auth; create role authenticated; create role anon;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
      create table auth.users(id uuid primary key);
      grant usage on schema auth to authenticated, anon;
      insert into auth.users values ('${alice}'),('${bob}');`);
    await db.exec(await readFile(new URL('../supabase/migrations/20261016000000_chess_catalog_votes.sql', import.meta.url), 'utf8'));
    const as = async (user, role='authenticated') => {
      await db.exec('reset role');
      await db.query("select set_config('test.user_id',$1,false)", [user ?? '']);
      await db.exec(`set role ${role}`);
    };
    await as(alice);
    const catalog = plutoCommunityCatalog(true);
    assert.deepEqual((await db.query('select variant_id from list_chess_catalog_votes()')).rows.map(r=>r.variant_id).sort(), catalog.map(e=>e.id).sort());
    for (const entry of catalog) {
      assert.deepEqual((await db.query('select * from vote_chess_catalog_variant($1,1)', [entry.id])).rows[0], {upvotes:1,downvotes:0,my_vote:1});
      assert.equal((await db.query('select * from vote_chess_catalog_variant($1,1)', [entry.id])).rows[0].upvotes, 1);
    }
    const id = catalog.find(e=>e.name === "Janmann's Gambit").id;
    await as(bob);
    assert.deepEqual((await db.query('select * from vote_chess_catalog_variant($1,-1)', [id])).rows[0], {upvotes:1,downvotes:1,my_vote:-1});
    assert.deepEqual((await db.query('select * from vote_chess_catalog_variant($1,1)', [id])).rows[0], {upvotes:2,downvotes:0,my_vote:1});
    assert.deepEqual((await db.query('select * from vote_chess_catalog_variant($1,0)', [id])).rows[0], {upvotes:1,downvotes:0,my_vote:0});
    await assert.rejects(db.query('select * from vote_chess_catalog_variant($1,2)',[id]), /Invalid vote/);
    await assert.rejects(db.query('select * from vote_chess_catalog_variant($1,null)',[id]), /Invalid vote/);
    await assert.rejects(db.query("select * from vote_chess_catalog_variant('unknown',1)"), /Variant not found/);
    await assert.rejects(db.query('select * from chess_catalog_votes'), /permission denied/);
    await as(null,'anon');
    assert.equal((await db.query('select * from list_chess_catalog_votes() where variant_id=$1',[id])).rows[0].my_vote,0);
    await assert.rejects(db.query('select * from vote_chess_catalog_variant($1,1)',[id]), /permission denied/);
  } finally { await db.close(); }
});
test('Pluto and Community show the same Janmann votes and preserve custom voting', async () => {
  const calls=[];
  const id=plutoCommunityCatalog().find(e=>e.name==="Janmann's Gambit").id;
  const client={rpc: async(name,args)=> {
    calls.push([name,args]);
    if(name==='list_chess_catalog_votes') return {data:[{variant_id:id,upvotes:8,downvotes:2,my_vote:1}]};
    if(name==='list_chess_custom_community') return {data:[]};
    return {data:[{upvotes:9,downvotes:2,my_vote:1}]};
  }};
  const service=createCommunityService(client);
  for(const scope of ['pluto','players']) {
    const entry=(await service.list('top','',100,0,scope)).find(e=>e.id===id);
    assert.deepEqual([entry.upvotes,entry.downvotes,entry.score,entry.myVote],[8,2,6,1]);
  }
  for(const entry of plutoCommunityCatalog(true)) {
    await service.vote(entry.id,1);
    assert.deepEqual(calls.at(-1),['vote_chess_catalog_variant',{p_variant_id:entry.id,p_value:1}]);
  }
  await service.vote('published-uuid',-1);
  assert.deepEqual(calls.at(-1),['vote_chess_custom_variant',{p_published_id:'published-uuid',p_value:-1}]);
});
