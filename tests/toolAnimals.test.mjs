import test from 'node:test';
import assert from 'node:assert/strict';
import { createToolGame, updateToolGame, idleToolInput, bolasTip, shellProtects, chooseToolInput } from '../src/games/natura/toolAnimals.ts';
const idle = () => [idleToolInput(), idleToolInput()];
const playing = kind => { const game = createToolGame(kind); game.phase = 'playing'; return game; };
function advance(game, seconds, inputs = idle(), ai = false, fps = 60) {
  for (let i = 0; i < Math.round(seconds * fps); i++) updateToolGame(game, inputs, 1 / fps, ai);
}
test('tool games freeze before start, when paused, and after finishing', () => {
  for (const kind of ['bolas', 'coconut']) for (const phase of ['ready', 'paused', 'finished']) {
    const g = createToolGame(kind); g.phase = phase; const before = structuredClone(g);
    advance(g, 2, [{x:1,y:1,action:true,secondary:true}, idleToolInput()], true); assert.deepEqual(g, before);
  }
});
test('only the sticky tip during an active swing catches moths', () => {
  const g = playing('bolas'); const tip = bolasTip(g.players[0]);
  g.moths = [{...tip,id:0,vx:0,phase:0}]; advance(g, .1); assert.equal(g.players[0].food, 0);
  advance(g, .4, [{...idleToolInput(),action:true},idleToolInput()]); assert.equal(g.players[0].food, 1);
  const h = playing('bolas'); h.moths = [{x:240,y:140,id:0,vx:0,phase:0}];
  advance(h, .4, [{...idleToolInput(),action:true},idleToolInput()]); assert.equal(h.players[0].food, 0);
});
test('a held swing does not repeat and a swing catches at most one moth', () => {
  const g = playing('bolas'); const tip = bolasTip(g.players[0]);
  g.moths = [0,1].map(id => ({...tip,id,vx:0,phase:0}));
  advance(g, 1.2, [{...idleToolInput(),action:true},idleToolInput()]);
  assert.equal(g.players[0].food, 1); assert.equal(g.players[0].swing, 0);
});
test('simultaneous sticky catches split a point without player-order advantage', () => {
  const g = playing('bolas'); g.players[1].x = g.players[0].x;
  g.moths = [{...bolasTip(g.players[0]),id:0,vx:0,phase:0}];
  advance(g, .4, [{...idleToolInput(),action:true},{...idleToolInput(),action:true}]);
  assert.deepEqual(g.players.map(p=>p.food), [.5,.5]);
});
test('a scent lure steers a nearby moth toward the spider and has a cooldown', () => {
  const g = playing('bolas'); g.moths = [{x:350,y:260,id:0,vx:72,phase:0}];
  advance(g, .5, [{...idleToolInput(),secondary:true},idleToolInput()]);
  assert.ok(g.moths[0].x < 350); assert.ok(g.players[0].lureCooldown > 4);
  advance(g, .1); const before = g.players[0].lureCooldown;
  advance(g, .1, [{...idleToolInput(),secondary:true},idleToolInput()]); assert.ok(g.players[0].lureCooldown < before);
});
test('shell pickup requires proximity and carrying imposes a movement cost', () => {
  const free = playing('coconut'), carrying = playing('coconut');
  advance(free,.1,[{...idleToolInput(),action:true},idleToolInput()]); assert.equal(free.players[0].carrying,false);
  carrying.players[0].shell = {x:90,y:180};
  advance(carrying,.1,[{...idleToolInput(),action:true},idleToolInput()]); assert.equal(carrying.players[0].carrying,true);
  const move = [{...idleToolInput(),x:1},idleToolInput()]; advance(free,.5,move); advance(carrying,.5,move);
  assert.ok(free.players[0].x > carrying.players[0].x);
  assert.equal(carrying.players[0].shell.x,carrying.players[0].x);
  advance(carrying,.1,[{...idleToolInput(),action:true},idleToolInput()]); assert.equal(carrying.players[0].carrying,false);
  const shell = structuredClone(carrying.players[0].shell); advance(carrying,.2,move); assert.deepEqual(carrying.players[0].shell,shell);
});
test('cover needs assembly time, stops movement and can be left again', () => {
  const g = playing('coconut'); g.players[0].carrying = true;
  advance(g,.1,[{...idleToolInput(),secondary:true,x:1},idleToolInput()]); assert.equal(g.players[0].hidden,true); assert.equal(shellProtects(g.players[0]),false);
  const x = g.players[0].x; advance(g,.5,[{...idleToolInput(),x:1},idleToolInput()]); assert.equal(g.players[0].x,x); assert.equal(shellProtects(g.players[0]),true);
  advance(g,.1,[{...idleToolInput(),secondary:true},idleToolInput()]); assert.equal(g.players[0].hidden,false);
});
test('assembled cover blocks patrol hits, while exposed players lose one heart with invulnerability', () => {
  for (const covered of [true,false]) {
    const g = playing('coconut'); g.raid = {stage:'attack',time:1.87,lanes:[180,360]};
    g.players[0].hidden = covered; g.players[0].coverTime = 0;
    advance(g,.1); assert.equal(g.players[0].lives,covered ? 3 : 2);
    advance(g,.1); assert.equal(g.players[0].lives,covered ? 3 : 2);
  }
});
test('warning captures current lanes before the raid begins', () => {
  const g = playing('coconut'); g.raid.time=.01; g.players[0].y=260;
  advance(g,.1); assert.equal(g.raid.stage,'warning'); assert.equal(g.raid.lanes[0],260);
  g.players[0].y=90; advance(g,1.5); assert.equal(g.raid.stage,'attack'); assert.equal(g.raid.lanes[0],260);
});
test('shared food is available to either forager and unavailable inside cover', () => {
  const g = playing('coconut'); Object.assign(g.players[1], g.foodSites[0]); g.players[1].hidden=true;
  advance(g,.1); assert.equal(g.players[1].food,0); g.players[1].hidden=false;
  advance(g,.1); assert.equal(g.players[1].food,1); assert.equal(g.players[0].food,0);
  advance(g,.1); assert.equal(g.players[1].food,1);
  Object.assign(g.players[0],g.foodSites[1],{food:5}); advance(g,.1);
  assert.equal(g.phase,'finished'); assert.equal(g.winner,0);
});
test('equal-distance shell foragers split one shared meal', () => {
  const g=playing('coconut'); g.players.forEach(p=>Object.assign(p,g.foodSites[0]));
  advance(g,.1); assert.deepEqual(g.players.map(p=>p.food),[.5,.5]);
});
test('capture drags, respawns beside the shell, costs one heart and protects re-entry', () => {
  const g=playing('coconut'); g.raid={stage:'attack',time:1.87,lanes:[180,360]};
  advance(g,.1); assert.equal(g.players[0].lives,2); assert.ok(g.players[0].captured>0);
  const x=g.players[0].x; advance(g,.2); assert.ok(g.players[0].x>x);
  advance(g,1); assert.equal(g.players[0].captured,0); assert.equal(g.players[0].x,90);
  assert.equal(g.players[0].shell.x,90); assert.ok(g.players[0].flash>2);
  assert.equal(g.players[0].lives,2);
});

test('timer expiry handles a draw and either winner', () => {
  for (const kind of ['bolas','coconut']) for (const winner of [null,0,1]) {
    const g=playing(kind);g.time=.01;if(winner!==null)g.players[winner].food=2;
    advance(g,.1);assert.equal(g.phase,'finished');assert.equal(g.winner,winner);
  }
});
test('both AIs finish consistently across display frame rates', () => {
  for(const kind of ['bolas','coconut']) {
    const outcomes=[30,60,120].map(fps=>{const g=playing(kind);advance(g,60,idle(),true,fps);assert.equal(g.winner,1);return g.players.map(p=>[p.food,p.lives]);});
    assert.deepEqual(outcomes[0],outcomes[1]);assert.deepEqual(outcomes[1],outcomes[2]);
  }
});
test('an octopus can complete the entire food route while using shelter', () => {
  const g=playing('coconut');g.players[0].hidden=true;g.players[0].coverTime=0;
  advance(g,60,idle(),true);assert.equal(g.players[1].food,6);assert.equal(g.players[1].lives,3);
  assert.equal(chooseToolInput(g,1).x,0);
});
test('invalid frame deltas and stalls cannot skip a round', () => {
  const g=playing('bolas'); const before=structuredClone(g);
  for(const dt of [NaN,Infinity,0,-1])updateToolGame(g,idle(),dt,true);assert.deepEqual(g,before);
  updateToolGame(g,idle(),300,true);assert.ok(g.time>59);
});
