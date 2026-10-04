import { createInitialGoState, type GoState } from "./rules.ts";
import { replayGo } from "./analysis.ts";
import { canReviewGoGame } from "./reviewAvailability.ts";

const key = "pluto.go.last-game.v1";
const completedKey = "pluto.go.last-completed-game.v1";
const libraryKey = "pluto.go.saved-games.v1";
export type SavedGoGame = {
  id: string; savedAt: string; ruleset: "Chinese area";
  ownerId?: string;
  mode: "ai" | "hotseat" | "ranked" | "multiplayer" | "imported";
  players: { black: string; white: string };
  difficulty?: "easy" | "medium" | "hard";
  game: GoState;
};

function verifiedState(value: unknown): GoState | null {
  if (!value || typeof value !== "object") return null;
  const state = value as GoState;
  if (![9, 13, 19].includes(state.boardSize) || state.komi !== 6.5 || !Array.isArray(state.moveHistory) || state.moveHistory.length > 1500 || !Array.isArray(state.board) || state.board.length !== state.boardSize ** 2) return null;
  try {
    const replayed = replayGo(state).at(-1)!;
    if (JSON.stringify(replayed.board) !== JSON.stringify(state.board) || JSON.stringify(replayed.captures) !== JSON.stringify(state.captures) || replayed.currentPlayer !== state.currentPlayer || JSON.stringify(replayed.positionHashes) !== JSON.stringify(state.positionHashes)) return null;
    if (replayed.status === state.status && replayed.result === state.result && replayed.winner === state.winner) return replayed;
    // Ranked timeouts and off-turn resignations can finish without a board move.
    if (state.status === "finished" && replayed.status === "playing" && ["black", "white", "draw"].includes(state.winner ?? "") && /wins by (timeout|resignation)$/.test(state.result ?? "")) return { ...replayed, status: "finished", winner: state.winner, result: state.result };
  } catch { /* Invalid history. */ }
  return null;
}

export function parseSavedGoRecord(value: unknown): SavedGoGame | null {
  if (!value || typeof value !== "object") return null;
  const record = value as SavedGoGame;
  const game = verifiedState(record.game);
  if (!game || typeof record.id !== "string" || !Number.isFinite(Date.parse(record.savedAt)) || !["ai", "hotseat", "ranked", "multiplayer", "imported"].includes(record.mode) || !record.players || typeof record.players.black !== "string" || typeof record.players.white !== "string" || record.ownerId !== undefined && typeof record.ownerId !== "string") return null;
  return { ...record, game, ruleset: "Chinese area" };
}
function allLocalRecords(): SavedGoGame[] {
  try {
    const values = JSON.parse(localStorage.getItem(libraryKey) ?? "[]") as unknown;
    if (!Array.isArray(values)) return [];
    return values.flatMap(value => { const record = parseSavedGoRecord(value); return record ? [record] : []; });
  } catch { return []; }
}
export function listSavedGoGames(ownerId?: string | null): SavedGoGame[] {
  return allLocalRecords().filter(record => !record.ownerId || record.ownerId === ownerId).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function getSavedGoGame(id: string, ownerId?: string | null): SavedGoGame | null {
  return listSavedGoGames(ownerId).find(record => record.id === id) ?? null;
}

export function saveGoRecord(game: GoState, details: Pick<SavedGoGame, "mode" | "players" | "difficulty">, savedAt = new Date().toISOString(), ownerId?: string): SavedGoGame {
  const verified = verifiedState(game);
  if (!verified) throw new Error("This game could not be verified for saving.");
  const record: SavedGoGame = { id: crypto.randomUUID(), savedAt, ruleset: "Chinese area", ...(ownerId ? { ownerId } : {}), ...details, game: verified };
  localStorage.setItem(libraryKey, JSON.stringify([record, ...allLocalRecords()]));
  return record;
}

export function cacheGoRecord(record: SavedGoGame): void {
  const verified = parseSavedGoRecord(record);
  if (!verified) throw new Error("Cloud Go record is invalid.");
  localStorage.setItem(libraryKey, JSON.stringify([verified, ...allLocalRecords().filter(item => item.id !== verified.id)]));
}

export function deleteSavedGoGame(id: string): void {
  localStorage.setItem(libraryKey, JSON.stringify(allLocalRecords().filter(record => record.id !== id)));
}
export function saveGoGame(state: GoState) {
  try {
    const stored = state.status === "finished" ? verifiedState(state) : state;
    if (!stored) return;
    const serialized = JSON.stringify(stored);
    localStorage.setItem(key, serialized);
    if (canReviewGoGame(stored)) localStorage.setItem(completedKey, serialized);
  } catch { /* Play remains available when storage is full or disabled. */ }
}
export function loadGoGame(): GoState {
  for (const storageKey of [completedKey, key]) {
    try {
      const state = verifiedState(JSON.parse(localStorage.getItem(storageKey) ?? "null"));
      if (canReviewGoGame(state)) return state!;
    } catch { /* A corrupt saved game must not block the other completed-game slot. */ }
  }
  return createInitialGoState();
}
