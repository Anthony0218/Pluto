import { supabase } from "../../lib/supabase";
import type { Action, AiDifficulty, GameRules, GameView } from "./schafkopf";

export type RoomSnapshot = {
  code: string; hostId: string; version: number; title: string; aiDifficulty: AiDifficulty; collectSeconds: number;
  players: { id: string; name: string; bot?: boolean }[]; game: GameView | null;
  pendingSeats: number[];
};
export type SessionSummary = {
  code: string; title: string; hostId: string; version: number; updatedAt: string;
  players: { id: string; name: string; bot?: boolean }[];
  formerPlayers: { id: string; name: string; total: number; round: number }[];
  pendingSeats: number[];
  totals: number[] | null; round: number | null;
};
export type RoomRequest =
  | { op: "create"; name: string; title: string; aiDifficulty: AiDifficulty }
  | { op: "list" }
  | { op: "join"; code: string; name: string }
  | { op: "get"; code: string }
  | { op: "start"; code: string; version: number; rules: GameRules; title: string; aiDifficulty: AiDifficulty }
  | { op: "rules"; code: string; version: number; rules: GameRules }
  | { op: "configure"; code: string; version: number; title: string; aiDifficulty: AiDifficulty }
  | { op: "timing"; code: string; version: number; collectSeconds: number }
  | { op: "replace"; code: string; version: number; seat: number; bot: boolean }
  | { op: "vacate"; code: string; version: number; seat: number }
  | { op: "leave" | "delete"; code: string; version: number }
  | { op: "action"; code: string; version: number; action: Action };

export function schafkopfRequest(request: { op: "list" }): Promise<SessionSummary[]>;
export function schafkopfRequest(request: Exclude<RoomRequest, { op: "list" }>): Promise<RoomSnapshot | null>;
export async function schafkopfRequest(request: RoomRequest): Promise<RoomSnapshot | SessionSummary[] | null> {
  const { data, error } = await supabase.functions.invoke("schafkopf-multiplayer", { body: request });
  if (error) {
    let message = "Schafkopf-Server nicht erreichbar. Bitte erneut versuchen.";
    if (error.context instanceof Response) {
      const body = await error.context.json().catch(() => null);
      if (typeof body?.error === "string") message = body.error;
    }
    if (/nur der gastgeber kann einen vollen tisch starten/i.test(message)) {
      message = "Die Schafkopf-Serverfunktion ist noch auf einem alten Stand. Die aktuellen Supabase-Migrationen und die Funktion schafkopf-multiplayer müssen bereitgestellt werden.";
    }
    throw new Error(message);
  }
  return data as RoomSnapshot | SessionSummary[] | null;
}
