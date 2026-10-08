import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { PartyRooms } from "../server/party/rooms.ts";
import { startPartyServer } from "../server/party/index.ts";
const connect = (rooms) => {
  const messages = [];
  const session = rooms.connect(undefined, (m) =>
    messages.push(structuredClone(m)),
  );
  return { session, messages };
};
const create = (rooms, s, publicRoom = true) => {
  rooms.handle(s, {
    type: "CREATE",
    name: "Island crew",
    playerName: "Host",
    public: publicRoom,
  });
  return rooms.rooms.get(s.room);
};
test("private lobbies only discoverable with exact code; public search works", () => {
  const rooms = new PartyRooms(),
    a = connect(rooms),
    b = connect(rooms);
  const room = create(rooms, a.session, false);
  rooms.handle(b.session, { type: "LIST", query: "" });
  assert.equal(b.messages.at(-1).lobbies.length, 0);
  rooms.handle(b.session, { type: "LIST", query: "Island" });
  assert.equal(b.messages.at(-1).lobbies.length, 0);
  rooms.handle(b.session, { type: "LIST", query: room.code });
  assert.equal(b.messages.at(-1).lobbies.length, 1);
});
test("host permissions, readiness, settings reset, exactly four slots, bot controls", () => {
  const rooms = new PartyRooms(),
    a = connect(rooms),
    b = connect(rooms),
    room = create(rooms, a.session);
  rooms.handle(b.session, {
    type: "JOIN",
    code: room.code,
    playerName: "Guest",
  });
  assert.throws(() => rooms.handle(b.session, { type: "ADD_BOT" }));
  assert.throws(() => rooms.handle(b.session, { type: "START" }));
  assert.throws(() => rooms.handle(a.session, { type: "START" }));
  rooms.handle(a.session, { type: "READY", ready: true });
  rooms.handle(b.session, { type: "READY", ready: true });
  rooms.handle(a.session, {
    type: "SETTINGS",
    settings: { ...room.settings, victory: "coins" },
  });
  assert.ok(room.players.every((p) => !p.ready));
  rooms.handle(a.session, { type: "READY", ready: true });
  rooms.handle(b.session, { type: "READY", ready: true });
  rooms.handle(a.session, { type: "START" });
  assert.equal(room.players.length, 4);
  assert.equal(room.players.filter((p) => p.isBot).length, 2);
  assert.equal(room.match.phase, "START_ROLL");
  assert.throws(() => rooms.handle(a.session, { type: "ADD_BOT" }));
  assert.throws(() =>
    rooms.handle(b.session, {
      type: "JOIN",
      code: room.code,
      playerName: "Guest",
    }),
  );
});
test("kicking clears session and host transfer works", () => {
  const rooms = new PartyRooms(),
    a = connect(rooms),
    b = connect(rooms),
    room = create(rooms, a.session);
  rooms.handle(b.session, {
    type: "JOIN",
    code: room.code,
    playerName: "Guest",
  });
  rooms.handle(a.session, { type: "REMOVE", playerId: b.session.id });
  assert.equal(b.session.room, null);
  assert.equal(room.players.length, 1);
  rooms.handle(b.session, {
    type: "JOIN",
    code: room.code,
    playerName: "Guest",
  });
  rooms.leave(a.session);
  assert.equal(room.hostId, b.session.id);
});
test("reconnect preserves identity and full state, disconnected player becomes bot then can reclaim", () => {
  const rooms = new PartyRooms(),
    a = connect(rooms),
    b = connect(rooms),
    room = create(rooms, a.session);
  rooms.handle(b.session, {
    type: "JOIN",
    code: room.code,
    playerName: "Guest",
  });
  rooms.handle(a.session, { type: "READY", ready: true });
  rooms.handle(b.session, { type: "READY", ready: true });
  rooms.handle(a.session, { type: "START" });
  rooms.disconnect(b.session);
  rooms.tick(Date.now() + 61_000);
  assert.ok(room.players.find((p) => p.id === b.session.id).isBot);
  const received = [];
  const reconnected = rooms.connect(b.session.token, (m) => received.push(m));
  assert.equal(reconnected.id, b.session.id);
  assert.equal(room.players.find((p) => p.id === b.session.id).isBot, false);
  assert.equal(received.at(-1).lobby.code, room.code);
});
test("invalid token cannot claim existing player identity", () => {
  const rooms = new PartyRooms(),
    a = connect(rooms);
  const b = rooms.connect("not-the-token", () => {});
  assert.notEqual(a.session.id, b.id);
});
test("actual WebSocket handshake, malformed input and lobby roundtrip", async (t) => {
  const server = startPartyServer(0);
  t.after(() => server.close());
  await once(server.http, "listening");
  const port = server.http.address().port;
  const ws = new WebSocket(`ws://127.0.0.1:${port}/party-socket`);
  await once(ws, "open");
  const messages = [];
  ws.on("message", (raw) => messages.push(JSON.parse(raw.toString())));
  const waitFor = async (predicate) => {
    for (let i = 0; i < 100; i++) {
      const found = messages.find(predicate);
      if (found) return found;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error("Timed out waiting for message");
  };
  try {
    ws.send("not json");
    await waitFor((m) => m.type === "ERROR");
    ws.send(JSON.stringify({ type: "HELLO" }));
    await waitFor((m) => m.type === "SESSION");
    ws.send(
      JSON.stringify({
        type: "CREATE",
        name: "Socket crew",
        playerName: "Captain",
        public: true,
      }),
    );
    const state = await waitFor((m) => m.type === "STATE" && m.lobby);
    assert.equal(state.lobby.players[0].name, "Captain");
    assert.equal(state.lobby.match, null);
  } finally {
    ws.terminate();
    server.close();
  }
});

test("WebSocket purchase broadcasts identical state, rejects duplicates and survives reconnect at an offer", async (t) => {
  const server = startPartyServer(0);
  t.after(() => server.close());
  await once(server.http, "listening");
  const url = `ws://127.0.0.1:${server.http.address().port}/party-socket`;
  async function client(token) {
    const socket = new WebSocket(url);
    await once(socket, "open");
    const messages = [];
    socket.on("message", (raw) => messages.push(JSON.parse(raw.toString())));
    const send = (msg) => socket.send(JSON.stringify(msg));
    const wait = async (predicate) => {
      for (let i = 0; i < 150; i++) {
        const match = messages.find(predicate);
        if (match) return match;
        await new Promise((r) => setTimeout(r, 10));
      }
      throw new Error("Socket response timeout");
    };
    send({ type: "HELLO", token });
    const session = await wait((m) => m.type === "SESSION");
    return { socket, messages, send, wait, session };
  }
  const host = await client();
  host.send({
    type: "CREATE",
    name: "Golden test",
    playerName: "Buyer",
    public: true,
  });
  const created = await host.wait((m) => m.type === "STATE" && m.lobby);
  const code = created.lobby.code;
  server.rooms.rooms.get(code).settings.roundLimit = 0;
  const guest = await client();
  guest.send({ type: "JOIN", code, playerName: "Observer" });
  await guest.wait((m) => m.type === "STATE" && m.lobby?.players.length === 2);
  host.send({ type: "READY", ready: true });
  guest.send({ type: "READY", ready: true });
  await host.wait(
    (m) =>
      m.type === "STATE" &&
      m.lobby?.players.filter((p) => p.ready).length === 2,
  );
  host.send({ type: "START" });
  await host.wait((m) => m.type === "STATE" && m.lobby?.match);
  const room = server.rooms.rooms.get(code),
    s = room.match;
  s.phase = "PLUTO_OFFER";
  s.order = s.players.map((p) => p.id);
  s.turnIndex = 0;
  s.players[0].currentNodeId = s.plutoNodeIds[0];
  s.players[0].coins = 20;
  s.players[0].goldenPlutos = 4;
  server.rooms.broadcast(room);
  const token = host.session.token;
  host.socket.close();
  await once(host.socket, "close");
  const resumed = await client(token);
  const restored = await resumed.wait(
    (m) => m.type === "STATE" && m.lobby?.match?.phase === "PLUTO_OFFER",
  );
  assert.equal(restored.lobby.match.players[0].coins, 20);
  guest.send({ type: "ACTION", action: { type: "BUY_PLUTO" } });
  await guest.wait((m) => m.type === "ERROR" && m.message.includes("turn"));
  resumed.send({
    type: "ACTION",
    action: { type: "BUY_PLUTO", price: 0, goldenPlutos: 999 },
  });
  const won = await resumed.wait(
    (m) => m.type === "STATE" && m.lobby?.match?.phase === "GAME_OVER",
  );
  const observed = await guest.wait(
    (m) => m.type === "STATE" && m.lobby?.match?.phase === "GAME_OVER",
  );
  assert.deepEqual(won.lobby.match, observed.lobby.match);
  assert.equal(won.lobby.match.players[0].coins, 0);
  assert.equal(won.lobby.match.players[0].goldenPlutos, 5);
  assert.equal(won.lobby.match.plutoNodeIds.length, 2);
  resumed.send({ type: "ACTION", action: { type: "BUY_PLUTO" } });
  await resumed.wait((m) => m.type === "ERROR");
  assert.equal(room.match.players[0].goldenPlutos, 5);
});
