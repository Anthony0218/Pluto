import assert from "node:assert/strict";
import test from "node:test";
import { SCENARIOS } from "../src/games/natura/naturaData.ts";
import {
  ARCHER_TARGET, ARCHER_WIDTH, WATERLINE, archerShotAngle, chooseArcherInput,
  createArcherGame, emptyArcherInput, insectLanding, updateArcherGame,
} from "../src/games/natura/archerfish.ts";

const idle = () => [emptyArcherInput(), emptyArcherInput()];
const playing = () => { const game = createArcherGame(); game.phase = "playing"; return game; };
function advance(game, seconds, inputs = idle(), ai = false, fps = 60) {
  for (let frame = 0; frame < Math.round(seconds * fps); frame++) updateArcherGame(game, inputs, 1 / fps, ai);
}
function floating(game, x) {
  game.insects = [{ id: 0, x, y: WATERLINE, vx: 0, vy: 0, state: "floating", floatTime: 1.6 }];
}

test("the scenario supplies both players with three valid quiz questions", () => {
  const scenario = SCENARIOS.find(scenario => scenario.id === "archerfish");
  assert.ok(scenario);
  assert.equal(SCENARIOS.filter(scenario => scenario.id === "archerfish").length, 1);
  assert.equal(scenario.questions.length, 6);
  assert.equal(new Set(scenario.questions.map(question => question.text)).size, 6);
  for (const question of scenario.questions) {
    assert.equal(question.answers.length, 3);
    assert.ok(question.answers[question.correct]);
    assert.ok(question.explanation.length > 0);
  }
});

test("ready and paused states freeze the entire simulation", () => {
  const game = createArcherGame();
  const initial = structuredClone(game);
  advance(game, 3, [{ move: 1, aim: 1, shoot: true, dash: true }, emptyArcherInput()], true);
  assert.deepEqual(game, initial);
  game.phase = "paused";
  const paused = structuredClone(game);
  advance(game, 3, idle(), true);
  assert.deepEqual(game, paused);
});

test("water shots hit from either side and create interceptable falling prey", () => {
  for (const x of [180, 360]) {
    const game = playing();
    const target = game.insects[1];
    game.fish[0].x = x;
    game.fish[0].angle = archerShotAngle(game.fish[0], target);
    assert.notEqual(game.fish[0].angle, null);
    updateArcherGame(game, [{ ...emptyArcherInput(), shoot: true }, emptyArcherInput()], 1 / 60);
    advance(game, 0.4);
    assert.equal(game.fish[0].shots, 1);
    assert.equal(game.fish[0].hits, 1);
    assert.equal(target.state, "falling");
  }
});

test("a missed shot does not dislodge an insect or award food", () => {
  const game = playing();
  game.fish[0].x = 480;
  advance(game, 2, [{ ...emptyArcherInput(), shoot: true }, emptyArcherInput()]);
  assert.equal(game.fish[0].hits, 0);
  assert.equal(game.fish[0].catches, 0);
  assert.ok(game.insects.every(insect => insect.state === "perched"));
});

test("holding spit respects cooldown, and holding dash respects recharge", () => {
  const game = playing();
  game.fish[0].x = 480;
  advance(game, 2, [{ ...emptyArcherInput(), shoot: true, move: 1, dash: true }, emptyArcherInput()]);
  assert.equal(game.fish[0].shots, 3);
  assert.ok(game.fish[0].dashCooldown > 0);
  assert.equal(game.fish[0].dashTime, 0);
  assert.ok(game.fish[0].x <= ARCHER_WIDTH - 38);
});

test("landing prediction agrees with the falling insect's actual splash", () => {
  const game = playing();
  game.fish[0].x = 38; game.fish[1].x = ARCHER_WIDTH - 38;
  const insect = { id: 0, x: 390, y: 100, vx: 80, vy: 15, state: "falling", floatTime: 0 };
  game.insects = [insect];
  const prediction = insectLanding(insect);
  while (insect.state === "falling") updateArcherGame(game, idle(), 1 / 120);
  assert.ok(Math.abs(insect.x - prediction.x) < 1);
  assert.equal(insect.y, WATERLINE);
});

test("a rival can steal the shooter's catch", () => {
  const game = playing();
  const target = game.insects[1];
  game.fish[0].x = 150;
  game.fish[0].angle = archerShotAngle(game.fish[0], target);
  updateArcherGame(game, [{ ...emptyArcherInput(), shoot: true }, emptyArcherInput()], 1 / 60);
  advance(game, 0.4);
  assert.equal(game.fish[0].hits, 1);
  game.fish[1].x = insectLanding(target).x;
  advance(game, 1.5);
  assert.equal(game.fish[0].catches, 0);
  assert.equal(game.fish[1].catches, 1);
});

test("equal-distance arrivals share one food without favouring the first fish", () => {
  const game = playing();
  game.fish[0].x = 470; game.fish[1].x = 490;
  floating(game, 480);
  advance(game, 0.2);
  assert.deepEqual(game.fish.map(fish => fish.catches), [0.5, 0.5]);
  assert.equal(game.insects.length, 0);
  assert.equal(game.respawns.length, 1);
});

test("the closer fish wins when both are inside the catch radius", () => {
  const game = playing();
  game.fish[0].x = 465; game.fish[1].x = 485;
  floating(game, 480);
  advance(game, 0.2);
  assert.deepEqual(game.fish.map(fish => fish.catches), [0, 1]);
});

test("uncaught insects sink and repopulate their branch once", () => {
  const game = playing();
  floating(game, 480);
  advance(game, 3.2);
  assert.equal(game.insects.length, 1);
  assert.equal(game.insects[0].state, "perched");
  assert.equal(game.respawns.length, 0);
  assert.deepEqual(game.fish.map(fish => fish.catches), [0, 0]);
});

test("the target ends a round exactly once, and finished games cannot change", () => {
  const game = playing();
  game.fish[1].catches = ARCHER_TARGET - 1;
  floating(game, game.fish[1].x);
  advance(game, 0.2);
  assert.equal(game.phase, "finished"); assert.equal(game.winner, 1);
  const finished = structuredClone(game);
  advance(game, 2, idle(), true);
  assert.deepEqual(game, finished);
});

test("timer expiry handles either winner and a draw", () => {
  for (const scores of [[3, 1], [1, 3], [2, 2]]) {
    const game = playing();
    game.time = 0.03;
    game.fish.forEach((fish, index) => { fish.catches = scores[index]; });
    advance(game, 0.1);
    assert.equal(game.phase, "finished");
    assert.equal(game.time, 0);
    assert.equal(game.winner, scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1);
  }
});

test("AI can shoot, intercept, and win a complete round", () => {
  const game = playing();
  advance(game, 60.1, idle(), true);
  assert.equal(game.phase, "finished");
  assert.equal(game.winner, 1);
  assert.ok(game.fish[1].hits >= ARCHER_TARGET);
  assert.equal(game.fish[1].catches, ARCHER_TARGET);
  assert.ok(game.time > 0);
});

test("AI pursues visible falling prey before taking another shot", () => {
  const game = playing();
  game.insects[0].state = "falling";
  const input = chooseArcherInput(game, 1);
  assert.equal(input.shoot, false); assert.equal(input.move, -1); assert.equal(input.dash, true);
});

test("normal display frame rates produce the same movement, catches, and outcome", () => {
  const games = [30, 60, 120].map(fps => {
    const game = playing();
    advance(game, 60.1, idle(), true, fps);
    return game;
  });
  for (const game of games) {
    assert.equal(game.winner, 1);
    assert.deepEqual(game.fish.map(fish => fish.catches), [0, ARCHER_TARGET]);
    assert.ok(Math.abs(game.elapsed - games[0].elapsed) < 0.03);
  }
});

test("invalid delta time is ignored and long stalls cannot skip the whole round", () => {
  const game = playing();
  for (const delta of [-1, NaN, Infinity]) updateArcherGame(game, idle(), delta);
  assert.equal(game.time, 60);
  updateArcherGame(game, idle(), 100);
  assert.ok(game.time > 59.89);
});
