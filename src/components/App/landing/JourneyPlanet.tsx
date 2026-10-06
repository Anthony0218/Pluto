import type { CSSProperties } from "react";
import { useTransform, type MotionStyle } from "motion/react";
import * as m from "motion/react-m";
import type { PlanetPose } from "./planetPose";

const books = [
  { color: "#e79924", period: 9, delay: 0 },
  { color: "#5aa9e6", period: 9, delay: -3 },
  { color: "#c084fc", period: 9, delay: -6 },
];
const moons = [
  { color: "#34d399", period: 14, delay: 0 },
  { color: "#f472b6", period: 14, delay: -3.5 },
  { color: "#fbbf24", period: 14, delay: -7 },
  { color: "#60a5fa", period: 14, delay: -10.5 },
];

/** The CSS planet: the fallback look, and always the home of the orbiting books, friends and the scanner sweep. */
export default function JourneyPlanet({ pose }: { pose: PlanetPose }) {
  const tilt = useTransform(pose.tilt, value => `${value}deg`);
  const style = { x: pose.x, y: pose.y, scale: pose.scale, opacity: pose.opacity, "--light": pose.light, "--base": pose.base, "--dark": pose.dark, "--glow": pose.glow, "--ring": pose.ring, "--ring-tilt": tilt } as MotionStyle;
  return <m.div className="journey-planet" style={style}>
    <span className="journey-planet-body">
      <span className="solar-art journey-art">
        <span className="solar-atmosphere" />
        <span className="solar-ring" />
        <span className="solar-sphere"><m.span className="journey-scan" style={{ opacity: pose.scan }} /></span>
      </span>
      <m.span className="journey-orbiters" style={{ opacity: pose.books }}>
        {books.map(book => <span key={book.color} className="journey-orbiter" style={{ "--t": `${book.period}s`, "--d": `${book.delay}s` } as CSSProperties}><i className="journey-book" style={{ background: book.color }} /></span>)}
      </m.span>
      <m.span className="journey-orbiters" style={{ opacity: pose.moons }}>
        {moons.map(moon => <span key={moon.color} className="journey-orbiter journey-orbiter--moon" style={{ "--t": `${moon.period}s`, "--d": `${moon.delay}s` } as CSSProperties}><i className="journey-moon" style={{ background: moon.color, boxShadow: `0 0 14px ${moon.color}` }} /></span>)}
      </m.span>
    </span>
  </m.div>;
}
