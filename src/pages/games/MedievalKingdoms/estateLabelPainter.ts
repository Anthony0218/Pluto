import type { Campaign } from "../../../games/MedievalKingdoms/edravane/types.ts";
import { gameUi } from "../../../i18n/gameUi.ts";
import { center } from "../../../games/MedievalKingdoms/edravane/world.ts";

export type LabelPlacement = { label: string; x: number; y: number };
export type LabelBox = { minX: number; minY: number; width: number; height: number };

export function splitEstateLabel(label: string) {
  const words = label.trim().split(/\s+/), lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > 12) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 2).map((text, i) => text.length > 12 || i === 1 && lines.length > 2 ? `${text.slice(0, 11).trimEnd()}…` : text);
}

export function estateLabelPlacements(view: Campaign): LabelPlacement[] {
  const houses = new Map(view.houses.map((h) => [h.id, h]));
  return view.districts.filter((d) => d.nation && d.biome !== "sea" && d.biome !== "legacy").map((d) => {
    const [x, y] = center(d);
    return { x, y, label: d.settlement === "Hamlet" ? houses.get(d.owner ?? "")?.name ?? "Hamlet" : d.settlement };
  });
}

/** Rasterize each distinct name once per resolution; panning only copies cached images. */
export function createEstateLabelPainter(createCanvas: () => HTMLCanvasElement) {
  const stamps = new Map<string, HTMLCanvasElement>();
  return (context: CanvasRenderingContext2D, labels: LabelPlacement[], box: LabelBox, resolution: number) => {
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.save();
    context.scale(resolution, resolution);
    let painted = 0;
    for (const { label, x, y } of labels) {
      if (x + 18 < box.minX || x - 18 > box.minX + box.width || y - 4 < box.minY || y - 19 > box.minY + box.height) continue;
      const caption = gameUi(label);
      const key = `${resolution}:${caption}`;
      let stamp = stamps.get(key);
      if (!stamp) {
        stamp = createCanvas();
        stamp.width = 36 * resolution;
        stamp.height = 15 * resolution;
        const ink = stamp.getContext("2d");
        if (!ink) continue;
        ink.scale(resolution, resolution);
        ink.font = '6px "Edravane Fell", Georgia, serif';
        ink.fillStyle = "#14271d";
        ink.textAlign = "center";
        const lines = splitEstateLabel(caption);
        lines.forEach((text, i) => ink.fillText(text, 18, lines.length === 1 ? 11 : 6 + i * 7, 34));
        if (stamps.size >= 512) stamps.delete(stamps.keys().next().value!);
        stamps.set(key, stamp);
      }
      context.drawImage(stamp, x - box.minX - 18, y - box.minY - 19, 36, 15);
      painted++;
    }
    context.restore();
    return painted;
  };
}
