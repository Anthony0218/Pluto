import { DEFAULT_SETTINGS, advance, applyAction, startMinigame } from "./helpers/party-legacy-fixtures.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { MAIN_MINIGAME_REWARDS,
  MINIGAME_FLOW } from "../src/games/party/config.ts";
import { tropical } from "../src/games/party/content/maps.ts";
import { activePlayer,
  createMatch,
  createPlayer,
  newTurnState } from "../src/games/party/engine/engine.ts";
import { botAction } from "../src/games/party/engine/bots.ts";
import { minigameRegistry } from "../src/games/party/minigames/index.ts";
import { MinigameRegistry,
  selectMinigame } from "../src/games/party/minigames/registry.ts";
import { applyMinigameInput,
  applyMinigameRewards,
  beginMinigamePhase,
  finishMinigame,
  nextRoundOrder,
  publicMinigameView,
  stepMinigameBots,
  toResults } from "../src/games/party/minigames/flow.ts";
import { TARGET_PANIC_CONFIG } from "../src/games/party/minigames/targetPanic/config.ts";
import { applyTargetHit,
  createTargetPanic,
  rankTargetPanic,
  targetPanicView } from "../src/games/party/minigames/targetPanic/logic.ts";
import { targetPanicBotInputs } from "../src/games/party/minigames/targetPanic/bot.ts";
import { parseMessage } from "../src/games/party/network/protocol.ts";
import { PartyRooms } from "../server/party/rooms.ts";

const settings = { ...DEFAULT_SETTINGS, victory: "coins" };
const players = () =>
  Array.from({ length: 4 }, (_, i) => createPlayer(`p${i}`, `Player ${i}`, i));
const seeded = (seed) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
function started() {
  let r = 0;
  return advance(createMatch(players(), settings, () => 0.4), settings, () =>
    [0.9, 0.7, 0.4, 0.1][r++ % 4],
  );
}
// Last player of round 1 has just finished their turn.
function lastTurnEnded() {
  const s = started();
  s.turnIndex = 3;
  s.phase = "TURN_END";
  return s;
}
const T0 = 1_000_000;
function inIntro(rng = seeded(1)) {
  const animal = advance(lastTurnEnded(), settings, rng, T0);
  const intro = advance(animal, settings, rng, T0);
  // Target Panic remains a legacy definition; these tests exercise its scoring/phase contract.
  startMinigame(intro, "target-panic", rng, T0);
  return intro;
}
function inMinigame(rng = seeded(1)) {
  const intro = inIntro(rng);
  return advance(intro, settings, rng, intro.minigame.startedAt);
}
const tp = (s) => s.minigame.state;
const targetOf = (state, kind) => state.targets.find((t) => t.kind === kind);
const hit = (s, playerId, target, at = target.spawnAt + 100) =>
  applyMinigameInput(
    s,
    playerId,
    { type: "TARGET_HIT", targetId: target.id },
    at,
  );
// Gives p0..p3 the given scores by rewriting their Target Panic records.
function withScores(s, scores, dangerHits = [0, 0, 0, 0]) {
  scores.forEach((score, i) => {
    Object.assign(tp(s).players[`p${i}`], { score, dangerHits: dangerHits[i] });
  });
  return s;
}
const finish = (s, rng = seeded(2)) =>
  advance(s, settings, rng, s.minigame.endsAt);
const endResults = (s) =>
  advance(s, settings, seeded(3), s.minigame.resultsEndsAt);

// ---------- Phase flow ----------
test("final board turn goes through the animal phase into a server-selected minigame intro", () => {
  const animal = advance(lastTurnEnded(), settings, seeded(1), T0);
  assert.equal(animal.phase, "ANIMAL_PHASE");
  assert.equal(animal.round, 1);
  assert.equal(animal.minigame, null);
  const intro = advance(animal, settings, seeded(1), T0);
  assert.equal(intro.phase, "MINIGAME_INTRO");
  assert.ok(minigameRegistry.pool("main").some((d) => d.id === intro.minigame.minigameId));
  assert.equal(intro.minigame.status, "INTRO");
  assert.deepEqual(intro.minigame.participants, intro.order);
  assert.equal(intro.minigame.startedAt, T0 + MINIGAME_FLOW.introMs);
  assert.equal(
    intro.minigame.endsAt,
    intro.minigame.startedAt + minigameRegistry.get(intro.minigame.minigameId).durationSeconds * 1000,
  );
});
test("intro waits for the countdown, then the minigame starts and ends on the server clock", () => {
  const intro = inIntro();
  assert.equal(
    advance(intro, settings, seeded(1), intro.minigame.startedAt - 1),
    intro,
  );
  const running = advance(intro, settings, seeded(1), intro.minigame.startedAt);
  assert.equal(running.phase, "MINIGAME");
  assert.equal(running.minigame.status, "ACTIVE");
  assert.equal(
    advance(running, settings, seeded(1), running.minigame.endsAt - 1),
    running,
  );
  const results = finish(running);
  assert.equal(results.phase, "MINIGAME_RESULTS");
  assert.equal(results.minigame.status, "FINISHED");
  assert.equal(results.minigame.results.length, 4);
});
test("results lead to round end and the next board round", () => {
  const results = finish(inMinigame());
  assert.equal(
    advance(results, settings, seeded(1), results.minigame.resultsEndsAt - 1),
    results,
  );
  const roundEnd = endResults(results);
  assert.equal(roundEnd.phase, "ROUND_END");
  const next = advance(roundEnd, settings, seeded(1), T0 + 200_000);
  assert.equal(next.phase, "ITEM_PHASE");
  assert.equal(next.round, 2);
});
test("board actions and items are rejected during every minigame phase", () => {
  const s = inMinigame();
  s.players[0].inventory = [{ instanceId: "item-9", itemId: "mega-medkit" }];
  s.players[0].hp = 5;
  for (const phase of ["ANIMAL_PHASE", "MINIGAME_INTRO", "MINIGAME", "MINIGAME_RESULTS", "ROUND_END"]) {
    const m = structuredClone(s);
    m.phase = phase;
    for (const action of [
      { type: "ROLL_DICE" },
      { type: "USE_ITEM", itemInstanceId: "item-9" },
      { type: "BUY_PLUTO" },
      { type: "LEAVE_PROPERTY" },
    ])
      assert.throws(
        () => applyAction(m, activePlayer(m).id, action, settings, () => 0),
        /paused/,
      );
  }
  assert.equal(s.players[0].inventory.length, 1);
});

// ---------- Selection ----------
const stub = (id, gameType = "main") => ({
  ...minigameRegistry.get("target-panic"),
  id,
  name: id,
  gameType,
  selectable: true,
});
test("registered minigames are selectable, invalid ids are rejected", () => {
  assert.deepEqual(minigameRegistry.pool("main").map((game) => game.id), ["arrow-memory", "pickup-arena", "pattern-wall", "trail-run", "rhythm-rush", "circle-shot", "lava-knockback", "tide-treasure", "comet-courier", "rope-rescue", "paddle-doubles", "disco-freeze", "pluto-heist", "kitchen-chaos", "rocket-rumble", "orbital-rally", "island-impostor", "penalty-shootout", "minotaur-maze", "color-clash", "constellation-cascade"]);
  assert.equal(selectMinigame(minigameRegistry.pool("main"), null, () => 0.5), "paddle-doubles");
  // Additional main games avoid immediate repeats; a single-game pool still allows one.
  assert.equal(
    selectMinigame(minigameRegistry.pool("main"), "target-panic", () => 0.99),
    "constellation-cascade",
  );
  assert.equal(selectMinigame([minigameRegistry.get("target-panic")], "target-panic", () => 0.99), "target-panic");
  assert.throws(() => minigameRegistry.get("not-a-game"), /Unknown content/);
  assert.throws(() => startMinigame(started(), "not-a-game", () => 0, T0));
  assert.throws(() => selectMinigame([], null, () => 0));
  const registry = new MinigameRegistry();
  assert.throws(() => registry.register({ ...stub("x"), durationSeconds: 0 }));
  registry.register(stub("x"));
  assert.throws(() => registry.register(stub("x")), /Duplicate/);
});
test("the previous minigame is excluded when alternatives exist and duels are never picked", () => {
  const registry = new MinigameRegistry();
  registry.register(stub("alpha"));
  registry.register(stub("beta"));
  registry.register(stub("duel-only", "duel"));
  for (const r of [0, 0.3, 0.6, 0.99]) {
    assert.equal(selectMinigame(registry.pool("main"), "alpha", () => r), "beta");
    const s = started();
    s.lastMinigameId = "beta";
    beginMinigamePhase(s, () => r, T0, registry);
    assert.equal(s.minigame.minigameId, "alpha");
  }
  assert.throws(() => startMinigame(started(), "duel-only", () => 0, T0, registry), /not a main/);
});

// ---------- Target Panic rules ----------
test("standard +1, golden +3, danger -2 and score never drops below zero", () => {
  let s = inMinigame();
  const st = tp(s);
  const standard = targetOf(st, "standard"),
    golden = targetOf(st, "golden"),
    danger = targetOf(st, "danger");
  assert.ok(standard && golden && danger, "schedule contains every kind");
  s = hit(s, "p0", danger);
  assert.equal(tp(s).players.p0.score, 0);
  assert.equal(tp(s).players.p0.dangerHits, 1);
  s = hit(s, "p0", standard);
  assert.equal(tp(s).players.p0.score, 1);
  s = hit(s, "p0", golden);
  assert.equal(tp(s).players.p0.score, 4);
  const danger2 = tp(s).targets.filter((t) => t.kind === "danger")[1];
  s = hit(s, "p0", danger2);
  assert.equal(tp(s).players.p0.score, 2);
  assert.equal(tp(s).players.p0.dangerHits, 2);
});
test("expired, not-yet-spawned, nonexistent and duplicate hits are rejected", () => {
  const s = inMinigame(),
    target = targetOf(tp(s), "standard");
  assert.throws(
    () => hit(s, "p0", target, target.expiresAt + TARGET_PANIC_CONFIG.hitGraceMs + 1),
    /disappeared/,
  );
  assert.throws(() => hit(s, "p0", target, target.spawnAt - 1), /not appeared/);
  assert.throws(() => hit(s, "p0", { id: "t9999", spawnAt: target.spawnAt }), /does not exist/);
  assert.throws(
    () => applyMinigameInput(s, "p0", { type: "TARGET_HIT", targetId: "../x" }, target.spawnAt),
    /Invalid minigame input/,
  );
  const once = hit(s, "p0", target);
  assert.throws(() => hit(once, "p0", target), /already hit/);
  // Per-player instances: someone else can still hit their own copy of the same target.
  const other = hit(once, "p1", target);
  assert.equal(tp(other).players.p0.score, 1);
  assert.equal(tp(other).players.p1.score, 1);
});
test("non-participants cannot score and hits after the end or outside MINIGAME are rejected", () => {
  const s = inMinigame(),
    target = targetOf(tp(s), "standard");
  assert.throws(() => hit(s, "stranger", target), /not playing/);
  assert.throws(() => applyTargetHit(tp(s), "stranger", { type: "TARGET_HIT", targetId: target.id }, target.spawnAt));
  const last = tp(s).targets.at(-1);
  assert.throws(() => hit(s, "p0", last, s.minigame.endsAt), /not running/);
  const results = finish(s);
  assert.throws(() => hit(results, "p0", last, last.spawnAt + 10), /No minigame/);
  assert.throws(() => hit(inIntro(), "p0", target), /No minigame/);
});
test("clients can only send intent: forged scores and oversized inputs are stripped or rejected", () => {
  const parsed = parseMessage({
    type: "ACTION",
    action: {
      type: "MINIGAME_INPUT",
      input: { type: "TARGET_HIT", targetId: "t3", score: 999 },
      score: 999,
      position: 1,
    },
  });
  assert.deepEqual(Object.keys(parsed.action), ["type", "input"]);
  let s = inMinigame();
  const target = tp(s).targets.find((t) => t.id === "t3");
  s = applyAction(s, "p2", parsed.action, settings, () => 0, target.spawnAt + 50);
  assert.equal(tp(s).players.p2.score, target.kind === "danger" ? 0 : target.kind === "golden" ? 3 : 1);
  for (const input of [
    null,
    [],
    {},
    { type: "TARGET_HIT", targetId: { nested: true } },
    { type: "TARGET_HIT", targetId: "x".repeat(41) },
    { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9 },
  ])
    assert.throws(() =>
      parseMessage({ type: "ACTION", action: { type: "MINIGAME_INPUT", input } }),
    );
  for (const forged of [
    { type: "ACTION", action: { type: "FINISH_MINIGAME", results: [] } },
    { type: "ACTION", action: { type: "START_MINIGAME", minigameId: "target-panic" } },
  ])
    assert.throws(() => parseMessage(forged));
});
test("schedule is fair, on-screen, deterministic and the public view hides the future and bot plans", () => {
  const participants = ["a", "b"].map((id) => ({ id, isBot: false, difficulty: "medium" }));
  const make = () =>
    createTargetPanic({ participants, startedAt: 0, endsAt: 90_000, random: seeded(9) });
  const st = make();
  assert.deepEqual(make(), st);
  assert.ok(st.targets.length > 100);
  for (const t of st.targets) {
    assert.ok(t.x >= 0 && t.x <= 1 && t.y >= 0 && t.y <= 1);
    assert.ok(t.spawnAt >= 0 && t.expiresAt <= 90_000);
    assert.equal(t.expiresAt - t.spawnAt, TARGET_PANIC_CONFIG.targetLifetimeMs);
  }
  const counts = { standard: 0, golden: 0, danger: 0 };
  st.targets.forEach((t) => counts[t.kind]++);
  assert.ok(counts.golden < counts.danger && counts.danger < counts.standard);
  st.bots.a = { nextTargetIndex: 0, lastTapAt: 0, queue: [{ targetId: "t50", at: 1 }] };
  const view = targetPanicView(st, 30_000);
  assert.equal(view.bots, undefined);
  assert.ok(view.targets.length > 0 && view.targets.length < 10);
  assert.ok(view.targets.every((t) => t.spawnAt <= 30_000 + TARGET_PANIC_CONFIG.viewLookaheadMs));
  const s = inMinigame();
  const pub = publicMinigameView(s.minigame, s.minigame.startedAt + 10_000);
  assert.ok(pub.state.targets.length < 10);
  assert.equal(pub.serverNow, s.minigame.startedAt + 10_000);
});

// ---------- Bots ----------
function simulateBots(difficulties, seed) {
  const participants = difficulties.map((difficulty, i) => ({ id: `b${i}`, isBot: true, difficulty }));
  const rng = seeded(seed);
  const st = createTargetPanic({ participants, startedAt: 0, endsAt: 90_000, random: rng });
  const ids = new Set(st.targets.map((t) => t.id));
  let attempted = 0,
    accepted = 0;
  for (let now = 0; now < 90_000; now += 100)
    for (const bot of participants)
      for (const { input, at } of targetPanicBotInputs(st, bot, now, rng)) {
        attempted++;
        assert.ok(ids.has(input.targetId), "bots only aim at scheduled targets");
        assert.ok(at <= now);
        try {
          applyTargetHit(st, bot.id, input, at);
          accepted++;
        } catch {
          /* too slow: rejected like a human */
        }
      }
  const perfect = st.targets.reduce(
    (sum, t) => sum + (t.kind === "golden" ? 3 : t.kind === "standard" ? 1 : 0),
    0,
  );
  return { st, attempted, accepted, perfect };
}
test("bot difficulty profiles are valid and ordered", () => {
  const { easy, medium, hard } = TARGET_PANIC_CONFIG.bots;
  for (const p of [easy, medium, hard]) {
    assert.ok(p.reactionMs[0] > 0 && p.reactionMs[0] < p.reactionMs[1]);
    assert.ok(p.accuracy > 0 && p.accuracy < 1, "no bot is perfect");
    assert.ok(p.mistakeChance > 0 && p.mistakeChance < 1);
  }
  assert.ok(hard.reactionMs[1] < easy.reactionMs[1] && medium.reactionMs[0] < easy.reactionMs[0]);
  assert.ok(easy.accuracy < medium.accuracy && medium.accuracy < hard.accuracy);
  assert.ok(easy.mistakeChance > medium.mistakeChance && medium.mistakeChance > hard.mistakeChance);
});
test("bots play through validated hits, are not perfect and scale with difficulty", () => {
  let easy = 0,
    hard = 0;
  for (const seed of [4, 8, 15, 16]) {
    const { st, attempted, accepted, perfect } = simulateBots(["easy", "medium", "hard", "hard"], seed);
    assert.ok(attempted > 0 && accepted > 0 && accepted <= attempted);
    for (const [id, p] of Object.entries(st.players)) {
      assert.equal(p.claimed.length, p.hits, id);
      assert.ok(p.score < perfect, `${id} must not be perfect`);
    }
    easy += st.players.b0.score;
    hard += st.players.b2.score + st.players.b3.score;
  }
  assert.ok(hard / 2 > easy, `hard ${hard / 2} vs easy ${easy}`);
});
test("server bot step drives bot players through the minigame and humans are untouched", () => {
  let s = inMinigame(seeded(5));
  s.players.forEach((p, i) => {
    p.isBot = i > 0;
  });
  const rng = seeded(6);
  for (let now = s.minigame.startedAt; now < s.minigame.startedAt + 20_000; now += 100)
    s = stepMinigameBots(s, now, rng).match;
  assert.equal(tp(s).players.p0.hits, 0);
  assert.ok(["p1", "p2", "p3"].every((id) => tp(s).players[id].hits > 0));
  // A human replaced by a bot mid-game keeps their score and the bot carries on from there.
  tp(s).players.p0.score = 7;
  s.players[0].isBot = true;
  const takeoverAt = s.minigame.startedAt + 20_000;
  for (let now = takeoverAt; now < takeoverAt + 10_000; now += 100)
    s = stepMinigameBots(s, now, rng).match;
  assert.ok(tp(s).players.p0.hits > 0 && tp(s).players.p0.score > 7);
  const idle = inIntro();
  assert.equal(stepMinigameBots(idle, T0, rng).match, idle);
});

// ---------- Results ----------
test("ranking sorts by score, then fewer danger hits, then a server-random tiebreak", () => {
  const st = { players: {
    a: { score: 10, dangerHits: 3 },
    b: { score: 30, dangerHits: 0 },
    c: { score: 10, dangerHits: 1 },
    d: { score: 5, dangerHits: 0 },
  } };
  assert.deepEqual(rankTargetPanic(st, ["a", "b", "c", "d"], () => 0.5), ["b", "c", "a", "d"]);
  const tied = { players: Object.fromEntries(["a", "b", "c", "d"].map((id) => [id, { score: 7, dangerHits: 1 }])) };
  const draws = [0.2, 0.9, 0.5, 0.1];
  let i = 0;
  assert.deepEqual(rankTargetPanic(tied, ["a", "b", "c", "d"], () => draws[i++]), ["b", "c", "a", "d"]);
  const results = toResults(["b", "c", "a", "d"], { a: 1, b: 2, c: 3, d: 4 });
  assert.deepEqual(results.map((r) => r.position), [1, 2, 3, 4]);
  assert.equal(results[0].score, 2);
  assert.throws(() => toResults(["a", "a", "b", "c"], {}));
});
test("every finished minigame gives four unique placements even when everyone ties", () => {
  const results = finish(withScores(inMinigame(), [4, 4, 4, 4])).minigame.results;
  assert.deepEqual(results.map((r) => r.position), [1, 2, 3, 4]);
  assert.equal(new Set(results.map((r) => r.playerId)).size, 4);
});

// ---------- Rewards ----------
test("rewards are exactly 10/5/3/0 and are applied once", () => {
  assert.deepEqual(MAIN_MINIGAME_REWARDS, { 1: 10, 2: 5, 3: 3, 4: 0 });
  const s = withScores(inMinigame(), [2, 9, 5, 1]);
  const before = s.players.map((p) => p.coins);
  const results = finish(s);
  assert.deepEqual(results.minigame.results.map((r) => r.playerId), ["p1", "p2", "p0", "p3"]);
  assert.deepEqual(results.players.map((p, i) => p.coins - before[i]), [3, 10, 5, 0]);
  assert.deepEqual(results.minigame.rewards, { p1: 10, p2: 5, p0: 3, p3: 0 });
  const again = structuredClone(results);
  applyMinigameRewards(again);
  finishMinigame(again, seeded(8), results.minigame.endsAt + 50);
  for (let t = 0; t < 5; t++) advance(again, settings, seeded(1), results.minigame.resultsEndsAt - 1);
  assert.deepEqual(again.players.map((p) => p.coins), results.players.map((p) => p.coins));
  const coinsAfterRound = endResults(results).players.map((p) => p.coins);
  assert.deepEqual(coinsAfterRound, results.players.map((p) => p.coins));
});

// ---------- Victory ----------
test("a minigame reward can trigger coin victory and no new round starts", () => {
  const s = withScores(inMinigame(), [0, 0, 12, 0]);
  s.players[2].coins = 194;
  const results = finish(s);
  assert.equal(results.players[2].coins, 204);
  assert.equal(results.winner, "p2");
  assert.equal(results.phase, "MINIGAME_RESULTS");
  const over = endResults(results);
  assert.equal(over.phase, "GAME_OVER");
  assert.equal(over.round, 1);
  assert.equal(over.minigame, null);
  assert.equal(advance(over, settings, seeded(1), T0 * 2), over);
});
test("simultaneous coin victory from rewards goes to the better minigame placement", () => {
  const s = withScores(inMinigame(), [3, 8, 0, 0]);
  s.players[0].coins = 197; // 2nd: +5 -> 202
  s.players[1].coins = 195; // 1st: +10 -> 205
  assert.equal(finish(s).winner, "p1");
});

// ---------- Turn order and cleanup ----------
test("minigame winner leads the next round and everyone else keeps their relative order", () => {
  assert.deepEqual(nextRoundOrder(["A", "B", "C", "D"], "C"), ["C", "A", "B", "D"]);
  assert.deepEqual(nextRoundOrder(["A", "B", "C", "D"], "A"), ["A", "B", "C", "D"]);
  assert.deepEqual(nextRoundOrder(["A", "B", "C", "D"], "D"), ["D", "A", "B", "C"]);
  const s = withScores(inMinigame(), [1, 2, 9, 3]);
  const next = advance(endResults(finish(s)), settings, seeded(1), T0 * 2);
  assert.deepEqual(next.order, ["p2", "p0", "p1", "p3"]);
  assert.equal(next.turnIndex, 0);
  assert.equal(activePlayer(next).id, "p2");
});
test("minigame runtime and temporary turn state are cleared for the next round", () => {
  const s = inMinigame();
  s.turn.bonusMovement = 4;
  s.turn.hasRolled = true;
  s.lastRoll = 7;
  s.movesRemaining = 2;
  const next = advance(endResults(finish(s)), settings, seeded(1), T0 * 2);
  assert.equal(next.minigame, null);
  assert.equal(next.lastMinigameId, "target-panic");
  assert.deepEqual(next.turn, newTurnState());
  assert.equal(next.lastRoll, null);
  assert.equal(next.movesRemaining, 0);
  assert.equal(next.phase, "ITEM_PHASE");
  assert.equal(next.round, 2);
});
test("full seeded bot match loops board -> minigame -> rewards -> board for several rounds", () => {
  const rng = seeded(42);
  const cfg = { ...settings, coinTarget: 300 };
  let s = createMatch(players().map((p) => ({ ...p, isBot: true })), cfg, rng);
  let now = 0,
    minigames = 0,
    lastPhase = s.phase;
  for (let step = 0; step < 20_000 && s.round < 5 && s.phase !== "GAME_OVER"; step++) {
    now += 100;
    const action = botAction(s, tropical, rng, cfg);
    s = action
      ? applyAction(s, activePlayer(s).id, action, cfg, rng, now)
      : stepMinigameBots(advance(s, cfg, rng, now), now, rng).match;
    if (s.phase === "MINIGAME_RESULTS" && lastPhase !== "MINIGAME_RESULTS") {
      minigames++;
      const game = minigameRegistry.get(s.minigame.minigameId);
      const winningTeam = game.teamOf?.(s.minigame.state, s.minigame.results[0].playerId);
      const draw = s.minigame.results.every((r) => r.score === s.minigame.results[0].score);
      const winners = winningTeam === undefined ? 0 : s.minigame.results.filter((r) => game.teamOf(s.minigame.state, r.playerId) === winningTeam).length;
      assert.equal(Object.values(s.minigame.rewards).reduce((a, b) => a + b, 0), winningTeam === undefined ? 18 : draw ? 20 : winners * 8 + (4 - winners) * 3);
      assert.ok(s.minigame.results[0].score > 0, "bots scored during the minigame");
    }
    lastPhase = s.phase;
  }
  assert.ok(s.round >= 5, `reached round ${s.round}`);
  assert.equal(minigames, 4);
});

// ---------- Server integration ----------
test("server accepts simultaneous minigame input, broadcasts a trimmed view, keeps scores on reconnect and lets a bot take over", () => {
  const rooms = new PartyRooms();
  const messages = [];
  const host = rooms.connect(undefined, (m) => messages.push(structuredClone(m)));
  rooms.handle(host, { type: "CREATE", name: "Panic room", playerName: "Host", public: true });
  const room = rooms.rooms.get(host.room);
  rooms.handle(host, { type: "READY", ready: true });
  rooms.handle(host, { type: "START" });
  const m = room.match;
  m.order = m.players.map((p) => p.id);
  const now = Date.now();
  startMinigame(m, "target-panic", seeded(3), now - MINIGAME_FLOW.introMs - 5_000);
  m.minigame.status = "ACTIVE";
  m.phase = "MINIGAME";
  const live = m.minigame.state.targets.find(
    (t) => t.kind === "standard" && t.spawnAt <= now && t.expiresAt > now + 200,
  );
  assert.ok(live, "a target is on screen");
  rooms.handle(host, {
    type: "ACTION",
    action: { type: "MINIGAME_INPUT", input: { type: "TARGET_HIT", targetId: live.id } },
  });
  assert.equal(room.match.minigame.state.players[host.id].score, 1);
  const snapshot = messages.at(-1).lobby.match.minigame;
  assert.ok(snapshot.serverNow >= now);
  assert.equal(snapshot.state.bots, undefined);
  assert.ok(snapshot.state.targets.length < 10);
  assert.deepEqual(snapshot.state.players[host.id].claimed, [live.id]);
  assert.ok(room.match.minigame.state.targets.length > 100, "authority keeps the full schedule");

  for (let t = now; t < now + 10_000; t += 100) rooms.fastTick(t);
  const bots = room.players.filter((p) => p.isBot);
  assert.ok(bots.some((b) => room.match.minigame.state.players[b.id].hits > 0));

  // Reconnect restores score and remaining time.
  rooms.disconnect(host);
  const resumed = [];
  rooms.connect(host.token, (msg) => resumed.push(structuredClone(msg)));
  const restored = resumed.find((msg) => msg.type === "STATE").lobby.match;
  assert.equal(restored.phase, "MINIGAME");
  assert.equal(restored.minigame.state.players[host.id].score, 1);
  assert.equal(restored.minigame.endsAt, room.match.minigame.endsAt);

  // After the disconnect grace period a bot continues from the current score.
  rooms.disconnect(host);
  const t0 = host.disconnectedAt + 61_000;
  rooms.tick(t0);
  assert.equal(room.players.find((p) => p.id === host.id).isBot, true);
});
