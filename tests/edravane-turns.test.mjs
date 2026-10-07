import test from "node:test";
import assert from "node:assert/strict";
import {
  createCampaign,
  applyCommand,
  dispatchCommand,
  runAutomaticTurns,
  advanceCampaign,
  loadSave,
} from "../src/games/MedievalKingdoms/edravane/simulation.ts";
import {
  activeTurnHouse,
  defendingArmies,
} from "../src/games/MedievalKingdoms/edravane/turns.ts";
import {
  NATIONS,
  neighbors,
} from "../src/games/MedievalKingdoms/edravane/world.ts";
import {
  autoResolve,
  troopCount,
} from "../src/games/MedievalKingdoms/edravane/battle.ts";
const aure = { house: "auremarch-0" },
  cairn = { house: "high-cairn-0" };
function twoHumans() {
  const s = createCampaign();
  s.houses.find((h) => h.id === cairn.house).reasons.push("Human commander");
  return s;
}
const act = (s, c, actor = aure) => applyCommand(s, actor, c);
function invasion() {
  let s = twoHumans();
  s = act(s, { type: "muster", army: "army-auremarch-0", count: 500 });
  const a = s.armies.find((a) => !a.garrison && a.house === aure.house);
  const d = neighbors(s.districts, a.hex).find(
    (d) => d.owner && d.id !== "9:4",
  );
  d.owner = cairn.house;
  d.castle = { level: 1 };
  const defender = s.armies.find((a) => a.id === "army-high-cairn-0");
  defender.hex = d.id;
  defender.troops = {
    levies: 500,
    spearmen: 0,
    archers: 0,
    heavy: 0,
    cavalry: 0,
  };
  s = act(s, { type: "war", nation: "high-cairn" });
  s = act(
    s,
    { type: "respond", reaction: s.turns.pending[0].id, choice: "defend" },
    cairn,
  );
  s = act(s, { type: "move", army: a.id, hex: d.id });
  s = act(s, { type: "endTurn" });
  return { s, attacker: a.id, hex: d.id, defender: defender.id };
}

test("every chosen crown starts its own turn and neither clock calls nor bot pumping advance a human turn", () => {
  for (const n of NATIONS) {
    const s = createCampaign(n.id);
    assert.equal(activeTurnHouse(s), `${n.id}-0`);
    assert.equal(s.turns.round, 1);
    assert.deepEqual(advanceCampaign(s), s);
    assert.deepEqual(runAutomaticTurns(s), s);
  }
});

test("out-of-turn economics, diplomacy and ending are rejected without mutation", () => {
  const s = twoHumans(),
    before = JSON.stringify(s);
  for (const command of [
    { type: "endTurn" },
    { type: "war", nation: "auremarch" },
    { type: "harvest", hex: NATIONS[1].capital },
    { type: "muster", army: "army-high-cairn-0", count: 500 },
  ])
    assert.throws(() => act(s, command, cairn), /not your turn/);
  assert.equal(JSON.stringify(s), before);
  assert.throws(() => act(s, { type: "pause", paused: true }), /End turn/);
});

test("End turn commits movement once, hands control to the next human and leaves foreign orders queued", () => {
  let s = twoHumans();
  s = act(s, { type: "muster", army: "army-auremarch-0", count: 500 });
  const a = s.armies.find((a) => !a.garrison),
    target = neighbors(s.districts, a.hex).find((d) => d.owner === aure.house);
  s = act(s, { type: "move", army: a.id, hex: target.id });
  assert.equal(s.armies.find((v) => v.id === a.id).hex, a.hex);
  const foreign = s.armies.find((a) => a.id === "army-high-cairn-0");
  foreign.garrison = false;
  foreign.path = [neighbors(s.districts, foreign.hex).find((d) => d.owner).id];
  const foreignHex = foreign.hex;
  s = dispatchCommand(s, aure, { type: "endTurn" });
  assert.equal(s.tick, 1);
  assert.equal(activeTurnHouse(s), cairn.house);
  assert.equal(s.armies.find((v) => v.id === a.id).hex, target.id);
  assert.equal(s.armies.find((v) => v.id === foreign.id).hex, foreignHex);
  assert.equal(s.armies.find((v) => v.id === foreign.id).path.length, 1);
  assert.deepEqual(runAutomaticTurns(s), s);
  assert.throws(() => act(s, { type: "endTurn" }), /not your turn/);
});

test("single-player bots each take one turn and then wait for the player again", () => {
  const s = dispatchCommand(createCampaign(), aure, { type: "endTurn" });
  assert.equal(s.tick, 8);
  assert.equal(s.turns.round, 2);
  assert.equal(activeTurnHouse(s), aure.house);
  assert.equal(s.turns.pending.length, 0);
  assert.ok(
    s.routes.some((r) => r.house === cairn.house),
    "bots establish trade on their actual turns",
  );
  assert.deepEqual(runAutomaticTurns(s), s);
});

test("marriage is a consent-based proposal, blocks unrelated actions, and accepts only the named heirs once", () => {
  let s = twoHumans();
  s = act(s, { type: "marry", house: cairn.house });
  const r = s.turns.pending[0];
  assert.equal(r.kind, "marriage");
  assert.equal(s.houses[0].treasury, 390);
  assert.ok(!s.houses[0].family.some((p) => p.spouse));
  assert.throws(() => act(s, { type: "endTurn" }), /other player/);
  assert.throws(
    () => act(s, { type: "respond", reaction: r.id, choice: "accept" }),
    /receiving player/,
  );
  assert.throws(
    () =>
      act(s, { type: "muster", army: "army-high-cairn-0", count: 500 }, cairn),
    /pending response/,
  );
  s = act(s, { type: "respond", reaction: r.id, choice: "accept" }, cairn);
  assert.equal(
    s.houses[0].family.find((p) => p.id === r.people[0]).spouse,
    r.people[1],
  );
  assert.equal(
    s.houses.find((h) => h.id === cairn.house).relations[aure.house],
    25,
  );
  assert.equal(activeTurnHouse(s), aure.house);
  assert.equal(s.tick, 0);
  assert.throws(
    () => act(s, { type: "respond", reaction: r.id, choice: "accept" }, cairn),
    /stale/,
  );
});

test("a recipient can decline marriage and bot recipients make explicit responses", () => {
  let s = act(twoHumans(), { type: "marry", house: cairn.house });
  s = act(
    s,
    { type: "respond", reaction: s.turns.pending[0].id, choice: "decline" },
    cairn,
  );
  assert.equal(s.turns.pending.length, 0);
  assert.ok(!s.houses[0].family.some((p) => p.spouse));
  assert.match(s.log[0], /declined/);
  const automatic = dispatchCommand(createCampaign(), aure, {
    type: "marry",
    house: cairn.house,
  });
  assert.equal(automatic.turns.pending.length, 0);
  assert.ok(automatic.houses[0].family.some((p) => p.spouse));
  assert.match(automatic.log[0], /accepted/);
});

test("war interrupts for defensive mobilization; a peace counteroffer requires the attacker to accept", () => {
  let s = act(twoHumans(), { type: "war", nation: "high-cairn" });
  const war = s.turns.pending[0];
  assert.equal(war.to, cairn.house);
  s = act(s, { type: "muster", army: "army-high-cairn-0", count: 500 }, cairn);
  assert.ok(s.armies.some((a) => a.house === cairn.house && !a.garrison));
  s = act(s, { type: "respond", reaction: war.id, choice: "peace" }, cairn);
  const peace = s.turns.pending[0];
  assert.equal(peace.kind, "peace");
  assert.equal(peace.to, aure.house);
  assert.ok(s.wars.length);
  s = act(s, { type: "respond", reaction: peace.id, choice: "accept" });
  assert.equal(s.wars.length, 0);
  assert.equal(s.turns.pending.length, 0);
  assert.equal(s.tick, 0);
});

test("a declined peace offer retains war and the original recipient still has a defensive response", () => {
  let s = act(twoHumans(), { type: "war", nation: "high-cairn" });
  s = act(
    s,
    { type: "respond", reaction: s.turns.pending[0].id, choice: "peace" },
    cairn,
  );
  s = act(s, {
    type: "respond",
    reaction: s.turns.pending[0].id,
    choice: "decline",
  });
  assert.equal(s.wars.length, 1);
  assert.equal(s.turns.pending[0].kind, "war");
  assert.throws(
    () =>
      act(
        s,
        { type: "respond", reaction: s.turns.pending[0].id, choice: "peace" },
        cairn,
      ),
    /already offered/,
  );
  s = act(
    s,
    { type: "respond", reaction: s.turns.pending[0].id, choice: "defend" },
    cairn,
  );
  s = act(s, { type: "peace", nation: "high-cairn" });
  s = act(
    s,
    { type: "respond", reaction: s.turns.pending[0].id, choice: "accept" },
    cairn,
  );
  assert.equal(s.wars.length, 0);
});

test("an invasion never enters or occupies territory before a human defender reacts", () => {
  const { s, attacker, hex } = invasion(),
    r = s.turns.pending[0];
  assert.equal(r.kind, "attack");
  assert.equal(r.to, cairn.house);
  assert.notEqual(s.armies.find((a) => a.id === attacker).hex, hex);
  assert.equal(s.districts.find((d) => d.id === hex).occupation, undefined);
  assert.deepEqual(runAutomaticTurns(s), s);
  assert.deepEqual(advanceCampaign(s), s);
  assert.throws(() => act(s, { type: "endTurn" }), /other player/);
  const saved = loadSave(JSON.stringify(s));
  assert.deepEqual(saved.turns, s.turns);
  assert.equal(saved.turns.ending, "auremarch");
});

test("withdrawal cedes territory, preserves survivors, ends the committed turn once and allows later conquest", () => {
  let { s, attacker, defender, hex } = invasion();
  const old = troopCount(s.armies.find((a) => a.id === defender));
  s = act(
    s,
    { type: "respond", reaction: s.turns.pending[0].id, choice: "withdraw" },
    cairn,
  );
  assert.equal(s.districts.find((d) => d.id === hex).occupation, aure.house);
  assert.equal(s.armies.find((a) => a.id === attacker).hex, hex);
  assert.notEqual(s.armies.find((a) => a.id === defender).hex, hex);
  assert.equal(
    troopCount(s.armies.find((a) => a.id === defender)),
    Math.round(old * 0.98),
  );
  assert.equal(activeTurnHouse(s), cairn.house);
  assert.equal(s.tick, 1);
  // The next player can respond with its own orders; after a held occupation, conquest remains an active-turn command.
  s.turns.index = 0;
  s.tick += 3;
  s = act(s, { type: "annex", hex });
  assert.equal(s.districts.find((d) => d.id === hex).owner, aure.house);
});

test("defending starts combat, battle commands remain available to both participants and aftermath charges no extra campaign turn", () => {
  let { s, attacker, defender } = invasion();
  const r = s.turns.pending[0];
  assert.ok(defendingArmies(s, r).some((a) => a.id === defender));
  s = act(
    s,
    { type: "respond", reaction: r.id, choice: "defend", army: defender },
    cairn,
  );
  assert.equal(s.battles[0].phase, "combat");
  assert.equal(s.tick, 1);
  assert.ok(s.turns.ending);
  const b = s.battles[0];
  s = act(s, {
    type: "order",
    battle: b.id,
    formation: `${attacker}-levies`,
    order: "attack",
    x: 50,
    y: 50,
    facing: 0,
    width: 12,
  });
  s = act(
    s,
    {
      type: "order",
      battle: b.id,
      formation: `${defender}-levies`,
      order: "hold",
      x: 50,
      y: 50,
      facing: 180,
      width: 12,
    },
    cairn,
  );
  assert.throws(() => act(s, { type: "endTurn" }), /frozen/);
  autoResolve(s, s.battles[0]);
  s = runAutomaticTurns(s);
  assert.equal(s.battles.length, 0);
  assert.equal(s.tick, 1);
  assert.equal(activeTurnHouse(s), cairn.house);
});

test("peace during an invasion cancels the attack rather than silently occupying the field", () => {
  let { s, attacker, hex } = invasion();
  s = act(
    s,
    { type: "respond", reaction: s.turns.pending[0].id, choice: "peace" },
    cairn,
  );
  const offer = s.turns.pending[0];
  s = act(s, { type: "respond", reaction: offer.id, choice: "accept" });
  assert.equal(s.wars.length, 0);
  assert.equal(s.turns.pending.length, 0);
  assert.notEqual(s.armies.find((a) => a.id === attacker).hex, hex);
  assert.equal(s.districts.find((d) => d.id === hex).occupation, undefined);
  assert.equal(activeTurnHouse(s), cairn.house);
});

test("old saves gain turns without changing progress; malformed turn state is rejected", () => {
  const old = createCampaign("saltmere");
  delete old.turns;
  old.tick = 37;
  old.paused = true;
  old.houses.find((h) => h.id === "saltmere-0").treasury = 123;
  const s = loadSave(JSON.stringify(old));
  assert.equal(activeTurnHouse(s), "saltmere-0");
  assert.equal(s.tick, 37);
  assert.equal(s.houses.find((h) => h.id === "saltmere-0").treasury, 123);
  assert.equal(s.paused, false);
  for (const turn of [
    { ...s.turns, index: 20 },
    { ...s.turns, order: ["auremarch"] },
    { ...s.turns, round: NaN },
    {
      ...s.turns,
      pending: [
        {
          id: "bad",
          kind: "attack",
          from: aure.house,
          to: cairn.house,
          army: "missing",
          hex: "legacy",
          created: 37,
        },
      ],
    },
  ])
    assert.throws(
      () => loadSave(JSON.stringify({ ...s, turns: turn })),
      /Invalid/,
    );
});

test("additional defenders retain the right to react before a field is occupied", () => {
  let { s, hex, defender } = invasion();
  const guard = s.armies.find((a) => a.id === defender);
  const weak = {
    ...structuredClone(guard),
    id: "advance-guard",
    garrison: false,
    troops: { levies: 100, spearmen: 0, archers: 0, heavy: 0, cavalry: 0 },
  };
  s.armies.push(weak);
  s = act(
    s,
    {
      type: "respond",
      reaction: s.turns.pending[0].id,
      choice: "defend",
      army: weak.id,
    },
    cairn,
  );
  autoResolve(s, s.battles[0]);
  s = runAutomaticTurns(s);
  assert.equal(s.turns.pending[0].kind, "attack");
  assert.equal(s.turns.pending[0].to, cairn.house);
  assert.equal(s.districts.find((d) => d.id === hex).occupation, undefined);
  assert.equal(s.turns.ending, "auremarch");
  assert.equal(s.tick, 1);
});
