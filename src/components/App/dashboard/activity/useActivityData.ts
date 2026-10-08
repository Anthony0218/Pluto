import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isKind, isShown, type ActivityEvent, type ActivityRow } from "./activityModel";

export type LoadStatus = "loading" | "ready" | "error";
type Slot<T> = { status: LoadStatus; data: T | undefined; at: number };

/** Re-read a visible slice when the tab comes back after this long. */
const STALE_MS = 60_000;

/** The browser's time zone, which is also how the database groups the user's days. */
export function browserTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** RPC payloads are runtime data: keep only well-formed rows rather than trusting a cast. */
export function normalizeRows(data: unknown): ActivityRow[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap(row => {
    const n = Number(row?.n);
    return row && isKind(row.kind) && /^\d{4}-\d{2}-\d{2}$/.test(text(row.day)) && Number.isFinite(n) && isShown(text(row.label)) ? [{ day: row.day as string, kind: row.kind, label: text(row.label), n }] : [];
  });
}
export function normalizeEvents(data: unknown): ActivityEvent[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap(row => row && isKind(row.kind) && isShown(text(row.label)) ? [{ at: typeof row.at === "string" ? row.at : null, kind: row.kind, label: text(row.label), detail: typeof row.detail === "string" ? row.detail : null }] : []);
}

/**
 * Loads one slice of data per key (a year, or a day), keeps every slice it has seen, shows stale data while refreshing,
 * and refreshes the visible slices when the tab regains focus. A failed slice is retried with `retry`.
 */
function useSlices<T>(enabled: boolean, keys: string[], load: (key: string) => Promise<T>) {
  const [slots, setSlots] = useState<Record<string, Slot<T>>>({});
  const inflight = useRef(new Set<string>());
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const run = useCallback((key: string) => {
    if (inflight.current.has(key)) return;
    inflight.current.add(key);
    setSlots(current => ({ ...current, [key]: { status: current[key]?.data !== undefined ? "ready" : "loading", data: current[key]?.data, at: current[key]?.at ?? 0 } }));
    load(key).then(
      data => { if (alive.current) setSlots(current => ({ ...current, [key]: { status: "ready", data, at: Date.now() } })); },
      () => { if (alive.current) setSlots(current => ({ ...current, [key]: { status: "error", data: current[key]?.data, at: Date.now() } })); },
    ).finally(() => inflight.current.delete(key));
  }, [load]);

  const wanted = keys.join("|");
  useEffect(() => {
    if (!enabled) return;
    for (const key of wanted.split("|").filter(Boolean)) if (!slots[key]) run(key);
  }, [enabled, wanted, slots, run]);

  const latest = useRef({ slots, wanted });
  useEffect(() => { latest.current = { slots, wanted }; });
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      for (const key of latest.current.wanted.split("|").filter(Boolean)) {
        const slot = latest.current.slots[key];
        if (slot && Date.now() - slot.at > STALE_MS) run(key);
      }
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [enabled, run]);

  const retry = useCallback(() => { for (const key of wanted.split("|").filter(Boolean)) if (latest.current.slots[key]?.status === "error") run(key); }, [wanted, run]);
  const visible = wanted.split("|").filter(Boolean).map(key => slots[key]);
  const status: LoadStatus = visible.some(slot => !slot || (slot.status === "loading" && slot.data === undefined)) ? "loading" : visible.some(slot => slot.status === "error" && slot.data === undefined) ? "error" : "ready";
  return { slots, status, retry };
}

/** Daily totals for the given calendar years. */
export function useActivityYears(enabled: boolean, years: number[], timeZone: string) {
  const load = useCallback(async (year: string) => {
    const { data, error } = await supabase.rpc("get_activity_days", { p_from: `${year}-01-01`, p_to: `${year}-12-31`, p_tz: timeZone });
    if (error) throw error;
    return normalizeRows(data);
  }, [timeZone]);
  const { slots, status, retry } = useSlices(enabled, years.map(String), load);
  const rows = years.flatMap(year => slots[String(year)]?.data ?? []);
  return { rows, status, retry };
}

/** The events of one day. */
export function useActivityDay(enabled: boolean, day: string | null, timeZone: string) {
  const load = useCallback(async (key: string) => {
    const { data, error } = await supabase.rpc("get_activity_day", { p_day: key, p_tz: timeZone });
    if (error) throw error;
    return normalizeEvents(data);
  }, [timeZone]);
  const { slots, status, retry } = useSlices(enabled && day !== null, day ? [day] : [], load);
  return { events: day ? slots[day]?.data ?? [] : [], status, retry };
}
