import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useMotionValueEvent, useTransform, type MotionStyle, type MotionValue } from "motion/react";
import * as m from "motion/react-m";
import { ui, useUiLanguage } from "@/i18n/ui";
import { AppTileArt, BookArt, PlanetArt } from "../planetary/PlanetScene";
import { landingBookTitle } from "../planetary/landingCopy";
import { useCopy } from "./copy";
import { bookTopics, flybyScene, type FlybyItem } from "./flybyCatalog";
import { useLanding } from "./landingContext";
import { clamp01, lerp, smoothstep } from "./landingMath";
import { usePlanetLanding } from "./usePlanetLanding";
import TravelingCaption from "./TravelingCaption";

const flybyStars = [
  { className: "journey-stars--far", zoom: 1.2 },
  { className: "journey-stars--mid", zoom: 2 },
  { className: "journey-stars--near", zoom: 3.4 },
];
/** Natural width of each kind's artwork, to turn the hero object's size into a starting scale. */
const ART_WIDTH = { planet: 78, tile: 92, book: 112 } as const;

function StarLayer({ className, zoom, camera }: { className: string; zoom: number; camera: MotionValue<number> }) {
  const scale = useTransform(camera, [0, 1], [1, zoom]);
  const opacity = useTransform(camera, [0.6, 1], [1, 0.25]);
  return <m.div className={`journey-stars ${className}`} style={{ scale, opacity }} />;
}

function FlybyObject({ item, center = false, camera, live }: { item: FlybyItem; center?: boolean; camera: MotionValue<number>; live: boolean }) {
  const { language } = useUiLanguage();
  const { stage, layout, enter, handoff } = useLanding();
  const land = usePlanetLanding();
  const spot = () => stage.current.hero[item.id];
  // Objects start on top of their hero twins and settle into the flyby layout while the page scrolls toward the stage.
  const x = useTransform(() => {
    layout.get();
    const entered = smoothstep(enter.get());
    const c = camera.get();
    const { width } = stage.current;
    const rest = center ? width / 2 : (item.x / 100) * width;
    const from = spot();
    const settled = from ? lerp(from.x, rest, entered) : rest;
    return settled + (center ? 0 : (rest - width / 2) * item.depth * 1.4 * c);
  });
  const y = useTransform(() => {
    layout.get();
    const entered = smoothstep(enter.get());
    const c = camera.get();
    const { height } = stage.current;
    const rest = center ? height * 0.46 : (item.y / 100) * height;
    const from = spot();
    const settled = from ? lerp(from.y, rest, entered) : rest;
    return settled + (center ? 0 : (rest - height / 2) * item.depth * 1.4 * c);
  });
  const scale = useTransform(() => {
    layout.get();
    const entered = smoothstep(enter.get());
    const c = camera.get();
    const from = spot();
    const settled = from ? lerp(from.size / ART_WIDTH[item.kind], 1, entered) : 1;
    return settled * (center ? 1 + 2.2 * c : 1 + item.depth * 4 * c);
  });
  const opacity = useTransform(() => {
    const arrival = handoff.get();
    const c = camera.get();
    // The arriving tool or book is handed over to the first section's artwork rather than left on screen beside it.
    return arrival * (center ? 1 - smoothstep((c - 0.68) / 0.3) : 1 - clamp01((c - 0.3) / (0.5 / item.depth)));
  });
  const label = useTransform(() => { const c = camera.get(); return center ? 1 - smoothstep(c / 0.18) : 1; });
  const tone = item.planet ? ` solar-planet solar-planet--${item.planet.tone}` : "";
  const style = { x, y, scale, opacity, pointerEvents: live ? "auto" : "none", "--app-accent": item.tool?.accent } as MotionStyle;
  return <m.div className={`flyby-item flyby-item--${item.kind}${tone}`} style={style}>
    <Link to={item.route} tabIndex={live ? 0 : -1} aria-hidden={!live} aria-label={`${ui("Open")} ${ui(item.title)}`} className="flyby-link" onClick={item.planet ? event => land(event, item.route) : undefined}>
      {item.planet && <PlanetArt config={item.planet} />}
      {item.tool && <AppTileArt toolId={item.tool.id} />}
      {item.book && <BookArt title={landingBookTitle(language, item.book.design)} design={item.book.design} />}
      <m.strong className="flyby-label" style={{ opacity: label }}>{ui(item.title)}</m.strong>
    </Link>
  </m.div>;
}

/**
 * The pinned flyby. What flies past depends on the hero tab: game planets, app tiles or books. The hero objects
 * travel into this scene while the page scrolls toward it, then the camera pushes through and arrives at the
 * featured object (Chess, the first tool or the first book).
 */
export default function UniverseFlyby() {
  useUiLanguage();
  const text = useCopy();
  const { category, flyby: progress, index, enter } = useLanding();
  const scene = useMemo(() => flybyScene(category), [category]);
  const [live, setLive] = useState(false);
  const [arrived, setArrived] = useState(false);
  // The camera starts moving a little after the stage pins, and finishes before it releases.
  const camera = useTransform(progress, [0.08, 0.78], [0, 1]);
  const liveNow = useTransform(() => { const entered = enter.get(); const c = camera.get(); return entered > 0.98 && c < 0.3 ? 1 : 0; });
  useMotionValueEvent(liveNow, "change", value => setLive(value === 1));

  const pickOpacity = useTransform(() => smoothstep(enter.get() / 0.4) * (1 - smoothstep(camera.get() / 0.32)));
  const pickLift = useTransform(camera, [0, 0.32], [0, -14]);
  const pickShift = useTransform(camera, [0, 0.32], [0, 32]);
  const hintOpacity = useTransform(() => smoothstep((enter.get() - 0.6) / 0.4) * (1 - smoothstep(progress.get() / 0.07)));
  const arrivalIn = useTransform(progress, [0.74, 0.88], [0, 1]);
  const captionOpacity = useTransform(() => arrivalIn.get());
  const buttonOpacity = useTransform(() => arrivalIn.get() * (1 - clamp01(index.get() / 0.2)));
  useMotionValueEvent(buttonOpacity, "change", value => setArrived(value > 0.6));
  const planetLabel = useTransform(() => smoothstep((enter.get() - 0.9) / 0.1) * (1 - smoothstep(camera.get() / 0.18)));
  const topics = scene.center.tool?.features ?? (scene.center.book ? bookTopics(scene.center.book) : []);
  const line = category === "games" ? ("key" in scene.line ? text(scene.line.key) : ui(scene.line.text)) : topics.slice(0, 2).map(topic => ui(topic)).join(" · ");
  const captionId = category === "learn" ? `book-${scene.center.id}` : category === "games" ? "chess" : scene.center.id;

  const skip = () => document.querySelector("[data-journey-stop]")?.scrollIntoView({ block: "start" });

  return <section className="journey-flyby" data-journey-flyby aria-label={text(scene.pick)}>
    <button type="button" className="journey-skip" onClick={skip}>{text("skipFlight")}</button>
    <div className="journey-flyby-stage">
      <div className="journey-sky" aria-hidden="true">
        {flybyStars.map(layer => <StarLayer key={layer.className} className={layer.className} zoom={layer.zoom} camera={camera} />)}
      </div>
      <m.h2 className="flyby-title" style={{ opacity: pickOpacity, y: pickLift, x: pickShift }}>{text(scene.pick)}</m.h2>
      {scene.center.kind === "planet" && <m.strong className="flyby-label flyby-chess-label" aria-hidden="true" style={{ opacity: planetLabel }}>{ui(scene.center.title)}</m.strong>}
      <Fragment key={category}>
        {scene.items.map(item => <FlybyObject key={item.id} item={item} camera={camera} live={live} />)}
        {scene.center.kind !== "planet" && <FlybyObject item={scene.center} center camera={camera} live={live} />}
      </Fragment>
      <m.div className="flyby-chess" style={{ opacity: captionOpacity, pointerEvents: arrived ? "auto" : "none" }}>
        <TravelingCaption key={captionId} id={captionId} title={ui(scene.center.title)} line={line} />
        <m.div style={{ opacity: buttonOpacity }}><Link to={scene.center.route} tabIndex={arrived ? 0 : -1} className="flyby-cta">{text(scene.cta)}<ArrowRight size={17} aria-hidden="true" /></Link></m.div>
      </m.div>
      <m.div className="flyby-hint" aria-hidden="true" style={{ opacity: hintOpacity }}>{text("scrollToTravel")}<ChevronDown size={16} /></m.div>
    </div>
  </section>;
}
