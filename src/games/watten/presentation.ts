import type { CSSProperties } from "react";
import type { TableTheme } from "../../context/TableThemeContext";

export type WattenSeatPosition = "bottom" | "left" | "top" | "right";

/** Seats run clockwise from the player viewing the table. */
export function wattenSeatPosition(seat: number, viewer: number, count: number): WattenSeatPosition {
  const relative = ((seat - viewer) % count + count) % count;
  return (count === 3 ? ["bottom", "left", "right"] : ["bottom", "left", "top", "right"])[relative] as WattenSeatPosition;
}

export function wattenPlayAnimation(seat: number, viewer: number, count: number) {
  return `watten-card-in-${wattenSeatPosition(seat, viewer, count)}`;
}

const tableColors: Record<TableTheme, [string, string, string]> = {
  classic: ["#245947", "#0b2e25", "#ba9460"],
  bavarian: ["#245b63", "#10383f", "#d3b477"],
  royal: ["#682937", "#32141f", "#e2bc66"],
  steampunk: ["#514337", "#28241f", "#cd9560"],
  alpine: ["#386149", "#17392c", "#dbc4a1"],
  midnight: ["#283653", "#101c32", "#93a9d6"],
};

/** Felt and a consistent rim scale independently, so no theme is stretched. */
export function wattenTableStyle(theme: TableTheme): CSSProperties {
  const [felt, shade, accent] = tableColors[theme];
  return { "--watten-felt": felt, "--watten-shade": shade, "--watten-rim": accent } as CSSProperties;
}
