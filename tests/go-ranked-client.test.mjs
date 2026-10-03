import { normalizeGoRankedProfile } from "../src/games/go/ranked/profileData.ts";
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GO_RANKED_TIME_CONTROLS, GO_RANKED_DEFAULT_RATING, isGoTimeControl, goTimeControlLabel, isTop10 } from '../src/games/go/ranked/config.ts';
import { advanceGoClock, goClock, goRemainingClock } from '../src/games/go/ranked/clock.ts';
import { getChessRank } from '../src/games/chess/ranked/tiers.ts';
import { pinnedGoRow } from '../src/games/go/ranked/leaderboard.ts';
const require = createRequire(import.meta.url);
function component(path, modules = {}) {
  const source = readFileSync(new URL(path,import.meta.url),'utf8');
  const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2023,esModuleInterop:true}}).outputText;
  const exports = {};
  new Function('require','exports',compiled)(name => modules[name] ?? require(name), exports);
  return exports;
}
const i18n = { ui: text => text, useUiLanguage: () => {} };
const rankEmblem = component('../src/components/chess/RankEmblem.tsx').default;
const topBadge = component('../src/components/chess/TopRankBadge.tsx',{ '@/i18n/ui': i18n }).default;
const table = component('../src/components/social/LeaderboardTable.tsx',{
  '@/i18n/ui': i18n,
  '@/components/chess/RankEmblem': { default: rankEmblem, __esModule:true },
  '@/components/chess/TopRankBadge': { default: topBadge, __esModule:true },
  '@/games/go/ranked/config': { isTop10 },
  '@/games/chess/ranked/tiers': { getChessRank },
  './ProfileAvatarPicker': { ProfileAvatar: props => React.createElement('img',{ alt:props.avatarId }) },
  './UserLink': { default: props => React.createElement('a',{ href:'/profile/'+props.userId },props.children), __esModule:true },
}).default;
test('Go has exactly two central Japanese byo-yomi modes with separate initial rating',()=>{
  assert.deepEqual(Object.keys(GO_RANKED_TIME_CONTROLS),['blitz','normal']);
  assert.deepEqual(Object.values(GO_RANKED_TIME_CONTROLS).map(c=>c.initialMs),[30000,300000]);
  assert.deepEqual(Object.values(GO_RANKED_TIME_CONTROLS).map(c=>[c.byoYomiPeriods,c.byoYomiMs]),[[5,10000],[5,30000]]);
  for(const mode of ['bullet','rapid','classical']) assert.equal(isGoTimeControl(mode),false);
  assert.equal(GO_RANKED_DEFAULT_RATING,1200);assert.equal(isGoTimeControl('classical'),false);
});
test('exact Top 10 boundaries and real Chess icons render in the reused table, including page 2 ranks',()=>{
  for(const [rank,expected] of [[null,false],[0,false],[1,true],[10,true],[11,false],[153,false]])assert.equal(isTop10(rank),expected);
  const rows=[1,10,11,51].map(rank=>({ rank,user_id:String(rank),username:'Player '+rank,avatar_id:'m1',value:1800 }));
  const html=renderToStaticMarkup(React.createElement(table,{ rows,valueLabel:'Elo',currentUserId:'11',chessRanks:true,top10Badges:true }));
  assert.match(html,/#51/); assert.equal((html.match(/top-rank-badge-number/g)??[]).length,2);
  assert.match(html,/Top 10.*?#10/);assert.doesNotMatch(html,/aria-label="Top 10 · #11"/);
  assert.match(html,/Platinum/);assert.match(html,/bg-amber-300\/10/);
});
test('Go uses the real Chess tier and SVG asset selection across every tier boundary',()=>{
  for(const [rating,name,family] of [[399,'Bronze V','Bronze'],[400,'Bronze IV','Bronze'],[799,'Bronze I','Bronze'],[800,'Silver V','Silver'],[1299,'Silver I','Silver'],[1300,'Gold V','Gold'],[1799,'Gold I','Gold'],[1800,'Platinum V','Platinum'],[2299,'Platinum I','Platinum'],[2300,'Diamond V','Diamond'],[2549,'Diamond I','Diamond'],[2550,'Master','Master'],[2699,'Master','Master'],[2700,'Grandmaster','Grandmaster']]) {
    const tier=getChessRank(rating);assert.equal(tier.name,name);assert.equal(tier.family,family);
    const html=renderToStaticMarkup(React.createElement(rankEmblem,{family:tier.family}));assert.match(html,/<svg/);assert.match(html,new RegExp(family));
  }
  assert.notEqual(getChessRank(1799).family,getChessRank(1800).family);
});
test('the exact user row stays pinned off page, without duplicating an already-visible row',()=>{
  const own={user_id:'me',rank:327,value:1534};
  assert.equal(pinnedGoRow([{user_id:'other'}],own),own);assert.equal(pinnedGoRow([own],own),null);assert.equal(pinnedGoRow([],null),null);
});
test('Go clock handles active color, server elapsed, reload and stopped results',()=>{
  const sample={game:{state:{currentPlayer:'black'},status:'playing',black_time_ms:120000,white_time_ms:120000,black_period_ms:10000,white_period_ms:10000,black_periods_remaining:3,white_periods_remaining:3,byo_yomi_ms:10000,clock_started_at:'2026-10-03T12:00:00Z'},serverNow:'2026-10-03T12:00:02Z'};
  assert.equal(goRemainingClock(sample,'black',1000,2000),117000);assert.equal(goRemainingClock(sample,'white',1000,2000),120000);
  assert.equal(goRemainingClock({...sample,serverNow:'2026-10-03T12:01:59Z'},'black',0,3000),8000);
  assert.equal(goClock({...sample,serverNow:'2026-10-03T12:02:10Z'},'black',0,0).periodsRemaining,2);
  assert.equal(goRemainingClock({...sample,serverNow:'2026-10-03T12:02:30Z'},'black',0,0),0);
  sample.game.status='finished';sample.game.black_time_ms=75000;assert.equal(goRemainingClock(sample,'black',0,1e9),75000);
  sample.game.status='ready';assert.equal(goRemainingClock(sample,'black',0,1e9),75000);
});

test('profile RPC rows reject unsupported clocks and malformed data without crashing the label', () => {
  const normal = { time_control: 'normal', rating: 1400, rated_games: 6, peak_rating: 1450, wins: 3, losses: 2, draws: 1, leaderboard_rank: '42' };
  assert.deepEqual(normalizeGoRankedProfile([normal]), [{ ...normal, leaderboard_rank: 42 }]);
  for (const value of ['rapid', 'classical', '__proto__', 'constructor', '', null, undefined, {}]) {
    assert.equal(goTimeControlLabel(value), 'Unknown time control');
    assert.deepEqual(normalizeGoRankedProfile([{ ...normal, time_control: value }, null, normal]), [{ ...normal, leaderboard_rank: 42 }]);
  }
  for (const payload of [null, undefined, {}, 'bad']) assert.deepEqual(normalizeGoRankedProfile(payload), []);
  assert.deepEqual(normalizeGoRankedProfile([{ ...normal, rating: undefined }, { ...normal, wins: NaN }]), []);
  assert.equal(goTimeControlLabel('normal'), 'Normal 5m + 5 × 30s');
  assert.equal(goTimeControlLabel('blitz', text => text.toUpperCase()), 'BLITZ 30s + 5 × 10s');
});
test('Go profile renders supported and unexpected time controls without taking down the page', () => {
  const profile = component('../src/components/ranked/GoRankedProfile.tsx', {
    'react-router-dom': { Link: props => React.createElement('a', { href: props.to }, props.children) },
    '@/components/chess/RankEmblem': { default: rankEmblem, __esModule: true },
    '@/components/chess/TopRankBadge': { default: topBadge, __esModule: true },
    '@/games/chess/ranked/tiers': { getChessRank },
    '@/games/go/ranked/config': { goTimeControlLabel, isTop10 },
    '@/games/go/ranked/profile': { useGoRankedProfile: () => ({ rows: [{ time_control: 'rapid', rating: 1400, rated_games: 0, peak_rating: 1400, wins: 0, losses: 0, draws: 0, leaderboard_rank: null }], error: null }) },
  }).default;
  const html = renderToStaticMarkup(React.createElement(profile, { userId: 'me' }));
  assert.match(html, /Unknown time control/);
  assert.match(html, /1400/);
});
