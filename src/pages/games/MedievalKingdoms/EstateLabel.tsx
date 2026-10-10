import { memo, useEffect, useMemo, useRef } from "react";
import { useGameLanguage } from "../../../i18n/gameUi.ts";
import type { Campaign } from "../../../games/MedievalKingdoms/edravane/types.ts";
import { mapBounds } from "./territoryLayout.ts";
import { createEstateLabelPainter, estateLabelPlacements } from "./estateLabelPainter.ts";

/** One non-interactive bitmap replaces hundreds of nested SVG clipping/text layouts. */
export const EstateLabels = memo(function EstateLabels({ view, viewport, resolution }: { view: Campaign; viewport: string; resolution: number }) {
  const { language } = useGameLanguage();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const painter = useRef<ReturnType<typeof createEstateLabelPainter> | null>(null);
  const labels = useMemo(() => estateLabelPlacements(view), [view]);
  const box = useMemo(() => {
    if (!viewport) {
      const bounds = mapBounds(view.districts);
      return { minX: bounds.minX, minY: bounds.minY, width: bounds.width, height: bounds.height };
    }
    const [minX, minY, maxX, maxY] = viewport.split(",").map(Number);
    return { minX, minY, width: maxX - minX, height: maxY - minY };
  }, [viewport, view.districts]);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let cancelled = false;
    // Wait for the medieval font; retain readable fallback text if that asset cannot load.
    const draw = () => {
      if (cancelled) return;
      const context = element.getContext("2d");
      if (!context) return;
      const started = performance.now();
      element.width = Math.ceil(box.width * resolution);
      element.height = Math.ceil(box.height * resolution);
      painter.current ??= createEstateLabelPainter(() => document.createElement("canvas"));
      element.dataset.labelCount = String(painter.current(context, labels, box, resolution));
      element.dataset.paintMs = (performance.now() - started).toFixed(2);
    };
    void document.fonts.load('6px "Edravane Fell"').then(draw, draw);
    return () => { cancelled = true; };
  }, [labels, box, resolution, language]);
  return <foreignObject className="ed-estate-label-layer" x={box.minX} y={box.minY} width={box.width} height={box.height} pointerEvents="none" aria-hidden="true">
    <canvas ref={canvas} style={{ display: "block", width: "100%", height: "100%" }} />
  </foreignObject>;
});
