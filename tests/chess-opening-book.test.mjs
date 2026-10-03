import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { openingBookMove } from "../src/games/chess/openingBook.ts";

test("opening book recognizes named and intermediate positions", async () => {
  const game = new Chess();
  for (const san of ["e4", "e5", "Nf3", "Nc6", "Bc4"]) {
    game.move(san);
    assert.ok(await openingBookMove(game.fen(), game.history().length), `${san} is on a book line`);
  }
  assert.equal((await openingBookMove(game.fen(), 5))?.name, "Italian Game");
  assert.equal(await openingBookMove(game.fen(), 31), null, "book labels stop after the opening");
});

test("an unknown opening continuation is not called a book move", async () => {
  const game = new Chess();
  game.move("b3");
  // 1.b3 is book, but this later unusual line is absent from the published catalogue.
  for (const san of ["a5", "a4", "h5"]) game.move(san);
  assert.equal(await openingBookMove(game.fen(), game.history().length), null);
});

test("opening positions match through transpositions", async () => {
  const positions = [["Nf3", "d5", "d4", "Nf6"], ["d4", "Nf6", "Nf3", "d5"]];
  const matches = await Promise.all(positions.map(async (line) => {
    const game = new Chess();
    for (const san of line) game.move(san);
    return openingBookMove(game.fen(), line.length);
  }));
  assert.deepEqual(matches[0], matches[1]);
  assert.ok(matches[0]?.name);
});
