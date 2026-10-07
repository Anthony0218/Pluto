import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WebSocket } from "ws";
import { startEdravaneServer } from "../server/edravane/index.ts";
import { makeBattle } from "../src/games/MedievalKingdoms/edravane/battle.ts";
import { neighbors } from "../src/games/MedievalKingdoms/edravane/world.ts";
async function client(app) {
  if (!app.http.listening) await once(app.http, "listening");
  const ws = new WebSocket(
    `ws://127.0.0.1:${app.http.address().port}/edravane-socket`,
  );
  const messages = [];
  ws.on("message", (v) => messages.push(JSON.parse(v.toString())));
  await once(ws, "open");
  let seq = 0;
  return {
    ws,
    messages,
    send: (m) => ws.send(JSON.stringify(m)),
    command: (c) =>
      ws.send(JSON.stringify({ type: "command", seq: ++seq, command: c })),
    wait: async (predicate) => {
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline) {
        const found = messages.findLast(predicate);
        if (found) return found;
        await new Promise((r) => setTimeout(r, 15));
      }
      throw Error(
        `Message timeout: ${JSON.stringify(messages.at(-1)).slice(0, 300)}`,
      );
    },
  };
}
async function setup(t, persistence) {
  const app = startEdravaneServer(0, "127.0.0.1", persistence);
  t.after(() => app.close());
  const a = await client(app);
  a.send({ type: "create", nation: "auremarch", name: "Host" });
  const welcome = await a.wait((m) => m.type === "welcome");
  const b = await client(app);
  b.send({
    type: "join",
    nation: "high-cairn",
    name: "Guest",
    code: welcome.code,
  });
  await b.wait((m) => m.type === "welcome");
  await a.wait(
    (m) =>
      m.type === "snapshot" && m.room.slots.filter((s) => !s.bot).length === 2,
  );
  return {
    app,
    a,
    b,
    code: welcome.code,
    room: app.rooms.get(welcome.code),
    welcome,
  };
}
async function start(a, b) {
  a.send({ type: "ready", ready: true });
  b.send({ type: "ready", ready: true });
  await a.wait(
    (m) =>
      m.type === "snapshot" &&
      m.room.slots.filter((s) => s.player).every((s) => s.ready),
  );
  a.send({ type: "start" });
  return a.wait((m) => m.type === "snapshot" && m.room.state);
}
test("live insults give the recipient crown a verified war reason and remain subject to turn authority", async (t) => {
  const { a, b, room } = await setup(t);
  await start(a, b);
  a.command({ type: "war", nation: "high-cairn", reason: "insult" });
  assert.match(
    (await a.wait((m) => m.type === "error")).message,
    /no current evidence/,
  );
  b.command({ type: "insult", house: "auremarch-0" });
  assert.match(
    (await b.wait((m) => m.type === "error")).message,
    /not your turn/,
  );
  a.command({ type: "insult", house: "high-cairn-1" });
  await b.wait(
    (m) => m.type === "snapshot" && m.room.state?.insults?.length === 1,
  );
  assert.equal(room.state.insults[0].from, "auremarch-0");
  assert.equal(room.state.insults[0].to, "high-cairn-1");
  assert.equal(room.state.wars.length, 0);
  assert.equal(room.state.tick, 0);
  a.command({ type: "endTurn" });
  await b.wait((m) => m.type === "snapshot" && m.room.state?.tick === 1);
  const unrest = room.state.districts.map((d) => d.unrest);
  const loyalty = room.state.houses.map((h) => h.loyalty);
  b.command({ type: "war", nation: "auremarch", reason: "insult" });
  const response = await a.wait(
    (m) =>
      m.type === "snapshot" &&
      m.room.state?.turns.pending[0]?.reason === "insult",
  );
  const reaction = response.room.state.turns.pending[0];
  assert.equal(reaction.from, "high-cairn-0");
  assert.equal(reaction.to, "auremarch-0");
  assert.equal(room.state.warDeclarations.at(-1).reason, "insult");
  assert.deepEqual(
    room.state.districts.map((d) => d.unrest),
    unrest,
  );
  assert.deepEqual(
    room.state.houses.map((h) => h.loyalty),
    loyalty,
  );
  assert.equal(
    room.state.houses.find((h) => h.id === "high-cairn-0").unjustifiedWars,
    undefined,
  );
  assert.equal(room.state.insults[0].resolved, true);
});
test("two real connected clients, mixed eight-slot lobby, permissions, host settings, server authority, disconnect and full reconnect", async (t) => {
  const { app, a, b, code, room, welcome } = await setup(t);
  assert.equal(room.slots.length, 8);
  assert.equal(room.slots.filter((s) => s.bot).length, 6);
  b.send({ type: "start" });
  assert.match((await b.wait((m) => m.type === "error")).message, /host/);
  b.send({ type: "settings", tickSeconds: 4, maritimeHazard: 0 });
  assert.match(
    (await b.wait((m) => m.type === "error" && m.message.includes("settings")))
      .message,
    /Host/,
  );
  a.send({ type: "settings", tickSeconds: 4, maritimeHazard: 0 });
  await a.wait(
    (m) => m.type === "snapshot" && m.room.settings.tickSeconds === 4,
  );
  const snapshot = await start(a, b);
  assert.equal(snapshot.room.state.mode, "multi");
  assert.ok(
    !JSON.stringify(snapshot).includes(welcome.token),
    "Reconnect credential never broadcast",
  );
  assert.notEqual(snapshot.room.host, welcome.token);
  assert.equal(
    snapshot.room.state.houses.filter((h) =>
      h.reasons.includes("Human commander"),
    ).length,
    2,
  );
  a.command({ type: "move", army: "army-high-cairn-0", hex: "8:6" });
  assert.match((await a.wait((m) => m.type === "error")).message, /not under/);
  const destination = neighbors(room.state.districts, "8:6").find(
    (d) => d.owner,
  ).id;
  a.command({ type: "muster", army: "army-auremarch-0", count: 500 });
  const raised = await b.wait(
    (m) =>
      m.type === "snapshot" &&
      m.room.state?.armies.some(
        (a) => a.house === "auremarch-0" && !a.garrison,
      ),
  );
  const host = raised.room.state.armies.find(
    (a) => a.house === "auremarch-0" && !a.garrison,
  );
  a.command({ type: "move", army: host.id, hex: destination });
  await b.wait(
    (m) =>
      m.type === "snapshot" &&
      m.room.state?.armies.find((a) => a.id === host.id)?.path.length > 0,
  );
  b.command({ type: "pause", paused: true });
  assert.match(
    (await b.wait((m) => m.type === "error" && m.message.includes("End turn")))
      .message,
    /End turn/,
  );
  a.command({ type: "endTurn" });
  await b.wait(
    (m) =>
      m.type === "snapshot" &&
      m.room.state?.turns?.order[m.room.state.turns.index] === "high-cairn",
  );
  const bw = b.messages.find((m) => m.type === "welcome");
  b.ws.close();
  await once(b.ws, "close");
  await a.wait(
    (m) =>
      m.type === "snapshot" &&
      m.room.state &&
      m.room.slots.find((s) => s.nation === "high-cairn").bot,
  );
  assert.ok(
    !room.state.houses
      .find((h) => h.id === "high-cairn-0")
      .reasons.includes("Human commander"),
  );
  // Disconnecting the active player hands this explicit turn to a bot.
  await a.wait(
    (m) =>
      m.type === "snapshot" &&
      m.room.state?.routes.some((r) => r.house === "high-cairn-0"),
  );
  const c = await client(app);
  c.send({ type: "resume", token: bw.token, code });
  const returned = await c.wait(
    (m) =>
      m.type === "snapshot" &&
      m.room.slots.find((s) => s.nation === "high-cairn").connected,
  );
  assert.equal(returned.room.state.version, 2);
  assert.equal(returned.room.state.districts.length, 301);
  assert.equal(
    returned.room.slots.find((s) => s.nation === "high-cairn").bot,
    false,
  );
  const impostor = await client(app);
  impostor.send({ type: "resume", token: "invalid", code });
  assert.match(
    (await impostor.wait((m) => m.type === "error")).message,
    /Invalid reconnect/,
  );
});
test("multiplayer battle rounds hide plans, wait for both players and apply aftermath once without advancing campaign time", async (t) => {
  const { a, b, room } = await setup(t);
  await start(a, b);
  const s = room.state,
    x = s.armies.find((a) => a.house === "auremarch-0"),
    y = s.armies.find((a) => a.house === "high-cairn-0");
  const encounter = makeBattle(s, x, y, x.hex);
  s.battles.push(encounter);
  const tick = s.tick,
    stock = structuredClone(s.houses[0].stock);
  a.command({ type: "stand", battle: encounter.id, army: x.id });
  await a.wait(
    (m) =>
      m.type === "snapshot" && m.room.state?.battles[0]?.stood.includes(x.id),
  );
  assert.equal(room.state.battles[0].phase, "encounter");
  b.command({ type: "stand", battle: encounter.id, army: y.id });
  await a.wait(
    (m) =>
      m.type === "snapshot" && m.room.state?.battles[0]?.phase === "combat",
  );
  const plan = (army, round, order) => ({
    type: "battlePlan",
    battle: encounter.id,
    army,
    round,
    plan: { order, positions: {} },
  });
  a.command(plan(y.id, 1, "flank"));
  assert.match((await a.wait((m) => m.type === "error")).message, /not under/);
  a.command(plan(x.id, 1, "hold"));
  const hidden = await b.wait(
    (m) =>
      m.type === "snapshot" &&
      m.room.state?.battles[0]?.rounds.committed.includes(x.id),
  );
  assert.equal(hidden.room.state.battles[0].rounds.plans[x.id], undefined);
  assert.equal(room.state.battles[0].rounds.plans[x.id].order, "hold");
  const waiting = structuredClone(room.state);
  await new Promise((r) => setTimeout(r, 1100));
  assert.deepEqual(room.state, waiting);
  a.command(plan(x.id, 1, "flank"));
  assert.match(
    (await a.wait((m) => m.type === "error" && m.message.includes("committed")))
      .message,
    /committed/,
  );
  b.command(plan(y.id, 1, "advance"));
  await a.wait(
    (m) =>
      m.type === "snapshot" && m.room.state?.battles[0]?.rounds.round === 2,
  );
  assert.equal(room.state.tick, tick);
  assert.deepEqual(room.state.houses[0].stock, stock);
  a.command(plan(x.id, 1, "hold"));
  assert.match(
    (await a.wait((m) => m.type === "error" && m.message.includes("stale")))
      .message,
    /stale/,
  );
  a.command(plan(x.id, 2, "retreat"));
  b.command(plan(y.id, 2, "hold"));
  const ended = await a.wait(
    (m) =>
      m.type === "snapshot" &&
      m.room.state?.appliedResults.includes(encounter.id),
  );
  assert.equal(
    room.state.appliedResults.filter((id) => id === encounter.id).length,
    1,
  );
  assert.equal(room.state.tick, tick);
  assert.ok(
    ended.room.state.battleReports[0].sides.some((side) => side.wounded > 0),
  );
  a.command(plan(x.id, 2, "retreat"));
  assert.match(
    (await a.wait((m) => m.type === "error" && m.message.includes("encounter")))
      .message,
    /active/,
  );
});
test("network rewards cannot be replayed or claimed by another client; durable restart snapshot", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "edravane-test-"));
  const { app, a, b, room, welcome } = await setup(t, directory);
  await start(a, b);
  a.command({ type: "challenge", hex: "8:6" });
  const snap = await a.wait(
    (m) => m.type === "snapshot" && m.room.state?.challenges.length === 1,
  );
  const c = snap.room.state.challenges[0];
  b.command({ type: "answer", challenge: c.id, choice: c.answer });
  assert.match(
    (await b.wait((m) => m.type === "error")).message,
    /not your turn|unclaimed/,
  );
  a.command({ type: "answer", challenge: c.id, choice: c.answer });
  await a.wait(
    (m) => m.type === "snapshot" && m.room.state?.challenges[0]?.done,
  );
  const reward = room.state.rewards["auremarch-0|8:6"];
  assert.equal(reward.count, 1);
  a.command({ type: "answer", challenge: c.id, choice: c.answer });
  assert.match((await a.wait((m) => m.type === "error")).message, /unclaimed/);
  assert.equal(room.state.rewards["auremarch-0|8:6"].count, 1);
  await app.close(); // remove the registered close callback before opening a new instance
  const second = startEdravaneServer(0, "127.0.0.1", directory);
  t.after(async () => {
    await second.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const restored = await client(second);
  restored.send({ type: "resume", token: welcome.token, code: welcome.code });
  const result = await restored.wait((m) => m.type === "snapshot");
  assert.equal(result.room.state.rewards["auremarch-0|8:6"].count, 1);
  assert.equal(result.room.state.challenges[0]?.done, true);
});
test("nation switching, ready reset, occupied-slot rejection and lobby host migration", async (t) => {
  const { a, b, room } = await setup(t);
  b.send({ type: "ready", ready: true });
  await b.wait(
    (m) =>
      m.type === "snapshot" &&
      m.room.slots.find((s) => s.nation === "high-cairn").ready,
  );
  b.send({ type: "select", nation: "saltmere" });
  await b.wait((m) => m.type === "welcome" && m.nation === "saltmere");
  assert.equal(room.slots.find((s) => s.nation === "high-cairn").bot, true);
  assert.equal(room.slots.find((s) => s.nation === "saltmere").ready, false);
  b.send({ type: "select", nation: "auremarch" });
  assert.match((await b.wait((m) => m.type === "error")).message, /occupied/);
  const bw = b.messages.findLast((m) => m.type === "welcome");
  a.ws.close();
  await once(a.ws, "close");
  await b.wait((m) => m.type === "snapshot" && m.room.host === bw.player);
  b.send({ type: "ready", ready: true });
  await b.wait(
    (m) =>
      m.type === "snapshot" &&
      m.room.slots.find((s) => s.nation === "saltmere").ready,
  );
  b.send({ type: "start" });
  await b.wait((m) => m.type === "snapshot" && m.room.state);
  assert.equal(
    room.state.houses.filter((h) => h.reasons.includes("Human commander"))
      .length,
    1,
  );
  assert.ok(
    room.state.houses
      .find((h) => h.id === "saltmere-0")
      .reasons.includes("Human commander"),
  );
});

test("two clients wait on human turns and exchange war, peace and marriage responses authoritatively", async (t) => {
  const { a, b, room } = await setup(t);
  await start(a, b);
  await new Promise((r) => setTimeout(r, 1200));
  assert.equal(room.state.tick, 0);
  assert.equal(room.state.turns.round, 1);
  b.command({ type: "endTurn" });
  assert.match(
    (await b.wait((m) => m.type === "error")).message,
    /not your turn/,
  );
  a.command({ type: "war", nation: "high-cairn" });
  const offered = await b.wait(
    (m) =>
      m.type === "snapshot" && m.room.state?.turns.pending[0]?.kind === "war",
  );
  const war = offered.room.state.turns.pending[0];
  assert.equal(war.to, "high-cairn-0");
  a.command({ type: "respond", reaction: war.id, choice: "defend" });
  assert.match(
    (await a.wait((m) => m.type === "error" && m.message.includes("receiving")))
      .message,
    /receiving/,
  );
  b.command({ type: "respond", reaction: war.id, choice: "peace" });
  const peace = (
    await a.wait(
      (m) =>
        m.type === "snapshot" &&
        m.room.state?.turns.pending[0]?.kind === "peace",
    )
  ).room.state.turns.pending[0];
  a.command({ type: "respond", reaction: peace.id, choice: "accept" });
  await b.wait(
    (m) =>
      m.type === "snapshot" &&
      m.room.state?.turns.pending.length === 0 &&
      m.room.state.wars.length === 0 &&
      m.room.state.log.some((l) => l.includes("accepted peace")),
  );
  assert.equal(room.state.tick, 0);
  a.command({ type: "marry", house: "high-cairn-0" });
  const marriage = (
    await b.wait(
      (m) =>
        m.type === "snapshot" &&
        m.room.state?.turns.pending[0]?.kind === "marriage",
    )
  ).room.state.turns.pending[0];
  assert.ok(!room.state.houses[0].family.some((p) => p.spouse));
  b.command({ type: "respond", reaction: marriage.id, choice: "accept" });
  await a.wait(
    (m) =>
      m.type === "snapshot" &&
      m.room.state?.houses[0].family.some((p) => p.spouse),
  );
  assert.equal(room.state.turns.pending.length, 0);
  a.command({ type: "endTurn" });
  await b.wait(
    (m) =>
      m.type === "snapshot" &&
      m.room.state?.tick === 1 &&
      m.room.state.turns.order[m.room.state.turns.index] === "high-cairn",
  );
  await new Promise((r) => setTimeout(r, 700));
  assert.equal(room.state.tick, 1, "human turns have no wall-clock timeout");
  b.command({ type: "endTurn" });
  await a.wait(
    (m) =>
      m.type === "snapshot" &&
      m.room.state?.turns.round === 2 &&
      m.room.state.turns.order[m.room.state.turns.index] === "auremarch",
  );
  assert.equal(room.state.tick, 8);
});

test("an actual network invasion waits for the defender before occupation and turn handoff", async (t) => {
  const { a, b, room } = await setup(t);
  await start(a, b);
  const target = neighbors(room.state.districts, "8:6").find((d) => d.owner);
  target.owner = "high-cairn-0";
  const defender = room.state.armies.find((a) => a.id === "army-high-cairn-0");
  defender.hex = target.id;
  defender.troops = {
    levies: 500,
    spearmen: 0,
    archers: 0,
    heavy: 0,
    cavalry: 0,
  };
  a.command({ type: "muster", army: "army-auremarch-0", count: 500 });
  const host = (
    await a.wait(
      (m) =>
        m.type === "snapshot" &&
        m.room.state?.armies.some(
          (a) => a.house === "auremarch-0" && !a.garrison,
        ),
    )
  ).room.state.armies.find((a) => a.house === "auremarch-0" && !a.garrison);
  a.command({ type: "war", nation: "high-cairn" });
  const declaration = (
    await b.wait(
      (m) =>
        m.type === "snapshot" && m.room.state?.turns.pending[0]?.kind === "war",
    )
  ).room.state.turns.pending[0];
  b.command({ type: "respond", reaction: declaration.id, choice: "defend" });
  await a.wait(
    (m) =>
      m.type === "snapshot" &&
      m.room.state?.wars.length === 1 &&
      m.room.state.turns.pending.length === 0,
  );
  a.command({ type: "move", army: host.id, hex: target.id });
  a.command({ type: "endTurn" });
  const attack = (
    await b.wait(
      (m) =>
        m.type === "snapshot" &&
        m.room.state?.turns.pending[0]?.kind === "attack",
    )
  ).room.state.turns.pending[0];
  assert.equal(
    room.state.districts.find((d) => d.id === target.id).occupation,
    undefined,
  );
  assert.notEqual(
    room.state.armies.find((a) => a.id === host.id).hex,
    target.id,
  );
  await new Promise((r) => setTimeout(r, 550));
  assert.equal(room.state.tick, 1);
  assert.equal(room.state.turns.pending[0].id, attack.id);
  b.command({ type: "respond", reaction: attack.id, choice: "withdraw" });
  await a.wait(
    (m) =>
      m.type === "snapshot" &&
      m.room.state?.districts.find((d) => d.id === target.id).occupation ===
        "auremarch-0",
  );
  assert.equal(room.state.turns.order[room.state.turns.index], "high-cairn");
  assert.equal(room.state.tick, 1);
  assert.equal(room.state.turns.pending.length, 0);
});

test("a real player can blockade neutral trade and the affected crown declares an evidenced war", async (t) => {
  const { a, b, room } = await setup(t);
  await start(a, b);
  a.command({ type: "war", nation: "high-cairn", reason: "trade-blockade" });
  assert.match(
    (await a.wait((m) => m.type === "error" && m.message.includes("evidence")))
      .message,
    /evidence/,
  );
  assert.equal(room.state.wars.length, 0);
  const from = room.state.districts.find(
    (d) => d.owner === "auremarch-0" && d.seat === "capital",
  );
  const to = room.state.districts.find(
    (d) => d.owner === "high-cairn-0" && d.seat === "capital",
  );
  a.command({
    type: "route",
    from: from.id,
    to: to.id,
    resource: "grain",
    maritime: false,
    import: true,
  });
  await a.wait(
    (m) =>
      m.type === "snapshot" &&
      m.room.state?.routes.some((r) => r.house === "auremarch-0"),
  );
  a.command({ type: "endTurn" });
  await b.wait(
    (m) =>
      m.type === "snapshot" &&
      m.room.state?.turns.order[m.room.state.turns.index] === "high-cairn",
  );
  b.command({ type: "muster", army: "army-high-cairn-0", count: 500 });
  const host = (
    await b.wait(
      (m) =>
        m.type === "snapshot" &&
        m.room.state?.armies.some(
          (a) => a.house === "high-cairn-0" && !a.garrison,
        ),
    )
  ).room.state.armies.find((a) => a.house === "high-cairn-0" && !a.garrison);
  b.command({ type: "blockade", army: host.id, enabled: true });
  await a.wait(
    (m) =>
      m.type === "snapshot" &&
      m.room.state?.armies.find((a) => a.id === host.id)?.blockading,
  );
  b.command({ type: "endTurn" });
  await a.wait(
    (m) =>
      m.type === "snapshot" &&
      m.room.state?.turns.round === 2 &&
      m.room.state.turns.order[m.room.state.turns.index] === "auremarch",
  );
  assert.match(
    room.state.routes.find((r) => r.house === "auremarch-0").status,
    /Blockaded/,
  );
  const unrest = room.state.districts.map((d) => d.unrest),
    loyalty = room.state.houses.map((h) => h.loyalty);
  a.command({ type: "war", nation: "high-cairn", reason: "trade-blockade" });
  const reply = (
    await b.wait(
      (m) =>
        m.type === "snapshot" &&
        m.room.state?.turns.pending[0]?.reason === "trade-blockade",
    )
  ).room.state;
  assert.deepEqual(
    reply.districts.map((d) => d.unrest),
    unrest,
  );
  assert.deepEqual(
    reply.houses.map((h) => h.loyalty),
    loyalty,
  );
  assert.equal(reply.turns.pending[0].to, "high-cairn-0");
});
