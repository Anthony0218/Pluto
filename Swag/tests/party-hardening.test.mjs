// Milestone 10: reconnects, seat takeover, host migration, duplicate sessions, error isolation, input
// validation, rate limits, return-to-lobby resets, health endpoint and long seeded all-bot matches.
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import {
  DEFAULT_SETTINGS,
  NETWORK_CONFIG,
  NAME_LIMITS,
  RULES,
} from "../src/games/party/config.ts";
import { mapRegistry } from "../src/games/party/content/maps.ts";
import {
  activePlayer,
  advance,
  applyAction,
  createMatch,
  createPlayer,
  legalPaths,
  mapOf,
} from "../src/games/party/engine/engine.ts";
import { botAction, safeBotAction } from "../src/games/party/engine/bots.ts";
import { stepMinigameBots } from "../src/games/party/minigames/flow.ts";
import {
  cleanName,
  normalizeLobbyCode,
  parseMessage,
} from "../src/games/party/network/protocol.ts";
import { PartyRooms } from "../server/party/rooms.ts";
import { startPartyServer } from "../server/party/index.ts";
import { setLogLevel } from "../server/party/log.ts";

setLogLevel("silent");
const T0 = 5_000_000;
const seeded = (seed) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
// A fake socket: records every message and every close request.
function connect(rooms, token, address = "10.0.0.1", now = T0) {
  const messages = [],
    closes = [];
  const session = rooms.connect(token, (m) => messages.push(structuredClone(m)), {
    address,
    now,
    close: (code, reason) => closes.push({ code, reason }),
  });
  return { session, messages, closes, last: (type) => messages.findLast((m) => m.type === type) };
}
// Host + guest humans, two bots, match started; guest ("b") is made the active player in ITEM_PHASE.
function matchRoom({ mapId = "sunspill" } = {}) {
  const rooms = new PartyRooms(),
    a = connect(rooms),
    b = connect(rooms, undefined, "10.0.0.2");
  rooms.handle(a.session, { type: "CREATE", name: "Crew", playerName: "Host", public: true });
  const room = rooms.rooms.get(a.session.room);
  rooms.handle(b.session, { type: "JOIN", code: room.code, playerName: "Guest" });
  rooms.handle(a.session, { type: "SETTINGS", settings: { ...room.settings, mapId } });
  rooms.handle(a.session, { type: "READY", ready: true });
  rooms.handle(b.session, { type: "READY", ready: true });
  rooms.handle(a.session, { type: "START" });
  // Resolve the starting rolls, then hand the turn to the guest.
  let match = room.match;
  for (let i = 0; i < 20 && match.phase === "START_ROLL"; i++)
    match = advance(match, room.settings, seeded(i + 1), T0);
  match.order = [b.session.id, ...match.order.filter((id) => id !== b.session.id)];
  match.turnIndex = 0;
  match.phase = "ITEM_PHASE";
  room.match = match;
  room.players = match.players;
  return { rooms, room, a, b };
}
const guest = (room, b) => room.match.players.find((p) => p.id === b.session.id);

// ---- Reconnect state restoration --------------------------------------------------------------

test("reconnect in ITEM_PHASE restores the same phase and turn without touching state", () => {
  const { rooms, room, b } = matchRoom();
  const before = structuredClone(room.match);
  rooms.disconnect(b.session, T0);
  assert.equal(guest(room, b).connected, false);
  assert.equal(guest(room, b).reconnectDeadline, T0 + NETWORK_CONFIG.reconnectGraceMs);
  rooms.tick(T0 + 5_000); // inside the grace period: the seat waits, nobody plays it
  assert.equal(room.match.phase, "ITEM_PHASE");
  assert.equal(activePlayer(room.match).id, b.session.id);
  const back = connect(rooms, b.session.token, "10.0.0.2", T0 + 6_000);
  const session = back.last("SESSION");
  assert.equal(session.resumed, true);
  assert.equal(session.playerId, b.session.id);
  const state = back.last("STATE");
  assert.equal(state.lobby.match.phase, "ITEM_PHASE");
  assert.equal(activePlayer(state.lobby.match).id, b.session.id);
  const me = guest(room, b);
  assert.equal(me.connected, true);
  assert.equal(me.isBot, false);
  assert.equal(me.reconnectDeadline, null);
  // Nothing about the game changed: same coins, HP, inventory, positions, bank, Plutos, turn state.
  const strip = (m) => ({
    ...m,
    players: m.players.map(({ connected: _c, reconnectDeadline: _r, isBot: _b, botTakeover: _t, ...rest }) => rest),
  });
  assert.deepEqual(strip(room.match), strip(before));
});

test("reconnect after rolling keeps the roll and remaining movement; the dice cannot be rolled again", () => {
  const { rooms, room, b } = matchRoom();
  rooms.handle(b.session, { type: "ACTION", action: { type: "ROLL_DICE" } });
  const roll = room.match.lastRoll,
    moves = room.match.movesRemaining;
  rooms.disconnect(b.session, T0);
  const back = connect(rooms, b.session.token, "10.0.0.2", T0 + 1000);
  assert.equal(back.last("STATE").lobby.match.lastRoll, roll);
  assert.equal(back.last("STATE").lobby.match.movesRemaining, moves);
  assert.equal(room.match.turn.hasRolled, true);
  assert.throws(
    () => rooms.handle(back.session, { type: "ACTION", action: { type: "ROLL_DICE" } }),
    /only be rolled once/,
  );
  assert.equal(room.match.lastRoll, roll);
});

test("reconnect at an intersection restores node, previous node, movement and the same route choices", () => {
  const { rooms, room, b } = matchRoom();
  const map = mapOf(room.match);
  const fork = map.nodes.find((n) => n.connections.length >= 3);
  const me = guest(room, b);
  me.currentNodeId = fork.id;
  me.previousNodeId = fork.connections[0];
  room.match.turn.hasRolled = true;
  room.match.lastRoll = 4;
  room.match.movesRemaining = 3;
  room.match.phase = "PATH_SELECTION";
  const choices = legalPaths(room.match, map);
  assert.ok(choices.length > 1);
  rooms.disconnect(b.session, T0);
  rooms.tick(T0 + 10_000);
  assert.equal(room.match.phase, "PATH_SELECTION"); // not auto-moved during the grace period
  const back = connect(rooms, b.session.token, "10.0.0.2", T0 + 11_000);
  const restored = back.last("STATE").lobby.match;
  const p = restored.players.find((x) => x.id === b.session.id);
  assert.equal(p.currentNodeId, fork.id);
  assert.equal(p.previousNodeId, fork.connections[0]);
  assert.equal(restored.movesRemaining, 3);
  assert.deepEqual(legalPaths(restored, map), choices);
  rooms.handle(back.session, { type: "ACTION", action: { type: "SELECT_PATH", nodeId: choices[1] } });
  assert.equal(guest(room, b).currentNodeId, choices[1]);
  assert.equal(room.match.movesRemaining, 2);
});

test("reconnect during a Duel Saber duel: wager escrowed once, item consumed once, duel state intact", () => {
  const { rooms, room, a, b } = matchRoom();
  const me = guest(room, b),
    host = room.match.players.find((p) => p.id === a.session.id);
  me.inventory.push({ instanceId: "item-900", itemId: "duel-saber" });
  const coins = { me: me.coins, host: host.coins };
  rooms.handle(b.session, {
    type: "ACTION",
    action: {
      type: "USE_ITEM",
      itemInstanceId: "item-900",
      targetPlayerId: a.session.id,
      wager: { type: "coins", amount: 5 },
    },
  });
  assert.equal(room.match.phase, "DUEL_INTRO");
  const duel = structuredClone(room.match.duel);
  rooms.disconnect(b.session, T0);
  const back = connect(rooms, b.session.token, "10.0.0.2", T0 + 500);
  const restored = back.last("STATE").lobby.match;
  assert.deepEqual(restored.duel, duel);
  assert.equal(guest(room, b).coins, coins.me - 5);
  assert.equal(room.match.players.find((p) => p.id === a.session.id).coins, coins.host - 5);
  assert.equal(room.match.duel.pot, 10);
  assert.equal(guest(room, b).inventory.some((i) => i.instanceId === "item-900"), false);
  // A duplicated request after reconnect is rejected: nothing is charged or consumed twice.
  assert.throws(() =>
    rooms.handle(back.session, {
      type: "ACTION",
      action: { type: "USE_ITEM", itemInstanceId: "item-900", targetPlayerId: a.session.id, wager: { type: "coins", amount: 5 } },
    }),
  );
  assert.equal(guest(room, b).coins, coins.me - 5);
});

// ---- Grace period, bot takeover and takeover-back ---------------------------------------------

test("after the grace period the same seat becomes bot-controlled with all state, and plays on", () => {
  const { rooms, room, b } = matchRoom();
  const me = guest(room, b);
  me.coins = 37;
  me.goldenPlutos = 2;
  me.hp = 13;
  me.inventory.push({ instanceId: "item-901", itemId: "mega-medkit" });
  const snapshot = structuredClone(me);
  rooms.disconnect(b.session, T0);
  rooms.tick(T0 + NETWORK_CONFIG.reconnectGraceMs - 1);
  assert.equal(guest(room, b).isBot, false);
  rooms.tick(T0 + NETWORK_CONFIG.reconnectGraceMs + 1);
  const seat = room.match.players.find((p) => p.id === b.session.id);
  assert.equal(room.match.players.length, 4, "no new player entity");
  assert.equal(seat.isBot, true);
  assert.equal(seat.botTakeover, true);
  for (const key of ["id", "name", "goldenPlutos", "currentNodeId", "statusEffects"])
    assert.deepEqual(seat[key], snapshot[key], key);
  // The bot now acts for the seat (medkit or roll): the match does not stall on a missing human.
  const phase = room.match.phase;
  for (let i = 2; i < 6; i++) rooms.tick(T0 + NETWORK_CONFIG.reconnectGraceMs + i * 700);
  assert.ok(room.match.phase !== phase || room.match.turn.hasRolled || room.match.log.length > 0);
  assert.ok(room.match.turn.hasRolled || activePlayer(room.match).id !== b.session.id);
  // Takeover-back: the human returns and reclaims the seat from the bot.
  const back = connect(rooms, b.session.token, "10.0.0.2", T0 + NETWORK_CONFIG.reconnectGraceMs + 10_000);
  const reclaimed = room.match.players.find((p) => p.id === b.session.id);
  assert.equal(reclaimed.isBot, false);
  assert.equal(reclaimed.botTakeover, false);
  assert.equal(back.last("SESSION").resumed, true);
});

test("an expired session (past the TTL) cannot reclaim anything and gets a fresh identity", () => {
  const { rooms, room, b } = matchRoom();
  rooms.disconnect(b.session, T0);
  rooms.tick(T0 + NETWORK_CONFIG.sessionTtlMs + 1);
  assert.equal(rooms.sessions.has(b.session.token), false);
  const fresh = connect(rooms, b.session.token, "10.0.0.2", T0 + NETWORK_CONFIG.sessionTtlMs + 2);
  assert.equal(fresh.last("SESSION").resumed, false);
  assert.notEqual(fresh.session.id, b.session.id);
  assert.equal(fresh.last("STATE").lobby, null);
  assert.equal(room.match.players.find((p) => p.id === b.session.id).isBot, true);
});

test("lobby: a disconnected player keeps seat, ready state and host role during the grace period", () => {
  const rooms = new PartyRooms(),
    a = connect(rooms),
    b = connect(rooms, undefined, "10.0.0.2");
  rooms.handle(a.session, { type: "CREATE", name: "Crew", playerName: "Host", public: true });
  const room = rooms.rooms.get(a.session.room);
  rooms.handle(b.session, { type: "JOIN", code: room.code, playerName: "Guest" });
  rooms.handle(a.session, { type: "READY", ready: true });
  rooms.disconnect(a.session, T0);
  rooms.tick(T0 + 30_000);
  assert.equal(room.hostId, a.session.id);
  assert.equal(room.players.find((p) => p.id === a.session.id).ready, true);
  connect(rooms, a.session.token, "10.0.0.1", T0 + 31_000);
  assert.equal(room.hostId, a.session.id);
  assert.equal(room.players.find((p) => p.id === a.session.id).ready, true);
  assert.equal(room.players.find((p) => p.id === a.session.id).connected, true);
});

test("lobby: after the grace period the ghost seat is released and the host moves to the oldest connected human", () => {
  const rooms = new PartyRooms(),
    a = connect(rooms),
    b = connect(rooms, undefined, "10.0.0.2"),
    c = connect(rooms, undefined, "10.0.0.3");
  rooms.handle(a.session, { type: "CREATE", name: "Crew", playerName: "Host", public: true });
  const room = rooms.rooms.get(a.session.room);
  rooms.handle(b.session, { type: "JOIN", code: room.code, playerName: "Bea" });
  rooms.handle(c.session, { type: "JOIN", code: room.code, playerName: "Cy" });
  rooms.disconnect(b.session, T0 - 1000); // Bea is also away (older disconnect)
  rooms.disconnect(a.session, T0);
  rooms.tick(T0 + NETWORK_CONFIG.reconnectGraceMs + 1);
  assert.deepEqual(room.players.map((p) => p.name), ["Cy"]);
  assert.equal(room.hostId, c.session.id);
  assert.equal(c.last("STATE").lobby.hostId, c.session.id);
});

test("active match: the host disconnecting never ends the match; after takeover the host role moves on", () => {
  const { rooms, room, a, b } = matchRoom();
  rooms.disconnect(a.session, T0);
  rooms.tick(T0 + 1000);
  assert.equal(room.hostId, a.session.id, "a briefly disconnected host keeps the role");
  rooms.tick(T0 + NETWORK_CONFIG.reconnectGraceMs + 1);
  assert.ok(rooms.rooms.has(room.code));
  assert.ok(room.match);
  assert.equal(room.match.players.find((p) => p.id === a.session.id).isBot, true);
  assert.equal(room.hostId, b.session.id, "someone can still return everyone to the lobby after the match");
});

test("a newer connection with the same token replaces the old one; the old socket is told and closed", () => {
  const rooms = new PartyRooms(),
    first = connect(rooms);
  rooms.handle(first.session, { type: "CREATE", name: "Crew", playerName: "Host", public: true });
  const second = connect(rooms, first.session.token);
  assert.equal(second.session, first.session);
  assert.equal(first.last("ERROR").code, "SESSION_REPLACED");
  assert.deepEqual(first.closes, [{ code: 4001, reason: "Session replaced" }]);
  assert.equal(second.last("SESSION").resumed, true);
  assert.ok(second.last("STATE").lobby);
  // Only the newest socket's sender is bound to the session.
  assert.equal(first.session.send, second.session.send);
});

// ---- Error isolation and bot fallbacks --------------------------------------------------------

test("one broken match is isolated: logged, retried, then returned to its lobby; other rooms keep running", () => {
  const broken = matchRoom(),
    healthy = matchRoom();
  // Put both rooms in the same authority.
  const rooms = broken.rooms;
  rooms.rooms.set(healthy.room.code, healthy.room);
  for (const s of healthy.rooms.sessions.values()) rooms.sessions.set(s.token, s);
  broken.room.match.phase = "MOVEMENT";
  broken.room.match.mapId = "no-such-map"; // advance() cannot resolve the map
  healthy.room.match.phase = "DICE_ROLL";
  healthy.room.match.movesRemaining = 0;
  assert.doesNotThrow(() => rooms.tick(T0));
  assert.equal(healthy.room.match.phase, "TURN_END");
  assert.ok(broken.room.match, "first failure is retried");
  rooms.tick(T0 + 700);
  rooms.tick(T0 + 1400);
  assert.equal(broken.room.match, null, "aborted after repeated failures");
  assert.ok(broken.room.players.every((p) => p.coins === RULES.coins && p.inventory.length === 0));
  assert.equal(broken.a.last("ERROR").code, "MATCH_ERROR");
  assert.ok(!/TypeError|stack|at /.test(broken.a.last("ERROR").message));
});

test("safeBotAction is always accepted in every decision phase reached by long seeded matches", () => {
  let checked = 0;
  for (const mapId of ["sunspill", "mountain"]) {
    const rng = seeded(mapId.length * 7),
      settings = { ...DEFAULT_SETTINGS, mapId },
      bots = Array.from({ length: 4 }, (_, i) => createPlayer(`s${i}`, `S${i}`, i, true));
    let s = createMatch(bots, settings, rng),
      now = T0;
    for (let i = 0; i < 4000 && s.phase !== "GAME_OVER" && s.round <= 6; i++) {
      now += ["MINIGAME", "DUEL_MINIGAME", "MINIGAME_INTRO", "DUEL_INTRO"].includes(s.phase) ? 250 : 700;
      let next = advance(s, settings, rng, now);
      if (next === s) {
        const safe = safeBotAction(s, mapOf(s));
        if (safe) {
          assert.doesNotThrow(() => applyAction(s, activePlayer(s).id, safe, settings, rng, now), `${s.phase} ${safe.type}`);
          checked++;
        }
        const action = botAction(s, mapOf(s), rng, settings, now);
        if (action) next = applyAction(s, activePlayer(s).id, action, settings, rng, now);
      }
      s = stepMinigameBots(next, now, rng).match;
    }
  }
  assert.ok(checked > 50, `checked ${checked} decisions`);
});

test("a bot seat whose decision throws or is rejected falls back to a safe legal action instead of stalling", () => {
  for (const decision of [
    () => {
      throw new TypeError("heuristic bug");
    },
    () => ({ type: "SELECT_PATH", nodeId: "not-a-node" }),
  ]) {
    const { room, b } = matchRoom();
    const rooms = new PartyRooms({ botDecision: decision });
    rooms.rooms.set(room.code, room);
    const host = room.match.players.find((p) => p.id === room.hostId);
    rooms.sessions.set("t", { token: "t", id: host.id, room: room.code, send: () => {}, close: null, disconnectedAt: null, address: "x" });
    const seat = guest(room, b);
    seat.isBot = true;
    const map = mapOf(room.match);
    const fork = map.nodes.find((n) => n.connections.length >= 3);
    seat.currentNodeId = fork.id;
    seat.previousNodeId = fork.connections[0];
    room.match.turn.hasRolled = true;
    room.match.movesRemaining = 2;
    room.match.phase = "PATH_SELECTION";
    const first = legalPaths(room.match, map)[0];
    rooms.tick(T0);
    assert.equal(guest(room, b).currentNodeId, first, "the seat moved along the first open route");
    assert.equal(room.match.movesRemaining, 1);
  }
});

// ---- Return to lobby / new match reset --------------------------------------------------------

test("return to lobby after GAME_OVER: host only, fresh players, ready reset, then a clean new match", () => {
  const { rooms, room, a, b } = matchRoom();
  const m = room.match;
  // Dirty every kind of live state.
  m.players[0].coins = 180;
  m.players[0].goldenPlutos = 4;
  m.players[1].hp = 3;
  m.players[1].inventory.push({ instanceId: "item-77", itemId: "comet-melon" });
  m.players[2].statusEffects.push({ id: "radiation", remainingTurns: 2 });
  m.bank = 44;
  m.round = 17;
  m.properties[0].ownerPlayerId = m.players[0].id;
  m.properties[0].level = 3;
  m.radiationZones.push({ id: "zone-1", sourcePlayerId: m.players[0].id, nodeIds: [mapOf(m).start], createdRound: 16, expiresAfterRound: 19 });
  m.animals.push({ id: "animal-1", type: "cheetah", ownerPlayerId: m.players[0].id, currentNodeId: mapOf(m).start, remainingRounds: 5, movementPerPhase: 5, damage: 10, sequence: 1 });
  m.blockedConnections.push({ id: "b1", fromNodeId: "x", toNodeId: "y", expiresAfterRound: 18, source: "avalanche" });
  m.phase = "GAME_OVER";
  m.winner = m.players[0].id;
  assert.throws(() => rooms.handle(b.session, { type: "RETURN_TO_LOBBY" }), /Only the host/);
  rooms.handle(a.session, { type: "RETURN_TO_LOBBY" });
  assert.equal(room.match, null);
  assert.equal(room.players.length, 4);
  for (const p of room.players) {
    assert.equal(p.coins, RULES.coins);
    assert.equal(p.goldenPlutos, 0);
    assert.equal(p.hp, RULES.hp);
    assert.deepEqual(p.inventory, []);
    assert.deepEqual(p.statusEffects, []);
    assert.equal(p.ready, p.isBot);
  }
  assert.equal(b.last("STATE").lobby.match, null);
  assert.throws(() => rooms.handle(a.session, { type: "RETURN_TO_LOBBY" }));
  rooms.handle(a.session, { type: "READY", ready: true });
  rooms.handle(b.session, { type: "READY", ready: true });
  rooms.handle(a.session, { type: "START" });
  const fresh = room.match;
  assert.equal(fresh.round, 1);
  assert.equal(fresh.bank, 0);
  assert.equal(fresh.phase, "START_ROLL");
  assert.deepEqual(fresh.radiationZones, []);
  assert.deepEqual(fresh.animals, []);
  assert.deepEqual(fresh.blockedConnections, []);
  assert.equal(fresh.minigame, null);
  assert.equal(fresh.duel, null);
  assert.ok(fresh.properties.every((p) => p.ownerPlayerId === null && p.level === 0));
  assert.ok(fresh.players.every((p) => p.coins === RULES.coins && p.inventory.length === 0));
  assert.ok(Object.values(fresh.stats).every((s) => s.minigameWins === 0 && s.knockouts === 0));
});

test("return to lobby releases seats that a bot had taken over", () => {
  const { rooms, room, a, b } = matchRoom();
  rooms.disconnect(b.session, T0);
  rooms.tick(T0 + NETWORK_CONFIG.reconnectGraceMs + 1);
  room.match.phase = "GAME_OVER";
  room.match.winner = a.session.id;
  rooms.handle(a.session, { type: "RETURN_TO_LOBBY" });
  assert.equal(room.players.some((p) => p.id === b.session.id), false);
  assert.equal(b.session.room, null);
  assert.equal(room.players.length, 3);
});

// ---- Validation, rate limits and codes ----------------------------------------------------------

test("names are cleaned and bounded; whitespace-only, oversized and control-character names are rejected", () => {
  assert.equal(cleanName("  Al\u0000ex ​  ", 24), "Alex");
  assert.equal(cleanName("a   b\tc", 24), "a b c");
  assert.equal(cleanName("   ", 24), null);
  assert.equal(cleanName("x".repeat(25), 24), null);
  assert.equal(cleanName("x".repeat(24), 24), "x".repeat(24));
  assert.equal(cleanName("🎉".repeat(24), 24), "🎉".repeat(24)); // counted as characters, not UTF-16 units
  assert.equal(cleanName(42, 24), null);
  assert.throws(() => parseMessage({ type: "CREATE", name: "  ", playerName: "A", public: true }), /Lobby names/);
  assert.throws(
    () => parseMessage({ type: "CREATE", name: "x".repeat(NAME_LIMITS.lobby + 1), playerName: "A", public: true }),
    /Lobby names/,
  );
  assert.throws(() => parseMessage({ type: "JOIN", code: "PLUTO-123456", playerName: "\u0000" }), /Explorer names/);
  const create = parseMessage({ type: "CREATE", name: " <b>Crew</b> ", playerName: "Ann", public: false, extra: 1 });
  assert.deepEqual(create, { type: "CREATE", name: "<b>Crew</b>", playerName: "Ann", public: false });
});

test("lobby codes normalize case, spacing and bare digits; anything else is rejected", () => {
  assert.equal(normalizeLobbyCode("pluto-482193"), "PLUTO-482193");
  assert.equal(normalizeLobbyCode(" 482193 "), "PLUTO-482193");
  assert.equal(normalizeLobbyCode("Pluto 482193"), "PLUTO-482193");
  for (const bad of ["PLUTO-12", "PLUTO-1234567", "HELLO", "", 482193, null])
    assert.equal(normalizeLobbyCode(bad), null);
  assert.throws(() => parseMessage({ type: "JOIN", code: "PLUTO-12", playerName: "A" }), /lobby code/);
});

test("malformed tokens are ignored, oversized/NaN/Infinity fields rejected, unknown message types refused", () => {
  assert.equal(parseMessage({ type: "HELLO", token: "not-a-uuid" }).token, undefined);
  assert.equal(parseMessage({ type: "HELLO", token: "x".repeat(5000) }).token, undefined);
  assert.deepEqual(parseMessage({ type: "RETURN_TO_LOBBY", foo: 1 }), { type: "RETURN_TO_LOBBY" });
  assert.deepEqual(parseMessage({ type: "PING" }), { type: "PING" });
  assert.throws(() => parseMessage({ type: "ACTION", action: { type: "SELECT_PATH", nodeId: "n".repeat(41) } }));
  for (const amount of [NaN, Infinity, -5, 0, 2.5, "5"])
    assert.throws(() =>
      parseMessage({ type: "ACTION", action: { type: "USE_ITEM", itemInstanceId: "item-1", wager: { type: "coins", amount } } }),
    );
  assert.throws(() => parseMessage({ type: "ACTION", action: { type: "FIRE_ITEM", aimX: NaN, aimY: 0 } }));
  assert.throws(() => parseMessage({ type: "GIVE_COINS", amount: 999 }));
  assert.throws(() => parseMessage([]));
});

test("join errors are specific; code lookups and lobby creation are rate limited per address", () => {
  const rooms = new PartyRooms(),
    host = connect(rooms, undefined, "1.1.1.1");
  rooms.handle(host.session, { type: "CREATE", name: "Crew", playerName: "Host", public: false });
  const room = rooms.rooms.get(host.session.room);
  const guestA = connect(rooms, undefined, "2.2.2.2");
  assert.throws(() => rooms.handle(guestA.session, { type: "JOIN", code: "PLUTO-000000", playerName: "G" }), (e) => e.code === "LOBBY_NOT_FOUND");
  for (let i = 1; i < NETWORK_CONFIG.codeLookupsPerMinute; i++)
    assert.throws(() => rooms.handle(guestA.session, { type: "JOIN", code: "PLUTO-000000", playerName: "G" }), (e) => e.code === "LOBBY_NOT_FOUND");
  assert.throws(() => rooms.handle(guestA.session, { type: "JOIN", code: room.code, playerName: "G" }), (e) => e.code === "RATE_LIMITED");
  // Searching by exact code costs a lookup too (private lobbies are discoverable only by code).
  assert.throws(() => rooms.handle(guestA.session, { type: "LIST", query: room.code }), (e) => e.code === "RATE_LIMITED");
  // Another address is unaffected, and the limit resets after a minute.
  const guestB = connect(rooms, undefined, "3.3.3.3");
  rooms.handle(guestB.session, parseMessage({ type: "JOIN", code: room.code.toLowerCase(), playerName: "B" }));
  assert.equal(room.players.length, 2);
  rooms.tick(Date.now() + 61_000);
  const creator = connect(rooms, undefined, "4.4.4.4");
  for (let i = 0; i < NETWORK_CONFIG.lobbyCreatesPerMinute; i++) {
    rooms.handle(creator.session, { type: "CREATE", name: `Crew ${i}`, playerName: "C", public: true });
    rooms.handle(creator.session, { type: "LEAVE" });
  }
  assert.throws(
    () => rooms.handle(creator.session, { type: "CREATE", name: "One more", playerName: "C", public: true }),
    (e) => e.code === "RATE_LIMITED",
  );
  room.match = createMatch(
    [...room.players, createPlayer("x1", "X1", 2, true), createPlayer("x2", "X2", 3, true)],
    room.settings,
    seeded(3),
  );
  const late = connect(rooms, undefined, "5.5.5.5");
  assert.throws(() => rooms.handle(late.session, { type: "JOIN", code: room.code, playerName: "L" }), (e) => e.code === "MATCH_STARTED");
});

test("a full lobby reports LOBBY_FULL", () => {
  const rooms = new PartyRooms(),
    host = connect(rooms, undefined, "1.1.1.1");
  rooms.handle(host.session, { type: "CREATE", name: "Crew", playerName: "Host", public: true });
  for (let i = 0; i < 3; i++) rooms.handle(host.session, { type: "ADD_BOT" });
  const g = connect(rooms, undefined, "9.9.9.9");
  assert.throws(() => rooms.handle(g.session, { type: "JOIN", code: host.session.room, playerName: "G" }), (e) => e.code === "LOBBY_FULL");
});

// ---- Long seeded all-bot matches ----------------------------------------------------------------

function simulate(mapId, victory, seed) {
  const map = mapRegistry.get(mapId),
    settings = { ...DEFAULT_SETTINGS, mapId, victory, plutoTarget: 3, coinTarget: 100 },
    rng = seeded(seed),
    bots = Array.from({ length: 4 }, (_, i) => {
      const p = createPlayer(`b${i}`, `Bot ${i}`, i, true);
      p.difficulty = ["easy", "medium", "hard", "hard"][i];
      return p;
    });
  let s = createMatch(bots, settings, rng),
    now = T0,
    steps = 0;
  const phases = new Set();
  while (s.phase !== "GAME_OVER" && s.round <= 60 && steps < 60_000) {
    steps++;
    now += ["MINIGAME", "DUEL_MINIGAME", "MINIGAME_INTRO", "DUEL_INTRO"].includes(s.phase) ? 250 : 700;
    let next = advance(s, settings, rng, now);
    if (next === s) {
      const action = botAction(s, map, rng, settings, now) ?? safeBotAction(s, map);
      if (action) next = applyAction(s, activePlayer(s).id, action, settings, rng, now);
    }
    next = stepMinigameBots(next, now, rng).match;
    s = next;
    phases.add(s.phase);
    // Invariants after every step.
    assert.equal(s.plutoNodeIds.length, map.goldenPlutoCount);
    assert.equal(new Set(s.plutoNodeIds).size, map.goldenPlutoCount);
    assert.ok(s.bank >= 0);
    for (const p of s.players) {
      assert.ok(Number.isInteger(p.coins) && p.coins >= 0, "coins");
      assert.ok(p.hp >= 1 && p.hp <= p.maxHp, `hp ${p.hp}`);
      assert.ok(p.goldenPlutos >= 0);
      assert.ok(p.inventory.length <= RULES.inventory);
      assert.ok(map.nodes.some((n) => n.id === p.currentNodeId), "on the board");
    }
    if (s.phase === "ITEM_PHASE") assert.equal(s.turn.hasRolled, false);
    if (!["MINIGAME_INTRO", "MINIGAME", "MINIGAME_RESULTS", "ROUND_END", "DUEL_INTRO", "DUEL_MINIGAME", "DUEL_RESULTS"].includes(s.phase))
      assert.equal(s.minigame, null, `stale minigame in ${s.phase}`);
    if (!["DUEL_INTRO", "DUEL_MINIGAME", "DUEL_RESULTS"].includes(s.phase)) assert.equal(s.duel, null);
    assert.ok(s.properties.every((pr) => pr.level >= 0 && pr.level <= 4));
    assert.ok(s.radiationZones.every((z) => z.expiresAfterRound >= s.round - 1));
  }
  return { s, settings, phases };
}
for (const [mapId, victory, seed] of [
  ["sunspill", "coins", 11],
  ["mountain", "coins", 12],
  ["sunspill", "plutos", 13],
  ["mountain", "plutos", 14],
])
  test(`seeded 4-bot ${mapId} ${victory} match runs to victory with no deadlock or invalid state`, () => {
    const { s, settings, phases } = simulate(mapId, victory, seed);
    assert.equal(s.phase, "GAME_OVER", `stuck in ${s.phase} at round ${s.round}`);
    const winner = s.players.find((p) => p.id === s.winner);
    assert.ok(
      victory === "coins" ? winner.coins >= settings.coinTarget : winner.goldenPlutos >= settings.plutoTarget,
    );
    for (const phase of ["ITEM_PHASE", "MOVEMENT", "ANIMAL_PHASE", "MINIGAME", "MINIGAME_RESULTS", "ROUND_END"])
      assert.ok(phases.has(phase), `never reached ${phase}`);
    const wins = Object.values(s.stats).reduce((n, st) => n + st.minigameWins, 0);
    assert.ok(wins >= s.round - 2 && wins <= s.round, `minigame wins ${wins} in ${s.round} rounds`);
  });

test("advance returns the same object (no clone) while a phase is waiting", () => {
  const settings = DEFAULT_SETTINGS;
  const bots = Array.from({ length: 4 }, (_, i) => createPlayer(`w${i}`, `W${i}`, i, true));
  let s = createMatch(bots, settings, seeded(5));
  for (let i = 0; i < 10 && s.phase === "START_ROLL"; i++) s = advance(s, settings, seeded(i), T0);
  assert.equal(s.phase, "ITEM_PHASE");
  assert.equal(advance(s, settings, seeded(1), T0), s);
});

// ---- Real sockets: health, flows and duplicate sessions ---------------------------------------

async function socketClient(url, token) {
  const socket = new WebSocket(url);
  await once(socket, "open");
  const messages = [];
  socket.on("message", (raw) => messages.push(JSON.parse(raw.toString())));
  const wait = async (predicate, ms = 3000) => {
    for (let t = 0; t < ms; t += 10) {
      const found = messages.findLast(predicate);
      if (found) return found;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error("Timed out waiting for a message");
  };
  socket.send(JSON.stringify({ type: "HELLO", token }));
  const session = await wait((m) => m.type === "SESSION");
  return { socket, messages, wait, session, send: (m) => socket.send(JSON.stringify(m)) };
}

test("health endpoint reports ok without internals; other paths are 404", async (t) => {
  const server = startPartyServer(0);
  t.after(() => server.close());
  await once(server.http, "listening");
  const base = `http://127.0.0.1:${server.http.address().port}`;
  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  const body = await health.json();
  assert.equal(body.status, "ok");
  assert.deepEqual(Object.keys(body).sort(), ["service", "status", "uptimeSeconds"]);
  assert.equal((await fetch(`${base}/secrets`)).status, 404);
});

test("socket flow: create → bots → Mountain match starts → refresh (new socket + token) restores the match", async (t) => {
  const server = startPartyServer(0);
  t.after(() => server.close());
  await once(server.http, "listening");
  const url = `ws://127.0.0.1:${server.http.address().port}/party-socket`;
  const host = await socketClient(url);
  host.send({ type: "CREATE", name: "Summit crew", playerName: "Climber", public: false });
  const created = await host.wait((m) => m.type === "STATE" && m.lobby);
  host.send({ type: "SETTINGS", settings: { ...created.lobby.settings, mapId: "mountain" } });
  await host.wait((m) => m.type === "STATE" && m.lobby?.settings.mapId === "mountain");
  host.send({ type: "READY", ready: true });
  await host.wait((m) => m.type === "STATE" && m.lobby?.players[0].ready);
  host.send({ type: "START" });
  const started = await host.wait((m) => m.type === "STATE" && m.lobby?.match);
  assert.equal(started.lobby.match.mapId, "mountain");
  assert.equal(started.lobby.match.plutoNodeIds.length, 1);
  assert.equal(started.lobby.players.filter((p) => p.isBot).length, 3);
  await host.wait((m) => m.type === "STATE" && m.lobby?.match?.phase !== "START_ROLL", 5000);
  // Simulated browser refresh: the socket drops, a new one presents the saved token.
  host.socket.terminate();
  await new Promise((r) => setTimeout(r, 50));
  const room = [...server.rooms.rooms.values()][0];
  assert.equal(room.players[0].connected, false);
  const again = await socketClient(url, host.session.token);
  assert.equal(again.session.resumed, true);
  assert.equal(again.session.playerId, host.session.playerId);
  const restored = await again.wait((m) => m.type === "STATE" && m.lobby?.match);
  assert.equal(restored.lobby.code, created.lobby.code);
  assert.equal(restored.lobby.match.mapId, "mountain");
  assert.equal(typeof restored.serverNow, "number");
  assert.equal(room.players[0].connected, true);
  again.socket.terminate();
});

test("socket: opening the same session twice keeps only the newest connection in control", async (t) => {
  const server = startPartyServer(0);
  t.after(() => server.close());
  await once(server.http, "listening");
  const url = `ws://127.0.0.1:${server.http.address().port}/party-socket`;
  const first = await socketClient(url);
  first.send({ type: "CREATE", name: "Tabs", playerName: "Twin", public: true });
  await first.wait((m) => m.type === "STATE" && m.lobby);
  const closed = once(first.socket, "close");
  const second = await socketClient(url, first.session.token);
  const replaced = await first.wait((m) => m.type === "ERROR");
  assert.equal(replaced.code, "SESSION_REPLACED");
  const [code] = await closed;
  assert.equal(code, 4001);
  assert.equal(second.session.resumed, true);
  second.send({ type: "READY", ready: true });
  await second.wait((m) => m.type === "STATE" && m.lobby?.players[0].ready);
  // The session stays connected (the replaced socket's close did not mark the player away).
  const room = [...server.rooms.rooms.values()][0];
  assert.equal(room.players[0].connected, true);
  second.send({ type: "PING" });
  await second.wait((m) => m.type === "PONG");
  second.socket.terminate();
});

test("socket: internal errors reach the client as a generic message without details", async (t) => {
  const server = startPartyServer(0);
  t.after(() => server.close());
  await once(server.http, "listening");
  const url = `ws://127.0.0.1:${server.http.address().port}/party-socket`;
  const client = await socketClient(url);
  const original = server.rooms.handle.bind(server.rooms);
  server.rooms.handle = () => {
    throw new TypeError("Cannot read properties of undefined (reading 'secret')");
  };
  client.send({ type: "LIST", query: "" });
  const error = await client.wait((m) => m.type === "ERROR");
  assert.equal(error.code, "SERVER_ERROR");
  assert.doesNotMatch(error.message, /secret|undefined|TypeError/);
  server.rooms.handle = original;
  client.socket.terminate();
});
