import test from "node:test";
import assert from "node:assert/strict";
import {
  PRESETS,
  applyKingBehavior,
  applyMove,
  chooseAiMove,
  createGameState,
  createVariantFromPreset,
  createExamplePieces,
  explainPiece,
  getLegalMoves,
  isInCheck,
  leaperOffsets,
  parseSquare,
  parseVariantJson,
  resizeBoard,
  serializeVariant,
  setTile,
  setupFromFen,
  squareName,
  updateCell,
  validateVariant,
  victory,
  withKingConsequence,
} from "../src/games/chess/custom/engine/index.ts";

const sq = (name) => parseSquare(name);
const targets = (moves) => moves.map((move) => squareName(move.to)).sort();
const pieceOn = (state, name) => state.pieces.find((piece) => piece.x === sq(name).x && piece.y === sq(name).y);
const place = (type, team, square, extra = {}) => ({ type, team, ...sq(square), ...extra });

/** Standard rules with a hand-built position. */
function position(pieces, mutate = (variant) => variant, startingTeam = "white") {
  let variant = createVariantFromPreset("standard");
  variant = mutate(variant) ?? variant;
  variant.setup = { pieces, startingTeam, turnNumber: 1 };
  return { variant, state: createGameState(variant) };
}
const def = (variant, id) => variant.pieces.find((piece) => piece.id === id);
function play(variant, state, from, to, promotion) {
  const piece = pieceOn(state, from);
  const move = getLegalMoves(variant, state, { pieceId: piece.id }).find((entry) => squareName(entry.to) === to && (!promotion || entry.promotion === promotion));
  assert.ok(move, `expected ${from}-${to} to be legal`);
  return applyMove(variant, state, move);
}
function perft(variant, state, depth) {
  if (depth === 0) return 1;
  let nodes = 0;
  for (const move of getLegalMoves(variant, state)) nodes += perft(variant, applyMove(variant, state, move), depth - 1);
  return nodes;
}

test("standard preset reproduces standard chess move generation (perft)", () => {
  const variant = createVariantFromPreset("standard");
  const start = createGameState(variant);
  assert.equal(perft(variant, start, 1), 20);
  assert.equal(perft(variant, start, 2), 400);
  // Kiwipete exercises castling, en passant, promotions and pins.
  const kiwipete = createGameState(variant, setupFromFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1"));
  assert.equal(perft(variant, kiwipete, 1), 48);
  assert.equal(perft(variant, kiwipete, 2), 2039);
  const endgame = createGameState(variant, setupFromFen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1"));
  assert.equal(perft(variant, endgame, 2), 191);
});

test("fool's mate ends the game by checkmate", () => {
  const variant = createVariantFromPreset("standard");
  let state = createGameState(variant);
  state = play(variant, state, "f2", "f3");
  state = play(variant, state, "e7", "e5");
  state = play(variant, state, "g2", "g4");
  state = play(variant, state, "d8", "h4");
  assert.ok(state.result);
  assert.deepEqual(state.result.winners, ["black"]);
  assert.match(state.result.reason, /Checkmate/);
});

test("custom leap pattern: a 3×1 knight", () => {
  const { variant, state } = position([place("knight", "white", "d4"), place("king", "white", "a1"), place("king", "black", "h8")], (v) => {
    def(v, "knight").movement[0].offsets = leaperOffsets(3, 1);
  });
  const moves = getLegalMoves(variant, state, { pieceId: pieceOn(state, "d4").id });
  assert.deepEqual(targets(moves), ["a3", "a5", "c1", "c7", "e1", "e7", "g3", "g5"]);
});

test("separate capture rules: knight moves normally but captures one square diagonally", () => {
  const { variant, state } = position(
    [place("knight", "white", "d4"), place("pawn", "black", "e5"), place("pawn", "black", "f5"), place("king", "white", "a1"), place("king", "black", "h8")],
    (v) => {
      const knight = def(v, "knight");
      knight.captureSameAsMove = false;
      knight.capture = [{ id: "diag", kind: "leap", offsets: [{ x: 1, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: -1 }], canJump: true, relativeTo: "board" }];
    },
  );
  const moves = getLegalMoves(variant, state, { pieceId: pieceOn(state, "d4").id });
  const captures = moves.filter((move) => move.captureIds.length);
  assert.deepEqual(targets(captures), ["e5"], "captures only diagonally");
  assert.ok(!targets(moves).includes("f5"), "f5 is a knight square but occupied — the knight cannot capture there");
  assert.ok(targets(moves).includes("e6"), "quiet knight moves still work");
});

test("sliding with a jump: bishop may hop over one piece", () => {
  const { variant, state } = position([place("bishop", "white", "c1"), place("pawn", "white", "d2"), place("pawn", "black", "f4"), place("king", "white", "a1"), place("king", "black", "h8")], (v) => {
    def(v, "bishop").movement[0] = { ...def(v, "bishop").movement[0], canJump: true, maxJumps: 1 };
  });
  const moves = targets(getLegalMoves(variant, state, { pieceId: pieceOn(state, "c1").id }));
  assert.ok(moves.includes("e3"), "hops over its own pawn");
  assert.ok(moves.includes("f4"), "captures after the hop");
  assert.ok(!moves.includes("g5"), "cannot hop a second piece");
});

test("pawn sideways step and a range-limited queen", () => {
  const { variant, state } = position([place("pawn", "white", "d4", { moved: true }), place("queen", "white", "a8"), place("king", "white", "h1"), place("king", "black", "h3")], (v) => {
    def(v, "pawn").movement.push({ id: "side", kind: "leap", offsets: [{ x: 1, y: 0 }, { x: -1, y: 0 }], canJump: true, relativeTo: "team" });
    def(v, "queen").movement[0].maxDistance = 3;
  });
  assert.deepEqual(targets(getLegalMoves(variant, state, { pieceId: pieceOn(state, "d4").id })), ["c4", "d5", "e4"]);
  const queen = targets(getLegalMoves(variant, state, { pieceId: pieceOn(state, "a8").id }));
  assert.ok(queen.includes("d8") && !queen.includes("e8") && queen.includes("a5") && !queen.includes("a4"));
});

test("disabled cells and custom boundaries shape movement", () => {
  const { variant, state } = position([place("rook", "white", "a1"), place("king", "white", "j1"), place("king", "black", "j10")], (v) => {
    v.board = resizeBoard(v.board, 10, 10);
    v.board = updateCell(v.board, sq("a5"), { enabled: false });
    v.rules = v.rules.map((rule) => ({ ...rule, enabled: false }));
  });
  const moves = targets(getLegalMoves(variant, state, { pieceId: pieceOn(state, "a1").id }));
  assert.ok(moves.includes("a4") && !moves.includes("a5") && !moves.includes("a6"), "slide stops at the hole");
  assert.ok(moves.includes("i1"), "board is 10 files wide");
  const explanation = explainPiece(variant, state, pieceOn(state, "a1").id);
  assert.match(explanation.find((entry) => squareName(entry.to) === "a5").reason, /not part of the board/);
  assert.match(explanation.find((entry) => squareName(entry.to) === "a6").reason, /path blocked/);
});

test("capturable king: kings may step into attack and capture ends the game through the event system", () => {
  const { variant, state } = position([place("king", "white", "e1"), place("rook", "black", "d8"), place("king", "black", "h8")], (v) => applyKingBehavior(v, "capturable"));
  const kingMoves = targets(getLegalMoves(variant, state, { pieceId: pieceOn(state, "e1").id }));
  assert.ok(kingMoves.includes("d1"), "moving into attack is legal");
  let next = play(variant, state, "e1", "d1");
  assert.equal(isInCheck(variant, next, "white"), false, "check is not a concept in capture mode");
  next = play(variant, next, "d8", "d1");
  assert.deepEqual(next.result?.winners, ["black"]);
  assert.ok(next.fired.some((event) => event.name.includes("defeat")));
});

test("successor king: the queen inherits the crown and play continues", () => {
  const { variant, state } = position(
    [place("king", "white", "e1"), place("queen", "white", "a1"), place("rook", "black", "e8"), place("king", "black", "h8")],
    (v) => applyKingBehavior(v, "successor"),
    "black",
  );
  const next = play(variant, state, "e8", "e1");
  assert.equal(next.result, null);
  assert.equal(pieceOn(next, "a1").type, "king");
  assert.equal(next.turn, "white");
});

test("lose after X turns uses delayed events; respawn returns the king", () => {
  const pieces = [place("king", "white", "e1"), place("pawn", "white", "a2"), place("rook", "black", "e8"), place("king", "black", "h8")];
  const lose = position(pieces, (v) => withKingConsequence(applyKingBehavior(v, "capturable"), { consequence: "loseAfterTurns", turns: 1, successor: "queen" }), "black");
  let state = play(lose.variant, lose.state, "e8", "e1");
  assert.equal(state.result, null);
  state = play(lose.variant, state, "a2", "a3");
  assert.deepEqual(state.result?.winners, ["black"]);

  const respawn = position(pieces, (v) => withKingConsequence(applyKingBehavior(v, "capturable"), { consequence: "respawn", turns: 1, successor: "queen" }), "black");
  state = play(respawn.variant, respawn.state, "e8", "e1");
  state = play(respawn.variant, state, "a2", "a3");
  const king = state.pieces.find((piece) => piece.team === "white" && piece.type === "king");
  assert.ok(king, "king respawned");
  assert.equal(squareName(king), "d1", "origin was occupied by the rook, so it appears next to it");
});

test("victory conditions: goal tiles, ANY vs ALL", () => {
  const { variant, state } = position([place("knight", "white", "b1"), place("king", "white", "e1"), place("king", "black", "e8")], (v) => {
    v.board = setTile(v.board, sq("c3"), "goal");
    v.victoryConditions = [victory("reachZone", { pieceType: "knight" })];
  });
  assert.deepEqual(play(variant, state, "b1", "c3").result?.winners, ["white"]);

  variant.victoryConditions = [victory("reachZone"), victory("surviveTurns", { turns: 5 })];
  variant.settings.victoryMode = "all";
  assert.equal(play(variant, createGameState(variant), "b1", "c3").result, null, "ALL requires surviving too");
});

test("capture all pieces victory", () => {
  const { variant, state } = position([place("rook", "white", "a1"), place("pawn", "black", "a7")], (v) => {
    v.settings.royalMode = "none";
    v.victoryConditions = [victory("captureAll")];
  });
  assert.deepEqual(play(variant, state, "a1", "a7").result?.winners, ["white"]);
});

test("portals teleport the moving piece; ice keeps it sliding", () => {
  const portal = position([place("rook", "white", "a1"), place("king", "white", "h1"), place("king", "black", "h8")], (v) => {
    v.board = setTile(setTile(v.board, sq("a4"), "portal"), sq("f6"), "portal");
    v.board = updateCell(v.board, sq("a4"), { portalTarget: sq("f6") });
  });
  const move = getLegalMoves(portal.variant, portal.state, { pieceId: pieceOn(portal.state, "a1").id }).find((entry) => squareName(entry.to) === "a4");
  assert.equal(squareName(move.landing), "f6");
  const after = applyMove(portal.variant, portal.state, move);
  assert.equal(pieceOn(after, "f6")?.type, "rook");
  assert.ok(after.effects.some((effect) => effect.kind === "portal"));

  const ice = position([place("rook", "white", "a1"), place("king", "white", "h1"), place("king", "black", "h8")], (v) => {
    v.board = setTile(setTile(v.board, sq("a3"), "ice"), sq("a4"), "ice");
  });
  const slid = play(ice.variant, ice.state, "a1", "a3");
  assert.ok(pieceOn(slid, "a5"), "slid across both ice tiles and stopped on normal ground");
});

test("blocked and danger tiles", () => {
  const { variant, state } = position([place("rook", "white", "a1"), place("pawn", "white", "h2"), place("king", "white", "e1"), place("king", "black", "e8")], (v) => {
    v.board = setTile(setTile(v.board, sq("a4"), "blocked"), sq("b1"), "danger");
  });
  assert.ok(!targets(getLegalMoves(variant, state, { pieceId: pieceOn(state, "a1").id })).includes("a5"));
  let next = play(variant, state, "a1", "b1");
  next = play(variant, next, "e8", "d8");
  next = play(variant, next, "h2", "h3");
  assert.equal(pieceOn(next, "b1"), undefined, "rook lost after staying a full turn on the danger tile");
});

test("cannon captures only over a screen", () => {
  const { variant, state } = position(
    [place("cannon", "white", "a1"), place("pawn", "white", "a3"), place("rook", "black", "a6"), place("rook", "black", "c1"), place("king", "white", "h2"), place("king", "black", "h8")],
    (v) => {
      v.pieces.push(...createExamplePieces().filter((piece) => piece.id === "cannon"));
    },
  );
  const moves = getLegalMoves(variant, state, { pieceId: pieceOn(state, "a1").id });
  assert.deepEqual(targets(moves.filter((move) => move.captureIds.length)), ["a6"]);
  assert.ok(targets(moves).includes("b1") && !targets(moves).includes("c1"));
});

test("events: tile entered spawns a piece; a self-retriggering chain is stopped by the loop guard", () => {
  const { variant, state } = position([place("rook", "white", "a1"), place("king", "white", "h1"), place("king", "black", "h8")], (v) => {
    v.events.push({
      id: "spawner",
      name: "Reinforcements",
      enabled: true,
      trigger: { type: "pieceEnterSquare", team: "any", square: sq("a4") },
      delayTurns: 0,
      conditionMode: "all",
      conditions: [],
      actions: [{ id: "a", type: "spawnPiece", pieceType: "knight", team: "actor", at: "square", square: sq("b4") }],
      elseActions: [],
      once: false,
    });
    v.board = setTile(setTile(v.board, sq("c5"), "goal"), sq("d5"), "goal");
    v.events.push({
      id: "bounce",
      name: "Bounce",
      enabled: true,
      trigger: { type: "tileEntered", team: "any", tile: "goal" },
      delayTurns: 0,
      conditionMode: "all",
      conditions: [],
      actions: [
        { id: "m1", type: "movePiece", target: "contextPiece", at: "square", square: sq("d5") },
        { id: "m2", type: "movePiece", target: "contextPiece", at: "square", square: sq("c5") },
      ],
      elseActions: [],
      once: false,
    });
  });
  const spawned = play(variant, state, "a1", "a4");
  assert.equal(pieceOn(spawned, "b4")?.type, "knight");

  const rookToC = play(variant, state, "a1", "a5");
  const looped = play(variant, play(variant, rookToC, "h8", "g8"), "a5", "c5");
  assert.ok(looped.messages.some((message) => /loop guard/.test(message.text)));
});

test("rule debugger explains legal and illegal destinations", () => {
  const { variant, state } = position([place("knight", "white", "e4"), place("pawn", "white", "f6"), place("pawn", "black", "c5"), place("king", "white", "a1"), place("king", "black", "h8")]);
  const entries = explainPiece(variant, state, pieceOn(state, "e4").id);
  const byName = Object.fromEntries(entries.map((entry) => [squareName(entry.to), entry]));
  assert.equal(byName.f6.legal, false);
  assert.match(byName.f6.reason, /own piece/);
  assert.equal(byName.c5.legal, true);
  assert.equal(byName.c5.kind, "capture");
  assert.match(byName.g5.reason, /\(\+2, \+1\)|\(\+1, \+2\)/);
});

test("check filtering: pinned pieces and king moves into check are illegal in checkmate mode", () => {
  const { variant, state } = position([place("king", "white", "e1"), place("bishop", "white", "e2"), place("rook", "black", "e8"), place("king", "black", "a8")]);
  assert.equal(getLegalMoves(variant, state, { pieceId: pieceOn(state, "e2").id }).length, 0);
  const explanation = explainPiece(variant, state, pieceOn(state, "e2").id);
  assert.ok(explanation.some((entry) => /king in check/.test(entry.reason)));
});

test("serialization round-trips and rejects broken or future documents", () => {
  const variant = createVariantFromPreset("portal");
  const imported = parseVariantJson(serializeVariant(variant));
  assert.deepEqual(imported.errors, []);
  assert.equal(imported.variant.name, variant.name);
  assert.deepEqual(imported.variant.board, variant.board);
  assert.equal(imported.variant.remixedFrom, variant.id, "imports keep remix lineage");
  assert.notEqual(imported.variant.id, variant.id);

  assert.ok(parseVariantJson("{nope").errors.length);
  assert.ok(parseVariantJson(JSON.stringify({ ...variant, schemaVersion: 99 })).errors.some((error) => /newer schema/.test(error)));
  assert.ok(parseVariantJson(JSON.stringify({ ...variant, pieces: [] })).errors.length);
  const legacy = parseVariantJson(JSON.stringify({ ...variant, schemaVersion: undefined }));
  assert.ok(legacy.variant && legacy.warnings.some((warning) => /schema version/.test(warning)));
});

test("every preset loads, validates without errors and survives random play", () => {
  for (const preset of PRESETS) {
    const variant = createVariantFromPreset(preset.id, 7);
    const errors = validateVariant(variant).filter((issue) => issue.severity === "error");
    assert.deepEqual(errors, [], `${preset.name} has validation errors`);
    let state = createGameState(variant);
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let ply = 0; ply < 40 && !state.result; ply++) {
      const move = chooseAiMove(variant, state, "random", random);
      if (!move) break;
      state = applyMove(variant, state, move);
    }
  }
});

test("validation flags broken rules", () => {
  const variant = createVariantFromPreset("standard");
  variant.board = setTile(variant.board, sq("d4"), "portal");
  def(variant, "pawn").promotion.options.push("unicorn");
  variant.events.push({ id: "e", name: "Ghost", enabled: true, trigger: { type: "pieceMove", pieceType: "phoenix" }, delayTurns: 0, conditionMode: "all", conditions: [], actions: [], elseActions: [], once: false });
  variant.victoryConditions = [];
  const messages = validateVariant(variant).map((issue) => `${issue.severity}: ${issue.message}`).join("\n");
  assert.match(messages, /error: Portal on d4 has no destination/);
  assert.match(messages, /promotes to a missing piece \(unicorn\)/);
  assert.match(messages, /deleted piece type \(phoenix\)/);
  assert.match(messages, /No victory condition exists/);
});

test("greedy AI takes a free queen and never plays illegal moves", () => {
  const { variant, state } = position([place("rook", "white", "a1"), place("queen", "black", "a7"), place("king", "white", "h1"), place("king", "black", "e8")]);
  const move = chooseAiMove(variant, state, "greedy", () => 0.5);
  assert.equal(squareName(move.to), "a7");
});

test("search AI: finds mate in one, keeps its queen safe, races to custom goals, respects its time budget", async () => {
  const { searchBestMove } = await import("../src/games/chess/custom/engine/index.ts");
  const options = { maxDepth: 3, timeMs: 3000, random: () => 0.5 };

  // Back-rank mate: Ra1-a8#.
  const mate = position([place("rook", "white", "a1"), place("king", "white", "g1"), place("pawn", "white", "f2"), place("pawn", "white", "g2"), place("pawn", "white", "h2"), place("king", "black", "g8"), place("pawn", "black", "f7"), place("pawn", "black", "g7"), place("pawn", "black", "h7")]);
  assert.equal(squareName(searchBestMove(mate.variant, mate.state, options).move.to), "a8");

  // The attacked queen must move (or be defended) rather than ignore the threat.
  const threat = position([place("queen", "white", "d4"), place("king", "white", "g1"), place("knight", "black", "e6"), place("king", "black", "g8")]);
  const queenMove = searchBestMove(threat.variant, threat.state, options).move;
  const after = applyMove(threat.variant, threat.state, queenMove);
  const queen = after.pieces.find((piece) => piece.type === "queen");
  assert.ok(queen, "queen still on the board");
  assert.ok(!getLegalMoves(threat.variant, after).some((move) => move.captureIds.includes(queen.id)), "queen is not left en prise");

  // Custom victory: a knight reaching the goal tile wins outright.
  const goal = position([place("knight", "white", "b1"), place("king", "white", "h1"), place("king", "black", "h8")], (v) => {
    v.board = setTile(v.board, sq("c3"), "goal");
    v.victoryConditions = [victory("reachZone", { pieceType: "knight" }), victory("checkmate")];
  });
  assert.equal(squareName(searchBestMove(goal.variant, goal.state, options).move.to), "c3");

  const started = Date.now();
  const timed = searchBestMove(createVariantFromPreset("large-board"), createGameState(createVariantFromPreset("large-board")), { maxDepth: 12, timeMs: 300 });
  assert.ok(timed.move, "always returns a move");
  assert.ok(Date.now() - started < 1500, "stops close to its budget");
});

test("four teams: a captured king knocks a team out and the rest play on", () => {
  const variant = createVariantFromPreset("four-kingdoms");
  const sq2 = (x, y) => ({ x, y });
  variant.setup = {
    startingTeam: "white",
    turnNumber: 1,
    pieces: [
      { type: "king", team: "white", ...sq2(6, 0) }, { type: "rook", team: "white", ...sq2(0, 6) },
      { type: "king", team: "red", ...sq2(0, 8) },
      { type: "king", team: "black", ...sq2(7, 13) }, { type: "pawn", team: "black", ...sq2(9, 12), moved: true },
      { type: "king", team: "blue", ...sq2(13, 5) }, { type: "pawn", team: "blue", ...sq2(12, 9), moved: true },
    ],
  };
  let state = createGameState(variant);
  const rook = state.pieces.find((piece) => piece.type === "rook");
  const capture = getLegalMoves(variant, state, { pieceId: rook.id }).find((move) => move.to.x === 0 && move.to.y === 8);
  state = applyMove(variant, state, capture);
  assert.equal(state.result, null, "three teams remain, so the game continues");
  assert.deepEqual(state.eliminated, ["red"]);
  assert.ok(!state.pieces.some((piece) => piece.team === "red"));
  assert.equal(state.turn, "black", "red's turn is skipped");
});
