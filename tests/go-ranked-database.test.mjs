import { readFileSync } from "node:fs";
import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from './helpers/ranked-database.mjs';
import { applyGoMove, createInitialGoState } from '../src/games/go/rules.ts';
import { GO_RANKED_TIME_CONTROLS, isTop10 } from '../src/games/go/ranked/config.ts';
import { ratedPair } from '../src/games/chess/ranked/elo.ts';
async function setup() {
  const context = await database(['20261020000000_go_ranked.sql']);
  const { db, users } = context;
  for (const id of users) await db.query('insert into profiles(id,username) values($1,$2)', [id, `Player ${id}`]);
  const queue = async (i, session, op = 'queue', mode = 'normal') => (await db.query('select go_ranked_queue_action($1,$2,$3,$4,$5,$6) r', [users[i], session, op, 'Player', mode, createInitialGoState()])).rows[0].r;
  const action = async (id, i, op = 'snapshot', version = null, state = null, reason = null) => (await db.query('select go_ranked_action($1,$2,$3,$4,$5,$6) r', [id, users[i], op, version, state, reason])).rows[0].r;
  const match = async (mode = 'normal') => {
    await queue(0, crypto.randomUUID(), 'queue', mode);
    const found = await queue(1, crypto.randomUUID(), 'queue', mode);
    const g = (await db.query('select * from go_ranked_games where code=$1', [found.code])).rows[0];
    await action(g.id, 0, 'ready'); await action(g.id, 1, 'ready');
    return (await action(g.id, 0)).game;
  };
  return { ...context, queue, action, match };
}
test('migration creates independent default Go ratings for existing and new users, and central clocks agree', async () => {
  const { db, users } = await database();
  try {
    await db.query('insert into chess_ratings(user_id,rating,peak_rating) values($1,2000,2000)', [users[0]]);
    await db.exec(readFileSync(new URL('../supabase/migrations/20261020000000_go_ranked.sql',import.meta.url),'utf8').replace(/select cron.schedule\([^;]+;/,''));
    const rows = (await db.query('select * from go_ratings')).rows;
    assert.equal(rows.length, 8); assert.ok(rows.every(r => r.rating === 1200 && r.rated_games === 0));
    const id = crypto.randomUUID(); await db.query('insert into auth.users values($1)', [id]);
    assert.equal((await db.query('select count(*)::int n from go_ratings where user_id=$1', [id])).rows[0].n, 2);
    assert.equal((await db.query('select rating from chess_ratings where user_id=$1', [users[0]])).rows[0].rating, 2000);
    assert.equal((await db.query('select rating from go_ratings where user_id=$1 limit 1', [users[0]])).rows[0].rating, 1200);
    for (const c of (await db.query('select * from go_ranked_time_controls')).rows) {
      const config = GO_RANKED_TIME_CONTROLS[c.id];
      assert.equal(c.initial_ms, config.initialMs);assert.equal(c.byo_yomi_ms,config.byoYomiMs);assert.equal(c.byo_yomi_periods,config.byoYomiPeriods);
    }
    await assert.rejects(db.exec("insert into go_ranked_time_controls(id,initial_ms,byo_yomi_ms,byo_yomi_periods) values('rapid',600000,10000,3)"),/check constraint/);
  } finally { await db.close(); }
});
for (const mode of ['blitz','normal']) test(`${mode} queue matches only its mode, replaces incompatible own queues, restores matches and tombstones cancelled sessions`, async () => {
  const { db, queue, action, users } = await setup();
  try {
    const cancelled = crypto.randomUUID(); await queue(0, cancelled, 'leaveQueue', mode);
    assert.equal((await queue(0, cancelled, 'queue', mode)).status, 'idle');
    const a = crypto.randomUUID(), b = crypto.randomUUID();
    const other = mode === 'blitz' ? 'normal' : 'blitz';
    assert.equal((await queue(0, a, 'queue', mode)).status, 'waiting');
    assert.equal((await queue(1, b, 'queue', other)).status, 'waiting');
    assert.equal((await queue(0, a, 'queueStatus', other)).timeControl, mode);
    const found = await queue(1, b, 'queue', mode); assert.equal(found.status, 'matched');
    const g = (await db.query('select * from go_ranked_games')).rows[0];
    assert.equal(g.black_time_ms, GO_RANKED_TIME_CONTROLS[mode].initialMs);
    assert.equal(g.byo_yomi_ms,GO_RANKED_TIME_CONTROLS[mode].byoYomiMs);
    assert.equal(g.black_period_ms,g.byo_yomi_ms);assert.equal(g.white_period_ms,g.byo_yomi_ms);
    assert.equal(g.black_periods_remaining,GO_RANKED_TIME_CONTROLS[mode].byoYomiPeriods);assert.equal(g.white_periods_remaining,g.black_periods_remaining);
    assert.equal(g.white_time_ms, g.black_time_ms); assert.equal(g.clock_started_at, null);
    assert.deepEqual(new Set([g.black_id,g.white_id]), new Set(users.slice(0,2)));
    await queue(0, a, 'leaveQueue', mode);
    assert.equal((await queue(0, crypto.randomUUID(), 'queueStatus', mode)).code, found.code);
    await action(g.id, 0, 'ready'); const start = await action(g.id, 1, 'ready');
    assert.equal(start.game.status,'playing'); assert.ok(start.game.clock_started_at);
    await queue(2, crypto.randomUUID(), 'queue', mode);
    await db.exec("update ranked_go_queue set last_seen_at=clock_timestamp()-interval '13 seconds'");
    await db.exec('select maintain_ranked_go()'); assert.equal((await db.query('select count(*)::int n from ranked_go_queue')).rows[0].n,0);
    // Chess owns shared lease garbage collection. Its maintenance must remain
    // safe even when it runs before Go has removed an expired queue entry.
    const stale=crypto.randomUUID();await queue(2,stale,'queue',mode);
    await db.query("update ranked_chess_queue_sessions set touched_at=clock_timestamp()-interval '2 days' where id=$1",[stale]);
    await db.exec('select maintain_ranked_chess()');
    assert.equal((await db.query('select count(*)::int n from ranked_go_queue')).rows[0].n,0);
  } finally { await db.close(); }
});
test('Chess and Go searches and active games mutually exclude each other in both directions', async () => {
  const { db, queue, act, match } = await setup();
  try {
    const s = crypto.randomUUID(); await act(0,s,'queue','blitz');
    await assert.rejects(queue(0,crypto.randomUUID(),'queue','blitz'), /Chess ranked/);
    await act(0,s,'leaveQueue','blitz');
    const go = crypto.randomUUID(); await queue(0,go,'queue','blitz');
    await assert.rejects(act(0,crypto.randomUUID(),'queue','blitz'), /Go ranked/);
    await queue(0,go,'leaveQueue','blitz');
    await match(); await assert.rejects(act(0,crypto.randomUUID(),'queue','rapid'),/Go ranked/);
  } finally { await db.close(); }
});
for (const reason of ['resignation','area score','jigo','timeout']) test(`${reason} result uses Chess Elo, persists history atomically and settles exactly once`, async () => {
  const { db, users, match, action } = await setup();
  try {
    const g = await match('blitz'), black = users.indexOf(g.black_id);
    await db.query('insert into chess_ratings(user_id,rating,peak_rating) values($1,1900,1900)',[g.black_id]);
    let done;
    if (reason === 'timeout') {
      await db.query("update go_ranked_games set clock_started_at=clock_timestamp()-interval '301 seconds' where id=$1",[g.id]);
      done = await action(g.id,black);
    } else if (reason === 'resignation') done = await action(g.id,black,'resign',g.version);
    else {
      // Exercise settlement of server-verified normal win and draw intents.
      const next = { ...applyGoMove(applyGoMove(g.state,{type:'pass'}),{type:'pass'}), winner: reason==='jigo'?'draw':'white' };
      done = await action(g.id,black,'move',g.version,next,reason);
    }
    assert.equal(done.game.status,'finished'); assert.equal(done.game.end_reason,reason);
    const expected = ratedPair(1200,1200,0,0,reason==='jigo'?'draw':'white');
    assert.equal(done.result.black_after,expected.black); assert.equal(done.result.white_after,expected.white);
    assert.equal((await db.query('select rating from chess_ratings where user_id=$1',[g.black_id])).rows[0].rating,1900);
    for (let i=0;i<4;i++) await action(g.id,black,'resign',g.version);
    await db.exec('select maintain_ranked_go()');
    const ratings=(await db.query("select * from go_ratings where time_control='blitz' and user_id=any($1::uuid[])",[users.slice(0,2)])).rows;
    assert.ok(ratings.every(r=>r.rated_games===1));
    assert.equal(ratings.reduce((n,r)=>n+r.draws,0),reason==='jigo'?2:0);
    assert.ok((await db.query("select * from go_ratings where time_control<>'blitz'")).rows.every(r=>r.rated_games===0));
    assert.equal((await db.query('select count(*)::int n from ranked_go_matches')).rows[0].n,1);
    const ledger=(await db.query("select * from user_game_results where game='go'")).rows;
    assert.equal(ledger.length,2);assert.ok(ledger.every(r=>r.details.reason===reason && r.details.ranked && r.details.code===g.code));
  } finally { await db.close(); }
});
test('stale moves, unauthorized actions and expired-clock move races cannot alter the authoritative position', async () => {
  const { db, users, action, match } = await setup();
  try {
    const g=await match(), b=users.indexOf(g.black_id),w=users.indexOf(g.white_id);
    const next=applyGoMove(g.state,{type:'place',row:4,col:4});
    await assert.rejects(action(g.id,2),/Game not found/);
    await assert.rejects(action(g.id,w,'move',g.version,next),/Not your turn/);
    const moved=await action(g.id,b,'move',g.version,next);assert.equal(moved.game.version,g.version+1);
    await assert.rejects(action(g.id,w,'move',g.version,applyGoMove(next,{type:'pass'})),/Stale position/);
    const clock=moved.game.black_time_ms;
    await action(g.id,b); assert.equal((await action(g.id,b)).game.black_time_ms,clock);
    await db.query("update go_ranked_games set clock_started_at=clock_timestamp()-interval '601 seconds' where id=$1",[g.id]);
    const done=await action(g.id,w,'move',moved.game.version,applyGoMove(next,{type:'pass'}));
    assert.equal(done.game.end_reason,'timeout');assert.equal(done.game.winner,'black');assert.equal(done.game.state.moveHistory.length,1);
    await db.exec("select set_config('request.jwt.claim.role','authenticated',false)");
    await assert.rejects(action(g.id,b),/Service only/);
  } finally { await db.close(); }
});
test('abandonment before both players connect is unrated; disconnected live players time out without browsers', async () => {
  const { db, queue, action, match } = await setup();
  try {
    await queue(0,crypto.randomUUID());await queue(1,crypto.randomUUID());
    const g=(await db.query('select * from go_ranked_games')).rows[0];
    await db.query("update go_ranked_games set created_at=clock_timestamp()-interval '31 seconds' where id=$1",[g.id]);
    await db.exec('select maintain_ranked_go()');assert.equal((await action(g.id,0)).game.status,'abandoned');
    assert.equal((await db.query('select count(*)::int n from ranked_go_matches')).rows[0].n,0);
    const live=await match();await db.query("update go_ranked_games set clock_started_at=clock_timestamp()-interval '601 seconds' where id=$1",[live.id]);
    await db.exec('select maintain_ranked_go()');assert.equal((await action(live.id,0)).game.end_reason,'timeout');
    assert.equal((await db.query('select count(*)::int n from ranked_go_matches')).rows[0].n,1);
  } finally { await db.close(); }
});
test('leaderboard exact ranks use Chess ties, preserve pagination, include off-page users and refresh after rating changes', async () => {
  const { db, users }=await setup();
  try {
    for(let i=5;i<=60;i++) {
      const id=`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
      await db.query('insert into auth.users values($1)',[id]); await db.query('insert into profiles(id,username) values($1,$2)',[id,`Player${i}`]);
    }
    await db.exec("update go_ratings set rating=1500,rated_games=1 where time_control='normal'");
    await db.query("update go_ratings set rating=1600 where user_id=$1 and time_control='normal'",[users[3]]);
    await db.query("update go_ratings set rated_games=3 where user_id=$1 and time_control='normal'",[users[2]]);
    const page1=(await db.query("select * from get_go_elo_leaderboard('normal',50,0)")).rows;
    const page2=(await db.query("select * from get_go_elo_leaderboard('normal',50,50)")).rows;
    assert.equal(page1[0].user_id,users[3]);assert.equal(page1[1].user_id,users[2]);assert.equal(page1[2].user_id,users[0]);
    assert.equal(Number(page2[0].rank),51);assert.equal(Number(page2.at(-1).rank),60);
    for(const row of [...page1,...page2]) {
      const p=(await db.query("select * from get_go_ranked_profile($1) where time_control='normal'",[row.user_id])).rows[0];
      assert.equal(p.leaderboard_rank,row.rank);assert.equal(isTop10(Number(p.leaderboard_rank)),Number(row.rank)<=10);
    }
    const id=page2.at(-1).user_id;
    await db.query("update go_ratings set rating=1700 where user_id=$1 and time_control='normal'",[id]);
    const refreshed=(await db.query("select * from get_go_ranked_profile($1) where time_control='normal'",[id])).rows[0];
    assert.equal(Number(refreshed.leaderboard_rank),1);assert.ok(isTop10(Number(refreshed.leaderboard_rank)));
    await db.query("update go_ratings set rating=1400 where user_id=$1 and time_control='normal'",[id]);
    assert.equal(Number((await db.query("select * from get_go_ranked_profile($1) where time_control='normal'",[id])).rows[0].leaderboard_rank),60);
    assert.equal((await db.query("select leaderboard_rank from get_go_ranked_profile($1) where time_control='blitz'",[id])).rows[0].leaderboard_rank,null);
  } finally {await db.close();}
});
test('a failed history write rolls back the game and Elo together, and a retry settles normally',async()=>{
  const {db,users,match,action}=await setup();
  try {
    const g=await match(),b=users.indexOf(g.black_id);
    await db.exec("alter table user_game_results add constraint simulate_failure check(game<>'go')");
    await assert.rejects(action(g.id,b,'resign',g.version),/simulate_failure/);
    assert.equal((await db.query('select status from go_ranked_games where id=$1',[g.id])).rows[0].status,'playing');
    assert.ok((await db.query('select * from go_ratings')).rows.every(r=>r.rated_games===0));
    assert.equal((await db.query('select count(*)::int n from ranked_go_matches')).rows[0].n,0);
    await db.exec('alter table user_game_results drop constraint simulate_failure');
    assert.equal((await action(g.id,b,'resign',g.version)).result.black_after,1184);
  }finally{await db.close();}
});
test('database permissions protect rating mutation, game actions, queue entry and outsider history',async()=>{
  const {db,users,match}=await setup();
  try {
    const g=await match();
    await db.exec("grant usage on schema auth to authenticated; select set_config('request.jwt.claim.role','authenticated',false); set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[users[2]]);
    assert.equal((await db.query('select * from go_ranked_games')).rows.length,0);
    await assert.rejects(db.query('update go_ratings set rating=9999'),/permission denied/);
    await assert.rejects(db.query('select go_ranked_action($1,$2)',[g.id,users[2]]),/permission denied/);
    await assert.rejects(db.query('select apply_verified_ranked_go_result($1)',[g.id]),/permission denied/);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[g.black_id]);
    assert.equal((await db.query('select * from go_ranked_games')).rows.length,1);
    assert.equal((await db.query("select * from get_go_ranked_profile($1)",[g.black_id])).rows.length,2);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select * from get_go_elo_leaderboard()'),/permission denied/);
  }finally{await db.close();}
});
test('settled wins and losses immediately move the exact rank across Top 10, without any frontend sorting',async()=>{
  const {db,users,match,action}=await setup();
  try {
    for(let i=5;i<15;i++){
      const id=`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
      await db.query('insert into auth.users values($1)',[id]);await db.query('insert into profiles(id,username) values($1,$2)',[id,`Rival${i}`]);
      await db.query("update go_ratings set rating=1505,rated_games=20 where user_id=$1 and time_control='normal'",[id]);
    }
    await db.query("update go_ratings set rating=1500,rated_games=20 where user_id=any($1::uuid[]) and time_control='normal'",[users.slice(0,2)]);
    const rank=async()=>Number((await db.query("select leaderboard_rank from get_go_ranked_profile($1) where time_control='normal'",[users[0]])).rows[0].leaderboard_rank);
    assert.equal(await rank(),11);assert.equal(isTop10(await rank()),false);
    const first=await match();await action(first.id,1,'resign',first.version);
    assert.equal(await rank(),1);assert.equal(isTop10(await rank()),true);
    const second=await match();await action(second.id,0,'resign',second.version);
    assert.equal(await rank(),12);assert.equal(isTop10(await rank()),false);
  }finally{await db.close();}
});
