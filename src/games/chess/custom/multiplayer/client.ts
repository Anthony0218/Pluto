import { supabase } from "@/lib/supabase";
import type { GameState, GameVariant } from "../engine/types.ts";
import { sameVariantReference, variantReference, type MultiplayerVariantReference, type VariantMoveRequest } from "./protocol.ts";

export interface OnlineSnapshot {
  code: string;
  role: "host" | "guest";
  seat: number;
  status: "waiting" | "playing" | "finished";
  version: number;
  variantReference: MultiplayerVariantReference;
  variant: GameVariant;
  state: GameState;
  history: Array<{ move: VariantMoveRequest; notation: string; team: string }>;
  players: string[];
}

export interface OnlinePreview {
  code: string;
  status: OnlineSnapshot["status"];
  variant: GameVariant;
  host: string;
  playersJoined: number;
}

async function call(body: Record<string, unknown>): Promise<OnlineSnapshot> {
  const { data, error } = await supabase.functions.invoke("chess-custom-match", { body });
  if (error || data?.error) {
    let detail = data?.error as string | undefined;
    if (!detail && error && "context" in error && error.context instanceof Response) {
      const json = await error.context.clone().json().catch(() => null);
      detail = json?.error;
    }
    throw new Error(detail || error?.message || "Online room request failed.");
  }
  const snapshot = data as OnlineSnapshot;
  const actual = await variantReference(snapshot.variant);
  if (!sameVariantReference(actual, snapshot.variantReference)) throw new Error("The room variant does not match its configuration hash.");
  return snapshot;
}

export const createOnlineMatch = (variant: GameVariant) => call({ op: "create", variant });
export async function previewOnlineMatch(code: string): Promise<OnlinePreview> {
  const { data, error } = await supabase.functions.invoke("chess-custom-match", { body: { op: "preview", code } });
  if (error || data?.error) throw new Error(data?.error || error?.message || "Could not preview room.");
  return data as OnlinePreview;
}
export const joinOnlineMatch = (code: string) => call({ op: "join", code });
export const getOnlineMatch = (code: string) => call({ op: "get", code });
export const submitOnlineMove = (snapshot: OnlineSnapshot, move: VariantMoveRequest) => call({ op: "move", code: snapshot.code, variantReference: snapshot.variantReference, move });
