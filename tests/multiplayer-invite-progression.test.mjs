import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { calculateMatchResult, INITIAL_RATING } from '../src/games/atlas/rankedRating.ts';
import { getRankFromRating } from '../src/games/atlas/ranked.ts';
import { INVITE_GAMES, createInviteRoute } from '../src/components/social/gameCreationCatalog.ts';
import { games } from '../src/data/games.ts';
const require = createRequire(import.meta.url);
function moduleFrom(path, modules) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023, esModuleInterop: true}}).outputText;
  const exports = {}; new Function('require', 'exports', source)(name => modules[name] ?? require(name), exports); return exports;
}
test('five established wins or losses cross a 100-point Bronze division', () => {
  let winner = {...INITIAL_RATING, rating: 800, deviation: 30, matchesPlayed: 40};
  let loser = {...winner, rating: 900};
  for (let i=0;i<5;i++) {
    winner = calculateMatchResult(winner, {...winner}, 'a').a;
    loser = calculateMatchResult(loser, {...loser}, 'b').a;
  }
  assert.equal(winner.rating,900); assert.equal(getRankFromRating(winner.rating).displayName,'Bronze I');
  assert.equal(loser.rating,800); assert.equal(getRankFromRating(loser.rating).displayName,'Bronze II');
  const floor = calculateMatchResult({...loser,rating:100}, loser, 'b').a;
  assert.equal(floor.rating,100);
});
test('game picker covers every game and preserves its selected online settings', () => {
  assert.deepEqual(INVITE_GAMES.map(g=>g.id),games.map(g=>g.route.split('/').at(-1)));
  const modes=id=>INVITE_GAMES.find(g=>g.id===id).modes;
  assert.equal(modes('atlas-arena').length,18);
  assert.deepEqual(modes('atlas-arena').filter(m=>m.id.startsWith('random-')).map(m=>new URL(createInviteRoute(m),'https://local.test').searchParams.get('bestOf')),['1','3','5']);
  assert.ok(modes('chess').some(m=>m.id==='custom-four-kingdoms'));
  assert.equal(modes('pluto-party').length,4);
  assert.match(createInviteRoute(modes('pluto-party')[3]),/map=mountain&victory=coins&create=1/);
  for (const game of INVITE_GAMES) for(const mode of game.modes) assert.doesNotMatch(mode.route,/ranked/);
  assert.equal(modes('go').length,3);
  assert.match(createInviteRoute(modes('go')[2]),/boardSize=19&create=1/);
  assert.match(createInviteRoute(modes('watten')[1]),/variant=four-player&create=1/);
  assert.equal(modes('watten')[1].inviteRoute,'/games/watten/multiplayer/4');
  assert.match(createInviteRoute(modes('eat-it')[1]),/map=nature&create=1/);
  for(const game of INVITE_GAMES) for(const mode of game.modes) assert.equal(new URL(createInviteRoute(mode),'https://local.test').searchParams.get('create'),'1');
});
test('auto creation waits for authentication and settings, consumes its action and runs once', () => {
  let auth = {user: null, loading:false}, ready=false;
  let location = {pathname:'/games/go/multiplayer',search:'?boardSize=19&create=1',key:'one'};
  const refs=[],effects=[],navigations=[];let slot=0,creates=0;
  const mockReact={useRef(value){const index=slot++;return refs[index]??(refs[index]={current:value});},useEffect(effect){effects.push(effect);}};
  const hook=moduleFrom('../src/hooks/useInviteAutoCreate.ts',{'react':mockReact,'@/context/AuthContext':{useAuth:()=>auth},'react-router-dom':{useLocation:()=>location,useNavigate:()=> (...args)=>navigations.push(args)}}).useInviteAutoCreate;
  const render=()=>{slot=0;effects.length=0;hook(()=>creates++,ready);for(const effect of effects)effect();};
  render();assert.equal(creates,0);
  auth={user:{id:'user'},loading:false};render();assert.equal(creates,0);
  ready=true;render();assert.equal(creates,1);
  assert.equal(navigations[0][0].search,'boardSize=19');assert.deepEqual(navigations[0][1],{replace:true});
  location={...location,key:'preset-removal'};render();assert.equal(creates,1);
});
test('created invites only send the actual new room, and retry uses the same message id', async () => {
  const storage = new Map();
  const oldStorage=globalThis.sessionStorage, oldWindow=globalThis.window;
  globalThis.window={setTimeout:()=>0,clearTimeout:()=>{}};
  globalThis.sessionStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
  let effects=[],slot=0;const refs=[],state=[],sent=[],clanShares=[],effectDeps=[];
  const signedUser={id:"me"};
  const routes=moduleFrom('../src/components/social/inviteRoute.ts',{'@/data/chessVariants':{variants:[]}});
  let error={message:'transport error'};
  const mod=moduleFrom('../src/components/social/GameInviteDelivery.tsx',{
    react:{useRef(value){const index=slot++;return refs[index]??(refs[index]={current:value});},useState(value){const index=slot++;if(!(index in state))state[index]=value;return[state[index],next=>{state[index]=typeof next==='function'?next(state[index]):next;}];},useEffect(effect,deps){const index=slot++;const previous=effectDeps[index];if(!previous||deps.some((value,i)=>value!==previous[i]))effects.push(effect);effectDeps[index]=deps;}},
    'react-router-dom':{Link:()=>null,useLocation:()=>({pathname:'',search:''})},
    '@/context/AuthContext':{useAuth:()=>({user:signedUser})},
    '@/lib/supabase':{supabase:{from:()=>({insert:async message=>{sent.push(message);return {error};}})}},
    './inviteRoute':routes,
    './clanShare':{shareRoomWithClan:async (...args)=>{clanShares.push(args);return {error:null};}},
  });
  const render=async room=>{slot=0;effects=[];const result=mod.useCreatedGameInvite(room);for(const effect of effects)effect();await new Promise(resolve=>setImmediate(resolve));return result;};
  try {
    mod.prepareCreatedGameInvite({userId:'me',friendId:'friend',route:'/games/go/multiplayer'});
    await render({lobbyRoute:'/games/go/multiplayer',code:'OLD123'});assert.equal(sent.length,0);
    mod.recordCreatedGameInvite('/games/go/multiplayer/NEW123');
    await render({lobbyRoute:'/games/go/multiplayer',code:'NEW123'});assert.equal(sent.length,1);
    const result=await render({lobbyRoute:'/games/go/multiplayer',code:'NEW123'});assert.equal(result.failed,true);
    error={code:'23505'};result.retry();await render({lobbyRoute:'/games/go/multiplayer',code:'NEW123'});
    assert.equal(sent.length,2);assert.equal(sent[0].id,sent[1].id);assert.ok(sent[0].id);
    assert.equal(sent[0].receiver_id,'friend');assert.equal(sent[0].game_code,'NEW123');assert.equal(storage.size,0);
    mod.prepareCreatedGameInvite({userId:'me',clanId:'clan',route:'/games/pluto-party'});
    mod.recordCreatedGameInviteCode('PLUTO-123456','/games/pluto-party');
    await render({lobbyRoute:'/games/pluto-party',code:'PLUTO-123456'});
    assert.deepEqual(clanShares,[['clan','PLUTO-123456','/games/pluto-party']]);
    assert.equal(storage.size,0);assert.equal(sent.length,2);
  } finally {globalThis.sessionStorage=oldStorage;globalThis.window=oldWindow;}
});
test('database assigns rank difficulty and rejects custom clan messages and nonmembers', async () => {
  const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();
  const A='00000000-0000-0000-0000-0000000000a1',B='00000000-0000-0000-0000-0000000000b2',C='00000000-0000-0000-0000-0000000000c3';
  await db.exec(`create schema auth;create role authenticated;create role anon;create role service_role;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user',true),'')::uuid$$;
    create table public.community_group_members(group_id uuid,user_id uuid);
    create table public.community_group_messages(id uuid default gen_random_uuid(),group_id uuid,sender_id uuid,body text,created_at timestamptz default now());
    create table public.atlas_ranked_profiles(user_id uuid,rating double precision);
    create table public.atlas_matches(id uuid default gen_random_uuid(),players jsonb,match_kind text,settings jsonb);`);
  await db.exec(readFileSync(new URL('../supabase/migrations/20261022000000_social_presets_atlas_progression.sql',import.meta.url),'utf8'));
  await db.query('insert into atlas_ranked_profiles values($1,800),($2,900)',[A,B]);
  const insert=kind=>db.query(`insert into atlas_matches(players,match_kind,settings) values ($1::jsonb,$2,'{"difficulty":"expert","rounds":10}') returning settings`,[JSON.stringify([{id:A},{id:B}]),kind]);
  assert.equal((await insert('ranked')).rows[0].settings.difficulty,'beginner');
  await db.query('update atlas_ranked_profiles set rating=1500');assert.equal((await insert('ranked')).rows[0].settings.difficulty,'intermediate');
  await db.query('update atlas_ranked_profiles set rating=2100');assert.equal((await insert('ranked')).rows[0].settings.difficulty,'expert');
  assert.equal((await insert('casual')).rows[0].settings.difficulty,'expert');
  await db.query(`select set_config('app.user',$1,false)`,[A]);await db.query('insert into community_group_members values($1,$2)',[C,A]);
  for(const body of ['Hey','You want to play?','Yes','No'])await db.query('select send_community_group_message($1,$2)',[C,body]);
  await assert.rejects(db.query('select send_community_group_message($1,$2)',[C,'custom message']),/preset/);
  await assert.rejects(db.query('select send_community_group_message($1,$2)',[C,null]),/preset/);
  await db.query(`select set_config('app.user',$1,false)`,[B]);await assert.rejects(db.query('select send_community_group_message($1,$2)',[C,'Hey']),/Join this clan/);
  assert.equal((await db.query('select count(*)::int as count from community_group_messages')).rows[0].count,4);
  await db.close();
});
