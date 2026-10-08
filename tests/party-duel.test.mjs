import { DEFAULT_SETTINGS, advance, applyAction } from "./helpers/party-legacy-fixtures.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { DUEL_FLOW } from "../src/games/party/config.ts";
import { tropical } from "../src/games/party/content/maps.ts";
import { activePlayer,
  createMatch,
  createPlayer } from "../src/games/party/engine/engine.ts";
import { botAction } from "../src/games/party/engine/bots.ts";
import { validateWager } from "../src/games/party/duels/wager.ts";
import { createItemInstance } from "../src/games/party/items/inventory.ts";
import { minigameRegistry } from "../src/games/party/minigames/index.ts";
import { beginMinigamePhase,
  selectDuelMinigame,
  stepMinigameBots } from "../src/games/party/minigames/flow.ts";
import { parseMessage } from "../src/games/party/network/protocol.ts";
import { PartyRooms } from "../server/party/rooms.ts";

const coinSettings = { ...DEFAULT_SETTINGS, victory: "coins", coinTarget: 300 };
const players = () =>
  Array.from({ length: 4 }, (_, i) => createPlayer(`p${i}`, `Player ${i}`, i));
const seeded = (seed) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
// Stable order p0, p1, p2, p3 (p0 is active and in ITEM_PHASE).
function started(settings = coinSettings) {
  let r = 0;
  return advance(createMatch(players(), settings, () => 0.4), settings, () =>
    [0.9, 0.7, 0.4, 0.1][r++ % 4],
  );
}
const give = (s, playerId, itemId) => {
  const item = createItemInstance(s, itemId);
  s.players.find((p) => p.id === playerId).inventory.push(item);
  return item.instanceId;
};
const P = (s, id) => s.players.find((p) => p.id === id);
const has = (s, id, instanceId) => P(s, id).inventory.some((i) => i.instanceId === instanceId);
const T0 = 9_000_000;
const challenge = (s, wager, target = "p1", { item, settings = coinSettings, now = T0 } = {}) =>
  applyAction(
    s,
    "p0",
    {
      type: "USE_ITEM",
      itemInstanceId: item ?? give(s, "p0", "duel-saber"),
      targetPlayerId: target,
      ...(wager && { wager }),
    },
    settings,
    seeded(4),
    now,
  );
const coins = (amount) => ({ type: "coins", amount });
const PLUTO = { type: "pluto", amount: 1 };
const totalCoins = (s) =>
  s.players.reduce((sum, p) => sum + p.coins, 0) + s.bank + (s.duel?.pot ?? 0);
const totalPlutos = (s) => s.players.reduce((sum, p) => sum + p.goldenPlutos, 0);
// Ends the running duel minigame with `id` as the winner, whichever game was drawn.
function forceWin(s, id) {
  const game = s.minigame.state;
  if (s.minigame.minigameId === "paddle-panic") {
    game.scores[id] = 3;
    game.winnerId = id;
    game.finishedAt = game.simTime;
  } else {
    game.runners[id].finishedAt = game.simTime;
    game.runners[id].y = 11.5;
  }
}
function toResults(s, winnerId, settings = coinSettings) {
  const playing = advance(s, settings, seeded(5), s.minigame.startedAt);
  assert.equal(playing.phase, "DUEL_MINIGAME");
  forceWin(playing, winnerId);
  const results = advance(playing, settings, seeded(5), playing.minigame.startedAt + 50);
  assert.equal(results.phase, "DUEL_RESULTS");
  return results;
}
const leaveResults = (s, settings = coinSettings) =>
  advance(s, settings, seeded(6), s.minigame.resultsEndsAt);

// ---------- Target and wager validation ----------
test("Duel Saber cannot target yourself or a missing player, and a failed setup does not consume it", () => {
  const s = started();
  const item = give(s, "p0", "duel-saber");
  assert.throws(() => challenge(s, coins(5), "p0", { item }), /yourself/);
  assert.throws(() => challenge(s, coins(5), "nobody", { item }), /not in this match/);
  assert.throws(() => challenge(s, undefined, "p1", { item }), /Choose a wager/);
  assert.throws(() => challenge(s, coins(500), "p1", { item }), /need 500/);
  assert.ok(has(s, "p0", item));
  assert.equal(s.phase, "ITEM_PHASE");
  assert.equal(s.duel, null);
});

test("5, 10 and 20 coin wagers require both players to cover them", () => {
  const s = started();
  P(s, "p0").coins = 30;
  P(s, "p1").coins = 7;
  assert.equal(challenge(structuredClone(s), coins(5)).phase, "DUEL_INTRO");
  assert.throws(() => challenge(structuredClone(s), coins(10)), /cannot cover a 10-coin wager/);
  assert.throws(() => challenge(structuredClone(s), coins(20)), /cannot cover a 20-coin wager/);
  P(s, "p1").coins = 30;
  assert.equal(challenge(structuredClone(s), coins(20)).phase, "DUEL_INTRO");
  P(s, "p0").coins = 8;
  assert.throws(() => challenge(structuredClone(s), coins(10)), /You need 10 coins/);
  assert.equal(challenge(structuredClone(s), coins(5)).phase, "DUEL_INTRO");
});

test("custom wagers accept 1 up to the smaller balance and nothing else", () => {
  const s = started();
  P(s, "p0").coins = 30;
  P(s, "p1").coins = 12;
  assert.equal(challenge(structuredClone(s), coins(12)).duel.pot, 24);
  assert.equal(challenge(structuredClone(s), coins(1)).duel.pot, 2);
  assert.throws(() => challenge(structuredClone(s), coins(13)), /cannot cover/);
  for (const amount of [0, -3, 2.5, Number.NaN])
    assert.throws(() => validateWager(P(s, "p0"), P(s, "p1"), coins(amount)), /whole number/);
  for (const amount of [0, -1, 2.5, "5", Number.NaN, Number.POSITIVE_INFINITY])
    assert.throws(() =>
      parseMessage({
        type: "ACTION",
        action: { type: "USE_ITEM", itemInstanceId: "item-1", targetPlayerId: "p1", wager: { type: "coins", amount } },
      }),
    );
  assert.throws(() =>
    parseMessage({ type: "ACTION", action: { type: "USE_ITEM", itemInstanceId: "item-1", wager: { type: "gems", amount: 5 } } }),
  );
  // Forged pot or payout fields are stripped.
  assert.deepEqual(
    parseMessage({
      type: "ACTION",
      action: { type: "USE_ITEM", itemInstanceId: "item-1", targetPlayerId: "p1", wager: { type: "coins", amount: 5, pot: 999 }, winner: "p0" },
    }).action,
    { type: "USE_ITEM", itemInstanceId: "item-1", targetPlayerId: "p1", wager: { type: "coins", amount: 5 } },
  );
});

test("a Golden Pluto wager requires both players to own one", () => {
  const s = started();
  const item = give(s, "p0", "duel-saber");
  assert.throws(() => challenge(s, PLUTO, "p1", { item }), /at least 1 Golden Pluto/);
  P(s, "p0").goldenPlutos = 1;
  assert.throws(() => challenge(s, PLUTO, "p1", { item }), /at least 1 Golden Pluto/);
  P(s, "p1").goldenPlutos = 2;
  const duel = challenge(s, PLUTO, "p1", { item });
  assert.equal(duel.phase, "DUEL_INTRO");
  assert.deepEqual(duel.duel.wager, PLUTO);
  assert.equal(duel.duel.pot, 0);
});

test("the Duel Saber is consumed once the duel starts; the target cannot refuse", () => {
  const s = started();
  const item = give(s, "p0", "duel-saber");
  const duel = challenge(s, coins(5), "p2", { item });
  assert.ok(!has(duel, "p0", item));
  assert.equal(duel.phase, "DUEL_INTRO");
  assert.deepEqual(duel.minigame.participants, ["p0", "p2"]);
  assert.equal(duel.duel.challengerPlayerId, "p0");
  assert.equal(duel.duel.defenderPlayerId, "p2");
  assert.equal(minigameRegistry.get(duel.minigame.minigameId).gameType, "duel");
  assert.ok(duel.events.some((e) => e.text === "PLAYER 0 CHALLENGED PLAYER 2"));
  assert.ok(duel.events.some((e) => e.text === "WAGER: 5 COINS EACH"));
  // There is no accept/decline action for the defender.
  assert.throws(() => applyAction(duel, "p2", { type: "ROLL_DICE" }, coinSettings, seeded(1), T0), /paused during the duel/);
});

// ---------- Settlement ----------
test("coin duel: both stakes are escrowed, the winner takes the whole pot and no coins are created", () => {
  for (const winner of ["p0", "p1"]) {
    const s = started();
    const before = totalCoins(s);
    const duel = challenge(s, coins(10));
    assert.equal(P(duel, "p0").coins, 10);
    assert.equal(P(duel, "p1").coins, 10);
    assert.equal(duel.duel.pot, 20);
    assert.equal(totalCoins(duel), before);
    const results = toResults(duel, winner);
    const loser = winner === "p0" ? "p1" : "p0";
    assert.equal(P(results, winner).coins, 30);
    assert.equal(P(results, loser).coins, 10);
    assert.equal(results.duel.pot, 0);
    assert.deepEqual(results.duel.payout[winner], { coins: 20, plutos: 0 });
    assert.deepEqual(results.duel.payout[loser], { coins: 0, plutos: 0 });
    assert.equal(totalCoins(results), before, "a transfer, not new coins");
    assert.ok(results.events.some((e) => e.kind === "DUEL_WON"));
    assert.ok(results.events.some((e) => e.text === `PLAYER ${winner[1]} RECEIVED 20 COINS`));
    // Settlement is applied exactly once.
    const again = advance(results, coinSettings, seeded(1), results.minigame.resultsEndsAt - 1);
    assert.equal(P(again, winner).coins, 30);
  }
});

test("Pluto duel: the winner gains one, the loser loses one, the total never changes", () => {
  const s = started();
  P(s, "p0").goldenPlutos = 1;
  P(s, "p1").goldenPlutos = 2;
  const coinsBefore = s.players.map((p) => p.coins);
  const duel = challenge(s, PLUTO);
  assert.equal(totalPlutos(duel), 3, "nothing is removed while the duel runs");
  const results = toResults(duel, "p0");
  assert.equal(P(results, "p0").goldenPlutos, 2);
  assert.equal(P(results, "p1").goldenPlutos, 1);
  assert.equal(totalPlutos(results), 3);
  assert.deepEqual(results.players.map((p) => p.coins), coinsBefore);
  assert.ok(results.events.some((e) => /1 GOLDEN PLUTO TRANSFERRED FROM PLAYER 1/.test(e.text)));
});

// ---------- Victory ----------
test("a coin duel can trigger Coin Victory; the turn does not resume", () => {
  const settings = { ...coinSettings, coinTarget: 100 };
  const s = started(settings);
  P(s, "p0").coins = 95;
  const duel = challenge(s, coins(10), "p1", { settings });
  const results = toResults(duel, "p0", settings);
  assert.equal(P(results, "p0").coins, 105);
  assert.equal(results.winner, "p0");
  assert.equal(results.phase, "DUEL_RESULTS", "results are still shown first");
  const over = leaveResults(results, settings);
  assert.equal(over.phase, "GAME_OVER");
  assert.equal(over.duel, null);
  assert.equal(over.minigame, null);
  assert.throws(() => applyAction(over, "p0", { type: "ROLL_DICE" }, settings, seeded(1), T0), /Dice/);
});

test("a Pluto duel can trigger Golden Pluto Victory", () => {
  const settings = { ...DEFAULT_SETTINGS, victory: "plutos", plutoTarget: 3 };
  const s = started(settings);
  P(s, "p1").goldenPlutos = 2;
  P(s, "p0").goldenPlutos = 1;
  const results = toResults(challenge(s, PLUTO, "p1", { settings }), "p1", settings);
  assert.equal(P(results, "p1").goldenPlutos, 3);
  assert.equal(results.winner, "p1", "the defender can win the match too");
  assert.equal(leaveResults(results, settings).phase, "GAME_OVER");
});

// ---------- Flow ----------
test("a duel interrupts and then resumes the same player's Item Phase without touching the round", () => {
  let s = started();
  // Turbo Boots first, so we can check that temporary turn state survives the duel.
  const boots = give(s, "p0", "turbo-boots");
  s = applyAction(s, "p0", { type: "USE_ITEM", itemInstanceId: boots }, coinSettings, () => 0.99, T0);
  const turn = structuredClone(s.turn),
    order = [...s.order],
    round = s.round,
    lastMinigameId = s.lastMinigameId;
  const phases = [s.phase];
  let x = challenge(s, coins(5));
  phases.push(x.phase);
  assert.equal(advance(x, coinSettings, seeded(1), x.minigame.startedAt - 1), x, "intro waits for its deadline");
  assert.equal(x.minigame.startedAt - T0, DUEL_FLOW.introMs);
  x = toResults(x, "p1");
  phases.push("DUEL_MINIGAME", x.phase);
  assert.ok(!x.events.some((e) => e.kind === "MINIGAME_REWARD"), "no 10/5/3/0 rewards");
  assert.equal(x.minigame.rewards, null);
  x = leaveResults(x);
  phases.push(x.phase);
  assert.deepEqual(phases, ["ITEM_PHASE", "DUEL_INTRO", "DUEL_MINIGAME", "DUEL_RESULTS", "ITEM_PHASE"]);
  assert.equal(activePlayer(x).id, "p0");
  assert.deepEqual(x.turn, turn, "not rolled, Turbo bonus kept");
  assert.deepEqual(x.order, order, "turn order unchanged");
  assert.equal(x.round, round, "round unchanged");
  assert.equal(x.lastMinigameId, lastMinigameId, "main minigame history untouched");
  assert.equal(x.duel, null);
  assert.equal(x.minigame, null);
  assert.ok(x.lastDuelMinigameId);
  // The player continues: roll includes the kept Turbo bonus.
  const rolled = applyAction(x, "p0", { type: "ROLL_DICE" }, coinSettings, () => 0, T0 + 99_000);
  assert.equal(rolled.movesRemaining, 5);
});

test("board actions are paused during the duel; duelists can play and spectators cannot", () => {
  const s = started();
  give(s, "p0", "mega-medkit");
  const duel = challenge(s, coins(5), "p3");
  for (const phase of ["intro", "play"]) {
    const x = phase === "intro" ? duel : advance(duel, coinSettings, seeded(1), duel.minigame.startedAt);
    assert.throws(() => applyAction(x, "p0", { type: "ROLL_DICE" }, coinSettings, seeded(1), T0), /paused during the duel/);
    assert.throws(
      () => applyAction(x, "p0", { type: "USE_ITEM", itemInstanceId: P(x, "p0").inventory[0].instanceId }, coinSettings, seeded(1), T0),
      /paused during the duel/,
    );
  }
  const playing = advance(duel, coinSettings, seeded(1), duel.minigame.startedAt);
  const at = playing.minigame.startedAt + 200;
  const input =
    playing.minigame.minigameId === "paddle-panic" ? { type: "PADDLE", y: 0.2 } : { type: "MOVE", dx: 0, dy: 1 };
  applyAction(playing, "p0", { type: "MINIGAME_INPUT", input }, coinSettings, seeded(1), at);
  applyAction(playing, "p3", { type: "MINIGAME_INPUT", input }, coinSettings, seeded(1), at);
  assert.throws(
    () => applyAction(playing, "p1", { type: "MINIGAME_INPUT", input }, coinSettings, seeded(1), at),
    /not playing/,
  );
});

test("duels pick only registered duel minigames; the round-end minigame never picks a duel", () => {
  const duelIds = minigameRegistry.pool("duel").map((d) => d.id).sort();
  assert.deepEqual(duelIds, ["paddle-panic", "street-cross"]);
  const rng = seeded(8);
  const picked = new Set();
  for (let i = 0; i < 200; i++) picked.add(selectDuelMinigame(null, rng));
  assert.deepEqual([...picked].sort(), duelIds);
  // Consecutive duels avoid repeating the same game when possible.
  assert.equal(selectDuelMinigame("paddle-panic", rng), "street-cross");
  for (let i = 0; i < 50; i++) {
    const s = started();
    beginMinigamePhase(s, rng, T0);
    assert.equal(minigameRegistry.get(s.minigame.minigameId).gameType, "main");
  }
});

// ---------- Bots ----------
test("bot Duel Saber choices are always legal and follow their difficulty", () => {
  const rng = seeded(21);
  for (const difficulty of ["easy", "medium", "hard"])
    for (const victory of ["coins", "plutos"])
      for (let i = 0; i < 60; i++) {
        const settings = { ...DEFAULT_SETTINGS, victory, plutoTarget: 3, coinTarget: 100 };
        const s = started(settings);
        s.players.forEach((p) => {
          p.coins = Math.floor(rng() * 60);
          p.goldenPlutos = Math.floor(rng() * 3);
        });
        const me = P(s, "p0");
        me.isBot = true;
        me.difficulty = difficulty;
        give(s, "p0", "duel-saber");
        const action = botAction(s, tropical, rng, settings, T0);
        if (action.type !== "USE_ITEM") continue;
        const next = applyAction(s, "p0", action, settings, rng, T0);
        assert.equal(next.phase, "DUEL_INTRO");
        if (difficulty === "medium" && action.wager.type === "coins")
          assert.ok(action.wager.amount <= Math.max(1, Math.floor(me.coins / 3)), "medium never risks most coins");
      }
});

test("a disconnected duelist is taken over by the minigame bot controller", () => {
  const s = started();
  const duel = challenge(s, coins(5), "p1");
  let x = advance(duel, coinSettings, seeded(1), duel.minigame.startedAt);
  P(x, "p1").isBot = true; // what the authority does after the reconnect grace period
  const rng = seeded(3);
  let accepted = 0;
  for (let t = x.minigame.startedAt; t < x.minigame.startedAt + 8000; t += 100) {
    x = advance(x, coinSettings, rng, t);
    if (x.phase !== "DUEL_MINIGAME") break;
    const step = stepMinigameBots(x, t, rng);
    x = step.match;
    accepted += step.accepted;
  }
  assert.ok(accepted > 0, "the bot sends validated inputs for the disconnected player");
});

test("seeded all-bot matches with duels conserve coins and Plutos through every duel and resume the same turn", () => {
  for (const [seed, victory] of [[12, "coins"], [34, "plutos"]]) {
    const rng = seeded(seed);
    const settings = { ...DEFAULT_SETTINGS, victory, coinTarget: 150, plutoTarget: 3 };
    let s = createMatch(players().map((p) => ({ ...p, isBot: true })), settings, rng);
    let now = 0,
      duels = 0,
      shots = 0,
      entry = null;
    for (let step = 0; step < 20_000 && s.phase !== "GAME_OVER" && s.round < 4; step++) {
      now += 100;
      // Keep the new items flowing so every seed exercises them.
      const active = activePlayer(s);
      if (s.phase === "ITEM_PHASE" && !s.turn.usedItemThisTurn && active.inventory.length === 0)
        give(s, active.id, ["duel-saber", "scatterblaster", "lucky-six"][Math.floor(rng() * 3)]);
      const before = s;
      const action = botAction(s, tropical, rng, settings, now);
      s = action
        ? applyAction(s, active.id, action, settings, rng, now)
        : stepMinigameBots(advance(s, settings, rng, now), now, rng).match;
      if (action?.type === "FIRE_ITEM") shots++;
      if (s.phase === "DUEL_INTRO" && before.phase !== "DUEL_INTRO") {
        duels++;
        entry = { kind: s.duel.kind, coins: totalCoins(before), plutos: totalPlutos(before), active: activePlayer(before).id, round: before.round, order: [...before.order] };
        assert.equal(totalCoins(s), entry.coins);
      }
      if (before.phase === "DUEL_RESULTS" && s.phase !== "DUEL_RESULTS") {
        assert.equal(totalCoins(s), entry.coins, "duel coins conserved");
        // Duel Saber only transfers; a Pocket Duel (rare item) creates exactly one Pluto for the winner.
        assert.equal(totalPlutos(s), entry.plutos + (entry.kind === "pocket-duel" ? 1 : 0), "duel Plutos conserved");
        assert.equal(activePlayer(s).id, entry.active);
        assert.equal(s.round, entry.round);
        assert.deepEqual(s.order, entry.order);
        assert.ok(s.phase === "ITEM_PHASE" || s.phase === "GAME_OVER");
      }
      for (const p of s.players) assert.ok(p.coins >= 0 && p.goldenPlutos >= 0 && p.hp > 0);
    }
    assert.ok(duels >= 1, `seed ${seed}: ${duels} duels`);
    assert.ok(shots >= 2, `seed ${seed}: ${shots} shots`);
  }
});

// ---------- Server ----------
test("server runs a duel: trimmed snapshots, realtime ticks, bot opponent, then back to the host's turn", () => {
  const rooms = new PartyRooms();
  const messages = [];
  const host = rooms.connect(undefined, (m) => messages.push(m));
  rooms.handle(host, { type: "CREATE", name: "Duel room", playerName: "Host", public: true });
  const room = rooms.rooms.get(host.room);
  rooms.handle(host, { type: "READY", ready: true });
  rooms.handle(host, { type: "START" });
  const m = room.match;
  m.order = m.players.map((p) => p.id);
  m.turnIndex = 0;
  m.phase = "ITEM_PHASE";
  const bot = m.players.find((p) => p.isBot);
  const item = give(m, host.id, "duel-saber");
  rooms.handle(host, {
    type: "ACTION",
    action: { type: "USE_ITEM", itemInstanceId: item, targetPlayerId: bot.id, wager: { type: "coins", amount: 5 } },
  });
  assert.equal(room.match.phase, "DUEL_INTRO");
  const snapshot = messages.at(-1).lobby.match;
  assert.equal(snapshot.duel.pot, 10);
  assert.equal(snapshot.minigame.state.bots, undefined);
  assert.equal(snapshot.minigame.state.serveAngles, undefined);
  rooms.handle(host, { type: "ACTION", action: { type: "MINIGAME_READY" } });
  const start = room.match.minigame.startedAt;
  const before = messages.length;
  let t = start;
  for (; t < start + 70_000 && room.match.phase !== "DUEL_RESULTS"; t += 100) rooms.fastTick(t);
  assert.equal(room.match.phase, "DUEL_RESULTS");
  assert.ok(messages.length - before > 20, "realtime duel snapshots are broadcast");
  const winner = room.match.duel.winnerPlayerId;
  assert.ok([host.id, bot.id].includes(winner));
  rooms.tick(room.match.minigame.resultsEndsAt);
  assert.equal(room.match.phase, "ITEM_PHASE");
  assert.equal(activePlayer(room.match).id, host.id);
  assert.equal(P(room.match, winner).coins, 25);
});
