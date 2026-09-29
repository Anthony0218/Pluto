import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { acceptChessPosition, visibleChessPosition } from '../src/games/chess/multiplayer/position.ts';
import { remainingClock, formatClock } from '../src/games/chess/ranked/clock.ts';

test('latency: preview is immediate, Realtime-before-HTTP does not duplicate moves, late responses cannot undo an opponent reply',async()=>{
 const chess=new Chess(), base={room_id:'a',version:0,fen:chess.fen(),moves:[]};
 chess.move('e4');const preview={...base,fen:chess.fen(),moves:['e4']};
 let resolve;const network=new Promise(r=>{resolve=r});
 let server=base;
 assert.equal(visibleChessPosition(server,preview).fen,chess.fen());assert.deepEqual(server.moves,[]);
 // Arrival ordering under arbitrary latency is deterministic; no sleeps needed.
 const acknowledged={...preview,version:1};server=acceptChessPosition(server,acknowledged);
 assert.deepEqual(visibleChessPosition(server,preview).moves,['e4']);
 chess.move('e5');server=acceptChessPosition(server,{...acknowledged,version:2,fen:chess.fen(),moves:['e4','e5']});
 resolve(acknowledged);server=acceptChessPosition(server,await network);
 assert.deepEqual(visibleChessPosition(server,preview).moves,['e4','e5']);
});
test('rejection removes only the preview; a newer authoritative position survives rollback',()=>{
 const c=new Chess(),base={room_id:'a',version:0,fen:c.fen(),moves:[]};c.move('d4');
 const preview={...base,fen:c.fen(),moves:['d4']};assert.notEqual(visibleChessPosition(base,preview).fen,base.fen);
 assert.equal(visibleChessPosition(base,null),base);
 const newer={...base,version:2,moves:['e4','e5']};assert.equal(acceptChessPosition(newer,base),newer);
 assert.equal(visibleChessPosition(newer,preview),newer);
});
test('five minute display subtracts only active time, switches immediately on preview, and freezes at completion',()=>{
 const sample={game:{fen:'position w - - 0 1',status:'playing',version:0,white_time_ms:300000,black_time_ms:300000,clock_started_at:'2026-09-28T10:00:00Z'},serverNow:'2026-09-28T10:00:00Z',receivedAt:1000};
 assert.equal(formatClock(remainingClock(sample,'white',1000)),'5:00');assert.equal(remainingClock(sample,'white',4000),297000);assert.equal(remainingClock(sample,'black',4000),300000);
 assert.equal(remainingClock(sample,'white',5000,3000),298000);assert.equal(remainingClock(sample,'black',5000,3000),298000);
 const refreshed={...sample,serverNow:'2026-09-28T10:04:55Z',receivedAt:9000};assert.equal(remainingClock(refreshed,'white',10000),4000);
 assert.equal(formatClock(remainingClock(refreshed,'white',15000)),'0:00');
 sample.game.status='finished';sample.game.white_time_ms=72000;assert.equal(remainingClock(sample,'white',1e10),72000);
});
test('Realtime clock reconciliation immediately switches and freezes without a second request',async()=>{
 const {reconcileClock}=await import('../src/games/chess/ranked/clock.ts');
 const game={fen:'position w - - 0 1',status:'playing',version:0,white_time_ms:300000,black_time_ms:300000,clock_started_at:'2026-09-28T10:00:00Z'};
 const base={game,serverNow:game.clock_started_at,receivedAt:1000};
 const moved={...game,version:1,fen:'position b - - 0 1',white_time_ms:299000,clock_started_at:'2026-09-28T10:00:01Z'};
 const sample=reconcileClock(base,moved,2100);assert.equal(remainingClock(sample,'white',3100),299000);assert.equal(remainingClock(sample,'black',3100),298900);
 const ended=reconcileClock(sample,{...moved,version:2,status:'finished',black_time_ms:299000,clock_started_at:null},2200);
 assert.equal(remainingClock(ended,'black',9000),299000);assert.equal(reconcileClock(ended,moved,10000),ended);
});

test('rematches accept reset versions and reject delayed positions and clocks from the prior round',async()=>{
 const {reconcileClock}=await import('../src/games/chess/ranked/clock.ts');
 const old={room_id:'a',ranked_round:1,version:40,fen:'position w - - 0 1',moves:['e4'],status:'finished',white_time_ms:0,black_time_ms:240000,clock_started_at:null};
 const next={...old,ranked_round:2,version:0,moves:[],status:'playing',white_time_ms:300000,black_time_ms:300000,clock_started_at:'2026-09-28T10:00:00Z'};
 assert.equal(acceptChessPosition(old,next),next);assert.equal(acceptChessPosition(next,old),next);
 assert.equal(visibleChessPosition(next,{...old,version:0}),next);
 const sample=reconcileClock({game:old,serverNow:'2026-09-28T10:00:00Z',receivedAt:1000},next,1000);
 assert.equal(remainingClock(sample,'white',1000),300000);assert.equal(remainingClock(sample,'black',1000),300000);
 assert.equal(reconcileClock(sample,old,2000),sample);
});
