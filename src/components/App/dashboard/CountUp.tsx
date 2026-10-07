import { useEffect, useState } from "react";

/** Counts from 0 up to `to` once `active`; shows the final number straight away when motion is reduced. */
export default function CountUp({ to, active, duration = 900 }: { to: number; active: boolean; duration?: number }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || to <= 0) { setValue(to); return; }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(to * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, to, duration]);
  return <>{value}</>;
}
