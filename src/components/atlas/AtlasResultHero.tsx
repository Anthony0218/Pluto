import type { CSSProperties, ReactNode } from "react";
import { Trophy } from "lucide-react";
import GameXpReward from "@/components/games/GameXpReward";

/** Shared winner card; decorative particles stay quiet for reduced-motion users. */
export function AtlasResultHero({ eyebrow, title, heading = "h1", xp = 0 }: { eyebrow: ReactNode; title: ReactNode; heading?: "h1" | "h2"; xp?: number }) {
  const Heading = heading;
  return <section className="atlas-winner-box" aria-label="Game result">
    <div className="atlas-result-particles" aria-hidden="true">{Array.from({ length: 28 }, (_, index) => <i key={index} style={{ "--x": `${(index * 37 + 11) % 100}%`, "--delay": `${index % 7 * -.47}s`, "--duration": `${3 + index % 5 * .45}s`, "--drift": `${(index % 2 ? 1 : -1) * (20 + index % 4 * 12)}px`, "--particle": index % 3 === 0 ? "#ffd372" : index % 3 === 1 ? "#79e9e4" : "#c4a4ff" } as CSSProperties} />)}</div>
    <div className="atlas-result-orbit" aria-hidden="true"><Trophy /></div>
    <span className="atlas-eyebrow">{eyebrow}</span>
    <Heading>{title}</Heading>
    <div className="relative z-10 mx-auto w-full max-w-sm"><GameXpReward amount={xp} /></div>
  </section>;
}
