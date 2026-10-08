import { useRef } from "react";
import { Link } from "react-router-dom";
import { useMotionValue, useTransform, type MotionValue } from "motion/react";
import * as m from "motion/react-m";
import { useLandingReducedMotion as useReducedMotion } from "./motionPreference";
import { ui, useUiLanguage } from "@/i18n/ui";
import { universeBooks } from "../planetary/universeCatalog";

/** The four stars are the original path; the shelf has since grown. */
const pathBooks = ["math", "music", "game-guides", "game-analysis"].map(id => universeBooks.find(book => book.id === id)!);
import { useCopy } from "./copy";
import { useViewportScroll } from "./viewport";

// Coordinates in the 520 × 190 sky; each star is one real learning destination, in the order a learner meets them.
const WIDTH = 520;
const HEIGHT = 190;
const points = [{ x: 56, y: 128, above: false }, { x: 190, y: 62, above: true }, { x: 330, y: 122, above: false }, { x: 464, y: 56, above: true }];
const thresholds = [0.02, 0.34, 0.67, 0.98];
const route = "M56 128 C 110 128, 140 62, 190 62 S 280 122, 330 122 S 410 56, 464 56";

function Stop({ book, point, threshold, progress }: { book: (typeof pathBooks)[number]; point: (typeof points)[number]; threshold: number; progress: MotionValue<number> }) {
  const lit = useTransform(progress, [threshold - 0.14, threshold], [0, 1]);
  const starScale = useTransform(lit, [0, 1], [0.5, 1]);
  const starOpacity = useTransform(lit, [0, 1], [0.3, 1]);
  const nameOpacity = useTransform(lit, [0, 1], [0.5, 1]);
  return <Link to={book.route} className={`constellation-stop${point.above ? " constellation-stop--above" : ""}`} style={{ left: `${(point.x / WIDTH) * 100}%`, top: `${(point.y / HEIGHT) * 100}%` }}>
    <m.span className="constellation-star" aria-hidden="true" style={{ scale: starScale, opacity: starOpacity }} />
    <m.span className="constellation-name" style={{ opacity: nameOpacity }}>{ui(book.title)}</m.span>
  </Link>;
}

/** A line of light draws itself through the learning path as the section scrolls into view, lighting each star it reaches. */
export default function LearningConstellation() {
  useUiLanguage();
  const text = useCopy();
  const reducedMotion = useReducedMotion();
  const sky = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useViewportScroll({ target: sky, offset: ["start 92%", "start 38%"] });
  const complete = useMotionValue(1);
  const progress = reducedMotion ? complete : scrollYProgress;

  return <nav className="constellation" aria-label={text("pathLabel")}>
    <p className="constellation-title">{text("yourPath")}</p>
    <div ref={sky} className="constellation-sky">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true">
        <defs><linearGradient id="constellation-line" x1="0" x2="1"><stop offset="0" stopColor="#7dd3fc" /><stop offset="0.55" stopColor="#a5b4fc" /><stop offset="1" stopColor="#f0abfc" /></linearGradient></defs>
        <path d={route} fill="none" stroke="#a5b4fc" strokeOpacity="0.22" strokeWidth="1.5" strokeDasharray="3 7" />
        <m.path d={route} fill="none" stroke="url(#constellation-line)" strokeWidth="2.5" strokeLinecap="round" style={{ pathLength: progress, filter: "drop-shadow(0 0 5px #818cf8aa)" }} />
      </svg>
      {pathBooks.map((book, index) => <Stop key={book.id} book={book} point={points[index]} threshold={thresholds[index]} progress={progress} />)}
    </div>
  </nav>;
}
