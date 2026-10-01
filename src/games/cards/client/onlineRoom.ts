import { supabase } from "@/lib/supabase";
import type { ActionRequest, SettingValue } from "../engine/types.ts";
import type { RoomSnapshot } from "../rooms.ts";

/** Card Builder online rooms — every call goes through the validating `card-games` edge function. */
async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("card-games", { body });
  if (error || data?.error) {
    let detail = data?.error as string | undefined;
    const context = error && "context" in error ? (error as { context?: unknown }).context : undefined;
    if (!detail && context instanceof Response) detail = (await context.clone().json().catch(() => null))?.error;
    throw new Error(detail || error?.message || "Online room request failed.");
  }
  return data as T;
}

export const createRoom = (versionId: string, players: number, settings: Record<string, SettingValue>) => call<RoomSnapshot>({ op: "createRoom", versionId, players, settings, includeDefinition: true });
export const getRoom = (code: string, includeDefinition = false) => call<RoomSnapshot>({ op: "getRoom", code, includeDefinition });
export const joinRoom = (code: string) => call<RoomSnapshot>({ op: "joinRoom", code });
export const startRoom = (code: string) => call<RoomSnapshot>({ op: "startRoom", code });
export const leaveRoom = (code: string) => call<{ closed?: boolean; left?: boolean }>({ op: "leaveRoom", code });
export const actInRoom = (room: RoomSnapshot, request: ActionRequest) => call<RoomSnapshot>({ op: "act", code: room.code, request, revision: room.state?.revision });
