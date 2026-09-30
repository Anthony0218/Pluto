import { Text } from "pixi.js";

export const ink = 0x194c56;
export function label(
  text: string,
  x: number,
  y: number,
  size: number,
  color = ink,
): Text {
  const t = new Text({
    text,
    style: {
      fontFamily: "Arial, sans-serif",
      fontSize: size,
      fontWeight: "bold",
      fill: color,
      align: "center",
    },
  });
  t.anchor.set(0.5);
  t.position.set(x, y);
  return t;
}
