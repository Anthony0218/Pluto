import assert from "node:assert/strict";
import test from "node:test";
import { SCENARIOS } from "../src/games/natura/naturaData.ts";
import { NATURA_FACTS } from "../src/games/natura/naturaFacts.ts";
import { SNAP_LEVELS, createHabitatMap, PLATFORMS, WILD_H, camouflageMatches, createCuttleGame, createSnapGame, createWildGame,
  foodTarget, habitatAt, idleWildInput, inPredatorView, setCuttleSkin, updateWildGame } from "../src/games/natura/wildModes.ts";

const idle = () => [idleWildInput(), idleWildInput()];
const playing = kind => { const game = createWildGame(kind); game.phase = "playing"; return game; };
function advance(game, seconds, inputs = idle(), ai = false, fps = 60) {
  for (let i = 0; i < Math.round(seconds * fps); i++) updateWildGame(game, inputs, 1 / fps, ai);
}

test("new scenarios are registered, have six questions, and preserve all existing modes", () => {
  assert.equal(new Set(SCENARIOS.map(s => s.id)).size, SCENARIOS.length);
  for (const id of ["meadow", "archerfish", "flyingfish", "trapjaw", "cuttlefish", "bolas", "coconut"]) {
    const scenario = SCENARIOS.find(s => s.id === id);
    assert.ok(scenario, id);
    assert.equal(scenario.questions.length, 6);
    scenario.questions.forEach(q => assert.ok(q.answers[q.correct]));
  }
});

test("every habitat has multiple sourced animal facts", () => {
  for (const scenario of SCENARIOS) {
    const facts = NATURA_FACTS[scenario.id];
    assert.ok(facts.length >= 2);
    for (const fact of facts) {
      assert.ok(fact.text.length > 30);
      assert.ok(fact.title && fact.animal && fact.label);
      assert.equal(new URL(fact.url).protocol, "https:");
    }
  }
});

test("ready and paused games ignore controls, timer changes, and AI", () => {
  for (const kind of ["trapjaw", "cuttlefish"]) for (const phase of ["ready", "paused"]) {
    const game = createWildGame(kind); game.phase = phase;
    const before = structuredClone(game);
    advance(game, 3, [{ x: 1, y: 1, action: true, secondary: true }, idleWildInput()], true);
    assert.deepEqual(game, before);
  }
});

test("a ground snap launches the ant and lands on the next ledge", () => {
  const game = playing("trapjaw");
  updateWildGame(game, [{ ...idleWildInput(), action: true }, idleWildInput()], 1 / 60, false);
  assert.ok(game.players[0].vy < 0);
  assert.equal(game.players[0].grounded, false);
  advance(game, 1.3);
  assert.equal(game.players[0].checkpoint, 1);
  assert.equal(game.players[0].grounded, true);
  assert.equal(game.players[0].y, PLATFORMS[1].y);
});

test("holding snap does not trigger automatic jumps after landing", () => {
  const game = playing("trapjaw");
  advance(game, 3, [{ ...idleWildInput(), action: true }, idleWildInput()]);
  assert.equal(game.players[0].checkpoint, 1);
  assert.equal(game.players[0].grounded, true);
  advance(game, 0.1);
  updateWildGame(game, [{ ...idleWildInput(), action: true }, idleWildInput()], 1 / 60, false);
  assert.equal(game.players[0].grounded, false);
});

test("movement cannot steer an ant in mid-air", () => {
  const game = playing("trapjaw");
  updateWildGame(game, [{ ...idleWildInput(), action: true }, idleWildInput()], 1 / 60, false);
  const velocity = game.players[0].vx;
  advance(game, 0.2, [{ ...idleWildInput(), x: -1 }, idleWildInput()]);
  assert.equal(game.players[0].vx, velocity);
});

test("aim remains within limits, and left-facing launches travel left", () => {
  const game = playing("trapjaw");
  advance(game, 2, [{ ...idleWildInput(), y: -1 }, idleWildInput()]);
  assert.equal(game.players[0].angle, 80);
  advance(game, 2, [{ ...idleWildInput(), y: 1 }, idleWildInput()]);
  assert.equal(game.players[0].angle, 35);
  updateWildGame(game, [{ ...idleWildInput(), x: -1, action: true }, idleWildInput()], 1 / 60, false);
  assert.ok(game.players[0].vx < 0);
});

test("falling costs one heart and respawns at the latest checkpoint", () => {
  const game = playing("trapjaw");
  Object.assign(game.players[0], { checkpoint: 2, y: WILD_H + 50, grounded: false });
  updateWildGame(game, idle(), 1 / 60, false);
  assert.equal(game.players[0].lives, 2);
  assert.equal(game.players[0].checkpoint, 2);
  assert.equal(game.players[0].y, PLATFORMS[2].y);
  assert.equal(game.players[0].grounded, true);
  advance(game, 0.2);
  assert.equal(game.players[0].lives, 2);
});

test("losing the final ant heart ends the round for the other player", () => {
  const game = playing("trapjaw");
  Object.assign(game.players[0], { lives: 1, y: WILD_H + 50, grounded: false });
  updateWildGame(game, idle(), 1 / 60, false);
  assert.equal(game.phase, "finished"); assert.equal(game.winner, 1);
});

test("camouflage requires both the pattern and the texture of the current habitat", () => {
  const game = createCuttleGame(); const animal = game.players[0];
  assert.equal(camouflageMatches(animal, game.patches), true);
  animal.bumpy = !animal.bumpy; assert.equal(camouflageMatches(animal, game.patches), false);
  for (const patch of game.patches) {
    animal.x = patch.x; animal.y = patch.y;
    const habitat = habitatAt(animal.x, animal.y, game.patches);
    animal.pattern = habitat.pattern; animal.bumpy = habitat.bumpy;
    assert.equal(camouflageMatches(animal, game.patches), true);
    animal.pattern = (animal.pattern + 1) % 6;
    assert.equal(camouflageMatches(animal, game.patches), false);
  }
});

test("matching and staying still lowers detection even within a predator's view", () => {
  const game = playing("cuttlefish"); game.elapsed = 2;
  Object.assign(game.players[0], { x: 150, y: 130, exposure: 70 }, habitatAt(150, 130, game.patches));
  advance(game, 0.5);
  assert.ok(game.players[0].exposure < 60);
  assert.equal(game.players[0].lives, 3);
});

test("movement can reveal a cuttlefish even with matching camouflage", () => {
  const game = playing("cuttlefish"); game.elapsed = 2;
  Object.assign(game.players[0], { x: 150, y: 130 }, habitatAt(150, 130, game.patches));
  advance(game, 0.4, [{ ...idleWildInput(), x: 1 }, idleWildInput()]);
  assert.ok(camouflageMatches(game.players[0], game.patches));
  assert.ok(game.players[0].exposure > 5);
});

test("wrong camouflage fills detection and costs a heart without removing food", () => {
  const game = playing("cuttlefish"); game.elapsed = 2;
  Object.assign(game.players[0], { x: 150, y: 130, pattern: (habitatAt(150, 130, game.patches).pattern + 1) % 6, food: 2, exposure: 95 });
  advance(game, 0.1);
  assert.equal(game.players[0].lives, 2);
  assert.equal(game.players[0].food, 2);
  assert.equal(game.players[0].x, 90);
  assert.ok(game.players[0].flash > 0);
  advance(game, 0.5);
  assert.equal(game.players[0].lives, 2);
});

test("predator view faces the correct way and excludes targets beyond its cone", () => {
  const predator = { x: 500, y: 250, facing: -1 };
  assert.equal(inPredatorView({ x: 400, y: 250 }, predator), true);
  assert.equal(inPredatorView({ x: 600, y: 250 }, predator), false);
  assert.equal(inPredatorView({ x: 200, y: 250 }, predator), false);
  assert.equal(inPredatorView({ x: 400, y: 450 }, predator), false);
});

test("cycling patterns and textures requires a new press", () => {
  const game = playing("cuttlefish");
  game.players[0].pattern = 0; game.players[0].bumpy = false;
  const both = [{ ...idleWildInput(), action: true, secondary: true }, idleWildInput()];
  advance(game, 0.5, both);
  assert.equal(game.players[0].pattern, 1); assert.equal(game.players[0].bumpy, true);
  advance(game, 0.1);
  advance(game, 0.1, both);
  assert.equal(game.players[0].pattern, 2); assert.equal(game.players[0].bumpy, false);
});

test("direct skin controls are inactive when paused", () => {
  const game = playing("cuttlefish");
  setCuttleSkin(game, 0, 2, true);
  assert.equal(game.players[0].pattern, 2);
  game.phase = "paused"; setCuttleSkin(game, 0, 0, false);
  assert.equal(game.players[0].pattern, 2); assert.equal(game.players[0].bumpy, true);
});

test("each cuttlefish collects only its current personal food target", () => {
  const game = playing("cuttlefish");
  Object.assign(game.players[0], foodTarget(0, 0));
  advance(game, 0.2);
  assert.equal(game.players[0].food, 1); assert.equal(game.players[1].food, 0);
  advance(game, 0.2);
  assert.equal(game.players[0].food, 1);
});

test("simultaneous final shrimp collection produces a fair draw", () => {
  const game = playing("cuttlefish");
  game.players.forEach((animal, player) => Object.assign(animal, { food: 5 }, foodTarget(player, 5)));
  advance(game, 0.1);
  assert.equal(game.phase, "finished"); assert.equal(game.winner, null);
  assert.deepEqual(game.players.map(p => p.food), [6, 6]);
});

test("time expiry compares progress, then hearts, and can draw", () => {
  for (const kind of ["trapjaw", "cuttlefish"]) {
    const game = playing(kind); game.time = 0.02;
    advance(game, 0.1);
    assert.equal(game.winner, null); assert.equal(game.phase, "finished");
    const lowerHealth = playing(kind); lowerHealth.time = 0.02; lowerHealth.players[0].lives = 2;
    advance(lowerHealth, 0.1);
    assert.equal(lowerHealth.winner, 1);
    const higherProgress = playing(kind); higherProgress.time = 0.02; higherProgress.players[0].lives = 2;
    if (kind === "trapjaw") higherProgress.players[0].checkpoint = 2;
    else higherProgress.players[0].food = 2;
    advance(higherProgress, 0.1);
    assert.equal(higherProgress.winner, 0);
  }
});

test("AI completes both modes with the same outcome across display frame rates", () => {
  for (const kind of ["trapjaw", "cuttlefish"]) {
    const games = [30, 60, 120].map(fps => {
      const game = playing(kind); advance(game, 61, idle(), true, fps); return game;
    });
    for (const game of games) {
      assert.equal(game.phase, "finished"); assert.equal(game.winner, 1);
      assert.ok(game.time > 0); assert.ok(game.elapsed > 10);
      assert.ok(Math.abs(game.elapsed - games[0].elapsed) < 0.03);
      assert.equal(kind === "trapjaw" ? game.players[1].checkpoint : game.players[1].food, kind === "trapjaw" ? 4 : 6);
    }
  }
});

test("finished games are immutable to future updates, and new rounds are fresh", () => {
  for (const kind of ["trapjaw", "cuttlefish"]) {
    const game = playing(kind); game.time = 0.01; advance(game, 0.1);
    const ended = structuredClone(game);
    advance(game, 4, [{ x: 1, y: 1, action: true, secondary: true }, idleWildInput()], true);
    assert.deepEqual(game, ended);
    assert.equal(createWildGame(kind).phase, "ready");
    assert.deepEqual(createWildGame(kind).players.map(p => p.lives), [3, 3]);
  }
});

test("invalid frame deltas are ignored and stalls cannot consume the whole timer", () => {
  const game = createSnapGame(); game.phase = "playing";
  for (const dt of [-1, NaN, Infinity]) updateWildGame(game, idle(), dt, true);
  assert.equal(game.time, 60);
  updateWildGame(game, idle(), 100, true);
  assert.ok(game.time > 59.89);
});


test("random habitats cover the board, include all disguises, and mirror player terrain", () => {
  const map = createHabitatMap(731);
  assert.equal(map.length, 24);
  assert.equal(new Set(map.map(p => p.pattern)).size, 6);
  assert.deepEqual(map, createHabitatMap(731));
  assert.notDeepEqual(map, createHabitatMap(732));
  const area = map.reduce((total, patch) => total + Math.abs(patch.polygon.reduce((sum, point, i, polygon) => {
    const next = polygon[(i + 1) % polygon.length]; return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2, 0);
  assert.ok(Math.abs(area - 960 * 540) < .001);
  for (let x = 25; x < 960; x += 70) for (let y = 15; y < 260; y += 40)
    assert.equal(habitatAt(x, y, map).pattern, habitatAt(x, 540 - y, map).pattern);
});

test("all five Snap Launch courses are reachable using the same physics", () => {
  assert.equal(SNAP_LEVELS.length, 5);
  for (let level = 0; level < SNAP_LEVELS.length; level++) {
    const game = createSnapGame(level); game.phase = "playing";
    advance(game, 60, idle(), true);
    assert.equal(game.winner, 1, SNAP_LEVELS[level].name);
    assert.equal(game.players[1].checkpoint, SNAP_LEVELS[level].platforms.length - 1);
  }
});
