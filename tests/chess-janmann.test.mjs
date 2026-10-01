import test from "node:test";
import assert from "node:assert/strict";
import { variants } from "../src/data/chessVariants.ts";
import { JANMANN, DEFAULT_OUTER_RADIUS_M } from "../src/games/chess/janmann/config.ts";
import { NODES, TOPOLOGY, getDividendBarycentricPosition } from "../src/games/chess/janmann/topology.ts";
import { assemblyPhase, dividendPosition, getDividendPolygon, getFlatSectorTransform, projectSectorPointToSphere, snubCubeVertices, stretchAt } from "../src/games/chess/janmann/geometry.ts";
import { applyMove, attackTargets, createGame, eligibleExtractions, finishTurn, getControl, getLegalMoves, getSecuredSectors, hasVolumetricDominance, isInCheck } from "../src/games/chess/janmann/rules.ts";
import { measureVolume, sphereVolume, surfaceToVolumeM3 } from "../src/games/chess/janmann/volume.ts";
import { createCommunityService } from "../src/games/chess/custom/storage/communityService.ts";

const offline = { rpc: async () => { throw new Error("offline"); }, from: () => { throw new Error("Unexpected database access"); } };
const piece = (kind, side, at) => ({ id: `${side}-${kind}-${at}`, kind, side, at });
const sparse = (...pieces) => ({ ...createGame(), pieces });
const antipode = (id) => `${NODES[id].sectorId ^ 7}:${NODES[id].dividendIndex}`;
const sorted = (items) => [...new Set(items)].sort();

test("one fixed authored card is discoverable in Community and Pluto and bypasses the configurator", async () => {
  const cards = variants.filter((card) => card.id === JANMANN.id);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].title, "Janmann's Gambit");
  assert.equal(cards[0].author, "Yannick");
  assert.equal(cards[0].configurable, false);
  assert.equal(cards[0].customId, undefined);
  assert.equal(cards[0].configureRoute, undefined);
  assert.match(cards[0].description, /^Think differently/);
  const service = createCommunityService(offline);
  const community = await service.list("top", "Janmann", 24, 0, "players");
  const pluto = await service.list("top", "Janmann", 24, 0, "pluto");
  assert.equal(community.length, 1); assert.deepEqual(community, pluto);
  assert.equal(community[0].builtin, cards[0]);
  assert.equal(community[0].authorName, "Yannick");
  assert.equal(community[0].ownerId, null);
  await assert.rejects(service.load(community[0].id), /not configurable/);
  await assert.rejects(service.unpublish(community[0].id));
});

test("80 unique nodes, reciprocal connected neighbors, systematic seams and closed sliding rings", () => {
  assert.equal(TOPOLOGY.length, 80); assert.equal(new Set(TOPOLOGY.map((node) => node.id)).size, 80);
  const visited = new Set([TOPOLOGY[0].id]);
  for (const id of visited) for (const next of NODES[id].neighbors) visited.add(next);
  assert.equal(visited.size, 80);
  for (const node of TOPOLOGY) {
    assert.equal(TOPOLOGY.filter((other) => other.sectorId === node.sectorId).length, 10);
    assert.ok(Math.abs(node.barycentric.reduce((a, b) => a + b) - 1) < 1e-12);
    for (const neighbor of node.neighbors) assert.ok(NODES[neighbor].neighbors.includes(node.id));
    node.logical.forEach((value, axis) => {
      if (Math.abs(value) === 1) {
        const coordinate = node.logical.map((v, i) => i === axis ? -v : v);
        const seam = TOPOLOGY.find((other) => other.logical.every((v, i) => v === coordinate[i]));
        assert.ok(node.neighbors.includes(seam.id));
      }
    });
    for (const ray of [...node.rookContinuations, ...node.bishopContinuations]) {
      assert.equal(new Set(ray).size, ray.length); assert.ok(!ray.includes(node.id));
      assert.ok([...NODES[ray[0]].rookContinuations, ...NODES[ray[0]].bishopContinuations].some((reverse) => reverse[0] === node.id));
    }
  }
  assert.throws(() => getDividendBarycentricPosition(10));
});

test("antipodal deployment and pawn movement are symmetric and king safe", () => {
  const state = createGame();
  assert.equal(state.pieces.length, 32); assert.equal(new Set(state.pieces.map((p) => p.at)).size, 32);
  assert.equal(Object.values(state.dividends).reduce((sum, node) => sum + node.remainingVolumeM3, 0), 240);
  for (const p of state.pieces.filter((p) => p.side === "white")) assert.ok(state.pieces.some((other) => other.side === "black" && other.kind === p.kind && other.at === antipode(p.at)));
  assert.equal(isInCheck(state, "white"), false); assert.equal(isInCheck(state, "black"), false);
  assert.ok(getLegalMoves(state).length > 0);
  assert.equal(getLegalMoves(state).length, getLegalMoves(state, "black").length);
  for (const node of TOPOLOGY) {
    const other = NODES[antipode(node.id)];
    assert.equal(node.pawn.white.forward && antipode(node.pawn.white.forward), other.pawn.black.forward);
    assert.deepEqual(sorted(node.pawn.white.captures.map(antipode)), sorted(other.pawn.black.captures));
    for (const jump of node.knightJumps) assert.ok(NODES[jump].knightJumps.includes(node.id));
  }
});

test("king, rook, bishop, queen, knight and pawn use the canonical graph across seams", () => {
  const state = sparse();
  for (const node of TOPOLOGY) {
    assert.deepEqual(sorted(attackTargets(state, piece("king", "white", node.id))), sorted(node.neighbors));
    const rook = attackTargets(state, piece("rook", "white", node.id));
    const bishop = attackTargets(state, piece("bishop", "white", node.id));
    assert.deepEqual(sorted(attackTargets(state, piece("queen", "white", node.id))), sorted([...rook, ...bishop]));
    assert.ok(rook.some((id) => NODES[id].sectorId !== node.sectorId));
    assert.ok(bishop.some((id) => NODES[id].sectorId !== node.sectorId));
    assert.deepEqual(sorted(attackTargets(state, piece("knight", "white", node.id))), sorted(node.knightJumps));
    assert.deepEqual(sorted(attackTargets(state, piece("pawn", "white", node.id))), sorted(node.pawn.white.captures));
  }
});

test("all legal moves preserve king safety; kings cannot be captured; pawns promote", () => {
  const state = createGame();
  for (const move of getLegalMoves(state)) {
    const next = applyMove(state, move);
    assert.equal(isInCheck(next, "white"), false);
    assert.equal(next.pieces.filter((p) => p.kind === "king").length, 2);
  }
  const p = piece("pawn", "white", "4:3");
  const promotionState = sparse(piece("king", "white", "0:0"), piece("king", "black", "7:0"), p);
  const move = getLegalMoves(promotionState).find((move) => move.from === p.at && NODES[move.to].logical[0] <= -5);
  assert.ok(move);
  for (const promotion of ["queen", "rook", "bishop", "knight"]) assert.equal(applyMove(promotionState, { ...move, promotion }).pieces.find((other) => other.id === p.id).kind, promotion);
});

test("captures remove the opponent but preserve the Dividend's unextracted volume", () => {
  const state = sparse(piece("king", "white", "0:0"), piece("king", "black", "7:0"), piece("rook", "white", "0:3"), piece("pawn", "black", "0:6"));
  const move = getLegalMoves(state).find((move) => move.to === "0:6");
  assert.ok(move);
  const next = applyMove(state, move);
  assert.equal(next.pieces.some((p) => p.at === "0:6" && p.side === "black"), false);
  assert.deepEqual(next.dividends, state.dividends);
  assert.deepEqual(next.extractedVolumeM3, { white: 0, black: 0 });
});

test("control counts attack, occupation and contention; sector ties are unsecured", () => {
  const state = sparse(piece("knight", "white", "0:0"), piece("knight", "black", "7:0"));
  const control = getControl(state);
  const white = new Set(["0:0", ...attackTargets(state, state.pieces[0])]);
  const black = new Set(["7:0", ...attackTargets(state, state.pieces[1])]);
  for (const node of TOPOLOGY) assert.equal(control[node.id], white.has(node.id) && black.has(node.id) ? "contested" : white.has(node.id) ? "white" : black.has(node.id) ? "black" : "neutral");
  const example = Object.fromEntries(TOPOLOGY.map((node) => [node.id, "neutral"]));
  for (let i = 0; i < 10; i++) example[`0:${i}`] = i < 6 ? "white" : i < 9 ? "black" : "contested";
  assert.equal(getSecuredSectors(example)[0], "white");
  example["0:0"] = "black"; example["0:1"] = "void";
  assert.equal(getSecuredSectors(example)[0], null);
});

test("extraction is optional, requires uncontested occupation, and updates volume atomically", () => {
  const state = createGame();
  assert.deepEqual(eligibleExtractions(state), []);
  const moved = applyMove(state, getLegalMoves(state)[0]);
  const before = JSON.stringify(moved);
  const eligible = eligibleExtractions(moved);
  assert.ok(eligible.length);
  const control = getControl(moved);
  for (const id of eligible) {
    assert.equal(control[id], "white"); assert.ok(moved.pieces.some((p) => p.at === id && p.side === "white"));
  }
  const next = finishTurn(moved, eligible[0]);
  assert.equal(next.extractedVolumeM3.white, 1); assert.equal(next.turn, "black");
  assert.equal(next.dividends[eligible[0]].remainingVolumeM3, 2);
  assert.equal(next.dividends[eligible[0]].minedVolumeM3, 1);
  assert.equal(JSON.stringify(moved), before);
  const preserved = finishTurn(moved);
  assert.deepEqual(preserved.dividends, moved.dividends); assert.equal(preserved.extractedVolumeM3.white, 0);
  const invalid = TOPOLOGY.find((n) => !eligible.includes(n.id)).id;
  assert.throws(() => finishTurn(moved, invalid));
  assert.throws(() => finishTurn(next));
  assert.throws(() => applyMove(moved, getLegalMoves(state)[0]));
});

test("depletion sacrifices the occupant, creates a Void and cannot sacrifice a king", () => {
  const state = { ...sparse(piece("king", "white", "0:0"), piece("king", "black", "7:0"), piece("knight", "white", "0:4")), phase: "extract" };
  state.dividends["0:4"] = { remainingVolumeM3: 1, minedVolumeM3: 2 };
  state.dividends["0:0"] = { remainingVolumeM3: 1, minedVolumeM3: 2 };
  assert.ok(eligibleExtractions(state).includes("0:4"));
  assert.ok(!eligibleExtractions(state).includes("0:0"));
  const next = finishTurn(state, "0:4");
  assert.equal(next.dividends["0:4"].remainingVolumeM3, 0); assert.equal(getControl(next)["0:4"], "void");
  assert.equal(next.pieces.some((p) => p.at === "0:4"), false);
  assert.equal(next.extractedVolumeM3.white, 1);
});

test("Voids are forbidden destinations but do not block sliders or knight jumps", () => {
  const state = sparse();
  const start = "0:0", [first, second] = NODES[start].rookContinuations[0];
  state.dividends[first] = { remainingVolumeM3: 0, minedVolumeM3: 3 };
  for (const kind of ["king", "queen", "rook", "bishop", "knight", "pawn"]) assert.ok(!attackTargets(state, piece(kind, "white", start)).includes(first));
  assert.ok(attackTargets(state, piece("rook", "white", start)).includes(second));
  const knight = piece("knight", "white", start);
  assert.deepEqual(sorted(attackTargets(state, knight)), sorted(NODES[start].knightJumps.filter((id) => id !== first)));
  // Occupants, even on a corrupt/legacy Void, still block the sliding ray.
  state.pieces.push(piece("pawn", "black", first));
  const blocked = attackTargets(state, piece("rook", "white", start));
  assert.ok(!blocked.includes(first));
});

test("contested occupation cannot extract and sacrifice cannot expose its own king", () => {
  const initial = createGame();
  const moved = applyMove(initial, { from: "0:4", to: "0:8" });
  assert.equal(getControl(moved)["0:8"], "contested");
  assert.ok(!eligibleExtractions(moved).includes("0:8"));
  assert.throws(() => finishTurn(moved, "0:8"));
  // Find a graph pin: a friendly blocker protects the king from an enemy slider.
  let found = false;
  for (const ray of NODES["0:0"].rookContinuations) {
    const [blocker, attacker] = ray;
    // The ring is closed, so also block its other approach to the king.
    const state = { ...sparse(piece("king", "white", "0:0"), piece("king", "black", "7:0"), piece("knight", "white", blocker), piece("pawn", "white", ray.at(-1)), piece("rook", "black", attacker)), phase: "extract" };
    if (new Set(state.pieces.map((p) => p.at)).size !== 5 || isInCheck(state, "white")) continue;
    const without = { ...state, pieces: state.pieces.filter((p) => p.at !== blocker) };
    if (!isInCheck(without, "white")) continue;
    state.dividends[blocker] = { remainingVolumeM3: 1, minedVolumeM3: 2 };
    assert.ok(!eligibleExtractions(state).includes(blocker));
    found = true;
    break;
  }
  assert.ok(found, "a seam-aware sliding pin is exercised");
});

test("a king with no legal moves and no check produces stalemate", () => {
  const state = { ...sparse(piece("king", "white", "0:0"), piece("king", "black", "7:0")), phase: "extract" };
  for (const id of NODES["7:0"].neighbors) state.dividends[id] = { remainingVolumeM3: 0, minedVolumeM3: 3 };
  assert.equal(isInCheck(state, "black"), false);
  assert.equal(getLegalMoves(state, "black").length, 0);
  assert.deepEqual(finishTurn(state).result, { winner: null, reason: "stalemate" });
});

test("checkmate resolves immediately, before extraction or a potential volume win", () => {
  const state = sparse(piece("king", "white", "0:3"), piece("queen", "white", "1:1"), piece("king", "black", "0:0"));
  state.extractedVolumeM3.black = 50;
  const mate = getLegalMoves(state).find((move) => move.from === "1:1" && move.to === "0:1");
  assert.ok(mate);
  const next = applyMove(state, mate);
  assert.deepEqual(next.result, { winner: "white", reason: "checkmate" });
  assert.deepEqual(eligibleExtractions(next), []);
  assert.throws(() => finishTurn(next));
});

test("Volumetric Dominance requires both thresholds and is awarded only at end of turn", () => {
  assert.equal(hasVolumetricDominance(49, 5), false);
  assert.equal(hasVolumetricDominance(50, 4), false);
  assert.equal(hasVolumetricDominance(50, 5), true);
  const state = { ...sparse(piece("king", "white", "0:0"), piece("king", "black", "6:2"), piece("queen", "white", "0:4"), piece("queen", "white", "3:4"), piece("queen", "white", "0:1")), phase: "extract" };
  assert.ok(getSecuredSectors(getControl(state)).filter((side) => side === "white").length >= 5);
  state.extractedVolumeM3.white = 49;
  const eligible = eligibleExtractions(state);
  assert.ok(eligible.length);
  assert.equal(state.result, null);
  assert.deepEqual(finishTurn(state, eligible[0]).result, { winner: "white", reason: "Volumetric Dominance" });
  assert.notEqual(finishTurn(state).result?.reason, "Volumetric Dominance");
});

test("congruent flat sectors tile into eight exact spherical octants; view and measurement preserve state", () => {
  const state = createGame(), before = JSON.stringify(state);
  const area = (polygon) => Math.abs(polygon.reduce((sum, point, i) => {
    const next = polygon[(i + 1) % polygon.length];
    return sum + point[1] * next[2] - next[1] * point[2];
  }, 0)) / 2;
  assert.ok(Math.abs(Array.from({ length: 10 }, (_, index) => area(getDividendPolygon(index))).reduce((a, b) => a + b) - .5) < 1e-10, "Dividend polygons cover the canonical triangle exactly");
  for (let sector = 0; sector < 8; sector++) {
    const vertices = getFlatSectorTransform(sector);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(Math.hypot(...vertices[i].map((value, axis) => value - vertices[(i + 1) % 3][axis])) - 4) < 1e-10);
  }
  for (const node of TOPOLOGY) {
    const polygon = getDividendPolygon(node.dividendIndex);
    assert.ok(polygon.length >= 3);
    for (const bary of polygon) {
      assert.ok(bary.every((weight) => weight >= -1e-10 && weight <= 1 + 1e-10));
      assert.ok(Math.abs(Math.hypot(...projectSectorPointToSphere(node.sectorId, bary)) - DEFAULT_OUTER_RADIUS_M) < 1e-10);
    }
    for (const progress of [0, .1, .25, .5, .75, 1, .5, 0]) assert.ok(dividendPosition(node.id, progress).every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...dividendPosition(node.id, 1)) - DEFAULT_OUTER_RADIUS_M) < 1e-10);
    for (const t of [0, .2, .7, 1]) measureVolume(5, 5 * t, Math.PI / 20);
  }
  assert.equal(JSON.stringify(state), before);
  assert.equal(stretchAt(0), 1); assert.equal(stretchAt(1), 5);
  assert.equal(assemblyPhase(0), "Planar"); assert.equal(assemblyPhase(1), "Locked");
  const cube = snubCubeVertices(); assert.equal(cube.length, 24);
  assert.equal(new Set(cube.map((point) => point.join())).size, 24);
});

test("volume arithmetic stays dimensional, nonnegative and symmetric", () => {
  for (const amount of [0, 50, 100]) assert.equal(surfaceToVolumeM3(amount), amount);
  assert.ok(Math.abs(sphereVolume(1) - 4 * Math.PI / 3) < 1e-12);
  const measured = measureVolume(5, 2.3, Math.PI / 2);
  assert.ok(Math.abs(measured.result - (sphereVolume(5) - sphereVolume(2.3)) / 8) < 1e-10);
  assert.ok(Math.abs(measured.result - (measured.outer - measured.inner - measured.angleCut)) < 1e-10);
  assert.equal(measureVolume(2, 5, 4 * Math.PI).result, 0);
  assert.equal(measureVolume(5, 0, -1).result, 0);
  assert.equal(measureVolume(5, 0, 99).result, sphereVolume(5));
});

test("deterministic games preserve conservation, king safety and reset isolation", () => {
  for (let seed = 0; seed < 8; seed++) {
    let state = createGame();
    for (let turn = 0; turn < 45 && !state.result; turn++) {
      const moves = getLegalMoves(state); assert.ok(moves.length);
      const mover = state.turn;
      state = applyMove(state, moves[(seed * 17 + turn * 13) % moves.length]);
      assert.equal(isInCheck(state, mover), false);
      if (!state.result) state = finishTurn(state, eligibleExtractions(state)[0]);
      assert.equal(isInCheck(state, mover), false);
      assert.equal(new Set(state.pieces.map((p) => p.at)).size, state.pieces.length);
      assert.ok(state.pieces.every((p) => state.dividends[p.at].remainingVolumeM3 > 0));
      const volume = Object.values(state.dividends).reduce((sum, d) => sum + d.remainingVolumeM3, 0);
      assert.equal(volume + state.extractedVolumeM3.white + state.extractedVolumeM3.black, 240);
    }
  }
  assert.deepEqual(createGame(), createGame());
});
