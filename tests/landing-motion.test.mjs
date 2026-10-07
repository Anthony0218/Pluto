import test from "node:test";
import assert from "node:assert/strict";
import { buildPoseTable, featureWeight, flybyProgress, heroHandoffProgress, itemStops, itemWeight, journeyIndex, orbitPoint, sample, sampleColor, stopWeight } from "../src/components/App/landing/landingMath.ts";

const withFlyby = { viewport: 800, flyby: { start: 1000, end: 3000 }, stops: [3800, 4600, 5400, 6200] };
const withoutFlyby = { viewport: 800, flyby: null, stops: [3800, 4600, 5400, 6200] };

test("sample interpolates between keys and clamps outside them", () => {
  const keys = [-1, 0, 1];
  const values = [10, 20, 40];
  assert.equal(sample(-5, keys, values), 10);
  assert.equal(sample(-0.5, keys, values), 15);
  assert.equal(sample(0.5, keys, values), 30);
  assert.equal(sample(9, keys, values), 40);
});

test("sampleColor blends hex colours channel by channel", () => {
  assert.equal(sampleColor(0.5, [0, 1], ["#000000", "#ff8040"]), "rgb(128, 64, 32)");
  assert.equal(sampleColor(2, [0, 1], ["#000000", "#ff8040"]), "rgb(255, 128, 64)");
});

test("flyby progress covers the pinned range and clamps outside it", () => {
  assert.equal(flybyProgress(0, withFlyby), 0);
  assert.equal(flybyProgress(2000, withFlyby), 0.5);
  assert.equal(flybyProgress(9000, withFlyby), 1);
  assert.equal(flybyProgress(500, withoutFlyby), 0);
});

test("the journey index runs from -1 through the flyby to the last section", () => {
  assert.equal(journeyIndex(0, withFlyby), -1);
  assert.equal(journeyIndex(2000, withFlyby), -0.5);
  assert.equal(journeyIndex(3000, withFlyby), 0);
  assert.equal(journeyIndex(3800, withFlyby), 1);
  assert.equal(journeyIndex(6200, withFlyby), 4);
  assert.equal(journeyIndex(99999, withFlyby), 4);
});

test("the planet rests near each section and moves in the gap between them", () => {
  const nearFirst = journeyIndex(3800 + 0.2 * 800, withFlyby);
  assert.equal(nearFirst, 1);
  const midGap = journeyIndex(3800 + 0.5 * 800, withFlyby);
  assert.ok(Math.abs(midGap - 1.5) < 1e-9);
  let previous = -Infinity;
  for (let scroll = 0; scroll <= 7000; scroll += 25) {
    const index = journeyIndex(scroll, withFlyby);
    assert.ok(index >= previous, `index decreased at ${scroll}`);
    previous = index;
  }
});

test("the first object stays where the flyby delivered it for a while, then travels to the first section", () => {
  assert.equal(journeyIndex(3000, withFlyby), 0);
  assert.equal(journeyIndex(3000 + 0.25 * 800, withFlyby), 0);
  assert.ok(journeyIndex(3000 + 0.5 * 800, withFlyby) > 0.1);
  assert.equal(journeyIndex(3800 - 100, withFlyby), 1);
});

test("without a flyby the journey starts at the first section", () => {
  assert.equal(journeyIndex(0, withoutFlyby), 0);
  assert.equal(journeyIndex(3800, withoutFlyby), 1);
  assert.equal(journeyIndex(6200, withoutFlyby), 4);
  assert.equal(journeyIndex(0, { viewport: 800, flyby: null, stops: [] }), 0);
});

test("stop weights peak on the stop and fade to zero", () => {
  assert.equal(stopWeight(2, 2), 1);
  assert.equal(stopWeight(2.7, 2), 0);
  assert.equal(stopWeight(0, 2), 0);
  assert.ok(stopWeight(2.35, 2) > 0 && stopWeight(2.35, 2) < 1);
});

test("orbit points stay on the ellipse and report which side faces the viewer", () => {
  const front = orbitPoint(Math.PI / 2, 100, 40, 0);
  assert.ok(Math.abs(front.x) < 1e-9 && Math.abs(front.y - 40) < 1e-9 && front.depth === 1);
  const back = orbitPoint(-Math.PI / 2, 100, 40, 0);
  assert.equal(back.depth, -1);
  const side = orbitPoint(0, 100, 40, Math.PI / 2);
  assert.ok(Math.abs(side.x) < 1e-9 && Math.abs(side.y - 100) < 1e-9);
});

test("the pose table puts the planet behind each section's text and carries its tone", () => {
  const stops = [{ tone: "chess", feature: "ring", side: 1 }, { tone: "go", feature: null, side: -1 }, { tone: "natura", feature: "moons", side: 1 }];
  const wide = buildPoseTable(stops, true);
  assert.deepEqual(wide.keys, [-1, 0, 1, 2, 3]);
  assert.deepEqual(wide.x, [0, 0, 27, -27, 27]);
  assert.deepEqual(wide.tones, ["chess", "chess", "chess", "go", "natura"]);
  const narrow = buildPoseTable(stops, false);
  assert.equal(narrow.x.length, wide.keys.length);
  assert.ok(narrow.scale.every(value => value < 0.5));
  assert.equal(buildPoseTable([], true).keys.length, 2);
});

test("feature weights follow the sections that declare the feature", () => {
  const stops = [{ tone: "a", feature: "books", side: 1 }, { tone: "b", feature: null, side: -1 }, { tone: "c", feature: "books", side: 1 }];
  assert.equal(featureWeight(1, stops, "books"), 1);
  assert.equal(featureWeight(2, stops, "books"), 0);
  assert.equal(featureWeight(3, stops, "books"), 1);
  assert.equal(featureWeight(1, stops, "moons"), 0);
});

const cardEngine = await import("../src/components/App/landing/demos/cardTrickEngine.ts");

test("Schafkopf trump order: Ober beats Unter beats Herz beats plain cards", () => {
  const { card, schafkopfRules, trickWinner, legalCards } = cardEngine;
  const plays = [{ seat: 0, card: card("gras", "ace") }, { seat: 1, card: card("herz", "7") }, { seat: 2, card: card("schellen", "unter") }, { seat: 3, card: card("gras", "10") }];
  assert.equal(trickWinner(plays, schafkopfRules), 2, "an Unter beats a low Herz and a plain Ace");
  assert.equal(trickWinner([{ seat: 0, card: card("eichel", "ober") }, { seat: 1, card: card("schellen", "ober") }], schafkopfRules), 0, "Eichel-Ober is the highest card");
  assert.equal(trickWinner([{ seat: 0, card: card("gras", "10") }, { seat: 1, card: card("eichel", "ace") }], schafkopfRules), 0, "a plain card of another suit cannot win");
  const hand = [card("gras", "9"), card("herz", "ace"), card("eichel", "10")];
  assert.deepEqual(legalCards(hand, [{ seat: 0, card: card("gras", "king") }], schafkopfRules).map(c => c.rank), ["9"], "must follow suit");
  assert.equal(legalCards(hand, [{ seat: 0, card: card("herz", "7") }], schafkopfRules).length, 1, "trump must follow trump");
  assert.equal(legalCards([card("eichel", "10")], [{ seat: 0, card: card("gras", "king") }], schafkopfRules).length, 1, "free to play anything without the suit");
});

test("Watten ranking: critical cards, Hauptschlag, other Schläge, Trumpf, then the suit led", () => {
  const { card, wattenRules, trickWinner } = cardEngine;
  const rules = wattenRules("gras", "ober");
  const winner = (...cards) => trickWinner(cards.map((played, seat) => ({ seat, card: played })), rules);
  assert.equal(winner(card("gras", "ace"), card("eichel", "7"), card("schellen", "7")), 2, "Belli beats Spitz beats trump");
  assert.equal(winner(card("herz", "king"), card("schellen", "7")), 0, "Max is the highest card");
  assert.equal(winner(card("gras", "ober"), card("eichel", "7")), 1, "a critical card beats the Hauptschlag");
  assert.equal(winner(card("gras", "ace"), card("gras", "ober"), card("eichel", "ober")), 1, "the Hauptschlag beats trump and the other Schläge");
  assert.equal(winner(card("gras", "ace"), card("schellen", "ober")), 1, "any Schlag beats the trump suit");
  assert.equal(winner(card("eichel", "ober"), card("schellen", "ober"), card("herz", "ober")), 0, "among equal Schläge the first one played wins");
  assert.equal(winner(card("schellen", "ober"), card("eichel", "ober")), 0);
  assert.equal(winner(card("herz", "ace"), card("gras", "7")), 1, "the lowest trump beats a plain Ace");
  assert.equal(winner(card("herz", "9"), card("eichel", "ace"), card("herz", "10")), 2, "without trump the suit led decides");
});

test("Watten lets you play any card, except trump-or-critical after a Hauptschlag opens the round", () => {
  const { card, wattenRules, legalCards } = cardEngine;
  const rules = wattenRules("gras", "ober");
  const hand = [card("herz", "king"), card("gras", "7"), card("schellen", "10"), card("eichel", "ober")];
  const names = (cards) => cards.map(c => `${c.suit}-${c.rank}`);
  assert.equal(legalCards(hand, [], rules, 0).length, 4);
  assert.equal(legalCards(hand, [{ seat: 1, card: card("schellen", "ace") }], rules, 0).length, 4, "no need to follow suit");
  const hauptschlagLed = [{ seat: 1, card: card("gras", "ober") }];
  assert.deepEqual(names(legalCards(hand, hauptschlagLed, rules, 0)), ["herz-king", "gras-7"]);
  assert.equal(legalCards(hand, hauptschlagLed, rules, 1).length, 4, "only in the first trick");
  assert.equal(legalCards(hand, [...hauptschlagLed, { seat: 2, card: card("eichel", "7") }], rules, 0).length, 4, "a critical card already played lifts the rule");
  assert.equal(legalCards([card("schellen", "10"), card("herz", "8")], hauptschlagLed, rules, 0).length, 2, "nothing to answer with");
});

test("the Watten demo deal shows every kind of card and the Schafkopf deal matches its announcement", () => {
  const { wattenGame, schafkopfGame, cardId } = cardEngine;
  assert.deepEqual([wattenGame.trump, wattenGame.schlag, wattenGame.tricksToWin], ["gras", "ober", 3]);
  const strengths = wattenGame.hands.flat().map(c => wattenGame.rules.trump(c));
  for (const kind of [1000, 800, 700, 600]) assert.ok(strengths.includes(kind), `strength ${kind}`);
  assert.ok(strengths.some(value => value !== null && value < 600) && strengths.includes(null));
  // Sauspiel on the Eichel-Sau: the caller holds a plain Eichel card but not the ace; the partner across has it.
  assert.deepEqual([schafkopfGame.trump, schafkopfGame.called], ["herz", "eichel"]);
  const holds = (seat, id) => schafkopfGame.hands[seat].some(c => cardId(c) === id);
  assert.ok(holds(2, "eichel-ace") && !holds(0, "eichel-ace"));
  assert.ok(schafkopfGame.hands[0].some(c => c.suit === "eichel" && schafkopfGame.rules.trump(c) === null));
});

test("the demo deals contain no duplicate cards and the AI always plays a legal card", () => {
  const { schafkopfGame, wattenGame, chooseAiCard, legalCards, cardId } = cardEngine;
  for (const game of [schafkopfGame, wattenGame]) {
    const ids = game.hands.flat().map(cardId);
    assert.equal(new Set(ids).size, ids.length, game.id);
    const plays = [{ seat: 0, card: game.hands[0][0] }];
    const chosen = chooseAiCard(game.hands[1], plays, game.rules);
    assert.ok(legalCards(game.hands[1], plays, game.rules).some(c => cardId(c) === cardId(chosen)));
  }
  // Every seat playing the computer's choice finishes both deals without an illegal card.
  for (const game of [schafkopfGame, wattenGame]) {
    const hands = game.hands.map(hand => [...hand]);
    let leader = 0;
    for (let trick = 0; trick < game.hands[0].length; trick++) {
      const plays = [];
      for (let turn = 0; turn < game.seats; turn++) {
        const seat = (leader + turn) % game.seats;
        const chosen = chooseAiCard(hands[seat], plays, game.rules, trick);
        assert.ok(legalCards(hands[seat], plays, game.rules, trick).some(c => cardId(c) === cardId(chosen)), `${game.id} trick ${trick}`);
        hands[seat] = hands[seat].filter(c => cardId(c) !== cardId(chosen));
        plays.push({ seat, card: chosen });
      }
      leader = cardEngine.trickWinner(plays, game.rules);
    }
    assert.ok(hands.every(hand => hand.length === 0));
  }
});

test("the sample Go game is legal under the real rules", async () => {
  const { sampleStates, sampleGame, sampleWinrate } = await import("../src/components/App/landing/demos/goDemoData.ts");
  assert.equal(sampleStates().length, sampleGame.length + 1);
  assert.equal(sampleWinrate.length, sampleGame.length + 1);
});

test("sections that show their own artwork hide the travelling planet", () => {
  const stops = [{ tone: "tools", feature: null, side: 1, hidden: true }, { tone: "party", feature: null, side: 1 }];
  for (const wide of [true, false]) {
    const table = buildPoseTable(stops, wide);
    assert.equal(table.opacity[2], 0);
    assert.ok(table.opacity[3] > 0);
  }
});

test("an arrival stop puts its planet in the middle at full size, then the section moves it behind the text", () => {
  const stops = [{ tone: "chess", feature: null, side: 1 }, { tone: "go", feature: null, side: 0, arrival: true }, { tone: "go", feature: null, side: -1 }];
  const table = buildPoseTable(stops, true);
  assert.deepEqual(table.x.slice(2), [27, 0, -27]);
  assert.deepEqual(table.scale.slice(2), [0.9, 1, 0.9]);
  assert.deepEqual(table.opacity.slice(2), [0.5, 1, 0.5]);
  assert.equal(table.tones[3], "go");
});

test("tools and books get an arrival before every section but the first", () => {
  assert.deepEqual(itemStops(0), { arrival: 0, section: 1 });
  assert.deepEqual(itemStops(1), { arrival: 2, section: 3 });
  assert.deepEqual(itemStops(4), { arrival: 8, section: 9 });
});

test("an item's artwork is shown from its arrival to its section and fades either side", () => {
  const { arrival, section } = itemStops(2);
  assert.equal(itemWeight(arrival, arrival, section), 1);
  assert.equal(itemWeight(section, arrival, section), 1);
  assert.equal(itemWeight(arrival + 0.5, arrival, section), 1);
  assert.equal(itemWeight(arrival - 0.7, arrival, section), 0);
  assert.equal(itemWeight(section + 1, arrival, section), 0);
  assert.ok(itemWeight(arrival - 0.35, arrival, section) > 0 && itemWeight(arrival - 0.35, arrival, section) < 1);
});

test("hero artwork stays visible until the next section fills half the viewport, then hands over smoothly", () => {
  const anchors={viewport:800,flyby:{start:1000,end:3000},stops:[]};
  assert.equal(heroHandoffProgress(0,anchors),0);
  assert.equal(heroHandoffProgress(100,anchors),0);
  assert.equal(heroHandoffProgress(600,anchors),0);
  assert.equal(heroHandoffProgress(800,anchors),0.5);
  assert.equal(heroHandoffProgress(1000,anchors),1);
  assert.equal(heroHandoffProgress(2000,anchors),1);
  assert.equal(heroHandoffProgress(1000,{...anchors,flyby:null}),0);
});
