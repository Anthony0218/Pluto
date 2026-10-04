import test from "node:test";
import assert from "node:assert/strict";
import { applyGoMove, createInitialGoState, isLegalGoMove, scoreGo, toggleDeadGoGroup } from "../src/games/go/rules.ts";
import { capturedGoPoints, goAtariPoints, goCoordinate, goPointLoss, parseGoCoordinate, previewGoMove, replayGo } from "../src/games/go/analysis.ts";
import { goLessons } from "../src/games/go/lessons.ts";
import { browserGoRequest, browserGoResult } from "../src/games/go/browserProtocol.ts";
import { RULES } from "../src/vendor/browser-katago/utils/goRules.ts";

test("Go coordinates round trip all supported boards and skip I", () => {
  for (const size of [9, 13, 19]) for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    const move = { type: "place", row, col };
    assert.deepEqual(parseGoCoordinate(goCoordinate(move, size), size), move);
    assert.ok(!goCoordinate(move, size).startsWith("I"));
  }
  for (const coordinate of ["I9", "A0", "T20", "A1foo", ""]) assert.throws(() => parseGoCoordinate(coordinate, 19));
});
test("Every lesson uses legal moves; suicide and ko demonstrations are illegal", () => {
  for (const lesson of goLessons) {
    let state = lesson.initial;
    for (const move of lesson.moves) { assert.equal(isLegalGoMove(state, move), true, lesson.id); state = applyGoMove(state, move); }
    if (lesson.blocked) assert.equal(isLegalGoMove(lesson.initial, lesson.blocked), false, lesson.id);
  }
  const lesson = goLessons.find(item => item.id === "score");
  const done = lesson.moves.reduce(applyGoMove, lesson.initial);
  assert.deepEqual(scoreGo(done), { black: 9, white: 15.5, winner: "white" });
});
test("Capture previews identify exact stones without mutating the board", () => {
  const lesson = goLessons.find(item => item.id === "groups"), before = JSON.stringify(lesson.initial);
  const preview = previewGoMove(lesson.initial, lesson.moves[0]);
  assert.deepEqual(preview.captured, [40, 41]);
  assert.deepEqual([...goAtariPoints(lesson.initial)].sort(), [40, 41]);
  assert.equal(JSON.stringify(lesson.initial), before);
  assert.deepEqual(capturedGoPoints(lesson.initial, preview.next), [40, 41]);
});
test("Replay reproduces captures, pass and resignation history", () => {
  let state = createInitialGoState();
  for (const move of [{ type: "place", row: 0, col: 1 }, { type: "place", row: 0, col: 0 }, { type: "place", row: 1, col: 0 }, { type: "pass" }, { type: "resign" }]) state = applyGoMove(state, move);
  assert.deepEqual(replayGo(state).at(-1), state);
  assert.equal(replayGo(state)[3].captures.black, 1);
});
test("post-pass dead groups change area score and survive replay", () => {
  let state = createInitialGoState();
  state = applyGoMove(state, { type: "place", row: 0, col: 0 });
  state = applyGoMove(state, { type: "place", row: 4, col: 4 });
  state = applyGoMove(state, { type: "pass" });
  state = applyGoMove(state, { type: "pass" });
  const marked = toggleDeadGoGroup(state, 40);
  assert.deepEqual(marked.deadStones, [40]);
  assert.notDeepEqual(scoreGo(marked), scoreGo(state));
  assert.deepEqual(replayGo(marked).at(-1), marked);
  assert.deepEqual(toggleDeadGoGroup(marked, 40), { ...state, deadStones: [] });
});
test("Point loss uses black perspective for both players", () => {
  const before = { rootInfo: { scoreLead: 5 } }, after = { rootInfo: { scoreLead: 2 } };
  assert.equal(goPointLoss(before, after, "black"), 3);
  assert.equal(goPointLoss(before, after, "white"), 0);
  assert.equal(goPointLoss(after, before, "white"), 3);
});
test("Browser requests preserve board size, recent moves and full superko history", () => {
  for (const size of [9, 13, 19]) {
    const state = applyGoMove(createInitialGoState(size), { type: "place", row: 2, col: 2 });
    const query = browserGoRequest(state, 1, "/go-engine/katago-b10.bin.gz");
    assert.equal(query.board.length, size);
    assert.equal(query.board[2][2], "black");
    assert.equal(query.currentPlayer, "white");
    assert.equal(query.previousBoard.flat().filter(Boolean).length, 0);
    assert.equal(query.repetitionHistory.length, 2);
    assert.equal(query.komi, 6.5);
  }
  assert.equal(RULES.chinese.ko, "positional");
  assert.equal(RULES.chinese.multiStoneSuicideLegal, false);
  assert.equal(RULES.chinese.scoring, "area");
});
test("Browser result keeps black perspective and rejects illegal candidates and PV moves", () => {
  const state = applyGoMove(createInitialGoState(), { type: "place", row: 2, col: 2 });
  const result = browserGoResult(state, { rootScoreLead: -3, rootWinRate: .2, rootVisits: 12, moves: [
    { x: 2, y: 2, pv: [], order: 0 },
    { x: 3, y: 3, scoreLead: -2, winRate: .3, visits: 10, order: 1, pv: ["D6", "C7"] },
  ] });
  assert.equal(result.rootInfo.scoreLead, -3);
  assert.equal(result.rootInfo.winrate, .2);
  assert.equal(result.moveInfos.length, 1);
  assert.deepEqual(result.moveInfos[0].pv, ["D6"]);
});
