import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from './helpers/ranked-database.mjs';
import { advanceGoClock, goClock } from '../src/games/go/ranked/clock.ts';
import { createInitialGoState, applyGoMove } from '../src/games/go/rules.ts';

const clock = (elapsed, main = 60000, period = 10000, count = 3) => advanceGoClock(main, period, count, 10000, elapsed);
test('Japanese byo-yomi transitions and exact boundaries consume periods only after main time', () => {
  assert.deepEqual(clock(59999), { mainMs:1,periodMs:10000,periodsRemaining:3,inByoYomi:false,expired:false });
  assert.deepEqual(clock(60000), { mainMs:0,periodMs:10000,periodsRemaining:3,inByoYomi:true,expired:false });
  assert.equal(clock(69999).periodMs,1);assert.equal(clock(69999).periodsRemaining,3);
  assert.equal(clock(70000).periodMs,10000);assert.equal(clock(70000).periodsRemaining,2);
  assert.equal(clock(85000).periodMs,5000);assert.equal(clock(85000).periodsRemaining,1);
  assert.equal(clock(89999).expired,false);assert.equal(clock(90000).expired,true);assert.equal(clock(1e12).periodsRemaining,0);
  assert.deepEqual(clock(-500),clock(0));
  assert.equal(clock(4000,0,4000,2).periodsRemaining,1);assert.equal(clock(14000,0,4000,2).expired,true);
});
test('reload projects all elapsed periods without resetting them; inactive clocks and completed results stop', () => {
  const sample={game:{status:'playing',state:{currentPlayer:'black'},clock_started_at:'2026-10-03T12:00:00Z',black_time_ms:0,white_time_ms:20000,black_period_ms:10000,white_period_ms:10000,black_periods_remaining:2,white_periods_remaining:3,byo_yomi_ms:10000},serverNow:'2026-10-03T12:00:12Z'};
  const projected=goClock(sample,'black',1000,2500);
  assert.equal(projected.periodsRemaining,1);assert.equal(projected.periodMs,6500);
  assert.equal(goClock(sample,'white',1000,1e9).mainMs,20000);
  assert.equal(goClock({...sample,serverNow:'2026-10-03T12:00:20Z'},'black',0,0).expired,true);
  sample.game.status='finished';sample.game.black_period_ms=3500;
  assert.equal(goClock(sample,'black',0,1e9).periodMs,3500);
  sample.game.status='ready';assert.equal(goClock(sample,'black',0,1e9).periodsRemaining,2);
});
test('database and browser clocks agree across both modes, depleted periods, main time, and deadline boundaries', async () => {
  const {db}=await database(['20261020000000_go_ranked.sql']);
  try {
    for(const [main,duration,count] of [[60000,10000,3],[300000,30000,5],[0,10000,2],[1,10000,1]]) {
      for(const period of [duration,1,duration/2]) {
        for(const elapsed of [0,1,main-1,main,main+1,main+period-1,main+period,main+period+1,main+period+duration-1,main+period+duration*(count-1)-1,main+period+duration*(count-1),1e12]) {
          const actual=(await db.query('select * from go_ranked_clock($1,$2,$3,$4,$5)',[main,period,count,duration,elapsed])).rows[0];
          const expected=advanceGoClock(main,period,count,duration,elapsed);
          assert.deepEqual(actual,{main_ms:expected.mainMs,period_ms:expected.periodMs,periods_remaining:expected.periodsRemaining,expired:expected.expired},JSON.stringify({main,period,count,duration,elapsed}));
        }
      }
    }
  } finally {await db.close();}
});
async function game(mode='blitz') {
  const {db,users}=await database(['20261020000000_go_ranked.sql']);
  const queue=async i=>(await db.query('select go_ranked_queue_action($1,$2,$3,$4,$5,$6) r',[users[i],crypto.randomUUID(),'queue','Player',mode,createInitialGoState()])).rows[0].r;
  await queue(0);const paired=await queue(1);
  const initial=(await db.query('select * from go_ranked_games where code=$1',[paired.code])).rows[0];
  const action=async (user,op='snapshot',version=null,state=null)=>(await db.query('select go_ranked_action($1,$2,$3,$4,$5) r',[initial.id,user,op,version,state])).rows[0].r;
  await action(users[0],'ready');const started=await action(users[1],'ready');
  const setElapsed=async seconds=>db.query("update go_ranked_games set clock_started_at=clock_timestamp()-($2::double precision*interval '1 second') where id=$1",[initial.id,seconds]);
  return {db,action,setElapsed,g:started.game};
}
for(const mode of ['blitz','normal']) test(`${mode}: main-time expiry starts overtime, legal placements and passes reset only the current period`,async()=>{
  const {db,action,setElapsed,g}=await game(mode);
  try {
    const main=g.black_time_ms/1000,duration=g.byo_yomi_ms/1000,count=g.black_periods_remaining;
    await setElapsed(main+duration/2);
    const snapshot=await action(g.black_id);assert.equal(snapshot.game.status,'playing');assert.equal(snapshot.result,null);
    assert.equal(snapshot.game.black_periods_remaining,count);assert.equal(snapshot.game.black_time_ms,g.black_time_ms);
    const first=await action(g.black_id,'move',g.version,applyGoMove(g.state,{type:'place',row:4,col:4}));
    assert.equal(first.game.black_time_ms,0);assert.equal(first.game.black_period_ms,g.byo_yomi_ms);assert.equal(first.game.black_periods_remaining,count);
    assert.equal(first.game.white_time_ms,g.white_time_ms);assert.equal(first.game.white_periods_remaining,count);
    await setElapsed(main+duration+duration/2);
    const passed=await action(g.white_id,'move',first.game.version,applyGoMove(first.game.state,{type:'pass'}));
    assert.equal(passed.game.white_time_ms,0);assert.equal(passed.game.white_period_ms,g.byo_yomi_ms);assert.equal(passed.game.white_periods_remaining,count-1);
    assert.equal(passed.game.black_periods_remaining,count);
    await setElapsed(duration+duration/2);
    await assert.rejects(action(g.black_id,'move',g.version,applyGoMove(passed.game.state,{type:'place',row:2,col:2})),/Stale/);
    const valid=await action(g.black_id,'move',passed.game.version,applyGoMove(passed.game.state,{type:'place',row:2,col:2}));
    assert.equal(valid.game.black_periods_remaining,count-1);assert.equal(valid.game.black_period_ms,g.byo_yomi_ms);
    assert.equal(valid.game.white_periods_remaining,count-1);assert.equal(valid.game.white_period_ms,g.byo_yomi_ms);
    // Snapshots and background maintenance neither replenish periods nor rebase clocks.
    await setElapsed(duration+duration/2);
    const before=(await db.query('select * from go_ranked_games where id=$1',[g.id])).rows[0];
    await action(g.white_id);await action(g.black_id);await db.exec('select maintain_ranked_go()');
    const after=(await db.query('select * from go_ranked_games where id=$1',[g.id])).rows[0];
    assert.equal(after.white_periods_remaining,before.white_periods_remaining);assert.equal(after.white_period_ms,before.white_period_ms);
    assert.equal(after.clock_started_at.getTime(),before.clock_started_at.getTime());assert.equal(after.status,'playing');
  } finally {await db.close();}
});
test('the last-period deadline defeats late moves and duplicate requests, and maintenance settles disconnected players once',async()=>{
  const {db,action,setElapsed,g}=await game();
  try {
    await db.query('update go_ranked_games set black_time_ms=0,black_periods_remaining=1 where id=$1',[g.id]);
    await setElapsed(11);
    const done=await action(g.black_id,'move',g.version,applyGoMove(g.state,{type:'place',row:4,col:4}));
    assert.equal(done.game.status,'finished');assert.equal(done.game.end_reason,'timeout');assert.equal(done.game.winner,'white');
    assert.equal(done.game.black_periods_remaining,0);assert.equal(done.game.black_period_ms,0);assert.equal(done.game.state.moveHistory.length,0);
    await action(g.black_id,'move',g.version,applyGoMove(g.state,{type:'pass'}));await db.exec('select maintain_ranked_go()');
    assert.equal((await db.query('select count(*)::int n from ranked_go_matches')).rows[0].n,1);
    assert.equal((await db.query('select count(*)::int n from user_game_results')).rows[0].n,2);
  } finally {await db.close();}
  const second=await game('normal');
  try {
    await second.setElapsed(451);await second.db.exec('select maintain_ranked_go()');
    const done=await second.action(second.g.white_id);assert.equal(done.game.end_reason,'timeout');assert.equal(done.game.black_periods_remaining,0);
    await second.db.exec('select maintain_ranked_go()');assert.equal((await second.db.query('select count(*)::int n from ranked_go_matches')).rows[0].n,1);
  } finally {await second.db.close();}
});
