import { supabase } from "../../lib/supabase";
import type { Action, GameView } from "./schafkopf";

export type RoomSnapshot = {
  code: string; hostId: string; version: number;
  players: { id: string; name: string }[]; game: GameView | null;
};
export type RoomRequest =
  | { op: "create"; name: string }
  | { op: "join"; code: string; name: string }
  | { op: "get"; code: string }
  | { op: "start" | "leave"; code: string; version: number }
  | { op: "action"; code: string; version: number; action: Action };

export async function schafkopfRequest(request: RoomRequest): Promise<RoomSnapshot | null> {
  const { data, error } = await supabase.functions.invoke("schafkopf-multiplayer", { body: request });
  if (error) {
    let message = "Schafkopf-Server nicht erreichbar. Bitte erneut versuchen.";
    if (error.context instanceof Response) {
      const body = await error.context.json().catch(() => null);
      if (typeof body?.error === "string") message = body.error;
    }
    throw new Error(message);
  }
  return data as RoomSnapshot | null;
}
