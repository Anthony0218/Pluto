import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createInitialFourPlayerState, applyFourPlayerMove, getFourPlayerLegalMoves } from '../src/games/chess/variants/fourPlayerChess.ts';
let PGlite;
try { ({ PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')); } catch { /* Optional local PostgreSQL harness. */ }
const host='00000000-0000-0000-0000-000000000001', guest='00000000-0000-0000-0000-000000000002', outsider='00000000-0000-0000-0000-000000000003', room='00000000-0000-0000-0000-000000000011';

test('mixed chess RPCs, favorite-game isolation and variant invite constraints', {skip:!PGlite}, async () => {
 const db=new PGlite();
 await db.exec(`create schema auth; create role authenticated; create role anon;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
 create table auth.users(id uuid primary key);
 create table public.friend_messages(id uuid,game text,message_type text);
 create table public.variant_rooms(id uuid primary key,host_id uuid,variant text,status text);
 create table public.variant_room_players(room_id uuid,user_id uuid,chosen_color text);
 create table public.variant_games(room_id uuid primary key,state jsonb,state_history jsonb,moves text[] default '{}',version integer default 0,
 status text,winner text,end_reason text,last_action_user_id uuid,last_action_kind text,undo_requested_by uuid,undo_requested_version integer,
 undo_votes uuid[] default '{}',rematch_ready uuid[] default '{}',fen text,last_move_from text,last_move_to text,
 undo_previous_fen text,undo_previous_state jsonb,undo_previous_last_from text,undo_previous_last_to text);
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 insert into auth.users values ('${host}'),('${guest}'),('${outsider}');`);
 for(const file of ['20260926120000_chess_social_preferences.sql','20260926130000_four_player_bots.sql','20260926140000_roulette_king_effects.sql'])await db.exec(await fs.readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 const as=async id=>db.query("select set_config('test.user_id',$1,false)",[id]);
 await as(host);
 const initial=createInitialFourPlayerState();
 await db.query('insert into variant_rooms values ($1,$2,$3,$4,$5)',[room,host,'four-player','waiting',[]]);
 await db.query('insert into variant_room_players values ($1,$2,$3),($1,$4,$5)',[room,host,'red',guest,'blue']);
 await db.query('insert into variant_games(room_id,state,state_history,status) values ($1,$2,$3,$4)',[room,initial,[initial],'waiting']);
 await as(guest);await assert.rejects(db.query('select start_four_player_with_bots($1,$2)',[room,['yellow','green']]));
 await as(host);await assert.rejects(db.query('select start_four_player_with_bots($1,$2)',[room,['red','green']]));
 await db.query('select start_four_player_with_bots($1,$2)',[room,['yellow','green']]);
 await assert.rejects(db.query('select start_four_player_with_bots($1,$2)',[room,['yellow','green']]));
 const getGame=async()=>(await db.query('select * from variant_games where room_id=$1',[room])).rows[0];
 function firstMove(state) {
  for(let row=0;row<14;row++)for(let column=0;column<14;column++)if(state.board[row][column]?.color===state.turn){
   const from={row,column};const to=getFourPlayerLegalMoves(state,from)[0];if(to)return {from,to,next:applyFourPlayerMove(state,from,to)};
  }
  throw Error('No legal move');
 }
 async function play(user,expectedFailure=false) {
  const game=await getGame(),{from,to,next}=firstMove(game.state);await as(user);
  const call=db.query('select play_four_player_mixed_move($1,$2,$3,$4,$5,$6)',[room,from,to,'test move',next,game.version]);
  if(expectedFailure)await assert.rejects(call);else await call;
 }
 await play(guest,true);await play(outsider,true);await play(host);await play(guest);
 await play(guest,true);await play(host);await play(host);
 let game=await getGame();assert.equal(game.state.turn,'red');assert.equal(game.moves.length,4);
 const move=firstMove(game.state);await assert.rejects(db.query('select play_four_player_mixed_move($1,$2,$3,$4,$5,$6)',[room,move.from,move.to,'stale',move.next,0]));
 await as(guest);await db.query("select four_player_mixed_action($1,'undo-request')",[room]);
 await play(host,true);await as(host);await db.query("select four_player_mixed_action($1,'undo-response',true)",[room]);
 game=await getGame();assert.equal(game.moves.length,1);assert.equal(game.state.turn,'blue');assert.equal(game.undo_requested_by,null);
 // Rematches need human votes only and retain configured bots.
 await db.query("update variant_games set status='finished' where room_id=$1",[room]);
 await db.query("select four_player_mixed_action($1,'rematch')",[room]);
 assert.equal((await getGame()).status,'finished');await as(guest);await db.query("select four_player_mixed_action($1,'rematch')",[room]);
 game=await getGame();assert.equal(game.status,'playing');assert.deepEqual(game.state,initial);assert.deepEqual(game.moves,[]);
 assert.deepEqual((await db.query('select bot_colors from variant_rooms')).rows[0].bot_colors,['yellow','green']);
 await as(host);await db.exec('set role authenticated');
 await db.query('select set_favorite_games($1)',[['/games/chess','/games/watten','/games/natura']]);
 await assert.rejects(db.query('select set_favorite_games($1)',[['/games/a','/games/b','/games/c','/games/d']]));
 await assert.rejects(db.query('select set_favorite_games($1)',[['/games/chess','/games/chess']]));
 assert.equal((await db.query('select * from user_game_favorites')).rows.length,3);
 await as(guest);assert.equal((await db.query('select * from user_game_favorites')).rows.length,0);
 await db.query('select set_favorite_games($1)',[['/games/watten']]);assert.equal((await db.query('select * from user_game_favorites')).rows.length,1);
 await db.exec('reset role');
 await db.query("insert into friend_messages(game,message_type,game_route) values ('chess','game_code',$1)",['/games/chess/variants/roulette/multiplayer']);
 await assert.rejects(db.query("insert into friend_messages(game,message_type,game_route) values ('chess','game_code',$1)",['https://untrusted.invalid']));
 // Retained turns are legal only for the king bonus, with version and seat checks.
 const roulette='00000000-0000-0000-0000-000000000012';
 const before='7k/7p/8/8/4K3/8/P7/8 w - - 0 1', after='7k/7p/8/4K3/8/8/P7/8 w - - 1 1';
 await db.query('insert into variant_rooms(id,host_id,variant,status) values ($1,$2,$3,$4)',[roulette,host,'roulette','playing']);
 await db.query('insert into variant_room_players values ($1,$2,$3),($1,$4,$5)',[roulette,host,'white',guest,'black']);
 await db.query('insert into variant_games(room_id,state,fen,status) values ($1,$2,$3,$4)',[roulette,{records:[],portalState:{seed:1,portals:[],events:[]}},before,'playing']);
 const state={portalState:{seed:1,portals:[],events:[]},records:[{fenBefore:before,fenAfter:after,from:'e4',to:'e5',color:'w',portalEvent:{piece:'k',result:'extra-turn'}}]};
 await as(guest);await assert.rejects(db.query('select play_roulette_move_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[roulette,'e4','e5','Ke5',after,state,0,false,null,null]));
 await as(host);
 const invalid=structuredClone(state);invalid.records[0].portalEvent=null;
 await assert.rejects(db.query('select play_roulette_move_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[roulette,'e4','e5','Ke5',after,invalid,0,false,null,null]));
 await db.query('select play_roulette_move_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[roulette,'e4','e5','Ke5',after,state,0,false,null,null]);
 const saved=(await db.query('select * from variant_games where room_id=$1',[roulette])).rows[0];
 assert.equal(saved.fen,after);assert.equal(saved.undo_previous_fen,before);assert.equal(saved.version,1);
 await assert.rejects(db.query('select play_roulette_move_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[roulette,'e4','e5','Ke5',after,state,0,false,null,null]));
 await db.close();
});
