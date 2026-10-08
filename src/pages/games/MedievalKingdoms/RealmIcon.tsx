import type { CSSProperties } from "react";

export type RealmMetric = "loyalty" | "unrest" | "opinion" | "legitimacy" | "coins" | "food" | "troops" | "relations";

// Original geometric SVG artwork, drawn for this game's interface.
const paths: Record<RealmMetric, string> = {
  loyalty: "M12 3 20 6v6c0 4-4 7-8 9-4-2-8-5-8-9V6Zm-4 9 3 3 5-6",
  unrest: "M12 3 22 21H2Zm0 6v5m0 3v1",
  opinion: "M12 20 4 12C-1 6 7 1 12 7c5-6 13-1 8 5Z",
  legitimacy: "M3 7 7 11l5-7 5 7 4-4-2 12H5Zm2 8h14",
  coins: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4v14m3-11c-5-4-9 3-3 3s2 7-3 3",
  food: "M12 22V4m0 4C6 8 6 3 6 3s6 0 6 5Zm0 5c6 0 6-5 6-5s-6 0-6 5Zm0 5c-6 0-6-5-6-5s6 0 6 5Zm0-14 3-3",
  troops: "m4 3 2 7 11 11 4-4L10 6Zm-1 13 5-5m8-8-2 5m-3 8-5 5m-3-3 5 5",
  relations: "M8 5H3v14h5m8-14h5v14h-5M8 12h8m-7-3-3 3 3 3m6-6 3 3-3 3",
};

export function RealmIcon({ metric, size = 16, style }: { metric: RealmMetric; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={style}><path d={paths[metric]} /></svg>;
}

export function EffectBadge({ metric, amount, label, adverse, suffix = "", description }: { metric: RealmMetric; amount: number; label?: string; adverse?: boolean; suffix?: string; description?: string }) {
  const bad = adverse ?? (metric === "unrest" ? amount > 0 : amount < 0);
  const text = `${amount > 0 ? "+" : amount < 0 ? "−" : ""}${Math.abs(amount)}${suffix} ${label ?? metric}`;
  return <span className={`ed-effect ${amount === 0 ? "ed-effect-neutral" : bad ? "ed-effect-loss" : "ed-effect-gain"}`} title={description} aria-label={text}><RealmIcon metric={metric} /><b>{text}</b></span>;
}
