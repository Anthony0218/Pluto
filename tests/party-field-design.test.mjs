import test from 'node:test';
import assert from 'node:assert/strict';
import { boardLanding, fieldKind, fieldMaterial } from '../src/games/party/board/fieldDesign.ts';
import { mapRegistry } from '../src/games/party/content/maps.ts';
import { DEFAULT_SETTINGS } from '../src/games/party/config.ts';
import { createMatch, createPlayer, advance } from '../src/games/party/engine/engine.ts';

function fixture(kind, mapId = 'sunspill') {
  const map = mapRegistry.get(mapId), settings = {...DEFAULT_SETTINGS, mapId};
  const before = createMatch(['a','b','c','d'].map((id,i)=>createPlayer(id,id,i)), settings, ()=>.4);
  before.order = before.players.map(p=>p.id); before.turnIndex = 0; before.phase = 'RESOLVE_TILE';
  const node = map.nodes.find(n=>kind==='cleanse' ? map.cleansingNodeIds.includes(n.id) : n.type===kind && !map.cleansingNodeIds.includes(n.id));
  before.players[0].currentNodeId = node.id; before.players[0].hp=18; before.properties=[]; before.plutoNodeIds=[];
  return {before,map,settings,node,resolve:()=>advance(before,settings,()=>.4,Date.now()+10000)};
}
test('ordinary movement and an unchanged landing snapshot do not animate a reward',()=>{
  const {before,map}=fixture('coin'); const moving=structuredClone(before); moving.phase='MOVEMENT';
  assert.equal(boardLanding(moving,before,map,1000),null);
  assert.equal(boardLanding(before,structuredClone(before),map,1000),null);
  const shopping = structuredClone(before); shopping.eventSeq++; shopping.events.push({id:shopping.eventSeq,kind:'SHOP_PURCHASE',playerId:'b',text:'Bought an item'});
  assert.equal(boardLanding(before,shopping,map,1000),null);
});
test('coin and bank deposit feedback uses the resolved field amounts',()=>{
  const coins=fixture('coin'); const after=coins.resolve(); const landing=boardLanding(coins.before,after,coins.map,1000);
  assert.equal(landing.amount,3); assert.equal(landing.playerId,'a'); assert.equal(landing.nodeId,coins.node.id);
  assert.equal(boardLanding(after,after,coins.map,1100),null);
  const deposit=fixture('deposit'); deposit.before.players[0].coins=1;
  assert.equal(boardLanding(deposit.before,deposit.resolve(),deposit.map,1000).amount,1);
});
test('bank feedback reports the vault contents and healing respects maximum HP',()=>{
  const bank=fixture('bank'); bank.before.bank=17;
  assert.equal(boardLanding(bank.before,bank.resolve(),bank.map,1000).amount,17);
  const heal=fixture('heal'); heal.before.players[0].hp=39;
  const landing=boardLanding(heal.before,heal.resolve(),heal.map,1000); assert.equal(landing.amount,1); assert.equal(landing.label,'+1 HP');
});
test('cleansing shows actual healing and only dissolves an existing negative effect',()=>{
  const clean=fixture('cleanse'); clean.before.players[0].statusEffects=[{id:'radiation',remainingTurns:3}];
  const landing=boardLanding(clean.before,clean.resolve(),clean.map,1000);
  assert.equal(landing.kind,'cleanse'); assert.equal(landing.cleansed,true); assert.equal(landing.amount,10);
  clean.before.players[0].hp=40; clean.before.players[0].statusEffects=[];
  const full=boardLanding(clean.before,clean.resolve(),clean.map,1000); assert.equal(full.cleansed,false); assert.equal(full.label,'All clear!');
});
test('warp feedback preserves the departure and actual destination',()=>{
  const warp=fixture('warp'); const after=warp.resolve(), landing=boardLanding(warp.before,after,warp.map,1000);
  assert.equal(landing.nodeId,warp.node.id); assert.equal(landing.targetNodeId,after.players[0].currentNodeId);
  assert.notEqual(landing.nodeId,landing.targetNodeId);
});
test('item and relic reveal the item the server actually granted',()=>{
  const item=fixture('item'); const after=item.resolve(); assert.ok(boardLanding(item.before,after,item.map,1000).label.length>3);
  const relic=fixture('coin'); relic.before.boardEffects=[{id:'test-relic',kind:'relic',nodeIds:[relic.node.id],expiresAfterRound:99}];
  assert.equal(boardLanding(relic.before,relic.resolve(),relic.map,1000).kind,'item');
});
test('regional materials vary without changing the field mechanic or cleansing override',()=>{
  const map=mapRegistry.get('sunspill');
  for(const [region,kind] of [[4,'wood'],[3,'stone']]) assert.equal(fieldMaterial(map,map.nodes.find(n=>n.region===region)).kind,kind);
  const mountain=mapRegistry.get('mountain'); assert.equal(fieldMaterial(mountain,mountain.nodes.find(n=>mountain.regions[n.region].motif==='lake')).kind,'ice');
  assert.equal(fieldKind(map,map.nodes.find(n=>map.cleansingNodeIds.includes(n.id))),'cleanse');
});
