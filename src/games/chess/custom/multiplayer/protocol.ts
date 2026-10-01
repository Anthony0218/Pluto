import { sameCoord } from "../engine/board.ts";
import { getLegalMoves } from "../engine/game.ts";
import type { Coord, GameState, GameVariant, Move } from "../engine/types.ts";
import { validateVariant } from "../engine/validation.ts";

/** Wire moves always carry real layer coordinates; notation is only presentation. */
export interface VariantMoveRequest {
  pieceId: string;
  from: Coord;
  to: Coord;
  promotionPieceId?: string;
}

export interface MultiplayerVariantReference {
  variantId: string;
  schemaVersion: number;
  revision: number;
  configurationHash: string;
}

export function validateOnlineVariant(variant: GameVariant): string[] {
  const errors = validateVariant(variant).filter((issue) => issue.severity === "error").map((issue) => issue.message);
  if (variant.teams.length !== 2) errors.push("Online Chess Custom currently supports exactly two teams.");
  if ((variant.board.layers?.length ?? 0) > 7) errors.push("A multiplayer board supports at most eight layers.");
  if (variant.setup.pieces.length > 256) errors.push("The starting position has too many pieces.");
  for (const team of variant.teams) if (!variant.setup.pieces.some((piece) => piece.team === team.id)) errors.push(`${team.name} needs at least one starting piece for online play.`);
  return errors;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]));
  return value;
}

export async function variantReference(variant: GameVariant): Promise<MultiplayerVariantReference> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(variant)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return {
    variantId: variant.id,
    schemaVersion: variant.schemaVersion,
    revision: variant.version,
    configurationHash: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
  };
}

export function sameVariantReference(a: MultiplayerVariantReference, b: MultiplayerVariantReference) {
  return a.variantId === b.variantId && a.schemaVersion === b.schemaVersion && a.revision === b.revision && a.configurationHash === b.configurationHash;
}

/** The only move accepted by the server is an exact match from the shared engine. */
export function resolveRequestedMove(variant: GameVariant, state: GameState, requested: VariantMoveRequest): Move | null {
  return getLegalMoves(variant, state, { pieceId: requested.pieceId }).find((move) =>
    sameCoord(move.from, requested.from) && sameCoord(move.to, requested.to) && (move.promotion ?? undefined) === (requested.promotionPieceId ?? undefined)
  ) ?? null;
}
