import type { ReactNode } from "react";
import { useTransform, type MotionStyle } from "motion/react";
import * as m from "motion/react-m";
import { useUiLanguage } from "@/i18n/ui";
import { AppTileArt, BookArt } from "../planetary/PlanetScene";
import { landingBookTitle } from "../planetary/landingCopy";
import { landingBooks, landingTools } from "../planetary/universeCatalog";
import { useLanding } from "./landingContext";
import { clamp01, itemStops, itemWeight, lerp } from "./landingMath";
import { planetArtSize, type PlanetPose } from "./planetPose";

/** Natural height of the artwork, and the ring tilts each successive item settles at (as the planet's ring does). */
const TILE = 92;
const BOOK = 138;
const TILTS = [-14, 10, -6, 16];

function ItemArt({ k, size, accent, pose, children }: { k: number; size: number; accent?: string; pose: PlanetPose; children: ReactNode }) {
  const { index, layout, stage, wide } = useLanding();
  const { arrival, section } = itemStops(k);
  // Large from its arrival, settling behind the section's text; dim on stacked layouts, where the arrival shows its own copy.
  const opacity = useTransform(() => {
    const at = index.get();
    layout.get();
    const settled = section > arrival ? clamp01(at - arrival) : 1;
    const level = wide.get() === 1 ? lerp(0.95, 0.62, settled) : 0.3 * settled;
    return itemWeight(at, arrival, section) * level;
  });
  // On arrival the artwork is a little smaller than behind the text, so the caption below it stays readable.
  const settling = () => section > arrival ? clamp01(index.get() - arrival) : 1;
  const scale = useTransform(() => { layout.get(); return (pose.scale.get() * planetArtSize(stage.current.height) * lerp(0.76, 0.9, settling())) / size; });
  // Each item turns in from one side as the page scrolls toward it, faces front on arrival, and turns away to the other side.
  const turn = (at: number) => at < arrival ? (at - arrival) * 80 : at <= section ? (at - arrival) * 14 : (section - arrival) * 14 + (at - section) * 80;
  const rotateY = useTransform(() => turn(index.get()));
  const rotateZ = useTransform(() => TILTS[k % TILTS.length] + turn(index.get()) * 0.325);
  const style = { opacity, scale, rotateY, rotateZ, transformPerspective: 900, "--app-accent": accent } as MotionStyle;
  return <m.div className="journey-item" style={style}>{children}</m.div>;
}

/**
 * On the Tools and Learn tabs the travelling artwork is the tool's app tile or the book's cover instead of the planet:
 * one per section, riding the planet's path behind the text, cross-fading and turning from one item to the next.
 * Decorative only, so it is never clickable.
 */
export default function JourneyItems({ pose }: { pose: PlanetPose }) {
  const { language } = useUiLanguage();
  const { category } = useLanding();
  if (category === "games") return null;
  const wrap = { x: pose.x, y: pose.y } as MotionStyle;
  return <m.div className="journey-items" style={wrap} data-category={category}>
    {category === "tools" ? landingTools.map((tool, k) =>
      <ItemArt key={tool.id} k={k} size={TILE} accent={tool.accent} pose={pose}><AppTileArt toolId={tool.id} /></ItemArt>
    ) : landingBooks.map((book, k) =>
      <ItemArt key={book.id} k={k} size={BOOK} pose={pose}><BookArt title={landingBookTitle(language, book.design)} design={book.design} /></ItemArt>
    )}
  </m.div>;
}

