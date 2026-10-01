import test from "node:test";
import assert from "node:assert/strict";
import { chooseBotAction, createGame, getPlayerView, performAction } from "../src/games/cards/engine/index.ts";
import { durakTemplate as durak, highCardBattleTemplate as hcb } from "../src/games/cards/templates/index.ts";
import { freeSeat, normalizeRoomCode, planRoomSeats, ROOM_CODE, roomCode } from "../src/games/cards/rooms.ts";

test("room codes are six unambiguous characters", () => {
  for (let i = 0; i < 200; i++) assert.match(roomCode(), ROOM_CODE);
  assert.equal(normalizeRoomCode(" ab-c 12x9 "), "ABC12X");
  assert.doesNotMatch("ABCDE1", ROOM_CODE, "no 0/1/O/I lookalikes");
});

test("newcomers take the lowest free seat until the room is full", () => {
  assert.equal(freeSeat(3, []), 0);
  assert.equal(freeSeat(3, [0, 2]), 1, "a seat freed by someone leaving is reused");
  assert.equal(freeSeat(3, [0, 1, 2]), null);
});

test("humans keep their seats and every empty seat becomes a bot", () => {
  const { seats, bots } = planRoomSeats(4, [
    { seat: 0, name: "Alice" },
    { seat: 2, name: "Bob" },
  ]);
  assert.deepEqual(
    seats.map((seat) => [seat.id, seat.name, Boolean(seat.isBot)]),
    [
      ["seat-0", "Alice", false],
      ["seat-1", "Bot 1", true],
      ["seat-2", "Bob", false],
      ["seat-3", "Bot 2", true],
    ],
  );
  assert.deepEqual(bots, [
    { seat: 1, name: "Bot 1" },
    { seat: 3, name: "Bot 2" },
  ]);
});

test("seat N in the room is state.players[N], so the server can map an account to its player", () => {
  const def = hcb;
  const { seats } = planRoomSeats(def.players.max, [
    { seat: 0, name: "Alice" },
    { seat: 1, name: "Bob" },
  ]);
  let state = createGame(def, { players: seats, seed: 11 });
  for (const [index, player] of state.players.entries()) {
    assert.equal(player.seat, index);
    assert.equal(player.id, `seat-${index}`);
  }

  // Play the whole game through seat ids, like `act` does.
  for (let step = 0; step < 5000 && state.status === "playing"; step++) {
    const actor = state.players.find((player) => chooseBotAction(def, state, player.id));
    assert.ok(actor, "someone can always act while the game runs");
    const result = performAction(def, state, actor.id, chooseBotAction(def, state, actor.id), { expectedRevision: state.revision });
    assert.ok(result.ok, result.error);
    state = result.state;
  }
  assert.equal(state.status, "finished");
});

test("each seat only sees its own hand", () => {
  const { seats } = planRoomSeats(durak.players.min, [
    { seat: 0, name: "Alice" },
    { seat: 1, name: "Bob" },
  ]);
  const state = createGame(durak, { players: seats, seed: 5 });
  const hand = (view, id) => view.zones[`hand:${id}`].cards;
  const alice = getPlayerView(durak, state, "seat-0");
  const bob = getPlayerView(durak, state, "seat-1");
  assert.ok(hand(alice, "seat-0").every((id) => alice.cards[id]), "Alice sees her own cards");
  assert.ok(hand(alice, "seat-1").every((id) => id.startsWith("hidden-")), "…but not Bob's");
  assert.ok(hand(bob, "seat-0").every((id) => id.startsWith("hidden-")));
  assert.equal(alice.rng.state, 0, "the shuffle state never reaches a client");
});
