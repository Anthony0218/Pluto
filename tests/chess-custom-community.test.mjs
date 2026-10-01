import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { variants } from "../src/data/chessVariants.ts";
import { plutoCommunityCatalog, mergeCommunityEntries } from "../src/games/chess/custom/library/communityCatalog.ts";
import { createPlutoVariant, PLUTO_CUSTOM_IDS } from "../src/games/chess/custom/library/plutoVariants.ts";
import { createCommunityService } from "../src/games/chess/custom/storage/communityService.ts";
import { localVariantRepository } from "../src/games/chess/custom/storage/variantRepository.ts";
import { createGameState, createVariantFromPreset, getLegalMoves, applyMove, isInCheck, validateVariant, parseVariantJson, createPosition, generateCandidates, eliminateTeam, evaluateVictory, evaluatePosition, victory, setTile } from "../src/games/chess/custom/engine/index.ts";

const offline = { rpc: async () => { throw new Error("offline"); }, from: () => { throw new Error("unexpected database request"); } };
const play = (variant, state, from, to) => {
  const piece = state.pieces.find((piece) => piece.x === from[0] && piece.y === from[1]);
  const move = getLegalMoves(variant, state, { pieceId: piece?.id }).find((move) => move.to.x === to[0] && move.to.y === to[1]);
  assert.ok(move, `legal move ${from} → ${to}`);
  return applyMove(variant, state, move);
};

test("every visible built-in variant preserves authored attribution and its canonical launch route", async () => {
  const catalog = plutoCommunityCatalog();
  const builtins = catalog.filter((entry) => entry.kind === "builtin");
  const visible = variants.filter((entry) => entry.available && !entry.customId);
  assert.deepEqual(builtins.map((entry) => entry.builtin.id), visible.map((entry) => entry.id));
  const routes = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
  const service = createCommunityService(offline);
  for (const entry of builtins) {
    assert.equal(entry.authorName, entry.builtin.author ?? "Pluto");
    assert.equal(entry.configurable, false);
    assert.equal(entry.builtin, variants.find((variant) => variant.id === entry.builtin.id));
    assert.ok(routes.includes(`path: "${entry.builtin.hotseatRoute ?? entry.builtin.route}"`), entry.name);
    await assert.rejects(service.load(entry.id), /not configurable/);
    await assert.rejects(service.unpublish(entry.id), /cannot be unpublished/);
  }
  const ui = readFileSync(new URL("../src/components/chessCustom/community/CommunityView.tsx", import.meta.url), "utf8");
  assert.match(ui, /entry\.configurable !== false && <Button/);
  assert.match(ui, /if \(entry\.configurable === false\) return/);
  assert.match(ui, /Not configurable/);
});

test("Pluto Create documents are stable, valid, playable and survive export, remix, save and reload", async () => {
  const storage = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
  try {
    const service = createCommunityService(offline);
    for (const id of PLUTO_CUSTOM_IDS) {
      const original = createPlutoVariant(id);
      assert.deepEqual(original, createPlutoVariant(id));
      assert.deepEqual(validateVariant(original).filter((issue) => issue.severity !== "info"), []);
      const state = createGameState(original);
      assert.equal(state.result, null);
      assert.equal(state.pieces.length, original.setup.pieces.length);
      for (const team of original.teams) assert.ok(getLegalMoves(original, state, { asTeam: team.id }).length);
      const copy = await service.load(id);
      const another = await service.load(id);
      assert.notEqual(copy.id, id);
      assert.notEqual(copy.id, another.id);
      assert.equal(copy.remixedFrom, id);
      copy.name = "My remix";
      await localVariantRepository.save(copy);
      const restored = await localVariantRepository.load(copy.id);
      assert.equal(restored.name, "My remix");
      assert.deepEqual(restored.teams, original.teams);
      assert.deepEqual(restored.events, original.events);
      assert.equal(createPlutoVariant(id).name, original.name);
      const preview = await service.previews([id]);
      assert.equal(preview[id].preview.pieces.length, state.pieces.length);
      assert.equal((await service.details(id)).teams.length, original.teams.length);
    }
    const old = createVariantFromPreset("standard");
    for (const schemaVersion of [1, 2]) {
      const parsed = parseVariantJson(JSON.stringify({ ...old, schemaVersion }), { keepIdentity: true });
      assert.equal(parsed.variant.id, old.id);
      assert.ok(parsed.variant.teams.every((team) => !team.alliance));
      assert.equal(getLegalMoves(parsed.variant, createGameState(parsed.variant)).length, 20);
    }
  } finally { globalThis.localStorage = previous; }
});

test("Community merges remote entries, searches, sorts and paginates without duplicate Pluto cards", async () => {
  const catalog = plutoCommunityCatalog();
  const remote = Array.from({ length: 130 }, (_, i) => ({ ...catalog[0], id: `user-${i}`, authorName: "Player", publishedAt: new Date(Date.UTC(2026, 9, 2 + i)).toISOString(), score: i % 4, playCount: i % 7, name: `Player game ${i}` }));
  const client = { rpc: async (_, args) => {
    const rows = mergeCommunityEntries(remote, [], args.p_sort, args.p_search).slice(args.p_offset, args.p_offset + args.p_limit);
    return { data: rows.map((row) => ({ ...row, owner_id: "user", author_name: row.authorName, board_size: "8x8", piece_types: 6, play_count: row.playCount, published_at: row.publishedAt, my_vote: 0 })), error: null };
  } };
  const service = createCommunityService(client);
  for (const sort of ["new", "played", "top"]) {
    const expected = mergeCommunityEntries(remote, catalog, sort);
    const actual = [];
    for (let offset = 0; offset < expected.length; offset += 24) actual.push(...await service.list(sort, "", 24, offset));
    assert.deepEqual(actual.map((row) => row.id), expected.map((row) => row.id));
    assert.equal(new Set(actual.map((row) => row.id)).size, expected.length);
  }
  assert.equal((await service.list("top", "Pluto", 100)).length, mergeCommunityEntries([], catalog, "top", "Pluto").length);
  const offlineService = createCommunityService(offline);
  const first = await offlineService.list("top");
  assert.equal(offlineService.remoteUnavailable, true);
  assert.deepEqual((await createCommunityService(offline).list("top")).map((row) => row.id), first.map((row) => row.id));
  assert.equal((await offlineService.list("top", "pluto team"))[0].id, "pluto-team-chess");
  assert.ok(first.every((row) => row.authorName === (row.builtin?.author ?? "Pluto")));
});

test("Pluto and player tabs have separate catalogs and pagination", async () => {
  const catalog = plutoCommunityCatalog(true);
  assert.equal(catalog.length, variants.length);
  const remote = Array.from({ length: 35 }, (_, i) => ({ ...catalog[0], id: `player-${i}`, ownerId: "player", authorName: "Player", name: `Player ${i}`, official: false }));
  const client = { rpc: async (_, args) => ({
    data: mergeCommunityEntries(remote, [], args.p_sort, args.p_search).slice(args.p_offset, args.p_offset + args.p_limit).map((row) => ({ ...row, owner_id: row.ownerId, author_name: row.authorName, board_size: "8x8", piece_types: 6, play_count: 0, published_at: row.publishedAt, my_vote: 0 })),
    error: null,
  }) };
  const service = createCommunityService(client);
  const pluto = await service.list("top", "", 100, 0, "pluto");
  assert.deepEqual(pluto.map((entry) => entry.id), catalog.map((entry) => entry.id));
  assert.equal(service.remoteUnavailable, false);
  const players = [
    ...await service.list("top", "", 24, 0, "players"),
    ...await service.list("top", "", 24, 24, "players"),
  ];
  const authored = catalog.filter((entry) => entry.builtin?.collections?.includes("community"));
  assert.equal(players.length, remote.length + authored.length);
  assert.deepEqual(players.slice(0, authored.length).map((entry) => entry.id), authored.map((entry) => entry.id));
  assert.ok(players.slice(authored.length).every((entry) => !entry.official && entry.authorName === "Player"));
});

test("2v2 rotates armies, blocks allied captures and attacks, and allows enemy captures", () => {
  const variant = createPlutoVariant("pluto-team-chess");
  let state = createGameState(variant);
  for (const expected of ["white", "red", "black", "blue", "white"]) {
    assert.equal(state.turn, expected);
    state = applyMove(variant, state, getLegalMoves(variant, state)[0]);
  }
  variant.setup.pieces = [
    { type: "king", team: "white", x: 5, y: 3 },
    { type: "rook", team: "black", x: 5, y: 5 },
    { type: "king", team: "black", x: 7, y: 12 },
    { type: "king", team: "red", x: 0, y: 7 },
    { type: "king", team: "blue", x: 13, y: 7 },
    { type: "rook", team: "white", x: 5, y: 4 },
    { type: "pawn", team: "red", x: 4, y: 4 },
  ];
  state = createGameState(variant);
  const rook = state.pieces.find((piece) => piece.team === "white" && piece.type === "rook");
  const moves = getLegalMoves(variant, state, { pieceId: rook.id });
  assert.ok(!moves.some((move) => move.to.x === 5 && move.to.y >= 5));
  assert.ok(moves.some((move) => move.to.x === 4 && move.to.y === 4 && move.captureIds.length));
  state.pieces = state.pieces.filter((piece) => piece.id !== rook.id && piece.type !== "pawn");
  state.royalMode = "checkmate";
  assert.equal(isInCheck(variant, state, "white"), false);
  state.pieces.find((piece) => piece.type === "rook").team = "red";
  assert.equal(isInCheck(variant, state, "white"), true);
});

test("capturing kings removes armies, skips their turns, and shares victory with an eliminated partner", () => {
  const variant = createPlutoVariant("pluto-team-chess");
  variant.setup.pieces = [
    { type: "king", team: "white", x: 5, y: 0 }, { type: "rook", team: "white", x: 3, y: 3 },
    { type: "king", team: "red", x: 3, y: 5 }, { type: "pawn", team: "red", x: 1, y: 7 },
    { type: "king", team: "black", x: 5, y: 13 }, { type: "rook", team: "black", x: 9, y: 9 },
    { type: "king", team: "blue", x: 9, y: 7 },
  ];
  let state = play(variant, createGameState(variant), [3, 3], [3, 5]);
  assert.equal(state.result, null);
  assert.equal(state.turn, "black");
  assert.deepEqual(state.eliminated, ["red"]);
  assert.ok(!state.pieces.some((piece) => piece.team === "red"));
  eliminateTeam(variant, state, "white", "test elimination");
  state = play(variant, state, [9, 9], [9, 7]);
  assert.equal(state.result.draw, false);
  assert.deepEqual(state.result.winners.sort(), ["black", "white"]);
});

test("allied simultaneous positional winners are a shared win; AI values allied material", () => {
  const variant = createPlutoVariant("pluto-team-chess");
  let state = createGameState(variant);
  variant.victoryConditions = [victory("reachZone")];
  for (const team of ["white", "black"]) {
    const king = state.pieces.find((piece) => piece.team === team && piece.type === "king");
    state.board = setTile(state.board, king, "goal");
  }
  evaluateVictory(variant, state);
  assert.equal(state.result.draw, false);
  assert.deepEqual(state.result.winners.sort(), ["black", "white"]);
  state = createGameState(createPlutoVariant("pluto-team-chess"));
  const score = evaluatePosition(variant, state, "white");
  const ally = state.pieces.find((piece) => piece.team === "black" && piece.type === "queen");
  state.pieces = state.pieces.filter((piece) => piece.id !== ally.id);
  assert.ok(evaluatePosition(variant, state, "white") < score);
});

test("Chaos awakening, early promotion, king capture and Dragon goals use normal engine rules", () => {
  const variant = createPlutoVariant("pluto-chaos-chess");
  let state = createGameState(variant);
  for (let ply = 0; ply < 10; ply++) {
    // Knights bounce at their home edge to reach round 6 without captures.
    const team = state.turn;
    const knight = state.pieces.find((piece) => piece.team === team && piece.type === "knight");
    const moves = getLegalMoves(variant, state, { pieceId: knight.id });
    const home = moves.find((move) => move.to.x === knight.origin.x && move.to.y === knight.origin.y);
    state = applyMove(variant, state, home ?? moves.find((move) => move.captureIds.length === 0));
  }
  assert.equal(state.turnNumber, 6);
  assert.equal(state.ruleOverrides.pawn, "dragon");
  const pawn = state.pieces.find((piece) => piece.type === "pawn" && piece.team === "white");
  assert.ok(generateCandidates(createPosition(variant, state), pawn).some((move) => move.ruleId === "dragon-leap"));
  variant.setup.pieces = [
    { type: "king", team: "white", x: 5, y: 0 }, { type: "king", team: "black", x: 5, y: 9 },
    { type: "pawn", team: "white", x: 3, y: 3 }, { type: "dragon", team: "white", x: 10, y: 8 },
  ];
  state = createGameState(variant);
  assert.equal(getLegalMoves(variant, state).filter((move) => move.to.x === 3 && move.to.y === 4 && move.promotion).length, 8);
  const won = play(variant, state, [10, 8], [11, 9]);
  assert.deepEqual(won.result.winners, ["white"]);
  variant.setup.pieces[3] = { type: "rook", team: "white", x: 5, y: 8 };
  const captured = play(variant, createGameState(variant), [5, 8], [5, 9]);
  assert.deepEqual(captured.result.winners, ["white"]);
});

test("an army with no legal moves is eliminated while its partner continues", () => {
  const variant = createPlutoVariant("pluto-team-chess");
  const king = variant.pieces.find((piece) => piece.id === "king");
  variant.pieces.push({ ...king, id: "frozen", movement: [], capture: [] });
  variant.setup.pieces = variant.setup.pieces.filter((piece) => piece.team !== "white");
  variant.setup.pieces.push({ type: "frozen", team: "white", x: 6, y: 0 });
  const state = createGameState(variant);
  assert.equal(state.result, null);
  assert.deepEqual(state.eliminated, ["white"]);
  assert.equal(state.turn, "red");
});

test("all Pluto documents survive deterministic legal play without corrupting positions", () => {
  for (const id of PLUTO_CUSTOM_IDS) {
    const variant = createPlutoVariant(id);
    let state = createGameState(variant);
    for (let ply = 0; ply < 100 && !state.result; ply++) {
      const moves = getLegalMoves(variant, state);
      assert.ok(moves.length, `${id}: moves at ply ${ply}`);
      const before = JSON.stringify(state);
      const next = applyMove(variant, state, moves[(ply * 37 + 17) % moves.length]);
      assert.equal(JSON.stringify(state), before, "applyMove preserves the previous frame");
      state = next;
      assert.equal(new Set(state.pieces.map((piece) => `${piece.x},${piece.y},${piece.z ?? 0}`)).size, state.pieces.length);
      assert.ok(!state.eliminated.includes(state.turn) || state.result);
    }
  }
});


test("official catalog follows the menu under every community sort, including editable games", () => {
  const catalog = plutoCommunityCatalog();
  const teamIds = ["four-player", "pluto-team-chess", "pluto-team-chess-long"];
  assert.deepEqual(variants.filter((card) => teamIds.includes(card.id)).map((card) => card.id), teamIds);
  const expected = variants.filter((card) => card.available).map((card) => card.customId ?? `pluto-builtin-${card.id}`);
  for (const sort of ["top", "new", "played"]) {
    assert.deepEqual(mergeCommunityEntries([], catalog, sort).map((entry) => entry.id), expected);
  }
  for (const id of PLUTO_CUSTOM_IDS) {
    assert.equal(catalog.filter((entry) => entry.id === id).length, 1);
    const card = variants.find((card) => card.customId === id);
    assert.ok(card.route.includes(`preset=${id}`));
    assert.ok(card.aiRoute.includes(`preset=${id}`));
    assert.ok(card.configureRoute.includes(`preset=${id}`));
    assert.equal(card.multiplayerRoute, `/chess-custom/play/multiplayer?preset=${id}`);
  }
});

test("Long Edition places allied armies side by side, facing enemies with correct pawn directions", () => {
  const variant = createPlutoVariant("pluto-team-chess-long");
  assert.equal(variant.name, "Team Chess Long Edition");
  assert.equal(variant.board.width, 16);
  assert.equal(variant.board.height, 8);
  assert.equal(variant.setup.pieces.length, 64);
  let state = createGameState(variant);
  for (const team of variant.teams) {
    const bottom = team.alliance === "Team A";
    const army = state.pieces.filter((piece) => piece.team === team.id);
    assert.equal(army.length, 16);
    assert.ok(army.every((piece) => bottom ? piece.y <= 1 : piece.y >= 6));
    assert.ok(army.every((piece) => ["white", "red"].includes(team.id) ? piece.x < 8 : piece.x >= 8));
    assert.deepEqual(team.forward, { x: 0, y: bottom ? 1 : -1 });
    assert.equal(state.turn, team.id);
    const pawn = army.find((piece) => piece.type === "pawn");
    const advance = getLegalMoves(variant, state, { pieceId: pawn.id }).find((move) => move.to.y === pawn.y + team.forward.y);
    assert.ok(advance);
    state = applyMove(variant, state, advance);
  }
  assert.equal(state.turn, "white");
});
