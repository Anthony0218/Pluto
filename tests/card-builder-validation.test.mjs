import test from "node:test";
import assert from "node:assert/strict";
import { createGame, generateRulebookFacts, describeRule, explainConfiguration, parseGameDefinition, performAction, validateDefinition } from "../src/games/cards/engine/index.ts";
import { TEMPLATES, blankTemplate as blank, durakTemplate as durak, kingsAndSevensTemplate as kas } from "../src/games/cards/templates/index.ts";
import { createGameRecord, findVersion, latestDraft, latestPublished, publishDraft, saveDraft, VersionError } from "../src/games/cards/versioning.ts";

const clone = (value) => structuredClone(value);
const messages = (def) => validateDefinition(def).errors.map((issue) => issue.message).join("\n");

test("every built-in template validates without errors and lists successful checks", () => {
  for (const template of TEMPLATES) {
    const report = validateDefinition(template.definition);
    assert.deepEqual(report.errors, [], template.id);
    assert.ok(report.successes.length >= 5, `${template.id} shows passed checks`);
    assert.ok(report.canPublish);
  }
});

test("semantic validation catches broken games", () => {
  const noWin = clone(blank);
  noWin.endConditions = [];
  assert.match(messages(noWin), /No win condition exists/);

  const badZone = clone(blank);
  badZone.actions[0].destination = { zone: "graveyard" };
  assert.match(messages(badZone), /Referenced zone “graveyard” does not exist/);

  const badVariable = clone(blank);
  badVariable.actions[0].effects.push({ type: "setVariable", var: "mystery", value: 1 });
  assert.match(messages(badVariable), /Referenced variable “mystery” does not exist/);

  const noCards = clone(blank);
  noCards.deck = { ...noCards.deck, suits: [] };
  assert.match(messages(noCards), /zero cards/);

  const tooMany = clone(blank);
  tooMany.settings[0] = { ...tooMany.settings[0], default: 9, max: 10 };
  assert.match(messages(tooMany), /Card count cannot satisfy the initial deal/);

  const noStarter = clone(blank);
  delete noStarter.setup.startingPlayer;
  assert.match(messages(noStarter), /No starting player can be determined/);

  const noActions = clone(blank);
  noActions.phases[0].allowedActions = [];
  assert.match(messages(noActions), /no available actions/);

  const recursive = clone(blank);
  recursive.rules = [{ id: "again", name: "Again", trigger: "ROUND_STARTED", effects: [{ type: "startRound" }] }];
  assert.match(messages(recursive), /recursively trigger itself/);

  const autoLoop = clone(blank);
  autoLoop.phases.push(
    { id: "a", name: "Tick", automatic: true, allowedActions: [], onEnter: [], transitions: [{ to: "b" }] },
    { id: "b", name: "Tock", automatic: true, allowedActions: [], onEnter: [], transitions: [{ to: "a" }] },
  );
  autoLoop.actions[0].effects.push({ type: "startPhase", phase: "a" });
  assert.match(messages(autoLoop), /Infinite automatic transition detected: Tick → Tock/);

  const stuck = clone(blank);
  stuck.phases.push({ id: "limbo", name: "Limbo", automatic: true, allowedActions: [], onEnter: [], transitions: [] });
  stuck.actions[1].effects.push({ type: "startPhase", phase: "limbo" });
  assert.match(messages(stuck), /Automatic phase “Limbo” has no possible exit/);
});

test("structural validation is an allowlist (the server's security boundary)", () => {
  const unknownEffect = clone(blank);
  unknownEffect.actions[0].effects = [{ type: "runScript", code: "fetch('https://evil.example')" }];
  const parsed = parseGameDefinition(unknownEffect);
  assert.equal(parsed.definition, null);
  assert.match(parsed.issues.map((issue) => issue.message).join(), /Unknown effect type “runScript”/);

  const unknownCondition = clone(blank);
  unknownCondition.actions[0].condition = { type: "javascript", source: "process.exit()" };
  assert.match(parseGameDefinition(unknownCondition).issues.map((issue) => issue.message).join(), /Unknown condition type “javascript”/);

  const extraParam = clone(blank);
  extraParam.actions[0].effects = [{ type: "endTurn", payload: "<script>" }];
  assert.match(parseGameDefinition(extraParam).issues.map((issue) => issue.message).join(), /Unknown parameter “payload”/);

  const badAction = clone(blank);
  badAction.actions[0].type = "sql";
  assert.match(parseGameDefinition(badAction).issues.map((issue) => issue.message).join(), /Unknown action type “sql”/);

  const sneaky = clone(blank);
  sneaky.extra = { code: "x" };
  assert.match(parseGameDefinition(sneaky).issues.map((issue) => issue.message).join(), /Unknown field “extra”/);

  const badValue = clone(blank);
  badValue.setup.steps[0].count = { eval: "6" };
  assert.match(parseGameDefinition(badValue).issues.map((issue) => issue.message).join(), /Unknown value type/);

  assert.equal(parseGameDefinition("{not json").definition, null);
  assert.equal(parseGameDefinition("x".repeat(300_000)).definition, null);

  const good = parseGameDefinition(JSON.stringify(durak));
  assert.ok(good.definition, "templates survive a JSON round-trip through the server parser");
  assert.equal(good.issues.filter((issue) => issue.severity === "error").length, 0);
});

test("the rulebook generator states structured facts separately", () => {
  const facts = generateRulebookFacts(durak).map((fact) => fact.text);
  assert.ok(facts.includes("Players: 2–5"));
  assert.ok(facts.some((fact) => fact.startsWith("Deal six cards to each player")));
  assert.ok(facts.some((fact) => fact.includes("7 < 8 < 9 < 10 < J < Q < K < A")));
  assert.ok(facts.some((fact) => /trump/i.test(fact)));
  const rule = describeRule(kas.rules[0], { def: kas });
  assert.match(rule, /^WHEN a phase starts, IF the phase is Compare and the top card of .* is a 7/);
  const sections = explainConfiguration(durak).map((section) => section.id);
  assert.deepEqual(sections, ["deck", "zones", "setup", "phases", "rules", "events", "winning"]);
});

test("versions are immutable once published; edits create a new draft", () => {
  let record = createGameRecord(blank, { id: "g1", ownerId: "alice", now: "2026-10-01T00:00:00Z" });
  assert.equal(record.versions.length, 1);
  assert.equal(latestDraft(record).version, 1);
  record = publishDraft(record, "2026-10-01T01:00:00Z");
  const v1 = latestPublished(record);
  assert.equal(v1.status, "published");
  assert.throws(() => {
    "use strict";
    v1.definition.name = "Hacked";
  }, TypeError, "published definitions are frozen");

  // A session pins the version it started with.
  const session = createGame(v1.definition, { players: [{ id: "a", name: "A" }, { id: "b", name: "B" }], seed: 1, gameVersionId: v1.id });
  const edited = clone(blank);
  edited.name = "Blank Game II";
  edited.settings[0].default = 3;
  const before = JSON.stringify(record.versions[0]);
  record = saveDraft(record, edited, "2026-10-02T00:00:00Z");
  assert.equal(record.versions.length, 2);
  assert.equal(JSON.stringify(record.versions[0]), before, "version 1 is untouched");
  assert.equal(latestDraft(record).version, 2);
  assert.equal(record.name, "Blank Game II");
  assert.equal(session.gameVersionId, "g1@v1");
  assert.equal(findVersion(record, session.gameVersionId).definition.settings[0].default, 5);
  const firstPlayer = session.currentPlayerId;
  const card = session.zones[`hand:${firstPlayer}`].cards[0];
  assert.ok(performAction(findVersion(record, session.gameVersionId).definition, session, firstPlayer, { actionId: "play", cardId: card }).ok, "the old session keeps playing on version 1");

  // Saving again updates the open draft rather than creating version 3.
  record = saveDraft(record, { ...edited, description: "Changed again" }, "2026-10-03T00:00:00Z");
  assert.equal(record.versions.length, 2);
  record = publishDraft(record, "2026-10-04T00:00:00Z");
  assert.throws(() => publishDraft(record, "2026-10-05T00:00:00Z"), VersionError);

  const broken = clone(blank);
  broken.endConditions = [];
  const draft = saveDraft(record, broken, "2026-10-06T00:00:00Z");
  assert.throws(() => publishDraft(draft, "2026-10-06T00:00:00Z"), /validation error/);
});
