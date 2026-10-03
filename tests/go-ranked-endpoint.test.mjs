import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { database } from './helpers/ranked-database.mjs';
import * as rules from '../src/games/go/rules.ts';
import * as config from '../src/games/go/ranked/config.ts';
const compiled=ts.transpileModule(readFileSync(new URL('../supabase/functions/ranked-go/index.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;
async function server() {
  const { db, users } = await database(['20261020000000_go_ranked.sql']);
  for (const id of users) await db.query('insert into profiles(id,username,avatar_id) values($1,$2,$3)',[id,'Player','m1']);
  let handler;
  const client={auth:{getUser:async token=>({data:{user:users.includes(token)?{id:token}:null}})},
    async rpc(name,args) {
      assert.ok(['go_ranked_queue_action','go_ranked_action'].includes(name));
      const keys=Object.keys(args),values=Object.values(args);
      try {return {data:(await db.query(`select ${name}(${keys.map((k,i)=>k+' => $'+(i+1)).join(',')}) r`,values)).rows[0].r,error:null};}
      catch(error){return {data:null,error:{message:error.message}};}
    },
    from(table) {
      assert.ok(['go_ranked_games','go_ratings','profiles'].includes(table));
      const filters=[];const values=[];
      const q={select(){return q},eq(k,v){values.push(v);filters.push(`${k}=$${values.length}`);return q},in(k,v){values.push(v);filters.push(`${k}=any($${values.length}::uuid[])`);return q},
        async run(single=false){const rows=(await db.query(`select * from ${table}${filters.length?' where '+filters.join(' and '):''}`,values)).rows;return {data:single?rows[0]??null:rows,error:null}},
        maybeSingle(){return q.run(true)},then(a,b){return q.run().then(a,b)}};
      return q;
    },
  };
  new Function('require','Deno','exports',compiled)(name=>name.includes('supabase-js')?{createClient:()=>client}:name.includes('rules')?rules:config,{env:{get:()=>''},serve:fn=>{handler=fn}},{});
  const request=async (id,body)=>{const res=await handler(new Request('http://localhost/ranked-go',{method:'POST',headers:id?{Authorization:`Bearer ${id}`}:{},body:JSON.stringify(body)}));return {status:res.status,body:await res.json()}};
  const queue=async (i,mode='normal')=>request(users[i],{op:'queue',sessionId:crypto.randomUUID(),timeControl:mode});
  return {db,users,request,queue};
}
test('actual Go service + PostgreSQL: queue, ready, verified moves, authoritative score, rating settlement and retries',async()=>{
  const {db,users,request,queue}=await server();
  try {
    assert.equal((await request(null,{op:'queue'})).status,401);
    assert.equal((await request('invalid',{op:'queue'})).status,401);
    assert.equal((await request(users[0],{op:'queue',sessionId:crypto.randomUUID(),timeControl:'classical'})).status,400);
    for (const mode of ['bullet','rapid']) assert.equal((await queue(0,mode)).status,400);
    assert.equal((await queue(0,'blitz')).body.status,'waiting');const paired=await queue(1,'blitz');assert.equal(paired.body.status,'matched');
    const code=paired.body.code;
    assert.equal((await request(users[2],{op:'ready',code})).status,403);
    await request(users[0],{op:'ready',code});let current=(await request(users[1],{op:'ready',code})).body;
    assert.equal(current.game.status,'playing');assert.equal(current.players.length,2);assert.ok(current.players.every(p=>p.rating===1200));
    const b=current.game.black_id,w=current.game.white_id;
    assert.equal((await request(w,{op:'move',code,version:current.game.version,move:{type:'place',row:1,col:1}})).status,400);
    assert.equal((await request(b,{op:'move',code,version:current.game.version,move:{type:'place',row:0.5,col:1}})).status,400);
    assert.equal((await request(b,{op:'move',code,version:current.game.version,move:{type:'resign'}})).status,400);
    const move={op:'move',code,version:current.game.version,move:{type:'place',row:4,col:4},winner:'white',state:{status:'finished'},black_time_ms:1e10,black_period_ms:1e10,black_periods_remaining:999,byo_yomi_ms:1e10};
    const raced=await Promise.all([request(b,move),request(b,move)]);
    assert.equal(raced.filter(r=>r.status===200).length,1);assert.equal(raced.filter(r=>r.status===409||r.status===400).length,1);
    current=(await request(b,{op:'snapshot',code})).body;assert.equal(current.game.state.moveHistory.length,1);assert.equal(current.game.winner,null);assert.ok(current.game.black_time_ms<=30000);assert.equal(current.game.black_periods_remaining,5);assert.equal(current.game.black_period_ms,10000);assert.equal(current.game.byo_yomi_ms,10000);
    current=(await request(w,{op:'move',code,version:current.game.version,move:{type:'pass'}})).body;
    current=(await request(b,{op:'move',code,version:current.game.version,move:{type:'pass'}})).body;
    assert.equal(current.game.status,'finished');assert.equal(current.game.winner,'black');assert.equal(current.result.black_after,1216);assert.equal(current.result.white_after,1184);
    assert.equal((await request(b,{op:'move',code,version:1,move:{type:'pass'}})).status,200);
    assert.equal((await db.query('select count(*)::int n from ranked_go_matches')).rows[0].n,1);
    assert.equal((await db.query('select count(*)::int n from user_game_results')).rows[0].n,2);
    assert.ok(rules.applyGoMove(rules.createInitialGoState(),{type:'place',row:4,col:4}));
  }finally{await db.close();}
});
test('Go service supports off-turn resignation, restores result/review state on reload and rejects client-claimed jigo',async()=>{
  const {db,users,request,queue}=await server();
  try {
    await queue(0);const {body:{code}}=await queue(1);
    await request(users[0],{op:'ready',code});let current=(await request(users[1],{op:'ready',code})).body;
    current=(await request(current.game.black_id,{op:'move',code,version:current.game.version,move:{type:'pass'},winner:'draw'})).body;
    assert.equal(current.game.status,'playing');assert.equal(current.game.winner,null);
    const done=await request(current.game.black_id,{op:'resign',code,version:current.game.version});
    assert.equal(done.status,200);assert.equal(done.body.game.winner,'white');assert.equal(done.body.game.end_reason,'resignation');
    const restored=await request(users[0],{op:'ready',code});assert.deepEqual(restored.body.result,done.body.result);assert.equal(restored.body.game.state.status,'finished');assert.equal(restored.body.game.state.moveHistory.length,1);
  }finally{await db.close();}
});
