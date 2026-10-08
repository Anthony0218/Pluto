import test from "node:test";
import assert from "node:assert/strict";
import {
  createCampaign,
  applyCommand,
  dispatchCommand,
  loadSave,
  runAutomaticTurns,
} from "../src/games/MedievalKingdoms/edravane/simulation.ts";
import {
  conquestTargets,
  hasMarriagePact,
  justifiedWarReasons,
} from "../src/games/MedievalKingdoms/edravane/politics.ts";
import { neighbors } from "../src/games/MedievalKingdoms/edravane/world.ts";

const aure = { house: "auremarch-0" },
  cairn = { house: "high-cairn-0" };
const house = (s, id = aure.house) => s.houses.find((h) => h.id === id);
const act = (s, cmd, actor = aure) => applyCommand(s, actor, cmd);
function humanCairn(s) {
  house(s, cairn.house).reasons.push("Human commander");
  return s;
}
function pact(s, left = aure.house, right = cairn.house) {
  const a = house(s, left).family[1],
    b = house(s, right).family[1];
  a.spouse = b.id;
  b.spouse = a.id;
}
const penalties = (s) => ({
  unrest: s.districts.map((d) => d.unrest),
  loyalty: s.houses.map((h) => h.loyalty),
  armies: s.armies.map((a) => a.loyalty),
});

test("insults are directed, reduce relations, preserve the turn, and cannot be spammed", () => {
  const s = createCampaign();
  const next = act(s, { type: "insult", house: cairn.house });
  assert.equal(next.insults[0].from, aure.house);
  assert.equal(next.insults[0].to, cairn.house);
  assert.equal(house(next).relations[cairn.house], -20);
  assert.equal(house(next, cairn.house).relations[aure.house], -20);
  assert.equal(next.tick, s.tick);
  assert.deepEqual(next.turns, s.turns);
  assert.ok(
    !justifiedWarReasons(next, house(next), "high-cairn").includes("insult"),
  );
  assert.ok(
    justifiedWarReasons(next, house(next, cairn.house), "auremarch").includes(
      "insult",
    ),
  );
  assert.throws(
    () => act(next, { type: "insult", house: cairn.house }),
    /already insulted/,
  );
  assert.throws(
    () => act(s, { type: "insult", house: aure.house }),
    /another house/,
  );
  assert.throws(
    () => act(s, { type: "insult", house: "invented" }),
    /another house/,
  );
  assert.throws(
    () => act(s, { type: "insult", house: aure.house }, cairn),
    /not your turn/,
  );
});

test("insulting a foreign vassal gives their crown evidence for a penalty-free war, consumed once", () => {
  let s = humanCairn(createCampaign());
  s = act(s, { type: "insult", house: "high-cairn-1" });
  s = act(s, { type: "endTurn" });
  const before = penalties(s);
  s = act(s, { type: "war", nation: "auremarch", reason: "insult" }, cairn);
  assert.equal(s.warDeclarations.at(-1).reason, "insult");
  assert.equal(s.turns.pending[0].to, aure.house);
  assert.deepEqual(penalties(s), before);
  assert.equal(house(s, cairn.house).unjustifiedWars, undefined);
  assert.ok(s.insults[0].resolved);
  assert.ok(
    !justifiedWarReasons(s, house(s, cairn.house), "auremarch").includes(
      "insult",
    ),
  );
});

test("fabricated insult evidence is rejected atomically and a bot answers on its own turn", () => {
  const original = createCampaign(),
    raw = JSON.stringify(original);
  assert.throws(
    () =>
      act(original, { type: "war", nation: "high-cairn", reason: "insult" }),
    /no current evidence/,
  );
  assert.equal(JSON.stringify(original), raw);
  let s = dispatchCommand(original, aure, {
    type: "insult",
    house: cairn.house,
  });
  assert.equal(s.wars.length, 0);
  s = dispatchCommand(s, aure, { type: "endTurn" });
  assert.equal(s.turns.pending[0].reason, "insult");
  assert.equal(s.turns.pending[0].from, cairn.house);
  assert.equal(s.turns.pending[0].to, aure.house);
});

test("border conquest considers live control and vassal territory; distant and sea hexes are excluded", () => {
  const s = createCampaign(),
    h = house(s);
  const targets = conquestTargets(s, h, "high-cairn");
  assert.ok(targets.length);
  assert.ok(
    targets.every((d) =>
      neighbors(s.districts, d.id).some(
        (n) => house(s, n.occupation ?? n.owner)?.nation === h.nation,
      ),
    ),
  );
  const d = targets[0];
  assert.ok(
    justifiedWarReasons(s, h, "high-cairn", d.id).includes(
      "territorial-conquest",
    ),
  );
  const distant = s.districts.find(
    (d) =>
      house(s, d.owner)?.nation === "high-cairn" &&
      !targets.some((t) => t.id === d.id),
  );
  assert.ok(distant);
  assert.ok(
    !justifiedWarReasons(s, h, "high-cairn", distant.id).includes(
      "territorial-conquest",
    ),
  );
  assert.equal(conquestTargets(s, h, "saltmere").length, 0);
  for (const n of neighbors(s.districts, d.id).filter(
    (n) => house(s, n.owner)?.nation === h.nation,
  ))
    n.occupation = "varnesk-0";
  assert.ok(!conquestTargets(s, h, "high-cairn").some((t) => t.id === d.id));
});

test("territorial declarations avoid penalties and preserve the defender reaction", () => {
  const s = humanCairn(createCampaign()),
    before = penalties(s);
  const next = act(s, {
    type: "war",
    nation: "high-cairn",
    reason: "territorial-conquest",
  });
  assert.deepEqual(penalties(next), before);
  assert.equal(next.turns.pending[0].reason, "territorial-conquest");
  assert.equal(next.turns.pending[0].to, cairn.house);
  assert.throws(
    () =>
      act(s, {
        type: "war",
        nation: "saltmere",
        reason: "territorial-conquest",
      }),
    /no current evidence/,
  );
});

test("accepted living marriage pacts protect borders, including vassal marriages; pending offers do not", () => {
  let s = humanCairn(createCampaign());
  s = act(s, { type: "marry", house: cairn.house });
  assert.equal(hasMarriagePact(s, house(s), "high-cairn"), false);
  assert.ok(conquestTargets(s, house(s), "high-cairn").length);
  s = act(
    s,
    { type: "respond", reaction: s.turns.pending[0].id, choice: "accept" },
    cairn,
  );
  assert.equal(hasMarriagePact(s, house(s), "high-cairn"), true);
  assert.equal(conquestTargets(s, house(s), "high-cairn").length, 0);
  assert.throws(
    () =>
      act(s, {
        type: "war",
        nation: "high-cairn",
        reason: "territorial-conquest",
      }),
    /no current evidence/,
  );
  s = createCampaign();
  pact(s, "auremarch-1", "high-cairn-2");
  assert.equal(conquestTargets(s, house(s), "high-cairn").length, 0);
  house(s, "high-cairn-2").family[1].alive = false;
  assert.ok(conquestTargets(s, house(s), "high-cairn").length);
});

test("attack declarations validate the particular selected hex rather than a border elsewhere", () => {
  let s = humanCairn(createCampaign());
  s = act(s, { type: "muster", army: "army-auremarch-0", count: 500 });
  const army = s.armies.find((a) => a.house === aure.house && !a.garrison);
  const targets = conquestTargets(s, house(s), "high-cairn");
  const distant = s.districts.find(
    (d) =>
      house(s, d.owner)?.nation === "high-cairn" &&
      !targets.some((t) => t.id === d.id),
  );
  const raw = JSON.stringify(s);
  assert.throws(
    () =>
      act(s, {
        type: "attack",
        army: army.id,
        hex: distant.id,
        reason: "territorial-conquest",
      }),
    /no current evidence/,
  );
  assert.equal(JSON.stringify(s), raw);
  const next = act(s, {
    type: "attack",
    army: army.id,
    hex: targets[0].id,
    reason: "territorial-conquest",
  });
  assert.equal(next.turns.pending[0].hex, targets[0].id);
  assert.equal(next.turns.pending[0].reason, "territorial-conquest");
  assert.equal(next.armies.find((a) => a.id === army.id).hex, army.hex);
});

test("accepted peace resolves both sides' insult grievances and saves validate new history", () => {
  let s = humanCairn(createCampaign());
  s = act(s, { type: "insult", house: cairn.house });
  const saved = loadSave(JSON.stringify(s));
  assert.deepEqual(saved.insults, s.insults);
  const invalid = structuredClone(s);
  invalid.insults[0].to = "invented";
  assert.throws(
    () => loadSave(JSON.stringify(invalid)),
    /Invalid insult history/,
  );
  delete saved.insults;
  assert.ok(loadSave(JSON.stringify(saved)));
  s = act(s, {
    type: "war",
    nation: "high-cairn",
    reason: "territorial-conquest",
  });
  s = act(
    s,
    { type: "respond", reaction: s.turns.pending[0].id, choice: "peace" },
    cairn,
  );
  s = act(s, {
    type: "respond",
    reaction: s.turns.pending[0].id,
    choice: "accept",
  });
  assert.ok(s.insults[0].resolved);
  assert.ok(
    !justifiedWarReasons(s, house(s, cairn.house), "auremarch").includes(
      "insult",
    ),
  );
});

test("bots do not choose territorial war against their marriage allies", () => {
  const s = createCampaign("high-cairn");
  house(s, cairn.house).reasons = [];
  house(s).reasons.push("Human commander");
  s.turns.round = 4;
  for (const d of s.districts)
    if (d.owner && house(s, d.owner).nation !== "high-cairn") {
      d.owner = aure.house;
      d.occupation = undefined;
    }
  pact(s);
  const next = runAutomaticTurns(s);
  assert.ok(!next.warDeclarations.some((w) => w.from === "high-cairn"));
  assert.equal(next.turns.order[next.turns.index], "auremarch");
});

test("insulting your own vassal costs opinion and loyalty without creating a foreign war", () => {
  const s = createCampaign(),
    v = house(s, "auremarch-1");
  const next = act(s, { type: "insult", house: v.id });
  assert.equal(house(next, v.id).opinion, v.opinion - (v.family.find((p) => p.id === v.ruler).traits.includes("proud") ? 20 : 15));
  assert.ok(house(next, v.id).loyalty < v.loyalty);
  assert.equal(next.wars.length, 0);
});
