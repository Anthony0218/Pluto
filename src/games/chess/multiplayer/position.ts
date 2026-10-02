export type ChessRevision = { version: number; ranked_round?: number };
export type VersionedChessPosition = ChessRevision & { room_id: string; fen: string; moves: string[] };
// Versions can restart on rematch; the round is the outer ordering key.
export function compareChessRevision(a: ChessRevision, b: ChessRevision): number {
  return (a.ranked_round ?? 1) - (b.ranked_round ?? 1) || a.version - b.version;
}
/** A response may arrive after Realtime or even after the opponent's reply. */
export function acceptChessPosition<T extends VersionedChessPosition>(current: T | null, incoming: T): T {
  return current && current.room_id === incoming.room_id && compareChessRevision(current, incoming) > 0 ? current : incoming;
}
/** Pending moves are a separate preview, never an append to an incoming snapshot. */
export function visibleChessPosition<T extends VersionedChessPosition>(server: T | null, pending: T | null): T | null {
  return server && pending && pending.room_id === server.room_id && compareChessRevision(pending, server) === 0 ? pending : server;
}
