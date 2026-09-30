import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { Chess } from 'chess.js';
const source=readFileSync(new URL('../supabase/functions/ranked-chess/index.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;
function server(ranked=true){
 let handler,clockReads=0;
 const room={id:'room',code:'ABC123',host_id:'white',match_kind:ranked?'ranked':'casual',status:'playing'};
 const game={room_id:'room',fen:new Chess().fen(),moves:[],version:0,ranked_round:1,status:'playing',winner:null,undo_requested_by:null};
 const players=[{room_id:'room',user_id:'white',seat:0,chosen_color:'white'},{room_id:'room',user_id:'black',seat:1,chosen_color:'black'}];
 const db={auth:{getUser:async token=>({data:{user:token?{id:token}:null}})},rpc:async name=>{
  if(name==='ranked_clock_snapshot'){clockReads++;return {data:{game:structuredClone(game),serverNow:new Date().toISOString()}}}
  return {data:null,error:null};
 },from(table){let update;const predicates=[];
  const q={select(){return q},eq(k,v){predicates.push(r=>r[k]===v);return q},update(v){update=v;return q},delete(){return q},
   async run(single=false){let rows=table==='chess_rooms'?[room]:table==='chess_room_players'?players:table==='chess_games'?[game]:[];
    rows=rows.filter(r=>predicates.every(p=>p(r)));if(update)rows.forEach(r=>Object.assign(r,structuredClone(update)));
    return {data:structuredClone(single?rows[0]??null:rows),error:null};
   },single(){return q.run(true)},maybeSingle(){return q.run(true)},then(a,b){return q.run().then(a,b)}};return q;
 }};
 new Function('require','Deno','exports',compiled)(name=>name.includes('supabase-js')?{createClient:()=>db}:{Chess},{env:{get:()=>''},serve:fn=>{handler=fn}},{});
 const request=async(user,body)=>{const res=await handler(new Request('http://localhost/ranked-chess',{method:'POST',headers:user?{Authorization:`Bearer ${user}`}:{},body:JSON.stringify({code:'ABC123',round:1,...body})}));return {status:res.status,body:await res.json()}};
 return {game,room,request,get clockReads(){return clockReads}};
}
for(const ranked of [true,false])test(`${ranked?'ranked':'casual'} server validates legal intent, ownership, version and ignores supplied FEN/results`,async()=>{
 const s=server(ranked),op=ranked?'move':'casualMove';
 assert.equal((await s.request(null,{op})).status,401);
 assert.equal((await s.request('outsider',{op,version:0,from:'e2',to:'e4'})).status,403);
 assert.equal((await s.request('black',{op,version:0,from:'e7',to:'e5'})).status,400);
 assert.equal((await s.request('white',{op,version:0,from:'e2',to:'e5'})).status,400);
 const results=await Promise.all([0,1].map(()=>s.request('white',{op,version:0,from:'e2',to:'e4',fen:'hacked',winner:'white',status:'finished',white_time_ms:1e10})));
 assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.status===409).length,1);
 assert.deepEqual(s.game.moves,['e4']);assert.equal(s.game.status,'playing');assert.equal(s.game.fen.split(' ')[1],'b');
 const response=await s.request('black',{op,version:1,from:'e7',to:'e5'});assert.equal(response.status,200);assert.deepEqual(response.body.game.moves,['e4','e5']);assert.equal(s.game.version,2);
 assert.equal(s.clockReads>0,ranked);
});
test('casual request cannot enter ranked clocks or skip ranked validation',async()=>{
 const casual=server(false);assert.equal((await casual.request('white',{op:'clock'})).status,404);
 const ranked=server(true);assert.equal((await ranked.request('white',{op:'casualMove',version:0,from:'e2',to:'e4'})).status,400);
});

test('undo prompts and declines advance the version without allowing repeated requests',async()=>{
 const s=server();
 await s.request('white',{op:'move',version:0,from:'e2',to:'e4'});
 const ask=await s.request('white',{op:'requestUndo',version:1});
 assert.equal(ask.status,200);assert.equal(s.game.version,2);assert.equal(s.game.undo_requested_version,2);
 assert.equal((await s.request('black',{op:'move',version:1,from:'e7',to:'e5'})).status,409);
 const no=await s.request('black',{op:'respondUndo',version:2,accept:false});
 assert.equal(no.status,200);assert.equal(s.game.version,3);assert.equal(s.game.undo_requested_by,null);
 assert.equal((await s.request('white',{op:'requestUndo',version:3})).status,400);
 assert.equal((await s.request('black',{op:'move',version:3,from:'e7',to:'e5'})).status,200);
 assert.equal((await s.request('black',{op:'requestUndo',version:4})).status,200);
 assert.equal((await s.request('white',{op:'respondUndo',version:5,accept:true})).status,200);
 assert.equal(s.game.version,6);assert.deepEqual(s.game.moves,['e4']);assert.equal(s.game.undo_requested_by,null);
});
test('a move racing an undo request commits at most one mutation',async()=>{
 const s=server();await s.request('white',{op:'move',version:0,from:'e2',to:'e4'});
 const results=await Promise.all([
  s.request('white',{op:'requestUndo',version:1}),
  s.request('black',{op:'move',version:1,from:'e7',to:'e5'}),
 ]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 assert.equal(s.game.version,2);
 if(s.game.undo_requested_by)assert.equal(s.game.undo_requested_version,s.game.version);
});

test('a delayed prior-round move is rejected even when the rematch resets its version',async()=>{
 for(const ranked of [true,false]){
  const s=server(ranked),op=ranked?'move':'casualMove';s.game.ranked_round=2;
  assert.equal((await s.request('white',{op,version:0,round:1,from:'e2',to:'e4'})).status,409);
  assert.deepEqual(s.game.moves,[]);
  assert.equal((await s.request('white',{op,version:0,round:2,from:'e2',to:'e4'})).status,200);
 }
});
