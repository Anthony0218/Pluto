import { createRectangularBoard, parseSquare, updateCell } from "../engine/board.ts";
import { applyKingBehavior, createExamplePieces, createVariantFromPreset, mirroredSetup, victory } from "../engine/presets.ts";
import type { GameVariant } from "../engine/types.ts";

export const PLUTO_PUBLISHED_AT = "2026-10-01T00:00:00.000Z";
export const PLUTO_CUSTOM_IDS = ["pluto-team-chess", "pluto-team-chess-long", "pluto-chaos-chess"] as const;
export type PlutoCustomId = typeof PLUTO_CUSTOM_IDS[number];

export const isPlutoCustomId = (id: string | null): id is PlutoCustomId => PLUTO_CUSTOM_IDS.some((candidate) => candidate === id);

/** Packaged Create documents. Remix/save/export use the ordinary repository. */
export function createPlutoVariant(id: PlutoCustomId): GameVariant {
  let variant = createVariantFromPreset(id !== "pluto-chaos-chess" ? "four-kingdoms" : "standard", 20261001);
  if (id !== "pluto-chaos-chess") {
    variant.name = "Pluto Team Chess";
    variant.description = "Four armies, two alliances: White + Black (Team A) face Red + Blue (Team B) on a 14×14 cross. Turns: White → Red → Black → Blue. Move only your own army; allies block but cannot capture each other. No check: capture a king to remove its army. Its partner fights on; eliminate both enemy armies to win together. No castling or en passant. Pawns promote on the far edge. No legal moves eliminates that army; 600 plies is a draw.";
    variant.teams = variant.teams.map((team, index) => ({ ...team, alliance: index % 2 === 0 ? "Team A" : "Team B" }));
    variant.rules = variant.rules.map((rule) => ({ ...rule, enabled: false }));
    variant.settings.noLegalMoves = "lose";
    variant.tags = ["4 players", "2v2", "King capture", "Hotseat / AI"];
    if (id === "pluto-team-chess-long") {
      variant.name = "Team Chess Long Edition";
      variant.description = "Two allied armies stand shoulder to shoulder on each side of a 16×8 board. White + Black start along the bottom, facing Red + Blue across the board. Turns: White → Red → Black → Blue. Each player controls their own army; allies block but cannot capture each other. Capture both enemy kings to win together. An eliminated army is removed; its partner fights on. No check, castling or en passant. Pawns promote on the opposite edge. No legal moves eliminates an army; 600 plies is a draw. Fully editable in Create.";
      variant.board = createRectangularBoard(16, 8);
      variant.setup.pieces = [];
      const rank = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];
      variant.teams = variant.teams.map((team, index) => {
        const bottom = index % 2 === 0;
        const offset = index < 2 ? 0 : 8;
        rank.forEach((type, file) => {
          variant.setup.pieces.push({ type, team: team.id, x: offset + file, y: bottom ? 0 : 7 });
          variant.setup.pieces.push({ type: "pawn", team: team.id, x: offset + file, y: bottom ? 1 : 6 });
        });
        return { ...team, forward: { x: 0, y: bottom ? 1 : -1 } };
      });
      variant.tags = ["16×8", "4 players", "2v2", "Side-by-side armies"];
    }
  } else {
    variant = applyKingBehavior(variant, "capturable");
    variant.name = "Pluto Chaos Chess";
    variant.description = "A 12×10 royal rumble: two queens, Cannons, Wizards, Dragons and explosive Bombers per army. Paired portals bend attacks; central ice slides pieces onward. Promotion pads d5/i6 upgrade pawns early. At the start of round 6, all pawns move and capture like Dragons! Capture the enemy king, or land a Dragon on your goal (White: l10; Black: a1). No check, castling or en passant. Stalemate or 400 plies draws. Every rule is editable in Create.";
    variant.pieces.push(...createExamplePieces().filter((piece) => piece.id !== "guardian"));
    variant.board = createRectangularBoard(12, 10);
    variant.setup.pieces = mirroredSetup(12, 10, ["cannon", "rook", "knight", "wizard", "queen", "king", "queen", "dragon", "bishop", "knight", "rook", "cannon"]);
    for (const team of ["white", "black"]) {
      for (const x of [2, 9]) variant.setup.pieces.push({ type: "bomber", team, x, y: team === "white" ? 2 : 7 });
    }
    const at = (square: string) => parseSquare(square)!;
    for (const [a, b] of [["c4", "j7"], ["j4", "c7"]]) {
      variant.board = updateCell(variant.board, at(a), { tile: "portal", portalTarget: at(b) });
      variant.board = updateCell(variant.board, at(b), { tile: "portal", portalTarget: at(a) });
    }
    for (const square of ["f5", "g5", "f6", "g6"]) variant.board = updateCell(variant.board, at(square), { tile: "ice" });
    for (const square of ["d5", "i6"]) variant.board = updateCell(variant.board, at(square), { tile: "promotion" });
    variant.board = updateCell(variant.board, at("l10"), { tile: "goal", team: "white" });
    variant.board = updateCell(variant.board, at("a1"), { tile: "goal", team: "black" });
    variant.pieces.find((piece) => piece.id === "pawn")!.promotion = { zone: "both", options: ["queen", "rook", "bishop", "knight", "wizard", "cannon", "dragon", "bomber"] };
    variant.rules = variant.rules.map((rule) => ({ ...rule, enabled: false }));
    variant.events.push({
      id: "dragon-awakening", name: "Round 6 — the pawns awaken", enabled: true,
      trigger: { type: "afterTurnNumber", turn: 6 }, delayTurns: 0, conditionMode: "all", conditions: [],
      actions: [
        { id: "awaken", type: "changePieceRule", pieceType: "pawn", toPieceType: "dragon" },
        { id: "announce", type: "displayMessage", message: "The pawns awaken! All pawns now move and capture like Dragons; promotion still applies." },
      ], elseActions: [], once: true,
    });
    variant.victoryConditions = [victory("reachZone", { pieceType: "dragon" }), victory("eventOutcome")];
    variant.settings.maxPlies = 400;
    variant.tags = ["12×10", "Fairy pieces", "Portals", "Explosions", "Pawn awakening"];
    variant.theme = { boardTheme: "cyber", pieceSkin: "neon" };
  }
  // Stable packaged identities, including generated rule/event ids, across reloads.
  variant.id = id;
  variant.authorId = "pluto";
  variant.createdAt = variant.updatedAt = PLUTO_PUBLISHED_AT;
  variant.rules.forEach((rule) => { rule.id = `rule-${rule.type}`; });
  variant.victoryConditions.forEach((condition, index) => { condition.id = `victory-${index}`; });
  variant.events.forEach((event, index) => {
    event.id = `event-${index}`;
    event.conditions.forEach((condition, i) => { condition.id = `condition-${index}-${i}`; });
    event.actions.forEach((action, i) => { action.id = `action-${index}-${i}`; });
    event.elseActions.forEach((action, i) => { action.id = `else-${index}-${i}`; });
  });
  return variant;
}
