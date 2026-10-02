import assert from "node:assert/strict";
import test from "node:test";
import { AI_DIFFICULTY_OPTIONS, DEFAULT_GAME_RULES, applyAction, chooseAiAction, collectSecondsFor, createGame, shuffledDeck, viewFor } from "../src/games/schafkopf/schafkopf.ts";
import { liveSchafkopfTip, reviewSchafkopfTrick } from "../src/games/schafkopf/coach.ts";
import { SIMPLE_ANNOUNCEMENT_SETTINGS, formatDeclarationAnnouncement } from "../src/games/schafkopf/announcements.ts";

function rng(seed) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

test("all five AI levels finish legal games and use distinct default review times", () => {
  assert.deepEqual(AI_DIFFICULTY_OPTIONS.map(option => option.collectSeconds), [6, 5, 4, 3, 2]);
  for (const [index, option] of AI_DIFFICULTY_OPTIONS.entries()) {
    assert.equal(collectSecondsFor(option.id), option.collectSeconds);
    const random = rng(index + 31);
    let game = createGame(undefined, 3, shuffledDeck(random), undefined, 1, { ...DEFAULT_GAME_RULES, legen: false });
    let actions = 0;
    while (game.phase !== "finished" && game.phase !== "redeal" && actions++ < 200) {
      const view = viewFor(game, game.turn);
      const action = chooseAiAction(view, option.id, random);
      if (action.type === "play") assert.ok(view.legalCards.includes(action.cardId), `${option.label} must play a legal card`);
      game = applyAction(game, game.turn, action, random);
    }
    assert.ok(actions < 200, `${option.label} must complete the game`);
  }
});

test("beginner advice is based on visible cards and public trick results", () => {
  const game = createGame();
  const view = viewFor(game, 0);
  const ace = { id: "Gras-Ass", suit: "Gras", rank: "Ass" };
  const seven = { id: "Gras-7", suit: "Gras", rank: "7" };
  const playing = { ...view, phase: "play", turn: 0, contract: { kind: "solo", suit: "Herz" }, hand: [ace], legalCards: [ace.id], trick: [] };
  assert.match(liveSchafkopfTip(playing), /Gras Sau|Gras-Ass/);
  const trick = { plays: [{ seat: 0, card: ace }, { seat: 1, card: seven }], winner: 0, points: 11 };
  assert.match(reviewSchafkopfTrick(playing, trick), /11 Punkte/);
});

test("beginner advice recommends a small trump when void in the led suit", () => {
  const game = createGame();
  const view = viewFor(game, 0);
  const lead = { id: "Eichel-7", suit: "Eichel", rank: "7" };
  const trump = { id: "Herz-7", suit: "Herz", rank: "7" };
  const playing = { ...view, phase: "play", turn: 0, contract: { kind: "rufspiel", suit: "Gras" }, partner: null, hand: [trump], legalCards: [trump.id], trick: [{ seat: 1, card: lead }] };
  assert.match(liveSchafkopfTip(playing), /Fehlfarbe frei.*Trumpf ein/);
});

test("beginner and amateur declarations use the standard ace names", () => {
  for (const suit of ["Eichel", "Gras", "Schellen"]) {
    assert.equal(formatDeclarationAnnouncement({ kind: "rufspiel", suit }, SIMPLE_ANNOUNCEMENT_SETTINGS), `I spui auf die ${suit}-Ass.`);
  }
});
