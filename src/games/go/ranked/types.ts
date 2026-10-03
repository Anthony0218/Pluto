import type { GoColor, GoState } from "../rules";
import type { GoTimeControl } from "./config";
export type RankedGoGame = { id: string; code: string; black_id: string; white_id: string; time_control: GoTimeControl; state: GoState; version: number; status: "ready" | "playing" | "finished" | "abandoned"; ready_users: string[]; black_time_ms: number; white_time_ms: number; byo_yomi_ms: number; black_period_ms: number; white_period_ms: number; black_periods_remaining: number; white_periods_remaining: number; clock_started_at: string | null; winner: GoColor | "draw" | null; end_reason: string | null; created_at: string; completed_at: string | null };
export type RankedGoResult = { black_before: number; black_after: number; white_before: number; white_after: number };
export type RankedGoSnapshot = { game: RankedGoGame; serverNow: string; result: RankedGoResult | null; players: { user_id: string; color: GoColor; username: string; avatar_id: string; rating: number }[] };
