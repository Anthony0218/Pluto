import assert from "node:assert/strict";
import test from "node:test";
import { CALL_NAME_OPTIONS, DEFAULT_ANNOUNCEMENT_SETTINGS, formatDeclarationAnnouncement, normalizeAnnouncementSettings } from "../src/games/schafkopf/announcements.ts";
import { BID_NAMES, applyAction, contractName, contractsFor, createGame, viewFor } from "../src/games/schafkopf/schafkopf.ts";

test("every Rufname has the right form after auf and mit", () => {
  for (const suit of ["Eichel", "Gras", "Schellen"]) {
    for (const choice of CALL_NAME_OPTIONS[suit]) {
      const settings = normalizeAnnouncementSettings({ callPrefix: "auf", callNames: { [suit]: choice.id } });
      assert.equal(formatDeclarationAnnouncement({ kind: "rufspiel", suit }, settings), `Ich spiele auf ${choice.auf}.`);
      settings.callPrefix = "mit";
      assert.equal(formatDeclarationAnnouncement({ kind: "rufspiel", suit }, settings), `Ich spiele mit ${choice.mit}.`);
      settings.callPrefix = "none";
      assert.equal(formatDeclarationAnnouncement({ kind: "rufspiel", suit }, settings), `${choice.bare}.`);
    }
  }
});

test("random names and prefixes, custom text, Solo and Sticht", () => {
  assert.equal(formatDeclarationAnnouncement({ kind: "rufspiel", suit: "Eichel" }, DEFAULT_ANNOUNCEMENT_SETTINGS, () => 0), "Ich spiele auf das Eichel-Ass.");
  assert.equal(formatDeclarationAnnouncement({ kind: "rufspiel", suit: "Eichel" }, DEFAULT_ANNOUNCEMENT_SETTINGS, () => .99), "Oide.");
  const settings = normalizeAnnouncementSettings({ soloWord: "Sticht", custom: { Eichel: "Meine Oide!" } });
  assert.equal(formatDeclarationAnnouncement({ kind: "rufspiel", suit: "Eichel" }, settings), "Meine Oide!");
  assert.equal(formatDeclarationAnnouncement({ kind: "solo", suit: "Gras" }, settings), "Gras-Sticht.");
  assert.equal(formatDeclarationAnnouncement({ kind: "solo", suit: "Herz", tout: true }, settings), "Herz-Sticht DU.");
  assert.equal(formatDeclarationAnnouncement({ kind: "wenz" }, settings), "Wenz.");
});

test("custom game announcement keeps the canonical name in each player view", () => {
  const game = createGame();
  game.phase = "declare";
  game.turn = 0;
  const contract = contractsFor(game.hands[0]).find(option => option.kind === "rufspiel") ?? contractsFor(game.hands[0])[0];
  assert.ok(contract);
  const announced = applyAction(game, 0, { type: "declare", contract, phrase: "  Eigene Ansage!  " });
  const expectedTitle = contract.kind === "rufspiel" ? `${contract.suit}-Ass` : contractName(contract);
  const view = viewFor(announced, 1);
  assert.equal(view.announcements[0], `${game.names[0]}: Eigene Ansage!`);
  assert.equal(view.announcementTitles[0], expectedTitle);
});

test("custom bid still exposes its required rank", () => {
  const game = createGame();
  game.phase = "auction";
  game.turn = 0;
  game.intents = [0, 1];
  game.incumbent = 0;
  game.challengerIndex = 1;
  const bid = viewFor(game, 0).bidLevels[0];
  assert.ok(bid);
  const announced = applyAction(game, 0, { type: "bid", level: bid, phrase: "I geh auf {Gebot}" });
  assert.equal(announced.announcements.at(-1), `${game.names[0]}: I geh auf ${BID_NAMES[bid]}`);
});
