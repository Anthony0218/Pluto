import test from "node:test";
import assert from "node:assert/strict";
import { toResults } from "../src/games/party/minigames/flow.ts";
import { paddlePanic } from "../src/games/party/minigames/paddlePanic/index.ts";
import { PADDLE_PANIC_CONFIG as PP } from "../src/games/party/minigames/paddlePanic/config.ts";
import { paddleX, predictBallY } from "../src/games/party/minigames/paddlePanic/logic.ts";
import { streetCross } from "../src/games/party/minigames/streetCross/index.ts";
import { FINISH_ROW, STREET_CROSS_CONFIG as SC } from "../src/games/party/minigames/streetCross/config.ts";

const seeded = (seed) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const duelists = (a = "medium", b = "medium", bots = true) => [
  { id: "a", isBot: bots, difficulty: a },
  { id: "b", isBot: bots, difficulty: b },
];
const create = (def, participants = duelists(), seed = 1) =>
  def.create({ participants, startedAt: 0, endsAt: def.durationSeconds * 1000, random: seeded(seed) });
// Plays a bot-vs-bot duel through the same hooks the authority uses.
function play(def, participants, seed) {
  const rng = seeded(seed),
    s = create(def, participants, seed);
  for (let now = 100; now < s.endsAt && !def.isFinished(s); now += 100) {
    def.tick(s, now);
    for (const p of participants)
      for (const { input, at } of def.botInputs(s, p, now, rng)) {
        assert.ok(def.parseInput(input), `bot input parses: ${JSON.stringify(input)}`);
        def.tick(s, at);
        if (!def.isFinished(s)) def.applyInput(s, p.id, def.parseInput(input), at);
      }
  }
  return s;
}

// ---------- Paddle Panic ----------
test("Paddle Panic initializes two centered paddles, a waiting ball and zero scores", () => {
  const s = create(paddlePanic);
  assert.deepEqual(s.sides, { left: "a", right: "b" });
  assert.equal(s.paddles.a.side, "left");
  assert.equal(s.paddles.a.y, PP.field.height / 2);
  assert.deepEqual(s.ball, { x: PP.field.width / 2, y: PP.field.height / 2, vx: 0, vy: 0 });
  assert.deepEqual(s.scores, { a: 0, b: 0 });
  assert.equal(s.serveAt, PP.ball.serveDelayMs);
  assert.throws(() => create(paddlePanic, [duelists()[0]]), /exactly two/);
  assert.equal(paddlePanic.gameType, "duel");
});

test("a missed return scores for the opponent and resets the serve toward the player who conceded", () => {
  const s = create(paddlePanic);
  s.serveAt = null;
  s.paddles.a.y = s.paddles.a.targetY = PP.field.height - PP.paddle.height / 2; // far from the ball
  s.ball = { x: 3, y: 2, vx: -12, vy: 0 };
  paddlePanic.tick(s, 1000);
  assert.deepEqual(s.scores, { a: 0, b: 1 });
  assert.equal(s.lastPoint.scorerId, "b");
  assert.equal(s.serveToward, "left");
  assert.ok(s.serveAt > s.lastPoint.at);
  assert.equal(s.ball.vx, 0);
});

test("the paddle returns the ball, speeds it up and counts the return", () => {
  const s = create(paddlePanic);
  s.serveAt = null;
  s.paddles.a.y = s.paddles.a.targetY = 5;
  s.ball = { x: 4, y: 5, vx: -8, vy: 0 };
  paddlePanic.tick(s, 600);
  assert.ok(s.ball.vx > 0, "bounced back");
  assert.ok(Math.hypot(s.ball.vx, s.ball.vy) > 8, "faster after a hit");
  assert.equal(s.paddles.a.returns, 1);
  assert.deepEqual(s.scores, { a: 0, b: 0 });
});

test("walls reflect the ball and prediction folds the bounces", () => {
  const ball = { x: 8, y: 1, vx: -4, vy: -6 };
  const predicted = predictBallY(ball, paddleX("left"));
  assert.ok(predicted >= PP.ball.radius && predicted <= PP.field.height - PP.ball.radius);
  const s = create(paddlePanic);
  s.serveAt = null;
  s.ball = { ...ball };
  paddlePanic.tick(s, 300);
  assert.ok(s.ball.vy > 0, "bounced off the top wall");
});

test("paddle input is bounded: it moves toward the target at a capped speed", () => {
  const s = create(paddlePanic);
  paddlePanic.applyInput(s, "a", paddlePanic.parseInput({ type: "PADDLE", y: 7 }), 0);
  assert.equal(s.paddles.a.targetY, PP.field.height - PP.paddle.height / 2, "clamped to the court");
  paddlePanic.tick(s, 100);
  assert.ok(Math.abs(s.paddles.a.y - 5 - PP.paddle.maxSpeed * 0.1) < 1e-9, "no teleporting");
  for (const bad of [
    { type: "PADDLE" },
    { type: "PADDLE", y: "0.5" },
    { type: "PADDLE", y: Number.NaN },
    { type: "PADDLE", y: 0.5, speed: 99 },
    { type: "MOVE", y: 0.5 },
  ])
    assert.equal(paddlePanic.parseInput(bad), null);
  assert.throws(() => paddlePanic.applyInput(s, "x", { type: "PADDLE", y: 0.5 }, 200), /not playing/);
});

test("first to 3 wins, the duel finishes early and further input is rejected", () => {
  const s = create(paddlePanic);
  s.scores.a = 2;
  s.serveAt = null;
  s.paddles.b.y = s.paddles.b.targetY = PP.paddle.height / 2;
  s.ball = { x: 13, y: 9, vx: 12, vy: 0 };
  paddlePanic.tick(s, 1000);
  assert.equal(s.scores.a, 3);
  assert.equal(s.winnerId, "a");
  assert.ok(paddlePanic.isFinished(s));
  const sim = s.simTime;
  paddlePanic.tick(s, 5000);
  assert.equal(s.simTime, sim, "the simulation stops");
  assert.throws(() => paddlePanic.applyInput(s, "b", { type: "PADDLE", y: 0.5 }, 5000), /not running/);
  const ranking = paddlePanic.rank(s, ["a", "b"], seeded(1));
  assert.deepEqual(ranking, ["a", "b"]);
  const results = toResults(ranking, paddlePanic.scores(s));
  assert.deepEqual(results.map((r) => r.position), [1, 2], "exactly one winner");
});

test("Paddle Panic bots send legal input, better bots win more, and hard bots are not perfect", () => {
  let hardWins = 0,
    hardConceded = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const s = play(paddlePanic, duelists("hard", "easy"), seed);
    if (paddlePanic.rank(s, ["a", "b"], seeded(seed))[0] === "a") hardWins++;
    hardConceded += s.scores.b;
  }
  assert.ok(hardWins >= 15, `hard won ${hardWins}/20`);
  let perfect = true;
  for (let seed = 1; seed <= 10; seed++) {
    const s = play(paddlePanic, duelists("hard", "hard"), seed + 100);
    if (s.scores.a + s.scores.b > 0) perfect = false;
  }
  assert.ok(!perfect || hardConceded > 0, "hard bots miss sometimes");
});

test("the public view hides serve angles and bot plans", () => {
  const s = play(paddlePanic, duelists(), 3);
  const view = paddlePanic.publicView(s, s.simTime);
  assert.equal(view.serveAngles, undefined);
  assert.equal(view.bots, undefined);
  assert.ok(view.ball && view.paddles && view.scores);
});

// ---------- Street Cross ----------
const emptyRoad = (s) => {
  s.lanes = [];
  return s;
};

test("Street Cross starts both runners at the start with guaranteed traffic gaps", () => {
  const s = create(streetCross);
  assert.equal(s.runners.a.y, 0.5);
  assert.notEqual(s.runners.a.x, s.runners.b.x);
  assert.equal(s.lanes.length, SC.lanes.length);
  for (const lane of s.lanes) {
    const period = SC.width + SC.offscreen * 2;
    const starts = lane.vehicles.map((v) => v.offset).sort((x, y) => x - y);
    for (let i = 0; i < starts.length; i++) {
      const v = lane.vehicles.find((x) => x.offset === starts[i]);
      const gap = ((starts[(i + 1) % starts.length] - starts[i] + period) % period || period) - v.length;
      assert.ok(gap >= SC.minGap - 0.002, `lane ${lane.row} gap ${gap}`);
    }
  }
  assert.equal(streetCross.gameType, "duel");
});

test("movement respects the course bounds and input is normalized", () => {
  const s = emptyRoad(create(streetCross));
  streetCross.applyInput(s, "a", streetCross.parseInput({ type: "MOVE", dx: -1, dy: -1 }), 0);
  streetCross.tick(s, 5000);
  assert.ok(Math.abs(s.runners.a.x - SC.player.radius) < 1e-9);
  assert.ok(Math.abs(s.runners.a.y - SC.player.radius) < 1e-9);
  const diagonal = streetCross.parseInput({ type: "MOVE", dx: 5, dy: 5 });
  assert.ok(Math.hypot(diagonal.dx, diagonal.dy) <= 1.001, "no speed boost from big vectors");
  for (const bad of [{ type: "MOVE", dx: 1 }, { type: "MOVE", dx: "1", dy: 0 }, { type: "MOVE", dx: 0, dy: 1, speed: 9 }, { type: "JUMP", dx: 0, dy: 1 }])
    assert.equal(streetCross.parseInput(bad), null);
});

test("getting hit sends a runner back to the latest checkpoint with a short stun", () => {
  const s = create(streetCross);
  // A wall of traffic parked across lane 1.
  s.lanes = [{ row: 1, speed: 0, vehicles: [{ kind: "bus", length: 30, offset: 0 }] }];
  streetCross.applyInput(s, "a", { type: "MOVE", dx: 0, dy: 1 }, 0);
  streetCross.tick(s, 1000);
  const r = s.runners.a;
  assert.equal(r.hits, 1);
  assert.equal(r.y, 0.5);
  assert.ok(r.stunnedUntil > s.simTime - 1000 && r.invulnerableUntil > r.stunnedUntil);
  // From the middle checkpoint a hit only sends you back to it.
  const mid = create(streetCross);
  mid.lanes = [{ row: 5, speed: 0, vehicles: [{ kind: "bus", length: 30, offset: 0 }] }];
  Object.assign(mid.runners.a, { y: 4.5, checkpointRow: 4 });
  streetCross.applyInput(mid, "a", { type: "MOVE", dx: 0, dy: 1 }, 0);
  streetCross.tick(mid, 1000);
  assert.equal(mid.runners.a.hits, 1);
  assert.equal(mid.runners.a.y, 4.5);
});

test("safe strips become checkpoints as runners pass them", () => {
  const s = emptyRoad(create(streetCross));
  streetCross.applyInput(s, "a", { type: "MOVE", dx: 0, dy: 1 }, 0);
  streetCross.tick(s, 2200);
  assert.equal(s.runners.a.checkpointRow, 4);
  streetCross.tick(s, 4000);
  assert.equal(s.runners.a.checkpointRow, 8);
});

test("reaching the finish completes the duel; the first finisher wins and later input is rejected", () => {
  const s = emptyRoad(create(streetCross));
  streetCross.applyInput(s, "a", { type: "MOVE", dx: 0, dy: 1 }, 0);
  streetCross.applyInput(s, "b", { type: "MOVE", dx: 0, dy: 0.5 }, 0);
  streetCross.tick(s, 10_000);
  assert.ok(streetCross.isFinished(s));
  assert.ok(s.runners.a.finishedAt !== null && s.runners.b.finishedAt === null);
  assert.equal(s.runners.a.y, FINISH_ROW + 0.5);
  assert.deepEqual(streetCross.rank(s, ["a", "b"], seeded(1)), ["a", "b"]);
  assert.throws(() => streetCross.applyInput(s, "b", { type: "MOVE", dx: 0, dy: 1 }, 10_000), /not running/);
  const results = toResults(streetCross.rank(s, ["b", "a"], seeded(2)), streetCross.scores(s));
  assert.equal(results[0].playerId, "a");
  assert.equal(results.length, 2);
});

test("at the time limit the runner furthest up the course wins", () => {
  const s = create(streetCross);
  s.runners.a.y = 3.5;
  s.runners.b.y = 6.5;
  assert.deepEqual(streetCross.rank(s, ["a", "b"], seeded(1)), ["b", "a"]);
});

test("Street Cross bots move legally, finish, and better bots do better", () => {
  let hardWins = 0,
    finished = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const s = play(streetCross, duelists("hard", "easy"), seed);
    if (streetCross.rank(s, ["a", "b"], seeded(seed))[0] === "a") hardWins++;
    if (streetCross.isFinished(s)) finished++;
  }
  assert.ok(hardWins >= 12, `hard won ${hardWins}/20`);
  assert.ok(finished >= 12, `${finished}/20 finished before the time limit`);
  const view = streetCross.publicView(play(streetCross, duelists(), 5), 0);
  assert.equal(view.bots, undefined, "bot plans stay on the server");
});
