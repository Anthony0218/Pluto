import { useEffect, useState } from "react";

// Lives beside the rolling player's portrait, including when the turn panel is closed.
export default function DiceRoll({ rolling, value, name }: { rolling: boolean; value: number | null; name: string }) {
  const [face, setFace] = useState(0);
  useEffect(() => {
    if (!rolling) return;
    const timer = setInterval(() => setFace((previous) => (previous + 7) % 11), 75);
    return () => clearInterval(timer);
  }, [rolling]);
  const tier = rolling ? "rolling" : value === 0 ? "zero" : (value ?? 0) <= 3 ? "low" : (value ?? 0) <= 7 ? "mid" : "high";
  return <span className={"pp-player-roll dice-tier-" + tier} role="status" aria-label={rolling ? `${name} is rolling` : `${name} rolled ${value}`}>
    <span className={"pp-die pp-die-small" + (rolling ? " rolling" : "")} aria-hidden="true">{rolling ? face : value}</span>
    <span className="dice-particles" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ "--particle-index": i } as React.CSSProperties}/>)}</span><small>{rolling ? "Rolling…" : "Rolled " + value}</small>
  </span>;
}
