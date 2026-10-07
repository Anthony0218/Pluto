import type { CSSProperties } from "react";

/** A fixed set of particles, so the layer renders the same on every visit and never re-randomises. */
const particles = Array.from({ length: 26 }, (_, i) => {
  const unit = (n: number) => { const x = Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
  return {
    left: `${Math.round(unit(1) * 100)}%`,
    size: `${(1.5 + unit(2) * 2.5).toFixed(1)}px`,
    duration: `${Math.round(22 + unit(3) * 26)}s`,
    delay: `-${Math.round(unit(4) * 40)}s`,
    drift: `${Math.round((unit(5) - 0.5) * 90)}px`,
    peak: (0.18 + unit(6) * 0.3).toFixed(2),
    tone: i % 3,
  };
});

/** Faint dots drifting up behind the dashboard. Decorative only; hidden when motion is reduced. */
export default function DashboardParticles() {
  return <div className="dashboard-particles" aria-hidden="true">
    {particles.map((p, i) => <span key={i} data-tone={p.tone} style={{ left: p.left, width: p.size, height: p.size, animationDuration: p.duration, animationDelay: p.delay, "--drift": p.drift, "--peak": p.peak } as CSSProperties} />)}
  </div>;
}
