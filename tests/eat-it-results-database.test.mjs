import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
test('result migration preserves old rows, persists Hell stats, records draws and remains idempotent',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create table user_game_results(game text,source_id text,user_id uuid,outcome text check(outcome in ('win','loss','draw')),multiplayer boolean,details jsonb,unique(game,source_id,user_id));create table eat_it_matches(id int,status text,players jsonb,game_state jsonb);insert into user_game_results values('eat-it','old','00000000-0000-4000-8000-000000000001','win',true,'{"mass":90}');`);
 await db.exec(readFileSync(new URL('../supabase/migrations/20260930000000_eat_it_hell_results.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../supabase/migrations/20261001000000_eat_it_match_settings.sql',import.meta.url),'utf8'));
 await db.exec('create trigger results after update on eat_it_matches for each row execute function record_eat_it_result()');
 const id='00000000-0000-4000-8000-000000000001';
 const state={settings:{matchDuration:1200,animalsEnabled:false,hellEnabled:true,livesEnabled:false,botDifficulty:'medium'},id:'new',result:'tie',tiedIds:[id],winnerId:null,time:220,map:'city',hell:{startedAt:180},timeline:[{type:'hellStart',at:180}],players:[{id,placement:1,mass:36,lives:0,foodEaten:5,playersEaten:1,stats:{collected:{apple:12,multiplier:1,divider:1},growthActivations:1,totalGrowth:250,hostileAttacks:3,plutos:3,hellTime:38,fellInLava:true}}]};
 await db.query('insert into eat_it_matches values(1,$1,$2,$3)',['playing',JSON.stringify([{id}]),JSON.stringify(state)]);
 await db.exec("update eat_it_matches set status='finished';update eat_it_matches set status='finished';");
 const rows=(await db.query('select * from user_game_results order by source_id')).rows;assert.equal(rows.length,2);assert.equal(rows[0].outcome,'draw');assert.equal(rows[0].details.stats.plutos,3);assert.deepEqual(rows[0].details.stats.collected,state.players[0].stats.collected);assert.equal(rows[0].details.stats.growthActivations,1);assert.equal(rows[0].details.settings.matchDuration,1200);assert.deepEqual(rows[0].details.settings,state.settings);assert.equal(rows[0].details.startingLives,1);assert.equal(rows[0].details.schemaVersion,3);assert.equal(rows[0].details.timeline[0].type,'hellStart');assert.deepEqual(rows[1].details,{mass:90});
 }finally{await db.close()}
});
